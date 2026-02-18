import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../modules/auth/user.model.js";
import { config } from "./env.js";

/**
 * Socket.io Configuration
 *
 * How it works:
 * 1. Client connects with JWT token
 * 2. Server verifies token
 * 3. User joins their own "room" (userId)
 * 4. Can send/receive real-time messages
 *
 * Architecture:
 * - Each user has a room = their userId
 * - To send message to user X, emit to room X
 * - Rooms are automatic, no manual join needed
 */

// Store online users
// Map<userId, socketId>
const onlineUsers = new Map();

/**
 * Initialize Socket.io
 *
 * @param {http.Server} server - HTTP server instance
 * @returns {Server} - Socket.io server instance
 */
export const initializeSocket = (server) => {
    
  const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false, // ← false করুন
  },
  // ✅ Add these options
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

  /**
   * Authentication Middleware
   *
   * Verify JWT before allowing connection
   */
  io.use(async (socket, next) => {
    try {
      // Get token from handshake
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      // Verify token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Get user
      const user = await User.findById(decoded.id);

      if (!user || !user.isActive) {
        return next(new Error("Authentication error: Invalid user"));
      }

      // Attach user to socket
      socket.userId = user._id.toString();
      socket.user = {
        _id: user._id,
        name: user.name,
        profilePicture: user.profilePicture,
      };

      next();
    } catch (error) {
      console.error("Socket authentication error:", error.message);
      next(new Error("Authentication error"));
    }
  });

  /**
   * Connection Handler
   */
  io.on("connection", (socket) => {
    const userId = socket.userId;

  console.log('✅ User connected:', socket.user.name);
  console.log('   Socket ID:', socket.id);
  console.log('   User ID:', userId);
  console.log('   Joining room:', userId);

  // Add to online users
  onlineUsers.set(userId, socket.id);

  // Join user's own room
  socket.join(userId);

  // ✅ Verify room joined
  console.log('   Rooms:', Array.from(socket.rooms));

    // Broadcast online status to all connected clients
    io.emit("userOnline", {
      userId,
      name: socket.user.name,
      profilePicture: socket.user.profilePicture,
    });

    // Send current online users to newly connected user
    const onlineUsersList = Array.from(onlineUsers.keys());
    socket.emit("onlineUsers", onlineUsersList);

    /**
     * Event: Send Message
     *
     * Client emits: sendMessage
     * Server emits: newMessage (to receiver)
     */
    socket.on("sendMessage", async (data) => {
      try {
        const { receiverId, messageId } = data;

        console.log("📨 Message sent:", {
          from: socket.user.name,
          to: receiverId,
          messageId,
        });

        // Emit to receiver's room
        io.to(receiverId).emit("newMessage", {
          messageId,
          senderId: userId,
          senderName: socket.user.name,
          timestamp: new Date(),
        });

        // Confirm to sender
        socket.emit("messageSent", { messageId });
      } catch (error) {
        console.error("Error in sendMessage:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    /**
     * Event: Mark as Read
     *
     * When user reads a message, notify sender
     */
    socket.on("messageRead", (data) => {
      const { messageId, senderId } = data;

      console.log("👁️  Message read:", messageId);

      // Notify sender
      io.to(senderId).emit("messageReadConfirm", {
        messageId,
        readBy: userId,
        readAt: new Date(),
      });
    });

    /**
     * Event: Typing Indicator
     *
     * Show "User is typing..." to receiver
     */
    socket.on("typing", (data) => {
      const { receiverId } = data;

      io.to(receiverId).emit("userTyping", {
        userId,
        name: socket.user.name,
      });
    });

    socket.on("stopTyping", (data) => {
      const { receiverId } = data;

      io.to(receiverId).emit("userStoppedTyping", {
        userId,
      });
    });

    /**
     * Event: Message Edited
     */
    socket.on("messageEdited", (data) => {
      const { receiverId, messageId, newContent } = data;

      io.to(receiverId).emit("messageEditedNotification", {
        messageId,
        newContent,
        editedAt: new Date(),
      });
    });

    /**
     * Event: Message Deleted
     */
    socket.on("messageDeleted", (data) => {
      const { receiverId, messageId, deleteType } = data;

      io.to(receiverId).emit("messageDeletedNotification", {
        messageId,
        deleteType,
        deletedAt: new Date(),
      });
    });

    /**
     * Disconnect Handler
     */
    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.user.name);

      // Remove from online users
      onlineUsers.delete(userId);

      // Broadcast offline status
      io.emit("userOffline", { userId });
    });
  });

  console.log("🔌 Socket.io initialized");
setIO(io);   
  return io;
};

// এই events existing socket.on() section এ add করুন:

/**
 * Get Socket.io instance
 *
 * Usage: const io = getIO();
 */
let ioInstance;

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized");
  }
  return ioInstance;
};
// Day 5 Library Module এর জন্য
export const getSocketInstance = () => ioInstance;
export const getOnlineUsers = () => onlineUsers;