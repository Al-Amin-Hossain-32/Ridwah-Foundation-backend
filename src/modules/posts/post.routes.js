import express from 'express';
import postController from './post.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Post Routes (Updated)
 * New endpoints: replies, notification management
 */

// Feed
router.get('/feed', protect, postController.getGlobalFeed.bind(postController));
router.get('/timeline', protect, postController.getTimeline.bind(postController));
router.get('/user/:userId', protect, postController.getUserPosts.bind(postController));

// Post CRUD
router.post('/', protect, postController.createPost.bind(postController));
router.get('/:id', protect, postController.getPost.bind(postController));
router.put('/:id', protect, postController.updatePost.bind(postController));
router.delete('/:id', protect, postController.deletePost.bind(postController));

// Comments
router.post('/:id/comment', protect, postController.addComment.bind(postController));
router.delete('/:id/comment/:commentId', protect, postController.deleteComment.bind(postController));

// Replies (NEW)
router.post('/:id/comment/:commentId/reply', protect, postController.addReply.bind(postController));
router.delete('/:id/comment/:commentId/reply/:replyId', protect, postController.deleteReply.bind(postController));

export default router;

// ─── notification.routes.js ───────────────────────────────────────────────────
// GET  /api/notifications          → get all (paginated)
// PUT  /api/notifications/:id/read → mark one as read
// PUT  /api/notifications/read-all → mark all as read
// DELETE /api/notifications/:id   → delete one
