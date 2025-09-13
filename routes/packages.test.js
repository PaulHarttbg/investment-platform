const request = require('supertest');
const app = require('../server');
const database = require('../database/schema');
const { v4: uuidv4 } = require('uuid');

describe('Investment Packages API (/api/packages)', () => {
    let activePackage, inactivePackage;

    beforeAll(async () => {
        await database.init();
    });

    beforeEach(async () => {
        // Clean tables
        await database.connection.execute('DELETE FROM investments');
        await database.connection.execute('DELETE FROM investment_packages');

        // Seed packages
        activePackage = {
            id: uuidv4(),
            name: 'Active Gold',
            min_amount: 500,
            max_amount: 5000,
            return_rate: 12,
            duration_days: 60,
            is_active: 1
        };
        inactivePackage = {
            id: uuidv4(),
            name: 'Inactive Silver',
            min_amount: 100,
            max_amount: 1000,
            return_rate: 8,
            duration_days: 30,
            is_active: 0
        };

        await database.query(
            'INSERT INTO investment_packages (id, name, min_amount, max_amount, return_rate, duration_days, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [activePackage.id, activePackage.name, activePackage.min_amount, activePackage.max_amount, activePackage.return_rate, activePackage.duration_days, activePackage.is_active]
        );
        await database.query(
            'INSERT INTO investment_packages (id, name, min_amount, max_amount, return_rate, duration_days, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [inactivePackage.id, inactivePackage.name, inactivePackage.min_amount, inactivePackage.max_amount, inactivePackage.return_rate, inactivePackage.duration_days, inactivePackage.is_active]
        );
    });

    afterAll(async () => {
        // Global teardown handles connection
    });

    describe('GET /', () => {
        it('should return only active investment packages', async () => {
            const res = await request(app).get('/api/packages');

            expect(res.statusCode).toEqual(200);
            expect(res.body.packages).toBeInstanceOf(Array);
            expect(res.body.packages.length).toBe(1);
            expect(res.body.packages[0].id).toBe(activePackage.id);
            expect(res.body.packages[0].name).toBe(activePackage.name);
        });
    });

    describe('GET /:id', () => {
        it('should return details for a specific active package', async () => {
            const res = await request(app).get(`/api/packages/${activePackage.id}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.package).toBeDefined();
            expect(res.body.package.id).toBe(activePackage.id);
            expect(res.body).toHaveProperty('statistics');
        });

        it('should return 404 for an inactive package', async () => {
            // The route logic filters for is_active = 1
            const res = await request(app).get(`/api/packages/${inactivePackage.id}`);
            expect(res.statusCode).toEqual(404);
            expect(res.body.error).toEqual('Package not found');
        });

        it('should return 404 for a non-existent package ID', async () => {
            const nonExistentId = uuidv4();
            const res = await request(app).get(`/api/packages/${nonExistentId}`);
            expect(res.statusCode).toEqual(404);
        });
    });
});