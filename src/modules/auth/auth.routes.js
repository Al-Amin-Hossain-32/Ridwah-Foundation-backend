import express from 'express';
import authController from './auth.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Public Routes
 * - No authentication required
 */
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));

/**
 * Protected Routes
 * - Require valid JWT token
 */
router.get('/me', protect, authController.getMe.bind(authController));



export default router;