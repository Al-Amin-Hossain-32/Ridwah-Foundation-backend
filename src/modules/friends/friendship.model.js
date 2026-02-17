import mongoose from 'mongoose';

/**
 * Friendship Schema
 * 
 * Design:
 * - Unidirectional storage (one document per friendship)
 * - Bidirectional query (query both directions)
 * - Status: pending, accepted, rejected
 * 
 * Why this design?
 * - Saves storage (no duplicate friendships)
 * - Clear state (who requested, who accepted)
 * - Easy to query pending requests
 */
const friendshipSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'rejected'],
        message: '{VALUE} is not a valid status',
      },
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound Index: Prevent duplicate friend requests
 * 
 * Why?
 * - User A can't send multiple requests to User B
 * - Ensures data integrity
 */
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

/**
 * Index for queries
 * - Get all pending requests for a user
 * - Get all accepted friendships
 */
friendshipSchema.index({ recipient: 1, status: 1 });
friendshipSchema.index({ requester: 1, status: 1 });

/**
 * Static Method: Check if two users are friends
 * 
 * Usage: await Friendship.areFriends(userId1, userId2)
 */
friendshipSchema.statics.areFriends = async function (userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2, status: 'accepted' },
      { requester: userId2, recipient: userId1, status: 'accepted' },
    ],
  });

  return !!friendship;
};

/**
 * Static Method: Get friendship status between two users
 * 
 * Returns: null | 'pending' | 'accepted' | 'rejected'
 */
friendshipSchema.statics.getStatus = async function (userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
  });

  return friendship ? friendship.status : null;
};

const Friendship = mongoose.model('Friendship', friendshipSchema);

export default Friendship;