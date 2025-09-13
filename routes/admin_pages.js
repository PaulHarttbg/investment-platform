const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');

// Admin login page
router.get('/login', (req, res) => {
    res.render('admin/login', { title: 'Admin Login' });
});

// Admin dashboard (index)
router.get('/', auth, isAdmin, (req, res) => {
    res.render('admin/index', { title: 'Admin Dashboard', user: req.user });
});

// Redirect /admin/index.html to /admin
router.get('/index.html', (req, res) => {
    res.redirect('/admin');
});

module.exports = router;