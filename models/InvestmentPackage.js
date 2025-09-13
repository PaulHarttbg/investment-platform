const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');

class InvestmentPackage {
    static async findById(id, connection = database) {
        return connection.getOne('SELECT * FROM investment_packages WHERE id = ? AND is_active = 1', [id]);
    }

    static async findAllActive(connection = database) {
        return connection.query('SELECT id, name, description, min_amount, max_amount, return_rate, duration_days, risk_level FROM investment_packages WHERE is_active = 1 ORDER BY min_amount ASC');
    }

    static async getStatistics(packageId, connection = database) {
        return connection.getOne(`
            SELECT 
                COUNT(*) as total_investments,
                SUM(amount) as total_invested,
                AVG(amount) as average_investment
            FROM investments
            WHERE package_id = ?
        `, [packageId]);
    }

    static async findAllForAdmin(connection = database) {
        return connection.query(`
            SELECT 
                p.*,
                COUNT(i.id) as total_investments,
                SUM(i.amount) as total_invested
            FROM investment_packages p
            LEFT JOIN investments i ON p.id = i.package_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);
    }

    static async create(pkgData, connection = database) {
        const { name, description, minAmount, maxAmount, returnRate, durationDays, riskLevel } = pkgData;
        const packageId = uuidv4();
        const query = `
            INSERT INTO investment_packages (id, name, description, min_amount, max_amount, return_rate, duration_days, risk_level) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.query(query, [packageId, name, description, minAmount, maxAmount, returnRate, durationDays, riskLevel]);
        return { id: packageId, ...pkgData };
    }
}

module.exports = InvestmentPackage;