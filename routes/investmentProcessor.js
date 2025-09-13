const cron = require('node-cron');
const db = require('../database/schema');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const emailService = require('../middleware/email');
const { v4: uuidv4 } = require('uuid');

const processMaturedInvestments = async () => {
    console.log(`[CRON] Running job: Process Matured Investments at ${new Date().toISOString()}`);
    let connection;
    try {
        const maturedInvestments = await Investment.findMatured();

        if (maturedInvestments.length === 0) {
            console.log('[CRON] No matured investments to process.');
            return;
        }

        console.log(`[CRON] Found ${maturedInvestments.length} matured investment(s) to process.`);

        for (const investment of maturedInvestments) {
            connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                // 1. Calculate payout (principal + profit)
                const payoutAmount = parseFloat(investment.amount) + parseFloat(investment.expected_return);

                // 2. Update investment status to 'completed'
                await connection.execute(
                    `UPDATE investments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [investment.id]
                );

                // 3. Update user's balance and total invested amount
                await connection.execute(
                    `UPDATE users SET account_balance = account_balance + ?, total_invested = total_invested - ? WHERE id = ?`,
                    [payoutAmount, investment.amount, investment.user_id]
                );

                // 4. Create a 'payout' transaction record for the full amount returned to balance
                await Transaction.create({
                    id: uuidv4(),
                    user_id: investment.user_id,
                    type: 'payout',
                    amount: payoutAmount,
                    status: 'completed',
                    description: `Payout for completed investment in ${investment.package_name}`,
                    reference_id: investment.id
                }, connection);

                // 5. Log the system action in the audit log
                await connection.execute(
                    `INSERT INTO audit_logs (id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)`,
                    [uuidv4(), 'investment_matured', 'investment', investment.id, JSON.stringify({ payout_amount: payoutAmount, user_id: investment.user_id })]
                );

                await connection.commit();
                console.log(`[CRON] Successfully processed investment ${investment.id} for user ${investment.user_id}.`);

                // 6. Send notification email (fire and forget)
                const user = await User.findById(investment.user_id);
                if (user) {
                    emailService.sendInvestmentCompletedEmail(user, investment, payoutAmount)
                        .catch(err => console.error(`[CRON] Failed to send completion email for investment ${investment.id}:`, err));
                }

            } catch (error) {
                console.error(`[CRON] Error processing investment ${investment.id}. Rolling back.`, error);
                await connection.rollback();
            } finally {
                if (connection) connection.release();
            }
        }
    } catch (error) {
        console.error('[CRON] A critical error occurred in the processMaturedInvestments job:', error);
    }
};

// Schedule the job to run every hour.
const schedule = () => {
    cron.schedule('0 * * * *', processMaturedInvestments);
    console.log('[CRON] Scheduled job: Process Matured Investments to run every hour.');
};

module.exports = {
    schedule,
    processMaturedInvestments // Export for manual triggering/testing
};