const request = require('supertest');
const app = require('../server');
const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Admin User Management API', () => {
    let adminToken;
    let adminId;
    let userToManageId;

    beforeAll(async () => {
        await database.init();
    });

    beforeEach(async () => {
        // Clean tables
        await database.connection.execute('DELETE FROM audit_logs');
        await database.connection.execute('DELETE FROM users');
        await database.connection.execute('DELETE FROM admin_users');

        // Create admin user
        adminId = uuidv4();
        const adminPassword = 'AdminPassword123!';
        const adminHashedPassword = await bcrypt.hash(adminPassword, 10);
        await database.connection.execute(
            'INSERT INTO admin_users (id, username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [adminId, 'superadmin', 'superadmin@example.com', adminHashedPassword, 'Super', 'Admin', 'admin']
        );
        adminToken = jwt.sign({ id: adminId, email: 'superadmin@example.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Create a user to be managed
        userToManageId = uuidv4();
        const userPassword = 'UserPassword123!';
        const userHashedPassword = await bcrypt.hash(userPassword, 10);
        await database.connection.execute(
            `INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, account_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userToManageId, 'WE-MANAGE-ME', 'manage.me@example.com', userHashedPassword, 'User', 'ToManage', 'active']
        );
    });

    afterAll(async () => {
        // Global teardown handles connection
    });

    describe('GET /api/admin/users', () => {
        it('should return a list of users for an admin', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.users).toBeInstanceOf(Array);
            expect(res.body.users.length).toBe(1);
            expect(res.body.users[0].id).toBe(userToManageId);
        });

        it('should filter users by search term', async () => {
            const res = await request(app)
                .get('/api/admin/users?search=manage.me')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.users.length).toBe(1);
        });

        it('should filter users by account status', async () => {
            const res = await request(app)
                .get('/api/admin/users?status=active')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.users.length).toBe(1);
        });

        it('should return 403 if not an admin', async () => {
            // Create a regular user token
            const userToken = jwt.sign({ id: userToManageId, role: 'user' }, process.env.JWT_SECRET);
            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /api/admin/users/:id', () => {
        it('should return details for a specific user', async () => {
            const res = await request(app)
                .get(`/api/admin/users/${userToManageId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.id).toBe(userToManageId);
            expect(res.body).toHaveProperty('investments');
            expect(res.body).toHaveProperty('transactions');
        });

        it('should return 404 for a non-existent user', async () => {
            const nonExistentId = uuidv4();
            const res = await request(app)
                .get(`/api/admin/users/${nonExistentId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /api/admin/users/:id/status', () => {
        it("should update a user's account status", async () => {
            const updateData = {
                accountStatus: 'suspended'
            };

            const res = await request(app)
                .put(`/api/admin/users/${userToManageId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('User status updated successfully');
            expect(res.body.updates).toEqual({
                account_status: 'suspended'
            });

            // Verify DB
            const updatedUser = await database.getOne('SELECT account_status FROM users WHERE id = ?', [userToManageId]);
            expect(updatedUser.account_status).toBe('suspended');

            // Verify audit log
            const auditLog = await database.getOne('SELECT * FROM audit_logs WHERE entity_id = ?', [userToManageId]);
            expect(auditLog).toBeDefined();
            expect(auditLog.action).toBe('user_status_update');
            expect(auditLog.admin_id).toBe(adminId);
        });

        it('should return 400 for invalid status values', async () => {
            const updateData = {
                accountStatus: 'invalid-status'
            };

            const res = await request(app)
                .put(`/api/admin/users/${userToManageId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });
    });

    describe('GET /api/admin/dashboard', () => {
        it('should return dashboard statistics', async () => {
            const res = await request(app)
                .get('/api/admin/dashboard')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('statistics');
            expect(res.body.statistics).toHaveProperty('users');
            expect(res.body.statistics).toHaveProperty('investments');
            expect(res.body.statistics).toHaveProperty('transactions');
            expect(res.body).toHaveProperty('recentActivity');
            expect(res.body.recentActivity).toHaveProperty('users');
            expect(res.body.recentActivity).toHaveProperty('transactions');
        });
    });
});