import express from 'express';
import notificationController from './notification.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Notification Routes
 *
 * All routes require authentication
 */

// GET  /api/notifications          → সব নোটিফিকেশন (paginated)
router.get(
  '/',
  protect,
  notificationController.getNotifications.bind(notificationController)
);

// PUT  /api/notifications/read-all → সব নোটিফিকেশন পড়া হয়েছে mark করা
// NOTE: এই route টি /:id এর আগে রাখতে হবে, না হলে 'read-all' কে id হিসেবে ধরবে
router.put(
  '/read-all',
  protect,
  notificationController.markAllRead.bind(notificationController)
);

// PUT  /api/notifications/:id/read → একটি নোটিফিকেশন পড়া হয়েছে mark করা
router.put(
  '/:id/read',
  protect,
  notificationController.markRead.bind(notificationController)
);

// DELETE /api/notifications/:id   → একটি নোটিফিকেশন মুছুন
router.delete(
  '/:id',
  protect,
  notificationController.deleteNotification.bind(notificationController)
);

export default router;