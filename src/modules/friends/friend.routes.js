import express from 'express';
import friendController from './friend.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();
const c = friendController;

// সব route protected
router.use(protect);

// ⚠️ Specific paths MUST come before dynamic /:param paths
router.get('/suggestions',      c.getSuggestions.bind(c));
router.get('/requests',         c.getPendingRequests.bind(c));
router.get('/status/:userId',   c.getStatus.bind(c));        // ← নতুন route
// ⚠️ GET / এর আগে রাখতে হবে
router.get('/status/:userId', protect, friendController.getStatus.bind(friendController));
router.get('/',                 c.getFriends.bind(c));

router.post('/request/:userId', c.sendRequest.bind(c));
router.put('/accept/:id',       c.acceptRequest.bind(c));
router.put('/reject/:id',       c.rejectRequest.bind(c));
router.delete('/:friendId',     c.unfriend.bind(c));

export default router;