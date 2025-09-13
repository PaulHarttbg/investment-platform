const request = require('supertest');
const app = require('../server');
const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

describe('Investments API', () => {
    let testUser;
    let authToken;
    let starterPackage;

    beforeAll(async () => {
        await database.init();
    });

    beforeEach(async () => {
        // Clean tables
        await database.connection.execute('DELETE FROM investments');
        await database.connection.execute('DELETE FROM transactions');
        await database.connection.execute('DELETE FROM users');
        await database.connection.execute('DELETE FROM investment_packages');
        await database.connection.execute('DELETE FROM admin_users');

        // 1. Create an admin user
        const adminId = uuidv4();
        await database.connection.execute(
            'INSERT INTO admin_users (id, username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [adminId, 'testadmin', 'testadmin@example.com', 'hash', 'Admin', 'Test', 'superadmin']
        );

        // 2. Create an investment package
        starterPackage = {
            id: uuidv4(),
            name: 'Test Starter',
            min_amount: 100,
            max_amount: 1000,
            return_rate: 10,
            duration_days: 30,
            risk_level: 'low'
        };
        await database.connection.execute(
            'INSERT INTO investment_packages (id, name, description, min_amount, max_amount, return_rate, duration_days, risk_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [starterPackage.id, starterPackage.name, 'Desc', starterPackage.min_amount, starterPackage.max_amount, starterPackage.return_rate, starterPackage.duration_days, starterPackage.risk_level]
        );

        // 3. Create a user with sufficient balance
        const userPassword = 'Password123!';
        const hashedPassword = await bcrypt.hash(userPassword, 12);
        testUser = {
            id: uuidv4(),
            login_id: 'WE-INVEST-TEST',
            email: 'investor@example.com',
            password: userPassword,
            account_balance: 2000.00
        };
        await database.connection.execute(
            `INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, account_balance, total_invested) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [testUser.id, testUser.login_id, testUser.email, hashedPassword, 'Investor', 'Test', testUser.account_balance, 0.00]
        );

        // 4. Log in the user to get a token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ loginId: testUser.email, password: testUser.password });
        authToken = res.body.token;
    });

    afterAll(async () => {
        if (database.connection) {
            await database.connection.end();
        }
    });

    describe('POST /api/investments', () => {
        it('should create a new investment for an authenticated user with sufficient balance', async () => {
            const investmentData = {
                packageId: starterPackage.id,
                amount: 500
            };

            const res = await request(app)
                .post('/api/investments')
                .set('Authorization', `Bearer ${authToken}`)
                .send(investmentData);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('message', 'Investment created successfully');
            expect(res.body.investment).toHaveProperty('packageName', starterPackage.name);
            expect(res.body.investment).toHaveProperty('amount', investmentData.amount);
            expect(res.body.investment).toHaveProperty('status', 'active');

            // Verify database changes
            const userRows = await database.query('SELECT account_balance, total_invested FROM users WHERE id = ?', [testUser.id]);
            // Convert string values to numbers for comparison
            const accountBalance = parseFloat(userRows[0].account_balance);
            const totalInvested = parseFloat(userRows[0].total_invested);
            
            expect(accountBalance).toBe(testUser.account_balance - investmentData.amount);
            expect(totalInvested).toBe(investmentData.amount);

            const investmentRows = await database.query('SELECT * FROM investments WHERE user_id = ?', [testUser.id]);
            expect(investmentRows.length).toBe(1);
            // Convert string amount to number for comparison
            const investmentAmount = parseFloat(investmentRows[0].amount);
            expect(investmentAmount).toBe(investmentData.amount);

            const transactionRows = await database.query('SELECT * FROM transactions WHERE user_id = ? AND type = ?', [testUser.id, 'investment']);
            expect(transactionRows.length).toBe(1);
            // Convert string amount to number for comparison
            const transactionAmount = parseFloat(transactionRows[0].amount);
            expect(transactionAmount).toBe(investmentData.amount);
        });

        it('should fail if user has insufficient balance', async () => {
            const investmentData = {
                packageId: starterPackage.id,
                amount: 3000 // More than user's balance
            };

            const res = await request(app)
                .post('/api/investments')
                .set('Authorization', `Bearer ${authToken}`)
                .send(investmentData);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error', 'Insufficient balance');
        });

        it('should fail if amount is below package minimum', async () => {
            const investmentData = {
                packageId: starterPackage.id,
                amount: 50 // Below min of 100
            };

            const res = await request(app)
                .post('/api/investments')
                .set('Authorization', `Bearer ${authToken}`)
                .send(investmentData);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error', 'Invalid investment amount');
        });

        it('should fail if amount is above package maximum', async () => {
            const investmentData = {
                packageId: starterPackage.id,
                amount: 1500 // Above max of 1000
            };

            const res = await request(app)
                .post('/api/investments')
                .set('Authorization', `Bearer ${authToken}`)
                .send(investmentData);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error', 'Invalid investment amount');
        });

        it('should fail if not authenticated', async () => {
            const investmentData = {
                packageId: starterPackage.id,
                amount: 500
            };

            const res = await request(app)
                .post('/api/investments')
                .send(investmentData);

            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error', 'Authentication required. No token provided.');
        });
    });

    describe('GET /api/investments', () => {
        beforeEach(async () => {
            // Create some investments for the testUser
            await database.connection.execute(
                `INSERT INTO investments (id, user_id, package_id, amount, expected_return, current_value, status, end_date) VALUES 
                (?, ?, ?, 150, 15, 155, 'active', DATE_ADD(NOW(), INTERVAL 30 DAY)),
                (?, ?, ?, 250, 25, 260, 'active', DATE_ADD(NOW(), INTERVAL 30 DAY)),
                (?, ?, ?, 350, 35, 385, 'completed', DATE_SUB(NOW(), INTERVAL 1 DAY))`,
                [uuidv4(), testUser.id, starterPackage.id, uuidv4(), testUser.id, starterPackage.id, uuidv4(), testUser.id, starterPackage.id]
            );
        });

        it('should retrieve investments for the authenticated user', async () => {
            const res = await request(app)
                .get('/api/investments')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('investments');
            expect(res.body).toHaveProperty('summary');
            expect(res.body).toHaveProperty('pagination');

            // User has 3 investments in total
            expect(res.body.investments.length).toBe(3);
            expect(res.body.pagination.total).toBe(3);
        });

        it('should filter investments by status', async () => {
            const res = await request(app)
                .get('/api/investments?status=active')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.investments.length).toBe(2);
            res.body.investments.forEach(inv => {
                expect(inv.status).toBe('active');
            });
        });

        it('should handle pagination correctly', async () => {
            const res = await request(app)
                .get('/api/investments?page=1&limit=2')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.investments.length).toBe(2);
            expect(res.body.pagination.page).toBe(1);
            expect(res.body.pagination.totalPages).toBe(2);
        });

        it('should return an empty array if user has no investments', async () => {
            // Delete the investments created for testUser
            await database.connection.execute('DELETE FROM investments WHERE user_id = ?', [testUser.id]);

            const res = await request(app)
                .get('/api/investments')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.investments).toEqual([]);
            expect(res.body.pagination.total).toBe(0);
        });
    });
});