import friendService from './friend.service.js';

class FriendController {
  /** POST /api/friends/request/:userId */
  async sendRequest(req, res, next) {
    try {
      const data = await friendService.sendFriendRequest(req.user._id, req.params.userId);
      res.status(201).json({ success: true, message: 'ফ্রেন্ড রিকোয়েস্ট পাঠানো হয়েছে', data });
    } catch (e) { next(e); }
  }

  /** GET /api/friends/status/:userId */
  async getStatus(req, res, next) {
    try {
      const data = await friendService.getFriendshipStatus(req.user._id, req.params.userId);
      res.status(200).json({ success: true, data });
    } catch (e) { next(e); }
  }

  /** GET /api/friends/requests */
  async getPendingRequests(req, res, next) {
    try {
      const data = await friendService.getPendingRequests(req.user._id);
      res.status(200).json({ success: true, count: data.length, data });
    } catch (e) { next(e); }
  }

  /** PUT /api/friends/accept/:id */
  async acceptRequest(req, res, next) {
    try {
      const data = await friendService.acceptFriendRequest(req.params.id, req.user._id);
      res.status(200).json({ success: true, message: 'রিকোয়েস্ট অ্যাক্সেপ্ট হয়েছে', data });
    } catch (e) { next(e); }
  }

  /** PUT /api/friends/reject/:id */
  async rejectRequest(req, res, next) {
    try {
      await friendService.rejectFriendRequest(req.params.id, req.user._id);
      res.status(200).json({ success: true, message: 'রিকোয়েস্ট রিজেক্ট হয়েছে' });
    } catch (e) { next(e); }
  }


  /** GET /api/friends */
  async getFriends(req, res, next) {
    try {
      const data = await friendService.getFriends(req.user._id);
      res.status(200).json({ success: true, count: data.length, data });
    } catch (e) { next(e); }
  }

  /** DELETE /api/friends/:friendId */
  async unfriend(req, res, next) {
    try {
      await friendService.unfriend(req.user._id, req.params.friendId);
      res.status(200).json({ success: true, message: 'বন্ধু সরানো হয়েছে' });
    } catch (e) { next(e); }
  }
  async getStatus(req, res, next) {
  try {
    const data = await friendService.getFriendshipStatus(req.user._id, req.params.userId);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
}

  /** GET /api/friends/suggestions */
  async getSuggestions(req, res, next) {
    try {
      const data = await friendService.getSuggestions(req.user._id);
      res.status(200).json({ success: true, count: data.length, data });
    } catch (e) { next(e); }
  }
}


export default new FriendController();