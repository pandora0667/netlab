import { Router } from "express";
import { z } from "zod";
import { abuseLogger } from "../../lib/logger.js";
import { pingLimiter } from "../../middleware/rateLimit.js";
import {
  NetworkInputError,
  normalizePingOptions,
} from "../../src/lib/network-validation.js";
import { PublicTargetError } from "../../src/lib/public-targets.js";
import {
  registerLegacyGetAction,
  registerLegacyPostAction,
} from "../../common/http/legacy-route-actions.js";
import { sendLegacyError } from "../../common/http/legacy-responses.js";
import { networkService } from "./network.service.js";
import {
  parseLegacySubnetRequest,
  whoisLookupSchema,
} from "./network.contract.js";

const router = Router();

registerLegacyGetAction(router, "/ip", {
  execute: async (_parsed, req) => {
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!clientIp) {
      throw new Error("Unable to extract IP address");
    }

    return networkService.getIPInfo(clientIp);
  },
  onError: (error, _req, res) => {
    if (error instanceof Error && error.message === "Unable to extract IP address") {
      return sendLegacyError(res, 400, "Unable to extract IP address");
    }

    return sendLegacyError(res, 500, "Failed to fetch IP information");
  },
});

registerLegacyPostAction(router, "/subnet", {
  parse: (req) => parseLegacySubnetRequest(req.body),
  execute: (request) => networkService.calculateSubnet(
      request.networkAddress,
      request.mask,
    ),
  onError: (error, _req, res) => {
    if (error instanceof z.ZodError) {
      return sendLegacyError(res, 400, "networkAddress and mask are required");
    }

    return sendLegacyError(
      res,
      400,
      error instanceof Error ? error.message : "Subnet calculation failed",
    );
  },
});

registerLegacyPostAction(router, "/ping", {
  middlewares: [pingLimiter],
  parse: (req) => normalizePingOptions(req.body),
  execute: (options) => networkService.ping(options),
  onError: (error, req, res) => {
    if (error instanceof NetworkInputError || error instanceof PublicTargetError) {
      if (error instanceof PublicTargetError) {
        abuseLogger.warn("Blocked ping target", {
          feature: "ping",
          ip: req.ip,
          requestId: res.locals.requestId,
          host: typeof req.body?.host === "string" ? req.body.host : undefined,
          reason: error.message,
        });
      }

      return sendLegacyError(res, error.statusCode, error.message);
    }

    return sendLegacyError(res, 500, "Ping failed");
  },
});

registerLegacyPostAction(router, "/whois", {
  parse: (req) => whoisLookupSchema.parse(req.body),
  execute: (request) => networkService.whoisLookup(request.domain),
  onError: (_error, _req, res) => sendLegacyError(res, 500, "WHOIS lookup failed"),
});

export default router;
