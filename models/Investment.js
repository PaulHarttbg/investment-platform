const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');

class Investment {
    static async findById(id, userId, connection = database) {
        const query = `
            SELECT 
                i.*, p.name as package_name, p.description as package_description,
                p.return_rate, p.duration_days, p.risk_level
            FROM investments i
            JOIN investment_packages p ON i.package_id = p.id
            WHERE i.id = ? AND i.user_id = ?
        `;
        return connection.getOne(query, [id, userId]);
    }

    static async findAllByUserId(userId, options = {}, connection = database) {
        const { page = 1, limit = 20, status = '' } = options;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE i.user_id = ?';
        const params = [userId];

        if (status) {
            whereClause += ' AND i.status = ?';
            params.push(status);
        }

        const investments = await connection.query(`
            SELECT 
                i.id, i.amount, i.expected_return, i.current_value, i.status,
                i.start_date, i.end_date, i.created_at,
                p.name as package_name, p.return_rate, p.duration_days, p.risk_level
            FROM investments i
            JOIN investment_packages p ON i.package_id = p.id
            ${whereClause}
            ORDER BY i.created_at DESC
            LIMIT ?, ?`,
            [...params, offset, limit]
        );

        const [totalCountResult] = await connection.query(
            `SELECT COUNT(*) as count FROM investments i ${whereClause}`,
            params
        );

        return { 
            investments, 
            pagination: { 
                page, 
                limit, 
                total: totalCountResult[0].count || 0,
                pages: Math.ceil((totalCountResult[0].count || 0) / limit)
            }
        };
    }

    static async create(invData, connection) {
        const { id, user_id, package_id, amount, expected_return, end_date } = invData;
        const query = `
            INSERT INTO investments (id, user_id, package_id, amount, expected_return, current_value, end_date, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `;
        await connection.execute(query, [id, user_id, package_id, amount, expected_return, amount, end_date]);
        return { id, ...invData };
    }

    static async cancel(id, userId, connection) {
        const investment = await connection.getOne(
            'SELECT * FROM investments WHERE id = ? AND user_id = ? AND status = ?',
            [id, userId, 'active']
        );

        if (!investment) {
            const error = new Error('Investment not found or cannot be cancelled');
            error.statusCode = 404;
            throw error;
        }

        const createdAt = new Date(investment.created_at);
        const now = new Date();
        const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

        if (hoursSinceCreation > 24) {
            const error = new Error('Investments can only be cancelled within 24 hours of creation');
            error.statusCode = 400;
            throw error;
        }

        await connection.execute('UPDATE investments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['cancelled', id]);
        await connection.execute(
            `UPDATE users SET account_balance = account_balance + ?, total_invested = total_invested - ? WHERE id = ?`,
            [investment.amount, investment.amount, userId]
        );
        await connection.execute(
            `INSERT INTO transactions (id, user_id, type, amount, status, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), userId, 'refund', investment.amount, 'completed', `Refund for cancelled investment`, id]
        );

        return investment;
    }
    
    static async getSummary(userId, connection = database) {
        return connection.getOne(`
            SELECT 
                COUNT(*) as total_investments,
                SUM(amount) as total_invested,
                SUM(current_value) as total_current_value,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_investments
            FROM investments
            WHERE user_id = ?
        `, [userId]);
    }

    static async getAdminStatistics(connection = database) {
        return connection.getOne(`
            SELECT 
                COUNT(*) as total_investments,
                SUM(amount) as total_invested,
                SUM(current_value) as total_current_value,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_investments
            FROM investments
        `);
    }

    static async findMatured(connection = database) {
        const query = `
            SELECT 
                i.id, i.user_id, i.amount, i.expected_return,
                p.name as package_name
            FROM investments i
            JOIN investment_packages p ON i.package_id = p.id
            WHERE i.status = 'active' AND i.end_date <= NOW()
        `;
        return connection.query(query);
    }
}

module.exports = Investment;