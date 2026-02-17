import Friendship from './friendship.model.js';
import User from '../auth/user.model.js';

/**
 * Friend Service Layer
 */

class FriendService {
  /**
   * Send friend request
   * 
   * @param {string} requesterId - Who is sending
   * @param {string} recipientId - Who receives
   * @returns {Promise<Object>}
   */
  async sendFriendRequest(requesterId, recipientId) {
    // Can't send request to yourself
    if (requesterId === recipientId) {
      const error = new Error('Cannot send friend request to yourself');
      error.statusCode = 400;
      throw error;
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if friendship already exists
    const existingFriendship = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'accepted') {
        const error = new Error('You are already friends');
        error.statusCode = 400;
        throw error;
      }
      if (existingFriendship.status === 'pending') {
        const error = new Error('Friend request already sent');
        error.statusCode = 400;
        throw error;
      }
    }

    // Create friendship request
    const friendship = await Friendship.create({
      requester: requesterId,
      recipient: recipientId,
      status: 'pending',
    });

    await friendship.populate('requester', 'name profilePicture');
    await friendship.populate('recipient', 'name profilePicture');

    return friendship;
  }

  /**
   * Get pending friend requests
   * 
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getPendingRequests(userId) {
    const requests = await Friendship.find({
      recipient: userId,
      status: 'pending',
    })
      .populate('requester', 'name profilePicture bio')
      .sort({ createdAt: -1 });

    return requests;
  }

  /**
   * Accept friend request
   * 
   * @param {string} friendshipId
   * @param {string} userId - Must be recipient
   * @returns {Promise<Object>}
   */
  async acceptFriendRequest(friendshipId, userId) {
    const friendship = await Friendship.findById(friendshipId);

    if (!friendship) {
      const error = new Error('Friend request not found');
      error.statusCode = 404;
      throw error;
    }

    // Only recipient can accept
    if (friendship.recipient.toString() !== userId.toString()) {
      const error = new Error('You cannot accept this request');
      error.statusCode = 403;
      throw error;
    }

    // Already accepted
    if (friendship.status === 'accepted') {
      const error = new Error('Friend request already accepted');
      error.statusCode = 400;
      throw error;
    }

    friendship.status = 'accepted';
    await friendship.save();

    await friendship.populate('requester', 'name profilePicture');
    await friendship.populate('recipient', 'name profilePicture');

    return friendship;
  }

  /**
   * Reject friend request
   * 
   * @param {string} friendshipId
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async rejectFriendRequest(friendshipId, userId) {
    const friendship = await Friendship.findById(friendshipId);

    if (!friendship) {
      const error = new Error('Friend request not found');
      error.statusCode = 404;
      throw error;
    }

    // Only recipient can reject
    if (friendship.recipient.toString() !== userId) {
      const error = new Error('You cannot reject this request');
      error.statusCode = 403;
      throw error;
    }

    friendship.status = 'rejected';
    await friendship.save();
  }

 /**
 * Get all friends
 * 
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async getFriends(userId) {
  const userIdString = userId.toString();
  

  const friendships = await Friendship.find({
    $or: [
      { requester: userId, status: 'accepted' },
      { recipient: userId, status: 'accepted' },
    ],
  })
    .populate('requester', 'name profilePicture bio')
    .populate('recipient', 'name profilePicture bio')
    .sort({ updatedAt: -1 });


  // Extract friend data (the OTHER user, not self)
  const friends = friendships.map((friendship) => {
    // Debug log
    const requesterId = friendship.requester._id.toString();
    const recipientId = friendship.recipient._id.toString();

    // If current user is requester, return recipient
    // If current user is recipient, return requester
    if (requesterId === userIdString) {
      console.log('   → Returning recipient:', friendship.recipient.name);
      return friendship.recipient;
    } else {
      console.log('   → Returning requester:', friendship.requester.name);
      return friendship.requester;
    }
  });



  return friends;
}

  /**
   * Unfriend
   * 
   * @param {string} userId
   * @param {string} friendId
   * @returns {Promise<void>}
   */
  async unfriend(userId, friendId) {
    const friendship = await Friendship.findOne({
      $or: [
        { requester: userId, recipient: friendId },
        { requester: friendId, recipient: userId },
      ],
      status: 'accepted',
    });

    if (!friendship) {
      const error = new Error('Friendship not found');
      error.statusCode = 404;
      throw error;
    }

    await friendship.deleteOne();
  }

  /**
   * Get friend suggestions (users not yet friends)
   * 
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getSuggestions(userId) {
    // Get existing friendships
    const friendships = await Friendship.find({
      $or: [{ requester: userId }, { recipient: userId }],
    });

    // Extract user IDs to exclude
    const excludeIds = friendships.map((f) =>
      f.requester.toString() === userId ? f.recipient : f.requester
    );
    excludeIds.push(userId); // Exclude self

    // Find users not in exclude list
    const suggestions = await User.find({
      _id: { $nin: excludeIds },
      isActive: true,
    })
      .select('name profilePicture bio')
      .limit(10);

    return suggestions;
  }
}

export default new FriendService();