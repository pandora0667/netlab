import type { NextFunction, Request, Response } from "express";
import { resolveRequestId, runWithRequestContext } from "../lib/request-context.js";

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = resolveRequestId(req.get("x-request-id"));

  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  runWithRequestContext(
    {
      requestId,
      clientIp: req.ip,
      path: req.path,
    },
    () => next(),
  );
}
