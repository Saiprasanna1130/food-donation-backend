
const mongoose = require('mongoose');

const userTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fcmToken: { type: String, required: true },
  platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure unique combination of userId and fcmToken
userTokenSchema.index({ userId: 1, fcmToken: 1 }, { unique: true });

module.exports = mongoose.model('UserToken', userTokenSchema);
