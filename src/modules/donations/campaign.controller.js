import * as campaignService from "./campaign.service.js";

// ─── Create Campaign ──────────────────────────────────────────────────────────
export const createCampaign = async (req, res, next) => {
  try {
    const campaign = await campaignService.createCampaign(req.body, req.user._id);
    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get All Campaigns ────────────────────────────────────────────────────────
export const getAllCampaigns = async (req, res, next) => {
  try {
    const result = await campaignService.getAllCampaigns(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Campaign By ID ───────────────────────────────────────────────────────
export const getCampaignById = async (req, res, next) => {
  try {
    const result = await campaignService.getCampaignById(req.params.id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Update Campaign ──────────────────────────────────────────────────────────
export const updateCampaign = async (req, res, next) => {
  try {
    const campaign = await campaignService.updateCampaign(
      req.params.id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Delete Campaign ──────────────────────────────────────────────────────────
export const deleteCampaign = async (req, res, next) => {
  try {
    const result = await campaignService.deleteCampaign(req.params.id);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Upload Cover Image ───────────────────────────────────────────────────────
export const uploadCover = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const campaign = await campaignService.uploadCoverImage(
      req.params.id,
      req.file.buffer
    );

    res.status(200).json({
      success: true,
      message: "Cover image uploaded successfully",
      data: { coverImage: campaign.coverImage },
    });
  } catch (error) {
    next(error);
  }
};
