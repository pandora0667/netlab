import { Router, type Response } from "express";
import { z } from "zod";
import logger, { abuseLogger } from "../../lib/logger.js";
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

const router = Router();

function getRequesterIp(ip: string | undefined): string {
  return ip || "unknown";
}

function respondWithPortScanError(res: Response, error: unknown) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: error.errors });
  }

  if (error instanceof PortScanError || error instanceof ConcurrencyLimitError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error instanceof PublicTargetError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(500).json({ error: "Internal server error" });
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
    releaseScan = portScanGate.acquire(getRequesterIp(req.ip));

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

    logger.warn("Port scan stream failed", {
      ip: req.ip,
      error: error instanceof Error ? error.message : error,
    });

    if (
      error instanceof PortScanError ||
      error instanceof ConcurrencyLimitError ||
      error instanceof PublicTargetError
    ) {
      abuseLogger.warn("Blocked or constrained port scan stream request", {
        feature: "port-scan-stream",
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

    respondWithPortScanError(res, error);
  } finally {
    releaseScan();
    req.off("close", cancelScan);
    res.off("close", cancelScan);
  }
});

router.post("/export", async (req, res) => {
  try {
    const { results, format } = portScanExportSchema.parse(req.body);
    const exportedData = exportResults(results, format);

    res.setHeader("Content-Type", format === "JSON" ? "application/json" : "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=port-scan-${Date.now()}.${format.toLowerCase()}`,
    );

    return res.send(exportedData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/scan", portScanLimiter, async (req, res) => {
  let releaseScan = () => {};
  const abortController = new AbortController();
  const cancelScan = () => abortController.abort();

  req.on("close", cancelScan);

  try {
    const scanRequest = parsePortScanRequest(req.body as Record<string, unknown>);
    releaseScan = portScanGate.acquire(getRequesterIp(req.ip));

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

    if (
      error instanceof PortScanError ||
      error instanceof ConcurrencyLimitError ||
      error instanceof PublicTargetError
    ) {
      abuseLogger.warn("Blocked or constrained port scan request", {
        feature: "port-scan",
        ip: req.ip,
        requestId: res.locals.requestId,
        targetIp: typeof req.body?.targetIp === "string" ? req.body.targetIp : undefined,
        reason: error.message,
      });
    }

    respondWithPortScanError(res, error);
  } finally {
    releaseScan();
    req.off("close", cancelScan);
  }
});

export default router;
