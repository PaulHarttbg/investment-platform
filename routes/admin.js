const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/schema');
const AdminUser = require('../models/AdminUser');
const User = require('../models/User');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const InvestmentPackage = require('../models/InvestmentPackage');
const { auth, isAdmin } = require('../middleware/auth');
const appConfig = require('../config/appConfig');
const emailService = require('../middleware/email');
const router = express.Router();

// Admin Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await AdminUser.findByEmail(email);

    if (!admin) return res.status(401).json({ error: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.json({ message: 'Admin login successful.', token, user: admin, redirect: '/admin/index.html' });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Admin login failed.' });
  }
});

// Get admin authentication status
router.get('/status', auth, isAdmin, async (req, res) => {
    try {
        const admin = await AdminUser.findById(req.user.id);
        if (!admin) return res.status(404).json({ isAuthenticated: false, error: 'Admin user not found.' });
        res.json({ isAuthenticated: true, user: admin });
    } catch (error) {
        res.status(500).json({ isAuthenticated: false, error: 'Failed to get admin authentication status.' });
    }
});

// APPLY MIDDLEWARE FOR ALL FOLLOWING ROUTES
router.use(auth);
router.use(isAdmin);

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        // Use Promise.all to fetch data concurrently
        const [
            userStats,
            investmentStats,
            transactionStats,
            recentUsers,
            recentTransactions
        ] = await Promise.all([
            User.getStatistics(), // Assuming you create this method in User model
            Investment.getAdminStatistics(), // Assuming you create this method
            Transaction.getAdminStatistics(), // Assuming you create this method
            User.findAll({ limit: 10, page: 1 }),
            Transaction.findAllForAdmin({ limit: 10, page: 1 })
        ]);

        res.json({
            statistics: {
                users: userStats, // Data from User.getStatistics()
                investments: investmentStats, // Data from Investment.getAdminStatistics()
                transactions: transactionStats // Data from Transaction.getAdminStatistics()
            },
            recentActivity: {
                users: recentUsers.users,
                transactions: recentTransactions.transactions
            }
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            error: 'Failed to load dashboard',
            message: 'An error occurred while loading the admin dashboard'
        });
    }
});

// Get all users with pagination and filters
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', status = '' } = req.query;
        const { users, total, totalPages } = await User.findAll({ 
            page: parseInt(page), 
            limit: parseInt(limit), 
            search, 
            status 
        });
        
        // Format response
        res.json({
            success: true,
            users: users,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// Get specific user details
router.get('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        delete user.password_hash;

        // Get user's investments
        const { investments } = await Investment.findAllByUserId(id);

        // Get user's transactions
        const { transactions } = await Transaction.findAllByUserId(id, { limit: 20 });

        res.json({
            user: user,
            investments: investments,
            transactions: transactions
        });

    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({
            error: 'Failed to fetch user details',
            message: 'An error occurred while fetching user details'
        });
    }
});

// Update user details
router.put('/users/:id', [
    body('firstName').optional().isString().trim().notEmpty(),
    body('lastName').optional().isString().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('account_balance').optional().isFloat(),
    body('total_invested').optional().isFloat(),
    body('total_profit').optional().isFloat(),
    body('account_status').optional().isIn(['active', 'suspended', 'closed']),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const allowedUpdates = ['first_name', 'last_name', 'email', 'account_balance', 'total_invested', 'total_profit', 'account_status'];
        const updateFields = {};

        for (const key in updates) {
            const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedUpdates.includes(dbKey) && updates[key] != null) {
                updateFields[dbKey] = updates[key];
            }
        }

        if (Object.keys(updateFields).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

        await User.update(id, updateFields);

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Update user status
router.put('/users/:id/status', [
    body('accountStatus').optional().isIn(['active', 'suspended', 'closed']).withMessage('Invalid account status')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { accountStatus } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const updates = {};
        const params = [];

        if (accountStatus) {
            updates.account_status = accountStatus;
            params.push(accountStatus);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                error: 'No valid fields to update'
            });
        }

        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        params.push(id);

        await User.update(id, updates);

        // Log admin action
        await db.query(
            `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(), req.user.id, 'user_status_update', 'user', id,
                JSON.stringify({ account_status: user.account_status }),
                JSON.stringify(updates), req.ip, req.get('User-Agent') || null
            ]
        );

        res.json({
            message: 'User status updated successfully',
            updates: updates
        });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            error: 'Update failed',
            message: 'An error occurred while updating user status'
        });
    }
});

// Get all transactions with filters
router.get('/transactions', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const type = req.query.type;
        const status = req.query.status;
        const userId = req.query.user_id;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (type) {
            whereClause += ' AND t.type = ?';
            params.push(type);
        }

        if (status) {
            whereClause += ' AND t.status = ?';
            params.push(status);
        }

        if (userId) {
            whereClause += ' AND t.user_id = ?';
            params.push(userId);
        }

        const transactions = await db.query(`
            SELECT 
                t.*, u.login_id, u.first_name, u.last_name, u.email
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            ${whereClause}
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const [totalCountRows] = await db.query(
            `SELECT COUNT(*) as count FROM transactions t ${whereClause}`,
            params
        );

        res.json({
            transactions: transactions,
            pagination: {
                page: page,
                limit: limit,
                total: totalCountRows[0].count,
                pages: Math.ceil(totalCountRows[0].count / limit)
            }
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            error: 'Failed to fetch transactions',
            message: 'An error occurred while fetching transactions'
        });
    }
});

