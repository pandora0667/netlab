import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';

function shouldSkipProductionRequestLog(path: string) {
  return path === '/healthz' || path === '/readyz';
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Record request start time
  const start = Date.now();
  
  // Log when response is complete
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent') || 'unknown'
    };

    if (res.statusCode >= 500) {
      logger.error('HTTP Request Failed', log);
      return;
    }

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request Rejected', log);
      return;
    }

    const isApiRequest = req.path.startsWith('/api');
    const isOperationalPath = req.path.startsWith('/ws') || isApiRequest;
    const isSlowRequest = duration > 1000;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      if (!shouldSkipProductionRequestLog(req.path) && (isOperationalPath || isSlowRequest)) {
        logger.info('HTTP Request', log);
      }
      return;
    }

    if (
      isSlowRequest ||
      req.path.startsWith('/api/dns-propagation') ||
      req.path.startsWith('/api/port-scanner') ||
      req.path.startsWith('/api/v1')
    ) {
      logger.info('HTTP Request', log);
      return;
    }

    logger.debug('HTTP Request', log);
  });

  next();
};
