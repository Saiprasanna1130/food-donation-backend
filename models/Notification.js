
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['donation', 'status_update', 'expiry_alert'], 
    required: true 
  },
  donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation' },
  read: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false },
  pushSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
