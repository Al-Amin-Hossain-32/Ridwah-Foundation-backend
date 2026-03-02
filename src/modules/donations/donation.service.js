import {cloudinary} from "../../config/cloudinary.js";
import Donation from "./donation.model.js";
import Campaign from "./campaign.model.js";
import { updateCampaignProgress } from "./campaign.service.js";
import { getIO } from "../../config/socket.js";

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

// ─── Helper: emit socket event safely ────────────────────────────────────────
const emit = (event, data) => {
  try {
    getIO().emit(event, data);
  } catch {
    // socket not initialized in test/dev — silently ignore
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE DONATION
// ═══════════════════════════════════════════════════════════════════════════════
export const createDonation = async (donationData, userId) => {
  const {
    campaignId, amount, paymentMethod,
    paymentReference, message, isAnonymous,
    guestName, guestEmail, guestPhone,
  } = donationData;

  const donation = await Donation.create({
    donor: userId,
    guestDonorInfo: userId
      ? {}
      : { name: guestName, email: guestEmail, phone: guestPhone },
    amount,
    campaign: campaignId || null,
    paymentMethod,
    paymentReference: paymentReference || "",
    message: message || "",
    isAnonymous: isAnonymous || false,
    status: "pending",
  });

  await donation.populate([
    { path: "campaign", select: "title goalAmount" },
    { path: "donor", select: "name profilePicture" },
  ]);

  // ── Socket: manager/admin কে জানাও নতুন donation এলো ────────────────────
  emit("newDonation", donation.toObject());

  return donation;
};

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD PAYMENT PROOF
// ═══════════════════════════════════════════════════════════════════════════════
export const uploadPaymentProof = async (donationId, fileBuffer, userId) => {
  const donation = await Donation.findById(donationId);
  if (!donation) {
    const err = new Error("Donation not found");
    err.statusCode = 404;
    throw err;
  }

  // authorization check — guest বা owner
  if (userId && donation.donor?.toString() !== userId.toString()) {
    const err = new Error("Not authorized");
    err.statusCode = 403;
    throw err;
  }

  const result = await uploadToCloudinary(fileBuffer, {
    folder: "foundation/proofs",
    resource_type: "image",
  });

  donation.paymentProof = {
    url: result.secure_url,
    publicId: result.public_id,
  };

  await donation.save();
  return donation;
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET USER DONATIONS
// ═══════════════════════════════════════════════════════════════════════════════
export const getUserDonations = async (userId, query) => {
  const { status, page = 1, limit = 20 } = query;
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
    pagination: { total, page: parseInt(page), limit: parseInt(limit) },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET ALL DONATIONS (Manager)
// ═══════════════════════════════════════════════════════════════════════════════
export const getAllDonations = async (query) => {
  const { status, campaign, page = 1, limit = 20, sortBy = "newest" } = query;

  const filter = {};
  if (status) filter.status = status;
  if (campaign) filter.campaign = campaign;

  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    amount: { amount: -1 },
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .populate("donor", "name email profilePicture")
      .populate("campaign", "title")
      .populate("approvedBy", "name")
      .sort(sortOptions[sortBy] || sortOptions.newest)
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
// GET DONATION BY ID
// ═══════════════════════════════════════════════════════════════════════════════
export const getDonationById = async (donationId) => {
  const donation = await Donation.findById(donationId)
    .populate("donor", "name email profilePicture")
    .populate("campaign", "title goalAmount currentAmount")
    .populate("approvedBy", "name")
    .lean();

  if (!donation) {
    const err = new Error("Donation not found");
    err.statusCode = 404;
    throw err;
  }
  return donation;
};

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVE DONATION
// ═══════════════════════════════════════════════════════════════════════════════
export const approveDonation = async (managerId, donationId) => {
  const donation = await Donation.findById(donationId);
  if (!donation) {
    const err = new Error("Donation not found");
    err.statusCode = 404;
    throw err;
  }

  if (donation.status !== "pending") {
    const err = new Error("Only pending donations can be approved");
    err.statusCode = 400;
    throw err;
  }

  donation.status     = "completed";
  donation.approvedBy = managerId;
  donation.approvedAt = new Date();
  await donation.save(); // pre-save generates transactionId

  await donation.populate([
    { path: "donor", select: "name email profilePicture" },
    { path: "campaign", select: "title" },
    { path: "approvedBy", select: "name" },
  ]);

  // ── Update campaign progress ──────────────────────────────────────────────
  let campaignData = null;
  if (donation.campaign) {
    const updatedCampaign = await updateCampaignProgress(
      donation.campaign._id || donation.campaign,
      donation.amount
    );
    if (updatedCampaign) {
      campaignData = {
        campaignId:         updatedCampaign._id.toString(),
        currentAmount:      updatedCampaign.currentAmount,
        status:             updatedCampaign.status,
        progressPercentage: updatedCampaign.progressPercentage,
      };
    }
  }

  const donationObj = donation.toObject();

  // ── Socket: সবাইকে জানাও ──────────────────────────────────────────────────
  // 1. donation status update (manager list + donor myList)
  emit("donationStatusUpdated", donationObj);

  // 2. campaign progress update (সবার campaign page)
  if (campaignData) {
    emit("campaignProgressUpdated", campaignData);
  }

  // 3. donor কে personal notification (তার room-এ)
  if (donation.donor?._id) {
    try {
      getIO()
        .to(donation.donor._id.toString())
        .emit("donationApproved", {
          donationId:    donationObj._id,
          amount:        donationObj.amount,
          transactionId: donationObj.transactionId,
          campaign:      donationObj.campaign,
        });
    } catch { /* ignore */ }
  }

  return donation;
};

// ═══════════════════════════════════════════════════════════════════════════════
// REJECT DONATION
// ═══════════════════════════════════════════════════════════════════════════════
export const rejectDonation = async (managerId, donationId, rejectionReason) => {
  const donation = await Donation.findById(donationId);
  if (!donation) {
    const err = new Error("Donation not found");
    err.statusCode = 404;
    throw err;
  }

  if (donation.status !== "pending") {
    const err = new Error("Only pending donations can be rejected");
    err.statusCode = 400;
    throw err;
  }

  donation.status          = "failed";
  donation.approvedBy      = managerId;
  donation.approvedAt      = new Date();
  donation.rejectionReason = rejectionReason || "";
  await donation.save();

  await donation.populate([
    { path: "donor", select: "name email profilePicture" },
    { path: "campaign", select: "title" },
    { path: "approvedBy", select: "name" },
  ]);

  const donationObj = donation.toObject();

  // ── Socket: donation rejected ─────────────────────────────────────────────
  emit("donationStatusUpdated", donationObj);

  // donor কে personal notification
  if (donation.donor?._id) {
    try {
      getIO()
        .to(donation.donor._id.toString())
        .emit("donationRejected", {
          donationId:      donationObj._id,
          amount:          donationObj.amount,
          rejectionReason: donationObj.rejectionReason,
        });
    } catch { /* ignore */ }
  }

  return donation;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DONOR LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export const getDonorLeaderboard = async (query) => {
  const { limit = 10 } = query;

  const leaderboard = await Donation.aggregate([
    { $match: { status: "completed", isAnonymous: false, donor: { $ne: null } } },
    { $group: { _id: "$donor", totalAmount: { $sum: "$amount" }, donationCount: { $sum: 1 } } },
    { $sort: { totalAmount: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "donor",
        pipeline: [{ $project: { name: 1, profilePicture: 1 } }],
      },
    },
    { $unwind: "$donor" },
  ]);

  return leaderboard;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════
export const getDonationAnalytics = async () => {
  const [totals, monthly] = await Promise.all([
    Donation.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
    ]),
    Donation.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: {
            year:  { $year: "$approvedAt" },
            month: { $month: "$approvedAt" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]),
  ]);

  return { totals, monthly };
};