import mongoose from "mongoose";

const bookRequestSchema = new mongoose.Schema(
  {
    // ── Core References ────────────────────────────────────────────────────────
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: [true, "Book reference is required"],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },

    // ── Request Type ───────────────────────────────────────────────────────────
    // borrow   → physical copy নেওয়া
    // download → digital file access
    requestType: {
      type: String,
      enum: {
        values: ["borrow", "download"],
        message: "requestType must be borrow or download",
      },
      required: [true, "Request type is required"],
    },

    // ── Status Flow ────────────────────────────────────────────────────────────
    // pending     → request করা হয়েছে, librarian approve করেনি
    // approved    → librarian approve করেছে (physical: issue বাকি)
    // rejected    → librarian reject করেছে
    // issued      → physical বই হাতে দেওয়া হয়েছে
    // returned    → বই ফেরত দেওয়া হয়েছে
    // waitlisted  → copies নেই, queue তে আছে
    // cancelled   → user নিজে cancel করেছে
    status: {
      type: String,
      enum: {
        values: [
          "pending",
          "approved",
          "rejected",
          "issued",
          "returned",
          "waitlisted",
          "cancelled",
        ],
        message: "Invalid request status",
      },
      default: "pending",
      index: true,
    },

    // ── Approval Tracking ──────────────────────────────────────────────────────
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Issue & Return Tracking ────────────────────────────────────────────────
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    issuedAt: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    returnedAt: {
      type: Date,
      default: null,
    },
    returnAcceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Waitlist ───────────────────────────────────────────────────────────────
    waitlistPosition: {
      type: Number,
      default: null,
    },
    waitlistNotifiedAt: {
      type: Date,
      default: null,  // waitlist থেকে available হলে notify করা হয়েছে কিনা
    },

    // ── User Note (optional request note) ─────────────────────────────────────
    userNote: {
      type: String,
      trim: true,
      maxlength: [300, "Note cannot exceed 300 characters"],
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Indexes ─────────────────────────────────────────────────────────
// একজন user একটি বইয়ের জন্য duplicate active request করতে পারবে না
bookRequestSchema.index({ book: 1, user: 1, status: 1 });
bookRequestSchema.index({ status: 1, createdAt: -1 });
bookRequestSchema.index({ dueDate: 1, status: 1 }); // overdue queries

// ─── Virtual: isOverdue ───────────────────────────────────────────────────────
bookRequestSchema.virtual("isOverdue").get(function () {
  if (this.status !== "issued" || !this.dueDate) return false;
  return new Date() > this.dueDate;
});

// ─── Virtual: daysRemaining ───────────────────────────────────────────────────
bookRequestSchema.virtual("daysRemaining").get(function () {
  if (this.status !== "issued" || !this.dueDate) return null;
  const diff = this.dueDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

const BookRequest = mongoose.model("BookRequest", bookRequestSchema);
export default BookRequest;
