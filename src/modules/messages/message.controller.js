import messageService from './message.service.js';
import { getIO } from '../../config/socket.js';

/**
 * Message Controller
 */

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
        
        // Emit to receiver
        io.to(receiverId).emit('newMessage', {
          messageId: result.message._id,
          senderId: req.user._id,
          senderName: req.user.name,
          senderPicture: req.user.profilePicture,
          content: result.message.content,
          conversationId: result.conversation._id,
          timestamp: result.message.createdAt,
        });

        console.log('📡 Real-time event sent to:', receiverId);
      } catch (socketError) {
        // Socket.io error (user might be offline)
        console.log('⚠️  Socket.io error (user might be offline):', socketError.message);
        // Don't fail the request, message is saved in DB
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
   * @route   GET /api/conversations
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
   * @desc    Mark message as read
   * @route   PUT /api/messages/:id/read
   * @access  Private
   */
  async markAsRead(req, res, next) {
    try {
      const message = await messageService.markAsRead(
        req.params.id,
        req.user._id
      );

      // Emit real-time event to sender
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
   * @desc    Mark conversation as read
   * @route   PUT /api/conversations/:id/read
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

    // ✅ Use message.receiver directly (ObjectId)
    const receiverId = message.receiver.toString();
    const senderId = message.sender._id.toString();

    console.log('📡 Emitting edit notification to receiver:', receiverId);

    try {
      const io = getIO();

        // ✅ Debug: Check who is in the room
  const receiverRoom = io.sockets.adapter.rooms.get(receiverId);
  const senderRoom = io.sockets.adapter.rooms.get(senderId);

  console.log('🔍 Room Debug:');
  console.log('   Receiver ID:', receiverId);
  console.log('   Receiver room size:', receiverRoom ? receiverRoom.size : 0);
  console.log('   Sender ID:', senderId);
  console.log('   Sender room size:', senderRoom ? senderRoom.size : 0);
  console.log('   All rooms:', Array.from(io.sockets.adapter.rooms.keys()));

  // Emit to receiver
  io.to(receiverId).emit('messageEdited', {
    messageId: message._id,
    conversationId: message.conversation,
    newContent: message.content,
    isEdited: true,
    editedAt: message.lastEditedAt,
  });

  console.log('✅ Edit event emitted to room:', receiverId);

      // ✅ Emit to sender's other devices
      io.to(senderId).emit('messageEdited', {
        messageId: message._id,
        conversationId: message.conversation,
        newContent: message.content,
        isEdited: true,
        editedAt: message.lastEditedAt,
      });

      console.log('✅ Edit notification sent');
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

async deleteMessage(req, res, next) {
  try {
    const { deleteType = 'for_everyone' } = req.body;

    const result = await messageService.deleteMessage(
      req.params.id,
      req.user._id,
      deleteType
    );

    // ✅ Use returned IDs directly
    const { receiverId, senderId } = result;

    console.log('📡 Emitting delete notification to receiver:', receiverId);

    try {
      const io = getIO();

      if (deleteType === 'for_everyone') {
        // ✅ Notify receiver
        io.to(receiverId).emit('messageDeleted', {
          messageId: result.message._id,
          conversationId: result.message.conversation,
          deleteType: 'for_everyone',
        });
      }

      // ✅ Notify sender's other devices
      io.to(senderId).emit('messageDeleted', {
        messageId: result.message._id,
        conversationId: result.message.conversation,
        deleteType,
      });

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
 * @desc    Get edit history (Admin only)
 * @route   GET /api/messages/:id/history
 * @access  Private (Admin)
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