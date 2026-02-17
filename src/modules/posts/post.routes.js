import express from 'express';
import postController from './post.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * All routes require authentication
 */

// Timeline (must be before /:id)
router.get('/timeline', protect, postController.getTimeline.bind(postController));

// User posts (must be before /:id)
router.get('/user/:userId', protect, postController.getUserPosts.bind(postController));

// Post CRUD
router.post('/', protect, postController.createPost.bind(postController));
router.get('/:id', protect, postController.getPost.bind(postController));
router.put('/:id', protect, postController.updatePost.bind(postController));
router.delete('/:id', protect, postController.deletePost.bind(postController));

// Like
router.post('/:id/like', protect, postController.toggleLike.bind(postController));

// Comments
router.post('/:id/comment', protect, postController.addComment.bind(postController));
router.delete(
  '/:id/comment/:commentId',
  protect,
  postController.deleteComment.bind(postController)
);

export default router;