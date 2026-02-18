import mongoose from "mongoose";

const recurringDonationSchema = new mongoose.Schema(
  {
    // ── Donor ──────────────────────────────────────────────────────────────────
    // Recurring donation শুধু registered user দের জন্য
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Donor is required for recurring donations"],
    },

    // ── Recurring Details ──────────────────────────────────────────────────────
    amount: {
      type: Number,
      required: [true, "Recurring amount is required"],
      min: [50, "Minimum recurring donation is 50 Taka"],
    },
    frequency: {
      type: String,
      enum: {
        values: ["monthly", "quarterly", "yearly"],
        message: "Frequency must be monthly, quarterly, or yearly",
      },
      required: true,
      default: "monthly",
    },

    // ── Optional Campaign ──────────────────────────────────────────────────────
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
    },

    // ── Schedule ───────────────────────────────────────────────────────────────
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    nextDueDate: {
      type: Date,
      
    },
    lastPaidDate: {
      type: Date,
      default: null,
    },

    // ── Status ─────────────────────────────────────────────────────────────────
    // active    → subscription running
    // paused    → temporarily stopped
    // cancelled → permanently stopped
    status: {
      type: String,
      enum: {
        values: ["active", "paused", "cancelled"],
        message: "Invalid status",
      },
      default: "active",
      index: true,
    },

    // ── Payment History (embedded array) ───────────────────────────────────────
    paymentHistory: [
      {
        paidAt: { type: Date, required: true },
        amount: { type: Number, required: true },
        donationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Donation",
        },
      },
    ],

    // ── Preferences ────────────────────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ["cash", "bkash", "nagad", "rocket", "bank"],
      default: "bkash",
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
recurringDonationSchema.index({ donor: 1, status: 1 });
recurringDonationSchema.index({ nextDueDate: 1, status: 1 });
recurringDonationSchema.index({ status: 1 });

// ─── Virtual: Total Paid ──────────────────────────────────────────────────────
recurringDonationSchema.virtual("totalPaid").get(function () {
  return this.paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
});

// ─── Virtual: Payment Count ───────────────────────────────────────────────────
recurringDonationSchema.virtual("paymentCount").get(function () {
  return this.paymentHistory.length;
});

// ─── Virtual: Is Overdue ──────────────────────────────────────────────────────
recurringDonationSchema.virtual("isOverdue").get(function () {
  if (this.status !== "active") return false;
  return new Date() > this.nextDueDate;
});

// ─── Pre-save: Calculate nextDueDate ──────────────────────────────────────────
recurringDonationSchema.pre("save", async function () {
  // Calculate nextDueDate on first save or if not set
  if (!this.nextDueDate) {
    const start = this.startDate || new Date();
    const next = new Date(start);

    switch (this.frequency) {
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        break;
      case "quarterly":
        next.setMonth(next.getMonth() + 3);
        break;
      case "yearly":
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    this.nextDueDate = next;
  }
});

const RecurringDonation = mongoose.model(
  "RecurringDonation",
  recurringDonationSchema
);
export default RecurringDonation;
