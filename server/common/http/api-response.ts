import type { Response } from "express";

const DEFAULT_ERROR_CODE = "INTERNAL_ERROR";

export interface ApiErrorDetails {
  code?: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessEnvelope<TData> {
  success: true;
  data: TData;
  error: null;
  requestId: string;
}

export interface ApiErrorEnvelope {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

function resolveRequestId(res: Response): string {
  return typeof res.locals.requestId === "string"
    ? res.locals.requestId
    : "unknown-request";
}

export function sendSuccess<TData>(
  res: Response,
  data: TData,
  statusCode = 200,
) {
  const payload: ApiSuccessEnvelope<TData> = {
    success: true,
    data,
    error: null,
    requestId: resolveRequestId(res),
  };

  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  statusCode: number,
  error: ApiErrorDetails,
) {
  const payload: ApiErrorEnvelope = {
    success: false,
    data: null,
    error: {
      code: error.code || DEFAULT_ERROR_CODE,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
    requestId: resolveRequestId(res),
  };

  return res.status(statusCode).json(payload);
}
