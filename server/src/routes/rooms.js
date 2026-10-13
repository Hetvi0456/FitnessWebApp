'use strict';

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

const requireAuth = require('../middleware/requireAuth');
const Room = require('../models/Room');
const Membership = require('../models/Membership');
const Challenge = require('../models/Challenge');

const router = express.Router();

// All routes in this file require authentication.
router.use(requireAuth);

// ── Shared validation & cryptographic helpers ─────────────────────────────

const ACTIVITY_TYPES = ['running', 'cycling', 'walking', 'swimming', 'strength', 'yoga', 'other'];

/**
 * Constant-time string comparison to defend against timing attacks.
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

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

// ── POST /api/rooms/:roomId/invite ────────────────────────────────────────

router.post('/:roomId/invite', async (req, res) => {
  if (!req.user || !req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
    return res.status(401).json({ success: false, message: 'Invalid authentication.' });
  }

  const { roomId } = req.params;
  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  try {
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Verify user is a member of the room
    const membership = await Membership.findOne({ room: roomId, user: userId });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'You must be a member of this room.' });
    }

    // Only current owner can generate or regenerate invitation
    if (!room.owner.equals(userId) || membership.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Only the room owner can manage invitations.' });
    }

    // Generate cryptographically secure random token (64 hex characters)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Parse expiration date (custom or default 7 days)
    let expiresAt = null;
    if (req.body?.expiresAt !== undefined && req.body?.expiresAt !== null) {
      const parsed = new Date(req.body.expiresAt);
      if (!isNaN(parsed.getTime())) {
        expiresAt = parsed;
      }
    } else if (req.body?.expiresInDays !== undefined && req.body?.expiresInDays !== null) {
      const days = Number(req.body.expiresInDays);
      if (!isNaN(days)) {
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
    } else {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // Store only the cryptographic hash, reset revoked status
    room.inviteTokenHash = tokenHash;
    room.inviteRevoked = false;
    room.inviteExpiresAt = expiresAt;
    await room.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/join/${roomId}?token=${token}`;

    return res.status(200).json({
      success: true,
      message: 'Invitation generated successfully.',
      inviteUrl,
      token,
      expiresAt: room.inviteExpiresAt,
    });
  } catch (err) {
    console.error('Generate invite error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to generate invitation.' });
  }
});

// ── DELETE /api/rooms/:roomId/invite ──────────────────────────────────────

router.delete('/:roomId/invite', async (req, res) => {
  if (!req.user || !req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
    return res.status(401).json({ success: false, message: 'Invalid authentication.' });
  }

  const { roomId } = req.params;
  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  try {
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Only current room owner can revoke invitation
    if (!room.owner.equals(userId)) {
      return res.status(403).json({ success: false, message: 'Only the room owner can revoke invitations.' });
    }

    room.inviteRevoked = true;
    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Invitation revoked successfully.',
    });
  } catch (err) {
    console.error('Revoke invite error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to revoke invitation.' });
  }
});

// ── POST /api/rooms/:roomId/join ──────────────────────────────────────────

router.post('/:roomId/join', async (req, res) => {
  if (!req.user || !req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
    return res.status(401).json({ success: false, message: 'Invalid authentication.' });
  }

  const { roomId } = req.params;
  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  const token = req.body?.token || req.body?.inviteToken;
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ success: false, message: 'Invitation token is required.' });
  }

  try {
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // Check if room has an invitation token hash
    if (!room.inviteTokenHash) {
      return res.status(400).json({ success: false, message: 'This room does not have an active invitation.' });
    }

    // Compare hash in constant time
    const incomingHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    if (!constantTimeCompare(room.inviteTokenHash, incomingHash)) {
      return res.status(400).json({ success: false, message: 'Invalid invitation token.' });
    }

    // Check if invitation is revoked
    if (room.inviteRevoked) {
      return res.status(400).json({ success: false, message: 'This invitation has been revoked.' });
    }

    // Check if invitation is expired
    if (room.inviteExpiresAt && new Date(room.inviteExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'This invitation has expired.' });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Check if user is already a member
    const existingMembership = await Membership.findOne({ room: roomId, user: userId });
    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: 'You are already a member of this room.',
        membership: {
          role: existingMembership.role,
          joinedAt: existingMembership.joinedAt,
        },
      });
    }

    // Create membership with role 'member' (never allow client to choose role)
    let membership;
    try {
      membership = await Membership.create({
        room: room._id,
        user: userId,
        role: 'member',
      });
    } catch (createErr) {
      // Handle concurrent duplicate-join safely (unique index error 11000)
      if (createErr.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'You are already a member of this room.',
        });
      }
      throw createErr;
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully joined the room.',
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
    });
  } catch (err) {
    console.error('Join room error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to join room.' });
  }
});

// ── POST /api/rooms/:roomId/leave ─────────────────────────────────────────

router.post('/:roomId/leave', async (req, res) => {
  if (!req.user || !req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
    return res.status(401).json({ success: false, message: 'Invalid authentication.' });
  }

  const { roomId } = req.params;
  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  const userId = new mongoose.Types.ObjectId(req.user.id);
  const session = await mongoose.startSession();

  try {
    let responseData;

    await session.withTransaction(async () => {
      // 1. Fetch room inside session
      const room = await Room.findById(roomId).session(session);
      if (!room) {
        const err = new Error('Room not found.');
        err.status = 404;
        throw err;
      }

      // 2. Fetch departing user's membership
      const userMembership = await Membership.findOne({ room: roomId, user: userId }).session(session);
      if (!userMembership) {
        const err = new Error('You are not a member of this room.');
        err.status = 403;
        throw err;
      }

      const isOwner = userMembership.role === 'owner' || room.owner.equals(userId);

      // 3. Find all memberships for this room inside session
      const allMemberships = await Membership.find({ room: roomId }).session(session);
      const remainingMembers = allMemberships.filter((m) => !m.user.equals(userId));

      if (remainingMembers.length === 0) {
        // Last member leaves: delete room and related documents consistently
        await Membership.deleteMany({ room: roomId }, { session });
        await Challenge.deleteMany({ room: roomId }, { session });
        await Room.findByIdAndDelete(roomId, { session });

        responseData = {
          success: true,
          action: 'deleted',
          message: 'You left the room. Since no members remain, the room was deleted.',
        };
      } else if (isOwner) {
        // Owner leaves with remaining members: randomly pick exactly one remaining member
        const randomIndex = Math.floor(Math.random() * remainingMembers.length);
        const newOwnerMembership = remainingMembers[randomIndex];
        const newOwnerId = newOwnerMembership.user;

        // Update Room owner
        room.owner = newOwnerId;
        await room.save({ session });

        // Update selected member's role to owner
        newOwnerMembership.role = 'owner';
        await newOwnerMembership.save({ session });

        // Delete departing owner's membership
        await Membership.findByIdAndDelete(userMembership._id, { session });

        responseData = {
          success: true,
          action: 'transferred',
          message: 'You left the room. Ownership has been transferred.',
          newOwner: newOwnerId,
        };
      } else {
        // Ordinary member leaves: owner remains unchanged
        await Membership.findByIdAndDelete(userMembership._id, { session });

        responseData = {
          success: true,
          action: 'left',
          message: 'You have successfully left the room.',
        };
      }
    });

    return res.status(200).json(responseData);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Leave room error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to leave room.' });
  } finally {
    await session.endSession();
  }
});

module.exports = router;
