const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
    const config = {
        host: process.env.DB_HOST || 'srv642.hstgr.io',
        user: process.env.DB_USER || 'u738917511_winning_edge',
        password: process.env.DB_PASS || 'Mutpay@54',
        database: process.env.DB_NAME || 'u738917511_winning_edge',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    console.log('Testing database connection with config:', {
        ...config,
        password: config.password ? '***' : '(empty)'
    });

    const connection = await mysql.createConnection(config);
    
    try {
        // Test connection
        console.log('Connection established, running test query...');
        const [rows] = await connection.execute('SELECT 1 as test');
        console.log('Test query successful, result:', rows);
        
        // Test registration token query
        console.log('\nTesting registration token query...');
        const [tokens] = await connection.execute(
            'SELECT * FROM registration_tokens WHERE token_value = ?', 
            ['public-registration']
        );
        console.log('Registration token query result:', tokens);
        
        // Test user insertion
        console.log('\nTesting user insertion...');
        const testEmail = `test-${Date.now()}@example.com`;
        const [result] = await connection.execute(
            `INSERT INTO users 
            (id, login_id, email, password_hash, first_name, last_name, account_status, email_verified)
            VALUES (?, ?, ?, ?, ?, ?, 'active', 0)`,
            [
                require('crypto').randomUUID(),
                `TEST-${Date.now()}`,
                testEmail,
                'test-hash',
                'Test',
                'User'
            ]
        );
        console.log('User insertion successful, result:', result);
        
        // Clean up
        await connection.execute('DELETE FROM users WHERE email LIKE ?', ['test-%@example.com']);
        console.log('\nTest completed successfully!');
        
    } catch (error) {
        console.error('Error during test:', error);
        if (error.code) {
            console.error('Error code:', error.code);
            console.error('Error sqlMessage:', error.sqlMessage);
            console.error('Error sql:', error.sql);
        }
    } finally {
        await connection.end();
        console.log('Connection closed');
    }
}

testConnection().catch(console.error);
