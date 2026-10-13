'use strict';

const mongoose = require('mongoose');

const ROLES = ['owner', 'member'];

const membershipSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: 'Role must be one of: ' + ROLES.join(', '),
      },
      required: [true, 'Role is required'],
    },
    joinedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    // No timestamps: joinedAt covers what we need.
    _id: true,
  }
);

// Enforce one membership record per user per room.
membershipSchema.index({ room: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);
