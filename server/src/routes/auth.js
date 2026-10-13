'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────────────────

const COOKIE_NAME = 'auth_token';
const TOKEN_EXPIRES_IN = '7d';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

function issueTokenCookie(res, user) {
  const token = jwt.sign(
    { sub: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearTokenCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

// ── POST /api/auth/register ────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { displayName, email, password } = req.body ?? {};

  // Validate presence
  if (!displayName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'displayName, email, and password are all required.',
    });
  }

  // Type check
  if (
    typeof displayName !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    return res.status(400).json({ success: false, message: 'Invalid input types.' });
  }

  const trimmedName = displayName.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!trimmedName || trimmedName.length > 60) {
    return res.status(400).json({
      success: false,
      message: 'Display name must be between 1 and 60 characters.',
    });
  }

  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      displayName: trimmedName,
      email: normalizedEmail,
      passwordHash,
    });

    issueTokenCookie(res, user);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: user.toSafeObject(),
    });
  } catch (err) {
    // Duplicate email — MongoDB error code 11000
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }
    console.error('Register error:', err.message);
    return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    // Use constant-time compare even when user not found to avoid timing attacks
    const passwordMatch = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXX');

    if (!user || !passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    issueTokenCookie(res, user);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    console.error('Me error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not retrieve profile.' });
  }
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────

router.post('/logout', (req, res) => {
  clearTokenCookie(res);
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
