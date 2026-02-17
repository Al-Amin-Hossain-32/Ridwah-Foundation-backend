import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/**
 * Load Environment Variables
 * 
 * Why separate file?
 * - ES6 modules need explicit path resolution
 * - Load once, use everywhere
 * - Centralized configuration
 */

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory
const envPath = resolve(__dirname, '../../.env');

console.log('🔍 Loading .env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
  throw new Error('Failed to load .env file');
}

console.log('✅ Environment variables loaded successfully');

// Validate required variables
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const missingVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  throw new Error('Missing required environment variables');
}

console.log('✅ All required environment variables present');

// Export config object
export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};

console.log('📋 Config loaded:', {
  port: config.port,
  nodeEnv: config.nodeEnv,
  mongoUri: config.mongoUri ? '✅ SET' : '❌ MISSING',
  jwtSecret: config.jwtSecret ? '✅ SET' : '❌ MISSING',
  cloudinary: {
    cloudName: config.cloudinary.cloudName || '❌ MISSING',
    apiKey: config.cloudinary.apiKey ? '✅ SET' : '❌ MISSING',
    apiSecret: config.cloudinary.apiSecret ? '✅ SET' : '❌ MISSING',
  },
});