import RecurringDonation from "./recurringDonation.model.js";
import Donation from "./donation.model.js";
import Campaign from "./campaign.model.js";

// ═══════════════════════════════════════════════════════════════════════════════
// USER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Create Recurring Donation ────────────────────────────────────────────────
export const createRecurringDonation = async (userId, recurringData) => {
  const { amount, frequency, campaignId, paymentMethod, isAnonymous } =
    recurringData;

  // Validate campaign
  if (campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      const err = new Error("Campaign not found");
      err.statusCode = 404;
      throw err;
    }
  }

  // Check if user already has active recurring donation
  const existing = await RecurringDonation.findOne({
    donor: userId,
    status: "active",
    campaign: campaignId || null,
  });

  if (existing) {
    const err = new Error(
      "You already have an active recurring donation for this campaign"
    );
    err.statusCode = 400;
    throw err;
  }

  const recurring = await RecurringDonation.create({
    donor: userId,
    amount,
    frequency,
    campaign: campaignId || null,
    paymentMethod: paymentMethod || "bkash",
    isAnonymous: isAnonymous || false,
    startDate: new Date(),
  });

  await recurring.populate("campaign", "title goalAmount");

  return recurring;
};

// ─── Get User's Recurring Donations ───────────────────────────────────────────
export const getUserRecurringDonations = async (userId, query) => {
  const { status } = query;

  const filter = { donor: userId };
  if (status) filter.status = status;

  const recurring = await RecurringDonation.find(filter)
    .populate("campaign", "title coverImage")
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });

  return recurring;
};

// ─── Pause Recurring Donation ─────────────────────────────────────────────────
export const pauseRecurringDonation = async (userId, recurringId) => {
  const recurring = await RecurringDonation.findById(recurringId);

  if (!recurring) {
    const err = new Error("Recurring donation not found");
    err.statusCode = 404;
    throw err;
  }

  if (recurring.donor.toString() !== userId.toString()) {
    const err = new Error("Not authorized");
    err.statusCode = 403;
    throw err;
  }

  if (recurring.status !== "active") {
    const err = new Error("Can only pause active recurring donations");
    err.statusCode = 400;
    throw err;
  }

  recurring.status = "paused";
  await recurring.save();

  return recurring;
};

// ─── Resume Recurring Donation ────────────────────────────────────────────────
export const resumeRecurringDonation = async (userId, recurringId) => {
  const recurring = await RecurringDonation.findById(recurringId);

  if (!recurring) {
    const err = new Error("Recurring donation not found");
    err.statusCode = 404;
    throw err;
  }

  if (recurring.donor.toString() !== userId.toString()) {
    const err = new Error("Not authorized");
    err.statusCode = 403;
    throw err;
  }

  if (recurring.status !== "paused") {
    const err = new Error("Can only resume paused recurring donations");
    err.statusCode = 400;
    throw err;
  }

  recurring.status = "active";
  await recurring.save();

  return recurring;
};

// ─── Cancel Recurring Donation ────────────────────────────────────────────────
export const cancelRecurringDonation = async (userId, recurringId) => {
  const recurring = await RecurringDonation.findById(recurringId);

  if (!recurring) {
    const err = new Error("Recurring donation not found");
    err.statusCode = 404;
    throw err;
  }

  if (recurring.donor.toString() !== userId.toString()) {
    const err = new Error("Not authorized");
    err.statusCode = 403;
    throw err;
  }

  recurring.status = "cancelled";
  await recurring.save();

  return recurring;
};

// ─── Make Recurring Payment ───────────────────────────────────────────────────
export const makeRecurringPayment = async (userId, recurringId, paymentData) => {
  const recurring = await RecurringDonation.findById(recurringId);

  if (!recurring) {
    const err = new Error("Recurring donation not found");
    err.statusCode = 404;
    throw err;
  }

  if (recurring.donor.toString() !== userId.toString()) {
    const err = new Error("Not authorized");
    err.statusCode = 403;
    throw err;
  }

  if (recurring.status !== "active") {
    const err = new Error("Recurring donation is not active");
    err.statusCode = 400;
    throw err;
  }

  // Create a new donation linked to this recurring subscription
  const donation = await Donation.create({
    donor: userId,
    amount: recurring.amount,
    donationType: "recurring",
    campaign: recurring.campaign,
    paymentMethod: paymentData.paymentMethod || recurring.paymentMethod,
    paymentReference: paymentData.paymentReference || "",
    isAnonymous: recurring.isAnonymous,
    recurringDonation: recurringId,
    status: "pending",
  });

  await donation.populate([
    { path: "campaign", select: "title" },
    { path: "donor", select: "name email" },
  ]);

  return donation;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Get All Recurring Donations ──────────────────────────────────────────────
export const getAllRecurringDonations = async (query) => {
  const { status, page = 1, limit = 10 } = query;

  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [recurring, total] = await Promise.all([
    RecurringDonation.find(filter)
      .populate("donor", "name email avatar")
      .populate("campaign", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean({ virtuals: true }),
    RecurringDonation.countDocuments(filter),
  ]);

  return {
    recurring,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Get Overdue Recurring Donations ──────────────────────────────────────────
export const getOverdueRecurringDonations = async () => {
  const now = new Date();

  const overdue = await RecurringDonation.find({
    status: "active",
    nextDueDate: { $lt: now },
  })
    .populate("donor", "name email phone")
    .populate("campaign", "title")
    .lean({ virtuals: true });

  return overdue;
};
