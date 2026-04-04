import { Router } from "express";
import { networkService } from "./network.service.js";
import { abuseLogger } from "../../lib/logger.js";
import { pingLimiter } from "../../middleware/rateLimit.js";
import {
  NetworkInputError,
  normalizePingOptions,
} from "../../src/lib/network-validation.js";
import { PublicTargetError } from "../../src/lib/public-targets.js";
import {
  concurrencyRouteError,
  fallbackRouteError,
  firstRouteError,
  registerGetAction,
  registerPostAction,
  resolveRequesterIp,
  zodRouteError,
} from "../../common/http/route-actions.js";
import {
  httpInspectionRequestSchema,
  subnetRequestSchema,
  traceRequestSchema,
  whoisLookupSchema,
} from "./network.contract.js";
import { httpInspectionGate, traceGate, whoisGate } from "./network.gates.js";

const router = Router();

function buildNetworkFallbackError(error: unknown, code: string, message: string, statusCode = 500) {
  return fallbackRouteError(error, code, message, statusCode);
}

registerGetAction(router, "/public-ip", {
  execute: async (_parsed, req) => {
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!clientIp) {
      throw new Error("Unable to extract IP address");
    }

    return networkService.getIPInfo(clientIp);
  },
  onError: (error) => {
    if (error instanceof Error && error.message === "Unable to extract IP address") {
      return buildNetworkFallbackError(error, "CLIENT_IP_MISSING", "Unable to extract IP address", 400);
    }

    return buildNetworkFallbackError(error, "IP_LOOKUP_FAILED", "Failed to fetch IP information");
  },
});

registerPostAction(router, "/subnets/inspect", {
  parse: (req) => subnetRequestSchema.parse(req.body),
  execute: (request) => networkService.calculateSubnet(
      request.networkAddress,
      request.mask,
    ),
  onError: (error) => firstRouteError(
    zodRouteError(error, "INVALID_SUBNET_REQUEST", "Invalid subnet request"),
  ) ?? buildNetworkFallbackError(error, "SUBNET_CALCULATION_FAILED", "Subnet calculation failed", 400),
});

registerPostAction(router, "/pings", {
  middlewares: [pingLimiter],
  parse: (req) => normalizePingOptions(req.body),
  execute: (options) => networkService.ping(options),
  onError: (error, req, res) => {
    if (error instanceof PublicTargetError) {
      abuseLogger.warn("Blocked v1 ping target", {
        feature: "ping-v1",
        ip: req.ip,
        requestId: res.locals.requestId,
        host: typeof req.body?.host === "string" ? req.body.host : undefined,
        reason: error.message,
      });

      return buildNetworkFallbackError(error, "PUBLIC_TARGET_REQUIRED", error.message, error.statusCode);
    }

    if (error instanceof NetworkInputError) {
      return buildNetworkFallbackError(error, "INVALID_PING_REQUEST", error.message, error.statusCode);
    }

    return buildNetworkFallbackError(error, "PING_FAILED", "Ping failed");
  },
});

registerPostAction(router, "/whois-lookups", {
  parse: (req) => whoisLookupSchema.parse(req.body),
  acquire: (req) => whoisGate.acquire(resolveRequesterIp(req)),
  execute: (request) => networkService.whoisLookup(request.domain),
  onError: (error) => firstRouteError(
    zodRouteError(error, "INVALID_WHOIS_REQUEST", "Invalid WHOIS lookup request"),
    concurrencyRouteError(error, "WHOIS_LOOKUP_LIMIT_REACHED"),
  ) ?? buildNetworkFallbackError(error, "WHOIS_LOOKUP_FAILED", "WHOIS lookup failed"),
});

registerPostAction(router, "/traces", {
  parse: (req) => traceRequestSchema.parse(req.body),
  acquire: (req) => traceGate.acquire(resolveRequesterIp(req)),
  execute: (request) => networkService.trace(request.host, {
      maxHops: request.maxHops,
      timeoutMs: request.timeoutMs,
    }),
  onError: (error, req, res) => {
    if (error instanceof PublicTargetError) {
      abuseLogger.warn("Blocked trace target", {
        feature: "trace-v1",
        ip: req.ip,
        requestId: res.locals.requestId,
        host: typeof req.body?.host === "string" ? req.body.host : undefined,
        reason: error.message,
      });

      return buildNetworkFallbackError(error, "PUBLIC_TARGET_REQUIRED", error.message, error.statusCode);
    }

    return firstRouteError(
      zodRouteError(error, "INVALID_TRACE_REQUEST", "Invalid trace request"),
      concurrencyRouteError(error, "TRACE_LIMIT_REACHED"),
    ) ?? buildNetworkFallbackError(error, "TRACE_FAILED", "Trace failed");
  },
});

registerPostAction(router, "/http-inspections", {
  parse: (req) => httpInspectionRequestSchema.parse(req.body),
  acquire: (req) => httpInspectionGate.acquire(resolveRequesterIp(req)),
  execute: (request) => networkService.inspectHttp(request.input, {
      timeoutMs: request.timeoutMs,
    }),
  onError: (error, req, res) => {
    if (error instanceof PublicTargetError) {
      abuseLogger.warn("Blocked HTTP inspection target", {
        feature: "http-inspection-v1",
        ip: req.ip,
        requestId: res.locals.requestId,
        input: typeof req.body?.input === "string" ? req.body.input : undefined,
        reason: error.message,
      });

      return buildNetworkFallbackError(error, "PUBLIC_TARGET_REQUIRED", error.message, error.statusCode);
    }

    return firstRouteError(
      zodRouteError(error, "INVALID_HTTP_INSPECTION_REQUEST", "Invalid HTTP inspection request"),
      concurrencyRouteError(error, "HTTP_INSPECTION_LIMIT_REACHED"),
    ) ?? buildNetworkFallbackError(error, "HTTP_INSPECTION_FAILED", "HTTP inspection failed");
  },
});

export default router;
