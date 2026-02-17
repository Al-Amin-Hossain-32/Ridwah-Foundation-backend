// Load environment variables FIRST
import './config/env.js'; // ← This must be first!

// Now import other modules
import app from './app.js';
import connectDB from './config/db.js';
import { config } from './config/env.js';

// Connect to database
connectDB();

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`   Server running on port ${PORT}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   URL: http://localhost:${PORT}`);
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