// ─── reaction.controller.js ───────────────────────────────────────────────────
import reactionService from './reaction.service.js';

class ReactionController {
  /**
   * @desc    Toggle reaction on post/comment/reply
   * @route   POST /api/reactions/:targetType/:targetId
   * @body    { reactionType: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry' }
   * @access  Private
   */
  async toggleReaction(req, res, next) {
    try {
      const { targetType, targetId } = req.params;
      const { reactionType } = req.body;

      if (!['post', 'comment', 'reply'].includes(targetType)) {
        return res.status(400).json({ success: false, message: 'Invalid target type' });
      }

      if (!['like', 'love', 'haha', 'wow', 'sad', 'angry'].includes(reactionType)) {
        return res.status(400).json({ success: false, message: 'Invalid reaction type' });
      }

      const result = await reactionService.toggleReaction(
        req.user._id,
        targetType,
        targetId,
        reactionType
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get reactions for a target
   * @route   GET /api/reactions/:targetType/:targetId
   * @access  Private
   */
  async getReactions(req, res, next) {
    try {
      const { targetType, targetId } = req.params;
      const result = await reactionService.getReactions(targetType, targetId, req.user._id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get users who reacted (for modal)
   * @route   GET /api/reactions/:targetType/:targetId/reactors?type=love
   * @access  Private
   */
  async getReactors(req, res, next) {
    try {
      const { targetType, targetId } = req.params;
      const { type } = req.query;
      const result = await reactionService.getReactors(targetType, targetId, type);
      res.status(200).json({ success: true, data: result });
      // const res = await reactionService.getReactors(targetType, targetId);
console.log('Reactors:', res.data);
    } catch (error) {
      next(error);
    }
  }
}

export default new ReactionController();

// ─── reaction.routes.js ───────────────────────────────────────────────────────
// import express from 'express';
// import reactionController from './reaction.controller.js';
// import { protect } from '../../middleware/auth.middleware.js';
//
// const router = express.Router();
//
// router.post('/:targetType/:targetId', protect, reactionController.toggleReaction.bind(reactionController));
// router.get('/:targetType/:targetId', protect, reactionController.getReactions.bind(reactionController));
// router.get('/:targetType/:targetId/reactors', protect, reactionController.getReactors.bind(reactionController));
//
// export default router;
