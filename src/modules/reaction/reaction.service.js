import Reaction, { REACTION_EMOJI } from './reaction.model.js';
import Post from '../posts/post.model.js';
import notificationService from '../notification/notification.service.js';
import User from '../auth/user.model.js';
import { getIO } from '../../config/socket.js';

/**
 * Reaction Service
 *
 * Handles reactions on posts, comments, and replies.
 * Uses atomic MongoDB $inc for race-condition-safe count updates.
 * Delegates notifications to NotificationService.
 */
class ReactionService {
  /**
   * Toggle or change reaction
   *
   * Logic:
   * 1. Check existing reaction
   * 2a. Same type → remove (toggle off)
   * 2b. Different type → update
   * 2c. No reaction → create
   * 3. Atomically update cached counts
   * 4. Send notification + socket event
   */
  async toggleReaction(userId, targetType, targetId, reactionType) {
    const existing = await Reaction.findOne({ user: userId, targetType, targetId });

    let action;
    let oldType = null;

    if (existing) {
      if (existing.reactionType === reactionType) {
        await existing.deleteOne();
        action = 'removed';
      } else {
        oldType = existing.reactionType;
        existing.reactionType = reactionType;
        await existing.save();
        action = 'updated';
      }
    } else {
      await Reaction.create({ user: userId, targetType, targetId, reactionType });
      action = 'added';
    }

    // Atomic count update
    const counts = await this._updateCachedCounts(targetType, targetId, reactionType, oldType, action);

    // Notification (only on add/update, not remove)
    if (action !== 'removed') {
      await this._sendNotification(userId, targetType, targetId, reactionType);
    }

    // Socket broadcast
    this._emitReactionEvent(targetType, targetId, userId, reactionType, action, counts);

    return { action, reactionType: action === 'removed' ? null : reactionType, counts };
  }

  /**
   * Get aggregated reactions + current user's reaction
   */
  async getReactions(targetType, targetId, userId) {
    const { Types } = await import('mongoose');

    const [reactions, userReaction] = await Promise.all([
      Reaction.aggregate([
        { $match: { targetType, targetId: new Types.ObjectId(targetId) } },
        { $group: { _id: '$reactionType', count: { $sum: 1 } } },
      ]),
      userId ? Reaction.findOne({ user: userId, targetType, targetId }) : null,
    ]);

    const counts = reactions.reduce((acc, r) => {
      acc[r._id] = r.count;
      return acc;
    }, {});

    return {
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      userReaction: userReaction?.reactionType || null,
    };
  }

