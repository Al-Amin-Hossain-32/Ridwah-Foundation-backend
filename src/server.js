// Load environment variables FIRST
import './config/env.js';

import { createServer } from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import { config } from './config/env.js';
import { initializeSocket, setIO } from './config/socket.js';

// Connect to database
connectDB();

const PORT = config.port;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);
setIO(io); // Store for later use

// Start server
server.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`   Server running on port ${PORT}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   Socket.io: ✅ Enabled`);
  console.log('========================================');
  console.log('');
});

// Graceful Shutdown
process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  
  server.close(() => {
    console.log('✅ Process terminated!');
  });
});