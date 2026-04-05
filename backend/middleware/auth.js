const jwt = require('jsonwebtoken');
const { verifySignedToken } = require('../utils/crypto');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  const signature = req.header('X-Signature');

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  if (!signature) {
    return res.status(401).json({ message: 'Access denied. No digital signature provided.' });
  }

  try {
    const decoded = verifySignedToken(token, signature);
    req.doctor = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token or signature' });
  }
};

// Optional: Middleware for routes that accept either JWT or signed JWT
const flexibleAuthMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  const signature = req.header('X-Signature');

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    let decoded;
    if (signature) {
      // Use signed token verification
      decoded = verifySignedToken(token, signature);
    } else {
      // Fall back to regular JWT verification
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    }
    
    req.doctor = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token or signature' });
  }
};

module.exports = { authMiddleware, flexibleAuthMiddleware };
