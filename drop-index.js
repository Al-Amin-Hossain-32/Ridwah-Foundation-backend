import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const dropIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('✅ Connected to MongoDB');
    
    // Get conversations collection
    const Conversation = mongoose.connection.collection('conversations');
    
    // Drop the problematic index
    await Conversation.dropIndex('participants_1');
    
    console.log('✅ Index dropped successfully');
    
    // Show remaining indexes
    const indexes = await Conversation.indexes();
    console.log('Remaining indexes:', indexes);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

dropIndex();