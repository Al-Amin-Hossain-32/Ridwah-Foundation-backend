import Post from './post.model.js';

import User from '../auth/user.model.js';
import notificationService from '../notification/notification.service.js';
import mongoose from 'mongoose';
import { getIO } from '../../config/socket.js';

/**
 * Updated Post Service
 *
 * Key changes:
 * 1. Removed like methods → use ReactionService
 * 2. Added nested reply support
 * 3. All mutations emit socket events
 * 4. Notification on comment/reply
 */
class PostService {
  // ─── Populate Helpers ────────────────────────────────────────────────────────

  _defaultPopulate(query) {
    return query
      .populate('author', 'name profilePicture role')
      .populate('comments.user', 'name profilePicture')
      .populate('comments.replies.user', 'name profilePicture');
  }

  // ─── Feed / Timeline ─────────────────────────────────────────────────────────

  async createPost(userId, postData) {
    const { content, images = [] } = postData;
    if (!content?.trim()) {
      const error = new Error('Post content is required');
      error.statusCode = 400;
      throw error;
    }
    if (images.length > 5) {
      const error = new Error('Cannot upload more than 5 images');
      error.statusCode = 400;
      throw error;
    }

    const raw = await Post.create({ author: userId, content: content.trim(), images });

    // একটাই query — populated data সব জায়গায় use করা হবে
    const populated = await this._defaultPopulate(Post.findById(raw._id));

    // Socket emit — সবাইকে (global feed + timeline দুটোতেই কাজ করবে)
    try {
      getIO().emit('newPost', populated.toObject());
    } catch (_) {}

    return populated;
  }

