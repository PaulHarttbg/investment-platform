const request = require('supertest');
const app = require('./server'); // Import your express app
const database = require('./database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

describe('Authentication API', () => {
    let adminId;

    // Establish database connection before all tests
    beforeAll(async () => {
        // The init function will drop and recreate tables because NODE_ENV is 'test'
        await database.init();
    });

    // Clean up tables and seed necessary data before each test
    beforeEach(async () => {
        // Clear all relevant tables to ensure a clean state for each test
        await database.connection.execute('DELETE FROM users');
        await database.connection.execute('DELETE FROM registration_tokens');
        await database.connection.execute('DELETE FROM admin_users');

        // Create a default admin user required for token creation
        adminId = uuidv4();
        await database.connection.execute(
            'INSERT INTO admin_users (id, username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [adminId, 'testadmin', 'testadmin@winningedge.com', 'test_hash', 'Admin', 'Test', 'superadmin']
        );

        // Create a valid registration token for tests
        await database.connection.execute(
            'INSERT INTO registration_tokens (id, token, created_by, usage_limit, is_active) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), 'VALID-TOKEN', adminId, 10, true] // Use a higher limit for multiple tests
        );
    });

    // Close the database connection after all tests
    afterAll(async () => {
        // The global teardown script now handles closing the connection.
    });

    // --- Test Suite for User Registration ---
    describe('POST /api/auth/register', () => {

        const validUserData = {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            password: 'Password123!',
            registrationToken: 'VALID-TOKEN'
        };

        it('should register a new user with a valid token and data', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(validUserData);

            // Assertions
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('message', 'Registration successful');
            expect(res.body.user).toHaveProperty('email', 'test@example.com');
            expect(res.body.user).not.toHaveProperty('password_hash'); // Ensure password is not returned

            // Check if the cookie is set
            expect(res.headers['set-cookie']).toBeDefined();
            expect(res.headers['set-cookie'][0]).toContain('token=');
            expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
        });

        it('should fail to register with an invalid token', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ ...validUserData, registrationToken: 'INVALID-TOKEN' });

            // Assertions
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error', 'Invalid or expired registration token');
        });

        it('should fail to register if email already exists', async () => {
            // First, register a user
            await request(app)
                .post('/api/auth/register')
                .send(validUserData);

            // Then, try to register with the same email again
            const res = await request(app)
                .post('/api/auth/register')
                .send(validUserData);

            // Assertions
            expect(res.statusCode).toEqual(409);
            expect(res.body).toHaveProperty('error', 'An account with this email already exists');
        });

        it('should fail to register with a weak password', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ ...validUserData, password: 'weak' });

            // Assertions
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error', 'Validation failed');
            expect(res.body.details).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('Password must be at least 8 characters long')
                ])
            );
        });

        it('should fail to register without a first name', async () => {
            const { firstName, ...userDataWithoutFirstName } = validUserData;

            const res = await request(app)
                .post('/api/auth/register')
                .send(userDataWithoutFirstName);

            // Assertions
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error', 'Validation failed');
            expect(res.body.details).toContain('First name is required');
        });

        it('should use the registration token', async () => {
            // Create a fresh token just for this test
            const testToken = 'TEST-TOKEN-' + Date.now();
            await database.connection.execute(
                'INSERT INTO registration_tokens (id, token, created_by, usage_limit, is_active, usage_count) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), testToken, adminId, 10, true, 0]
            );

            // Check token before use
            let [tokensBefore] = await database.connection.execute(
                'SELECT usage_count, is_active FROM registration_tokens WHERE token = ?', 
                [testToken]
            );
            
            expect(tokensBefore[0].usage_count).toBe(0);
            expect(tokensBefore[0].is_active).toBe(1);

            // Register user with the test token
            await request(app)
                .post('/api/auth/register')
                .send({
                    ...validUserData,
                    registrationToken: testToken
                });

            // Check token after use
            let [tokensAfter] = await database.connection.execute(
                'SELECT usage_count, is_active FROM registration_tokens WHERE token = ?', 
                [testToken]
            );
            
            expect(tokensAfter[0].usage_count).toBe(1);
            // Since usage_limit is 10, it should still be active
            expect(tokensAfter[0].is_active).toBe(1);
        });
    });

    // --- Test Suite for User Login ---
    describe('POST /api/auth/login', () => {
        const loginCredentials = {
            loginId: 'logintest@example.com',
            password: 'Password123!'
        };

        // Create a user to test login against
        beforeEach(async () => {
            const hashedPassword = await bcrypt.hash(loginCredentials.password, 12);
            await database.connection.execute(
                `INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, registration_token) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    uuidv4(),
                    'WE-LOGIN-TEST',
                    loginCredentials.loginId,
                    hashedPassword,
                    'Login',
                    'Test',
                    'VALID-TOKEN'
                ]
            );
        });

        it('should log in a user with correct email and password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send(loginCredentials);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('message', 'Login successful.');
            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toHaveProperty('email', loginCredentials.loginId);
            expect(res.headers['set-cookie'][0]).toContain('token=');
            expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
        });

        it('should log in a user with correct loginId and password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    loginId: 'WE-LOGIN-TEST',
                    password: loginCredentials.password
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('message', 'Login successful.');
        });

        it('should fail to log in with incorrect password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ ...loginCredentials, password: 'WrongPassword!' });

            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error', 'Invalid credentials.');
        });

        it('should fail to log in with non-existent user', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ ...loginCredentials, loginId: 'nouser@example.com' });

            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error', 'Invalid credentials.');
        });

        it('should fail to log in without a password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ loginId: loginCredentials.loginId });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error', 'Login ID and password required.');
        });
    });
});