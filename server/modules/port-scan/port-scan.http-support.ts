import type { Request, Response } from "express";
import { abuseLogger } from "../../lib/logger.js";
import { ConcurrencyLimitError } from "../../src/lib/concurrency-gate.js";
import { PublicTargetError } from "../../src/lib/public-targets.js";
import { PortScanError, type PortScanResult } from "./port-scan.service.js";

export type PortScanConstraintError =
  | PortScanError
  | ConcurrencyLimitError
  | PublicTargetError;

export function isPortScanConstraintError(error: unknown): error is PortScanConstraintError {
  return error instanceof PortScanError
    || error instanceof ConcurrencyLimitError
    || error instanceof PublicTargetError;
}

export function resolvePortScanErrorCode(error: PortScanConstraintError) {
  if (error instanceof PortScanError) {
    return error.code;
  }

  if (error instanceof PublicTargetError) {
    return "PUBLIC_TARGET_REQUIRED";
  }

  return "PORT_SCAN_LIMIT_REACHED";
}

export function logPortScanConstraint(
  feature: string,
  req: Request,
  res: Response,
  reason: string,
  targetIp: string | undefined,
) {
  abuseLogger.warn(
    feature.includes("stream")
      ? "Blocked or constrained port scan stream request"
      : "Blocked or constrained port scan request",
    {
      feature,
      ip: req.ip,
      requestId: res.locals.requestId,
      targetIp,
      reason,
    },
  );
}

export function createRequestAbortLifecycle(req: Request, res?: Response) {
  const abortController = new AbortController();
  const cancel = () => abortController.abort();

  req.on("close", cancel);
  if (res) {
    res.on("close", cancel);
  }

  return {
    abortController,
    cleanup: () => {
      req.off("close", cancel);
      if (res) {
        res.off("close", cancel);
      }
    },
  };
}

export class PortScanStreamSession {
  private clientDisconnected = false;

  private readonly abortLifecycle: ReturnType<typeof createRequestAbortLifecycle>;

  private readonly handleDisconnect = () => {
    this.clientDisconnected = true;
    this.abortLifecycle.abortController.abort();
  };

  constructor(
    private readonly req: Request,
    private readonly res: Response,
  ) {
    this.abortLifecycle = createRequestAbortLifecycle(req, res);
    this.req.on("close", this.handleDisconnect);
    this.res.on("close", this.handleDisconnect);
  }

  get signal() {
    return this.abortLifecycle.abortController.signal;
  }

  get disconnected() {
    return this.clientDisconnected;
  }

  start() {
    this.res.setHeader("Content-Type", "text/event-stream");
    this.res.setHeader("Cache-Control", "no-cache");
    this.res.setHeader("Connection", "keep-alive");
  }

  writeProgress(
    scanned: number,
    total: number,
    currentPort: number,
    results: PortScanResult,
    showAllPorts: boolean,
  ) {
    if (this.clientDisconnected) {
      return;
    }

    this.res.write(`data: ${JSON.stringify({
      progress: {
        scanned,
        total,
        currentPort,
        status: "scanning",
      },
      results,
      showAllPorts,
    })}\n\n`);
  }

  complete(
    total: number,
    currentPort: number,
    results: PortScanResult,
    showAllPorts: boolean,
  ) {
    if (this.clientDisconnected) {
      return;
    }

    this.res.write(`data: ${JSON.stringify({
      progress: {
        scanned: total,
        total,
        currentPort,
        status: "completed",
      },
      results,
      showAllPorts,
    })}\n\n`);
    this.res.end();
  }

  writeStreamError(message: string) {
    this.res.write(`data: ${JSON.stringify({
      error: {
        type: "error",
        message,
      },
    })}\n\n`);
    this.res.end();
  }

  cleanup() {
    this.abortLifecycle.cleanup();
    this.req.off("close", this.handleDisconnect);
    this.res.off("close", this.handleDisconnect);
  }
}
