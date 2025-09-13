const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const database = require('../database/schema');
const User = require('../models/User');
const Token = require('../models/Token');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const emailService = require('../middleware/email');

// Input validation middleware
const validateRegistration = (req, res, next) => {
  const { email, password, firstName, lastName, registrationToken, referralCode } = req.body;
  const errors = [];

  // Required fields check
  if (!email) errors.push('Email is required');
  if (!password) errors.push('Password is required');
  if (!firstName) errors.push('First name is required');
  if (!lastName) errors.push('Last name is required');
  if (!registrationToken) errors.push('Registration token is required');

  // Email format validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please enter a valid email address');
  }

  // Password strength validation
  if (password) {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*)');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

// Rate limiting for registration
const rateLimit = require('express-rate-limit');
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 registration requests per windowMs
  message: {
    error: 'Too many registration attempts from this IP, please try again after 15 minutes'
  }
});

// Registration
router.post('/register', async (req, res, next) => {
  // Run validation first
  validateRegistration(req, res, async () => {
    // If validation passed, apply rate limiting
    registrationLimiter(req, res, next);
  });
}, async (req, res) => {
  const { email, password, firstName, lastName, registrationToken, referralCode } = req.body;
  const connection = await database.getConnection();
  
  try {
    await connection.beginTransaction();

    // 1. Validate registration token with additional checks
    const [tokens] = await connection.execute(
      `SELECT * FROM registration_tokens 
       WHERE token = ? 
       AND is_active = 1 
       AND (expires_at IS NULL OR expires_at > NOW()) 
       AND (usage_count < usage_limit OR usage_limit = 0)
       FOR UPDATE`,
      [registrationToken]
    );
    
    const tokenInfo = tokens[0];
    if (!tokenInfo) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Invalid or expired registration token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Update token usage count and check limit in a single atomic operation
    await connection.execute(
      `UPDATE registration_tokens 
       SET usage_count = usage_count + 1,
           is_active = CASE 
             WHEN usage_limit > 0 AND (usage_count + 1) >= usage_limit THEN 0 
             ELSE is_active 
           END
       WHERE token = ?`,
      [registrationToken]
    );

    // 2. Check if user already exists (case-insensitive check)
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?)',
      [email]
    );
    
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(409).json({ 
        error: 'An account with this email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    // 3. Check for referral code
    let referrerId = null;
    if (referralCode) {
        const [referrers] = await connection.execute(
            'SELECT id FROM users WHERE login_id = ?',
            [referralCode]
        );
        if (referrers.length > 0) {
            referrerId = referrers[0].id;
        } else {
            console.warn(`Invalid referral code used during registration: ${referralCode}`);
        }
    }

    // 4. Generate secure user ID and login ID
    const userId = uuidv4();
    const loginId = `WE${Date.now().toString().slice(-6)}`;
    
    // 5. Hash password with dynamic salt rounds
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 6. Create user account with additional security fields
    await connection.execute(
      `INSERT INTO users (
        id, login_id, email, password_hash, first_name, last_name,
        registration_token, referred_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        loginId, 
        email, 
        hashedPassword, 
        firstName.trim(), 
        lastName.trim(), 
        registrationToken,
        referrerId
      ]
    );

    // 7. Update token usage with additional logging
    await connection.execute(
      `UPDATE registration_tokens 
       SET used_by = ?, 
           last_used_at = NOW() 
       WHERE id = ?`,
      [userId, tokenInfo.id]
    );

    // 8. Deactivate token if usage limit is reached
    if (tokenInfo.usage_limit > 0 && tokenInfo.usage_count + 1 >= tokenInfo.usage_limit) {
      await connection.execute(
        'UPDATE registration_tokens SET is_active = false, deactivated_at = NOW() WHERE id = ?',
        [tokenInfo.id]
      );
    }

    await connection.commit();

    // 9. Send verification email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 3600000); // 24 hours

    try {
        // This is outside the main transaction but we'll await it before responding.
        await connection.execute(
            `INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
            [uuidv4(), userId, verificationTokenHash, verificationExpiresAt]
        );
        
        const userForEmail = {
            email: email,
            first_name: firstName.trim(),
            login_id: loginId
        };
        // Send verification email with the *unhashed* token
        emailService.sendWelcomeEmail(userForEmail, verificationToken).catch(err => {
            console.error(`Failed to send verification email to ${email}:`, err);
        });
    } catch (emailTokenError) {
        console.error(`Failed to create email verification token for ${email}:`, emailTokenError);
    }

    // 10. Generate JWT token for immediate login
    const token = jwt.sign(
      { 
        id: userId, 
        email: email,
        role: 'user',
        loginId: loginId
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    // 11. Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    // 12. Return success response without sensitive data
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: { 
        id: userId, 
        loginId: loginId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email
      },
      token: token // For non-browser clients
    });

  } catch (err) {
    await connection.rollback();
    console.error('Registration error:', {
      error: err.message,
      stack: err.stack,
      email: email,
      ip: req.ip
    });
    
    // Handle specific database errors
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        error: 'This email is already registered',
        code: 'DUPLICATE_EMAIL'
      });
    }
    
    res.status(500).json({ 
      error: 'Registration failed. Please try again later.',
      code: 'REGISTRATION_FAILED'
    });
  } finally {
    if (connection && typeof connection.release === 'function') {
      await connection.release();
    }
  }
});

