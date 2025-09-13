const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class Database {
    constructor() {
        this.connection = null;
    }

    async init() {
        // Prevent re-initialization of the connection pool
        if (this.connection) {
            return this.connection;
        }

        try {
            // First connect without database to create it if not exists
            const dbPassword = process.env.DB_PASSWORD || process.env.DB_PASS;
            if (!dbPassword && process.env.NODE_ENV !== 'test') {
                throw new Error('Database password is not set. Please check DB_PASSWORD in your .env file.');
            }

            const tempConnection = await mysql.createConnection({
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT),
                user: process.env.DB_USER,
                password: dbPassword
            });

            // Create database if not exists
            await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            await tempConnection.end();

            const poolPassword = process.env.DB_PASSWORD || process.env.DB_PASS;

            // Now create a connection pool to the specific database
           this.connection = mysql.createPool({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: poolPassword,
                database: process.env.DB_NAME,
                waitForConnections: true,
                connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
                queueLimit: 0,
                multipleStatements: true
            });
            
            // Drop existing tables if they exist (for development)
            if (process.env.NODE_ENV !== 'production') {
                await this.dropTables();
            }
            
            await this.createTables();
            return this.connection;
        } catch (err) {
            console.error('Error connecting to MySQL database:', err.message);
            throw err;
        }
    }

    async createTables() {
        try {
            const tables = [
                // Users table
                `CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(36) PRIMARY KEY,
                    login_id VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NOT NULL,
                    phone VARCHAR(20),
                    country VARCHAR(100),
                    date_of_birth DATE,
                    account_balance DECIMAL(15,2) DEFAULT 0.00,
                    total_invested DECIMAL(15,2) DEFAULT 0.00,
                    total_profit DECIMAL(15,2) DEFAULT 0.00,
                    account_status VARCHAR(50) DEFAULT 'active',
                    registration_token TEXT,                    
                    email_verified BOOLEAN DEFAULT 0,
                    last_login DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // Admin users table
                `CREATE TABLE IF NOT EXISTS admin_users (
                    id VARCHAR(36) PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    last_login DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // Investment packages table
                `CREATE TABLE IF NOT EXISTS investment_packages (
                    id VARCHAR(36) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    min_amount DECIMAL(15,2) NOT NULL,
                    max_amount DECIMAL(15,2) NOT NULL,
                    return_rate DECIMAL(5,2) NOT NULL,
                    duration_days INTEGER NOT NULL,
                    risk_level ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // User investments table
                `CREATE TABLE IF NOT EXISTS investments (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    package_id VARCHAR(36) NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    expected_return DECIMAL(15,2) NOT NULL,
                    current_value DECIMAL(15,2) NOT NULL,
                    status VARCHAR(50) DEFAULT 'active',
                    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    end_date DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (package_id) REFERENCES investment_packages(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // Transactions table
                `CREATE TABLE IF NOT EXISTS transactions (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    type ENUM('deposit', 'withdrawal', 'investment', 'payout', 'referral', 'refund', 'profit') NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    currency VARCHAR(10) DEFAULT 'USD',
                    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
                    description TEXT,
                    reference_id TEXT,
                    payment_method TEXT,
                    wallet_address TEXT,
                    transaction_hash TEXT,
                    notes TEXT,
                    fees DECIMAL(15,2) DEFAULT 0.00,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // Password reset tokens table
                `CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    used BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // Email verification tokens table
                `CREATE TABLE IF NOT EXISTS email_verification_tokens (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // Registration Tokens table
                `CREATE TABLE IF NOT EXISTS registration_tokens (
                    id VARCHAR(36) PRIMARY KEY,
                    token VARCHAR(50) UNIQUE NOT NULL,
                    created_by VARCHAR(36) NOT NULL,
                    used_by VARCHAR(36) NULL,
                    usage_limit INT DEFAULT 1,
                    usage_count INT DEFAULT 0,
                    expires_at DATETIME NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    last_used_at DATETIME NULL,
                    deactivated_at DATETIME NULL,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE CASCADE,
                    FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // User sessions table
                `CREATE TABLE IF NOT EXISTS user_sessions (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // Error logs table
                `CREATE TABLE IF NOT EXISTS error_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    message TEXT,
                    stack TEXT,
                    url VARCHAR(2048),
                    method VARCHAR(10),
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    user_id VARCHAR(36),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // System settings table
                `CREATE TABLE IF NOT EXISTS system_settings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    setting_key VARCHAR(255) UNIQUE NOT NULL,
                    setting_value TEXT,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

                // Audit logs table
                `CREATE TABLE IF NOT EXISTS audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(36),
                    user_type ENUM('user', 'admin') NOT NULL,
                    entity_type TEXT,
                    entity_id TEXT,
                    action VARCHAR(255) NOT NULL,
                    old_values TEXT,
                    new_values TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
                
                // NOTE: A duplicate and incorrect definition for 'error_logs' was removed from here.
                // The correct definition is located earlier in this file.
            ];

            // Execute all table creation queries
            for (const sql of tables) {
                await this.connection.execute(sql);
            }
            
            await this.createForeignKeys();
            await this.createIndexes();
            await this.insertDefaultData();
            return true;
        } catch (err) {
            console.error('Error creating database tables:', err.message);
            throw err;
        }
    }

    async createForeignKeys() {
        const commands = [
            // Add referred_by column. This will fail safely if it already exists.
            `ALTER TABLE users ADD COLUMN referred_by VARCHAR(36) NULL`,
            // Add self-referencing foreign key for users table
            `ALTER TABLE users ADD CONSTRAINT fk_users_referred_by FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL`
        ];

        try {
            for (const cmd of commands) {
                try {
                    await this.connection.execute(cmd);
                } catch (err) {
                    // Ignore "duplicate column" and "duplicate key" errors, which happen on subsequent runs.
                    if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_FK_DUP_NAME' && err.code !== 'ER_DUP_KEYNAME') {
                        console.warn(`⚠️ Could not apply relation:`, err.message);
                    }
                }
            }
        } catch (err) {
            console.error('Error creating foreign keys:', err.message);
            throw err;
        }
    }

    async dropTables() {
        try {
            await this.connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
        
            const tables = [
                'transactions',
                'investments',
                'user_sessions',
                'password_reset_tokens',
                'email_verification_tokens',
                'registration_tokens',
                'error_logs',
                'audit_logs',
                'system_settings',
                'investment_packages',
                'admin_users',
                'users'
            ];

            for (const table of tables) {
                try {
                    await this.connection.execute(`DROP TABLE IF EXISTS ${table}`);
                } catch (err) {
                    console.warn(`⚠️ Could not drop table ${table}:`, err.message);
                }
            }

            await this.connection.execute('SET FOREIGN_KEY_CHECKS = 1;');
        } catch (err) {
            console.error('Error dropping tables:', err.message);
            throw err;
        }
    }

    async createIndexes() {
        const indexes = [
            'CREATE INDEX idx_users_login_id ON users(login_id)',
            'CREATE INDEX idx_users_referred_by ON users(referred_by)',
            'CREATE INDEX idx_users_email ON users(email)',
            'CREATE INDEX idx_investments_user_id ON investments(user_id)',
            'CREATE INDEX idx_transactions_user_id ON transactions(user_id)',
            'CREATE INDEX idx_transactions_type ON transactions(type)',
            'CREATE INDEX idx_transactions_wallet_address ON transactions(wallet_address(255))',
            'CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token(255))',
            'CREATE INDEX idx_tokens_token ON registration_tokens(token)',
            'CREATE INDEX idx_transactions_status ON transactions(status)',
            'CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)',
            'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)'
        ];

        try {
            for (const index of indexes) {
                try {
                    await this.connection.execute(index);
                } catch (err) {
                    // Ignore "duplicate key" errors, which happen if the index already exists.
                    if (err.code !== 'ER_DUP_KEYNAME') {
                        console.warn(`⚠️ Could not create index:`, err.message);
                    }
                }
            }
        } catch (err) {
            console.error('Error creating indexes:', err.message);
            throw err;
        }
    }

    async insertDefaultData() {
        try {
            // Check if admin user already exists
            const [adminRows] = await this.connection.execute('SELECT * FROM admin_users LIMIT 1');
            
            if (adminRows.length === 0) {
                // Create default admin user
                const adminId = uuidv4();
                const adminPassword = process.env.ADMIN_PASSWORD;
                if (process.env.NODE_ENV === 'production' && (!adminPassword || adminPassword.includes("YourNewSecureAdminPassword"))) {
                    console.error('\nCRITICAL SECURITY RISK: ADMIN_PASSWORD is not set or is using the default placeholder in your .env file.');
                    throw new Error('Admin password is not configured securely for production.');
                }
                const safePassword = adminPassword || 'WinningEdge2025!'; // Fallback for dev only
                const hashedPassword = await bcrypt.hash(safePassword, 12);
                
                await this.connection.execute(
                    'INSERT INTO admin_users (id, username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [adminId, process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_EMAIL || 'admin@winningedge.com', hashedPassword, 'Admin', 'User', 'superadmin']
                );
            }

            // Check if investment packages exist
            const [packageRows] = await this.connection.execute('SELECT * FROM investment_packages LIMIT 1');
            
            if (packageRows.length === 0) {
                // Insert default investment packages
                const packages = [
                    { // NOTE: The return rates here are very high (e.g., 15.5% in 30 days). Review if this is intended.
                        id: uuidv4(),
                        name: 'Starter Package',
                        description: 'Perfect for beginners',
                        min_amount: 100,
                        max_amount: 999,
                        return_rate: 15.5,
                        duration_days: 30,
                        risk_level: 'low'
                    },
                    {
                        id: uuidv4(),
                        name: 'Premium Package',
                        description: 'For experienced investors',
                        min_amount: 1000,
                        max_amount: 9999,
                        return_rate: 25.75,
                        duration_days: 60,
                        risk_level: 'medium'
                    },
                    {
                        id: uuidv4(),
                        name: 'VIP Package',
                        description: 'Maximum returns for VIP members',
                        min_amount: 10000,
                        max_amount: 100000,
                        return_rate: 40.0,
                        duration_days: 90,
                        risk_level: 'high'
                    }
                ];

                for (const pkg of packages) {
                    await this.connection.execute(
                        'INSERT INTO investment_packages (id, name, description, min_amount, max_amount, return_rate, duration_days, risk_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [pkg.id, pkg.name, pkg.description, pkg.min_amount, pkg.max_amount, pkg.return_rate, pkg.duration_days, pkg.risk_level]
                    );
                }
            }

            // Insert default system settings if they don't exist
            const defaultSettings = [
                { key: 'site_name', value: 'Winning Edge', description: 'The name of the website' },
                { key: 'site_email', value: 'support@winningedge.com', description: 'Default email address for system notifications' },
                { key: 'referral_bonus_percentage', value: '5', description: 'Referral bonus percentage (e.g., 5 for 5%)' },
                { key: 'min_withdrawal_amount', value: '50', description: 'Minimum withdrawal amount in USD' },
                { key: 'withdrawal_fee_percentage', value: '0.5', description: 'Withdrawal fee percentage (e.g., 0.5 for 0.5%)' },
                { key: 'min_investment_amount', value: '100', description: 'Minimum deposit/investment amount in USD' },
                { key: 'maintenance_mode', value: '0', description: 'Enable maintenance mode (1 for yes, 0 for no)' },
                { key: 'min_crypto_confirmations', value: '3', description: 'Minimum confirmations for crypto deposits' },
                { key: 'crypto_webhook_secret', value: 'default-secret-change-me', description: 'Secret for verifying crypto webhooks' },
                { key: 'bank_transfer_details', value: '{"accountName":"WINNING EDGE INVESTMENTS","accountNumber":"1234567890","bankName":"Global Trust Bank","swiftCode":"GTBIUS33"}', description: 'Bank transfer details as a JSON object' }
            ];

            for (const setting of defaultSettings) {
                await this.connection.execute(
                    'INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
                    [setting.key, setting.value, setting.description]
                );
            }
            
        } catch (err) {
            console.error('Error inserting default data:', err.message);
            throw err;
        }
    }

    // Basic query methods
    async query(sql, params = []) {
        try {
            const [rows] = await this.connection.execute(sql, params);
            return rows;
        } catch (err) {
            console.error('Database query error:', err.message);
            throw err;
        }
    }

    async getOne(sql, params = []) {
        const rows = await this.query(sql, params);
        return rows[0] || null;
    }

    async insert(table, data) {
        const columns = Object.keys(data).join(', ');
        const values = Object.values(data);
        const placeholders = values.map(() => '?').join(', ');
        
        const [result] = await this.connection.execute(
            `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
            values
        );
        
        return result.insertId;
    }

    async update(table, id, data) {
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), id];
        
        const [result] = await this.connection.execute(
            `UPDATE ${table} SET ${setClause} WHERE id = ?`,
            values
        );
        
        return result.affectedRows > 0;
    }

    async delete(table, id) {
        const [result] = await this.connection.execute(
            `DELETE FROM ${table} WHERE id = ?`,
            [id]
        );
        
        return result.affectedRows > 0;
    }
}

// Create and export a singleton instance
const database = new Database();
module.exports = database;