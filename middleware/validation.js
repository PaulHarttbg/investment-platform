const { body, param, query, validationResult } = require('express-validator');

// Common validation rules
const commonValidations = {
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    
    password: body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
    name: (field) => body(field)
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage(`${field} must be between 2 and 50 characters`)
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage(`${field} can only contain letters, spaces, hyphens, and apostrophes`),
    
    phone: body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Please provide a valid phone number'),
    
    amount: (field = 'amount') => body(field)
        .isFloat({ min: 0.01 })
        .withMessage(`${field} must be a positive number`)
        .custom((value) => {
            if (value > 1000000) {
                throw new Error(`${field} cannot exceed $1,000,000`);
            }
            return true;
        }),
    
    uuid: (field) => param(field)
        .isUUID()
        .withMessage(`Invalid ${field} format`),
    
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100')
    ]
};

// User registration validation
const validateUserRegistration = [
    commonValidations.email,
    commonValidations.password,
    commonValidations.name('firstName'),
    commonValidations.name('lastName'),
    body('registrationToken')
        .optional()
        .default('public-registration')
        .isString()
        .withMessage('Invalid registration token format'),
    body('agreeToTerms')
        .equals('true')
        .withMessage('You must agree to the terms and conditions'),
    body('agreeToPrivacy')
        .equals('true')
        .withMessage('You must agree to the privacy policy')
];

// User login validation
const validateUserLogin = [
    body('loginId')
        .notEmpty()
        .withMessage('Login ID is required')
        .trim(),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Admin login validation
const validateAdminLogin = [
    body('username')
        .notEmpty()
        .withMessage('Username is required')
        .trim(),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

// Password reset validation
const validatePasswordReset = [
    commonValidations.email
];

// Password change validation
const validatePasswordChange = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    commonValidations.password.custom((value, { req }) => {
        if (value === req.body.currentPassword) {
            throw new Error('New password must be different from current password');
        }
        return true;
    }),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Password confirmation does not match');
            }
            return true;
        })
];

// Profile update validation
const validateProfileUpdate = [
    commonValidations.name('firstName').optional(),
    commonValidations.name('lastName').optional(),
    commonValidations.phone,
    body('address')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Address cannot exceed 200 characters'),
    body('city')
        .optional()
        .isLength({ max: 50 })
        .withMessage('City cannot exceed 50 characters'),
    body('postalCode')
        .optional()
        .isLength({ max: 20 })
        .withMessage('Postal code cannot exceed 20 characters')
];

// Investment creation validation
const validateInvestment = [
    body('packageId')
        .isUUID()
        .withMessage('Invalid package ID'),
    commonValidations.amount('amount')
];

// Transaction validation
const validateDeposit = [
    commonValidations.amount('amount'),
    body('paymentMethod')
        .isIn(['bitcoin', 'ethereum', 'usdt', 'bank_transfer'])
        .withMessage('Invalid payment method'),
    body('walletAddress')
        .optional()
        .isLength({ min: 10, max: 100 })
        .withMessage('Invalid wallet address format')
];

const validateWithdrawal = [
    commonValidations.amount('amount'),
    body('paymentMethod')
        .isIn(['bitcoin', 'ethereum', 'usdt', 'bank_transfer'])
        .withMessage('Invalid payment method'),
    body('walletAddress')
        .if(body('paymentMethod').isIn(['bitcoin', 'ethereum', 'usdt']))
        .notEmpty()
        .withMessage('Wallet address is required for crypto withdrawals')
        .isLength({ min: 10, max: 100 })
        .withMessage('Invalid wallet address format'),
    body('bankDetails')
        .if(body('paymentMethod').equals('bank_transfer'))
        .isObject()
        .withMessage('Bank details are required for bank transfers')
];

// Admin validation rules
const validateUserStatusUpdate = [
    commonValidations.uuid('id'),
    body('accountStatus')
        .optional()
        .isIn(['active', 'suspended', 'closed'])
        .withMessage('Invalid account status'),
    body('kycStatus')
        .optional()
        .isIn(['pending', 'approved', 'rejected'])
        .withMessage('Invalid KYC status')
];

