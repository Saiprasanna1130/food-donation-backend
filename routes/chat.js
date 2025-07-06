
const express = require('express');
const Chat = require('../models/Chat');
const Donation = require('../models/Donation');
const auth = require('../middleware/auth');
const router = express.Router();

// Get or create chat for a donation
router.post('/donation/:donationId', auth(), async (req, res) => {
  try {
    const { donationId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if donation exists
    const donation = await Donation.findById(donationId).populate('donorId acceptedBy.id');
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    // Check if user is authorized to access this chat
    const isDonor = donation.donorId._id.toString() === userId;
    const isNGO = donation.acceptedBy && donation.acceptedBy.id._id.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isDonor && !isNGO && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }

    // Find existing chat or create new one
    let chat = await Chat.findOne({ donationId }).populate('participants.userId', 'name email role');
    
    if (!chat) {
      // Create new chat with donor and NGO as participants
      const participants = [
        { userId: donation.donorId._id, role: 'donor' }
      ];
      
      if (donation.acceptedBy) {
        participants.push({ userId: donation.acceptedBy.id._id, role: 'ngo' });
      }

      chat = new Chat({
        donationId,
        participants
      });
      await chat.save();
      await chat.populate('participants.userId', 'name email role');
    } else {
      // Add user to chat if not already a participant
      const isParticipant = chat.participants.some(p => p.userId._id.toString() === userId);
      if (!isParticipant && (isDonor || isNGO || isAdmin)) {
        chat.participants.push({ userId, role: userRole });
        await chat.save();
        await chat.populate('participants.userId', 'name email role');
      }
    }

    res.json(chat);
  } catch (error) {
    console.error('Error getting/creating chat:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's chats
router.get('/my-chats', auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query;
    if (userRole === 'admin') {
      // Admin can see all active chats
      query = { status: 'active' };
    } else {
      // Regular users see only their chats
      query = { 'participants.userId': userId };
    }

    const chats = await Chat.find(query)
      .populate('donationId', 'foodName status')
      .populate('participants.userId', 'name email role')
      .sort({ lastActivity: -1 });

    res.json(chats);
  } catch (error) {
    console.error('Error fetching user chats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chat messages
router.get('/:chatId/messages', auth(), async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user has access to this chat
    const hasAccess = userRole === 'admin' || 
      chat.participants.some(p => p.userId.toString() === userId);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }

    res.json(chat.messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.post('/:chatId/mark-read', auth(), async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Mark unread messages as read
    chat.messages.forEach(message => {
      const alreadyRead = message.read.some(r => r.userId.toString() === userId);
      if (!alreadyRead && message.senderId.toString() !== userId) {
        message.read.push({ userId });
      }
    });

    await chat.save();
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
