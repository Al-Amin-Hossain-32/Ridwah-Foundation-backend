import BookRequest from "./bookRequest.model.js";
import Book from "./book.model.js";
import { getSocketInstance, getOnlineUsers } from "../../config/socket.js";
// NOTE: socket.js এ getSocketInstance = getIO alias,
//       getOnlineUsers = onlineUsers Map export

// ─── Helper: Emit Socket Notification ────────────────────────────────────────
const notifyUser = (userId, event, data) => {
  try {
    const io = getSocketInstance();
    const onlineUsers = getOnlineUsers();
    const socketId = onlineUsers.get(userId.toString());
    if (socketId) {
      io.to(socketId).emit(event, data);
    }
  } catch {
    // Socket না থাকলে silently skip
  }
};

// ─── Helper: Promote Next Waitlisted User ─────────────────────────────────────
const promoteWaitlist = async (bookId) => {
  const nextInLine = await BookRequest.findOne({
    book: bookId,
    status: "waitlisted",
    waitlistPosition: 1,
  }).populate("book", "title author coverImage");

  if (!nextInLine) return;

  // Position 1 কে pending করা
  nextInLine.status = "pending";
  nextInLine.waitlistPosition = null;
  nextInLine.waitlistNotifiedAt = new Date();
  await nextInLine.save();

  // বাকি waitlist এর position এক ধাপ কমানো
  await BookRequest.updateMany(
    { book: bookId, status: "waitlisted" },
    { $inc: { waitlistPosition: -1 } }
  );

  // Socket notification
  notifyUser(nextInLine.user, "library:waitlist_available", {
    message: `"${nextInLine.book.title}" is now available for you! Your request is pending approval.`,
    bookId,
    requestId: nextInLine._id,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Create Request ───────────────────────────────────────────────────────────
export const createRequest = async (userId, { bookId, requestType, userNote }) => {
  const book = await Book.findById(bookId);
  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  if (!book.isActive) {
    const err = new Error("This book is currently unavailable");
    err.statusCode = 400;
    throw err;
  }

  // requestType validation against bookType
  if (requestType === "borrow" && book.bookType === "digital") {
    const err = new Error("This is a digital-only book. Use download request.");
    err.statusCode = 400;
    throw err;
  }
  if (requestType === "download" && book.bookType === "physical") {
    const err = new Error("This is a physical-only book. Use borrow request.");
    err.statusCode = 400;
    throw err;
  }
  if (requestType === "download" && !book.digital.fileUrl) {
    const err = new Error("Digital file is not yet available for this book.");
    err.statusCode = 400;
    throw err;
  }

  // Active duplicate request check
  const existingRequest = await BookRequest.findOne({
    book: bookId,
    user: userId,
    status: { $in: ["pending", "approved", "issued", "waitlisted"] },
  });
  if (existingRequest) {
    const err = new Error(
      `You already have an active ${existingRequest.status} request for this book.`
    );
    err.statusCode = 400;
    throw err;
  }

  // Download request: instant approve (no physical stock needed)
  if (requestType === "download") {
    const request = await BookRequest.create({
      book: bookId,
      user: userId,
      requestType,
      userNote,
      status: "pending",
    });
    return request.populate("book", "title author coverImage digital");
  }

  // Physical borrow: check availability → pending or waitlisted
  const isAvailable = book.physical.availableCopies > 0;

  if (isAvailable) {
    const request = await BookRequest.create({
      book: bookId,
      user: userId,
      requestType,
      userNote,
      status: "pending",
    });
    return request.populate("book", "title author coverImage physical");
  }

  // Waitlist
  const waitlistCount = await BookRequest.countDocuments({
    book: bookId,
    status: "waitlisted",
  });

  const request = await BookRequest.create({
    book: bookId,
    user: userId,
    requestType,
    userNote,
    status: "waitlisted",
    waitlistPosition: waitlistCount + 1,
  });

  return request.populate("book", "title author coverImage physical");
};

// ─── Cancel Request (User) ────────────────────────────────────────────────────
export const cancelRequest = async (userId, requestId) => {
  const request = await BookRequest.findById(requestId);
  if (!request) {
    const err = new Error("Request not found");
    err.statusCode = 404;
    throw err;
  }
  if (request.user.toString() !== userId.toString()) {
    const err = new Error("Not authorized to cancel this request");
    err.statusCode = 403;
    throw err;
  }
  if (!["pending", "waitlisted"].includes(request.status)) {
    const err = new Error(
      `Cannot cancel a request with status: ${request.status}`
    );
    err.statusCode = 400;
    throw err;
  }

  const wasWaitlisted = request.status === "waitlisted";
  const position = request.waitlistPosition;
  const bookId = request.book;

  request.status = "cancelled";
  request.waitlistPosition = null;
  await request.save();

  // Waitlist থেকে cancel হলে বাকিদের position আপডেট
  if (wasWaitlisted) {
    await BookRequest.updateMany(
      {
        book: bookId,
        status: "waitlisted",
        waitlistPosition: { $gt: position },
      },
      { $inc: { waitlistPosition: -1 } }
    );
  }

  return { message: "Request cancelled successfully" };
};

// ─── Get User's Own Requests ──────────────────────────────────────────────────
export const getUserRequests = async (userId, query) => {
  const { status, page = 1, limit = 10 } = query;

  const filter = { user: userId };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [requests, total] = await Promise.all([
    BookRequest.find(filter)
      .populate("book", "title author coverImage bookType averageRating")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean({ virtuals: true }),
    BookRequest.countDocuments(filter),
  ]);

  return {
    requests,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// LIBRARIAN ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Get All Requests ─────────────────────────────────────────────────────────
export const getAllRequests = async (query) => {
  const { status, requestType, bookId, userId, page = 1, limit = 10 } = query;

  const filter = {};
  if (status) filter.status = status;
  if (requestType) filter.requestType = requestType;
  if (bookId) filter.book = bookId;
  if (userId) filter.user = userId;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [requests, total] = await Promise.all([
    BookRequest.find(filter)
      .populate("book", "title author coverImage bookType")
      .populate("user", "name email avatar")
      .populate("approvedBy", "name")
      .populate("issuedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean({ virtuals: true }),
    BookRequest.countDocuments(filter),
  ]);

  return {
    requests,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Get Waitlist for a Book ──────────────────────────────────────────────────
export const getWaitlist = async (bookId) => {
  const book = await Book.findById(bookId).select("title author physical");
  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  const waitlist = await BookRequest.find({
    book: bookId,
    status: "waitlisted",
  })
    .populate("user", "name email avatar")
    .sort({ waitlistPosition: 1 })
    .lean();

  return { book, waitlist };
};

// ─── Approve Request ──────────────────────────────────────────────────────────
export const approveRequest = async (librarianId, requestId) => {
  const request = await BookRequest.findById(requestId)
    .populate("book", "title author borrowDurationDays digital")
    .populate("user", "name");

  if (!request) {
    const err = new Error("Request not found");
    err.statusCode = 404;
    throw err;
  }
  if (request.status !== "pending") {
    const err = new Error(`Cannot approve a request with status: ${request.status}`);
    err.statusCode = 400;
    throw err;
  }

  request.status = "approved";
  request.approvedBy = librarianId;
  request.approvedAt = new Date();

  // Digital download: approved হলেই file access দেওয়া হয়
  // Physical: issue step বাকি থাকে
  await request.save();

  // Socket notification
  notifyUser(request.user._id, "library:request_approved", {
    message: `Your request for "${request.book.title}" has been approved!`,
    requestId: request._id,
    requestType: request.requestType,
    // Digital হলে fileUrl সাথে দাও
    ...(request.requestType === "download" && {
      fileUrl: request.book.digital?.fileUrl,
    }),
  });

  return request;
};

// ─── Reject Request ───────────────────────────────────────────────────────────
export const rejectRequest = async (librarianId, requestId, rejectionReason) => {
  const request = await BookRequest.findById(requestId)
    .populate("book", "title")
    .populate("user", "name");

  if (!request) {
    const err = new Error("Request not found");
    err.statusCode = 404;
    throw err;
  }
  if (!["pending", "approved"].includes(request.status)) {
    const err = new Error(`Cannot reject a request with status: ${request.status}`);
    err.statusCode = 400;
    throw err;
  }

  request.status = "rejected";
  request.rejectedBy = librarianId;
  request.rejectedAt = new Date();
  request.rejectionReason = rejectionReason || "No reason provided";
  await request.save();

  // Socket notification
  notifyUser(request.user._id, "library:request_rejected", {
    message: `Your request for "${request.book.title}" was rejected.`,
    reason: request.rejectionReason,
    requestId: request._id,
  });

  return request;
};

// ─── Issue Book (approved → issued) ──────────────────────────────────────────
export const issueBook = async (librarianId, requestId) => {
  const request = await BookRequest.findById(requestId)
    .populate("book", "title borrowDurationDays physical")
    .populate("user", "name");

  if (!request) {
    const err = new Error("Request not found");
    err.statusCode = 404;
    throw err;
  }
  if (request.status !== "approved") {
    const err = new Error("Book can only be issued after approval");
    err.statusCode = 400;
    throw err;
  }
  if (request.requestType !== "borrow") {
    const err = new Error("Issue action is only for physical borrow requests");
    err.statusCode = 400;
    throw err;
  }

  // Copy availability re-check
  const book = await Book.findById(request.book._id);
  if (book.physical.availableCopies < 1) {
    const err = new Error("No physical copies available to issue");
    err.statusCode = 400;
    throw err;
  }

  // Decrement available copies
  book.physical.availableCopies -= 1;
  await book.save();

  // Request update
  const issuedAt = new Date();
  const dueDate = new Date(
    issuedAt.getTime() + book.borrowDurationDays * 24 * 60 * 60 * 1000
  );

  request.status = "issued";
  request.issuedBy = librarianId;
  request.issuedAt = issuedAt;
  request.dueDate = dueDate;
  await request.save();

  // Socket notification
  notifyUser(request.user._id, "library:book_issued", {
    message: `"${book.title}" has been issued to you.`,
    dueDate,
    requestId: request._id,
  });

  return request;
};

// ─── Return Book (issued → returned) ─────────────────────────────────────────
export const returnBook = async (librarianId, requestId) => {
  const request = await BookRequest.findById(requestId)
    .populate("book", "title")
    .populate("user", "name");

  if (!request) {
    const err = new Error("Request not found");
    err.statusCode = 404;
    throw err;
  }
  if (request.status !== "issued") {
    const err = new Error("Only issued books can be returned");
    err.statusCode = 400;
    throw err;
  }

  // Increment available copies
  const book = await Book.findById(request.book._id);
  book.physical.availableCopies += 1;
  await book.save();

  // Request update
  request.status = "returned";
  request.returnedAt = new Date();
  request.returnAcceptedBy = librarianId;
  await request.save();

  // Waitlist promote করা (next person notify)
  await promoteWaitlist(request.book._id);

  return request;
};