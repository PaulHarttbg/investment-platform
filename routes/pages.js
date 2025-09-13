const express = require('express');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
    res.render('public/index', { title: 'Home', stylesheet: 'style' });
});

// About page
router.get('/about', (req, res) => {
    res.render('public/about', { title: 'About Us', stylesheet: 'about' });
});

// Packages page
router.get('/packages', (req, res) => {
    res.render('public/packages', { title: 'Investment Packages', stylesheet: 'packages' });
});

// Contact page
router.get('/contact', (req, res) => {
    res.render('public/contact', { title: 'Contact & FAQ', stylesheet: 'contact' });
});

// Login page
router.get('/login', (req, res) => {
    // Generate CSRF token for the login form
    res.render('public/login', { 
        title: 'Login', 
        stylesheet: 'auth',
        _csrf: req.csrfToken ? req.csrfToken() : ''
    });
});

// Register page
router.get('/register', (req, res) => {
    res.render('public/register', { title: 'Register', stylesheet: 'auth' });
});

// Help page
router.get('/help', (req, res) => {
    res.render('public/help', { title: 'Help Center', stylesheet: 'help' });
});

// Terms page (placeholder)
router.get('/terms', (req, res) => {
    res.render('public/terms', { title: 'Terms & Conditions', stylesheet: 'terms' });
});

// Privacy page (placeholder)
router.get('/privacy', (req, res) => {
    res.render('public/privacy', { title: 'Privacy Policy', stylesheet: 'privacy' });
});

module.exports = router;