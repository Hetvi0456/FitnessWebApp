'use strict';

const jwt = require('jsonwebtoken');

/**
 * Middleware that reads the auth_token cookie, verifies it, and sets req.user.
 * Returns 401 on any failure without leaking internal details.
 */
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Session expired or invalid.' });
  }
}

module.exports = requireAuth;
