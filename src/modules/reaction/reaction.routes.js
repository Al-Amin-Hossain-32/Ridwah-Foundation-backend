import express from 'express';
import reactionController from './reaction.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Reaction Routes
 *
 * targetType: 'post' | 'comment' | 'reply'
 * All routes require authentication
 */

// POST /api/reactions/:targetType/:targetId
// body: { reactionType: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry' }
// → Reaction toggle (add / change / remove)
router.post(
  '/:targetType/:targetId',
  protect,
  reactionController.toggleReaction.bind(reactionController)
);

// GET /api/reactions/:targetType/:targetId
// → কোনো target-এর সব reaction count + current user-এর reaction
router.get(
  '/:targetType/:targetId',
  protect,
  reactionController.getReactions.bind(reactionController)
);

// GET /api/reactions/:targetType/:targetId/reactors?type=love
// → কারা react করেছে (modal-এ দেখানোর জন্য)
router.get(
  '/:targetType/:targetId/reactors',
  protect,
  reactionController.getReactors.bind(reactionController)
);

export default router;