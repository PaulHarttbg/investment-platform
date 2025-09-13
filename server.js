const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const compression = require('compression');
const slowDown = require('express-slow-down');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { csrfProtection, csrfToken } = require('./middleware/csrfProtection');

// Load environment variables based on NODE_ENV
if (process.env.NODE_ENV === 'test') {
    require('dotenv').config({ path: path.resolve(__dirname, '.env.test') });
} else {
    require('dotenv').config();
}

const app = express();

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
const PORT = process.env.PORT || 3000;

// Removed invalid/stray else if block and serveStatic usage

// Import routes
const investmentRoutes = require('./routes/investments');
const packageRoutes = require('./routes/packages');
const authRoutes = require('./routes/auth');
const cryptoRoutes = require('./routes/crypto');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const adminApiRoutes = require('./routes/api/admin');
const tokenRoutes = require('./routes/api/tokens');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { sanitizeInput } = require('./middleware/validation');
const database = require('./database/schema');
const InvestmentProcessor = require('./jobs/investmentProcessor');
const appConfig = require('./config/appConfig');

// Set request size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(compression());

// Slow down repeated requests
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 100,
    delayMs: (used) => (used - 100) * 500,
    validate: { delayMs: false }
});
if (process.env.NODE_ENV !== 'test') { app.use(speedLimiter); }

// Import auth middleware
const { auth, isAdmin } = require('./middleware/auth');

// Security headers with CSP
const cspConfig = {
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline is a security risk, but required for your inline scripts. Refactor later.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"], // Allow fonts and icons
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"], // This is fine if API is on the same domain
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"], // Allow fonts and icons
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: []
    },
    reportOnly: false
};

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Change this in production
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

// Apply security middleware
app.use(helmet({
    contentSecurityPolicy: cspConfig,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 15552000, includeSubDomains: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
}));

// Session middleware
app.use(session(sessionConfig));

// CSRF protection for all routes except API endpoints
app.use(csrfToken);
app.use((req, res, next) => {
    // Skip CSRF for API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    return csrfProtection(req, res, next);
});

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting to auth routes
if (process.env.NODE_ENV !== 'test') {
    app.use('/api/auth/register', authLimiter);
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/forgot-password', authLimiter);
    app.use('/api/auth/reset-password', authLimiter);
}
// JSON parsing middleware with size limit
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser with secret
app.use(cookieParser(process.env.COOKIE_SECRET));

// Compression middleware
app.use(compression());

// Logging in development
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Enable CORS with specific options
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:5501',
            'http://localhost:5501',
            ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    // CSRF token errors
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            error: 'Invalid CSRF token',
            code: 'INVALID_CSRF_TOKEN'
        });
    }
    
    // Other errors
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal Server Error' 
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// Security headers middleware
app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Set Referrer-Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Set Permissions-Policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Set Strict-Transport-Security
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    next();
});

// CORS is already configured above with corsOptions
// No need for duplicate configuration

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
if (process.env.NODE_ENV !== 'test') { app.use(limiter); }

// Request sanitization middleware
app.use((req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
        });
    }
    next();
});
app.use(sanitizeInput);

// Logging
app.use(morgan('combined'));

// Serve static pages and assets
app.use(express.static(path.join(__dirname)));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', auth, userRoutes);
app.use('/api/investments', auth, investmentRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/admin', adminRoutes); // Middleware is now handled inside admin.js
app.use('/api/admin', adminApiRoutes); // API endpoints for admin (e.g., settings)
app.use('/api/tokens', auth, isAdmin, tokenRoutes); // This remains protected

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime(), environment: process.env.NODE_ENV || 'development' });
});

// HTML routes (same as before)
app.get('/', (req, res) => res.render('index', { title: 'Home', stylesheet: 'home' }));
app.get('/login', (req, res) => res.render('login', { title: 'Login', stylesheet: 'auth' }));
app.get('/register', (req, res) => res.render('register', { title: 'Register', stylesheet: 'auth' }));
app.get('/dashboard', (req, res) => res.render('dashboard', { title: 'Dashboard', stylesheet: 'dashboard' }));
app.get('/profile', (req, res) => res.render('profile', { title: 'Profile', stylesheet: 'profile' }));
app.get('/packages', (req, res) => res.render('packages', { title: 'Packages', stylesheet: 'packages' }));
app.get('/deposit', (req, res) => res.render('deposit', { title: 'Deposit', stylesheet: 'transactions' }));
app.get('/withdrawal', (req, res) => res.render('withdrawal', { title: 'Withdrawal', stylesheet: 'transactions' }));
app.get('/transactions', (req, res) => res.render('transactions', { title: 'Transactions', stylesheet: 'transactions' }));
app.get('/about', (req, res) => res.render('about', { title: 'About Us', stylesheet: 'about' }));
app.get('/contact', (req, res) => res.render('contact', { title: 'Contact', stylesheet: 'contact' }));
app.get('/help', (req, res) => res.render('help', { title: 'Help Center', stylesheet: 'help' }));
app.get('/terms', (req, res) => res.render('terms', { title: 'Terms & Conditions', stylesheet: 'terms' }));
app.get('/privacy', (req, res) => res.render('privacy', { title: 'Privacy Policy', stylesheet: 'privacy' }));
app.get('/forgot-password', (req, res) => res.render('forgot-password', { title: 'Forgot Password', stylesheet: 'auth' }));

// Admin routes
app.get('/admin', (req, res) => res.render('admin/index', { title: 'Admin Dashboard' }));
app.get('/admin/login', (req, res) => res.render('admin/login', { title: 'Admin Login' }));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        await database.init(); // Initialize DB connection first
        await appConfig.load(); // Load application configuration from DB

        // Start scheduled jobs in non-test environments
        if (process.env.NODE_ENV !== 'test') {
            const investmentProcessorInstance = new InvestmentProcessor(database.connection);
            investmentProcessorInstance.schedule();
        }

        app.listen(PORT, () => {
            console.log(`🚀 WINNING EDGE Server running on port ${PORT}`);
            console.log(`⚡ API: http://localhost:${PORT}/api`);
            console.log(`🔐 Admin: http://localhost:${PORT}/admin`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

// This ensures the server only starts when the file is run directly (e.g., `node server.js`)
// and not when it's imported by another module like our test files.
if (require.main === module) {
    startServer();
}

module.exports = app;
