
const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  donorName: String,
  foodName: { type: String, required: true },
  quantity: { type: String, required: true },
  description: String,
  expiryTime: { type: Date, required: true },
  image: String,
  location: {
    address: String,
    coordinates: {
      type: {
        lat: Number,
        lng: Number
      },
      required: true
    },
  },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'picked_up', 'expired', 'cancelled', 'rejected', 'in_transit'], 
    default: 'pending' 
  },
  acceptedBy: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
  },
  pickupTime: Date,
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Donation', donationSchema);
