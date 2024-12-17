import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Record request start time
  const start = Date.now();
  
  // Log when response is complete
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent') || 'unknown'
    };

    // Log error level for error status codes
    if (res.statusCode >= 400) {
      logger.error('API Request Error', log);
    } 
    // Log info level for slow responses (>1s) or important endpoints
    else if (
      duration > 1000 || 
      req.path.startsWith('/api/dns-propagation') ||
      req.path.startsWith('/api/port-scan')
    ) {
      logger.info('API Request', log);
    }
    // Log debug level for other regular requests
    else {
      logger.debug('API Request', log);
    }
  });

  next();
};