  /**
   * Get list of users who reacted (for modal display)
   */
  async getReactors(targetType, targetId, reactionType = null, limit = 50) {
    const query = { targetType, targetId };
    if (reactionType) query.reactionType = reactionType;

    return Reaction.find(query)
      .populate('user', 'name profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Atomically update cached reaction counts using $inc
   * No race conditions — MongoDB handles concurrency
   */
  async _updateCachedCounts(targetType, targetId, newType, oldType, action) {
    let inc = {};

    if (action === 'added') {
      inc[`reactionCounts.${newType}`] = 1;
      inc.totalReactions = 1;
    } else if (action === 'removed') {
      inc[`reactionCounts.${newType}`] = -1;
      inc.totalReactions = -1;
    } else if (action === 'updated') {
      inc[`reactionCounts.${oldType}`] = -1;
      inc[`reactionCounts.${newType}`] = 1;
      // totalReactions unchanged on type change
    }

    if (targetType === 'post') {
      const doc = await Post.findByIdAndUpdate(
        targetId,
        { $inc: inc },
        { new: true }
      ).select('reactionCounts totalReactions');

      return {
        counts: Object.fromEntries(doc.reactionCounts || new Map()),
        total: doc.totalReactions,
      };
    }

    if (targetType === 'comment') {
      // Map keys to subdoc path
      const mappedInc = {};
      for (const [key, val] of Object.entries(inc)) {
        mappedInc[key.replace(/^reactionCounts\./, 'comments.$[c].reactionCounts.')] = val;
        if (key === 'totalReactions') {
          mappedInc['comments.$[c].totalReactions'] = val;
          delete mappedInc[key];
        }
      }

      const doc = await Post.findOneAndUpdate(
        { 'comments._id': targetId },
        { $inc: mappedInc },
        { new: true, arrayFilters: [{ 'c._id': targetId }] }
      );

      const comment = doc?.comments?.id(targetId);
      return {
        counts: Object.fromEntries(comment?.reactionCounts || new Map()),
        total: comment?.totalReactions || 0,
      };
    }

    if (targetType === 'reply') {
      const post = await Post.findOne({ 'comments.replies._id': targetId });
      if (!post) return { counts: {}, total: 0 };

      let found = null;
      for (const comment of post.comments) {
        const reply = comment.replies?.id(targetId);
        if (reply) {
          for (const [key, val] of Object.entries(inc)) {
            if (key === 'totalReactions') {
              reply.totalReactions = Math.max(0, (reply.totalReactions || 0) + val);
            } else {
              const field = key.replace('reactionCounts.', '');
              reply.reactionCounts.set(field, Math.max(0, (reply.reactionCounts.get(field) || 0) + val));
            }
          }
          found = reply;
          break;
        }
      }
      await post.save();
      return {
        counts: Object.fromEntries(found?.reactionCounts || new Map()),
        total: found?.totalReactions || 0,
      };
    }

    return { counts: {}, total: 0 };
  }

  /**
   * Send notification via NotificationService
   */
  async _sendNotification(senderId, targetType, targetId, reactionType) {
    try {
      const emoji = REACTION_EMOJI[reactionType];
      const sender = await User.findById(senderId).select('name');
      if (!sender) return;

      if (targetType === 'post') {
        const post = await Post.findById(targetId).select('author');
        if (!post) return;
        await notificationService.create({
          recipientId: post.author,
          senderId,
          type: 'post_reaction',
          message: `${sender.name} আপনার পোস্টে ${emoji} রিয়াকশন দিয়েছেন`,
          postId: targetId,
          reactionType,
        });

      } else if (targetType === 'comment') {
        const post = await Post.findOne({ 'comments._id': targetId }).select('comments.$');
        if (!post) return;
        const comment = post.comments[0];
        await notificationService.create({
          recipientId: comment.user,
          senderId,
          type: 'comment_reaction',
          message: `${sender.name} আপনার কমেন্টে ${emoji} রিয়াকশন দিয়েছেন`,
          postId: post._id,
          commentId: targetId,
          reactionType,
        });

      } else if (targetType === 'reply') {
        const post = await Post.findOne({ 'comments.replies._id': targetId }).select('comments');
        if (!post) return;
        for (const comment of post.comments) {
          const reply = comment.replies?.id(targetId);
          if (reply) {
            await notificationService.create({
              recipientId: reply.user,
              senderId,
              type: 'reply_reaction',
              message: `${sender.name} আপনার রিপ্লেতে ${emoji} রিয়াকশন দিয়েছেন`,
              postId: post._id,
              commentId: comment._id,
              replyId: targetId,
              reactionType,
            });
            break;
          }
        }
      }
    } catch (err) {
      console.error('Reaction notification error (non-critical):', err.message);
    }
  }

  /**
   * Broadcast reaction event via Socket.io
   * Own updates skipped on frontend (optimistic UI handles it)
   */
  _emitReactionEvent(targetType, targetId, userId, reactionType, action, counts) {
    try {
      getIO().emit('reactionUpdate', {
        targetType,
        targetId: targetId.toString(),
        userId: userId.toString(),
        reactionType,
        action,
        counts,
      });
    } catch (err) {
      console.error('Socket emit error:', err.message);
    }
  }
}

export default new ReactionService();