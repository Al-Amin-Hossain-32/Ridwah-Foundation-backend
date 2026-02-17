import postService from './post.service.js';

/**
 * Post Controller
 * 
 * Responsibility: HTTP layer only
 * - Validate request
 * - Call service
 * - Return response
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
   * @desc    Get timeline posts
   * @route   GET /api/posts/timeline
   * @access  Private
   */
  async getTimeline(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await postService.getTimeline(req.user._id, page, limit);

      res.status(200).json({
        success: true,
        ...result,
      });
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

      res.status(200).json({
        success: true,
        data: post,
      });
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

      const result = await postService.getUserPosts(
        req.params.userId,
        page,
        limit
      );

      res.status(200).json({
        success: true,
        ...result,
      });
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
      const post = await postService.updatePost(
        req.params.id,
        req.user._id,
        req.body
      );

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
      await postService.deletePost(
        req.params.id,
        req.user._id,
        req.user.role
      );

      res.status(200).json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Like/Unlike post
   * @route   POST /api/posts/:id/like
   * @access  Private
   */
  async toggleLike(req, res, next) {
    try {
      const result = await postService.toggleLike(req.params.id, req.user._id);

      res.status(200).json({
        success: true,
        message: `Post ${result.action}`,
        data: result,
      });
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
      const { text } = req.body;

      const result = await postService.addComment(
        req.params.id,
        req.user._id,
        text
      );

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
}

export default new PostController();