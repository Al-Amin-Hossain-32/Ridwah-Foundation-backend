import {cloudinary} from "../../config/cloudinary.js";
import Campaign from "./campaign.model.js";
import Donation from "./donation.model.js";

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

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Create Campaign ──────────────────────────────────────────────────────────
export const createCampaign = async (campaignData, managerId) => {
  const { title, description, goalAmount, startDate, endDate, status } =
    campaignData;

  const campaign = await Campaign.create({
    title,
    description,
    goalAmount,
    startDate,
    endDate,
    status: status || "draft",
    createdBy: managerId,
  });

  return campaign;
};

// ─── Get All Campaigns ────────────────────────────────────────────────────────
export const getAllCampaigns = async (query) => {
  const { status, isActive, sortBy = "newest", page = 1, limit = 10 } = query;

  const filter = {};
  if (status) filter.status = status;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    progress: { currentAmount: -1 },
    deadline: { endDate: 1 },
  };
  const sort = sortOptions[sortBy] || sortOptions.newest;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [campaigns, total] = await Promise.all([
    Campaign.find(filter)
      .populate("createdBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean({ virtuals: true }),
    Campaign.countDocuments(filter),
  ]);

  return {
    campaigns,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Get Campaign By ID ───────────────────────────────────────────────────────
export const getCampaignById = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId)
    .populate("createdBy", "name email")
    .lean({ virtuals: true });

  if (!campaign) {
    const err = new Error("Campaign not found");
    err.statusCode = 404;
    throw err;
  }

  // Get recent donations for this campaign
  const recentDonations = await Donation.find({
    campaign: campaignId,
    status: "completed",
  })
    .populate("donor", "name avatar")
    .sort({ approvedAt: -1 })
    .limit(10)
    .select("amount donor guestDonorInfo isAnonymous approvedAt")
    .lean();

  return { campaign, recentDonations };
};

// ─── Update Campaign ──────────────────────────────────────────────────────────
export const updateCampaign = async (campaignId, updateData) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    const err = new Error("Campaign not found");
    err.statusCode = 404;
    throw err;
  }

  const allowedFields = [
    "title",
    "description",
    "goalAmount",
    "startDate",
    "endDate",
    "status",
    "isActive",
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      campaign[field] = updateData[field];
    }
  });

  await campaign.save();
  return campaign;
};

// ─── Delete Campaign ──────────────────────────────────────────────────────────
export const deleteCampaign = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    const err = new Error("Campaign not found");
    err.statusCode = 404;
    throw err;
  }

  // Check if campaign has donations
  const donationCount = await Donation.countDocuments({
    campaign: campaignId,
    status: "completed",
  });

  if (donationCount > 0) {
    const err = new Error(
      "Cannot delete campaign with existing donations. Deactivate it instead."
    );
    err.statusCode = 400;
    throw err;
  }

  // Delete cover image
  if (campaign.coverImage?.publicId) {
    await cloudinary.uploader.destroy(campaign.coverImage.publicId);
  }

  await campaign.deleteOne();
  return { message: "Campaign deleted successfully" };
};

// ─── Upload Cover Image ───────────────────────────────────────────────────────
export const uploadCoverImage = async (campaignId, fileBuffer) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    const err = new Error("Campaign not found");
    err.statusCode = 404;
    throw err;
  }

  // Delete old cover
  if (campaign.coverImage?.publicId) {
    await cloudinary.uploader.destroy(campaign.coverImage.publicId);
  }

  const result = await uploadToCloudinary(fileBuffer, {
    folder: "foundation/campaigns",
    resource_type: "image",
    transformation: [
      { width: 800, height: 450, crop: "fill", quality: "auto" },
    ],
  });

  campaign.coverImage = {
    url: result.secure_url,
    publicId: result.public_id,
  };

  await campaign.save();
  return campaign;
};

// ─── Update Campaign Progress (called after donation approval) ────────────────
export const updateCampaignProgress = async (campaignId, amount) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) return;

  campaign.currentAmount += amount;
  await campaign.save(); // pre-save will auto-update status if goal reached

  return campaign;
};
