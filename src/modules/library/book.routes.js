import express from "express";
import multer from "multer";
import { protect, authorize } from "../../middleware/auth.middleware.js";
import * as bookController from "./book.controller.js";

const router = express.Router();

// ─── Multer Config (memory storage → Cloudinary) ─────────────────────────────
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed for cover"), false);
    }
    cb(null, true);
  },
});

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/epub+zip",
      "application/x-mobipocket-ebook",
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(
        new Error("Only pdf, epub, mobi files are allowed for digital upload"),
        false
      );
    }
    cb(null, true);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/books         → Get all books (search, filter, paginate)
router.get("/", bookController.getAllBooks);

// GET /api/books/:id     → Get single book detail
router.get("/:id", bookController.getBookById);

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES (login required)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/books/:id/review     → Add review (any logged-in user)
router.post("/:id/review", protect, bookController.addReview);

// PUT /api/books/:id/review      → Update own review
router.put("/:id/review", protect, bookController.updateReview);

// DELETE /api/books/:id/review   → Delete own review (admin can delete any)
router.delete("/:id/review", protect, bookController.deleteReview);

// ═══════════════════════════════════════════════════════════════════════════════
// LIBRARIAN+ ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/books                → Create a new book
router.post(
  "/",
  protect,
  authorize("librarian", "manager", "admin"),
  bookController.createBook
);

// PUT /api/books/:id             → Update book info
router.put(
  "/:id",
  protect,
  authorize("librarian", "manager", "admin"),
  bookController.updateBook
);

// POST /api/books/:id/cover      → Upload cover image
router.post(
  "/:id/cover",
  protect,
  authorize("librarian", "manager", "admin"),
  imageUpload.single("cover"),
  bookController.uploadCover
);

// POST /api/books/:id/file       → Upload digital file (pdf/epub/mobi)
router.post(
  "/:id/file",
  protect,
  authorize("librarian", "manager", "admin"),
  fileUpload.single("file"),
  bookController.uploadDigitalFile
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ONLY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// DELETE /api/books/:id          → Delete book (admin only)
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  bookController.deleteBook
);

export default router;
