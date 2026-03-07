import { Router } from "express";
import { z } from "zod";
import { dnsPropagationLimiter } from "../../middleware/rateLimit.js";
import { sendError, sendSuccess } from "../../common/http/api-response.js";
import {
  DnsPropagationStartError,
  startDnsPropagationRequest,
} from "./dns-propagation.start.js";

const HTTP_ACCEPTED = 202;

const router = Router();

router.post("/requests", dnsPropagationLimiter, async (req, res) => {
  try {
    const request = await startDnsPropagationRequest(
      req.body,
      req.ip || "unknown",
      res.locals.requestId,
      "dns-propagation-v1",
    );

    return sendSuccess(res, {
      message: "DNS propagation check started",
      requestId: request.requestId,
      domain: request.domain,
      region: request.region,
    }, HTTP_ACCEPTED);
  } catch (error) {
    if (error instanceof DnsPropagationStartError && error.details instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_DNS_PROPAGATION_REQUEST",
        message: "Invalid DNS propagation request",
        details: error.details.errors,
      });
    }

    if (error instanceof DnsPropagationStartError && error.statusCode >= 400 && error.statusCode < 500) {
      return sendError(res, error.statusCode, {
        code: "DNS_PROPAGATION_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "DNS_PROPAGATION_START_FAILED",
      message: "Failed to start DNS propagation check",
    });
  }
});

export default router;
