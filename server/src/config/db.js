'use strict';

const mongoose = require('mongoose');

/**
 * Connects to MongoDB Atlas using the MONGODB_URI environment variable.
 * Must be called before the HTTP server starts accepting requests.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not defined. ' +
        'Add it to server/.env before starting the backend.'
    );
  }

  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB Atlas connected successfully.');
  } catch (err) {
    // Log a descriptive message without exposing the connection string.
    console.error('❌ MongoDB connection failed:', err.message);
    throw err; // Re-throw so server.js can handle shutdown.
  }
}

module.exports = connectDB;
