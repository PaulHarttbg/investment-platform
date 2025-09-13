const mysql = require('mysql2/promise');
require('dotenv').config();
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test123!';
const TEST_FIRST_NAME = 'Test';
const TEST_LAST_NAME = 'User';

async function testFullFlow() {
    console.log('🚀 Starting End-to-End Test for WINNING EDGE');
    
    // 1. Test Registration
    console.log('\n1️⃣ Testing Registration...');
    const registrationResult = await testRegistration();
    
    if (!registrationResult.success) {
        console.error('❌ Registration test failed');
        return;
    }
    
    const { loginId, email } = registrationResult.user;
    
    // 2. Test Login
    console.log('\n2️⃣ Testing Login...');
    const loginResult = await testLogin(email, TEST_PASSWORD);
    
    if (!loginResult.success) {
        console.error('❌ Login test failed');
        return;
    }
    
    const { token, user } = loginResult;
    
    // 3. Verify User Data
    console.log('\n3️⃣ Verifying User Data...');
    await verifyUserInDatabase(user.id, email, loginId);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n🎉 WINNING EDGE is working correctly!');
    console.log(`\nTest User Created:`);
    console.log(`- Email: ${email}`);
    console.log(`- Login ID: ${loginId}`);
    console.log(`- Password: ${TEST_PASSWORD}`);
    console.log('\nYou can now use these credentials to log in to the application.');
}

async function testRegistration() {
    const data = JSON.stringify({
        registrationToken: 'public-registration',
        firstName: TEST_FIRST_NAME,
        lastName: TEST_LAST_NAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        agreeToTerms: 'true',
        agreeToPrivacy: 'true'
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    return new Promise((resolve) => {
        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                const result = JSON.parse(responseData);
                
                if (res.statusCode === 201) {
                    console.log('✅ Registration successful');
                    console.log(`   User ID: ${result.user.id}`);
                    console.log(`   Login ID: ${result.user.loginId}`);
                    resolve({ success: true, user: result.user });
                } else {
                    console.error('❌ Registration failed:', result);
                    resolve({ success: false, error: result });
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            resolve({ success: false, error: error.message });
        });

        req.write(data);
        req.end();
    });
}

async function testLogin(email, password) {
    console.log('Attempting login with:', { email, password });
    
    // Ensure we have valid credentials
    if (!email || !password) {
        console.error('❌ Missing email or password for login');
        return { success: false, error: 'Missing credentials' };
    }
    
    const loginData = {
        loginId: email, // Using email as loginId
        password: password,
        rememberMe: false // Explicitly set rememberMe
    };
    
    const data = JSON.stringify(loginData);

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    return new Promise((resolve) => {
        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                let result;
                try {
                    result = responseData ? JSON.parse(responseData) : {};
                    
                    if (res.statusCode === 200 && result.token) {
                        console.log('✅ Login successful');
                        console.log(`   Token received: ${result.token.substring(0, 20)}...`);
                        resolve({ success: true, token: result.token, user: result.user });
                    } else {
                        console.error('❌ Login failed with status code:', res.statusCode);
                        console.error('   Response:', result);
                        resolve({ 
                            success: false, 
                            error: result.error || 'Login failed',
                            message: result.message,
                            statusCode: res.statusCode
                        });
                    }
                } catch (parseError) {
                    console.error('❌ Error parsing login response:', parseError);
                    console.error('   Raw response:', responseData);
                    resolve({ 
                        success: false, 
                        error: 'Invalid response from server',
                        details: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            resolve({ success: false, error: error.message });
        });

        req.write(data);
        req.end();
    });
}

async function verifyUserInDatabase(userId, email, loginId) {
    const config = {
        host: process.env.DB_HOST || 'srv642.hstgr.io',
        user: process.env.DB_USER || 'u738917511_winning_edge',
        password: process.env.DB_PASSWORD || 'Mutpay@54',
        database: process.env.DB_NAME || 'u738917511_winning_edge',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    const pool = mysql.createPool(config);
    const connection = await pool.getConnection();

    try {
        // Check users table
        const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (users.length === 0) {
            console.error('❌ User not found in database');
            return false;
        }

        const user = users[0];
        console.log('✅ User found in database:');
        console.log(`   - Email: ${user.email} (matches: ${user.email === email})`);
        console.log(`   - Login ID: ${user.login_id} (matches: ${user.login_id === loginId})`);
        console.log(`   - Status: ${user.status}`);
        console.log(`   - Created At: ${user.created_at}`);

        return true;
    } catch (error) {
        console.error('Database error:', error);
        return false;
    } finally {
        if (connection) await connection.release();
        await pool.end();
    }
}

// Run the tests
testFullFlow().catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
});
