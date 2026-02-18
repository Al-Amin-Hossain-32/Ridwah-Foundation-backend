import * as donationService from "./donation.service.js";

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC / USER / GUEST
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Create Donation (User or Guest) ──────────────────────────────────────────
export const createDonation = async (req, res, next) => {
  try {
    const userId = req.user?._id || null; // null for guest
    const donation = await donationService.createDonation(req.body, userId);

    res.status(201).json({
      success: true,
      message: "Donation submitted successfully. Awaiting manager approval.",
      data: donation,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Upload Payment Proof ─────────────────────────────────────────────────────
export const uploadPaymentProof = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    const userId = req.user?._id || null;
    const donation = await donationService.uploadPaymentProof(
      req.params.id,
      req.file.buffer,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Payment proof uploaded successfully",
      data: { paymentProof: donation.paymentProof },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get My Donations (User) ──────────────────────────────────────────────────
export const getUserDonations = async (req, res, next) => {
  try {
    const result = await donationService.getUserDonations(
      req.user._id,
      req.query
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Donor Leaderboard (Public) ───────────────────────────────────────────
export const getLeaderboard = async (req, res, next) => {
  try {
    const result = await donationService.getDonorLeaderboard(req.query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Get All Donations ────────────────────────────────────────────────────────
export const getAllDonations = async (req, res, next) => {
  try {
    const result = await donationService.getAllDonations(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Donation By ID ───────────────────────────────────────────────────────
export const getDonationById = async (req, res, next) => {
  try {
    const donation = await donationService.getDonationById(req.params.id);
    res.status(200).json({
      success: true,
      data: donation,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Approve Donation ─────────────────────────────────────────────────────────
export const approveDonation = async (req, res, next) => {
  try {
    const donation = await donationService.approveDonation(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: "Donation approved successfully",
      data: donation,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Reject Donation ──────────────────────────────────────────────────────────
export const rejectDonation = async (req, res, next) => {
  try {
    const donation = await donationService.rejectDonation(
      req.user._id,
      req.params.id,
      req.body.rejectionReason
    );
    res.status(200).json({
      success: true,
      message: "Donation rejected",
      data: donation,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Analytics ────────────────────────────────────────────────────────────
export const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await donationService.getDonationAnalytics();
    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};
