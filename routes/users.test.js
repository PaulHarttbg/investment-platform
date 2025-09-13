const request = require('supertest');
const app = require('../server');
const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

describe('User API (/api/users)', () => {
    let testUser;
    let authToken;
    const userPassword = 'Password123!';

    beforeAll(async () => {
        await database.init();
    });

    beforeEach(async () => {
        // Clean tables
        await database.connection.execute('DELETE FROM audit_logs');
        await database.connection.execute('DELETE FROM users');

        // Create a user
        const hashedPassword = await bcrypt.hash(userPassword, 12);
        testUser = {
            id: uuidv4(),
            login_id: 'WE-USER-TEST',
            email: 'user@example.com',
            password: userPassword,
            account_balance: 100.00
        };
        await database.connection.execute(
            `INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, account_balance) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [testUser.id, testUser.login_id, testUser.email, hashedPassword, 'Test', 'User', testUser.account_balance]
        );

        // Log in the user to get a token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ loginId: testUser.email, password: testUser.password });
        authToken = res.body.token;
    });

    afterAll(async () => {
        // Global teardown will handle connection closing
    });

    describe('GET /profile', () => {
        it('should return the profile of the authenticated user', async () => {
            const res = await request(app)
                .get('/api/users/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.id).toEqual(testUser.id);
            expect(res.body.user.email).toEqual(testUser.email);
            expect(res.body.user).not.toHaveProperty('password_hash');
        });

        it('should return 401 if not authenticated', async () => {
            const res = await request(app).get('/api/users/profile');
            expect(res.statusCode).toEqual(401);
        });
    });

    describe('PUT /profile', () => {
        it('should update the user profile with valid data', async () => {
            const updateData = {
                firstName: 'UpdatedFirst',
                lastName: 'UpdatedLast',
                phone: '1234567890',
                country: 'Canada'
            };

            const res = await request(app)
                .put('/api/users/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toEqual('Profile updated successfully');

            // Verify database changes
            const updatedUser = await database.getOne('SELECT * FROM users WHERE id = ?', [testUser.id]);
            expect(updatedUser.first_name).toEqual(updateData.firstName);
            expect(updatedUser.last_name).toEqual(updateData.lastName);
            expect(updatedUser.phone).toEqual(updateData.phone);
            expect(updatedUser.country).toEqual(updateData.country);

            // Verify audit log
            const auditLog = await database.getOne('SELECT * FROM audit_logs WHERE user_id = ? AND action = ?', [testUser.id, 'profile_update']);
            expect(auditLog).toBeDefined();
            expect(JSON.parse(auditLog.new_values)).toEqual({
                first_name: 'UpdatedFirst',
                last_name: 'UpdatedLast',
                phone: '1234567890',
                country: 'Canada'
            });
        });

        it('should return 400 for invalid data', async () => {
            const updateData = {
                firstName: 'A' // Too short
            };

            const res = await request(app)
                .put('/api/users/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toEqual('Validation failed');
        });

        it('should return 400 if no valid fields are provided', async () => {
            const res = await request(app)
                .put('/api/users/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toEqual('No valid fields to update');
        });
    });

    describe('PUT /change-password', () => {
        it('should change the password with correct current password', async () => {
            const passwordData = {
                currentPassword: userPassword,
                newPassword: 'NewPassword123!'
            };

            const res = await request(app)
                .put('/api/users/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(passwordData);

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toEqual('Password changed successfully');

            // Verify password was actually changed by trying to log in with the new password
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ loginId: testUser.email, password: passwordData.newPassword });
            
            expect(loginRes.statusCode).toEqual(200);

            // Verify audit log
            const auditLog = await database.getOne('SELECT * FROM audit_logs WHERE user_id = ? AND action = ?', [testUser.id, 'password_change']);
            expect(auditLog).toBeDefined();
        });

        it('should fail with an incorrect current password', async () => {
            const passwordData = {
                currentPassword: 'WrongPassword!',
                newPassword: 'NewPassword123!'
            };

            const res = await request(app)
                .put('/api/users/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(passwordData);

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toEqual('Invalid current password');
        });

        it('should fail with a weak new password', async () => {
            const passwordData = {
                currentPassword: userPassword,
                newPassword: 'weak'
            };

            const res = await request(app)
                .put('/api/users/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(passwordData);

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toEqual('Validation failed');
        });
    });

    describe('GET /dashboard', () => {
        it('should return dashboard data for the authenticated user', async () => {
            // You might want to seed some investments and transactions here for a more thorough test
            const res = await request(app)
                .get('/api/users/dashboard')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('user');
            expect(res.body).toHaveProperty('investments');
            expect(res.body).toHaveProperty('transactions');
            expect(res.body.user.accountBalance).toBeDefined();
        });
    });
});