import mongoose from 'mongoose';

/**
 * Reaction Types - Facebook style
 * Stored as enum for DB efficiency
 */
export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

export const REACTION_EMOJI = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡',
};

/**
 * Reaction Schema
 *
 * Design: Separate collection instead of embedded array
 * Why?
 * - Posts can have thousands of reactions
 * - Efficient aggregation by type
 * - Easy to query "did user react?"
 * - Supports reactions on posts, comments, replies
 *
 * target: { type: 'post' | 'comment' | 'reply', id: ObjectId }
 */
const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Polymorphic target
    targetType: {
      type: String,
      enum: ['post', 'comment', 'reply'],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    reactionType: {
      type: String,
      enum: REACTION_TYPES,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound index: One reaction per user per target
 * This enforces uniqueness at DB level
 */
reactionSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });
reactionSchema.index({ targetType: 1, targetId: 1 }); // For aggregation

const Reaction = mongoose.model('Reaction', reactionSchema);
export default Reaction;
