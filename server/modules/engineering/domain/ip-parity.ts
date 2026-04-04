import type { FamilyProbeResult, IpParityReport } from "../engineering.types.js";

interface IpParityAssessmentInput {
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  ipv4Probe: FamilyProbeResult;
  ipv6Probe: FamilyProbeResult;
}

export function buildIpParityAssessment({
  ipv4Addresses,
  ipv6Addresses,
  ipv4Probe,
  ipv6Probe,
}: IpParityAssessmentInput) {
  let status: IpParityReport["status"] = "unreachable";

  if (ipv4Addresses.length > 0 && ipv6Addresses.length > 0) {
    status = ipv4Probe.reachable === ipv6Probe.reachable ? "balanced" : "mismatch";
  } else if (ipv4Addresses.length > 0) {
    status = "ipv4-only";
  } else if (ipv6Addresses.length > 0) {
    status = "ipv6-only";
  }

  const findings: IpParityReport["findings"] = [];

  if (status === "balanced" && ipv4Probe.reachable && ipv6Probe.reachable) {
    findings.push({
      status: "pass",
      title: "IPv4 and IPv6 both resolved and accepted a TCP probe.",
      detail: "The service looks dual-stack reachable from this vantage point.",
    });
  }

  if (status === "ipv4-only") {
    findings.push({
      status: "warn",
      title: "Only IPv4 records were published.",
      detail: "There is no AAAA record to compare against, so IPv6 clients cannot follow the same path.",
    });
  }

  if (status === "ipv6-only") {
    findings.push({
      status: "warn",
      title: "Only IPv6 records were published.",
      detail: "There is no IPv4 fallback, which may be intentional but narrows reachability.",
    });
  }

  if (status === "mismatch") {
    findings.push({
      status: "warn",
      title: "IPv4 and IPv6 do not behave the same way.",
      detail: "One family resolved but did not accept the same TCP probe, which is a common dual-stack drift pattern.",
    });
  }

  if (!ipv4Probe.reachable && !ipv6Probe.reachable) {
    findings.push({
      status: "info",
      title: "Neither family accepted the tested TCP probes.",
      detail: "This may still be expected if the service does not listen on 80 or 443.",
    });
  }

  return {
    status,
    findings,
    summary: {
      Status: status,
      "IPv4 addresses": ipv4Addresses.length,
      "IPv6 addresses": ipv6Addresses.length,
      "IPv4 reachable": ipv4Probe.reachable,
      "IPv6 reachable": ipv6Probe.reachable,
    },
  } satisfies {
    status: IpParityReport["status"];
    findings: IpParityReport["findings"];
    summary: Record<string, unknown>;
  };
}

