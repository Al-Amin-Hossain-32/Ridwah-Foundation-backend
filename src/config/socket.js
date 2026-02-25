import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../modules/auth/user.model.js';
import { config } from './env.js';

// Online users map: userId → Set of socketIds (support multiple tabs)
const onlineUsers = new Map();

let ioInstance = null;

/**
 * Initialize Socket.io server
 */
export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: false,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Auth Middleware ─────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id).select('name profilePicture isActive');

      if (!user || !user.isActive) {
        return next(new Error('Authentication error: Invalid user'));
      }

      socket.userId = user._id.toString();
      socket.user = {
        _id: user._id,
        name: user.name,
        profilePicture: user.profilePicture,
      };

      next();
    } catch (error) {
      console.error('Socket auth error:', error.message);
      next(new Error('Authentication error'));
    }
  });

  // ─── Connection Handler ───────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;

    console.log(`✅ Socket connected: ${socket.user.name} (${socket.id})`);

    // ── Join personal room ──────────────────────────────────────────────────────
    socket.join(userId);

    // Track socket IDs per user (support multiple tabs)
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast online status
    socket.broadcast.emit('userOnline', {
      userId,
      name: socket.user.name,
      profilePicture: socket.user.profilePicture,
    });

    // Send current online users list
    socket.emit('onlineUsers', Array.from(onlineUsers.keys()));

    // ── Typing indicators ───────────────────────────────────────────────────────
    socket.on('typing', ({ receiverId }) => {
      if (receiverId) {
        io.to(receiverId).emit('userTyping', {
          userId,
          name: socket.user.name,
        });
      }
    });

    socket.on('stopTyping', ({ receiverId }) => {
      if (receiverId) {
        io.to(receiverId).emit('userStoppedTyping', { userId });
      }
    });

    // ── Message Read ────────────────────────────────────────────────────────────
    socket.on('messageRead', ({ messageId, senderId }) => {
      if (senderId) {
        io.to(senderId).emit('messageReadConfirm', {
          messageId,
          readBy: userId,
          readAt: new Date(),
        });
      }
    });

    // ── Disconnect ──────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${socket.user.name} — ${reason}`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Only broadcast offline when ALL tabs are closed
          io.emit('userOffline', { userId });
        }
      }
    });
  });

  ioInstance = io;
  console.log('🔌 Socket.io initialized');

  return io;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return ioInstance;
};

export const setIO = (io) => {
  ioInstance = io;
};

export const getSocketInstance = () => ioInstance;
export const getOnlineUsers = () => onlineUsers;