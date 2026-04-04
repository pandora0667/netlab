import { Router } from "express";
import {
  concurrencyRouteError,
  fallbackRouteError,
  firstRouteError,
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
  websiteSecurityGate,
} from "./engineering.gates.js";
import { engineeringService } from "./engineering.service.js";

const router = Router();

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
