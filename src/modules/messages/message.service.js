import Message from './message.model.js';
import Conversation from './conversation.model.js';

class MessageService {
  /**
   * Send a message
   */
  async sendMessage(senderId, receiverId, content) {
    if (!content || content.trim().length === 0) {
      const error = new Error('Message content is required');
      error.statusCode = 400;
      throw error;
    }

    if (senderId.toString() === receiverId.toString()) {
      const error = new Error('Cannot send message to yourself');
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findOrCreate(senderId, receiverId);
    console.log('💬 Sending message in conversation:', conversation._id);

    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      receiver: receiverId,
      content: content.trim(),
      isRead: false,
    });

    await message.populate('sender', 'name profilePicture');

    // Update conversation's lastMessage & timestamp
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    // Re-populate conversation with updated lastMessage
    const updatedConversation = await Conversation.findById(conversation._id)
      .populate('participants', 'name profilePicture')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name' } });

    console.log('✅ Message created:', message._id);

    return { message, conversation: updatedConversation };
  }

  /**
   * Get all conversations for a user
   */
  async getConversations(userId) {
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'name profilePicture')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name profilePicture' },
      })
      .sort({ updatedAt: -1 });

    return conversations.map((conv) => {
      const otherUser = conv.participants.find(
        (p) => p._id.toString() !== userId.toString()
      );

      return {
        _id: conv._id,
        otherUser,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt,
      };
    });
  }

  /**
   * Get messages in a conversation (paginated)
   */
  async getMessages(conversationId, userId, page = 1, limit = 50) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      const error = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId.toString()
    );

    if (!isParticipant) {
      const error = new Error('You are not part of this conversation');
      error.statusCode = 403;
      throw error;
    }

    const total = await Message.countDocuments({ conversation: conversationId });

    // Sort DESCENDING to get the LATEST messages first, then reverse so UI
    // always receives oldest->newest order. This ensures new messages are
    // never cut off when total > limit.
    const allMessages = await Message.find({ conversation: conversationId })
      .populate('sender', 'name profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .then((msgs) => msgs.reverse());

    const filteredMessages = allMessages
      .map((msg) => {
        const msgObj = msg.toObject();

        // Hide "delete for me" messages from the deleting user
        if (
          msgObj.isDeleted &&
          msgObj.deleteType === 'for_me' &&
          msgObj.deletedBy?.toString() === userId.toString()
        ) {
          return null;
        }

        // Replace content for "delete for everyone"
        if (msgObj.isDeleted && msgObj.deleteType === 'for_everyone') {
          msgObj.content = '🚫 This message was deleted';
        }

        return msgObj;
      })
      .filter(Boolean);

    return {
      messages: filteredMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark single message as read
   */
  async markAsRead(messageId, userId) {
    const message = await Message.findById(messageId);

    if (!message) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    if (message.receiver.toString() !== userId.toString()) {
      const error = new Error('You cannot mark this message as read');
      error.statusCode = 403;
      throw error;
    }

    if (message.isRead) return message;

    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    console.log('👁️  Message marked as read:', messageId);
    return message;
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(conversationId, userId) {
    const result = await Message.updateMany(
      { conversation: conversationId, receiver: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    console.log(`📖 Marked ${result.modifiedCount} messages as read`);
    return result.modifiedCount;
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(userId) {
    return Message.countDocuments({ receiver: userId, isRead: false });
  }

  /**
   * Edit message (within 5 minute window)
   */
  async editMessage(messageId, userId, newContent) {
    if (!newContent || newContent.trim().length === 0) {
      const error = new Error('Message content is required');
      error.statusCode = 400;
      throw error;
    }

    const message = await Message.findById(messageId);

    if (!message) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    const canEditResult = message.canEdit(userId);
    if (!canEditResult.allowed) {
      const error = new Error(canEditResult.reason);
      error.statusCode = 403;
      throw error;
    }

    // Save original content to history on first edit
    if (!message.isEdited) {
      message.editHistory.push({
        content: message.content,
        editedAt: message.createdAt,
      });
    }

    message.editHistory.push({
      content: newContent.trim(),
      editedAt: new Date(),
    });

    message.content = newContent.trim();
    message.isEdited = true;
    message.lastEditedAt = new Date();

    await message.save();
    await message.populate('sender', 'name profilePicture');

    console.log('✏️  Message edited:', messageId);
    return message;
  }

  /**
   * Soft delete message
   */
  async deleteMessage(messageId, userId, deleteType = 'for_everyone') {
    const message = await Message.findById(messageId);

    if (!message) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    const canDeleteResult = message.canDelete(userId);
    if (!canDeleteResult.allowed) {
      const error = new Error(canDeleteResult.reason);
      error.statusCode = 403;
      throw error;
    }

    if (deleteType === 'for_everyone' && !canDeleteResult.canDeleteForEveryone) {
      const error = new Error('Time limit expired. You can only delete for yourself now.');
      error.statusCode = 400;
      throw error;
    }

    const receiverId = message.receiver.toString();
    const senderId = message.sender.toString();

    message.isDeleted = true;
    message.deletedBy = userId;
    message.deletedAt = new Date();
    message.deleteType = deleteType;

    await message.save();

    console.log(`🗑️  Message deleted (${deleteType}):`, messageId);

    return { message, receiverId, senderId };
  }

  /**
   * Get edit history (Admin only)
   */
  async getEditHistory(messageId, userId, userRole) {
    if (userRole !== 'admin') {
      const error = new Error('Only admins can view edit history');
      error.statusCode = 403;
      throw error;
    }

    const message = await Message.findById(messageId).populate('sender', 'name profilePicture');

    if (!message) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    if (!message.isEdited) {
      return { message: 'This message has not been edited', editHistory: [] };
    }

    return {
      message: 'Edit history retrieved',
      currentContent: message.content,
      editHistory: message.editHistory,
      totalEdits: message.editHistory.length,
    };
  }
}

export default new MessageService();