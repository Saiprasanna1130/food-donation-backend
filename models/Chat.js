
const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['donor', 'ngo', 'admin'], required: true },
    joinedAt: { type: Date, default: Date.now }
  }],
  messages: [{
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ['donor', 'ngo', 'admin'], required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: [{ 
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now }
    }]
  }],
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for efficient queries
chatSchema.index({ donationId: 1 });
chatSchema.index({ 'participants.userId': 1 });

module.exports = mongoose.model('Chat', chatSchema);
