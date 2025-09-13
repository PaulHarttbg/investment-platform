const mysql = require('mysql2/promise');
require('dotenv').config();

// Use DB_PASSWORD, but fall back to DB_PASS for compatibility.
const dbPassword = process.env.DB_PASSWORD || process.env.DB_PASS;

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: dbPassword,
  database: process.env.DB_NAME,
});

module.exports = db;
