
const express = require('express');
const Donation = require('../models/Donation');
const auth = require('../middleware/auth');
const { notifyNewDonation, notifyStatusUpdate } = require('../services/notificationService');

const router = express.Router();

// Create donation (donor only)
router.post('/', auth(['donor']), async (req, res) => {
  try {
    const { foodName, quantity, description, expiryTime, image, location } = req.body;
    const donorId = req.user.id;
    const newDonation = new Donation({
      donorId,
      donorName: req.user.name,
      foodName,
      quantity,
      description,
      expiryTime,
      image,
      location
    });
    await newDonation.save();
    
    // Notify all NGOs about new donation
    await notifyNewDonation(newDonation);
    
    res.status(201).json(newDonation);
  } catch (err) {
    console.error('Error creating donation:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get all donations (NGOs see pending, donors see their own, admins see all)
router.get('/', auth(), async (req, res) => {
  try {
    let donations;
    if (req.user.role === 'ngo') {
      // NGOs see all donations (pending for acceptance, and their own accepted/picked_up/in_transit)
      donations = await Donation.find({
        $or: [
          { status: 'pending' },
          { 'acceptedBy.id': req.user.id }
        ]
      }).sort({ createdAt: -1 });
    } else if (req.user.role === 'admin') {
      // Admin can see all donations
      donations = await Donation.find({}).sort({ createdAt: -1 });
    } else {
      // Donors see their own donations
      donations = await Donation.find({ donorId: req.user.id }).sort({ createdAt: -1 });
    }
    res.json(donations);
  } catch (err) {
    console.error('Error fetching donations:', err);
    res.status(500).json({ message: err.message });
  }
});

// Accept donation (NGO only)
router.post('/:id/accept', auth(['ngo']), async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    
    if (donation.status !== 'pending') {
      return res.status(400).json({ message: 'Donation not available for acceptance' });
    }

    donation.status = 'accepted';
    donation.acceptedBy = { 
      id: req.user.id, 
      name: req.user.name 
    };
    
    const savedDonation = await donation.save();
    console.log('Donation accepted successfully:', savedDonation);
    
    // Notify donor about acceptance
    await notifyStatusUpdate(savedDonation, 'accepted');
    
    res.json(savedDonation);
  } catch (err) {
    console.error('Error accepting donation:', err);
    res.status(500).json({ message: err.message });
  }
});

// Mark as picked up (NGO only)
router.post('/:id/pickup', auth(['ngo']), async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    
    // Check if user is authorized to pickup this donation
    if (!donation.acceptedBy || String(donation.acceptedBy.id) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to pick up this donation' });
    }
    
    // Allow pickup from accepted or in_transit status
    if (!['accepted', 'in_transit'].includes(donation.status)) {
      return res.status(400).json({ message: 'Donation must be accepted or in transit to be picked up' });
    }
    
    donation.status = 'picked_up';
    donation.pickupTime = new Date();
    
    const savedDonation = await donation.save();
    console.log('Donation marked as picked up:', savedDonation);
    
    // Notify donor about pickup
    await notifyStatusUpdate(savedDonation, 'picked_up');
    
    res.json(savedDonation);
  } catch (err) {
    console.error('Error marking as picked up:', err);
    res.status(500).json({ message: err.message });
  }
});

// Mark as in transit (NGO only)
router.post('/:id/transit', auth(['ngo']), async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    
    // Check if user is authorized to update this donation
    if (!donation.acceptedBy || String(donation.acceptedBy.id) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this donation' });
    }
    
    if (donation.status !== 'accepted') {
      return res.status(400).json({ message: 'Donation must be accepted first' });
    }
    
    donation.status = 'in_transit';
    const savedDonation = await donation.save();
    console.log('Donation marked as in transit:', savedDonation);
    
    // Notify donor about transit status
    await notifyStatusUpdate(savedDonation, 'in_transit');
    
    res.json(savedDonation);
  } catch (err) {
    console.error('Error marking as in transit:', err);
    res.status(500).json({ message: err.message });
  }
});

// Reject donation (NGO only)
router.post('/:id/reject', auth(['ngo']), async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    
    if (donation.status !== 'pending') {
      return res.status(400).json({ message: 'Can only reject pending donations' });
    }
    
    donation.status = 'rejected';
    donation.notes = req.body.notes || 'Rejected by NGO';
    
    const savedDonation = await donation.save();
    console.log('Donation rejected:', savedDonation);
    
    // Notify donor about rejection
    await notifyStatusUpdate(savedDonation, 'rejected');
    
    res.json(savedDonation);
  } catch (err) {
    console.error('Error rejecting donation:', err);
    res.status(500).json({ message: err.message });
  }
});

// Cancel donation (donor only)
router.post('/:id/cancel', auth(['donor']), async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    
    // Only donor can cancel their own pending donations
    if (donation.donorId.toString() !== req.user.id || donation.status !== 'pending') {
      return res.status(403).json({ message: 'Cannot cancel this donation' });
    }

    donation.status = 'cancelled';
    const savedDonation = await donation.save();
    console.log('Donation cancelled:', savedDonation);
    
    // Notify NGO if donation was accepted
    if (donation.acceptedBy) {
      await notifyStatusUpdate(savedDonation, 'cancelled');
    }
    
    res.json(savedDonation);
  } catch (err) {
    console.error('Error cancelling donation:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
