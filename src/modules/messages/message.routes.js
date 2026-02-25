import express from 'express';
import messageController from './message.controller.js';
import { protect, authorize } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * All routes require authentication
 * ⚠️ ORDER MATTERS: Specific routes must come before parameterized routes
 */

// ─── Unread Count ─────────────────────────────────────────────────────────────
router.get('/unread/count', protect, messageController.getUnreadCount.bind(messageController));

// ─── Conversations ─────────────────────────────────────────────────────────────
router.get('/conversations', protect, messageController.getConversations.bind(messageController));
router.put('/conversations/:id/read', protect, messageController.markConversationAsRead.bind(messageController));

// ─── Send Message ──────────────────────────────────────────────────────────────
router.post('/', protect, messageController.sendMessage.bind(messageController));

// ─── Parameterized Routes (ORDER: specific paths before :id) ──────────────────
// Must come BEFORE /:id to avoid conflict
router.get('/:id/history', protect, authorize('admin'), messageController.getEditHistory.bind(messageController));
router.put('/:id/read', protect, messageController.markAsRead.bind(messageController));

// ─── Generic :conversationId / :id ────────────────────────────────────────────
router.get('/:conversationId', protect, messageController.getMessages.bind(messageController));
router.put('/:id', protect, messageController.editMessage.bind(messageController));
router.delete('/:id', protect, messageController.deleteMessage.bind(messageController));

export default router;