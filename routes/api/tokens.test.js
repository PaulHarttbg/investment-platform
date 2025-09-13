const request = require('supertest');
const app = require('../../server');
const database = require('../../database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Token Generation API [/api/tokens]', () => {
    let adminToken, userToken;
    let adminId, userId;

    const adminUser = {
        email: 'tokenadmin@test.com',
        password: 'Password123!',
    };

    const regularUser = {
        email: 'tokenuser@test.com',
        password: 'Password123!',
    };

    beforeAll(async () => {
        await database.init();
    });

    beforeEach(async () => {
        // Clean tables to ensure test isolation
        await database.connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
        await database.connection.execute('DELETE FROM registration_tokens');
        await database.connection.execute('DELETE FROM users');
        await database.connection.execute('DELETE FROM admin_users');
        await database.connection.execute('SET FOREIGN_KEY_CHECKS = 1;');

        // Create admin user
        adminId = uuidv4();
        const adminPasswordHash = await bcrypt.hash(adminUser.password, 10);
        await database.connection.execute(
            'INSERT INTO admin_users (id, username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [adminId, `tokenadmin_${Date.now()}`, adminUser.email, adminPasswordHash, 'Token', 'Admin', 'superadmin']
        );

        // Create regular user
        userId = uuidv4();
        const userPasswordHash = await bcrypt.hash(regularUser.password, 10);
        await database.connection.execute(
            'INSERT INTO users (id, login_id, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, `WE-TKN-USER-${Date.now()}`, regularUser.email, userPasswordHash, 'Token', 'User']
        );

        // Generate tokens
        adminToken = jwt.sign({ id: adminId, email: adminUser.email, role: 'superadmin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        userToken = jwt.sign({ id: userId, email: regularUser.email, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        if (database.connection) {
            await database.connection.end();
        }
    });

    describe('POST /api/tokens', () => {
        it('should allow an admin to create a single-use token', async () => {
            const res = await request(app)
                .post('/api/tokens')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    usageLimit: 1,
                    notes: 'Test token'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('token');
            expect(res.body.data.usage_limit).toBe(1);
            expect(res.body.data.notes).toBe('Test token');
            expect(res.body.data.created_by).toBe(adminId);

            // Verify in DB
            const [tokens] = await database.connection.execute('SELECT * FROM registration_tokens WHERE token = ?', [res.body.data.token]);
            expect(tokens.length).toBe(1);
            expect(tokens[0].usage_limit).toBe(1);
        });

        it('should allow an admin to create a multi-use token with an expiry date', async () => {
            const res = await request(app)
                .post('/api/tokens')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    usageLimit: 10,
                    expiresInDays: 7,
                    notes: 'Weekly token'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.data.usage_limit).toBe(10);
            expect(res.body.data.expires_at).not.toBeNull();

            // Verify in DB
            const [tokens] = await database.connection.execute('SELECT * FROM registration_tokens WHERE token = ?', [res.body.data.token]);
            const expiryDate = new Date(tokens[0].expires_at);
            const expectedExpiry = new Date();
            expectedExpiry.setDate(expectedExpiry.getDate() + 7);
            
            // Check if expiry is within a reasonable range (e.g., a few seconds)
            expect(expiryDate.getTime()).toBeCloseTo(expectedExpiry.getTime(), -4);
        });

        it('should return 403 Forbidden for a non-admin user', async () => {
            const res = await request(app)
                .post('/api/tokens')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ usageLimit: 1 });

            expect(res.statusCode).toEqual(403);
            expect(res.body.error).toBe('Forbidden: Admin access required.');
        });

        it('should return 401 Unauthorized for an unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/tokens')
                .send({ usageLimit: 1 });

            expect(res.statusCode).toEqual(401);
            expect(res.body.error).toContain('Authentication required');
        });
    });
});