const mysql = require('mysql2/promise');
require('dotenv').config();

async function testRegistration() {
    // Test database connection
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'srv642.hstgr.io',
        user: process.env.DB_USER || 'u738917511_winning_edge',
        password: process.env.DB_PASSWORD || 'Mutpay@54',
        database: process.env.DB_NAME || 'u738917511_winning_edge',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    let connection;
    try {
        console.log('Testing database connection...');
        connection = await pool.getConnection();
        console.log('Successfully connected to the database');

        // Check if registration_tokens table exists and has data
        console.log('Checking registration_tokens table...');
        const [tokens] = await connection.query('SELECT * FROM registration_tokens WHERE status = \'active\' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1');
        
        if (tokens.length === 0) {
            console.log('No active registration tokens found. Creating a test token...');
            const tokenId = require('crypto').randomUUID();
            await connection.query(`
                INSERT INTO registration_tokens 
                (id, token_value, max_uses, used_count, status, created_at, expires_at)
                VALUES (?, 'test-token-123', 100, 0, 'active', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
            `, [tokenId]);
            console.log('Test token created successfully');
            
            // Get the newly created token
            const [newTokens] = await connection.query('SELECT * FROM registration_tokens WHERE id = ?', [tokenId]);
            tokens.push(...newTokens);
        }
        
        console.log('Active registration tokens found:', tokens.length);
        const registrationToken = tokens[0].token_value;
        console.log('Using registration token:', registrationToken);

        // Test registration endpoint
        console.log('\nTesting registration endpoint...');
        const http = require('http');
        const data = JSON.stringify({
            registrationToken: registrationToken,
            firstName: 'Test',
            lastName: 'User',
            email: `test-${Date.now()}@example.com`,
            password: 'Test123!',
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

        const req = http.request(options, (res) => {
            console.log(`\nRegistration Response Status: ${res.statusCode}`);
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    console.log('Response:', JSON.stringify(parsed, null, 2));
                } catch (e) {
                    console.log('Response:', responseData);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
        });

        req.write(data);
        req.end();

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
            console.error('SQL State:', error.sqlState);
            console.error('SQL Message:', error.sqlMessage);
        }
    } finally {
        if (connection) {
            await connection.release();
            console.log('\nDatabase connection released');
        }
        await pool.end();
        console.log('Connection pool closed');
    }
}

testRegistration().catch(console.error);
