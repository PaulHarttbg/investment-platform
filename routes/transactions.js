const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const database = require('../database/schema');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const User = require('../models/User');
const { auth, sensitiveOperationLimit } = require('../middleware/auth');
const appConfig = require('../config/appConfig');
const emailService = require('../middleware/email');
const router = express.Router();

// Create deposit request
router.post('/deposit', [
    auth,
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number'),
    body('paymentMethod').isIn(['bitcoin', 'ethereum', 'usdt', 'bank_transfer']).withMessage('Invalid payment method'),
    body('walletAddress').optional().isLength({ min: 10 }).withMessage('Invalid wallet address')
], async (req, res) => {
    let connection;
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { amount, paymentMethod, walletAddress } = req.body;

        // Validate minimum deposit amount
        const minDeposit = appConfig.get('min_investment_amount', 100);
        if (amount < minDeposit) {
            return res.status(400).json({
                error: 'Amount too low',
                message: `Minimum deposit amount is $${minDeposit}`
            });
        }

        connection = await database.getConnection();
        await connection.beginTransaction();

        // Create deposit transaction
        const transactionId = uuidv4();
        // For crypto, generate a unique, one-time address for this transaction.
        // For bank transfers, this will be null and instructions will be generic.
        let uniqueAddress = null;
        if (paymentMethod !== 'bank_transfer') {
            uniqueAddress = `dep_${crypto.randomBytes(20).toString('hex')}`;
        }

        await Transaction.create({
            id: transactionId,
            user_id: req.user.id,
            type: 'deposit',
            amount: amount,
            status: 'pending',
            description: `Deposit via ${paymentMethod}`,
            payment_method: paymentMethod,
            wallet_address: uniqueAddress // Store the unique address for webhook matching
        }, connection);

        // Generate payment address/details based on method
        let paymentDetails = {};
        if (uniqueAddress) {
            paymentDetails = {
                address: uniqueAddress,
                network: paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1),
                qrCodeData: `${paymentMethod}:${uniqueAddress}?amount=${amount}`,
                memo: transactionId // Some exchanges require a memo
            };
        } else { // Bank transfer
            const bankDetailsString = appConfig.get('bank_transfer_details', '{}');
            try {
                paymentDetails = JSON.parse(bankDetailsString);
                paymentDetails.reference = transactionId; // Add unique reference
            } catch (e) {
                console.error("Failed to parse bank_transfer_details from config", e);
                paymentDetails = { instructions: "Bank transfer is temporarily unavailable. Please contact support.", reference: transactionId };
            }
        }

        // Log deposit request
        await connection.query(`
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuidv4(), req.user.id, 'deposit_request', 'transaction', transactionId,
            JSON.stringify({ amount, payment_method: paymentMethod }), req.ip, req.get('User-Agent')
        ]);

        await connection.commit();

        res.status(201).json({
            message: 'Deposit request created successfully',
            transaction: {
                id: transactionId,
                amount: amount,
                paymentMethod: paymentMethod,
                status: 'pending'
            },
            paymentDetails: paymentDetails
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Create deposit error:', error);
        res.status(500).json({
            error: 'Deposit request failed',
            message: 'An error occurred while creating your deposit request'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Create withdrawal request
router.post('/withdrawal', [
    auth,
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number'),
    body('paymentMethod').isIn(['bitcoin', 'ethereum', 'usdt', 'bank_transfer']).withMessage('Invalid payment method'),
    body('walletAddress').optional().isLength({ min: 10 }).withMessage('Invalid wallet address'),
    body('bankDetails').optional().isObject().withMessage('Invalid bank details')
], sensitiveOperationLimit, async (req, res) => {
    let connection;
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { amount, paymentMethod, walletAddress, bankDetails } = req.body;

        // Get user's current balance
        const user = await User.findById(req.user.id);

        // Validate minimum withdrawal amount
        const minWithdrawal = appConfig.get('min_withdrawal_amount', 50);
        if (amount < minWithdrawal) {
            return res.status(400).json({
                error: 'Amount too low',
                message: `Minimum withdrawal amount is $${minWithdrawal}`
            });
        }

        // Calculate withdrawal fee
        const feePercentage = appConfig.get('withdrawal_fee_percentage', 0.5);
        const fee = amount * (feePercentage / 100);
        const totalAmount = amount + fee;

        // Check sufficient balance
        if (user.account_balance < totalAmount) {
            return res.status(400).json({
                error: 'Insufficient balance',
                message: `Insufficient balance. Required: $${totalAmount} (including $${fee} fee)`
            });
        }

        connection = await database.getConnection();
        await connection.beginTransaction();

        // Create withdrawal transaction
        const transactionId = uuidv4();
        await Transaction.create({
            id: transactionId,
            user_id: req.user.id,
            type: 'withdrawal',
            amount: amount,
            status: 'pending',
            description: `Withdrawal via ${paymentMethod}`,
            payment_method: paymentMethod,
            wallet_address: walletAddress || JSON.stringify(bankDetails),
            fees: fee
        }, connection);

        // Deduct amount from user's balance (hold until processed)
        await connection.query(
            `UPDATE users SET account_balance = account_balance - ? WHERE id = ?`,
            [totalAmount, req.user.id]
        );

        // Log withdrawal request
        await connection.query(`
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuidv4(), req.user.id, 'withdrawal_request', 'transaction', transactionId,
            JSON.stringify({ amount, payment_method: paymentMethod, fee }), req.ip, req.get('User-Agent')
        ]);

        await connection.commit();

        // Send withdrawal request email (fire and forget)
        const transactionForEmail = {
            id: transactionId,
            amount: amount,
            fees: fee,
            payment_method: paymentMethod,
        };
        emailService.sendWithdrawalRequest(user, transactionForEmail)
            .catch(err => console.error(`Failed to send withdrawal request email to ${user.email}:`, err));

        res.status(201).json({
            message: 'Withdrawal request submitted successfully',
            transaction: {
                id: transactionId,
                amount: amount,
                fee: fee,
                totalAmount: totalAmount,
                paymentMethod: paymentMethod,
                status: 'pending'
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Create withdrawal error:', error);
        res.status(500).json({
            error: 'Withdrawal request failed',
            message: 'An error occurred while creating your withdrawal request'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Get user transactions
router.get('/', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const type = req.query.type;
        const status = req.query.status;

        const { transactions, pagination } = await Transaction.findAllByUserId(req.user.id, { page, limit, type, status });

        // Get transaction summary
        const summary = await Transaction.getSummary(req.user.id);

        res.json({
            transactions: transactions,
            summary: {
                totalDeposits: summary.total_deposits || 0,
                totalWithdrawals: summary.total_withdrawals || 0,
                totalInvestments: summary.total_investments || 0,
                pendingTransactions: summary.pending_transactions || 0
            },
            pagination: pagination
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            error: 'Failed to fetch transactions',
            message: 'An error occurred while fetching your transactions'
        });
    }
});

// Get specific transaction details
router.get('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await Transaction.findById(id, req.user.id);

        if (!transaction) {
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        res.json({
            transaction: transaction
        });

    } catch (error) {
        console.error('Get transaction details error:', error);
        res.status(500).json({
            error: 'Failed to fetch transaction details',
            message: 'An error occurred while fetching transaction details'
        });
    }
});

// Cancel pending transaction
router.delete('/:id', auth, async (req, res) => {
    let connection;
    try {
        const { id } = req.params;

        const transaction = await database.getOne(
            'SELECT * FROM transactions WHERE id = ? AND user_id = ? AND status = ?',
            [id, req.user.id, 'pending']
        );

        if (!transaction) {
            return res.status(404).json({
                error: 'Transaction not found or cannot be cancelled'
            });
        }

        // Only allow cancellation of deposits and withdrawals within 1 hour
        const createdAt = new Date(transaction.created_at);
        const now = new Date();
        const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

        if (hoursSinceCreation > 1 && ['deposit', 'withdrawal'].includes(transaction.type)) {
            return res.status(400).json({
                error: 'Transaction cannot be cancelled',
                message: 'Transactions can only be cancelled within 1 hour of creation'
            });
        }

        connection = await database.getConnection();
        await connection.beginTransaction();

        // Cancel transaction
        await connection.query(
            'UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['cancelled', id]
        );

        // If it's a withdrawal, refund the amount
        if (transaction.type === 'withdrawal') {
            const totalAmount = transaction.amount + (transaction.fees || 0);
            await connection.query(`
                UPDATE users 
                SET account_balance = account_balance + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [totalAmount, req.user.id]);
        }

        // Log transaction cancellation
        await connection.query(`
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            uuidv4(), req.user.id, 'transaction_cancel', 'transaction', id,
            req.ip, req.get('User-Agent')
        ]);

        await connection.commit();

        res.json({
            message: 'Transaction cancelled successfully'
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Cancel transaction error:', error);
        res.status(500).json({
            error: 'Cancellation failed',
            message: 'An error occurred while cancelling the transaction'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Update transaction status (for admin/system use)
router.put('/:id/status', auth, [
    body('status').isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
    body('transactionHash').optional().isLength({ min: 10 }).withMessage('Invalid transaction hash')
], async (req, res) => {
    let connection;
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { status, transactionHash } = req.body;

        const transaction = await Transaction.findById(id, req.user.id);

        if (!transaction) {
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        const oldStatus = transaction.status;

        connection = await database.getConnection();
        await connection.beginTransaction();

        // Update transaction
        await connection.query(`
            UPDATE transactions 
            SET status = ?, transaction_hash = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [status, transactionHash, id]);

        // Handle status changes
        if (oldStatus === 'pending' && status === 'completed' && transaction.type === 'deposit') {
            // Credit user's account for completed deposit
            await connection.query(`
                UPDATE users 
                SET account_balance = account_balance + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [transaction.amount, req.user.id]);
        }

        // Log status update
        await connection.query(`
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuidv4(), req.user.id, 'transaction_status_update', 'transaction', id,
            JSON.stringify({ status: oldStatus }),
            JSON.stringify({ status: status, transaction_hash: transactionHash }),
            req.ip, req.get('User-Agent')
        ]);

        await connection.commit();

        res.json({
            message: 'Transaction status updated successfully',
            transaction: {
                id: id,
                oldStatus: oldStatus,
                newStatus: status,
                transactionHash: transactionHash
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Update transaction status error:', error);
        res.status(500).json({
            error: 'Update failed',
            message: 'An error occurred while updating transaction status'
        });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
