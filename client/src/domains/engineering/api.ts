import { postApiV1 } from "@/domains/shared/api-client";
import type {
  DnsAuthorityReport,
  EmailSecurityReport,
  IpParityReport,
  PathMtuReport,
  RoutingControlPlaneReport,
  WebsiteSecurityReport,
} from "./types";

const ENGINEERING_BASE = "/api/v1/engineering";

export function fetchRoutingReport(input: string) {
  return postApiV1<{ input: string }, RoutingControlPlaneReport>(
    `${ENGINEERING_BASE}/routing-reports`,
    { input },
  );
}

export function fetchDnsAuthorityReport(domain: string) {
  return postApiV1<{ domain: string }, DnsAuthorityReport>(
    `${ENGINEERING_BASE}/authority-reports`,
    { domain },
  );
}

export function fetchIpParityReport(domain: string) {
  return postApiV1<{ domain: string }, IpParityReport>(
    `${ENGINEERING_BASE}/parity-reports`,
    { domain },
  );
}

export function fetchPathMtuReport(input: string) {
  return postApiV1<{ input: string }, PathMtuReport>(
    `${ENGINEERING_BASE}/path-mtu-reports`,
    { input },
  );
}

export function fetchWebsiteSecurityReport(input: string) {
  return postApiV1<{ input: string }, WebsiteSecurityReport>(
    `${ENGINEERING_BASE}/website-security-reports`,
    { input },
  );
}

export function fetchEmailSecurityReport(domain: string) {
  return postApiV1<{ domain: string }, EmailSecurityReport>(
    `${ENGINEERING_BASE}/email-security-reports`,
    { domain },
  );
}
