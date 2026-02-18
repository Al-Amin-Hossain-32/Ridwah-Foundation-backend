import mongoose from "mongoose";

// ─── Review Sub-Schema ────────────────────────────────────────────────────────
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, "Review comment cannot exceed 500 characters"],
    },
  },
  { timestamps: true }
);

// ─── Book Schema ──────────────────────────────────────────────────────────────
const bookSchema = new mongoose.Schema(
  {
    // ── Core Info ──────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Book title is required"],
      trim: true,
      index: true,
    },
    author: {
      type: String,
      required: [true, "Author name is required"],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    genre: {
      type: [String],
      default: [],
    },
    language: {
      type: String,
      default: "Bengali",
      trim: true,
    },
    publishedYear: {
      type: Number,
      min: [1000, "Invalid published year"],
      max: [new Date().getFullYear(), "Published year cannot be in the future"],
    },
    publisher: {
      type: String,
      trim: true,
    },
    coverImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // ── Book Type ──────────────────────────────────────────────────────────────
    bookType: {
      type: String,
      enum: {
        values: ["physical", "digital", "hybrid"],
        message: "bookType must be physical, digital, or hybrid",
      },
      required: [true, "Book type is required"],
      default: "physical",
    },

    // ── Physical Copy Info ─────────────────────────────────────────────────────
    physical: {
      totalCopies: {
        type: Number,
        default: 0,
        min: [0, "Total copies cannot be negative"],
      },
      availableCopies: {
        type: Number,
        default: 0,
        min: [0, "Available copies cannot be negative"],
      },
      shelfLocation: {
        type: String,
        trim: true,
        default: "",
      },
    },

    // ── Digital Copy Info ──────────────────────────────────────────────────────
    digital: {
      fileUrl: { type: String, default: "" },
      filePublicId: { type: String, default: "" },
      fileFormat: {
        type: String,
        enum: {
          values: ["pdf", "epub", "mobi", ""],
          message: "File format must be pdf, epub, or mobi",
        },
        default: "",
      },
      fileSizeMb: { type: Number, default: 0 },
    },

    // ── Borrow Rules ───────────────────────────────────────────────────────────
    borrowDurationDays: {
      type: Number,
      default: 14,
      min: [1, "Borrow duration must be at least 1 day"],
    },

    // ── Reviews & Ratings ──────────────────────────────────────────────────────
    reviews: [reviewSchema],
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },

    // ── Status ─────────────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },

    // ── Added By ───────────────────────────────────────────────────────────────
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
bookSchema.index({ title: "text", author: "text", description: "text" });
bookSchema.index({ genre: 1 });
bookSchema.index({ bookType: 1 });
bookSchema.index({ isActive: 1 });
bookSchema.index({ averageRating: -1 });

// ─── Virtual: isAvailable ─────────────────────────────────────────────────────
bookSchema.virtual("isAvailable").get(function () {
  if (this.bookType === "digital") return true;
  return this.physical.availableCopies > 0;
});

// ─── Pre-save Hook ────────────────────────────────────────────────────────────
bookSchema.pre("save", async function () {
  // availableCopies কখনো totalCopies এর বেশি হবে না
  if (this.physical.availableCopies > this.physical.totalCopies) {
    this.physical.availableCopies = this.physical.totalCopies;
  }

  // Rating recalculate on every save
  if (this.reviews.length > 0) {
    const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
    this.averageRating = parseFloat((sum / this.reviews.length).toFixed(1));
    this.totalReviews = this.reviews.length;
  } else {
    this.averageRating = 0;
    this.totalReviews = 0;
  }
});

const Book = mongoose.model("Book", bookSchema);
export default Book;
