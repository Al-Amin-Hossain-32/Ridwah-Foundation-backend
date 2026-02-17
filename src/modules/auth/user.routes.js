import express from 'express';
import authController from './auth.controller.js';
import { protect } from '../../middleware/auth.middleware.js';
import { upload } from '../../config/cloudinary.js';

const router = express.Router();

/**
 * All routes require authentication
 */
// Get all users (for debugging) - Must be BEFORE /:id
router.get('/', protect, authController.getAllUsers.bind(authController));

// Search users (must come before /:id to avoid conflict)
router.get('/search', protect, authController.searchUsers.bind(authController));

// Profile picture upload
router.post(
  '/upload-picture',
  protect,
  upload.single('image'), // 'image' = field name in form-data
  authController.uploadProfilePicture.bind(authController)
);

// Get user profile
router.get('/:id', protect, authController.getUserProfile.bind(authController));

// Update profile
router.put('/:id', protect, authController.updateProfile.bind(authController));

// Update donation amount
router.put(
  '/:id/donation',
  protect,
  authController.updateDonationAmount.bind(authController)
);

export default router;