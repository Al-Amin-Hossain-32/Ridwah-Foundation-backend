import notificationService from './notification.service.js';

/**
 * Notification Controller
 *
 * HTTP layer only — delegates all logic to NotificationService
 */
class NotificationController {
  /**
   * @route GET /api/notifications
   */
  async getNotifications(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await notificationService.getForUser(req.user._id, page, limit);

      res.status(200).json({
        success: true,
        data: result.notifications,
        unreadCount: result.unreadCount,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route PUT /api/notifications/:id/read
   */
  async markRead(req, res, next) {
    try {
      await notificationService.markRead(req.params.id, req.user._id);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route PUT /api/notifications/read-all
   */
  async markAllRead(req, res, next) {
    try {
      await notificationService.markAllRead(req.user._id);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route DELETE /api/notifications/:id
   */
  async deleteNotification(req, res, next) {
    try {
      await notificationService.delete(req.params.id, req.user._id);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificationController();