import jwt from 'jsonwebtoken';
import User from '../modules/auth/user.model.js';

/**
 * Protect Routes Middleware
 * 
 * How it works:
 * 1. Extract token from Authorization header
 * 2. Verify token with JWT secret
 * 3. Find user from decoded token
 * 4. Attach user to request object
 * 5. Call next() to proceed
 * 
 * Usage: router.get('/protected', protect, controller)
 */
export const protect = async (req, res, next) => {
  let token;

  // Check for Bearer token in headers
  // Format: "Authorization: Bearer <token>"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Extract token
    // Split "Bearer abc123xyz" → ["Bearer", "abc123xyz"]
    token = req.headers.authorization.split(' ')[1];
  }

  // No token provided
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    // If invalid/expired, will throw error
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // decoded = { id: "userId", iat: timestamp, exp: timestamp }

    // Get user from database
    // Why? Token might be valid but user could be deleted
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if account is active
    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been suspended',
      });
    }

    // User authenticated, proceed to next middleware/controller
    next();
  } catch (error) {
    // Token invalid/expired
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

/**
 * Role-based Authorization Middleware
 * 
 * How it works:
 * 1. Check if user's role is in allowed roles
 * 2. If yes, proceed
 * 3. If no, return 403 Forbidden
 * 
 * Usage: router.post('/books', protect, authorize('librarian', 'admin'), controller)
 * 
 * @param {...string} roles - Allowed roles
 * @returns {Function} - Express middleware function
 */
export const authorize = (...roles) => {
  // Return middleware function
  // Why closure? We need to access 'roles' parameter
  return (req, res, next) => {
    // req.user set by protect middleware
    // IMPORTANT: authorize must come AFTER protect
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }

    next();
  };
};