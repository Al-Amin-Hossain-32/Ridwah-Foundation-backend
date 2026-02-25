import messageService from './message.service.js';
import { getIO } from '../../config/socket.js';

class MessageController {
  /**
   * @desc    Send message
   * @route   POST /api/messages
   * @access  Private
   */
  async sendMessage(req, res, next) {
    try {
      const { receiverId, content } = req.body;

      const result = await messageService.sendMessage(
        req.user._id,
        receiverId,
        content
      );

      // Emit real-time event via Socket.io
      try {
        const io = getIO();

        const messagePayload = {
          _id: result.message._id,
          messageId: result.message._id,
          senderId: req.user._id,
          senderName: req.user.name,
          senderPicture: req.user.profilePicture,
          content: result.message.content,
          conversation: result.conversation._id,
          conversationId: result.conversation._id,
          timestamp: result.message.createdAt,
          createdAt: result.message.createdAt,
          isRead: false,
          sender: {
            _id: req.user._id,
            name: req.user.name,
            profilePicture: req.user.profilePicture,
          },
        };

        io.to(receiverId.toString()).emit('newMessage', messagePayload);
        console.log('📡 Real-time event sent to:', receiverId);
      } catch (socketError) {
        console.log('⚠️  Socket.io error (user might be offline):', socketError.message);
      }

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get all conversations
   * @route   GET /api/messages/conversations
   * @access  Private
   */
  async getConversations(req, res, next) {
    try {
      const conversations = await messageService.getConversations(req.user._id);

      res.status(200).json({
        success: true,
        count: conversations.length,
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get messages in a conversation
   * @route   GET /api/messages/:conversationId
   * @access  Private
   */
  async getMessages(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      const result = await messageService.getMessages(
        req.params.conversationId,
        req.user._id,
        page,
        limit
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Mark single message as read
   * @route   PUT /api/messages/:id/read
   * @access  Private
   */
  async markAsRead(req, res, next) {
    try {
      const message = await messageService.markAsRead(
        req.params.id,
        req.user._id
      );

      try {
        const io = getIO();
        io.to(message.sender.toString()).emit('messageReadConfirm', {
          messageId: message._id,
          readBy: req.user._id,
          readAt: message.readAt,
        });
      } catch (socketError) {
        console.log('⚠️  Socket.io error:', socketError.message);
      }

      res.status(200).json({
        success: true,
        message: 'Message marked as read',
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Mark entire conversation as read
   * @route   PUT /api/messages/conversations/:id/read
   * @access  Private
   */
  async markConversationAsRead(req, res, next) {
    try {
      const count = await messageService.markConversationAsRead(
        req.params.id,
        req.user._id
      );

      res.status(200).json({
        success: true,
        message: `${count} messages marked as read`,
        count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get unread count
   * @route   GET /api/messages/unread/count
   * @access  Private
   */
  async getUnreadCount(req, res, next) {
    try {
      const count = await messageService.getUnreadCount(req.user._id);

      res.status(200).json({
        success: true,
        count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Edit message
   * @route   PUT /api/messages/:id
   * @access  Private
   */
  async editMessage(req, res, next) {
    try {
      const { content } = req.body;

      const message = await messageService.editMessage(
        req.params.id,
        req.user._id,
        content
      );

      const receiverId = message.receiver.toString();
      const senderId = message.sender._id.toString();

      const editPayload = {
        messageId: message._id,
        conversationId: message.conversation,
        newContent: message.content,
        isEdited: true,
        editedAt: message.lastEditedAt,
      };

      try {
        const io = getIO();
        // Notify receiver
        io.to(receiverId).emit('messageEdited', editPayload);
        // Notify sender's other tabs/devices
        io.to(senderId).emit('messageEdited', editPayload);
        console.log('✅ Edit event emitted to:', receiverId, senderId);
      } catch (socketError) {
        console.log('⚠️  Socket error:', socketError.message);
      }

      res.status(200).json({
        success: true,
        message: 'Message edited successfully',
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete message (soft delete)
   * @route   DELETE /api/messages/:id
   * @access  Private
   */
  async deleteMessage(req, res, next) {
    try {
      const { deleteType = 'for_everyone' } = req.body;

      const result = await messageService.deleteMessage(
        req.params.id,
        req.user._id,
        deleteType
      );

      const { receiverId, senderId } = result;

      const deletePayload = {
        messageId: result.message._id,
        conversationId: result.message.conversation,
        deleteType,
      };

      try {
        const io = getIO();

        if (deleteType === 'for_everyone') {
          io.to(receiverId).emit('messageDeleted', deletePayload);
        }
        // Always notify sender's other devices
        io.to(senderId).emit('messageDeleted', deletePayload);
        console.log('✅ Delete notification sent');
      } catch (socketError) {
        console.log('⚠️  Socket error:', socketError.message);
      }

      res.status(200).json({
        success: true,
        message: `Message deleted (${deleteType})`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get edit history
   * @route   GET /api/messages/:id/history
   * @access  Private (Admin only)
   */
  async getEditHistory(req, res, next) {
    try {
      const history = await messageService.getEditHistory(
        req.params.id,
        req.user._id,
        req.user.role
      );

      res.status(200).json({
        success: true,
        ...history,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new MessageController();