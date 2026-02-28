import mongoose from 'mongoose';

/**
 * Notification Schema
 *
 * Types:
 * - post_reaction: Someone reacted to your post
 * - comment_reaction: Someone reacted to your comment
 * - reply_reaction: Someone reacted to your reply
 * - comment: Someone commented on your post
 * - reply: Someone replied to your comment
 * - mention: Someone mentioned you
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    type: {
      type: String,
      enum: [
        'post_reaction',
        'comment_reaction',
        'reply_reaction',
        'comment',
        'reply',
        'mention',
      ],
      required: true,
    },

    // Reference to the related content
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
    commentId: mongoose.Schema.Types.ObjectId,
    replyId: mongoose.Schema.Types.ObjectId,

    reactionType: String, // 'like', 'love', etc.

    // Human readable message
    message: {
      type: String,
      required: true,
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: Date,
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Auto-delete old notifications after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
