import mongoose from 'mongoose';

/**
 * Conversation Schema
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      validate: {
        validator: function (participants) {
          return participants.length === 2;
        },
        message: 'Conversation must have exactly 2 participants',
      },
      required: true,
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ participants: 1 });

/**
 * Pre-save Hook: Always sort participants (Mongoose 8.x style)
 */
conversationSchema.pre('save', function () {
  if (this.isModified('participants')) {
    this.participants = this.participants
      .map((p) => p.toString())
      .sort()
      .map((p) => new mongoose.Types.ObjectId(p));
  }
});

/**
 * Static Method: Find or create conversation
 */
conversationSchema.statics.findOrCreate = async function (userId1, userId2) {
  const sortedParticipants = [userId1.toString(), userId2.toString()].sort();

  console.log('🔍 Looking for conversation between:', sortedParticipants);

  // Try to find existing
  let conversation = await this.findOne({
    participants: { 
      $all: sortedParticipants,
      $size: 2 
    },
  })
    .populate('participants', 'name profilePicture')
    .populate({
      path: 'lastMessage',
      populate: {
        path: 'sender',
        select: 'name',
      },
    });

  if (conversation) {
    console.log('✅ Found existing conversation:', conversation._id);
    return conversation;
  }

  // Create new
  console.log('🆕 Creating new conversation');
  
  conversation = await this.create({
    participants: sortedParticipants,
  });

  // Populate
  conversation = await conversation.populate('participants', 'name profilePicture');

  console.log('✅ Created conversation:', conversation._id);

  return conversation;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;