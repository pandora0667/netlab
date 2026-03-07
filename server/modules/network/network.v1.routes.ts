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
import { sendError, sendSuccess } from "../../common/http/api-response.js";
import {
  subnetRequestSchema,
  whoisLookupSchema,
} from "./network.contract.js";

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
  try {
    const request = whoisLookupSchema.parse(req.body);
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

    return sendError(res, 500, {
      code: "WHOIS_LOOKUP_FAILED",
      message: error instanceof Error ? error.message : "WHOIS lookup failed",
    });
  }
});

export default router;
