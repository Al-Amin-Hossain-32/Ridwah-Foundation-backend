import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { config } from './env.js'; // ← Import config

/**
 * Cloudinary Configuration using config object
 */
console.log('🔧 Configuring Cloudinary...');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

console.log('✅ Cloudinary configured with:', {
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey ? 'SET' : 'MISSING',
  api_secret: config.cloudinary.apiSecret ? 'SET' : 'MISSING',
});

/**
 * Multer Memory Storage
 */
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  },
});

/**
 * Upload to Cloudinary Function
 */
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    console.log('☁️  Starting Cloudinary upload...');
    console.log('   Cloud name:', config.cloudinary.cloudName);
    console.log('   API key:', config.cloudinary.apiKey ? 'Present' : 'Missing');
    console.log('   API secret:', config.cloudinary.apiSecret ? 'Present' : 'Missing');

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'foundation/profiles',
        transformation: [
          { width: 500, height: 500, crop: 'fill' },
          { quality: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload failed:', error);
          reject(error);
        } else {
          console.log('✅ Cloudinary upload successful');
          console.log('   URL:', result.secure_url);
          resolve(result.secure_url);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

export { cloudinary, upload, uploadToCloudinary };