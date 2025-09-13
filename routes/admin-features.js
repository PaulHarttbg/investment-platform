const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const { auth, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Export all users to CSV
router.get('/users/export', auth, isAdmin, async (req, res) => {
    try {
        // A high limit to get all users. For very large datasets, consider streaming.
        const { users } = await User.findAll({ limit: 10000, page: 1 });

        const fields = [
            'id', 'login_id', 'email', 'first_name', 'last_name',
            'account_balance', 'total_invested', 'account_status', 'created_at'
        ];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(users);

        res.header('Content-Type', 'text/csv');
        res.attachment('users-export.csv');
        res.send(csv);

    } catch (error) {
        console.error('Export users error:', error);
        res.status(500).json({ error: 'Failed to export users.' });
    }
});

// Export all transactions to CSV
router.get('/transactions/export', auth, isAdmin, async (req, res) => {
    try {
        const transactions = await Transaction.findAllForAdmin({ limit: 50000 }); // Use a high limit

        const fields = [
            { label: 'Transaction ID', value: 'id' },
            { label: 'User Login ID', value: 'login_id' },
            { label: 'User Name', value: row => `${row.first_name} ${row.last_name}` },
            { label: 'Type', value: 'type' },
            { label: 'Amount', value: 'amount' },
            { label: 'Status', value: 'status' },
            { label: 'Date', value: 'created_at' },
        ];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(transactions.transactions);

        res.header('Content-Type', 'text/csv');
        res.attachment('transactions-export.csv');
        res.send(csv);

    } catch (error) {
        console.error('Export transactions error:', error);
        res.status(500).json({ error: 'Failed to export transactions.' });
    }
});

// Soft delete a user by setting their status to 'deleted'
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Use the existing User.update method for a soft delete
        const [result] = await User.update(id, { account_status: 'deleted' });

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json({ message: 'User has been deleted successfully.' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

module.exports = router;