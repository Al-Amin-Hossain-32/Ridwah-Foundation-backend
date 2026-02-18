import * as recurringService from "./recurringDonation.service.js";

// ═══════════════════════════════════════════════════════════════════════════════
// USER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Create Recurring Donation ────────────────────────────────────────────────
export const createRecurringDonation = async (req, res, next) => {
  try {
    const recurring = await recurringService.createRecurringDonation(
      req.user._id,
      req.body
    );
    res.status(201).json({
      success: true,
      message: "Recurring donation subscription created successfully",
      data: recurring,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get My Recurring Donations ───────────────────────────────────────────────
export const getUserRecurringDonations = async (req, res, next) => {
  try {
    const recurring = await recurringService.getUserRecurringDonations(
      req.user._id,
      req.query
    );
    res.status(200).json({
      success: true,
      data: recurring,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Pause Recurring Donation ─────────────────────────────────────────────────
export const pauseRecurringDonation = async (req, res, next) => {
  try {
    const recurring = await recurringService.pauseRecurringDonation(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: "Recurring donation paused successfully",
      data: recurring,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Resume Recurring Donation ────────────────────────────────────────────────
export const resumeRecurringDonation = async (req, res, next) => {
  try {
    const recurring = await recurringService.resumeRecurringDonation(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: "Recurring donation resumed successfully",
      data: recurring,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Cancel Recurring Donation ────────────────────────────────────────────────
export const cancelRecurringDonation = async (req, res, next) => {
  try {
    const recurring = await recurringService.cancelRecurringDonation(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: "Recurring donation cancelled successfully",
      data: recurring,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Make Recurring Payment ───────────────────────────────────────────────────
export const makeRecurringPayment = async (req, res, next) => {
  try {
    const donation = await recurringService.makeRecurringPayment(
      req.user._id,
      req.params.id,
      req.body
    );
    res.status(201).json({
      success: true,
      message: "Recurring payment submitted. Awaiting manager approval.",
      data: donation,
    });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Get All Recurring Donations ──────────────────────────────────────────────
export const getAllRecurringDonations = async (req, res, next) => {
  try {
    const result = await recurringService.getAllRecurringDonations(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Overdue Recurring Donations ──────────────────────────────────────────
export const getOverdueRecurringDonations = async (req, res, next) => {
  try {
    const overdue = await recurringService.getOverdueRecurringDonations();
    res.status(200).json({
      success: true,
      data: overdue,
    });
  } catch (error) {
    next(error);
  }
};
