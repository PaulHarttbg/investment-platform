const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const database = require('../database/schema.js');

async function setup() {
    console.log('🚀 Starting database setup...');
    try {
        await database.init();
        console.log('\n🎉 Database setup completed successfully!');
        console.log('You can now start the server with: npm start');
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    } finally {
        if (database.connection) {
            await database.connection.end();
            console.log('🔌 Database connection closed.');
        }
    }
}

setup();
