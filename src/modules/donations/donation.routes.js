import express from "express";
import multer from "multer";
import { protect, authorize } from "../../middleware/auth.middleware.js";
import * as donationController from "./donation.controller.js";

const router = express.Router();

// ─── Multer Config ────────────────────────────────────────────────────────────
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

// ─── Optional Auth Middleware ─────────────────────────────────────────────────
// Allows both authenticated users and guests
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    req.user = null; // Guest
    return next();
  }

  // If token exists, use protect middleware
  protect(req, res, next);
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC / GUEST / USER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/donations                → Create donation (guest or user)
router.post("/", optionalAuth, donationController.createDonation);

// POST /api/donations/:id/proof      → Upload payment proof
router.post(
  "/:id/proof",
  optionalAuth,
  imageUpload.single("proof"),
  donationController.uploadPaymentProof
);

// GET /api/donations/leaderboard     → Public donor leaderboard
router.get("/leaderboard", donationController.getLeaderboard);

// ═══════════════════════════════════════════════════════════════════════════════
// USER ROUTES (login required)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/donations/my              → Get user's own donations
router.get("/my", protect, donationController.getUserDonations);

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER+ ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/donations                 → Get all donations (with filters)
router.get(
  "/",
  protect,
  authorize("manager", "admin"),
  donationController.getAllDonations
);

// GET /api/donations/analytics       → Donation analytics
router.get(
  "/analytics",
  protect,
  authorize("manager", "admin"),
  donationController.getAnalytics
);

// GET /api/donations/:id             → Get donation details
router.get(
  "/:id",
  protect,
  authorize("manager", "admin"),
  donationController.getDonationById
);

// PATCH /api/donations/:id/approve   → Approve donation
router.patch(
  "/:id/approve",
  protect,
  authorize("manager", "admin"),
  donationController.approveDonation
);

// PATCH /api/donations/:id/reject    → Reject donation
router.patch(
  "/:id/reject",
  protect,
  authorize("manager", "admin"),
  donationController.rejectDonation
);

export default router;
