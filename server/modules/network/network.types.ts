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
  redacted: boolean;
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

export interface HttpServiceBindingRecord {
  recordType: "HTTPS" | "SVCB";
  priority: number;
  targetName: string;
  alpns: string[];
  ipv4Hints: string[];
  ipv6Hints: string[];
  port: number | null;
  ech: boolean;
  raw: string;
}

export interface HttpProtocolProbeResult {
  protocol: "http2" | "http3";
  available: boolean;
  attempted: boolean;
  binary: string | null;
  succeeded: boolean | null;
  statusCode: number | null;
  httpVersion: string | null;
  remoteIp: string | null;
  connectMs: number | null;
  tlsHandshakeMs: number | null;
  ttfbMs: number | null;
  detail: string;
}

export interface Http3AssessmentResult {
  advertised: boolean;
  evidenceSources: string[];
  verdict:
    | "not-applicable"
    | "not-advertised"
    | "binary-unavailable"
    | "advertised-working"
    | "advertised-failed";
  summary: string;
  nextStep: string;
}

export interface HttpProtocolComparison {
  comparable: boolean;
  winner: "http2" | "http3" | "tie" | null;
  ttfbDeltaMs: number | null;
  connectDeltaMs: number | null;
  summary: string;
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
  alpnProtocol: string | null;
  tlsAuthorized: boolean | null;
  tlsAuthorizationError: string | null;
  certificate: HttpTlsCertificate | null;
  altSvcRaw: string | null;
  altSvcProtocols: string[];
  serviceBindings: HttpServiceBindingRecord[];
  serviceBindingSource: "dig" | "doh" | "none";
  serviceBindingNotes: string[];
  http2Probe: HttpProtocolProbeResult | null;
  http3: HttpProtocolProbeResult;
  http3Assessment: Http3AssessmentResult;
  httpComparison: HttpProtocolComparison;
  timestamp: number;
}
