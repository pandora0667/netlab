import { Router } from "express";
import { z } from "zod";
import { abuseLogger } from "../../lib/logger.js";
import { pingLimiter } from "../../middleware/rateLimit.js";
import {
  NetworkInputError,
  normalizePingOptions,
} from "../../src/lib/network-validation.js";
import { PublicTargetError } from "../../src/lib/public-targets.js";
import { networkService } from "./network.service.js";
import {
  parseLegacySubnetRequest,
  whoisLookupSchema,
} from "./network.contract.js";

const router = Router();

router.get("/ip", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!clientIp) {
      return res.status(400).json({ error: "Unable to extract IP address" });
    }

    const ipInfo = await networkService.getIPInfo(clientIp);
    return res.json(ipInfo);
  } catch {
    return res.status(500).json({ error: "Failed to fetch IP information" });
  }
});

router.post("/subnet", (req, res) => {
  try {
    const request = parseLegacySubnetRequest(req.body);
    const subnetInfo = networkService.calculateSubnet(
      request.networkAddress,
      request.mask,
    );

    return res.json(subnetInfo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "networkAddress and mask are required",
      });
    }

    return res.status(400).json({
      error: error instanceof Error ? error.message : "Subnet calculation failed",
    });
  }
});

router.post("/ping", pingLimiter, async (req, res) => {
  try {
    const options = normalizePingOptions(req.body);
    const result = await networkService.ping(options);
    return res.json(result);
  } catch (error) {
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

      return res.status(error.statusCode).json({ error: error.message });
    }

    return res.status(500).json({ error: "Ping failed" });
  }
});

router.post("/whois", async (req, res) => {
  try {
    const request = whoisLookupSchema.parse(req.body);
    const whoisResult = await networkService.whoisLookup(request.domain);
    return res.json(whoisResult);
  } catch {
    return res.status(500).json({ error: "WHOIS lookup failed" });
  }
});

export default router;
