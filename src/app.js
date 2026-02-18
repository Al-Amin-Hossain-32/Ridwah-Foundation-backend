import express from 'express';
import cors from 'cors';
// import dotenv from 'dotenv'; ← Remove this
// dotenv.config(); ← Remove this
import errorHandler from './middleware/errorHandler.js';
import { config } from './config/env.js'; 

// Import routes
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/auth/user.routes.js';
import postRoutes from './modules/posts/post.routes.js';
import friendRoutes from './modules/friends/friend.routes.js';
import messageRoutes from './modules/messages/message.routes.js';
import bookRoutes from "./modules/library/book.routes.js";
import bookRequestRoutes from "./modules/library/bookRequest.routes.js";

import campaignRoutes from "./modules/donations/campaign.routes.js";
import donationRoutes from "./modules/donations/donation.routes.js";
import recurringDonationRoutes from "./modules/donations/recurringDonation.routes.js";

// Initialize Express app
const app = express();

/**
 * Global Middleware
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Request logging (development only)
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

/**
 * Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/book-requests", bookRequestRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/recurring-donations", recurringDonationRoutes);


// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Foundation Platform API',
    version: '1.0.0',
  });
});

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

/**
 * Error Handler
 */
app.use(errorHandler);

export default app;