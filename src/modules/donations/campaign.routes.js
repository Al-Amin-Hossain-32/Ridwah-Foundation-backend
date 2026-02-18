import express from "express";
import multer from "multer";
import { protect, authorize } from "../../middleware/auth.middleware.js";
import * as campaignController from "./campaign.controller.js";

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

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/campaigns         → Get all campaigns (public can see active)
router.get("/", campaignController.getAllCampaigns);

// GET /api/campaigns/:id     → Get campaign details + recent donations
router.get("/:id", campaignController.getCampaignById);

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER+ ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/campaigns        → Create new campaign
router.post(
  "/",
  protect,
  authorize("manager", "admin"),
  campaignController.createCampaign
);

// PUT /api/campaigns/:id     → Update campaign
router.put(
  "/:id",
  protect,
  authorize("manager", "admin"),
  campaignController.updateCampaign
);

// DELETE /api/campaigns/:id  → Delete campaign
router.delete(
  "/:id",
  protect,
  authorize("manager", "admin"),
  campaignController.deleteCampaign
);

// POST /api/campaigns/:id/cover → Upload cover image
router.post(
  "/:id/cover",
  protect,
  authorize("manager", "admin"),
  imageUpload.single("cover"),
  campaignController.uploadCover
);

export default router;
