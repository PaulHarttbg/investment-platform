const db = require('../database/schema');

async function resetDatabase() {
    try {
        console.log('Resetting database...');
        await db.init();
        console.log('✅ Database reset completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting database:', error);
        process.exit(1);
    }
}

resetDatabase();
