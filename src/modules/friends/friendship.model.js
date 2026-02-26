import mongoose from 'mongoose';

/**
 * Friendship Model
 *
 * Indexes:
 *  - Compound unique: (requester, recipient) → দুজনের মধ্যে একটিই record
 *  - status index → filter query দ্রুত করে
 */
const friendshipSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

// একটি pair-এর জন্য একটিই friendship থাকবে
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export default mongoose.model('Friendship', friendshipSchema);