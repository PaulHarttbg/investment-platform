const database = require('../database/schema');

class AdminUser {
    static async findById(id, connection = database) {
        return connection.getOne('SELECT id, username, email, first_name, last_name, role FROM admin_users WHERE id = ?', [id]);
    }

    static async findByEmail(email, connection = database) {
        return connection.getOne('SELECT * FROM admin_users WHERE email = ?', [email]);
    }
}

module.exports = AdminUser;