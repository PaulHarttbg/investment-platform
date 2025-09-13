const mysql = require('mysql2/promise');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function testRegistrationFlow() {
    const config = {
        host: process.env.DB_HOST || 'srv642.hstgr.io',
        user: process.env.DB_USER || 'u738917511_winning_edge',
        password: process.env.DB_PASSWORD || 'Mutpay@54',
        database: process.env.DB_NAME || 'u738917511_winning_edge',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    console.log('Testing registration flow with config:', {
        ...config,
        password: config.password ? '***' : '(empty)'
    });

    const connection = await mysql.createConnection(config);
    
    try {
        // Start transaction
        await connection.beginTransaction();
        console.log('\n=== Starting registration flow test ===');
        
        // 1. Check registration token
        console.log('\n1. Checking registration token...');
        const [tokens] = await connection.execute(
            `SELECT * FROM registration_tokens 
             WHERE token_value = 'public-registration'
             AND (max_uses = 0 OR used_count < max_uses) 
             AND status = 'active' 
             AND (expires_at IS NULL OR expires_at > NOW())
             FOR UPDATE`
        );
        
        if (tokens.length === 0) {
            throw new Error('No valid registration token found');
        }
        console.log('✓ Valid registration token found:', tokens[0].token_value);
        
        // 2. Check if user exists
        const testEmail = `test-${Date.now()}@example.com`;
        console.log('\n2. Checking if user exists...');
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE email = ?',
            [testEmail]
        );
        
        if (existingUsers.length > 0) {
            console.log('ℹ️ Test user already exists, skipping creation');
        } else {
            // 3. Create test user
            console.log('\n3. Creating test user...');
            const userId = uuidv4();
            const loginId = `WE${Date.now()}`;
            const passwordHash = await bcrypt.hash('test123', 12);
            
            const [result] = await connection.execute(
                `INSERT INTO users (
                    id, login_id, email, password_hash, 
                    first_name, last_name, 
                    account_status, email_verified,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'active', 0, NOW(), NOW())`,
                [userId, loginId, testEmail, passwordHash, 'Test', 'User']
            );
            
            if (result.affectedRows === 1) {
                console.log('✓ Test user created successfully');
                
                // 4. Update token usage
                console.log('\n4. Updating token usage...');
                const [updateResult] = await connection.execute(
                    `UPDATE registration_tokens
                     SET used_count = used_count + 1,
                         used_by_user_id = ?,
                         is_used = 1,
                         status = CASE 
                             WHEN max_uses > 0 AND (used_count + 1) >= max_uses THEN 'used'
                             ELSE 'active'
                         END,
                         updated_at = NOW()
                     WHERE token_value = 'public-registration'`,
                    [userId]
                );
                console.log('✓ Token usage updated');
            }
        }
        
        // Commit transaction
        await connection.commit();
        console.log('\n✓ Transaction committed successfully');
        
    } catch (error) {
        await connection.rollback();
        console.error('\n❌ Error during registration flow test:');
        console.error('Error:', error.message);
        if (error.code) console.error('Code:', error.code);
        if (error.sql) console.error('SQL:', error.sql);
        if (error.sqlMessage) console.error('SQL Message:', error.sqlMessage);
        if (error.sqlState) console.error('SQL State:', error.sqlState);
        
        throw error;
    } finally {
        await connection.end();
    }
}

testRegistrationFlow()
    .then(() => console.log('\n✅ Registration flow test completed successfully!'))
    .catch(() => console.log('\n❌ Registration flow test failed'));
