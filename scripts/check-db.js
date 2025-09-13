const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
    const dbConfig = {
        host: process.env.DB_HOST || 'srv642.hstgr.io',
        user: process.env.DB_USER || 'u738917511_winning_edge',
        password: process.env.DB_PASSWORD || 'Mutpay@54',
        database: process.env.DB_NAME || 'u738917511_winning_edge',
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL database');

        // Check if users table exists
        const [tables] = await connection.query("SHOW TABLES LIKE 'users'");
        if (tables.length === 0) {
            console.log('❌ Users table does not exist');
            return;
        }

        // Get users table structure
        const [columns] = await connection.query('DESCRIBE users');
        console.log('\n📋 Users table columns:');
        console.table(columns);

        // Check if we have any users
        const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
        console.log(`\n👥 Total users: ${users[0].count}`);

    } catch (error) {
        console.error('❌ Database error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

checkDatabase();
