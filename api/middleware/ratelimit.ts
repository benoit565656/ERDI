import rateLimit from 'express-rate-limit';

// Configurable limit, currently high (1000 req/min) per user's preference
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded (1000 requests per minute).',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
