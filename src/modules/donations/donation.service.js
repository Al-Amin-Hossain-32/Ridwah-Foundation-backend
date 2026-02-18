import {cloudinary} from "../../config/cloudinary.js";
import Donation from "./donation.model.js";
import Campaign from "./campaign.model.js";
import RecurringDonation from "./recurringDonation.model.js";
import { generateReceipt } from "../../utils/receiptGenerator.js";
import { updateCampaignProgress } from "./campaign.service.js";
import { getSocketInstance, getOnlineUsers } from "../../config/socket.js";

// ─── Helper: Cloudinary Upload ────────────────────────────────────────────────
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
};

// ─── Helper: Socket Notification ──────────────────────────────────────────────
const notifyUser = (userId, event, data) => {
  try {
    const io = getSocketInstance();
    const onlineUsers = getOnlineUsers();
    const socketId = onlineUsers.get(userId.toString());
    if (socketId) {
      io.to(socketId).emit(event, data);
    }
  } catch {
    // Socket not initialized
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER/GUEST ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Create Donation ──────────────────────────────────────────────────────────
export const createDonation = async (donationData, userId = null) => {
  const {
    amount,
    donationType,
    campaignId,
    paymentMethod,
    paymentReference,
    isAnonymous,
    message,
    guestDonorInfo,
  } = donationData;

  // Validate campaign if provided
  if (campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      const err = new Error("Campaign not found");
      err.statusCode = 404;
      throw err;
    }
    if (campaign.status !== "active") {
      const err = new Error("Campaign is not active");
      err.statusCode = 400;
      throw err;
    }
  }

  // Guest donation validation
  if (!userId && (!guestDonorInfo || !guestDonorInfo.name || !guestDonorInfo.email)) {
    const err = new Error("Guest donor info (name, email) is required");
    err.statusCode = 400;
    throw err;
  }

  // Create donation
  const donation = await Donation.create({
    donor: userId,
    guestDonorInfo: userId ? {} : guestDonorInfo,
    amount,
    donationType,
    campaign: campaignId || null,
    paymentMethod,
    paymentReference,
    isAnonymous: isAnonymous || false,
    message: message || "",
    status: "pending",
  });

  await donation.populate([
    { path: "campaign", select: "title goalAmount currentAmount" },
    { path: "donor", select: "name email avatar" },
  ]);

  return donation;
};

// ─── Upload Payment Proof ─────────────────────────────────────────────────────
export const uploadPaymentProof = async (donationId, fileBuffer, userId = null) => {
  const donation = await Donation.findById(donationId);
  if (!donation) {
    const err = new Error("Donation not found");
    err.statusCode = 404;
    throw err;
  }

  // Authorization check (user can only upload proof for their own donation)
  if (userId && donation.donor && donation.donor.toString() !== userId.toString()) {
    const err = new Error("Not authorized to upload proof for this donation");
    err.statusCode = 403;
    throw err;
  }

  if (donation.status !== "pending") {
    const err = new Error("Can only upload proof for pending donations");
    err.statusCode = 400;
    throw err;
  }

  // Delete old proof
  if (donation.paymentProof?.publicId) {
    await cloudinary.uploader.destroy(donation.paymentProof.publicId);
  }

  const result = await uploadToCloudinary(fileBuffer, {
    folder: "foundation/payment-proofs",
    resource_type: "image",
  });

  donation.paymentProof = {
    url: result.secure_url,
    publicId: result.public_id,
  };

  await donation.save();
  return donation;
};

// ─── Get User's Own Donations ─────────────────────────────────────────────────
export const getUserDonations = async (userId, query) => {
  const { status, page = 1, limit = 10 } = query;

  const filter = { donor: userId };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .populate("campaign", "title coverImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Donation.countDocuments(filter),
  ]);

  return {
    donations,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Get All Donations ────────────────────────────────────────────────────────
export const getAllDonations = async (query) => {
  const {
    status,
    donationType,
    campaignId,
    paymentMethod,
    page = 1,
    limit = 10,
  } = query;

  const filter = {};
  if (status) filter.status = status;
  if (donationType) filter.donationType = donationType;
  if (campaignId) filter.campaign = campaignId;
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .populate("donor", "name email avatar")
      .populate("campaign", "title")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Donation.countDocuments(filter),
  ]);

  return {
    donations,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Get Donation By ID ───────────────────────────────────────────────────────
export const getDonationById = async (donationId) => {
  const donation = await Donation.findById(donationId)
    .populate("donor", "name email avatar phone")
    .populate("campaign", "title goalAmount currentAmount")
    .populate("approvedBy", "name email")
    .lean();

  if (!donation) {
    const err = new Error("Donation not found");
    err.statusCode = 404;
    throw err;
  }

  return donation;
};

// ─── Approve Donation ─────────────────────────────────────────────────────────
export const approveDonation = async (managerId, donationId) => {
  const donation = await Donation.findById(donationId)
    .populate("donor", "name email")
    .populate("campaign", "title");

  if (!donation) {
    const err = new Error("Donation not found");
    err.statusCode = 404;
    throw err;
  }

  if (donation.status !== "pending") {
    const err = new Error(`Cannot approve donation with status: ${donation.status}`);
    err.statusCode = 400;
    throw err;
  }

  donation.status = "completed";
  donation.approvedBy = managerId;
  donation.approvedAt = new Date();

  // Save to generate transactionId (pre-save hook)
  await donation.save();

  // Generate receipt PDF
  try {
    const receiptUrl = await generateReceipt(donation);
    donation.receiptUrl = receiptUrl;
    await donation.save();
  } catch (error) {
    console.error("Receipt generation failed:", error);
    // Continue even if receipt fails
  }

  // Update campaign progress
  if (donation.campaign) {
    await updateCampaignProgress(donation.campaign._id, donation.amount);
  }

  // Update recurring donation payment history
  if (donation.recurringDonation) {
    const recurring = await RecurringDonation.findById(donation.recurringDonation);
    if (recurring) {
      recurring.paymentHistory.push({
        paidAt: donation.approvedAt,
        amount: donation.amount,
        donationId: donation._id,
      });
      recurring.lastPaidDate = donation.approvedAt;

      // Calculate next due date
      const next = new Date(donation.approvedAt);
      switch (recurring.frequency) {
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
      recurring.nextDueDate = next;
      await recurring.save();
    }
  }

  // Socket notification
  if (donation.donor) {
    notifyUser(donation.donor._id, "donation:approved", {
      message: "Your donation has been approved! Thank you.",
      donationId: donation._id,
      amount: donation.amount,
      transactionId: donation.transactionId,
      receiptUrl: donation.receiptUrl,
    });
  }

  return donation;
};

// ─── Reject Donation ──────────────────────────────────────────────────────────
export const rejectDonation = async (managerId, donationId, rejectionReason) => {
  const donation = await Donation.findById(donationId).populate("donor", "name");

  if (!donation) {
    const err = new Error("Donation not found");
    err.statusCode = 404;
    throw err;
  }

  if (donation.status !== "pending") {
    const err = new Error(`Cannot reject donation with status: ${donation.status}`);
    err.statusCode = 400;
    throw err;
  }

  donation.status = "failed";
  donation.approvedBy = managerId;
  donation.approvedAt = new Date();
  donation.rejectionReason = rejectionReason || "No reason provided";
  await donation.save();

  // Socket notification
  if (donation.donor) {
    notifyUser(donation.donor._id, "donation:rejected", {
      message: "Your donation was not approved.",
      reason: donation.rejectionReason,
      donationId: donation._id,
    });
  }

  return donation;
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export const getDonorLeaderboard = async (query) => {
  const { period = "all", limit = 10 } = query;

  // Date filter based on period
  const filter = { status: "completed", isAnonymous: false };

  if (period === "month") {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    filter.approvedAt = { $gte: startOfMonth };
  } else if (period === "year") {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    filter.approvedAt = { $gte: startOfYear };
  }

  // Aggregate donations by donor
  const leaderboard = await Donation.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$donor",
        totalDonated: { $sum: "$amount" },
        donationCount: { $sum: 1 },
      },
    },
    { $sort: { totalDonated: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "donorInfo",
      },
    },
    { $unwind: "$donorInfo" },
    {
      $project: {
        _id: 0,
        donor: {
          _id: "$donorInfo._id",
          name: "$donorInfo.name",
          avatar: "$donorInfo.avatar",
        },
        totalDonated: 1,
        donationCount: 1,
      },
    },
  ]);

  return { leaderboard, period };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS (for admin dashboard)
// ═══════════════════════════════════════════════════════════════════════════════

export const getDonationAnalytics = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalRaised,
    thisMonth,
    thisYear,
    totalDonors,
    completedCount,
    pendingCount,
    byPaymentMethod,
  ] = await Promise.all([
    // Total raised (all time)
    Donation.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    // This month
    Donation.aggregate([
      { $match: { status: "completed", approvedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),

    // This year
    Donation.aggregate([
      { $match: { status: "completed", approvedAt: { $gte: startOfYear } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),

    // Unique donors
    Donation.distinct("donor", { status: "completed", donor: { $ne: null } }),

    // Completed donations count
    Donation.countDocuments({ status: "completed" }),

    // Pending donations count
    Donation.countDocuments({ status: "pending" }),

    // By payment method
    Donation.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: "$paymentMethod", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    totalRaised: totalRaised[0]?.total || 0,
    thisMonth: {
      amount: thisMonth[0]?.total || 0,
      count: thisMonth[0]?.count || 0,
    },
    thisYear: {
      amount: thisYear[0]?.total || 0,
      count: thisYear[0]?.count || 0,
    },
    totalDonors: totalDonors.length,
    completedCount,
    pendingCount,
    averageDonation:
      completedCount > 0
        ? Math.round((totalRaised[0]?.total || 0) / completedCount)
        : 0,
    byPaymentMethod,
  };
};
