'use strict';

require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB Atlas first; fail fast if it cannot connect.
    await connectDB();

    // Only start accepting HTTP requests after DB is ready.
    app.listen(PORT, () => {
      console.log('╔══════════════════════════════════════════╗');
      console.log('║  Fitness Challenge API                   ║');
      console.log(`║  Server running on http://localhost:${PORT} ║`);
      console.log('╚══════════════════════════════════════════╝');
    });
  } catch (err) {
    console.error('🚨 Server failed to start:', err.message);
    process.exit(1);
  }
}

startServer();
