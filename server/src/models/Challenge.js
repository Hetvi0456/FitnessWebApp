'use strict';

const mongoose = require('mongoose');

const ACTIVITY_TYPES = ['running', 'cycling', 'walking', 'swimming', 'strength', 'yoga', 'other'];

const challengeSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Challenge title is required'],
      trim: true,
      maxlength: [120, 'Title must be 120 characters or fewer'],
    },
    instructions: {
      type: String,
      required: [true, 'Instructions are required'],
      trim: true,
      maxlength: [2000, 'Instructions must be 2000 characters or fewer'],
    },
    activityType: {
      type: String,
      enum: {
        values: ACTIVITY_TYPES,
        message: 'activityType must be one of: ' + ACTIVITY_TYPES.join(', '),
      },
      required: [true, 'Activity type is required'],
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
      validate: {
        validator: function (value) {
          // Only validate if both dates are present.
          if (!value || !this.startDate) return true;
          return value >= this.startDate;
        },
        message: 'endDate must be on or after startDate',
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Challenge', challengeSchema);
