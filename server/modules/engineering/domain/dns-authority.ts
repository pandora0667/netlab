import type { DnsAuthorityReport } from "../engineering.types.js";
import { normalizeUnorderedStrings } from "./inputs.js";

interface DnsAuthorityAssessmentInput {
  domain: string;
  zoneApex: string;
  nameservers: string[];
  soa: DnsAuthorityReport["soa"];
  caaRecords: DnsAuthorityReport["caaRecords"];
  dsRecords: string[];
  dnskeyRecords: string[];
  dsAuthenticated: boolean;
  dnskeyAuthenticated: boolean;
}

export function buildDnsAuthorityAssessment({
  domain,
  zoneApex,
  nameservers,
  soa,
  caaRecords,
  dsRecords,
  dnskeyRecords,
  dsAuthenticated,
  dnskeyAuthenticated,
}: DnsAuthorityAssessmentInput) {
  const dnssecEnabled = dsRecords.length > 0 && dnskeyRecords.length > 0;
  const dnssecValidated = dnssecEnabled && dsAuthenticated && dnskeyAuthenticated;
  const findings: DnsAuthorityReport["findings"] = [];

  if (zoneApex !== domain) {
    findings.push({
      status: "info",
      title: "The input is below the authoritative zone apex.",
      detail: `Authority checks were normalized from ${domain} to zone apex ${zoneApex}.`,
    });
  }

  if (nameservers.length >= 2) {
    findings.push({
      status: "pass",
      title: "Multiple authoritative nameservers are published.",
      detail: "The zone exposes at least two NS records, which is the minimum healthy redundancy baseline.",
    });
  } else if (nameservers.length === 1) {
    findings.push({
      status: "warn",
      title: "Only one authoritative nameserver is published.",
      detail: "Single-NS delegation reduces resilience during outages or maintenance.",
    });
  } else {
    findings.push({
      status: "warn",
      title: "No NS records were returned.",
      detail: "The zone delegation looks incomplete from this vantage point.",
    });
  }

  if (!soa) {
    findings.push({
      status: "warn",
      title: "SOA data was not returned.",
      detail: "The zone did not expose a readable SOA record during this check.",
    });
  } else {
    findings.push({
      status: "pass",
      title: "SOA record is present.",
      detail: `Serial ${soa.serial ?? "n/a"} was returned with primary NS ${soa.nsname ?? "unknown"}.`,
    });
  }

  if (dnssecEnabled && dnssecValidated) {
    findings.push({
      status: "pass",
      title: "DNSSEC chain looks published and validated.",
      detail: "DS and DNSKEY records were both returned and the validating resolver marked the response authenticated.",
    });
  } else if (dsRecords.length > 0 && dnskeyRecords.length === 0) {
    findings.push({
      status: "warn",
      title: "DS exists but DNSKEY did not return.",
      detail: "This can indicate a broken DNSSEC chain or missing child signing material.",
    });
  } else if (dsRecords.length === 0 && dnskeyRecords.length > 0) {
    findings.push({
      status: "warn",
      title: "DNSKEY exists without parent DS.",
      detail: "The zone looks signed locally but not fully delegated through the parent.",
    });
  } else {
    findings.push({
      status: "info",
      title: "The zone is effectively unsigned.",
      detail: "No DS or DNSKEY records were found from this vantage point.",
    });
  }

  if (caaRecords.length > 0) {
    findings.push({
      status: "pass",
      title: "CAA records are published.",
      detail: "Certificate issuance is constrained by explicit CAA policy.",
    });
  } else {
    findings.push({
      status: "info",
      title: "CAA records are not published.",
      detail: "Lack of CAA is common, but it removes one certificate issuance control.",
    });
  }

  return {
    dnssecEnabled,
    dnssecValidated,
    findings,
    delegationStatus: dnssecEnabled ? "healthy" : (nameservers.length > 0 ? "unsigned" : "warning"),
    summary: {
      "Zone apex": zoneApex,
      Nameservers: normalizeUnorderedStrings(nameservers).join(", ") || "none",
      DNSSEC: dnssecEnabled ? "enabled" : "unsigned",
      "CAA records": caaRecords.length,
      "SOA serial": soa?.serial ?? "n/a",
    },
  } satisfies {
    dnssecEnabled: boolean;
    dnssecValidated: boolean;
    findings: DnsAuthorityReport["findings"];
    delegationStatus: DnsAuthorityReport["delegationStatus"];
    summary: Record<string, unknown>;
  };
}

