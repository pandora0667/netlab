import fs from 'node:fs';
import winston from 'winston';
import path from 'path';
import { getRequestContext } from './request-context.js';

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
    const metadata = Object.keys(meta).length > 0
      ? ` ${JSON.stringify(meta)}`
      : '';

    return `${timestamp} ${level}${requestId ? ` [${requestId}]` : ''}: ${message}${metadata}`;
  }),
);

const requestContextFormat = winston.format((info) => {
  const requestContext = getRequestContext();

  if (requestContext?.requestId && info.requestId === undefined) {
    info.requestId = requestContext.requestId;
  }

  if (requestContext?.clientIp && info.clientIp === undefined) {
    info.clientIp = requestContext.clientIp;
  }

  if (requestContext?.path && info.requestPath === undefined) {
    info.requestPath = requestContext.path;
  }

  return info;
});

// Define log format
const logFormat = winston.format.combine(
  requestContextFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Set log directory
const logDir = path.join(process.cwd(), 'logs');
fs.mkdirSync(logDir, { recursive: true });

function createFileTransport(filename: string, level: string, maxFiles: number) {
  return new winston.transports.File({
    filename: path.join(logDir, filename),
    level,
    maxsize: 5242880,
    maxFiles,
  });
}

// Create logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'netlab' },
  transports: [
    createFileTransport('error.log', 'error', 5),
    createFileTransport('info.log', 'info', 5),
    ...(process.env.NODE_ENV !== 'production' ? [
      createFileTransport('debug.log', 'debug', 2)
    ] : []),
  ],
});

export const abuseLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'netlab', logType: 'abuse' },
  transports: [
    createFileTransport('abuse.log', 'info', 10),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));

  abuseLogger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

export default logger;
