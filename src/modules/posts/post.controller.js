import postService from './post.service.js';

/**
 * Post Controller (Updated)
 *
 * New methods:
 * - addReply
 * - deleteReply
 *
 * Removed:
 * - toggleLike (replaced by ReactionController)
 */
class PostController {
  /**
   * @desc    Create new post
   * @route   POST /api/posts
   * @access  Private
   */
  async createPost(req, res, next) {
    try {
      const post = await postService.createPost(req.user._id, req.body);
      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get timeline posts (friends + self)
   * @route   GET /api/posts/timeline
   * @access  Private
   */
  async getTimeline(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const result = await postService.getTimeline(req.user._id, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get single post
   * @route   GET /api/posts/:id
   * @access  Private
   */
  async getPost(req, res, next) {
    try {
      const post = await postService.getPostById(req.params.id);
      res.status(200).json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get user's posts
   * @route   GET /api/posts/user/:userId
   * @access  Private
   */
  async getUserPosts(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const result = await postService.getUserPosts(req.params.userId, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get global feed (all users)
   * @route   GET /api/posts/feed
   * @access  Private
   */
  async getGlobalFeed(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const result = await postService.getGlobalFeed(page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update post
   * @route   PUT /api/posts/:id
   * @access  Private
   */
  async updatePost(req, res, next) {
    try {
      const post = await postService.updatePost(req.params.id, req.user._id, req.body);
      res.status(200).json({
        success: true,
        message: 'Post updated successfully',
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete post
   * @route   DELETE /api/posts/:id
   * @access  Private
   */
  async deletePost(req, res, next) {
    try {
      await postService.deletePost(req.params.id, req.user._id, req.user.role);
      res.status(200).json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Add comment
   * @route   POST /api/posts/:id/comment
   * @access  Private
   */
  async addComment(req, res, next) {
    try {
      const result = await postService.addComment(req.params.id, req.user._id, req.body.text);
      res.status(201).json({
        success: true,
        message: 'Comment added successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete comment
   * @route   DELETE /api/posts/:id/comment/:commentId
   * @access  Private
   */
  async deleteComment(req, res, next) {
    try {
      const post = await postService.deleteComment(
        req.params.id,
        req.params.commentId,
        req.user._id
      );
      res.status(200).json({
        success: true,
        message: 'Comment deleted successfully',
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Add reply to a comment
   * @route   POST /api/posts/:id/comment/:commentId/reply
   * @access  Private
   */
  async addReply(req, res, next) {
    try {
      const result = await postService.addReply(
        req.params.id,
        req.params.commentId,
        req.user._id,
        req.body.text
      );
      res.status(201).json({
        success: true,
        message: 'Reply added successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete reply
   * @route   DELETE /api/posts/:id/comment/:commentId/reply/:replyId
   * @access  Private
   */
  async deleteReply(req, res, next) {
    try {
      const post = await postService.deleteReply(
        req.params.id,
        req.params.commentId,
        req.params.replyId,
        req.user._id
      );
      res.status(200).json({
        success: true,
        message: 'Reply deleted successfully',
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }

 async incrementView (req, res, next) {
  try {
    const viewCount = await postService.incrementView(req.params.id, req.user?._id);
    res.status(200).json({ success: true, data: { viewCount } });
  } catch (err) { next(err); }
};
}

export default new PostController();