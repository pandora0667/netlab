import { Router } from "express";
import { z } from "zod";
import { abuseLogger } from "../../lib/logger.js";
import { dnsLimiter } from "../../middleware/rateLimit.js";
import { sendError, sendSuccess } from "../../common/http/api-response.js";
import { isPublicIPAddress } from "../../../shared/network/ip.js";
import { dnsServerValidationService } from "./dns-server-validation.service.js";
import { dnsLookupService } from "./dns-lookup.service.js";
import { DNSError } from "./dns-resolver.service.js";
import {
  dnsLookupRequestSchema,
  dnsServerValidationSchema,
} from "./dns.contract.js";

const router = Router();
router.use(dnsLimiter);

router.post("/lookups", async (req, res) => {
  try {
    const request = dnsLookupRequestSchema.parse(req.body);
    const response = await dnsLookupService.lookup(request.domain, request.servers);

    return sendSuccess(res, {
      domain: response.domain,
      results: response.results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const blockedServer = Array.isArray(req.body?.servers)
        ? req.body.servers.find(
            (server: unknown) =>
              typeof server === "string" && !isPublicIPAddress(server),
          )
        : undefined;

      if (blockedServer) {
        abuseLogger.warn("Blocked v1 non-public DNS resolver", {
          feature: "dns-lookup-v1",
          ip: req.ip,
          requestId: res.locals.requestId,
          resolver: blockedServer,
        });
      }

      return sendError(res, 400, {
        code: "INVALID_DNS_LOOKUP_REQUEST",
        message: "Invalid DNS lookup request",
        details: error.errors,
      });
    }

    if (error instanceof DNSError) {
      return sendError(res, error.statusCode, {
        code: error.code,
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "DNS_LOOKUP_FAILED",
      message: error instanceof Error ? error.message : "DNS lookup failed",
    });
  }
});

router.post("/servers/validate", async (req, res) => {
  const serverIP = typeof req.body?.serverIP === "string"
    ? req.body.serverIP
    : undefined;

  try {
    const request = dnsServerValidationSchema.parse(req.body);
    const validationResult = await dnsServerValidationService.validate(request.serverIP);

    if (!validationResult.success) {
      throw new DNSError(
        validationResult.error || "DNS server validation failed",
        "INVALID_DNS_SERVER",
      );
    }

    return sendSuccess(res, {
      isValid: true,
      message: "DNS server validated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_DNS_SERVER_REQUEST",
        message: "Invalid DNS server validation request",
        details: error.errors,
      });
    }

    if (error instanceof DNSError) {
      if (error.code === "INVALID_DNS_SERVER" || error.code === "PUBLIC_DNS_SERVER_REQUIRED") {
        abuseLogger.warn("Blocked v1 DNS server validation request", {
          feature: "dns-validate-server-v1",
          ip: req.ip,
          requestId: res.locals.requestId,
          serverIP,
          reason: error.message,
        });
      }

      return sendError(res, error.statusCode, {
        code: error.code,
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "DNS_SERVER_VALIDATION_FAILED",
      message: error instanceof Error
        ? error.message
        : "DNS server validation failed",
    });
  }
});

export default router;
