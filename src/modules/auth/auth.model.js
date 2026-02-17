const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
      match: [/^01[0-9]{9}$/, 'Please provide a valid Bangladesh phone number'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Password by default fetch হবে না
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    role: {
      type: String,
      enum: ['user', 'librarian', 'manager', 'admin'],
      default: 'user',
    },
    profilePicture: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      maxlength: [200, 'Bio cannot exceed 200 characters'],
    },
    donationAmount: {
      type: Number,
      default: 0,
      min: [0, 'Donation amount cannot be negative'],
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

// Password hash করা (save এর আগে)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
    return ;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password match করা (method)
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Indexes
userSchema.index({ phone: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);