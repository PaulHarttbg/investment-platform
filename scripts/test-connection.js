const mysql = require('mysql2/promise');

async function testConnection() {
    const config = {
            host: process.env.DB_HOST || 'srv642.hstgr.io',
            user: process.env.DB_USER || 'u738917511_winning_edge',
            password: process.env.DB_PASSWORD || 'Mutpay@54',
            database: process.env.DB_NAME || 'u738917511_winning_edge'
    };

    let connection;
    try {
        console.log('🔍 Attempting to connect to MySQL server...');
        connection = await mysql.createConnection(config);
        console.log('✅ Successfully connected to MySQL server');
        
        // Check if our database exists
        const [dbs] = await connection.query('SHOW DATABASES');
        const dbExists = dbs.some(db => db.Database === 'winning_edge');
        console.log(`📊 Database 'winning_edge' exists:`, dbExists ? '✅ Yes' : '❌ No');
        
        if (dbExists) {
            // Switch to our database
            await connection.query('USE winning_edge');
            console.log('🔍 Checking tables in winning_edge database...');
            
            const [tables] = await connection.query('SHOW TABLES');
            console.log('\n📋 Database tables:');
            console.table(tables);
        }
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('🔑 Authentication failed. Please check your MySQL username and password.');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('🔌 Could not connect to MySQL server. Make sure MySQL is running.');
        } else {
            console.error('Error details:', error);
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Connection closed');
        }
    }
}

testConnection();
