import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    // ── Basic Info ─────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Campaign title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Campaign description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    coverImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // ── Goal & Progress ────────────────────────────────────────────────────────
    goalAmount: {
      type: Number,
      required: [true, "Goal amount is required"],
      min: [100, "Goal amount must be at least 100"],
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Timeline ───────────────────────────────────────────────────────────────
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },

    // ── Status ─────────────────────────────────────────────────────────────────
    // draft     → not published yet
    // active    → accepting donations
    // completed → goal reached
    // expired   → deadline passed
    status: {
      type: String,
      enum: {
        values: ["draft", "active", "completed", "expired"],
        message: "Status must be draft, active, completed, or expired",
      },
      default: "draft",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // ── Created By ─────────────────────────────────────────────────────────────
    createdBy: {
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
campaignSchema.index({ status: 1, isActive: 1 });
campaignSchema.index({ endDate: 1 });
campaignSchema.index({ startDate: 1 });

// ─── Virtual: Progress Percentage ─────────────────────────────────────────────
campaignSchema.virtual("progressPercentage").get(function () {
  if (this.goalAmount === 0) return 0;
  return Math.min(Math.round((this.currentAmount / this.goalAmount) * 100), 100);
});

// ─── Virtual: Is Expired ──────────────────────────────────────────────────────
campaignSchema.virtual("isExpired").get(function () {
  return new Date() > this.endDate;
});

// ─── Virtual: Days Remaining ──────────────────────────────────────────────────
campaignSchema.virtual("daysRemaining").get(function () {
  const diff = this.endDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// ─── Pre-save: Validate dates ─────────────────────────────────────────────────
campaignSchema.pre("save", async function () {
  if (this.startDate >= this.endDate) {
    throw new Error("End date must be after start date");
  }

  // Auto-update status based on goal and date
  if (this.currentAmount >= this.goalAmount) {
    this.status = "completed";
  } else if (new Date() > this.endDate) {
    this.status = "expired";
  }
});

const Campaign = mongoose.model("Campaign", campaignSchema);
export default Campaign;
