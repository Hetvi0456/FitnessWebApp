'use strict';

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────

/**
 * GET /api/health
 *
 * readyState values (mongoose):
 *   0 = disconnected
 *   1 = connected
 *   2 = connecting
 *   3 = disconnecting
 */
app.get('/api/health', (_req, res) => {
  const readyState = mongoose.connection.readyState;
  const isConnected = readyState === 1;

  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbStatus = dbStatusMap[readyState] ?? 'unknown';

  if (isConnected) {
    return res.status(200).json({
      success: true,
      message: 'Fitness Challenge API is running!',
      database: {
        status: dbStatus,
      },
    });
  }

  return res.status(503).json({
    success: false,
    message: 'Fitness Challenge API is running, but the database is not connected.',
    database: {
      status: dbStatus,
    },
  });
});

module.exports = app;
