import { Router } from "express";
import { z } from "zod";
import { isPublicIPAddress } from "../../../shared/network/ip.js";
import { abuseLogger } from "../../lib/logger.js";
import { dnsLimiter } from "../../middleware/rateLimit.js";
import {
  registerLegacyPostAction,
} from "../../common/http/legacy-route-actions.js";
import {
  sendLegacyError,
} from "../../common/http/legacy-responses.js";
import {
  dnsLookupRequestSchema,
  dnsServerValidationSchema,
} from "./dns.contract.js";
import { dnsLookupService } from "./dns-lookup.service.js";
import { DNSError } from "./dns-resolver.service.js";
import { dnsServerValidationService } from "./dns-server-validation.service.js";

const router = Router();
router.use(dnsLimiter);

registerLegacyPostAction(router, "/", {
  parse: (req) => dnsLookupRequestSchema.parse(req.body),
  execute: async (request) => {
    const response = await dnsLookupService.lookup(request.domain, request.servers);
    return response;
  },
  onError: (error, req, res) => {
    if (error instanceof z.ZodError) {
      const blockedServer = Array.isArray(req.body?.servers)
        ? req.body.servers.find(
            (server: unknown) =>
              typeof server === "string" && !isPublicIPAddress(server),
          )
        : undefined;

      if (blockedServer) {
        abuseLogger.warn("Blocked non-public DNS resolver", {
          feature: "dns-lookup",
          ip: req.ip,
          requestId: res.locals.requestId,
          resolver: blockedServer,
        });
      }

      return sendLegacyError(res, 400, "Invalid request data", {
        details: error.errors,
      });
    }

    if (error instanceof DNSError) {
      return sendLegacyError(res, error.statusCode, error.message, {
        code: error.code,
      });
    }

    return sendLegacyError(res, 500, "Internal server error", {
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  },
});

registerLegacyPostAction(router, "/validate-server", {
  parse: (req) => {
    const serverIP = typeof req.body?.serverIP === "string" ? req.body.serverIP : undefined;
    if (!serverIP) {
      throw new DNSError("DNS server IP is required", "MISSING_SERVER_IP");
    }

    dnsServerValidationSchema.parse(req.body);
    return { serverIP };
  },
  execute: async ({ serverIP }) => {
    const validationResult = await dnsServerValidationService.validate(serverIP);
    if (!validationResult.success) {
      throw new DNSError(
        validationResult.error || "DNS server validation failed",
        "INVALID_DNS_SERVER",
      );
    }

    return {
      success: true,
      isValid: true,
      message: "DNS server validated successfully",
    };
  },
  onSuccess: (result, _req, res) => res.json(result),
  onError: (error, req, res) => {
    const serverIP = typeof req.body?.serverIP === "string" ? req.body.serverIP : undefined;

    if (error instanceof z.ZodError) {
      return sendLegacyError(res, 400, "DNS server IP is required", {
        code: "MISSING_SERVER_IP",
      });
    }

    if (error instanceof DNSError) {
      if (error.code === "INVALID_DNS_SERVER" || error.code === "PUBLIC_DNS_SERVER_REQUIRED") {
        abuseLogger.warn("Blocked DNS server validation request", {
          feature: "dns-validate-server",
          ip: req.ip,
          requestId: res.locals.requestId,
          serverIP,
          reason: error.message,
        });
      }

      return sendLegacyError(res, error.statusCode, error.message, {
        code: error.code,
      });
    }

    return sendLegacyError(res, 500, "Internal server error", {
      code: "INTERNAL_ERROR",
    });
  },
});

export default router;
