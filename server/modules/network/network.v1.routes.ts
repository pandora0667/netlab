import { Router } from "express";
import { z } from "zod";
import { networkService } from "./network.service.js";
import { abuseLogger } from "../../lib/logger.js";
import { pingLimiter } from "../../middleware/rateLimit.js";
import {
  NetworkInputError,
  normalizePingOptions,
} from "../../src/lib/network-validation.js";
import { PublicTargetError } from "../../src/lib/public-targets.js";
import { ConcurrencyLimitError } from "../../src/lib/concurrency-gate.js";
import { sendError, sendSuccess } from "../../common/http/api-response.js";
import {
  httpInspectionRequestSchema,
  subnetRequestSchema,
  traceRequestSchema,
  whoisLookupSchema,
} from "./network.contract.js";
import { httpInspectionGate, traceGate, whoisGate } from "./network.gates.js";

const router = Router();

router.get("/public-ip", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!clientIp) {
      return sendError(res, 400, {
        code: "CLIENT_IP_MISSING",
        message: "Unable to extract IP address",
      });
    }

    const ipInfo = await networkService.getIPInfo(clientIp);
    return sendSuccess(res, ipInfo);
  } catch (error) {
    return sendError(res, 500, {
      code: "IP_LOOKUP_FAILED",
      message: error instanceof Error
        ? error.message
        : "Failed to fetch IP information",
    });
  }
});

router.post("/subnets/inspect", (req, res) => {
  try {
    const request = subnetRequestSchema.parse(req.body);
    const subnetInfo = networkService.calculateSubnet(
      request.networkAddress,
      request.mask,
    );

    return sendSuccess(res, subnetInfo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_SUBNET_REQUEST",
        message: "Invalid subnet request",
        details: error.errors,
      });
    }

    return sendError(res, 400, {
      code: "SUBNET_CALCULATION_FAILED",
      message: error instanceof Error
        ? error.message
        : "Subnet calculation failed",
    });
  }
});

router.post("/pings", pingLimiter, async (req, res) => {
  try {
    const options = normalizePingOptions(req.body);
    const result = await networkService.ping(options);
    return sendSuccess(res, result);
  } catch (error) {
    if (error instanceof PublicTargetError) {
      abuseLogger.warn("Blocked v1 ping target", {
        feature: "ping-v1",
        ip: req.ip,
        requestId: res.locals.requestId,
        host: typeof req.body?.host === "string" ? req.body.host : undefined,
        reason: error.message,
      });

      return sendError(res, error.statusCode, {
        code: "PUBLIC_TARGET_REQUIRED",
        message: error.message,
      });
    }

    if (error instanceof NetworkInputError) {
      return sendError(res, error.statusCode, {
        code: "INVALID_PING_REQUEST",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "PING_FAILED",
      message: error instanceof Error ? error.message : "Ping failed",
    });
  }
});

router.post("/whois-lookups", async (req, res) => {
  let releaseLookup = () => {};

  try {
    const request = whoisLookupSchema.parse(req.body);
    releaseLookup = whoisGate.acquire(req.ip || "unknown");
    const whoisData = await networkService.whoisLookup(request.domain);
    return sendSuccess(res, whoisData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_WHOIS_REQUEST",
        message: "Invalid WHOIS lookup request",
        details: error.errors,
      });
    }

    if (error instanceof ConcurrencyLimitError) {
      return sendError(res, error.statusCode, {
        code: "WHOIS_LOOKUP_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "WHOIS_LOOKUP_FAILED",
      message: error instanceof Error ? error.message : "WHOIS lookup failed",
    });
  } finally {
    releaseLookup();
  }
});

router.post("/traces", async (req, res) => {
  let releaseTrace = () => {};

  try {
    const request = traceRequestSchema.parse(req.body);
    releaseTrace = traceGate.acquire(req.ip || "unknown");
    const trace = await networkService.trace(request.host, {
      maxHops: request.maxHops,
      timeoutMs: request.timeoutMs,
    });
    return sendSuccess(res, trace);
  } catch (error) {
    if (error instanceof PublicTargetError) {
      abuseLogger.warn("Blocked trace target", {
        feature: "trace-v1",
        ip: req.ip,
        requestId: res.locals.requestId,
        host: typeof req.body?.host === "string" ? req.body.host : undefined,
        reason: error.message,
      });

      return sendError(res, error.statusCode, {
        code: "PUBLIC_TARGET_REQUIRED",
        message: error.message,
      });
    }

    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_TRACE_REQUEST",
        message: "Invalid trace request",
        details: error.errors,
      });
    }

    if (error instanceof ConcurrencyLimitError) {
      return sendError(res, error.statusCode, {
        code: "TRACE_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "TRACE_FAILED",
      message: error instanceof Error ? error.message : "Trace failed",
    });
  } finally {
    releaseTrace();
  }
});

router.post("/http-inspections", async (req, res) => {
  let releaseInspection = () => {};

  try {
    const request = httpInspectionRequestSchema.parse(req.body);
    releaseInspection = httpInspectionGate.acquire(req.ip || "unknown");
    const inspection = await networkService.inspectHttp(request.input, {
      timeoutMs: request.timeoutMs,
    });
    return sendSuccess(res, inspection);
  } catch (error) {
    if (error instanceof PublicTargetError) {
      abuseLogger.warn("Blocked HTTP inspection target", {
        feature: "http-inspection-v1",
        ip: req.ip,
        requestId: res.locals.requestId,
        input: typeof req.body?.input === "string" ? req.body.input : undefined,
        reason: error.message,
      });

      return sendError(res, error.statusCode, {
        code: "PUBLIC_TARGET_REQUIRED",
        message: error.message,
      });
    }

    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_HTTP_INSPECTION_REQUEST",
        message: "Invalid HTTP inspection request",
        details: error.errors,
      });
    }

    if (error instanceof ConcurrencyLimitError) {
      return sendError(res, error.statusCode, {
        code: "HTTP_INSPECTION_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "HTTP_INSPECTION_FAILED",
      message: error instanceof Error
        ? error.message
        : "HTTP inspection failed",
    });
  } finally {
    releaseInspection();
  }
});

export default router;
