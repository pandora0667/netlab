import rateLimit from 'express-rate-limit';
import logger, { abuseLogger } from '../lib/logger';
import { runtimeConfig } from '../config/runtime.js';

function createJsonRateLimiter(
  name: string,
  options: {
    windowMs: number;
    max: number;
    message: string;
  },
) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      abuseLogger.warn('Rate limit exceeded', {
        limiter: name,
        ip: req.ip,
        path: req.path,
        requestId: res.locals.requestId,
        userAgent: req.get('user-agent') || 'unknown',
      });

      logger.warn('Rate limit exceeded', {
        limiter: name,
        ip: req.ip,
        path: req.path,
        requestId: res.locals.requestId,
      });

      res.status(429).json({
        status: 'error',
        message: options.message,
      });
    },
  });
}

export const apiLimiter = createJsonRateLimiter('api', {
  ...runtimeConfig.rateLimits.api,
  message: 'Too many requests from this IP, please try again shortly.',
});

export const pingLimiter = createJsonRateLimiter('ping', {
  ...runtimeConfig.rateLimits.ping,
  message: 'Too many ping requests from this IP, please slow down and try again shortly.',
});

export const dnsLimiter = createJsonRateLimiter('dns', {
  ...runtimeConfig.rateLimits.dns,
  message: 'Too many DNS requests from this IP, please try again shortly.',
});

export const dnsPropagationLimiter = createJsonRateLimiter('dns-propagation', {
  ...runtimeConfig.rateLimits.dnsPropagation,
  message: 'Too many DNS propagation requests from this IP, please try again shortly.',
});

export const portScanLimiter = createJsonRateLimiter('port-scan', {
  ...runtimeConfig.rateLimits.portScan,
  message: 'Too many port scan requests from this IP, please wait for current scans to finish and try again shortly.',
});
