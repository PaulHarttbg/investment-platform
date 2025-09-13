const database = require('../database/schema');

class Transaction {
    static async findById(id, userId, connection = database) {
        const query = 'SELECT * FROM transactions WHERE id = ? AND user_id = ?';
        return connection.getOne(query, [id, userId]);
    }

    static async findAllByUserId(userId, options = {}, connection = database) {
        const { page = 1, limit = 10, type = '', status = '', reference_id = null } = options;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE user_id = ?';
        const params = [userId];

        if (type) {
            whereClause += ' AND type = ?';
            params.push(type);
        }
        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }
        if (reference_id) {
            whereClause += ' AND reference_id = ?';
            params.push(reference_id);
        }

        const transactions = await connection.query(`
            SELECT id, type, amount, currency, status, description, created_at
            FROM transactions
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const [totalCountResult] = await connection.query(
            `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
            params
        );

        return { 
            transactions, 
            pagination: { 
                page, 
                limit, 
                total: totalCountResult[0].count || 0,
                pages: Math.ceil((totalCountResult[0].count || 0) / limit)
            }
        };
    }

    static async create(txData, connection = database) {
        const { id, user_id, type, amount, status, description, reference_id, payment_method, wallet_address, fees } = txData;
        const query = `
            INSERT INTO transactions (id, user_id, type, amount, status, description, reference_id, payment_method, wallet_address, fees, currency) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD')
        `;
        await connection.execute(query, [id, user_id, type, amount, status, description, reference_id, payment_method, wallet_address, fees]);
        return { id, ...txData };
    }
    
    static async getSummary(userId, connection = database) {
        return connection.getOne(`
            SELECT 
                SUM(CASE WHEN type = 'deposit' AND status = 'completed' THEN amount ELSE 0 END) as total_deposits,
                SUM(CASE WHEN type = 'withdrawal' AND status = 'completed' THEN amount ELSE 0 END) as total_withdrawals,
                SUM(CASE WHEN type = 'investment' AND status = 'completed' THEN amount ELSE 0 END) as total_investments,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions
            FROM transactions
            WHERE user_id = ?
        `, [userId]);
    }

    static async getAdminStatistics(connection = database) {
        return connection.getOne(`
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN type = 'deposit' AND status = 'completed' THEN amount ELSE 0 END) as total_deposits,
                SUM(CASE WHEN type = 'withdrawal' AND status = 'completed' THEN amount ELSE 0 END) as total_withdrawals,
                SUM(CASE WHEN type = 'payout' AND status = 'completed' THEN amount ELSE 0 END) as total_profits_paid,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions
            FROM transactions
        `);
    }

    static async findAllForAdmin(options = {}, connection = database) {
        const { limit = 10 } = options;
        const transactions = await connection.query(`
            SELECT 
                t.id, t.type, t.amount, t.status, t.created_at,
                u.login_id, u.first_name, u.last_name
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
            LIMIT ?
        `, [limit]);
        return { transactions };
    }
}

module.exports = Transaction;