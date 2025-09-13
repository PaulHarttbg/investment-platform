const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const database = require('../database/schema.js');
const User = require('../models/User.js');
const Investment = require('../models/Investment.js');
const Transaction = require('../models/Transaction.js');

const router = express.Router();

// Get user profile
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Don't send sensitive data
        delete user.password_hash;

        res.json({
            user: user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            error: 'Failed to fetch profile',
            message: 'An error occurred while fetching your profile'
        });
    }
});

// Update user profile
router.put('/profile', [
    body('firstName').optional().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('lastName').optional().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
    body('country').optional().notEmpty().withMessage('Country cannot be empty')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { firstName, lastName, phone, country } = req.body;
        const updates = {};
        const params = [];

        if (firstName) {
            updates.first_name = firstName;
            params.push(firstName);
        }
        if (lastName) {
            updates.last_name = lastName;
            params.push(lastName);
        }
        if (phone) {
            updates.phone = phone;
            params.push(phone);
        }
        if (country) {
            updates.country = country;
            params.push(country);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                error: 'No valid fields to update'
            });
        }

        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        params.push(req.user.id);

        await User.update(req.user.id, updates);

        // Log profile update
        await database.query(`
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuidv4(), req.user.id, 'profile_update', 'user', req.user.id,
            JSON.stringify(updates), req.ip, req.get('User-Agent') || null
        ]);

        res.json({
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            error: 'Update failed',
            message: 'An error occurred while updating your profile'
        });
    }
});

// Change password
router.put('/change-password', [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        // Get current password hash
        const user = await User.findById(req.user.id);

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({
                error: 'Invalid current password'
            });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

        // Update password
        await User.updatePassword(req.user.id, newPasswordHash);

        // Log password change
        await database.query(`
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            uuidv4(), req.user.id, 'password_change', 'user', req.user.id,
            req.ip, req.get('User-Agent') || null
        ]);

        res.json({
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            error: 'Password change failed',
            message: 'An error occurred while changing your password'
        });
    }
});

// Get user dashboard data
router.get('/dashboard', async (req, res) => {
    try {
        // Get user summary
        const userSummary = await User.getDashboardSummary(req.user.id);

        // Get active investments
        const { investments: activeInvestments } = await Investment.findAllByUserId(req.user.id, { limit: 5, status: 'active' });

        // Get recent transactions
        const { transactions: recentTransactions } = await Transaction.findAllByUserId(req.user.id, { limit: 10 });

        // Calculate portfolio performance
        const investmentSummary = await Investment.getSummary(req.user.id);

        res.json({
            user: {
                accountBalance: userSummary.account_balance,
                totalInvested: userSummary.total_invested,
                totalProfit: userSummary.total_profit
            },
            investments: {
                active: activeInvestments,
                summary: {
                    count: investmentSummary.active_investments || 0,
                    totalAmount: investmentSummary.total_invested || 0,
                    currentValue: investmentSummary.total_current_value || 0,
                    profitLoss: (investmentSummary.total_current_value || 0) - (investmentSummary.total_invested || 0)
                }
            },
            transactions: recentTransactions
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            error: 'Failed to load dashboard',
            message: 'An error occurred while loading your dashboard'
        });
    }
});

// Get user investment history
router.get('/investments', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const { investments, pagination } = await Investment.findAllByUserId(req.user.id, { page, limit });

        res.json({
            investments: investments,
            pagination: pagination
        });

    } catch (error) {
        console.error('Get investments error:', error);
        res.status(500).json({
            error: 'Failed to fetch investments',
            message: 'An error occurred while fetching your investments'
        });
    }
});

// Get user transaction history
router.get('/transactions', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type; // filter by transaction type

        const { transactions, pagination } = await Transaction.findAllByUserId(req.user.id, { page, limit, type });

        res.json({
            transactions: transactions,
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

module.exports = router;
