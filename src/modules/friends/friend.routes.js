import express from 'express';
import friendController from './friend.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * All routes require authentication
 */

// Get suggestions (before /:id routes)
router.get('/suggestions', protect, friendController.getSuggestions.bind(friendController));

// Get pending requests
router.get('/requests', protect, friendController.getPendingRequests.bind(friendController));

// Get friends list
router.get('/', protect, friendController.getFriends.bind(friendController));

// Send friend request
router.post('/request/:userId', protect, friendController.sendRequest.bind(friendController));

// Accept/Reject request
router.put('/accept/:id', protect, friendController.acceptRequest.bind(friendController));
router.put('/reject/:id', protect, friendController.rejectRequest.bind(friendController));

// Unfriend
router.delete('/:friendId', protect, friendController.unfriend.bind(friendController));

export default router;