import express from 'express';
import messageController from './message.controller.js';
import { protect, authorize } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * All routes require authentication
 */

// Get unread count (must be before /:id routes)
router.get('/unread/count', protect, messageController.getUnreadCount.bind(messageController));

// Conversations
router.get('/conversations', protect, messageController.getConversations.bind(messageController));
router.put('/conversations/:id/read', protect, messageController.markConversationAsRead.bind(messageController));

// Messages
router.post('/', protect, messageController.sendMessage.bind(messageController));
router.get('/:conversationId', protect, messageController.getMessages.bind(messageController));

//  Edit message
router.put('/:id', protect, messageController.editMessage.bind(messageController));

//  Delete message (soft delete with options)
router.delete('/:id', protect, messageController.deleteMessage.bind(messageController));

//  Edit history (Admin only)
router.get(
  '/:id/history',
  protect,
  authorize('admin'),
  messageController.getEditHistory.bind(messageController)
);

// Mark as read
router.put('/:id/read', protect, messageController.markAsRead.bind(messageController));

export default router;