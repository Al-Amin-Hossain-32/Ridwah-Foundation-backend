import friendService from './friend.service.js';

class FriendController {
  /**
   * @desc    Send friend request
   * @route   POST /api/friends/request/:userId
   * @access  Private
   */
  async sendRequest(req, res, next) {
    try {
      const friendship = await friendService.sendFriendRequest(
        req.user._id,
        req.params.userId
      );

      res.status(201).json({
        success: true,
        message: 'Friend request sent',
        data: friendship,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get pending requests
   * @route   GET /api/friends/requests
   * @access  Private
   */
  async getPendingRequests(req, res, next) {
    try {
      const requests = await friendService.getPendingRequests(req.user._id);

      res.status(200).json({
        success: true,
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Accept friend request
   * @route   PUT /api/friends/accept/:id
   * @access  Private
   */
  async acceptRequest(req, res, next) {
    try {
      const friendship = await friendService.acceptFriendRequest(
        req.params.id,
        req.user._id
      );

      res.status(200).json({
        success: true,
        message: 'Friend request accepted',
        data: friendship,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reject friend request
   * @route   PUT /api/friends/reject/:id
   * @access  Private
   */
  async rejectRequest(req, res, next) {
    try {
      await friendService.rejectFriendRequest(req.params.id, req.user._id);

      res.status(200).json({
        success: true,
        message: 'Friend request rejected',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get friends list
   * @route   GET /api/friends
   * @access  Private
   */
  async getFriends(req, res, next) {
    try {
      const friends = await friendService.getFriends(req.user._id);

      res.status(200).json({
        success: true,
        count: friends.length,
        data: friends,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Unfriend
   * @route   DELETE /api/friends/:friendId
   * @access  Private
   */
  async unfriend(req, res, next) {
    try {
      await friendService.unfriend(req.user._id, req.params.friendId);

      res.status(200).json({
        success: true,
        message: 'Unfriended successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get friend suggestions
   * @route   GET /api/friends/suggestions
   * @access  Private
   */
  async getSuggestions(req, res, next) {
    try {
      const suggestions = await friendService.getSuggestions(req.user._id);

      res.status(200).json({
        success: true,
        count: suggestions.length,
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new FriendController();