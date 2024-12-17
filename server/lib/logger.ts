import winston from 'winston';
import path from 'path';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Set log directory
const logDir = path.join(process.cwd(), 'logs');

// Create logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'netlab' },
  transports: [
    // Error level logs are saved to error.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Info level and above logs are saved to info.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'info.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Debug level and above logs are saved only in development
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.File({ 
        filename: path.join(logDir, 'debug.log'),
        level: 'debug',
        maxsize: 5242880, // 5MB
        maxFiles: 2,
      })
    ] : []),
  ],
});

// Also output to console in development environment
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export default logger;
