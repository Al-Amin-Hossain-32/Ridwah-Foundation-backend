import mongoose from 'mongoose';

/**
 * Message Schema
 * 
 * Features:
 * - Soft delete (database এ থাকবে)
 * - Edit with history
 * - Time limits (5 minutes)
 * - Admin can see everything
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },

    // ✅ Soft Delete Fields
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    deletedAt: {
      type: Date,
    },

    deleteType: {
      type: String,
      enum: ['for_me', 'for_everyone'],
      // "for_me": শুধু sender এর কাছে hidden
      // "for_everyone": সবার কাছে "[deleted]" দেখাবে
    },

    // ✅ Edit Fields
    isEdited: {
      type: Boolean,
      default: false,
    },

    editHistory: [
      {
        content: {
          type: String,
          required: true,
        },
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    lastEditedAt: {
      type: Date,
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ conversation: 1, isDeleted: 1 });

/**
 * Instance Method: Can edit?
 * 
 * Rules:
 * - Only sender can edit
 * - Within 5 minutes
 * - Not deleted
 */
messageSchema.methods.canEdit = function (userId) {
  // Not the sender
  if (this.sender.toString() !== userId.toString()) {
    return { 
      allowed: false, 
      reason: 'Only sender can edit their own messages' 
    };
  }

  // Already deleted
  if (this.isDeleted) {
    return { 
      allowed: false, 
      reason: 'Cannot edit deleted messages' 
    };
  }

  // Check time limit (5 minutes = 300,000 ms)
  const timeSinceSent = Date.now() - this.createdAt.getTime();
  const fiveMinutes = 5 * 60 * 1000;

  if (timeSinceSent > fiveMinutes) {
    return { 
      allowed: false, 
      reason: 'Edit time limit expired (5 minutes)' 
    };
  }

  return { allowed: true };
};

/**
 * Instance Method: Can delete?
 * 
 * Rules:
 * - Only sender can delete
 * - Within 5 minutes: "delete for everyone"
 * - After 5 minutes: "delete for me" only
 */
messageSchema.methods.canDelete = function (userId) {
  // Not the sender
  if (this.sender.toString() !== userId.toString()) {
    return { 
      allowed: false, 
      reason: 'Only sender can delete their own messages' 
    };
  }

  // Already deleted
  if (this.isDeleted) {
    return { 
      allowed: false, 
      reason: 'Message already deleted' 
    };
  }

  // Check time limit
  const timeSinceSent = Date.now() - this.createdAt.getTime();
  const fiveMinutes = 5 * 60 * 1000;

  const canDeleteForEveryone = timeSinceSent <= fiveMinutes;

  return {
    allowed: true,
    canDeleteForEveryone,
    onlyForMe: !canDeleteForEveryone,
  };
};

/**
 * Virtual: Display Content
 * 
 * Returns appropriate content based on delete status
 */
messageSchema.virtual('displayContent').get(function () {
  if (this.isDeleted && this.deleteType === 'for_everyone') {
    return '🚫 This message was deleted';
  }
  return this.content;
});

/**
 * Ensure virtuals in JSON
 */
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

const Message = mongoose.model('Message', messageSchema);

export default Message;