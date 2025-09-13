const request = require('supertest');
const app = require('../server');
const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Admin Transaction Management', () => {
    let adminToken;
    let adminId;
    let userId;
    let depositId;
    let userToken;

    // Test data
    const adminUser = {
        email: 'admintest@winningedge.com',
        password: 'Admin@123',
        firstName: 'Admin',
        lastName: 'User'
    };

    const testUser = {
        firstName: 'Test',
        lastName: 'User',
        email: 'testuser@example.com',
        password: 'Test@123',
        phone: '+1234567890',
        country: 'US',
        state: 'California',
        city: 'San Francisco',
        address: '123 Test St',
        postalCode: '94105',
        dateOfBirth: '1990-01-01',
        ssn: '123-45-6789',
        idType: 'passport',
        idNumber: 'A12345678',
        idExpiry: '2030-01-01',
        idFront: 'id_front.jpg',
        idBack: 'id_back.jpg',
        selfie: 'selfie.jpg',
        kycStatus: 'verified'
    };

    // Setup test environment
    beforeAll(async () => {
        // Initialize database schema once for all tests in this suite
        await database.init();
    });

    beforeEach(async () => {
        // Clean up tables before each test to ensure isolation
        await database.connection.execute('DELETE FROM audit_logs');
        await database.connection.execute('DELETE FROM transactions');
        await database.connection.execute('DELETE FROM users');
        await database.connection.execute('DELETE FROM admin_users');

        // Create a unique admin user for this test run
        adminId = uuidv4();
        const hashedPassword = await bcrypt.hash(adminUser.password, 10);
        await database.connection.execute(
            'INSERT INTO admin_users (id, username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [adminId, `testadmin_${Date.now()}`, adminUser.email, hashedPassword, adminUser.firstName, adminUser.lastName, 'superadmin']
        );

        // Create a test user
        userId = uuidv4();
        const userPasswordHash = await bcrypt.hash(testUser.password, 10);
        await database.connection.execute(
            `INSERT INTO users (
                id, login_id, email, password_hash, first_name, last_name, account_balance, kyc_status, account_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, `WE-${uuidv4().slice(0, 8)}`, testUser.email, userPasswordHash, testUser.firstName, testUser.lastName,
                10000.00, 'verified', 'active'
            ]
        );

        // Generate tokens for this test
        adminToken = jwt.sign(
            { id: adminId, email: adminUser.email, role: 'superadmin' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        userToken = jwt.sign(
            { id: userId, email: testUser.email, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Create a pending deposit for each test
        depositId = uuidv4();
        await database.connection.execute(
            `INSERT INTO transactions (
                id, user_id, type, amount, currency, status, description,
                payment_method, wallet_address, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                depositId, userId, 'deposit', 1000, 'USD', 'pending',
                'Test deposit', 'bitcoin', 'test_wallet_address'
            ]
        );
    });

    // Clean up after all tests
    afterAll(async () => {
        // The global teardown script now handles closing the connection.
    });

    describe('PUT /api/admin/transactions/:id/status', () => {
        it('should approve a pending deposit successfully', async () => {
            const response = await request(app)
                .put(`/api/admin/transactions/${depositId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'completed',
                    notes: 'Deposit approved by admin'
                });

            expect(response.status).toBe(200); // Corrected to expect 200
            expect(response.body).toHaveProperty('message', 'Transaction status updated successfully');
            
            // Verify transaction was updated
            const [transaction] = await database.connection.execute(
                'SELECT * FROM transactions WHERE id = ?',
                [depositId]
            );
            
            expect(transaction[0].status).toBe('completed');
            expect(transaction[0].notes).toBe('Deposit approved by admin');
            
            // Verify audit log was created
            const [auditLog] = await database.connection.execute(
                'SELECT * FROM audit_logs WHERE entity_id = ?',
                [depositId]
            );
            
            expect(auditLog.length).toBeGreaterThan(0);
            expect(auditLog[0].action).toBe('transaction_status_update');
            expect(JSON.parse(auditLog[0].new_values).status).toBe('completed');
        });

        it('should reject a deposit with a reason', async () => {
            const response = await request(app)
                .put(`/api/admin/transactions/${depositId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'failed',
                    notes: 'Insufficient proof of payment'
                });

            expect(response.status).toBe(200); // Corrected to expect 200
            
            // Verify transaction was updated
            const [transaction] = await database.connection.execute(
                'SELECT * FROM transactions WHERE id = ?',
                [depositId]
            );
            
            expect(transaction[0].status).toBe('failed');
            expect(transaction[0].notes).toBe('Insufficient proof of payment');
        });

        it('should return 404 for non-existent transaction', async () => {
            const nonExistentId = uuidv4();
            const response = await request(app)
                .put(`/api/admin/transactions/${nonExistentId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'completed',
                    notes: 'Testing non-existent transaction'
                });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Transaction not found');
        });

        it('should return 400 for invalid status', async () => {
            const response = await request(app)
                .put(`/api/admin/transactions/${depositId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'invalid_status',
                    notes: 'Testing invalid status'
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed');
        });

        it('should return 401 for unauthorized user', async () => {
            const response = await request(app)
                .put(`/api/admin/transactions/${depositId}/status`)
                .send({
                    status: 'completed',
                    notes: 'Should fail - no auth'
                });

            expect(response.status).toBe(401);
        });

        it('should return 403 for non-admin user', async () => {
            const response = await request(app)
                .put(`/api/admin/transactions/${depositId}/status`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    status: 'completed',
                    notes: 'Should fail - not admin'
                });

            expect(response.status).toBe(403);
        });
    });
});
