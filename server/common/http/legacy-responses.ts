import type { Response } from "express";

export function sendLegacyError(
  res: Response,
  statusCode: number,
  error: unknown,
  extras?: Record<string, unknown>,
) {
  return res.status(statusCode).json({
    error,
    ...(extras ?? {}),
  });
}

export function sendLegacyMessage(
  res: Response,
  statusCode: number,
  message: string,
  extras?: Record<string, unknown>,
) {
  return res.status(statusCode).json({
    message,
    ...(extras ?? {}),
  });
}
