
const Notification = require('../models/Notification');
const UserToken = require('../models/UserToken');
const User = require('../models/User');
const { sendNotification } = require('../config/firebase');
const nodemailer = require('nodemailer');

// Email transporter setup
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const sendEmailNotification = async (email, title, message) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `GiveGood Harvest - ${title}`,
      html: `
        <h2>${title}</h2>
        <p>${message}</p>
        <p>Visit <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}">GiveGood Harvest</a> to view more details.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

const createNotification = async (userId, title, message, type, donationId = null) => {
  try {
    // Create notification in database
    const notification = new Notification({
      userId,
      title,
      message,
      type,
      donationId
    });
    await notification.save();

    // Get user details
    const user = await User.findById(userId);
    if (!user) return;

    // Send email notification
    const emailSent = await sendEmailNotification(user.email, title, message);
    notification.emailSent = emailSent;

    // Get user's FCM tokens
    const userTokens = await UserToken.find({ userId, active: true });
    const fcmTokens = userTokens.map(token => token.fcmToken);

    // Send push notification
    if (fcmTokens.length > 0) {
      try {
        await sendNotification(fcmTokens, title, message, {
          type,
          donationId: donationId?.toString() || '',
          notificationId: notification._id.toString()
        });
        notification.pushSent = true;
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

const notifyNewDonation = async (donation) => {
  try {
    // Notify all NGOs about new donation
    const ngos = await User.find({ role: 'ngo', verified: true });
    
    const title = 'New Food Donation Available';
    const message = `${donation.foodName} (${donation.quantity}) is available for pickup from ${donation.donorName}`;

    for (const ngo of ngos) {
      await createNotification(ngo._id, title, message, 'donation', donation._id);
    }
  } catch (error) {
    console.error('Error notifying about new donation:', error);
  }
};

const notifyStatusUpdate = async (donation, newStatus) => {
  try {
    let title, message, recipients = [];

    switch (newStatus) {
      case 'accepted':
        title = 'Your Donation Has Been Accepted';
        message = `Your donation "${donation.foodName}" has been accepted by ${donation.acceptedBy.name}`;
        recipients = [donation.donorId];
        break;
      case 'picked_up':
        title = 'Donation Picked Up';
        message = `Your donation "${donation.foodName}" has been picked up successfully`;
        recipients = [donation.donorId];
        break;
      case 'cancelled':
        title = 'Donation Cancelled';
        message = `The donation "${donation.foodName}" has been cancelled`;
        if (donation.acceptedBy) {
          recipients = [donation.acceptedBy.id];
        }
        break;
      case 'rejected':
        title = 'Donation Rejected';
        message = `Your donation "${donation.foodName}" has been rejected`;
        recipients = [donation.donorId];
        break;
    }

    for (const recipientId of recipients) {
      await createNotification(recipientId, title, message, 'status_update', donation._id);
    }
  } catch (error) {
    console.error('Error notifying about status update:', error);
  }
};

const notifyExpiryAlert = async (donation) => {
  try {
    const title = 'Donation Expiring Soon';
    const message = `Your donation "${donation.foodName}" will expire soon. Please ensure it's picked up in time.`;
    
    // Notify donor
    await createNotification(donation.donorId, title, message, 'expiry_alert', donation._id);
    
    // If accepted, also notify the NGO
    if (donation.acceptedBy) {
      const ngoMessage = `The donation "${donation.foodName}" you accepted will expire soon. Please pick it up as soon as possible.`;
      await createNotification(donation.acceptedBy.id, title, ngoMessage, 'expiry_alert', donation._id);
    }
  } catch (error) {
    console.error('Error sending expiry alert:', error);
  }
};

module.exports = {
  createNotification,
  notifyNewDonation,
  notifyStatusUpdate,
  notifyExpiryAlert
};
