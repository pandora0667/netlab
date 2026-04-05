import express, { Router } from "express";
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
  engineeringDomainSchema,
  engineeringTargetSchema,
} from "./engineering.contract.js";
import {
  emailSecurityGate,
  engineeringGate,
  packetCaptureGate,
  websiteSecurityGate,
} from "./engineering.gates.js";
import { engineeringService } from "./engineering.service.js";
import {
  PacketCaptureCapacityError,
  PacketCaptureResourceMonitor,
  PacketCaptureValidationError,
  inspectPacketCaptureUpload,
} from "./infrastructure/probes/lab-probes.js";

const router = Router();
const packetCaptureResourceMonitor = new PacketCaptureResourceMonitor();

function buildEngineeringRouteError(
  error: unknown,
  invalidCode: string,
  invalidMessage: string,
  limitCode: string,
  failedCode: string,
  failedMessage: string,
) {
  return firstRouteError(
    zodRouteError(error, invalidCode, invalidMessage),
    concurrencyRouteError(error, limitCode),
  ) ?? fallbackRouteError(error, failedCode, failedMessage);
}

function buildPacketCaptureRouteError(error: unknown) {
  if (error instanceof PacketCaptureValidationError) {
    return {
      statusCode: error.statusCode,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
  }

  if (error instanceof PacketCaptureCapacityError) {
    return {
      statusCode: error.statusCode,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
  }

  const concurrency = concurrencyRouteError(error, "PACKET_CAPTURE_LIMIT_REACHED");
  if (concurrency) {
    return concurrency;
  }

  return fallbackRouteError(
    error,
    "PACKET_CAPTURE_REPORT_FAILED",
    "Packet capture analysis failed",
  );
}

registerPostAction(router, "/routing-reports", {
  parse: (req) => engineeringTargetSchema.parse(req.body),
  acquire: (req) => engineeringGate.acquire(resolveRequesterIp(req)),
  execute: (request) => engineeringService.getRoutingReport(request.input),
  onError: (error) => buildEngineeringRouteError(
    error,
    "INVALID_ROUTING_REPORT_REQUEST",
    "Invalid routing report request",
    "ROUTING_REPORT_LIMIT_REACHED",
    "ROUTING_REPORT_FAILED",
    "Routing report failed",
  ),
});

registerPostAction(router, "/routing-incident-reports", {
  parse: (req) => engineeringTargetSchema.parse(req.body),
  acquire: (req) => engineeringGate.acquire(resolveRequesterIp(req)),
  execute: (request) => engineeringService.getRoutingIncidentReport(request.input),
  onError: (error) => buildEngineeringRouteError(
    error,
    "INVALID_ROUTING_INCIDENT_REQUEST",
    "Invalid routing incident request",
    "ROUTING_INCIDENT_LIMIT_REACHED",
    "ROUTING_INCIDENT_REPORT_FAILED",
    "Routing incident report failed",
  ),
});

registerPostAction(router, "/authority-reports", {
  parse: (req) => engineeringDomainSchema.parse(req.body),
  acquire: (req) => engineeringGate.acquire(resolveRequesterIp(req)),
  execute: (request) => engineeringService.getDnsAuthorityReport(request.domain),
  onError: (error) => buildEngineeringRouteError(
    error,
    "INVALID_AUTHORITY_REPORT_REQUEST",
    "Invalid DNS authority report request",
    "AUTHORITY_REPORT_LIMIT_REACHED",
    "AUTHORITY_REPORT_FAILED",
    "DNS authority report failed",
  ),
});

registerPostAction(router, "/parity-reports", {
  parse: (req) => engineeringDomainSchema.parse(req.body),
  acquire: (req) => engineeringGate.acquire(resolveRequesterIp(req)),
  execute: (request) => engineeringService.getIpParityReport(request.domain),
  onError: (error) => buildEngineeringRouteError(
    error,
    "INVALID_PARITY_REPORT_REQUEST",
    "Invalid IPv4/IPv6 parity request",
    "PARITY_REPORT_LIMIT_REACHED",
    "PARITY_REPORT_FAILED",
    "IPv4/IPv6 parity report failed",
  ),
});

registerPostAction(router, "/path-mtu-reports", {
  parse: (req) => engineeringTargetSchema.parse(req.body),
  acquire: (req) => engineeringGate.acquire(resolveRequesterIp(req)),
  execute: (request) => engineeringService.getPathMtuReport(request.input),
  onError: (error) => buildEngineeringRouteError(
    error,
    "INVALID_PATH_MTU_REPORT_REQUEST",
    "Invalid path MTU report request",
    "PATH_MTU_REPORT_LIMIT_REACHED",
    "PATH_MTU_REPORT_FAILED",
    "Path MTU report failed",
  ),
});

registerPostAction(router, "/packet-capture-reports", {
  middlewares: [
    express.raw({
      type: () => true,
      limit: "12mb",
    }),
  ],
  parse: (req) => {
    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const filename = String(req.header("x-netlab-filename") || "capture.pcapng").trim();
    const upload = inspectPacketCaptureUpload(payload, filename);

    return {
      payload,
      filename: upload.filename,
    };
  },
  acquire: (req) => {
    const requesterIp = resolveRequesterIp(req);
    const snapshot = packetCaptureGate.getSnapshot(requesterIp);
    packetCaptureResourceMonitor.assertCanAccept(snapshot);

    try {
      return packetCaptureGate.acquire(requesterIp);
    } catch (error) {
      if (concurrencyRouteError(error, "PACKET_CAPTURE_LIMIT_REACHED")) {
        throw new PacketCaptureCapacityError(
          "The capture workers are currently full. Please try again later.",
          429,
          packetCaptureResourceMonitor.getStatus(packetCaptureGate.getSnapshot(requesterIp)),
        );
      }

      throw error;
    }
  },
  execute: (request) => engineeringService.getPacketCaptureReport(
    request.payload,
    request.filename,
  ),
  onError: (error) => buildPacketCaptureRouteError(error),
});

registerGetAction(router, "/packet-capture-capacity", {
  execute: (_parsed, req) => (
    packetCaptureResourceMonitor.getStatus(
      packetCaptureGate.getSnapshot(resolveRequesterIp(req)),
    )
  ),
  onError: (error) => fallbackRouteError(
    error,
    "PACKET_CAPTURE_CAPACITY_STATUS_FAILED",
    "Packet capture capacity status failed",
  ),
});

registerPostAction(router, "/performance-reports", {
  parse: (req) => engineeringTargetSchema.parse(req.body),
  acquire: (req) => engineeringGate.acquire(resolveRequesterIp(req)),
  execute: (request) => engineeringService.getPerformanceLabReport(request.input),
  onError: (error) => buildEngineeringRouteError(
    error,
    "INVALID_PERFORMANCE_REPORT_REQUEST",
    "Invalid performance analysis request",
    "PERFORMANCE_REPORT_LIMIT_REACHED",
    "PERFORMANCE_REPORT_FAILED",
    "Performance analysis report failed",
  ),
});

registerPostAction(router, "/ipv6-transition-reports", {
  parse: (req) => engineeringDomainSchema.parse(req.body),
  acquire: (req) => engineeringGate.acquire(resolveRequesterIp(req)),
  execute: (request) => engineeringService.getIpv6TransitionReport(request.domain),
  onError: (error) => buildEngineeringRouteError(
    error,
    "INVALID_IPV6_TRANSITION_REQUEST",
    "Invalid IPv6 transition request",
    "IPV6_TRANSITION_LIMIT_REACHED",
    "IPV6_TRANSITION_REPORT_FAILED",
    "IPv6 transition report failed",
  ),
});

registerPostAction(router, "/website-security-reports", {
  parse: (req) => engineeringTargetSchema.parse(req.body),
  acquire: (req) => websiteSecurityGate.acquire(resolveRequesterIp(req)),
  execute: (request) => engineeringService.getWebsiteSecurityReport(request.input),
  onError: (error) => buildEngineeringRouteError(
    error,
    "INVALID_WEBSITE_SECURITY_REQUEST",
    "Invalid website security request",
    "WEBSITE_SECURITY_LIMIT_REACHED",
    "WEBSITE_SECURITY_REPORT_FAILED",
    "Website security report failed",
  ),
});

registerPostAction(router, "/email-security-reports", {
  parse: (req) => engineeringDomainSchema.parse(req.body),
  acquire: (req) => emailSecurityGate.acquire(resolveRequesterIp(req)),
  execute: (request) => engineeringService.getEmailSecurityReport(request.domain),
  onError: (error) => buildEngineeringRouteError(
    error,
    "INVALID_EMAIL_SECURITY_REQUEST",
    "Invalid email security request",
    "EMAIL_SECURITY_LIMIT_REACHED",
    "EMAIL_SECURITY_REPORT_FAILED",
    "Email security report failed",
  ),
});

export default router;
