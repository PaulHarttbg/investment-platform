const { randomBytes } = require('crypto');

// Generate a CSRF token
const generateToken = () => {
  return randomBytes(32).toString('hex');
};

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from header or body
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session.csrfToken;

  // Verify token
  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'INVALID_CSRF_TOKEN'
    });
  }

  // Generate new token for next request
  req.session.csrfToken = generateToken();
  next();
};

// Generate CSRF token for forms
const csrfToken = (req, res, next) => {
  // Only set token if it doesn't exist
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken();
  }
  
  // Make token available to views
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

module.exports = {
  csrfProtection,
  csrfToken
};
