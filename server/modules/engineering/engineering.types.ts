import type { NetworkIpInfo } from "../network/network.types.js";

export interface ReportHistoryChange {
  label: string;
  before: string;
  after: string;
}

export interface ReportHistory {
  previousCheckedAt: number | null;
  changed: boolean;
  changes: ReportHistoryChange[];
}

export interface RoutingControlPlaneReport {
  input: string;
  targetIp: string;
  resolvedAddresses: string[];
  resolvedFromHostname: boolean;
  prefix: string | null;
  originAsn: string | null;
  originHolder: string | null;
  rpkiStatus: string | null;
  validatingRoas: Array<{
    origin: string;
    prefix: string;
    validity: string;
    maxLength: number | null;
  }>;
  visibility: {
    ipv4RisPeersSeeing: number | null;
    ipv4RisPeersTotal: number | null;
    ipv6RisPeersSeeing: number | null;
    ipv6RisPeersTotal: number | null;
  };
  firstSeen: string | null;
  lastSeen: string | null;
  lessSpecifics: Array<{ prefix: string; origin: number | null }>;
  moreSpecifics: Array<{ prefix: string; origin: number | null }>;
  registryBlock: {
    resource: string | null;
    name: string | null;
    description: string | null;
  };
  geo: NetworkIpInfo;
  notes: string[];
  checkedAt: number;
  history: ReportHistory;
}

export interface DnsAuthorityReport {
  domain: string;
  zoneApex: string;
  nameservers: string[];
  soa: {
    nsname: string | null;
    hostmaster: string | null;
    serial: number | null;
    refresh: number | null;
    retry: number | null;
    expire: number | null;
    minttl: number | null;
  } | null;
  caaRecords: Array<{
    critical: boolean;
    tag: string;
    value: string;
  }>;
  dnssec: {
    enabled: boolean;
    validated: boolean;
    dsRecords: string[];
    dnskeyRecords: string[];
  };
  delegationStatus: "healthy" | "warning" | "unsigned";
  findings: Array<{
    status: "pass" | "warn" | "info";
    title: string;
    detail: string;
  }>;
  checkedAt: number;
  history: ReportHistory;
}

export interface FamilyProbeResult {
  addresses: string[];
  reachable: boolean;
  probePort: number | null;
  latencyMs: number | null;
  error: string | null;
}

export interface IpParityReport {
  domain: string;
  ipv4: FamilyProbeResult;
  ipv6: FamilyProbeResult;
  status: "balanced" | "ipv4-only" | "ipv6-only" | "mismatch" | "unreachable";
  findings: Array<{
    status: "pass" | "warn" | "info";
    title: string;
    detail: string;
  }>;
  checkedAt: number;
  history: ReportHistory;
}

export interface PathMtuAttempt {
  payloadSize: number;
  success: boolean;
  error: string | null;
}

export interface PathMtuReport {
  input: string;
  targetIp: string;
  maxPayloadSize: number | null;
  estimatedPathMtu: number | null;
  attempts: PathMtuAttempt[];
  notes: string[];
  checkedAt: number;
  history: ReportHistory;
}

export interface WebsiteSecurityCheck {
  status: "pass" | "warn" | "fail";
  title: string;
  detail: string;
}

export interface WebsiteSecurityReport {
  input: string;
  hostname: string;
  zoneApex: string;
  finalUrl: string;
  score: number;
  grade: string;
  checks: WebsiteSecurityCheck[];
  keyHeaders: Record<string, string | null>;
  dnssecEnabled: boolean;
  caaPresent: boolean;
  securityTxt: {
    found: boolean;
    url: string | null;
  };
  tlsVersion: string | null;
  certificateExpiresInDays: number | null;
  checkedAt: number;
  history: ReportHistory;
}

export interface EmailSecurityReport {
  domain: string;
  score: number;
  grade: string;
  mxRecords: Array<{
    exchange: string;
    priority: number;
  }>;
  spf: {
    present: boolean;
    record: string | null;
  };
  dmarc: {
    present: boolean;
    record: string | null;
    policy: string | null;
  };
  dkim: {
    foundSelectors: string[];
    checkedSelectors: string[];
  };
  startTls: Array<{
    host: string;
    supportsStartTls: boolean;
    tlsVersion: string | null;
    tlsAuthorized: boolean | null;
    tlsAuthorizationError: string | null;
    error: string | null;
  }>;
  mtaSts: {
    dnsRecord: string | null;
    policyFound: boolean;
  };
  tlsRpt: {
    present: boolean;
    record: string | null;
  };
  checks: Array<{
    status: "pass" | "warn" | "fail" | "info";
    title: string;
    detail: string;
  }>;
  checkedAt: number;
  history: ReportHistory;
}
