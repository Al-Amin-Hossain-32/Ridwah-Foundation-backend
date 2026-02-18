import Message from './message.model.js';
import Conversation from './conversation.model.js';
import { getIO } from '../../config/socket.js';

/**
 * Message Service Layer
 */

class MessageService {
  /**
   * Send a message
   * 
   * Flow:
   * 1. Find or create conversation
   * 2. Create message
   * 3. Update conversation's lastMessage
   * 4. Emit real-time event via Socket.io
   * 
   * @param {string} senderId
   * @param {string} receiverId
   * @param {string} content
   * @returns {Promise<Object>}
   */
  async sendMessage(senderId, receiverId, content) {
    // Validate
    if (!content || content.trim().length === 0) {
      const error = new Error('Message content is required');
      error.statusCode = 400;
      throw error;
    }

    if (senderId === receiverId) {
      const error = new Error('Cannot send message to yourself');
      error.statusCode = 400;
      throw error;
    }

    // Find or create conversation
    const conversation = await Conversation.findOrCreate(senderId, receiverId);

    console.log('💬 Sending message in conversation:', conversation._id);

    // Create message
    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      receiver: receiverId,
      content: content.trim(),
      isRead: false,
    });

    // Populate sender details
    await message.populate('sender', 'name profilePicture');

    // Update conversation's lastMessage
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    console.log('✅ Message created:', message._id);

    // Emit real-time event (Socket.io handled separately)
    // Controller will handle Socket.io emission

    return {
      message,
      conversation,
    };
  }

  /**
   * Get all conversations for a user
   * 
   * Sorted by most recent message first
   * 
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getConversations(userId) {
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate('participants', 'name profilePicture')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name',
        },
      })
      .sort({ updatedAt: -1 });

    // Format response: Add "otherUser" field
    const formattedConversations = conversations.map((conv) => {
      // Find the other participant
      const otherUser = conv.participants.find(
        (p) => p._id.toString() !== userId.toString()
      );

      // Count unread messages in this conversation
      // (Will add this in next method)

      return {
        _id: conv._id,
        otherUser,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt,
      };
    });

    return formattedConversations;
  }

  /**
   * Get messages in a conversation
   * 
   * Paginated, sorted by newest first
   * 
   * @param {string} conversationId
   * @param {string} userId - To verify access
   * @param {number} page
   * @param {number} limit
   * @returns {Promise<Object>}
   */
  async getMessages(conversationId, userId, page = 1, limit = 50) {
  // Verify conversation exists
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    const error = new Error('Conversation not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify user is participant
  const isParticipant = conversation.participants.some(
    (p) => p.toString() === userId.toString()
  );

  if (!isParticipant) {
    const error = new Error('You are not part of this conversation');
    error.statusCode = 403;
    throw error;
  }

  console.log('📨 Getting messages for conversation:', conversationId);
  console.log('   User:', userId);

  // ✅ Simple query first - get all messages
  const allMessages = await Message.find({ 
    conversation: conversationId 
  })
    .populate('sender', 'name profilePicture')
    .sort({ createdAt: 1 }) // Oldest first for chat display
    .limit(limit)
    .skip((page - 1) * limit);

  console.log('   Total found:', allMessages.length);

  // ✅ Filter deleted messages on application level
  const filteredMessages = allMessages.map((msg) => {
    const msgObj = msg.toObject();

    // "Delete for me" - sender এর কাছে hide
    if (
      msgObj.isDeleted &&
      msgObj.deleteType === 'for_me' &&
      msgObj.deletedBy?.toString() === userId.toString()
    ) {
      return null; // Skip this message
    }

    // "Delete for everyone" - content replace করো
    if (msgObj.isDeleted && msgObj.deleteType === 'for_everyone') {
      msgObj.content = '🚫 This message was deleted';
    }

    return msgObj;
  }).filter(Boolean); // null গুলো remove করো

  // Total count
  const total = await Message.countDocuments({ 
    conversation: conversationId 
  });

  console.log('   Filtered messages:', filteredMessages.length);

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
   * Mark message as read
   * 
   * @param {string} messageId
   * @param {string} userId - Must be receiver
   * @returns {Promise<Object>}
   */
  async markAsRead(messageId, userId) {
    const message = await Message.findById(messageId);

    if (!message) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    // Only receiver can mark as read
    if (message.receiver.toString() !== userId.toString()) {
      const error = new Error('You cannot mark this message as read');
      error.statusCode = 403;
      throw error;
    }

    // Already read
    if (message.isRead) {
      return message;
    }

    // Mark as read
    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    console.log('👁️  Message marked as read:', messageId);

    return message;
  }

  /**
   * Mark all messages in a conversation as read
   * 
   * @param {string} conversationId
   * @param {string} userId - Receiver
   * @returns {Promise<number>} - Count of updated messages
   */
  async markConversationAsRead(conversationId, userId) {
    const result = await Message.updateMany(
      {
        conversation: conversationId,
        receiver: userId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    console.log(`📖 Marked ${result.modifiedCount} messages as read`);

    return result.modifiedCount;
  }

  /**
   * Get unread message count
   * 
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId) {
    const count = await Message.countDocuments({
      receiver: userId,
      isRead: false,
    });

    return count;
  }

  /**
 * Edit message
 * 
 * @param {string} messageId
 * @param {string} userId
 * @param {string} newContent
 * @returns {Promise<Object>}
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

  // Save to history
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

  // ✅ Populate both sender and receiver
  await message.populate('sender', 'name profilePicture');

  console.log('✏️  Message edited:', messageId);
  console.log('   Receiver ID:', message.receiver.toString());

  return message;
}

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
    const error = new Error(
      'Time limit expired. You can only delete for yourself now.'
    );
    error.statusCode = 400;
    throw error;
  }

  // ✅ Save receiver BEFORE soft delete (for socket emission)
  const receiverId = message.receiver.toString();
  const senderId = message.sender.toString();

  message.isDeleted = true;
  message.deletedBy = userId;
  message.deletedAt = new Date();
  message.deleteType = deleteType;

  await message.save();

  console.log(`🗑️  Message deleted (${deleteType}):`, messageId);
  console.log('   Receiver ID:', receiverId);

  return {
    message,
    receiverId, // ✅ Return separately
    senderId,   // ✅ Return separately
  };
}

/**
 * Get edit history (Admin only)
 * 
 * @param {string} messageId
 * @param {string} userId
 * @param {string} userRole
 * @returns {Promise<Array>}
 */
async getEditHistory(messageId, userId, userRole) {
  // Only admin can see edit history
  if (userRole !== 'admin') {
    const error = new Error('Only admins can view edit history');
    error.statusCode = 403;
    throw error;
  }

  const message = await Message.findById(messageId)
    .populate('sender', 'name profilePicture');

  if (!message) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }

  if (!message.isEdited) {
    return {
      message: 'This message has not been edited',
      editHistory: [],
    };
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