const database = require('../database/schema');

module.exports = async () => {
  if (database.connection) {
    console.log('\n[Teardown] Closing database connection pool...');
    await database.connection.end();
    console.log('[Teardown] Database connection pool closed.');
  }
};