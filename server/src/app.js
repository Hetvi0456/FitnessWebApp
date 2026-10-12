'use strict';

const express = require('express');
const cors = require('cors');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Fitness Challenge API is running!',
  });
});

module.exports = app;
