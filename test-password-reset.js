const request = require('supertest');
const app = require('./server');
const database = require('./database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

describe('Password Reset Flow', () => {
    let userEmail = 'resetuser@example.com';
    let userId;
    let resetToken;

    beforeAll(async () => {
        await database.init();
    });

    beforeEach(async () => {
        await database.connection.execute('DELETE FROM users');
        userId = uuidv4();
        const passwordHash = await bcrypt.hash('OldPassword123!', 12);
        await database.connection.execute(
            'INSERT INTO users (id, login_id, email, password_hash, first_name, last_name, registration_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'WE-RESET-USER', userEmail, passwordHash, 'Reset', 'User', 'VALID-TOKEN']
        );
    });

    it('should request a password reset and reset the password', async () => {
        // Request password reset
        const res1 = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: userEmail });
        expect(res1.statusCode).toBe(200);
        expect(res1.body).toHaveProperty('message');
        // Simulate getting the token from DB (in real app, would be emailed)
        const [rows] = await database.connection.execute('SELECT reset_token FROM users WHERE email = ?', [userEmail]);
        resetToken = rows[0].reset_token;
        expect(resetToken).toBeDefined();
        // Reset password
        const res2 = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: resetToken, password: 'NewPassword123!' });
        expect(res2.statusCode).toBe(200);
        expect(res2.body).toHaveProperty('message', 'Password reset successful.');
        // Try logging in with new password
        const res3 = await request(app)
            .post('/api/auth/login')
            .send({ loginId: userEmail, password: 'NewPassword123!' });
        expect(res3.statusCode).toBe(200);
        expect(res3.body).toHaveProperty('message', 'Login successful.');
    });

    it('should fail to reset with invalid token', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'invalid-token', password: 'Whatever123!' });
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});
