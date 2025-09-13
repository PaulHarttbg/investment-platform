const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');
const { validateInvestment, handleValidationErrors } = require('../middleware/validation');
const Investment = require('../models/Investment');
const InvestmentPackage = require('../models/InvestmentPackage');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const db = require('../database/schema');
const emailService = require('../middleware/email');

// Create a new investment
router.post('/', auth, validateInvestment, handleValidationErrors, async (req, res) => {
    const { packageId, amount } = req.body;
    const userId = req.user.id;
    let connection;

    try {
        connection = await db.connection.getConnection();
        await connection.beginTransaction();

        // 1. Fetch user and package details within the transaction
        const user = await User.findById(userId, connection);
        const pkg = await InvestmentPackage.findById(packageId, connection);

        // 2. Validate investment
        if (!pkg) {
            await connection.rollback();
            return res.status(404).json({ error: 'Investment package not found.' });
        }
        if (amount < pkg.min_amount || amount > pkg.max_amount) {
            await connection.rollback();
            return res.status(400).json({ error: `Investment amount must be between ${pkg.min_amount} and ${pkg.max_amount}.` });
        }
        if (user.account_balance < amount) {
            await connection.rollback();
            return res.status(400).json({ error: 'Insufficient account balance.' });
        }

        // 3. Deduct amount from user balance and update total invested
        await connection.execute(
            'UPDATE users SET account_balance = account_balance - ?, total_invested = total_invested + ? WHERE id = ?',
            [amount, amount, userId]
        );

        // 4. Create the investment record
        const investmentId = uuidv4();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + pkg.duration_days);
        const expectedReturn = amount * (pkg.return_rate / 100);

        const newInvestment = await Investment.create({
            id: investmentId,
            user_id: userId,
            package_id: packageId,
            amount,
            expected_return: expectedReturn,
            end_date: endDate
        }, connection);

        // 5. Create a transaction record for the investment
        const transactionId = uuidv4();
        await Transaction.create({
            id: transactionId,
            user_id: userId,
            type: 'investment',
            amount: -amount, // Negative because it's an outflow from balance
            status: 'completed',
            description: `Investment in ${pkg.name}`,
            reference_id: investmentId
        }, connection);

        await connection.commit();

        // Send confirmation email (outside of transaction)
        emailService.sendInvestmentConfirmation(user, newInvestment, pkg).catch(console.error);

        res.status(201).json({
            message: 'Investment created successfully!',
            investment: newInvestment
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Create investment error:', error);
        res.status(500).json({ error: 'Failed to create investment.' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;