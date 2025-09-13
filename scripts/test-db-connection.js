const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
    const dbConfig = {
        host: process.env.DB_HOST || 'srv642.hstgr.io',
        user: process.env.DB_USER || 'u738917511_winning_edge',
        password: process.env.DB_PASSWORD || 'Mutpay@54',
        database: process.env.DB_NAME || 'u738917511_winning_edge'
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Successfully connected to MySQL database');
        
        // Check if tokens table exists
        const [rows] = await connection.query(
            `SELECT TABLE_NAME 
             FROM INFORMATION_SCHEMA.TABLES 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'registration_tokens'`,
            [dbConfig.database]
        );
        
        if (rows.length > 0) {
            console.log('✅ registration_tokens table exists');
            // Show table structure
            const [columns] = await connection.query('DESCRIBE registration_tokens');
            console.log('\nTable structure:');
            console.table(columns);
        } else {
            console.log('❌ registration_tokens table does not exist');
        }
        
    } catch (error) {
        console.error('❌ Error connecting to the database:', error.message);
        console.error('Connection config:', JSON.stringify(dbConfig, null, 2));
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}

testConnection();
