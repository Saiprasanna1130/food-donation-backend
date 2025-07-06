
const express = require('express');
const User = require('../models/User');
const Donation = require('../models/Donation');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/users', auth(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user by ID (admin only)
router.get('/users/:id', auth(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user verification status (admin only)
router.patch('/users/:id/verify', auth(['admin']), async (req, res) => {
  try {
    const { verified } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { verified },
      { new: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete user (admin only)
router.delete('/users/:id', auth(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Delete all donations by this user
    await Donation.deleteMany({ donorId: req.params.id });
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User and associated donations deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all donations (admin only)
router.get('/donations', auth(['admin']), async (req, res) => {
  try {
    const donations = await Donation.find()
      .populate('donorId', 'name email')
      .sort({ createdAt: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete donation (admin only)
router.delete('/donations/:id', auth(['admin']), async (req, res) => {
  try {
    const donation = await Donation.findByIdAndDelete(req.params.id);
    if (!donation) return res.status(404).json({ message: 'Donation not found' });
    res.json({ message: 'Donation deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get admin statistics
router.get('/stats', auth(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDonors = await User.countDocuments({ role: 'donor' });
    const totalNGOs = await User.countDocuments({ role: 'ngo' });
    const verifiedUsers = await User.countDocuments({ verified: true });
    const unverifiedUsers = await User.countDocuments({ verified: false });
    
    const totalDonations = await Donation.countDocuments();
    const pendingDonations = await Donation.countDocuments({ status: 'pending' });
    const acceptedDonations = await Donation.countDocuments({ status: 'accepted' });
    const pickedUpDonations = await Donation.countDocuments({ status: 'picked_up' });
    
    res.json({
      users: {
        total: totalUsers,
        donors: totalDonors,
        ngos: totalNGOs,
        verified: verifiedUsers,
        unverified: unverifiedUsers
      },
      donations: {
        total: totalDonations,
        pending: pendingDonations,
        accepted: acceptedDonations,
        pickedUp: pickedUpDonations
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
