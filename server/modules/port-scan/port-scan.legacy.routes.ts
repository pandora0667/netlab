import { Router, type Response } from "express";
import { z } from "zod";
import logger from "../../lib/logger.js";
import { portScanLimiter } from "../../middleware/rateLimit.js";
import { ConcurrencyLimitError } from "../../src/lib/concurrency-gate.js";
import { PublicTargetError } from "../../src/lib/public-targets.js";
import {
  exportResults,
  portScan,
  PortScanError,
} from "./port-scan.service.js";
import {
  parsePortScanRequest,
  portScanExportSchema,
} from "./port-scan.contract.js";
import { portScanGate } from "./port-scan.gate.js";
import {
  createRequestAbortLifecycle,
  isPortScanConstraintError,
  logPortScanConstraint,
  PortScanStreamSession,
} from "./port-scan.http-support.js";
import {
  registerLegacyPostAction,
} from "../../common/http/legacy-route-actions.js";
import {
  sendLegacyError,
} from "../../common/http/legacy-responses.js";

const router = Router();

function respondWithPortScanError(res: Response, error: unknown) {
  if (error instanceof z.ZodError) {
    return sendLegacyError(res, 400, error.errors);
  }

  if (error instanceof PortScanError || error instanceof ConcurrencyLimitError) {
    return sendLegacyError(res, error.statusCode, error.message);
  }

  if (error instanceof PublicTargetError) {
    return sendLegacyError(res, error.statusCode, error.message);
  }

  if (error instanceof Error) {
    return sendLegacyError(res, 400, error.message);
  }

  return sendLegacyError(res, 500, "Internal server error");
}

router.get("/stream", portScanLimiter, async (req, res) => {
  let releaseScan = () => {};
  const streamSession = new PortScanStreamSession(req, res);

  try {
    const scanRequest = parsePortScanRequest(req.query as Record<string, unknown>);
    releaseScan = portScanGate.acquire(req.ip || "unknown");

    streamSession.start();

    let scanned = 0;
    const total = scanRequest.ports.length;
    const showAllPorts = req.query.showAllPorts === "true";

    const results = await portScan({
      ...scanRequest,
      signal: streamSession.signal,
      onProgress: (currentPort, partialResults) => {
        scanned += 1;
        streamSession.writeProgress(scanned, total, currentPort, partialResults, showAllPorts);
      },
    });

    streamSession.complete(
      total,
      scanRequest.ports[scanRequest.ports.length - 1],
      results,
      showAllPorts,
    );
  } catch (error) {
    if (streamSession.disconnected || (error instanceof PortScanError && error.code === "SCAN_CANCELLED")) {
      return;
    }

    logger.warn("Port scan stream failed", {
      ip: req.ip,
      error: error instanceof Error ? error.message : error,
    });

    if (isPortScanConstraintError(error)) {
      logPortScanConstraint(
        "port-scan-stream",
        req,
        res,
        error.message,
        typeof req.query.targetIp === "string" ? req.query.targetIp : undefined,
      );
    }

    if (res.headersSent) {
      streamSession.writeStreamError(error instanceof Error ? error.message : "Port scanning failed");
      return;
    }

    respondWithPortScanError(res, error);
  } finally {
    releaseScan();
    streamSession.cleanup();
  }
});

registerLegacyPostAction(router, "/export", {
  parse: (req) => portScanExportSchema.parse(req.body),
  execute: ({ results, format }) => ({
    format,
    exportedData: exportResults(results, format),
  }),
  onSuccess: ({ format, exportedData }, _req, res) => {
    res.setHeader("Content-Type", format === "JSON" ? "application/json" : "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=port-scan-${Date.now()}.${format.toLowerCase()}`,
    );

    return res.send(exportedData);
  },
  onError: (error, _req, res) => {
    if (error instanceof z.ZodError) {
      return sendLegacyError(res, 400, error.errors);
    }

    return sendLegacyError(res, 500, "Internal server error");
  },
});

router.post("/scan", portScanLimiter, async (req, res) => {
  let releaseScan = () => {};
  const { abortController, cleanup } = createRequestAbortLifecycle(req);

  try {
    const scanRequest = parsePortScanRequest(req.body as Record<string, unknown>);
    releaseScan = portScanGate.acquire(req.ip || "unknown");

    const results = await portScan({
      ...scanRequest,
      signal: abortController.signal,
    });

    return res.json(results);
  } catch (error) {
    if (error instanceof PortScanError && error.code === "SCAN_CANCELLED") {
      return;
    }

    logger.warn("Port scan request failed", {
      ip: req.ip,
      error: error instanceof Error ? error.message : error,
    });

    if (isPortScanConstraintError(error)) {
      logPortScanConstraint(
        "port-scan",
        req,
        res,
        error.message,
        typeof req.body?.targetIp === "string" ? req.body.targetIp : undefined,
      );
    }

    respondWithPortScanError(res, error);
  } finally {
    releaseScan();
    cleanup();
  }
});

export default router;