const validateTransactionStatusUpdate = [
    commonValidations.uuid('id'),
    body('status')
        .isIn(['pending', 'completed', 'failed', 'cancelled'])
        .withMessage('Invalid transaction status'),
    body('transactionHash')
        .optional()
        .isLength({ min: 10, max: 100 })
        .withMessage('Invalid transaction hash'),
    body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes cannot exceed 500 characters')
];

const validatePackageCreation = [
    body('name')
        .notEmpty()
        .withMessage('Package name is required')
        .isLength({ max: 100 })
        .withMessage('Package name cannot exceed 100 characters'),
    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters'),
    body('minAmount')
        .isFloat({ min: 1 })
        .withMessage('Minimum amount must be positive'),
    body('maxAmount')
        .isFloat({ min: 1 })
        .withMessage('Maximum amount must be positive')
        .custom((value, { req }) => {
            if (value <= req.body.minAmount) {
                throw new Error('Maximum amount must be greater than minimum amount');
            }
            return true;
        }),
    body('returnRate')
        .isFloat({ min: 0, max: 100 })
        .withMessage('Return rate must be between 0 and 100'),
    body('durationDays')
        .isInt({ min: 1, max: 3650 })
        .withMessage('Duration must be between 1 and 3650 days'),
    body('riskLevel')
        .isIn(['low', 'medium', 'high'])
        .withMessage('Invalid risk level')
];

// KYC validation
const validateKYCSubmission = [
    body('documentType')
        .isIn(['passport', 'drivers_license', 'national_id'])
        .withMessage('Invalid document type'),
    body('documentNumber')
        .notEmpty()
        .withMessage('Document number is required')
        .isLength({ max: 50 })
        .withMessage('Document number cannot exceed 50 characters'),
    body('expiryDate')
        .isDate()
        .withMessage('Please provide a valid expiry date')
        .custom((value) => {
            const expiryDate = new Date(value);
            const today = new Date();
            if (expiryDate <= today) {
                throw new Error('Document must not be expired');
            }
            return true;
        }),
    body('issueDate')
        .isDate()
        .withMessage('Please provide a valid issue date')
        .custom((value, { req }) => {
            const issueDate = new Date(value);
            const expiryDate = new Date(req.body.expiryDate);
            if (issueDate >= expiryDate) {
                throw new Error('Issue date must be before expiry date');
            }
            return true;
        })
];

// Search and filter validation
const validateSearch = [
    query('search')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Search term cannot exceed 100 characters')
        .trim(),
    query('status')
        .optional()
        .isAlpha()
        .withMessage('Status must contain only letters'),
    query('type')
        .optional()
        .isAlpha()
        .withMessage('Type must contain only letters'),
    ...commonValidations.pagination
];

// Date range validation
const validateDateRange = [
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be in ISO format'),
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be in ISO format')
        .custom((value, { req }) => {
            if (req.query.startDate && value) {
                const startDate = new Date(req.query.startDate);
                const endDate = new Date(value);
                if (endDate <= startDate) {
                    throw new Error('End date must be after start date');
                }
                const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
                if (daysDiff > 365) {
                    throw new Error('Date range cannot exceed 365 days');
                }
            }
            return true;
        })
];

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(error => ({
                field: error.param,
                message: error.msg,
                value: error.value
            }))
        });
    }
    next();
};

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Remove any potential XSS attempts
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            return value
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }
        return value;
    };

    const sanitizeObject = (obj) => {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key]);
                } else {
                    obj[key] = sanitizeValue(obj[key]);
                }
            }
        }
    };

    sanitizeObject(req.body);
    sanitizeObject(req.query);
    sanitizeObject(req.params);

    next();
};

module.exports = {
    // Common validations
    commonValidations,
    
    // User validations
    validateUserRegistration,
    validateUserLogin,
    validatePasswordReset,
    validatePasswordChange,
    validateProfileUpdate,
    validateKYCSubmission,
    
    // Admin validations
    validateAdminLogin,
    validateUserStatusUpdate,
    validateTransactionStatusUpdate,
    validatePackageCreation,
    
    // Transaction validations
    validateDeposit,
    validateWithdrawal,
    validateInvestment,
    
    // Search and filter validations
    validateSearch,
    validateDateRange,
    
    // Middleware
    handleValidationErrors,
    sanitizeInput
};
