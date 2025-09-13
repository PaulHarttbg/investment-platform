const request = require('supertest');
const app = require('./server');
const database = require('./database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

describe('Role-Based Access Control (RBAC)', () => {
    let adminEmail = 'admin@example.com';
    let userEmail = 'user@example.com';
    let adminId, userId;
    let adminToken, userToken;

    beforeAll(async () => {
        await database.init();
    });

    beforeEach(async () => {
        await database.connection.execute('DELETE FROM users');
        adminId = uuidv4();
        userId = uuidv4();
        const adminHash = await bcrypt.hash('AdminPass123!', 12);
        const userHash = await bcrypt.hash('UserPass123!', 12);
        await database.connection.execute(
            'INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, role, registration_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [adminId, 'WE-ADMIN', adminEmail, adminHash, 'Admin', 'User', 'admin', 'VALID-TOKEN']
        );
        await database.connection.execute(
            'INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, role, registration_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, 'WE-USER', userEmail, userHash, 'Normal', 'User', 'user', 'VALID-TOKEN']
        );
        // Login to get tokens
        const resAdmin = await request(app)
            .post('/api/auth/login')
            .send({ loginId: adminEmail, password: 'AdminPass123!' });
        adminToken = resAdmin.body.token;
        const resUser = await request(app)
            .post('/api/auth/login')
            .send({ loginId: userEmail, password: 'UserPass123!' });
        userToken = resUser.body.token;
    });

    it('should allow admin to access admin settings', async () => {
        const res = await request(app)
            .get('/api/admin/settings')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('settings');
    });

    it('should deny normal user access to admin settings', async () => {
        const res = await request(app)
            .get('/api/admin/settings')
            .set('Authorization', `Bearer ${userToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body).toHaveProperty('error');
    });
});
