const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigrations() {
    // Database connection configuration
    const dbConfig = {
        host: process.env.DB_HOST || 'srv642.hstgr.io',
        user: process.env.DB_USER || 'u738917511_winning_edge',
        password: process.env.DB_PASSWORD || 'Mutpay@54',
        database: process.env.DB_NAME || 'u738917511_winning_edge',
        multipleStatements: true
    };

    let connection;
    try {
        // Create a connection to the database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL database');

        // Check if migrations table exists, create if not
        await connection.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Get list of already executed migrations
        const [executedMigrations] = await connection.query('SELECT name FROM migrations');
        const executedMigrationNames = new Set(executedMigrations.map(m => m.name));

        // Read and sort migration files
        const migrationsDir = path.join(__dirname, '../database/migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        let hasNewMigrations = false;

        // Process each migration file
        for (const file of migrationFiles) {
            if (!executedMigrationNames.has(file)) {
                console.log(`🔨 Running migration: ${file}...`);
                const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                
                // Wrap in a transaction
                await connection.beginTransaction();
                try {
                    await connection.query(migrationSQL);
                    await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);
                    await connection.commit();
                    console.log(`✅ Migration ${file} applied successfully`);
                    hasNewMigrations = true;
                } catch (error) {
                    await connection.rollback();
                    console.error(`❌ Error executing migration ${file}:`, error.message);
                    throw error;
                }
            } else {
                console.log(`⏩ Migration ${file} already applied, skipping`);
            }
        }

        if (!hasNewMigrations) {
            console.log('\n✅ Database is up to date, no new migrations to run');
        }

        console.log('\n🎉 All migrations completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

runMigrations();
