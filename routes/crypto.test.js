const request = require('supertest');
const app = require('../server');
const axios = require('axios');
const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Mock the axios module
jest.mock('axios');

describe('Crypto API (/api/crypto)', () => {
    let authToken;

    beforeAll(async () => {
        await database.init();
        // Create a user to authenticate with
        const userPassword = 'Password123!';
        const hashedPassword = await bcrypt.hash(userPassword, 12);
        const testUser = {
            id: uuidv4(),
            email: 'crypto@example.com',
            password: userPassword,
        };
        await database.connection.execute(
            `INSERT INTO users (id, login_id, email, password_hash, first_name, last_name) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [testUser.id, 'WE-CRYPTO-TEST', testUser.email, hashedPassword, 'Crypto', 'User']
        );

        // Log in the user to get a token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ loginId: testUser.email, password: testUser.password });
        authToken = res.body.token;
    });

    afterEach(() => {
        // Clear all mocks after each test
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await database.connection.execute('DELETE FROM users');
    });

    describe('GET /prices', () => {
        it('should return formatted crypto prices on successful API call', async () => {
            // Mock the successful response from CoinMarketCap
            const mockApiResponse = {
                data: {
                    data: {
                        'BTC': { quote: { USD: { price: 50000, percent_change_24h: 2.5 } } },
                        'ETH': { quote: { USD: { price: 4000, percent_change_24h: -1.2 } } },
                        'LTC': { quote: { USD: { price: 200, percent_change_24h: 5.0 } } },
                        'USDT': { quote: { USD: { price: 1.00, percent_change_24h: 0.01 } } },
                    }
                }
            };
            axios.get.mockResolvedValue(mockApiResponse);

            const res = await request(app)
                .get('/api/crypto/prices')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toEqual(200);
            expect(axios.get).toHaveBeenCalledTimes(1);
            expect(res.body).toEqual({
                BTC: { price: 50000, change_24h: 2.5 },
                ETH: { price: 4000, change_24h: -1.2 },
                LTC: { price: 200, change_24h: 5.0 },
                USDT: { price: 1.00, change_24h: 0.01 },
            });
        });

        it('should return 500 if the external API call fails', async () => {
            // Mock a failed response
            axios.get.mockRejectedValue(new Error('Network Error'));

            const res = await request(app)
                .get('/api/crypto/prices')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toEqual('Failed to fetch cryptocurrency prices.');
        });

        it('should return 401 if user is not authenticated', async () => {
            const res = await request(app).get('/api/crypto/prices');
            expect(res.statusCode).toEqual(401);
        });

        it('should return 500 if API key is not configured', async () => {
            const originalApiKey = process.env.CRYPTO_API_KEY;
            process.env.CRYPTO_API_KEY = 'your_crypto_api_key'; // Simulate default/unconfigured key

            const res = await request(app)
                .get('/api/crypto/prices')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toEqual('Price service is currently unavailable.');

            // Restore original key
            process.env.CRYPTO_API_KEY = originalApiKey;
        });
    });
});