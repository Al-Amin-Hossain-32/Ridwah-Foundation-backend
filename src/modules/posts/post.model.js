import mongoose from 'mongoose';

/**
 * Updated Post Schema
 *
 * Changes from original:
 * 1. Removed embedded likes (now in Reaction collection)
 * 2. Comments support nested replies (max 1 level deep - Facebook style)
 * 3. reactionCount cached for performance (updated via service)
 */

// Reply sub-schema (nested inside comment)
const replySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Reply cannot exceed 500 characters'],
    },
    // Cached reaction counts for performance
    reactionCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    totalReactions: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Comment sub-schema
const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    // Nested replies (Facebook allows 1 level)
    replies: [replySchema],
    // Cached reaction counts
    reactionCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    totalReactions: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [5000, 'Post content cannot exceed 5000 characters'],
    },

    images: {
      type: [String],
      validate: {
        validator: (images) => images.length <= 5,
        message: 'Cannot upload more than 5 images',
      },
      default: [],
    },

    comments: [commentSchema],

    /**
     * Cached reaction counts for O(1) feed reads
     * Structure: { like: 5, love: 3, haha: 1, ... }
     * Updated atomically when reactions change
     */
    reactionCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    totalReactions: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

postSchema.virtual('commentCount').get(function () {
  return this.comments.length;
});

postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

const Post = mongoose.model('Post', postSchema);
export default Post;
