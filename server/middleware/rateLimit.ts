import rateLimit from 'express-rate-limit';
import logger from '../lib/logger';

// API Request Rate Limit Configuration
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum requests per IP
  message: 'Too many requests from this IP, please try again after 15 minutes',
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      status: 'error',
      message: 'Too many requests from this IP, please try again after 15 minutes'
    });
  }
});