// Update transaction status
router.put('/transactions/:id/status', [
    body('status').isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
    body('transactionHash').optional().isLength({ max: 255 }).withMessage('Transaction hash is too long'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes too long')
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
        const { status, transactionHash, notes } = req.body;

        // Use a transaction for this multi-step operation
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [transactionRows] = await connection.execute(
            `SELECT * FROM transactions WHERE id = ?`,
            [id]
        );
        const transaction = transactionRows[0];

        if (!transaction) {
            await connection.rollback();
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        const oldStatus = transaction.status;

        // 1. Update transaction status
        await connection.execute(
            `UPDATE transactions
            SET status = ?, transaction_hash = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [status, transactionHash || null, notes || null, id]
        );

        // 2. Handle side-effects of status changes
        if (oldStatus === 'pending' && status === 'completed') {
            if (transaction.type === 'deposit') {
                // 2a. Credit user's account for completed deposit
                await connection.execute(`
                    UPDATE users 
                    SET account_balance = account_balance + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [transaction.amount, transaction.user_id]);

                // --- BEGIN REFERRAL BONUS LOGIC ---
                // Check if it's the user's first completed deposit
                const [depositCountRows] = await connection.execute(
                    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND type = 'deposit' AND status = 'completed'`,
                    [transaction.user_id]
                );
                // The count will be 1 if this is the first one, as we just updated it.
                const isFirstCompletedDeposit = depositCountRows[0].count === 1;

                if (isFirstCompletedDeposit) {
                    const [depositorRows] = await connection.execute(`SELECT referred_by FROM users WHERE id = ?`, [transaction.user_id]);
                    const depositor = depositorRows[0];

                    if (depositor && depositor.referred_by) {
                        const referrerId = depositor.referred_by;
                        const bonusPercentage = appConfig.get('referral_bonus_percentage', 0);

                        if (bonusPercentage > 0) {
                            const bonusAmount = transaction.amount * (bonusPercentage / 100);

                            // Award bonus to referrer
                            await connection.execute(`UPDATE users SET account_balance = account_balance + ? WHERE id = ?`, [bonusAmount, referrerId]);

                            // Create referral transaction for the referrer
                            const referralTxId = uuidv4();
                            await connection.execute(
                                `INSERT INTO transactions (id, user_id, type, amount, status, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [referralTxId, referrerId, 'referral', bonusAmount, 'completed', `Referral bonus from user ${transaction.user_id}`, transaction.user_id]
                            );

                            // Log the bonus award
                            await connection.execute(
                                `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?, ?)`,
                                [uuidv4(), req.user.id, 'referral_bonus_award', 'transaction', referralTxId, JSON.stringify({ referrer_id: referrerId, bonus_amount: bonusAmount })]
                            );
                        }
                    }
                }
                // --- END REFERRAL BONUS LOGIC ---

                // Send deposit confirmation email
                const [userRows] = await connection.execute('SELECT id, email, first_name FROM users WHERE id = ?', [transaction.user_id]);
                const user = userRows[0];
                if (user) {
                    emailService.sendDepositConfirmation(user, transaction)
                        .catch(err => console.error(`Failed to send deposit confirmation to ${user.email}:`, err));
                }

            }
        } else if (oldStatus === 'pending' && status === 'failed' && transaction.type === 'withdrawal') {
            // 2b. Refund failed withdrawal
            const totalAmount = transaction.amount + (transaction.fees || 0);
            await connection.execute(
                `UPDATE users 
                SET account_balance = account_balance + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `, [totalAmount, transaction.user_id]);
        }

        // 3. Log admin action
        await connection.execute(
            `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(), req.user.id, 'transaction_status_update', 'transaction', id,
                JSON.stringify({ status: oldStatus }),
                JSON.stringify({ status: status, transaction_hash: transactionHash, notes: notes }),
                req.ip, req.get('User-Agent') || null
            ]
        );

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

// Get all investments with pagination and filters
router.get('/investments', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;
        const { status: statusFilter = '', package: packageFilter = '' } = req.query;

        let baseQuery = `
            FROM investments i
            JOIN users u ON i.user_id = u.id
            JOIN investment_packages p ON i.package_id = p.id
            WHERE 1=1
        `;
        const queryParams = [];

        if (statusFilter) {
            baseQuery += ' AND i.status = ?';
            queryParams.push(statusFilter);
        }

        if (packageFilter) {
            baseQuery += ' AND p.id = ?';
            queryParams.push(packageFilter);
        }

        const countResult = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
        const total = countResult[0]?.total || 0;

        const investments = await db.query(`
            SELECT 
                i.id, i.amount, i.expected_return, i.status, i.start_date, i.end_date,
                u.login_id as user_login_id, u.first_name, u.last_name,
                p.name as package_name
            ${baseQuery}
            ORDER BY i.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        res.json({
            success: true,
            investments,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error('Error fetching investments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch investments'
        });
    }
});

