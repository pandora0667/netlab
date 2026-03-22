import { Router } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../../common/http/api-response.js";
import { ConcurrencyLimitError } from "../../src/lib/concurrency-gate.js";
import {
  engineeringDomainSchema,
  engineeringTargetSchema,
} from "./engineering.contract.js";
import {
  emailSecurityGate,
  engineeringGate,
  websiteSecurityGate,
} from "./engineering.gates.js";
import { engineeringService } from "./engineering.service.js";

const router = Router();

router.post("/routing-reports", async (req, res) => {
  let release = () => {};

  try {
    const request = engineeringTargetSchema.parse(req.body);
    release = engineeringGate.acquire(req.ip || "unknown");
    const report = await engineeringService.getRoutingReport(request.input);
    return sendSuccess(res, report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_ROUTING_REPORT_REQUEST",
        message: "Invalid routing report request",
        details: error.errors,
      });
    }

    if (error instanceof ConcurrencyLimitError) {
      return sendError(res, error.statusCode, {
        code: "ROUTING_REPORT_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "ROUTING_REPORT_FAILED",
      message: error instanceof Error ? error.message : "Routing report failed",
    });
  } finally {
    release();
  }
});

router.post("/authority-reports", async (req, res) => {
  let release = () => {};

  try {
    const request = engineeringDomainSchema.parse(req.body);
    release = engineeringGate.acquire(req.ip || "unknown");
    const report = await engineeringService.getDnsAuthorityReport(request.domain);
    return sendSuccess(res, report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_AUTHORITY_REPORT_REQUEST",
        message: "Invalid DNS authority report request",
        details: error.errors,
      });
    }

    if (error instanceof ConcurrencyLimitError) {
      return sendError(res, error.statusCode, {
        code: "AUTHORITY_REPORT_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "AUTHORITY_REPORT_FAILED",
      message: error instanceof Error ? error.message : "DNS authority report failed",
    });
  } finally {
    release();
  }
});

router.post("/parity-reports", async (req, res) => {
  let release = () => {};

  try {
    const request = engineeringDomainSchema.parse(req.body);
    release = engineeringGate.acquire(req.ip || "unknown");
    const report = await engineeringService.getIpParityReport(request.domain);
    return sendSuccess(res, report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_PARITY_REPORT_REQUEST",
        message: "Invalid IPv4/IPv6 parity request",
        details: error.errors,
      });
    }

    if (error instanceof ConcurrencyLimitError) {
      return sendError(res, error.statusCode, {
        code: "PARITY_REPORT_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "PARITY_REPORT_FAILED",
      message: error instanceof Error ? error.message : "IPv4/IPv6 parity report failed",
    });
  } finally {
    release();
  }
});

router.post("/path-mtu-reports", async (req, res) => {
  let release = () => {};

  try {
    const request = engineeringTargetSchema.parse(req.body);
    release = engineeringGate.acquire(req.ip || "unknown");
    const report = await engineeringService.getPathMtuReport(request.input);
    return sendSuccess(res, report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_PATH_MTU_REPORT_REQUEST",
        message: "Invalid path MTU report request",
        details: error.errors,
      });
    }

    if (error instanceof ConcurrencyLimitError) {
      return sendError(res, error.statusCode, {
        code: "PATH_MTU_REPORT_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "PATH_MTU_REPORT_FAILED",
      message: error instanceof Error ? error.message : "Path MTU report failed",
    });
  } finally {
    release();
  }
});

router.post("/website-security-reports", async (req, res) => {
  let release = () => {};

  try {
    const request = engineeringTargetSchema.parse(req.body);
    release = websiteSecurityGate.acquire(req.ip || "unknown");
    const report = await engineeringService.getWebsiteSecurityReport(request.input);
    return sendSuccess(res, report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_WEBSITE_SECURITY_REQUEST",
        message: "Invalid website security request",
        details: error.errors,
      });
    }

    if (error instanceof ConcurrencyLimitError) {
      return sendError(res, error.statusCode, {
        code: "WEBSITE_SECURITY_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "WEBSITE_SECURITY_REPORT_FAILED",
      message: error instanceof Error ? error.message : "Website security report failed",
    });
  } finally {
    release();
  }
});

router.post("/email-security-reports", async (req, res) => {
  let release = () => {};

  try {
    const request = engineeringDomainSchema.parse(req.body);
    release = emailSecurityGate.acquire(req.ip || "unknown");
    const report = await engineeringService.getEmailSecurityReport(request.domain);
    return sendSuccess(res, report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, {
        code: "INVALID_EMAIL_SECURITY_REQUEST",
        message: "Invalid email security request",
        details: error.errors,
      });
    }

    if (error instanceof ConcurrencyLimitError) {
      return sendError(res, error.statusCode, {
        code: "EMAIL_SECURITY_LIMIT_REACHED",
        message: error.message,
      });
    }

    return sendError(res, 500, {
      code: "EMAIL_SECURITY_REPORT_FAILED",
      message: error instanceof Error ? error.message : "Email security report failed",
    });
  } finally {
    release();
  }
});

export default router;
