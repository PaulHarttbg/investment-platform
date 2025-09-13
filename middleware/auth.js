const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    try {
        // Prioritize the secure cookie, but allow Authorization header for API clients
        let token = req.cookies?.token;
        if (!token && req.headers.authorization) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ error: 'Authentication required. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Decoded token will have { id, email, role }
        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

const isAdmin = (req, res, next) => {
    // This middleware should run *after* the auth middleware
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
};

module.exports = {
    auth,
    isAdmin
};
