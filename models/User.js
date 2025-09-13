const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');

class User {
    static async findById(id, connection = database) {
        return connection.getOne('SELECT * FROM users WHERE id = ?', [id]);
    }

    static async findByEmail(email, connection = database) {
        return connection.getOne('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    }

    static async findByLoginId(loginId, connection = database) {
        return connection.getOne('SELECT * FROM users WHERE login_id = ?', [loginId]);
    }

    static async findByLoginIdOrEmail(loginId, connection = database) {
        return connection.getOne('SELECT * FROM users WHERE email = ? OR login_id = ?', [loginId, loginId]);
    }

    static async create(userData, connection) {
        const { id, login_id, email, password_hash, first_name, last_name, registration_token, referred_by } = userData;
        const query = `
            INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, registration_token, referred_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(query, [id, login_id, email, password_hash, first_name, last_name, registration_token, referred_by]);
        return { id, ...userData };
    }

    static async update(userId, updateData, connection = database) {
        const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        const params = [...Object.values(updateData), userId];
        const query = `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return connection.query(query, params);
    }

    static async updatePassword(userId, newPasswordHash, connection = database) {
        return connection.query('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newPasswordHash, userId]);
    }

    static async getDashboardSummary(userId, connection = database) {
        return connection.getOne(`
            SELECT account_balance, total_invested, total_profit
            FROM users WHERE id = ?`,
            [userId]
        );
    }

    static async findAll(options = {}, connection = database) {
        const { page = 1, limit = 15, search = '', status = '' } = options;
        const offset = (page - 1) * limit;

        let baseQuery = `FROM users WHERE 1=1`;
        const queryParams = [];
        
        if (search) {
            baseQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR login_id LIKE ?)`;
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (status) {
            baseQuery += ' AND account_status = ?';
            queryParams.push(status);
        }
        
        const [totalRows] = await connection.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
        const total = totalRows[0].total;

        const users = await connection.query(`
            SELECT id, login_id, email, first_name, last_name, account_balance, total_invested, account_status, created_at
            ${baseQuery}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        return { users, total, page, totalPages: Math.ceil(total / limit) };
    }

    static async getStatistics(connection = database) {
        return connection.getOne(`
            SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN account_status = 'active' THEN 1 END) as active_users,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_30d
            FROM users
        `);
    }
}

module.exports = User;