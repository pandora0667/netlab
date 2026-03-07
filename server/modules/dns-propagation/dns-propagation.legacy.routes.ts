import { Router } from "express";
import { z } from "zod";
import logger from "../../lib/logger.js";
import { dnsPropagationLimiter } from "../../middleware/rateLimit.js";
import {
  DnsPropagationStartError,
  startDnsPropagationRequest,
} from "./dns-propagation.start.js";

const router = Router();

router.post("/propagation", dnsPropagationLimiter, async (req, res) => {
  try {
    const startedRequest = await startDnsPropagationRequest(
      req.body,
      req.ip || "unknown",
      res.locals.requestId,
      "dns-propagation",
    );

    return res.status(202).json({
      message: "DNS propagation check started",
      requestId: startedRequest.requestId,
    });
  } catch (error) {
    if (error instanceof DnsPropagationStartError) {
      if (error.details instanceof z.ZodError) {
        const issue = error.details.errors[0];
        return res.status(400).json({
          message: issue?.message || "Invalid DNS propagation request",
        });
      }

      if (error.statusCode >= 400 && error.statusCode < 500) {
        return res.status(error.statusCode).json({ message: error.message });
      }
    }

    logger.error("Failed to start DNS propagation check", {
      error: error instanceof Error ? error.message : error,
    });

    return res.status(500).json({
      message: "Failed to start DNS propagation check",
    });
  }
});

export default router;
