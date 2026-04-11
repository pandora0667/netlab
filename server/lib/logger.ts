import fs from 'node:fs';
import winston from 'winston';
import path from 'path';
import { getRequestContext } from './request-context.js';

const isProduction = process.env.NODE_ENV === 'production';
const loggerLevel = process.env.LOG_LEVEL?.trim() || (isProduction ? 'info' : 'debug');
const fileLogLevel = process.env.FILE_LOG_LEVEL?.trim() || loggerLevel;
const consoleLogLevel = process.env.CONSOLE_LOG_LEVEL?.trim() || loggerLevel;
const prettyConsoleLogs = (process.env.LOG_PRETTY_CONSOLE?.trim()
  || (isProduction ? 'false' : 'true')) === 'true';

function normalizeLogMessage(message: unknown) {
  if (typeof message === 'string') {
    return message;
  }

  if (message instanceof Error) {
    return message.message;
  }

  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
    const metadata = Object.keys(meta).length > 0
      ? ` ${JSON.stringify(meta)}`
      : '';

    const normalizedRequestId = typeof requestId === 'string'
      ? requestId
      : requestId instanceof Error
        ? requestId.message
        : requestId == null
          ? ''
          : String(requestId);

    return `${timestamp} ${level}${normalizedRequestId ? ` [${normalizedRequestId}]` : ''}: ${normalizeLogMessage(message)}${metadata}`;
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
  level: loggerLevel,
  format: logFormat,
  defaultMeta: { service: 'netlab' },
  transports: [
    createFileTransport('error.log', 'error', 5),
    createFileTransport('info.log', fileLogLevel, 5),
    ...(!isProduction ? [
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

const consoleTransport = new winston.transports.Console({
  level: consoleLogLevel,
  format: prettyConsoleLogs ? consoleFormat : logFormat,
});

logger.add(consoleTransport);
abuseLogger.add(new winston.transports.Console({
  level: 'info',
  format: prettyConsoleLogs ? consoleFormat : logFormat,
}));

export default logger;
