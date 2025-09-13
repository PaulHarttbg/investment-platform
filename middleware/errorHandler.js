const winston = require('winston');
const path = require('path');
const database = require('../database/schema');

// Configure logging
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'winning-edge' },
    transports: [
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/error.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/combined.log') 
        })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
    // Log error with winston
    logger.error({
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id || 'anonymous'
    });

    // Log error to database for monitoring
    logError(err, req);

    // Default error response
    let error = {
        message: 'Internal server error',
        status: 500
    };

    // Handle specific error types
    if (err.name === 'ValidationError') {
        error.message = err.message;
        error.status = 400;
    } else if (err.name === 'UnauthorizedError') {
        error.message = 'Unauthorized access';
        error.status = 401;
    } else if (err.code === 'SQLITE_CONSTRAINT') {
        error.message = 'Database constraint violation';
        error.status = 400;
    } else if (err.code === 'LIMIT_FILE_SIZE') {
        error.message = 'File size too large';
        error.status = 413;
    }

    // Don't expose sensitive error details in production
    if (process.env.NODE_ENV === 'production') {
        return res.status(error.status).json({
            error: error.message
        });
    }

    res.status(error.status).json({
        error: error.message,
        stack: err.stack
    });
};

// Log errors to database
const logError = async (err, req) => {
    if (!database.connection) {
        console.error('Database not connected. Cannot log error to DB.');
        return;
    }
    try {
        const { url, method, ip } = req;
        const userAgent = req.get('User-Agent');
        const userId = req.user?.id || null;
        await database.query(
            "INSERT INTO error_logs (message, stack, url, method, ip_address, user_agent, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)", 
            [err.message, err.stack, url, method, ip, userAgent, userId]
        );
    } catch (logErr) {
        console.error('Failed to log error to database:', logErr);
    }
};

// 404 handler
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'The requested resource does not exist'
    });
};

module.exports = {
    errorHandler,
    notFoundHandler
};
