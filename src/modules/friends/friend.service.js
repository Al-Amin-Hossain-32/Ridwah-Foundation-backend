import Friendship from './friendship.model.js';
import User from '../auth/user.model.js';

/* ─────────────────────────── helpers ──────────────────────────── */

const AppError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const USER_FIELDS = 'name username profilePicture bio';

/* ─────────────────────────── service ──────────────────────────── */

class FriendService {
  /**
   * Send a friend request.
   * Edge case: rejected → resend is allowed (resets to pending).
   */
  async sendFriendRequest(requesterId, recipientId) {
    if (requesterId.toString() === recipientId.toString()) {
      throw AppError('নিজেকে ফ্রেন্ড রিকোয়েস্ট পাঠানো যাবে না');
    }

    const recipient = await User.findById(recipientId).lean();
    if (!recipient) throw AppError('ইউজার পাওয়া যায়নি', 404);

    const existing = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') throw AppError('আপনারা ইতিমধ্যে বন্ধু');
      if (existing.status === 'pending') throw AppError('রিকোয়েস্ট ইতিমধ্যে পাঠানো আছে');

      // rejected → allow resend
      if (existing.status === 'rejected') {
        existing.status = 'pending';
        existing.requester = requesterId;
        existing.recipient = recipientId;
        await existing.save();
        return existing.populate([
          { path: 'requester', select: USER_FIELDS },
          { path: 'recipient', select: USER_FIELDS },
        ]);
      }
    }

    const friendship = await Friendship.create({
      requester: requesterId,
      recipient: recipientId,
    });

    return friendship.populate([
      { path: 'requester', select: USER_FIELDS },
      { path: 'recipient', select: USER_FIELDS },
    ]);
  }

  /**
   * Get friendship status between currentUser and targetUser.
   * Returns: { status, direction?, friendshipId? }
   *   status    → 'none' | 'pending' | 'accepted' | 'rejected' | 'self'
   *   direction → 'sent' | 'received'   (only when status !== 'none' | 'self')
   */
  async getFriendshipStatus(currentUserId, targetUserId) {
    if (currentUserId.toString() === targetUserId.toString()) {
      return { status: 'self' };
    }

    const friendship = await Friendship.findOne({
      $or: [
        { requester: currentUserId, recipient: targetUserId },
        { requester: targetUserId, recipient: currentUserId },
      ],
    }).lean();

    if (!friendship) return { status: 'none' };

    const direction =
      friendship.requester.toString() === currentUserId.toString() ? 'sent' : 'received';

    return {
      status: friendship.status,
      direction,
      friendshipId: friendship._id,
    };
  }

  /**
   * Pending requests sent TO the current user.
   * Returns flat user objects (requestId merged) → cleaner for frontend.
   */
  async getPendingRequests(userId) {
    const requests = await Friendship.find({
      recipient: userId,
      status: 'pending',
    })
      .populate('requester', USER_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    return requests.map(({ _id, requester }) => ({
      ...requester,
      requestId: _id, // friendship _id — accept/reject-এ ব্যবহার হবে
    }));
  }

  /**
   * Accept a pending request (only recipient).
   */
  async acceptFriendRequest(friendshipId, userId) {
    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) throw AppError('রিকোয়েস্ট পাওয়া যায়নি', 404);

    if (friendship.recipient.toString() !== userId.toString()) {
      throw AppError('অনুমতি নেই', 403);
    }
    if (friendship.status === 'accepted') throw AppError('ইতিমধ্যে অ্যাক্সেপ্ট হয়েছে');

    friendship.status = 'accepted';
    await friendship.save();
    return friendship;
  }

  /**
   * Reject a pending request (only recipient).
   */
  async rejectFriendRequest(friendshipId, userId) {
    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) throw AppError('রিকোয়েস্ট পাওয়া যায়নি', 404);

    if (friendship.recipient.toString() !== userId.toString()) {
      throw AppError('অনুমতি নেই', 403);
    }

    friendship.status = 'rejected';
    await friendship.save();
  }

  /**
   * Get all accepted friends — returns the OTHER user's data.
   */
  async getFriends(userId) {
    const userIdStr = userId.toString();

    const friendships = await Friendship.find({
      status: 'accepted',
      $or: [{ requester: userId }, { recipient: userId }],
    })
      .populate('requester', USER_FIELDS)
      .populate('recipient', USER_FIELDS)
      .sort({ updatedAt: -1 })
      .lean();

    return friendships.map((f) =>
      f.requester._id.toString() === userIdStr ? f.recipient : f.requester
    )
      .filter(Boolean);
  }

  /**
   * Remove an accepted friendship.
   */
  async unfriend(userId, friendId) {
    const deleted = await Friendship.findOneAndDelete({
      status: 'accepted',
      $or: [
        { requester: userId, recipient: friendId },
        { requester: friendId, recipient: userId },
      ],
    });
    if (!deleted) throw AppError('বন্ধুত্ব পাওয়া যায়নি', 404);
  }
async getFriendshipStatus(currentUserId, targetUserId) {
  if (currentUserId.toString() === targetUserId.toString()) {
    return { status: 'self' };
  }
  const friendship = await Friendship.findOne({
    $or: [
      { requester: currentUserId, recipient: targetUserId },
      { requester: targetUserId, recipient: currentUserId },
    ],
  }).lean();

  if (!friendship) return { status: 'none' };

  const direction =
    friendship.requester.toString() === currentUserId.toString() ? 'sent' : 'received';

  return { status: friendship.status, direction, friendshipId: friendship._id };
}


  /**
   * Users with no existing friendship connection (suggestions).
   */
  async getSuggestions(userId) {
    const friendships = await Friendship.find({
      $or: [{ requester: userId }, { recipient: userId }],
    }).lean();

    const excludeIds = new Set([userId.toString()]);
    for (const f of friendships) {
      excludeIds.add(f.requester.toString());
      excludeIds.add(f.recipient.toString());
    }

    return User.find({ _id: { $nin: [...excludeIds] }, isActive: true })
      .select(USER_FIELDS)
      .limit(10)
      .lean();
  }
}

export default new FriendService();