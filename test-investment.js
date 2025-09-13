const request = require('supertest');
const app = require('./server');
const database = require('./database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

describe('Investment Creation Flow', () => {
    let userEmail = 'investuser@example.com';
    let userId;
    let authToken;

    beforeAll(async () => {
        await database.init();
    });

    beforeEach(async () => {
        await database.connection.execute('DELETE FROM users');
        await database.connection.execute('DELETE FROM investments');
        userId = uuidv4();
        const passwordHash = await bcrypt.hash('UserPassword123!', 12);
        await database.connection.execute(
            'INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, registration_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'WE-INVEST-USER', userEmail, passwordHash, 'Invest', 'User', 'VALID-TOKEN']
        );
        // Login to get auth token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ loginId: userEmail, password: 'UserPassword123!' });
        authToken = res.body.token;
    });

    it('should create a new investment', async () => {
        const res = await request(app)
            .post('/api/investments')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ packageId: 1, amount: 500 });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('investmentId');
        expect(res.body).toHaveProperty('message', 'Investment created successfully.');
    });

    it('should fail to invest with invalid package', async () => {
        const res = await request(app)
            .post('/api/investments')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ packageId: 9999, amount: 500 });
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});
