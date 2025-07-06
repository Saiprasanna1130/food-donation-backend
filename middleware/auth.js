
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

module.exports = (roles = []) => {
  // Usage: auth(['admin', 'donor'])
  if (typeof roles === 'string') roles = [roles];

  return (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden: No permission' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid Token' });
    }
  };
};
