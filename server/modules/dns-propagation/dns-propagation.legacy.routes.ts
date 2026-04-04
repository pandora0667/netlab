import { Router } from "express";
import { z } from "zod";
import logger from "../../lib/logger.js";
import { dnsPropagationLimiter } from "../../middleware/rateLimit.js";
import {
  registerLegacyPostAction,
} from "../../common/http/legacy-route-actions.js";
import {
  sendLegacyMessage,
} from "../../common/http/legacy-responses.js";
import {
  DnsPropagationStartError,
  startDnsPropagationRequest,
} from "./dns-propagation.start.js";

const router = Router();

registerLegacyPostAction(router, "/propagation", {
  middlewares: [dnsPropagationLimiter],
  execute: async (_parsed, req, res) => {
    const startedRequest = await startDnsPropagationRequest(
      req.body,
      req.ip || "unknown",
      res.locals.requestId,
      "dns-propagation",
    );

    return {
      message: "DNS propagation check started",
      requestId: startedRequest.requestId,
    };
  },
  onSuccess: (result, _req, res) => res.status(202).json(result),
  onError: (error, _req, res) => {
    if (error instanceof DnsPropagationStartError) {
      if (error.details instanceof z.ZodError) {
        const issue = error.details.errors[0];
        return sendLegacyMessage(res, 400, issue?.message || "Invalid DNS propagation request");
      }

      if (error.statusCode >= 400 && error.statusCode < 500) {
        return sendLegacyMessage(res, error.statusCode, error.message);
      }
    }

    logger.error("Failed to start DNS propagation check", {
      error: error instanceof Error ? error.message : error,
    });

    return sendLegacyMessage(res, 500, "Failed to start DNS propagation check");
  },
});

export default router;
