import { Router } from "express";
import { z } from "zod";
import { isPublicIPAddress } from "../../../shared/network/ip.js";
import { abuseLogger } from "../../lib/logger.js";
import { dnsLimiter } from "../../middleware/rateLimit.js";
import {
  dnsLookupRequestSchema,
  dnsServerValidationSchema,
} from "./dns.contract.js";
import { dnsLookupService } from "./dns-lookup.service.js";
import { DNSError } from "./dns-resolver.service.js";
import { dnsServerValidationService } from "./dns-server-validation.service.js";

const router = Router();
router.use(dnsLimiter);

router.post("/", async (req, res) => {
  try {
    const request = dnsLookupRequestSchema.parse(req.body);
    const response = await dnsLookupService.lookup(request.domain, request.servers);
    return res.json(response);
  } catch (error) {
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

      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
    }

    if (error instanceof DNSError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

router.post("/validate-server", async (req, res) => {
  const serverIP = typeof req.body?.serverIP === "string" ? req.body.serverIP : undefined;

  try {
    if (!serverIP) {
      throw new DNSError("DNS server IP is required", "MISSING_SERVER_IP");
    }

    dnsServerValidationSchema.parse(req.body);

    const validationResult = await dnsServerValidationService.validate(serverIP);
    if (!validationResult.success) {
      throw new DNSError(
        validationResult.error || "DNS server validation failed",
        "INVALID_DNS_SERVER",
      );
    }

    return res.json({
      success: true,
      isValid: true,
      message: "DNS server validated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "DNS server IP is required",
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

      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

export default router;