// Get specific transaction details
router.get('/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await db.getOne(`
            SELECT t.*, u.login_id, u.first_name, u.last_name, u.email
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE t.id = ?
        `, [id]);

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({ success: true, transaction });

    } catch (error) {
        console.error('Get transaction details error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch transaction details' });
    }
});

// Get investment packages management
router.get('/packages', async (req, res) => {
    try {
        const packages = await InvestmentPackage.findAllForAdmin();

        res.json({
            packages: packages
        });

    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({
            error: 'Failed to fetch packages',
            message: 'An error occurred while fetching investment packages'
        });
    }
});

// Create investment package
router.post('/packages', [
    body('name').notEmpty().withMessage('Package name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('minAmount').isFloat({ min: 1 }).withMessage('Minimum amount must be positive'),
    body('maxAmount').isFloat({ min: 1 }).withMessage('Maximum amount must be positive'),
    body('returnRate').isFloat({ min: 0, max: 100 }).withMessage('Return rate must be between 0 and 100'),
    body('durationDays').isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
    body('riskLevel').isIn(['low', 'medium', 'high']).withMessage('Invalid risk level')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { name, description, minAmount, maxAmount, returnRate, durationDays, riskLevel } = req.body;

        if (minAmount >= maxAmount) {
            return res.status(400).json({
                error: 'Minimum amount must be less than maximum amount'
            });
        }

        const newPackage = await InvestmentPackage.create({
            name, description, minAmount, maxAmount, returnRate, durationDays, riskLevel
        });

        // Log package creation
        await db.query(
            `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(), req.user.id, 'package_create', 'investment_package', newPackage.id,
                JSON.stringify({ name, min_amount: minAmount, max_amount: maxAmount, return_rate: returnRate }),
                req.ip, req.get('User-Agent') || null
            ]
        );

        res.status(201).json({
            message: 'Investment package created successfully',
            packageId: newPackage.id
        });

    } catch (error) {
        console.error('Create package error:', error);
        res.status(500).json({
            error: 'Package creation failed',
            message: 'An error occurred while creating the investment package'
        });
    }
});

// Get audit logs
router.get('/audit-logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const action = req.query.action;
        const entityType = req.query.entity_type;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (action) {
            whereClause += ' AND action = ?';
            params.push(action);
        }

        if (entityType) {
            whereClause += ' AND entity_type = ?';
            params.push(entityType);
        }

        const logs = await db.query(`
            SELECT 
                al.*,
                u.login_id as user_login_id,
                u.first_name as user_first_name,
                u.last_name as user_last_name,
                au.username as admin_username
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN admin_users au ON al.admin_id = au.id
            ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const [totalCountRows] = await db.query(
            `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
            params
        );

        res.json({
            logs: logs,
            pagination: {
                page: page,
                limit: limit,
                total: totalCountRows[0].count,
                pages: Math.ceil(totalCountRows[0].count / limit)
            }
        });

    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({
            error: 'Failed to fetch audit logs',
            message: 'An error occurred while fetching audit logs'
        });
    }
});

