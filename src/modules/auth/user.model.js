import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Schema
 * 
 * Design Philosophy:
 * - User Model = Auth + Profile combined
 * - Phone as primary identifier (Bangladesh context)
 * - Role-based access control built-in
 * - Soft delete support (isActive flag)
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^01[0-9]{9}$/, 'Please provide a valid Bangladesh phone number'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Security: Don't return password by default
    },

    email: {
      type: String,
      unique: true,
      sparse: true, // Allow null values, but unique if provided
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    role: {
      type: String,
      enum: {
        values: ['user', 'librarian', 'manager', 'admin'],
        message: '{VALUE} is not a valid role',
      },
      default: 'user',
    },

    profilePicture: {
      type: String,
      default: '',
    },

    bio: {
      type: String,
      maxlength: [200, 'Bio cannot exceed 200 characters'],
      trim: true,
    },

    donationAmount: {
      type: Number,
      default: 0,
      min: [0, 'Donation amount cannot be negative'],
      validate: {
        validator: Number.isFinite,
        message: 'Donation amount must be a valid number',
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for Query Performance
 */
userSchema.index({ phone: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

/**
 * Pre-save Middleware: Hash Password
 * 
 * Mongoose 8.x Change:
 * - next() callback is optional now
 * - Can use async/await directly
 * - Just return or throw error
 * 
 * Security:
 * - NEVER store plain text passwords
 * - bcrypt with salt = industry standard
 * - Salt rounds = 10 (balance between security and speed)
 */
userSchema.pre('save', async function () {
  // Only hash if password is modified
  // Why? On profile update, we don't want to re-hash
  if (!this.isModified('password')) {
    return;
  }

  // Generate salt and hash password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance Method: Compare Password
 * 
 * Usage: const isMatch = await user.matchPassword('password123')
 * 
 * @param {string} enteredPassword - Plain text password from login
 * @returns {Promise<boolean>}
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Instance Method: Get Public Profile
 * 
 * Why?
 * - Remove sensitive data (password, isActive, etc.)
 * - Consistent format across the app
 * - Single source of truth
 * 
 * @returns {Object} - Safe user data for client
 */
userSchema.methods.getPublicProfile = function () {
  return {
    _id: this._id,
    name: this.name,
    phone: this.phone,
    email: this.email,
    role: this.role,
    profilePicture: this.profilePicture,
    bio: this.bio,
    donationAmount: this.donationAmount,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

export default User;