const mysql = require('mysql2/promise');

async function checkMigrations() {
    const dbConfig = {
        host: process.env.DB_HOST || 'srv642.hstgr.io',
        user: process.env.DB_USER || 'u738917511_winning_edge',
        password: process.env.DB_PASSWORD || 'Mutpay@54',
        database: process.env.DB_NAME || 'u738917511_winning_edge'
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL database');

        // Check if migrations table exists
        const [tables] = await connection.query(
            "SHOW TABLES LIKE 'migrations'"
        );
        
        if (tables.length === 0) {
            console.log('❌ Migrations table does not exist');
            // Create migrations table
            await connection.query(`
                CREATE TABLE migrations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Created migrations table');
        } else {
            console.log('✅ Migrations table exists');
        }

        // List all migrations
        const [migrations] = await connection.query('SELECT * FROM migrations');
        console.log('\nApplied migrations:');
        console.table(migrations);

        // List all tables in the database
        const [allTables] = await connection.query('SHOW TABLES');
        console.log('\nDatabase tables:');
        console.table(allTables);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Authentication failed. Please check your database credentials.');
            console.error('Connection config:', JSON.stringify(dbConfig, null, 2));
        }
    } finally {
        if (connection) await connection.end();
    }
}

checkMigrations();
