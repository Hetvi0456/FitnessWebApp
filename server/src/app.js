'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const authRouter = require('./routes/auth');

const app = express();

// ── CORS — allow frontend dev origin with credentials ─────────────────────
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. curl, Postman) or whitelisted origins
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true, // Required for cookies
  })
);

// ── Core middleware ───────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ── Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/health
 *
 * readyState values (mongoose):
 *   0 = disconnected | 1 = connected | 2 = connecting | 3 = disconnecting
 */
app.get('/api/health', (_req, res) => {
  const readyState = mongoose.connection.readyState;
  const isConnected = readyState === 1;

  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const dbStatus = dbStatusMap[readyState] ?? 'unknown';

  if (isConnected) {
    return res.status(200).json({
      success: true,
      message: 'Fitness Challenge API is running!',
      database: { status: dbStatus },
    });
  }

  return res.status(503).json({
    success: false,
    message: 'Fitness Challenge API is running, but the database is not connected.',
    database: { status: dbStatus },
  });
});

app.use('/api/auth', authRouter);

module.exports = app;
