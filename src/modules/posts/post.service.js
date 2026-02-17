import Post from './post.model.js';
import User from '../auth/user.model.js';
import mongoose from 'mongoose';

/**
 * Post Service Layer
 * 
 * Architecture:
 * Controller → Service → Model → Database
 */

class PostService {
  /**
   * Create new post
   * 
   * @param {string} userId - Author ID
   * @param {Object} postData - { content, images }
   * @returns {Promise<Object>}
   */
  async createPost(userId, postData) {
    const { content, images = [] } = postData;

    // Validate content
    if (!content || content.trim().length === 0) {
      const error = new Error('Post content is required');
      error.statusCode = 400;
      throw error;
    }

    // Validate images array
    if (images.length > 5) {
      const error = new Error('Cannot upload more than 5 images');
      error.statusCode = 400;
      throw error;
    }

    // Create post
    const post = await Post.create({
      author: userId,
      content: content.trim(),
      images,
    });

    // Populate author details
    await post.populate('author', 'name profilePicture');

    return post;
  }

  /**
   * Get timeline posts
   * 
   * Logic:
   * 1. Get user's friends
   * 2. Get posts from user + friends
   * 3. Sort by newest first
   * 4. Paginate results
   * 
   * @param {string} userId - Current user
   * @param {number} page - Page number
   * @param {number} limit - Posts per page
   * @returns {Promise<Object>}
   */
  async getTimeline(userId, page = 1, limit = 20) {
    // Import Friendship model here to avoid circular dependency
    const Friendship = mongoose.model('Friendship');

    // Step 1: Get user's friends
    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: 'accepted' },
        { recipient: userId, status: 'accepted' },
      ],
    });

    // Extract friend IDs
    const friendIds = friendships.map((f) =>
      f.requester.toString() === userId.toString()
        ? f.recipient
        : f.requester
    );

    console.log('📊 Timeline query for user:', userId);
    console.log('   Friends count:', friendIds.length);

    // Step 2: Get posts from user + friends
    const posts = await Post.find({
      author: { $in: [userId, ...friendIds] },
    })
      .populate('author', 'name profilePicture role')
      .populate('comments.user', 'name profilePicture')
      .sort({ createdAt: -1 }) // Newest first
      .limit(limit)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Post.countDocuments({
      author: { $in: [userId, ...friendIds] },
    });

    console.log('   Posts found:', posts.length);

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single post by ID
   * 
   * @param {string} postId
   * @returns {Promise<Object>}
   */
  async getPostById(postId) {
    const post = await Post.findById(postId)
      .populate('author', 'name profilePicture role')
      .populate('comments.user', 'name profilePicture');

    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    return post;
  }

  /**
   * Get user's posts
   * 
   * @param {string} userId
   * @param {number} page
   * @param {number} limit
   * @returns {Promise<Object>}
   */
  async getUserPosts(userId, page = 1, limit = 20) {
    const posts = await Post.find({ author: userId })
      .populate('author', 'name profilePicture')
      .populate('comments.user', 'name profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Post.countDocuments({ author: userId });

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update post
   * 
   * Security: Only author can update
   * 
   * @param {string} postId
   * @param {string} userId - Current user
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updatePost(postId, userId, updateData) {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    // Check ownership
    if (post.author.toString() !== userId.toString()) {
      const error = new Error('You can only edit your own posts');
      error.statusCode = 403;
      throw error;
    }

    // Update allowed fields
    if (updateData.content) {
      post.content = updateData.content.trim();
    }

    // Note: Images cannot be updated (user must delete and create new post)
    // Why? Simpler logic, prevents abuse

    await post.save();

    await post.populate('author', 'name profilePicture');
    await post.populate('comments.user', 'name profilePicture');

    return post;
  }

  /**
   * Delete post
   * 
   * Security: Only author or admin can delete
   * 
   * @param {string} postId
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<void>}
   */
  async deletePost(postId, userId, userRole) {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    // Check permission: author or admin
    const isAuthor = post.author.toString() === userId.toString();
    const isAdmin = userRole === 'admin';

    if (!isAuthor && !isAdmin) {
      const error = new Error('You can only delete your own posts');
      error.statusCode = 403;
      throw error;
    }

    await post.deleteOne();

    console.log('🗑️  Post deleted:', postId);
  }

  /**
   * Like/Unlike post
   * 
   * Toggle logic:
   * - If already liked → Unlike (remove from array)
   * - If not liked → Like (add to array)
   * 
   * @param {string} postId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async toggleLike(postId, userId) {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if user already liked
    const alreadyLiked = post.likes.some(
      (like) => like.toString() === userId.toString()
    );

    if (alreadyLiked) {
      // Unlike: Remove from array
      post.likes = post.likes.filter(
        (like) => like.toString() !== userId.toString()
      );
    } else {
      // Like: Add to array
      post.likes.push(userId);
    }

    await post.save();

    await post.populate('author', 'name profilePicture');

    return {
      post,
      action: alreadyLiked ? 'unliked' : 'liked',
      likeCount: post.likes.length,
    };
  }

  /**
   * Add comment to post
   * 
   * @param {string} postId
   * @param {string} userId
   * @param {string} text
   * @returns {Promise<Object>}
   */
  async addComment(postId, userId, text) {
    if (!text || text.trim().length === 0) {
      const error = new Error('Comment text is required');
      error.statusCode = 400;
      throw error;
    }

    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    // Add comment to array
    post.comments.push({
      user: userId,
      text: text.trim(),
      createdAt: new Date(),
    });

    await post.save();

    // Populate for response
    await post.populate('author', 'name profilePicture');
    await post.populate('comments.user', 'name profilePicture');

    // Get the newly added comment
    const newComment = post.comments[post.comments.length - 1];

    return {
      post,
      comment: newComment,
    };
  }

  /**
   * Delete comment
   * 
   * Security: Only comment author or post author can delete
   * 
   * @param {string} postId
   * @param {string} commentId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async deleteComment(postId, commentId, userId) {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    // Find comment
    const comment = post.comments.id(commentId);

    if (!comment) {
      const error = new Error('Comment not found');
      error.statusCode = 404;
      throw error;
    }

    // Check permission
    const isCommentAuthor = comment.user.toString() === userId.toString();
    const isPostAuthor = post.author.toString() === userId.toString();

    if (!isCommentAuthor && !isPostAuthor) {
      const error = new Error('You can only delete your own comments');
      error.statusCode = 403;
      throw error;
    }

    // Remove comment using pull (Mongoose subdocument method)
    post.comments.pull(commentId);

    await post.save();

    await post.populate('author', 'name profilePicture');
    await post.populate('comments.user', 'name profilePicture');

    return post;
  }
}

export default new PostService();