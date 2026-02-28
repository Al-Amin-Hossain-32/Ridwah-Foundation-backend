import Notification from './notification.model.js';
import { getIO } from '../../config/socket.js';

/**
 * Notification Service
 *
 * Centralized notification creation logic.
 * Used by PostService and ReactionService internally.
 *
 * Why a separate service?
 * - PostService এবং ReactionService দুটোই notification পাঠায়
 * - Logic একজায়গায় রাখলে future change সহজ হয়
 * - Unit test করা সহজ
 */
class NotificationService {
  /**
   * Create and emit a notification
   *
   * @param {Object} params
   * @param {string} params.recipientId   - যে পাবে
   * @param {string} params.senderId      - যে পাঠাচ্ছে
   * @param {string} params.type          - notification type
   * @param {string} params.message       - human readable message
   * @param {string} [params.postId]
   * @param {string} [params.commentId]
   * @param {string} [params.replyId]
   * @param {string} [params.reactionType]
   * @returns {Promise<Object|null>}
   */
  async create({ recipientId, senderId, type, message, postId, commentId, replyId, reactionType }) {
    // নিজেকে notification পাঠাবে না
    if (recipientId.toString() === senderId.toString()) return null;

    try {
      const notification = await Notification.create({
        recipient: recipientId,
        sender: senderId,
        type,
        message,
        post: postId || undefined,
        commentId: commentId || undefined,
        replyId: replyId || undefined,
        reactionType: reactionType || undefined,
      });

      // Populate sender info for socket payload
      await notification.populate('sender', 'name profilePicture');

      // Realtime emit to recipient's personal room
      try {
        const io = getIO();
        io.to(recipientId.toString()).emit('newNotification', notification.toObject());
      } catch (_) {
        // Socket not initialized yet — non-critical
      }

      return notification;
    } catch (error) {
      // Notification failure should never break the main action
      console.error('Notification creation failed (non-critical):', error.message);
      return null;
    }
  }

  /**
   * Get notifications for a user (paginated)
   *
   * @param {string} userId
   * @param {number} page
   * @param {number} limit
   */
  async getForUser(userId, page = 1, limit = 20) {
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipient: userId })
        .populate('sender', 'name profilePicture')
        .populate('post', 'content images')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit),
      Notification.countDocuments({ recipient: userId }),
      Notification.countDocuments({ recipient: userId, read: false }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark one notification as read
   */
  async markRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true, readAt: new Date() },
      { new: true }
    );
  }

  /**
   * Mark all notifications as read
   */
  async markAllRead(userId) {
    return Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: new Date() }
    );
  }

  /**
   * Delete one notification
   */
  async delete(notificationId, userId) {
    return Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
  }

  /**
   * Unread count only (for badge)
   */
  async getUnreadCount(userId) {
    return Notification.countDocuments({ recipient: userId, read: false });
  }
}

export default new NotificationService();