// Login
router.post('/login', 
    // CSRF protection is handled by the global middleware
    async (req, res) => {
  const { loginId, password } = req.body;
  if (!loginId || !password) return res.status(400).json({ error: 'Login ID and password required.' });

  try {
    const user = await User.findByLoginIdOrEmail(loginId);

    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ id: user.id, email: user.email, loginId: user.login_id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    await User.update(user.id, { last_login: new Date() });

    const userPayload = {
        id: user.id,
        loginId: user.login_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email
    };

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.json({ 
        message: 'Login successful.', 
        token, 
        user: userPayload,
        redirect: '/dashboard.html' 
    });
  } catch (error) {
    console.error('Login error:', error);
    // Render the login page with error message
    return res.render('login', { 
      title: 'Login', 
      stylesheet: 'auth',
      error: error.message || 'An error occurred during login',
      email: req.body.email,
      _csrf: req.csrfToken()
    });
  }
});

// Get authentication status
router.get('/status', require('../middleware/auth').auth, async (req, res) => {
    try {
        // The 'auth' middleware has already verified the token and attached the user to req.user.
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            isAuthenticated: true,
            user: { // Return a safe subset of user data
                id: user.id,
                login_id: user.login_id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                account_status: user.account_status,
                kyc_status: user.kyc_status
            }
        });
    } catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({ 
            isAuthenticated: false,
            error: 'Failed to get authentication status.' 
        });
    }
});

// Forgot Password
router.post('/forgot-password', [
    body('email').isEmail().withMessage('Please enter a valid email address').normalizeEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { email } = req.body;
    const connection = await database.getConnection();

    try {
        const user = await User.findByEmail(email, connection);

        if (user) {
            // Generate a secure token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

            // Set expiry for 1 hour
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

            // Store hashed token in the database
            await connection.execute(
                `INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
                [uuidv4(), user.id, tokenHash, expiresAt]
            );

            // Send the password reset email with the *unhashed* token
            await emailService.sendPasswordResetEmail(user, resetToken);
        }

        // To prevent user enumeration, always return a success-like message.
        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    } finally {
        if (connection) connection.release();
    }
});

// Reset Password
router.post('/reset-password', [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { token, newPassword } = req.body;
    const connection = await database.getConnection();

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const [tokens] = await connection.execute(
            'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() AND used = 0',
            [tokenHash]
        );
        const resetTokenInfo = tokens[0];

        if (!resetTokenInfo) {
            return res.status(400).json({ error: 'Invalid or expired password reset token.' });
        }

        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        await User.updatePassword(resetTokenInfo.user_id, hashedPassword, connection);
        await connection.execute('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [resetTokenInfo.id]);

        res.json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'An error occurred while resetting your password.' });
    } finally {
        if (connection) connection.release();
    }
});

// Verify Email
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        // Ideally, redirect to a frontend page with an error message
        return res.status(400).send('<h1>Email Verification Failed</h1><p>Verification token is missing.</p>');
    }

    let connection;
    try {
        connection = await database.getConnection();
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const [tokens] = await connection.execute(
            'SELECT * FROM email_verification_tokens WHERE token = ? AND expires_at > NOW()',
            [tokenHash]
        );
        const verificationTokenInfo = tokens[0];

        if (!verificationTokenInfo) {
            return res.status(400).send('<h1>Email Verification Failed</h1><p>Invalid or expired verification token. Please request a new one from your profile.</p>');
        }

        await connection.beginTransaction();

        // 1. Mark user as verified
        await User.update(verificationTokenInfo.user_id, { email_verified: 1 }, connection);

        // 2. Delete the token so it can't be used again
        await connection.execute('DELETE FROM email_verification_tokens WHERE id = ?', [verificationTokenInfo.id]);

        await connection.commit();

        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/login.html?verified=true`);
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Email verification error:', error);
        res.status(500).send('<h1>Error</h1><p>An error occurred during email verification. Please try again later.</p>');
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
