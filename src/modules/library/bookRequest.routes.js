import express from "express";
import { protect, authorize } from "../../middleware/auth.middleware.js";
import * as bookRequestController from "./bookRequest.controller.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// USER ROUTES (any logged-in user)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/book-requests               → Submit a new borrow/download request
router.post("/", protect, bookRequestController.createRequest);

// GET /api/book-requests/my             → Get logged-in user's own requests
router.get("/my", protect, bookRequestController.getUserRequests);

// PATCH /api/book-requests/:id/cancel   → Cancel own pending/waitlisted request
router.patch("/:id/cancel", protect, bookRequestController.cancelRequest);

// ═══════════════════════════════════════════════════════════════════════════════
// LIBRARIAN+ ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/book-requests                → Get all requests (with filters)
router.get(
  "/",
  protect,
  authorize("librarian", "manager", "admin"),
  bookRequestController.getAllRequests
);

// GET /api/book-requests/waitlist/:bookId  → Get waitlist for a specific book
router.get(
  "/waitlist/:bookId",
  protect,
  authorize("librarian", "manager", "admin"),
  bookRequestController.getWaitlist
);

// PATCH /api/book-requests/:id/approve  → Approve a pending request
router.patch(
  "/:id/approve",
  protect,
  authorize("librarian", "manager", "admin"),
  bookRequestController.approveRequest
);

// PATCH /api/book-requests/:id/reject   → Reject a pending/approved request
router.patch(
  "/:id/reject",
  protect,
  authorize("librarian", "manager", "admin"),
  bookRequestController.rejectRequest
);

// PATCH /api/book-requests/:id/issue    → Issue physical book (approved → issued)
router.patch(
  "/:id/issue",
  protect,
  authorize("librarian", "manager", "admin"),
  bookRequestController.issueBook
);

// PATCH /api/book-requests/:id/return   → Accept returned book (issued → returned)
router.patch(
  "/:id/return",
  protect,
  authorize("librarian", "manager", "admin"),
  bookRequestController.returnBook
);

export default router;
