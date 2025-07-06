
const cron = require('node-cron');
const Donation = require('../models/Donation');
const { notifyExpiryAlert } = require('../services/notificationService');

// Check for expiring donations every hour
const startExpiryChecker = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('Checking for expiring donations...');
    
    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      // Find donations expiring in the next 24 hours
      const expiringDonations = await Donation.find({
        expiryTime: { $lte: in24Hours, $gt: now },
        status: { $in: ['pending', 'accepted'] }
      });
      
      console.log(`Found ${expiringDonations.length} expiring donations`);
      
      for (const donation of expiringDonations) {
        await notifyExpiryAlert(donation);
      }
    } catch (error) {
      console.error('Error in expiry checker:', error);
    }
  });
  
  console.log('Expiry checker cron job started');
};

module.exports = { startExpiryChecker };
