import mongoose from 'mongoose';

/**
 * Post Schema
 * 
 * Design Decisions:
 * 1. Embedded Comments - Fast retrieval, typically < 50 comments per post
 * 2. Likes as Array - Quick count, prevent duplicates with $addToSet
 * 3. Images as URLs - Already uploaded to Cloudinary
 * 4. Author reference - Populate for display
 * 
 * When to use vs when not to:
 * - Good for: Social feeds, blogs, forums
 * - Not for: High-volume comments (use separate Comment model)
 */
const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Post must have an author'],
      index: true, // Index for fast author queries
    },

    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      maxlength: [5000, 'Post content cannot exceed 5000 characters'],
    },

    images: {
      type: [String], // Array of Cloudinary URLs
      validate: {
        validator: function (images) {
          return images.length <= 5; // Max 5 images
        },
        message: 'Cannot upload more than 5 images per post',
      },
      default: [],
    },

    likes: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
      // Why array?
      // - Quick .length for count
      // - $addToSet prevents duplicates
      // - Simple toggle: $addToSet or $pull
    },

    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        text: {
          type: String,
          required: [true, 'Comment text is required'],
          trim: true,
          maxlength: [500, 'Comment cannot exceed 500 characters'],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Why embedded?
    // - Comments always shown with post
    // - Typical post has < 50 comments
    // - Faster than JOIN query
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

/**
 * Indexes for Performance
 * 
 * Why these indexes?
 * 1. author - Get all posts by user
 * 2. createdAt (desc) - Timeline sorting (newest first)
 * 3. Compound [author, createdAt] - User's posts sorted
 */
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

/**
 * Virtual: Like Count
 * 
 * Why virtual?
 * - Calculate on-the-fly
 * - No need to store separately
 * - Always accurate
 */
postSchema.virtual('likeCount').get(function () {
  return this.likes.length;
});

/**
 * Virtual: Comment Count
 */
postSchema.virtual('commentCount').get(function () {
  return this.comments.length;
});

/**
 * Method: Check if user liked this post
 * 
 * Usage: post.isLikedBy(userId)
 */
postSchema.methods.isLikedBy = function (userId) {
  return this.likes.some((like) => like.toString() === userId.toString());
};

/**
 * Ensure virtuals are included in JSON
 */
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

const Post = mongoose.model('Post', postSchema);

export default Post;