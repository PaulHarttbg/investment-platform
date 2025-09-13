const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDbLogin() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'srv642.hstgr.io',
        user: process.env.DB_USER || 'u738917511_winning_edge',
        password: process.env.DB_PASS || 'Mutpay@54',
        database: process.env.DB_NAME || 'u738917511_winning_edge'
    });

    try {
        console.log('✅ Successfully connected to the database');
        
        // Get the most recently created test user
        const [users] = await connection.execute(
            'SELECT * FROM users ORDER BY created_at DESC LIMIT 1'
        );
        
        if (users.length === 0) {
            console.log('❌ No users found in the database');
            return;
        }
        
        const testUser = users[0];
        console.log('🔍 Found test user:', {
            id: testUser.id,
            email: testUser.email,
            login_id: testUser.login_id,
            account_status: testUser.account_status
        });
        
        // Test login query
        console.log('\n🔍 Testing login query...');
        const [loginResults] = await connection.execute(
            'SELECT * FROM users WHERE email = ? OR login_id = ?',
            [testUser.email, testUser.email]  // Try with email
        );
        
        console.log('✅ Login query successful with email');
        console.log('   Found users:', loginResults.length);
        
        // Test with login_id
        const [loginIdResults] = await connection.execute(
            'SELECT * FROM users WHERE email = ? OR login_id = ?',
            [testUser.login_id, testUser.login_id]  // Try with login_id
        );
        
        console.log('✅ Login query successful with login_id');
        console.log('   Found users:', loginIdResults.length);
        
    } catch (error) {
        console.error('❌ Database error:', {
            message: error.message,
            code: error.code,
            sql: error.sql,
            sqlMessage: error.sqlMessage,
            sqlState: error.sqlState
        });
    } finally {
        await connection.end();
        console.log('\n🔌 Database connection closed');
    }
}

testDbLogin().catch(console.error);
