const express = require('express');
const router = express.Router();
const db = require('../database/schema');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../middleware/email');
const crypto = require('crypto');
const appConfig = require('../config/appConfig');

// Middleware to verify webhook HMAC signature
const verifyWebhook = (req, res, next) => {
    const signature = req.headers['x-webhook-signature'];
    const secret = appConfig.get('crypto_webhook_secret', 'default-secret-change-me');

    if (!secret || secret === 'default-secret-change-me') {
        console.error('CRITICAL: Webhook secret is not configured securely.');
        return res.status(500).send('Webhook configuration error on server.');
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

    if (!signature || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
        console.warn(`Received a webhook with an invalid signature. Expected: ${digest}, Got: ${signature}`);
        return res.status(401).send('Invalid webhook signature.');
    }

    next();
};

router.post('/crypto-deposit', verifyWebhook, async (req, res) => {
    const { address, amount, confirmations, tx_hash } = req.body;
    const minConfirmations = appConfig.get('min_crypto_confirmations', 3);

    // 1. Basic payload validation
    if (!address || !amount || confirmations === undefined || !tx_hash) {
        return res.status(400).send('Webhook payload is missing required fields.');
    }

    // 2. Check for sufficient confirmations
    if (confirmations < minConfirmations) {
        // It's a valid webhook, but the transaction isn't confirmed enough yet.
        // Acknowledge receipt so the provider doesn't keep sending it.
        return res.status(200).send('Acknowledged. Awaiting more confirmations.');
    }

    let connection;
    try {
        connection = await db.getConnection();

        // 3. Find the pending transaction associated with this unique address.
        // Use FOR UPDATE to lock the row and prevent race conditions from multiple webhooks for the same tx.
        const [txRows] = await connection.execute(
            `SELECT * FROM transactions WHERE wallet_address = ? AND status = 'pending' AND type = 'deposit' FOR UPDATE`,
            [address]
        );
        const transaction = txRows[0];

        if (!transaction) {
            // This can happen if the webhook is delayed and the transaction was already processed.
            // It's not an error, so we send a 200 OK.
            return res.status(200).send('Transaction not found or already processed.');
        }

        // Start a database transaction to ensure all updates are atomic.
        await connection.beginTransaction();

        // 4. Update transaction status to 'completed'
        await connection.execute(
            `UPDATE transactions SET status = 'completed', transaction_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [tx_hash, transaction.id]
        );

        // 5. Credit the user's account balance with the received amount.
        await connection.execute(
            `UPDATE users SET account_balance = account_balance + ? WHERE id = ?`,
            [amount, transaction.user_id]
        );

        // 6. Handle Referral Bonus Logic (copied and adapted from admin.js)
        const [depositCountRows] = await connection.execute(
            `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND type = 'deposit' AND status = 'completed'`,
            [transaction.user_id]
        );
        const isFirstCompletedDeposit = depositCountRows[0].count === 1;

        if (isFirstCompletedDeposit) {
            const [depositorRows] = await connection.execute(`SELECT referred_by FROM users WHERE id = ?`, [transaction.user_id]);
            const depositor = depositorRows[0];

            if (depositor && depositor.referred_by) {
                const referrerId = depositor.referred_by;
                // Use the new config service to get the referral bonus percentage
                const bonusPercentage = appConfig.get('referral_bonus_percentage', 0);

                if (bonusPercentage > 0) {
                    // Use the actual deposited amount for the bonus calculation
                    const bonusAmount = parseFloat(amount) * (bonusPercentage / 100);

                    // Award bonus to referrer
                    await connection.execute(`UPDATE users SET account_balance = account_balance + ? WHERE id = ?`, [bonusAmount, referrerId]);

                    // Create referral transaction for the referrer
                    const referralTxId = uuidv4();
                    await connection.execute(
                        `INSERT INTO transactions (id, user_id, type, amount, status, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [referralTxId, referrerId, 'referral', bonusAmount, 'completed', `Referral bonus from user ${transaction.user_id}`, transaction.user_id]
                    );
                }
            }
        }

        // 7. Log this system action in the audit log
        await connection.execute(
            `INSERT INTO audit_logs (action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?)`,
            ['crypto_deposit_confirmed', 'transaction', transaction.id, JSON.stringify({ amount, tx_hash })]
        );

        await connection.commit();

        // 8. Send confirmation email to the user (fire and forget)
        const [userRows] = await connection.execute('SELECT id, email, first_name FROM users WHERE id = ?', [transaction.user_id]);
        const user = userRows[0];
        if (user) {
            // We need to update the transaction object with the received amount for the email
            const emailTransaction = { ...transaction, amount: amount };
            emailService.sendDepositConfirmation(user, emailTransaction)
                .catch(err => console.error(`Failed to send deposit confirmation to ${user.email}:`, err));
        }

        res.status(200).send('Deposit processed successfully.');

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Failed to rollback transaction:', rollbackError);
            }
        }
        console.error('Webhook processing error:', error);
        // Send a 500 to indicate to the webhook provider that something went wrong and it should retry.
        res.status(500).send('Internal server error during webhook processing.');
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;