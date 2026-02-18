import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    // ── Donor Info ─────────────────────────────────────────────────────────────
    // If donor is null → guest donation
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestDonorInfo: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },

    // ── Donation Details ───────────────────────────────────────────────────────
    amount: {
      type: Number,
      required: [true, "Donation amount is required"],
      min: [10, "Minimum donation is 10 Taka"],
    },
    donationType: {
      type: String,
      enum: {
        values: ["one-time", "recurring"],
        message: "Donation type must be one-time or recurring",
      },
      required: true,
      default: "one-time",
    },

    // ── Campaign (optional) ────────────────────────────────────────────────────
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
    },

    // ── Payment Info ───────────────────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: {
        values: ["cash", "bkash", "nagad", "rocket", "bank"],
        message: "Invalid payment method",
      },
      required: [true, "Payment method is required"],
    },
    paymentReference: {
      type: String,
      trim: true,
      default: "",
      // bKash TrxID, Bank reference number, etc.
    },
    paymentProof: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // ── Status ─────────────────────────────────────────────────────────────────
    // pending   → waiting for manager approval
    // completed → approved and receipt generated
    // failed    → rejected or payment failed
    // refunded  → টাকা ফেরত (rare)
    status: {
      type: String,
      enum: {
        values: ["pending", "completed", "failed", "refunded"],
        message: "Invalid status",
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
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Receipt ────────────────────────────────────────────────────────────────
    receiptUrl: {
      type: String,
      default: "",
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true, // null values won't be checked for uniqueness
    },

    // ── Donor Preferences ──────────────────────────────────────────────────────
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    message: {
      type: String,
      trim: true,
      maxlength: [500, "Message cannot exceed 500 characters"],
      default: "",
    },

    // ── Recurring Donation Link ────────────────────────────────────────────────
    recurringDonation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecurringDonation",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
donationSchema.index({ donor: 1, createdAt: -1 });
donationSchema.index({ campaign: 1, status: 1 });
donationSchema.index({ status: 1, createdAt: -1 });
donationSchema.index({ donationType: 1 });
donationSchema.index({ transactionId: 1 });

// ─── Pre-save: Generate Transaction ID ────────────────────────────────────────
donationSchema.pre("save", async function () {
  if (!this.transactionId && this.status === "completed") {
    // Generate unique transaction ID: DN-YYYYMMDD-RANDOM
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.transactionId = `DN-${date}-${random}`;
  }
});

const Donation = mongoose.model("Donation", donationSchema);
export default Donation;
