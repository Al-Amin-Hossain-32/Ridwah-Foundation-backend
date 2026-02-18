import * as bookRequestService from "./bookRequest.service.js";

// ─── Create Request (User) ────────────────────────────────────────────────────
export const createRequest = async (req, res, next) => {
  try {
    const request = await bookRequestService.createRequest(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message:
        request.status === "waitlisted"
          ? `No copies available. You are #${request.waitlistPosition} in the waitlist.`
          : "Request submitted successfully. Awaiting librarian approval.",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Cancel Request (User) ────────────────────────────────────────────────────
export const cancelRequest = async (req, res, next) => {
  try {
    const result = await bookRequestService.cancelRequest(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get My Requests (User) ───────────────────────────────────────────────────
export const getUserRequests = async (req, res, next) => {
  try {
    const result = await bookRequestService.getUserRequests(
      req.user._id,
      req.query
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get All Requests (Librarian+) ───────────────────────────────────────────
export const getAllRequests = async (req, res, next) => {
  try {
    const result = await bookRequestService.getAllRequests(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Waitlist for a Book (Librarian+) ─────────────────────────────────────
export const getWaitlist = async (req, res, next) => {
  try {
    const result = await bookRequestService.getWaitlist(req.params.bookId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Approve Request (Librarian) ─────────────────────────────────────────────
export const approveRequest = async (req, res, next) => {
  try {
    const request = await bookRequestService.approveRequest(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: "Request approved successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Reject Request (Librarian) ──────────────────────────────────────────────
export const rejectRequest = async (req, res, next) => {
  try {
    const request = await bookRequestService.rejectRequest(
      req.user._id,
      req.params.id,
      req.body.rejectionReason
    );
    res.status(200).json({
      success: true,
      message: "Request rejected",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Issue Book (Librarian) ───────────────────────────────────────────────────
export const issueBook = async (req, res, next) => {
  try {
    const request = await bookRequestService.issueBook(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: "Book issued successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Return Book (Librarian) ──────────────────────────────────────────────────
export const returnBook = async (req, res, next) => {
  try {
    const request = await bookRequestService.returnBook(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: "Book returned successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};
