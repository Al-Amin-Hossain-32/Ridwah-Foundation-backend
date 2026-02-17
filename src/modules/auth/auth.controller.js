import authService from './auth.service.js';
import { uploadToCloudinary } from '../../config/cloudinary.js';

/**
 * Auth Controller
 * 
 * Responsibility:
 * - Handle HTTP requests/responses
 * - Validate request data
 * - Call service layer
 * - Return appropriate status codes
 * 
 * Pattern: Thin controller, Fat service
 */

class AuthController {
  /**
   * @desc    Register new user
   * @route   POST /api/auth/register
   * @access  Public
   */
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      });
    } catch (error) {
      // Pass error to error handler middleware
      next(error);
    }
  }

  /**
   * @desc    Login user
   * @route   POST /api/auth/login
   * @access  Public
   */
  async login(req, res, next) {
    try {
      const { phone, password } = req.body;
      
      const result = await authService.login(phone, password);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get current logged in user
   * @route   GET /api/auth/me
   * @access  Private
   */
  async getMe(req, res, next) {
    try {
      // req.user set by auth middleware
      const user = await authService.getUserById(req.user._id);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
 * @desc    Get user profile by ID
 * @route   GET /api/users/:id
 * @access  Private
 */
async getUserProfile(req, res, next) {
  try {
    const user = await authService.getUserProfile(req.params.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get all users (for debugging)
 * @route   GET /api/users
 * @access  Private
 */
async getAllUsers(req, res, next) {
  try {
    const users = await authService.getAllUsers(req.user._id);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update own profile
 * @route   PUT /api/users/:id
 * @access  Private
 */
async updateProfile(req, res, next) {
  try {
    // Security: Can only update own profile
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile',
      });
    }

    const user = await authService.updateProfile(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Upload profile picture
 * @route   POST /api/users/upload-picture
 * @access  Private
 */
async uploadProfilePicture(req, res, next) {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image',
      });
    }

    console.log('📁 File received:', req.file.originalname);
    console.log('📊 File size:', req.file.size);

    // Upload to Cloudinary
    console.log('☁️  Uploading to Cloudinary...');
    const imageUrl = await uploadToCloudinary(req.file.buffer);
    console.log('✅ Upload successful:', imageUrl);

    // Update user profile
    const user = await authService.updateProfilePicture(
      req.user._id,
      imageUrl
    );

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      data: user,
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    next(error);
  }
}

/**
 * @desc    Search users
 * @route   GET /api/users/search?q=name
 * @access  Private
 */
async searchUsers(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a search query',
      });
    }

    const users = await authService.searchUsers(q, req.user._id);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update donation amount
 * @route   PUT /api/users/:id/donation
 * @access  Private
 */
async updateDonationAmount(req, res, next) {
  try {
    // Security: Can only update own donation amount
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own donation amount',
      });
    }

    const { amount } = req.body;

    if (amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide donation amount',
      });
    }

    const user = await authService.updateDonationAmount(
      req.params.id,
      amount
    );

    res.status(200).json({
      success: true,
      message: 'Donation amount updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}
}



export default new AuthController();