
const express = require('express');
const Notification = require('../models/Notification');
const UserToken = require('../models/UserToken');
const auth = require('../middleware/auth');

const router = express.Router();

// Register FCM token
router.post('/register', auth(), async (req, res) => {
  try {
    const { fcmToken, platform = 'web' } = req.body;
    const userId = req.user.id;

    // Check if token already exists
    const existingToken = await UserToken.findOne({ userId, fcmToken });
    if (existingToken) {
      existingToken.active = true;
      await existingToken.save();
      return res.json({ message: 'Token updated successfully' });
    }

    // Create new token
    const userToken = new UserToken({
      userId,
      fcmToken,
      platform
    });
    await userToken.save();

    res.json({ message: 'Token registered successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user notifications
router.get('/', auth(), async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark notification as read
router.put('/:id/read', auth(), async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();
    
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark all notifications as read
router.put('/read-all', auth(), async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Unregister FCM token (for logout)
router.delete('/unregister', auth(), async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await UserToken.updateMany(
      { userId: req.user.id, fcmToken },
      { active: false }
    );
    res.json({ message: 'Token unregistered successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
