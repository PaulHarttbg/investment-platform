const http = require('http');

// This should be the email or login_id from your registration test
const TEST_EMAIL = 'test-1757001364498@example.com';
const TEST_PASSWORD = 'Test123!';

async function testLogin() {
    const postData = JSON.stringify({
        loginId: TEST_EMAIL,  // Using email as loginId
        password: TEST_PASSWORD,
        rememberMe: false
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    console.log('Sending login request with data:', postData);

    return new Promise((resolve) => {
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`Status Code: ${res.statusCode}`);
                console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
                
                try {
                    const response = data ? JSON.parse(data) : {};
                    console.log('Response Body:', JSON.stringify(response, null, 2));
                    resolve({ statusCode: res.statusCode, body: response });
                } catch (e) {
                    console.error('Error parsing response:', e);
                    console.log('Raw response:', data);
                    resolve({ statusCode: res.statusCode, error: e, raw: data });
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            resolve({ error: error.message });
        });

        // Write data to request body
        req.write(postData);
        req.end();
    });
}

// Run the test
testLogin().then(result => {
    console.log('\nTest completed');
    if (result.statusCode === 200) {
        console.log('✅ Login successful!');
    } else {
        console.log('❌ Login failed');
    }
}).catch(console.error);
