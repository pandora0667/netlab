import { Router } from "express";
import { z } from "zod";
import logger, { abuseLogger } from "../../lib/logger.js";
import {
  exportResults,
  portScan,
  PortScanError,
} from "./port-scan.service.js";
import { portScanLimiter } from "../../middleware/rateLimit.js";
import { ConcurrencyLimitError } from "../../src/lib/concurrency-gate.js";
import { PublicTargetError } from "../../src/lib/public-targets.js";
import { sendError, sendSuccess } from "../../common/http/api-response.js";
import {
  parsePortScanRequest,
  portScanExportSchema,
} from "./port-scan.contract.js";
import { portScanGate } from "./port-scan.gate.js";

const router = Router();

function resolveRequesterIp(ip: string | undefined): string {
  return ip || "unknown";
}

router.get("/stream", portScanLimiter, async (req, res) => {
  let releaseScan = () => {};
  let clientDisconnected = false;

  const abortController = new AbortController();
  const cancelScan = () => {
    clientDisconnected = true;
    abortController.abort();
  };

  req.on("close", cancelScan);
  res.on("close", cancelScan);

  try {
    const scanRequest = parsePortScanRequest(req.query as Record<string, unknown>);
    releaseScan = portScanGate.acquire(resolveRequesterIp(req.ip));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let scanned = 0;
    const total = scanRequest.ports.length;
    const showAllPorts = req.query.showAllPorts === "true";

    const results = await portScan({
      ...scanRequest,
      signal: abortController.signal,
      onProgress: (currentPort, partialResults) => {
        scanned += 1;

        if (clientDisconnected) {
          return;
        }

        res.write(`data: ${JSON.stringify({
          progress: {
            scanned,
            total,
            currentPort,
            status: "scanning",
          },
          results: partialResults,
          showAllPorts,
        })}\n\n`);
      },
    });

    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({
        progress: {
          scanned: total,
          total,
          currentPort: scanRequest.ports[scanRequest.ports.length - 1],
          status: "completed",
        },
        results,
        showAllPorts,
      })}\n\n`);
      res.end();
    }
  } catch (error) {
    if (clientDisconnected || (error instanceof PortScanError && error.code === "SCAN_CANCELLED")) {
      return;
    }

    logger.warn("Port scan v1 stream failed", {
      ip: req.ip,
      error: error instanceof Error ? error.message : error,
    });

    if (
      error instanceof PortScanError ||
      error instanceof ConcurrencyLimitError ||
      error instanceof PublicTargetError
    ) {
      abuseLogger.warn("Blocked or constrained v1 port scan stream request", {
        feature: "port-scan-stream-v1",
        ip: req.ip,
        requestId: res.locals.requestId,
        targetIp: typeof req.query.targetIp === "string" ? req.query.targetIp : undefined,
        reason: error.message,
      });
    }

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({
        error: {
          type: "error",
          message: error instanceof Error ? error.message : "Port scanning failed",
        },
      })}\n\n`);
      res.end();
      return;
    }

    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_PORT_SCAN_REQUEST",
        message: "Invalid port scan request",
        details: error.errors,
      });
    }

    if (
      error instanceof PortScanError ||
      error instanceof ConcurrencyLimitError ||
      error instanceof PublicTargetError
    ) {
      return sendError(res, error.statusCode, {
        code: error instanceof PortScanError
          ? error.code
          : error instanceof PublicTargetError
            ? "PUBLIC_TARGET_REQUIRED"
            : "PORT_SCAN_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "PORT_SCAN_STREAM_FAILED",
      message: error instanceof Error ? error.message : "Port scan stream failed",
    });
  } finally {
    releaseScan();
    req.off("close", cancelScan);
    res.off("close", cancelScan);
  }
});

router.post("/", portScanLimiter, async (req, res) => {
  let releaseScan = () => {};
  const abortController = new AbortController();
  const cancelScan = () => abortController.abort();

  req.on("close", cancelScan);

  try {
    const scanRequest = parsePortScanRequest(req.body as Record<string, unknown>);
    releaseScan = portScanGate.acquire(resolveRequesterIp(req.ip));

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

    if (
      error instanceof PortScanError ||
      error instanceof ConcurrencyLimitError ||
      error instanceof PublicTargetError
    ) {
      abuseLogger.warn("Blocked or constrained v1 port scan request", {
        feature: "port-scan-v1",
        ip: req.ip,
        requestId: res.locals.requestId,
        targetIp: typeof req.body?.targetIp === "string" ? req.body.targetIp : undefined,
        reason: error.message,
      });

      return sendError(res, error.statusCode, {
        code: error instanceof PortScanError
          ? error.code
          : error instanceof PublicTargetError
            ? "PUBLIC_TARGET_REQUIRED"
            : "PORT_SCAN_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "PORT_SCAN_FAILED",
      message: error instanceof Error ? error.message : "Port scan failed",
    });
  } finally {
    releaseScan();
    req.off("close", cancelScan);
  }
});

router.post("/exports", async (req, res) => {
  try {
    const { results, format } = portScanExportSchema.parse(req.body);
    const exportedData = exportResults(results, format);

    res.setHeader(
      "Content-Type",
      format === "JSON" ? "application/json" : "text/csv",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=port-scan-${Date.now()}.${format.toLowerCase()}`,
    );

    return res.send(exportedData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_PORT_SCAN_EXPORT_REQUEST",
        message: "Invalid port scan export request",
        details: error.errors,
      });
    }

    return sendError(res, 500, {
      code: "PORT_SCAN_EXPORT_FAILED",
      message: error instanceof Error ? error.message : "Port scan export failed",
    });
  }
});

export default router;