  async getGlobalFeed(page = 1, limit = 20) {
    const [posts, total] = await Promise.all([
      this._defaultPopulate(
        Post.find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip((page - 1) * limit)
      ),
      Post.countDocuments(),
    ]);

    return {
      posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getTimeline(userId, page = 1, limit = 20) {
    const Friendship = mongoose.model('Friendship');
    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: 'accepted' },
        { recipient: userId, status: 'accepted' },
      ],
    });

    const friendIds = friendships.map((f) =>
      f.requester.toString() === userId.toString() ? f.recipient : f.requester
    );

    const filter = { author: { $in: [userId, ...friendIds] } };

    const [posts, total] = await Promise.all([
      this._defaultPopulate(
        Post.find(filter).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit)
      ),
      Post.countDocuments(filter),
    ]);

    return {
      posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getPostById(postId) {
    const post = await this._defaultPopulate(Post.findById(postId));
    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }
    return post;
  }
 // ─── View Count ───────────────────────────────────────────────────────────────

  /**
   * View count বাড়ানো
   * - একই user একই post বারবার view করলে count বাড়বে না (Set দিয়ে track)
   * - Anonymous view-ও count হবে (userId null হলে)
   * - Realtime socket emit করবে
   */
  async incrementView(postId, userId) {
    const post = await Post.findById(postId).select('viewCount viewedBy author');
    if (!post) return null;

    // নিজের post view করলে count হবে না
    if (userId && post.author.toString() === userId.toString()) return null;

    // Already viewed check (logged in user)
    if (userId) {
      const alreadyViewed = post.viewedBy?.some((id) => id.toString() === userId.toString());
      if (alreadyViewed) return null;
      post.viewedBy.push(userId);
    }

    post.viewCount = (post.viewCount || 0) + 1;
    await post.save();

    // Realtime — সবাইকে নতুন view count জানাও
    try {
      getIO().emit('postViewUpdated', { postId, viewCount: post.viewCount });
    } catch (_) {}

    return post.viewCount;
  }
  async getUserPosts(userId, page = 1, limit = 20) {
    const [posts, total] = await Promise.all([
      this._defaultPopulate(
        Post.find({ author: userId }).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit)
      ),
      Post.countDocuments({ author: userId }),
    ]);

    return {
      posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // ─── Post CRUD ───────────────────────────────────────────────────────────────

  async updatePost(postId, userId, updateData) {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }
    if (post.author.toString() !== userId.toString()) {
      const error = new Error('You can only edit your own posts');
      error.statusCode = 403;
      throw error;
    }
    if (updateData.content) post.content = updateData.content.trim();
    await post.save();

    const updated = await this._defaultPopulate(Post.findById(postId));

    try {
      getIO().emit('postUpdated', { postId, content: updated.content });
    } catch (_) {}

    return updated;
  }

  async deletePost(postId, userId, userRole) {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    const isAuthor = post.author.toString() === userId.toString();
    const isAdmin = userRole === 'admin';

    if (!isAuthor && !isAdmin) {
      const error = new Error('You can only delete your own posts');
      error.statusCode = 403;
      throw error;
    }

    await post.deleteOne();

    try {
      getIO().emit('postDeleted', { postId });
    } catch (_) {}
  }

  // ─── Comments ────────────────────────────────────────────────────────────────

  /**
   * Add comment with realtime emit + notification
   */
  async addComment(postId, userId, text) {
    if (!text?.trim()) {
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

    post.comments.push({ user: userId, text: text.trim() });
    await post.save();

    // Get full populated post for response
    const updated = await this._defaultPopulate(Post.findById(postId));
    const newComment = updated.comments[updated.comments.length - 1];

    // Realtime: emit to everyone
    try {
      getIO().emit('newComment', { postId, comment: newComment });
    } catch (_) {}

    // Notification: only if commenter ≠ post author
    if (post.author.toString() !== userId.toString()) {
      const sender = await User.findById(userId).select('name');
      await notificationService.create({
        recipientId: post.author,
        senderId: userId,
        type: 'comment',
        message: `${sender.name} আপনার পোস্টে কমেন্ট করেছেন`,
        postId,
        commentId: newComment._id,
      });
    }

    return { post: updated, comment: newComment };
  }

  /**
   * Add reply to a comment
   */
  async addReply(postId, commentId, userId, text) {
    if (!text?.trim()) {
      const error = new Error('Reply text is required');
      error.statusCode = 400;
      throw error;
    }

    const post = await Post.findOne({ _id: postId, 'comments._id': commentId });
    if (!post) {
      const error = new Error('Post or comment not found');
      error.statusCode = 404;
      throw error;
    }

    const comment = post.comments.id(commentId);
    comment.replies.push({ user: userId, text: text.trim() });
    await post.save();

    const updated = await this._defaultPopulate(Post.findById(postId));
    const updatedComment = updated.comments.id(commentId);
    const newReply = updatedComment.replies[updatedComment.replies.length - 1];

    // Realtime
    try {
      getIO().emit('newReply', { postId, commentId, reply: newReply });
    } catch (_) {}

    // Notification to comment author (if different)
    if (comment.user.toString() !== userId.toString()) {
      const sender = await User.findById(userId).select('name');
      await notificationService.create({
        recipientId: comment.user,
        senderId: userId,
        type: 'reply',
        message: `${sender.name} আপনার কমেন্টে রিপ্লে করেছেন`,
        postId,
        commentId,
        replyId: newReply._id,
      });
    }

    return { comment: updatedComment, reply: newReply };
  }

  /**
   * Delete comment (author or post owner)
   */
  async deleteComment(postId, commentId, userId) {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      throw error;
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      const error = new Error('Comment not found');
      error.statusCode = 404;
      throw error;
    }

    const isCommentAuthor = comment.user.toString() === userId.toString();
    const isPostAuthor = post.author.toString() === userId.toString();

    if (!isCommentAuthor && !isPostAuthor) {
      const error = new Error('You can only delete your own comments');
      error.statusCode = 403;
      throw error;
    }

    post.comments.pull(commentId);
    await post.save();

    try {
      getIO().emit('commentDeleted', { postId, commentId });
    } catch (_) {}

    return this._defaultPopulate(Post.findById(postId));
  }

  /**
   * Delete reply
   */
  async deleteReply(postId, commentId, replyId, userId) {
    const post = await Post.findOne({ _id: postId, 'comments._id': commentId });
    if (!post) {
      const error = new Error('Post or comment not found');
      error.statusCode = 404;
      throw error;
    }

    const comment = post.comments.id(commentId);
    const reply = comment.replies.id(replyId);

    if (!reply) {
      const error = new Error('Reply not found');
      error.statusCode = 404;
      throw error;
    }

    const isReplyAuthor = reply.user.toString() === userId.toString();
    const isPostAuthor = post.author.toString() === userId.toString();

    if (!isReplyAuthor && !isPostAuthor) {
      const error = new Error('You can only delete your own replies');
      error.statusCode = 403;
      throw error;
    }

    comment.replies.pull(replyId);
    await post.save();

    try {
      getIO().emit('replyDeleted', { postId, commentId, replyId });
    } catch (_) {}

    return this._defaultPopulate(Post.findById(postId));
  }
}

export default new PostService();