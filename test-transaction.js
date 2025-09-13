const request = require('supertest');
const app = require('./server');
const database = require('./database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

describe('Transaction Creation Flow', () => {
    let userEmail = 'transactuser@example.com';
    let userId;
    let authToken;

    beforeAll(async () => {
        await database.init();
    });

    beforeEach(async () => {
        await database.connection.execute('DELETE FROM users');
        await database.connection.execute('DELETE FROM transactions');
        userId = uuidv4();
        const passwordHash = await bcrypt.hash('UserPassword123!', 12);
        await database.connection.execute(
            'INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, registration_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'WE-TRANSACT-USER', userEmail, passwordHash, 'Transact', 'User', 'VALID-TOKEN']
        );
        // Login to get auth token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ loginId: userEmail, password: 'UserPassword123!' });
        authToken = res.body.token;
    });

    it('should create a deposit transaction', async () => {
        const res = await request(app)
            .post('/api/transactions/deposit')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ amount: 100 });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('transactionId');
        expect(res.body).toHaveProperty('message', 'Deposit successful.');
    });

    it('should create a withdrawal transaction', async () => {
        // First, deposit some funds
        await request(app)
            .post('/api/transactions/deposit')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ amount: 200 });
        // Then, withdraw
        const res = await request(app)
            .post('/api/transactions/withdraw')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ amount: 50 });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('transactionId');
        expect(res.body).toHaveProperty('message', 'Withdrawal successful.');
    });

    it('should fail withdrawal with insufficient funds', async () => {
        const res = await request(app)
            .post('/api/transactions/withdraw')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ amount: 1000 });
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});
