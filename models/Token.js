const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');

class Token {
    static async create({ token, usageLimit = 1, expiresAt = null, createdBy = null, notes = '' }) {
        try {
            const id = uuidv4();
            const insertQuery = `
                INSERT INTO registration_tokens 
                (id, token, usage_limit, expires_at, created_by, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const values = [id, token, usageLimit, expiresAt, createdBy, notes];
            await database.query(insertQuery, values);

            const [rows] = await database.query('SELECT * FROM registration_tokens WHERE id = ?', [id]);
            return rows[0];
        } catch (error) {
            console.error('Error creating token:', error);
            throw error;
        }
    }

    static async findByToken(token) {
        const query = 'SELECT * FROM registration_tokens WHERE token = ?';
        const rows = await database.query(query, [token]);
        return rows[0] || null;
    }

    static async findAll(activeOnly = true) {
        let query = 'SELECT * FROM registration_tokens';
        
        if (activeOnly) {
            query += ' WHERE is_active = true';
        }
        
        query += ' ORDER BY created_at DESC';
        
        const rows = await database.query(query);
        return rows;
    }

    static async incrementUsage(token) {
        await database.query('UPDATE registration_tokens SET usage_count = usage_count + 1 WHERE token = ?', [token]);
        const [rows] = await database.query('SELECT * FROM registration_tokens WHERE token = ?', [token]);
        return rows[0];
    }

    static async deactivate(token) {
        await database.query('UPDATE registration_tokens SET is_active = false WHERE token = ?', [token]);
        const [rows] = await database.query('SELECT * FROM registration_tokens WHERE token = ?', [token]);
        return rows[0];
    }
}

module.exports = Token;
