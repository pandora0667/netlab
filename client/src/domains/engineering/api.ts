import { postApiV1, requestApiV1 } from "@/domains/shared/api-client";
import type {
  DnsAuthorityReport,
  EmailSecurityReport,
  IpParityReport,
  Ipv6TransitionReport,
  PacketCaptureCapacityStatus,
  PacketCaptureReport,
  PathMtuReport,
  PerformanceLabReport,
  RoutingIncidentReport,
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

export function fetchRoutingIncidentReport(input: string) {
  return postApiV1<{ input: string }, RoutingIncidentReport>(
    `${ENGINEERING_BASE}/routing-incident-reports`,
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

export function uploadPacketCapture(file: File) {
  return requestApiV1<PacketCaptureReport>(`${ENGINEERING_BASE}/packet-capture-reports`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-netlab-filename": file.name,
    },
    body: file,
  });
}

export function fetchPacketCaptureCapacityStatus() {
  return requestApiV1<PacketCaptureCapacityStatus>(`${ENGINEERING_BASE}/packet-capture-capacity`);
}

export function fetchPerformanceLabReport(input: string) {
  return postApiV1<{ input: string }, PerformanceLabReport>(
    `${ENGINEERING_BASE}/performance-reports`,
    { input },
  );
}

export function fetchIpv6TransitionReport(domain: string) {
  return postApiV1<{ domain: string }, Ipv6TransitionReport>(
    `${ENGINEERING_BASE}/ipv6-transition-reports`,
    { domain },
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
