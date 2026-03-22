export type { PingOptions } from "../../src/lib/network-validation.js";

export interface NetworkIpInfo {
  ip: string;
  city: string;
  country: string;
  region: string;
  isp: string;
  timezone: string;
  message?: string;
}

export interface WhoisLookupResult {
  data: string;
}

export interface PingResult {
  success: boolean;
  latency?: number | null;
  error?: string;
  sequence: number;
  timestamp: number;
}

export interface PingStatistics {
  sent: number;
  received: number;
  lost: number;
  successRate: number;
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
  timestamp: number;
}

export interface PingSummary {
  host: string;
  type: "icmp" | "tcp";
  results: PingResult[];
  statistics: PingStatistics;
  timestamp: number;
}

export interface TraceHop {
  hop: number;
  responder: string | null;
  latencyMs: number | null;
  status: "hop" | "destination" | "timeout";
  reachedTarget: boolean;
}

export interface TraceSummary {
  host: string;
  targetIp: string;
  protocol: "icmp";
  maxHops: number;
  timeoutMs: number;
  hops: TraceHop[];
  completed: boolean;
  timestamp: number;
}

export interface HttpRedirectHop {
  status: number;
  url: string;
  location: string | null;
}

export interface HttpTlsCertificate {
  subject: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  expiresInDays: number | null;
}

export interface HttpTlsInspectionResult {
  input: string;
  requestedUrl: string;
  finalUrl: string;
  redirects: HttpRedirectHop[];
  status: number;
  responseHeaders: Record<string, string>;
  hsts: string | null;
  server: string | null;
  contentType: string | null;
  protocol: string | null;
  tlsVersion: string | null;
  tlsAuthorized: boolean | null;
  tlsAuthorizationError: string | null;
  certificate: HttpTlsCertificate | null;
  timestamp: number;
}
