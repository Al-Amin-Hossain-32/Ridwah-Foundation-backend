import express from "express";
import { protect, authorize } from "../../middleware/auth.middleware.js";
import * as recurringController from "./recurringDonation.controller.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// USER ROUTES (login required)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/recurring-donations               → Create recurring donation
router.post("/", protect, recurringController.createRecurringDonation);

// GET /api/recurring-donations/my             → Get user's recurring donations
router.get("/my", protect, recurringController.getUserRecurringDonations);

// PATCH /api/recurring-donations/:id/pause    → Pause recurring donation
router.patch("/:id/pause", protect, recurringController.pauseRecurringDonation);

// PATCH /api/recurring-donations/:id/resume   → Resume recurring donation
router.patch("/:id/resume", protect, recurringController.resumeRecurringDonation);

// PATCH /api/recurring-donations/:id/cancel   → Cancel recurring donation
router.patch("/:id/cancel", protect, recurringController.cancelRecurringDonation);

// POST /api/recurring-donations/:id/pay       → Make recurring payment
router.post("/:id/pay", protect, recurringController.makeRecurringPayment);

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER+ ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/recurring-donations                → Get all recurring donations
router.get(
  "/",
  protect,
  authorize("manager", "admin"),
  recurringController.getAllRecurringDonations
);

// GET /api/recurring-donations/overdue        → Get overdue recurring donations
router.get(
  "/overdue",
  protect,
  authorize("manager", "admin"),
  recurringController.getOverdueRecurringDonations
);

export default router;
