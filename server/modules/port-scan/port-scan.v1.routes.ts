import { Router } from "express";
import { z } from "zod";
import logger from "../../lib/logger.js";
import {
  exportResults,
  portScan,
  PortScanError,
} from "./port-scan.service.js";
import { portScanLimiter } from "../../middleware/rateLimit.js";
import { sendError, sendSuccess } from "../../common/http/api-response.js";
import {
  registerPostAction,
  resolveRequesterIp,
  zodRouteError,
} from "../../common/http/route-actions.js";
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
  resolvePortScanErrorCode,
} from "./port-scan.http-support.js";

const router = Router();

router.get("/stream", portScanLimiter, async (req, res) => {
  let releaseScan = () => {};
  const streamSession = new PortScanStreamSession(req, res);

  try {
    const scanRequest = parsePortScanRequest(req.query as Record<string, unknown>);
    releaseScan = portScanGate.acquire(resolveRequesterIp(req));

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

    logger.warn("Port scan v1 stream failed", {
      ip: req.ip,
      error: error instanceof Error ? error.message : error,
    });

    if (isPortScanConstraintError(error)) {
      logPortScanConstraint(
        "port-scan-stream-v1",
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

    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_PORT_SCAN_REQUEST",
        message: "Invalid port scan request",
        details: error.errors,
      });
    }

    if (isPortScanConstraintError(error)) {
      return sendError(res, error.statusCode, {
        code: resolvePortScanErrorCode(error),
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "PORT_SCAN_STREAM_FAILED",
      message: error instanceof Error ? error.message : "Port scan stream failed",
    });
  } finally {
    releaseScan();
    streamSession.cleanup();
  }
});

router.post("/", portScanLimiter, async (req, res) => {
  let releaseScan = () => {};
  const { abortController, cleanup } = createRequestAbortLifecycle(req);

  try {
    const scanRequest = parsePortScanRequest(req.body as Record<string, unknown>);
    releaseScan = portScanGate.acquire(resolveRequesterIp(req));

    const results = await portScan({
      ...scanRequest,
      signal: abortController.signal,
    });

    return sendSuccess(res, results);
  } catch (error) {
    if (error instanceof PortScanError && error.code === "SCAN_CANCELLED") {
      return;
    }

    logger.warn("Port scan v1 request failed", {
      ip: req.ip,
      error: error instanceof Error ? error.message : error,
    });

    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_PORT_SCAN_REQUEST",
        message: "Invalid port scan request",
        details: error.errors,
      });
    }

    if (isPortScanConstraintError(error)) {
      logPortScanConstraint(
        "port-scan-v1",
        req,
        res,
        error.message,
        typeof req.body?.targetIp === "string" ? req.body.targetIp : undefined,
      );

      return sendError(res, error.statusCode, {
        code: resolvePortScanErrorCode(error),
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "PORT_SCAN_FAILED",
      message: error instanceof Error ? error.message : "Port scan failed",
    });
  } finally {
    releaseScan();
    cleanup();
  }
});

registerPostAction(router, "/exports", {
  parse: (req) => portScanExportSchema.parse(req.body),
  execute: ({ results, format }) => ({
    format,
    exportedData: exportResults(results, format),
  }),
  onSuccess: ({ format, exportedData }, _req, res) => {
    res.setHeader(
      "Content-Type",
      format === "JSON" ? "application/json" : "text/csv",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=port-scan-${Date.now()}.${format.toLowerCase()}`,
    );

    return res.send(exportedData);
  },
  onError: (error) => (
    zodRouteError(error, "INVALID_PORT_SCAN_EXPORT_REQUEST", "Invalid port scan export request")
    ?? {
      statusCode: 500,
      error: {
        code: "PORT_SCAN_EXPORT_FAILED",
        message: error instanceof Error ? error.message : "Port scan export failed",
      },
    }
  ),
});

export default router;
