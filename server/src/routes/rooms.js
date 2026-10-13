'use strict';

const express = require('express');
const mongoose = require('mongoose');

const requireAuth = require('../middleware/requireAuth');
const Room = require('../models/Room');
const Membership = require('../models/Membership');
const Challenge = require('../models/Challenge');

const router = express.Router();

// All routes in this file require authentication.
router.use(requireAuth);

// ── Shared validation helpers ─────────────────────────────────────────────

const ACTIVITY_TYPES = ['running', 'cycling', 'walking', 'swimming', 'strength', 'yoga', 'other'];

/**
 * Validate and normalise a room + challenge request body.
 * Returns { error, status } on failure or { roomData, challengeData } on success.
 */
function validateCreateRoom(body) {
  const { name, description, challenge } = body ?? {};

  // ── Room fields ──
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { error: 'Room name is required.', status: 400 };
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 80) {
    return { error: 'Room name must be 80 characters or fewer.', status: 400 };
  }

  let trimmedDesc = '';
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return { error: 'Description must be a string.', status: 400 };
    }
    trimmedDesc = description.trim();
    if (trimmedDesc.length > 500) {
      return { error: 'Description must be 500 characters or fewer.', status: 400 };
    }
  }

  // ── Challenge fields ──
  if (!challenge || typeof challenge !== 'object' || Array.isArray(challenge)) {
    return { error: 'An initial challenge object is required.', status: 400 };
  }

  const { title, instructions, activityType, startDate, endDate } = challenge;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { error: 'Challenge title is required.', status: 400 };
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length > 120) {
    return { error: 'Challenge title must be 120 characters or fewer.', status: 400 };
  }

  if (!instructions || typeof instructions !== 'string' || !instructions.trim()) {
    return { error: 'Challenge instructions are required.', status: 400 };
  }
  const trimmedInstructions = instructions.trim();
  if (trimmedInstructions.length > 2000) {
    return { error: 'Challenge instructions must be 2000 characters or fewer.', status: 400 };
  }

  if (!activityType || !ACTIVITY_TYPES.includes(activityType)) {
    return {
      error: 'activityType must be one of: ' + ACTIVITY_TYPES.join(', ') + '.',
      status: 400,
    };
  }

  // Optional date validation
  let parsedStart = null;
  let parsedEnd = null;

  if (startDate !== undefined && startDate !== null) {
    parsedStart = new Date(startDate);
    if (isNaN(parsedStart.getTime())) {
      return { error: 'startDate is not a valid date.', status: 400 };
    }
  }

  if (endDate !== undefined && endDate !== null) {
    parsedEnd = new Date(endDate);
    if (isNaN(parsedEnd.getTime())) {
      return { error: 'endDate is not a valid date.', status: 400 };
    }
  }

  if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
    return { error: 'endDate must be on or after startDate.', status: 400 };
  }

  return {
    roomData: { name: trimmedName, description: trimmedDesc },
    challengeData: {
      title: trimmedTitle,
      instructions: trimmedInstructions,
      activityType,
      startDate: parsedStart,
      endDate: parsedEnd,
    },
  };
}

// ── POST /api/rooms ───────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  if (!req.user || !req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
    return res.status(401).json({ success: false, message: 'Invalid authentication.' });
  }

  const validation = validateCreateRoom(req.body);
  if (validation.error) {
    return res.status(validation.status).json({ success: false, message: validation.error });
  }

  const { roomData, challengeData } = validation;
  const ownerId = new mongoose.Types.ObjectId(req.user.id);

  // Use a transaction — Atlas replica set is confirmed.
  const session = await mongoose.startSession();

  try {
    let room, membership, challenge;

    await session.withTransaction(async () => {
      // 1. Create the room
      [room] = await Room.create([{ ...roomData, owner: ownerId }], { session });

      // 2. Create the owner membership
      [membership] = await Membership.create(
        [{ room: room._id, user: ownerId, role: 'owner' }],
        { session }
      );

      // 3. Create the initial challenge
      [challenge] = await Challenge.create(
        [{ ...challengeData, room: room._id }],
        { session }
      );
    });

    return res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      room: {
        id: room._id,
        name: room.name,
        description: room.description,
        owner: room.owner,
        createdAt: room.createdAt,
      },
      membership: {
        role: membership.role,
        joinedAt: membership.joinedAt,
      },
      challenge: {
        id: challenge._id,
        title: challenge.title,
        instructions: challenge.instructions,
        activityType: challenge.activityType,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        createdAt: challenge.createdAt,
      },
    });
  } catch (err) {
    // Validation errors surface here when using session.withTransaction.
    if (err.name === 'ValidationError' && err.errors) {
      const first = Object.values(err.errors)[0];
      return res.status(400).json({ success: false, message: first?.message || 'Validation failed.' });
    }
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A duplicate record already exists.' });
    }
    console.error('Create room error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to create room. Please try again.' });
  } finally {
    await session.endSession();
  }
});

// ── GET /api/rooms ────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  if (!req.user || !req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
    return res.status(401).json({ success: false, message: 'Invalid authentication.' });
  }

  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Find all memberships for this user, populate room details.
    const memberships = await Membership.find({ user: userId })
      .populate({
        path: 'room',
        select: 'name description owner createdAt', // never select invite fields
      })
      .sort({ joinedAt: -1 })
      .lean();

    // Filter out any membership whose room was deleted (populate returns null).
    const validMemberships = memberships.filter((m) => m.room);

    // If user belongs to no rooms, return early.
    if (validMemberships.length === 0) {
      return res.status(200).json({ success: true, rooms: [] });
    }

    // Gather room IDs for batch aggregations.
    const roomIds = validMemberships.map((m) => m.room._id);

    // Member counts per room.
    const memberCountAgg = await Membership.aggregate([
      { $match: { room: { $in: roomIds } } },
      { $group: { _id: '$room', count: { $sum: 1 } } },
    ]);
    const memberCountMap = Object.fromEntries(memberCountAgg.map((r) => [r._id.toString(), r.count]));

    // Challenge counts per room.
    const challengeCountAgg = await Challenge.aggregate([
      { $match: { room: { $in: roomIds } } },
      { $group: { _id: '$room', count: { $sum: 1 } } },
    ]);
    const challengeCountMap = Object.fromEntries(challengeCountAgg.map((r) => [r._id.toString(), r.count]));

    const rooms = validMemberships.map((m) => {
      const roomId = m.room._id.toString();
      return {
        id: m.room._id,
        name: m.room.name,
        description: m.room.description,
        owner: m.room.owner,
        createdAt: m.room.createdAt,
        role: m.role,
        joinedAt: m.joinedAt,
        memberCount: memberCountMap[roomId] ?? 1,
        challengeCount: challengeCountMap[roomId] ?? 0,
      };
    });

    return res.status(200).json({ success: true, rooms });
  } catch (err) {
    console.error('List rooms error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve rooms.' });
  }
});

module.exports = router;