// Generate reports
router.get('/reports/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const startDate = req.query.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = req.query.end_date || new Date().toISOString();

        let reportData = {};

        switch (type) {
            case 'users':
                reportData = await db.query(`
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as new_users
                    FROM users
                    WHERE created_at BETWEEN ? AND ?
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                `, [startDate, endDate]);
                break;

            case 'transactions':
                reportData = await db.query(`
                    SELECT 
                        DATE(created_at) as date,
                        type,
                        COUNT(*) as count,
                        SUM(amount) as total_amount
                    FROM transactions
                    WHERE created_at BETWEEN ? AND ? AND status = 'completed'
                    GROUP BY DATE(created_at), type
                    ORDER BY date DESC, type
                `, [startDate, endDate]);
                break;

            case 'investments':
                reportData = await db.query(`
                    SELECT 
                        DATE(i.created_at) as date,
                        p.name as package_name,
                        COUNT(*) as count,
                        SUM(i.amount) as total_amount
                    FROM investments i
                    JOIN investment_packages p ON i.package_id = p.id
                    WHERE i.created_at BETWEEN ? AND ?
                    GROUP BY DATE(i.created_at), p.name
                    ORDER BY date DESC, package_name
                `, [startDate, endDate]);
                break;

            default:
                return res.status(400).json({
                    error: 'Invalid report type'
                });
        }

        res.json({
            reportType: type,
            dateRange: { startDate, endDate },
            data: reportData
        });

    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({
            error: 'Report generation failed',
            message: 'An error occurred while generating the report'
        });
    }
});

// Export users data
router.get('/users/export', async (req, res) => {
    try {
        const users = await db.query(`
            SELECT 
                u.id, u.username, u.email, 
                u.first_name as firstName, u.last_name as lastName,
                u.status, u.created_at as createdAt, u.last_login as lastLogin,
                GROUP_CONCAT(r.name) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id
        `);
        
        // Convert to CSV
        const headers = ['ID', 'Username', 'Email', 'First Name', 'Last Name', 'Status', 'Created At', 'Last Login', 'Roles'];
        const csvRows = [];
        
        // Add headers
        csvRows.push(headers.join(','));
        
        // Add data rows
        for (const user of users) {
            const row = [
                `"${user.id}"`,
                `"${user.username}"`,
                `"${user.email}"`,
                `"${user.firstName || ''}"`,
                `"${user.lastName || ''}"`,
                `"${user.status}"`,
                `"${new Date(user.createdAt).toISOString()}"`,
                `"${user.lastLogin ? new Date(user.lastLogin).toISOString() : ''}"`,
                `"${user.roles || ''}"`
            ];
            csvRows.push(row.join(','));
        }
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
        
        // Send CSV data
        res.send(csvRows.join('\n'));
        
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export users'
        });
    }
});

// Process monthly payouts for all active investments
router.post('/process-payouts', async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get all active investments and their package return rates
        const [investments] = await connection.execute(`
            SELECT 
                i.id, i.user_id, i.amount, p.return_rate, p.name as package_name
            FROM investments i
            JOIN investment_packages p ON i.package_id = p.id
            WHERE i.status = 'active'
        `);

        if (investments.length === 0) {
            await connection.rollback();
            return res.status(200).json({ message: 'No active investments to process.' });
        }

        let totalPayout = 0;
        let processedCount = 0;

        for (const investment of investments) {
            // Assumption: return_rate is the monthly percentage rate.
            const monthlyProfit = investment.amount * (investment.return_rate / 100);
            
            if (monthlyProfit > 0) {
                // 1. Add profit to user's account balance and total profit
                await connection.execute(
                    'UPDATE users SET account_balance = account_balance + ?, total_profit = total_profit + ? WHERE id = ?',
                    [monthlyProfit, monthlyProfit, investment.user_id]
                );

                // 2. Create a 'payout' transaction record
                await connection.execute(
                    `INSERT INTO transactions (id, user_id, type, amount, status, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), investment.user_id, 'payout', monthlyProfit, 'completed', `Monthly profit from ${investment.package_name}`, investment.id]
                );

                totalPayout += monthlyProfit;
                processedCount++;
            }
        }

        await connection.commit();
        res.json({ message: `Successfully processed ${processedCount} payouts.`, totalPayout, processedCount });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error processing monthly payouts:', error);
        res.status(500).json({ error: 'Failed to process payouts.' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
