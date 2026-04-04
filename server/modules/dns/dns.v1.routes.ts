import { Router } from "express";
import { abuseLogger } from "../../lib/logger.js";
import { dnsLimiter } from "../../middleware/rateLimit.js";
import { isPublicIPAddress } from "../../../shared/network/ip.js";
import {
  concurrencyRouteError,
  fallbackRouteError,
  firstRouteError,
  registerPostAction,
  resolveRequesterIp,
  zodRouteError,
} from "../../common/http/route-actions.js";
import { dnsServerValidationService } from "./dns-server-validation.service.js";
import { dnsLookupService } from "./dns-lookup.service.js";
import { DNSError } from "./dns-resolver.service.js";
import { dnsLookupGate } from "./dns-lookup.gate.js";
import {
  dnsLookupRequestSchema,
  dnsServerValidationSchema,
} from "./dns.contract.js";

const router = Router();
router.use(dnsLimiter);

function dnsErrorResponse(
  error: unknown,
  code: string,
  message: string,
  statusCode = 500,
) {
  return fallbackRouteError(error, code, message, statusCode);
}

registerPostAction(router, "/lookups", {
  parse: (req) => dnsLookupRequestSchema.parse(req.body),
  acquire: (req) => dnsLookupGate.acquire(resolveRequesterIp(req)),
  execute: async (request) => {
    const response = await dnsLookupService.lookup(request.domain, request.servers);
    return {
      domain: response.domain,
      results: response.results,
    };
  },
  onError: (error, req, res) => {
    if (zodRouteError(error, "INVALID_DNS_LOOKUP_REQUEST", "Invalid DNS lookup request")) {
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
    }

    if (error instanceof DNSError) {
      return dnsErrorResponse(error, error.code, error.message, error.statusCode);
    }

    return firstRouteError(
      zodRouteError(error, "INVALID_DNS_LOOKUP_REQUEST", "Invalid DNS lookup request"),
      concurrencyRouteError(error, "DNS_LOOKUP_LIMIT_REACHED"),
    ) ?? dnsErrorResponse(error, "DNS_LOOKUP_FAILED", "DNS lookup failed");
  },
});

registerPostAction(router, "/servers/validate", {
  parse: (req) => dnsServerValidationSchema.parse(req.body),
  execute: async (request) => {
    const validationResult = await dnsServerValidationService.validate(request.serverIP);

    if (!validationResult.success) {
      throw new DNSError(
        validationResult.error || "DNS server validation failed",
        "INVALID_DNS_SERVER",
      );
    }

    return {
      isValid: true,
      message: "DNS server validated successfully",
    };
  },
  onError: (error, req, res) => {
    const serverIP = typeof req.body?.serverIP === "string"
      ? req.body.serverIP
      : undefined;

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

      return dnsErrorResponse(error, error.code, error.message, error.statusCode);
    }

    return firstRouteError(
      zodRouteError(error, "INVALID_DNS_SERVER_REQUEST", "Invalid DNS server validation request"),
    ) ?? dnsErrorResponse(error, "DNS_SERVER_VALIDATION_FAILED", "DNS server validation failed");
  },
});

export default router;
