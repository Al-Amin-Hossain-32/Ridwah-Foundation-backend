import jwt from 'jsonwebtoken';
import User from './user.model.js';

/**
 * Auth Service Layer
 * 
 * Why Service Layer?
 * - Separates business logic from HTTP layer (controller)
 * - Reusable across different controllers
 * - Easier to test
 * - Single Responsibility Principle
 * 
 * Pattern: Controller → Service → Model → Database
 */

class AuthService {
  /**
   * Generate JWT Token
   * 
   * @param {string} userId - MongoDB ObjectId
   * @returns {string} - JWT token
   * 
   * Why separate method?
   * - Used in register AND login
   * - DRY principle (Don't Repeat Yourself)
   */
  generateToken(userId) {
    return jwt.sign(
      { id: userId }, // Payload
      process.env.JWT_SECRET, // Secret key
      { expiresIn: process.env.JWT_EXPIRE } // Options
    );
  }

  /**
   * Register new user
   * 
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} - User data with token
   * @throws {Error} - If user already exists or validation fails
   */
  async register(userData) {
    const { name, phone, password, email, role } = userData;

    // Check if user exists
    // Why findOne instead of find?
    // - We only need one result (faster)
    // - Returns null if not found (easier to check)
    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      const error = new Error('User with this phone number already exists');
      error.statusCode = 400;
      throw error;
    }

    // Create user
    // Why not User.create() directly?
    // - We want to handle errors properly
    // - Mongoose will trigger pre-save middleware (password hashing)
    const user = await User.create({
      name,
      phone,
      password,
      email,
      role: role || 'user', // Default to 'user' if not provided
    });

    // Generate token
    const token = this.generateToken(user._id);

    // Return public profile + token
    return {
      user: user.getPublicProfile(),
      token,
    };
  }

  /**
   * Login user
   * 
   * @param {string} phone - User phone number
   * @param {string} password - Plain text password
   * @returns {Promise<Object>} - User data with token
   * @throws {Error} - If credentials invalid or account suspended
   */
  async login(phone, password) {
    // Validate input
    if (!phone || !password) {
      const error = new Error('Please provide phone and password');
      error.statusCode = 400;
      throw error;
    }

    // Find user and include password
    // Why .select('+password')?
    // - Password has select: false in schema
    // - We need it here for comparison
    const user = await User.findOne({ phone }).select('+password');

    if (!user) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Check password
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Check if account is active
    if (!user.isActive) {
      const error = new Error('Your account has been suspended. Please contact admin.');
      error.statusCode = 403;
      throw error;
    }

    // Generate token
    const token = this.generateToken(user._id);

    return {
      user: user.getPublicProfile(),
      token,
    };
  }

  /**
   * Get user by ID
   * 
   * @param {string} userId - MongoDB ObjectId
   * @returns {Promise<Object>} - User data
   * @throws {Error} - If user not found
   */
  async getUserById(userId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return user.getPublicProfile();
  }

  /**
 * Get user profile by ID
 * 
 * @param {string} userId - User ID to fetch
 * @returns {Promise<Object>} - User profile
 * @throws {Error} - If user not found
 */
async getUserProfile(userId) {
  const user = await User.findById(userId).select('-password');

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user.getPublicProfile();
}

/**
 * Update user profile
 * 
 * @param {string} userId - User ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} - Updated user
 * @throws {Error} - If unauthorized or validation fails
 * 
 * Security:
 * - User can only update own profile
 * - Cannot change role through this endpoint
 * - Cannot change phone (primary identifier)
 */
async updateProfile(userId, updateData) {
  // Fields allowed to update
  const allowedFields = ['name', 'email', 'bio', 'donationAmount'];
  
  // Filter out non-allowed fields
  const filteredData = {};
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      filteredData[field] = updateData[field];
    }
  });

  // Update user
  const user = await User.findByIdAndUpdate(
    userId,
    filteredData,
    {
      new: true, // Return updated document
      runValidators: true, // Run schema validators
    }
  );

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user.getPublicProfile();
}

/**
 * Update profile picture
 * 
 * @param {string} userId - User ID
 * @param {string} imageUrl - Cloudinary URL
 * @returns {Promise<Object>} - Updated user
 */
async updateProfilePicture(userId, imageUrl) {
  const user = await User.findByIdAndUpdate(
    userId,
    { profilePicture: imageUrl },
    { new: true }
  );

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user.getPublicProfile();
}

/**
 * Get all users (for testing/debugging)
 * 
 * @param {string} currentUserId - Current user
 * @returns {Promise<Array>}
 */
async getAllUsers(currentUserId) {
  const users = await User.find({
    _id: { $ne: currentUserId },
    isActive: true,
  })
    .select('name phone email profilePicture bio role')
    .limit(50);

  return users;
}

/**
 * Search users by name
 * 
 * @param {string} searchQuery - Search term
 * @param {string} currentUserId - Current user ID
 * @returns {Promise<Array>} - Array of users
 */
async searchUsers(searchQuery, currentUserId) {
  // Validate search query
  if (!searchQuery || searchQuery.trim().length < 1) {
    return [];
  }

  const trimmedQuery = searchQuery.trim();

  console.log('🔍 Searching users with query:', trimmedQuery);
  console.log('   Current user ID:', currentUserId);

  try {
    // Case-insensitive search
    // $regex = pattern matching
    // $options: 'i' = case insensitive
    const users = await User.find({
      $and: [
        {
          $or: [
            { name: { $regex: trimmedQuery, $options: 'i' } },
            { phone: { $regex: trimmedQuery, $options: 'i' } },
            { email: { $regex: trimmedQuery, $options: 'i' } },
          ],
        },
        { _id: { $ne: currentUserId } }, // Exclude current user
        { isActive: true }, // Only active users
      ],
    })
      .select('name phone email profilePicture bio role')
      .limit(20);

    console.log('✅ Found users:', users.length);

    return users;
  } catch (error) {
    console.error('❌ Search error:', error);
    throw error;
  }
}

/**
 * Update donation amount
 * 
 * @param {string} userId - User ID
 * @param {number} amount - New donation amount
 * @returns {Promise<Object>} - Updated user
 */
async updateDonationAmount(userId, amount) {
  if (amount < 0) {
    const error = new Error('Donation amount cannot be negative');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { donationAmount: amount },
    { new: true, runValidators: true }
  );

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user.getPublicProfile();
}
}

// Export singleton instance
// Why singleton?
// - We only need one instance
// - Saves memory
// - Consistent state across app
export default new AuthService();

