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
  geo: {
    ip: string;
    city: string;
    country: string;
    region: string;
    isp: string;
    timezone: string;
    message?: string;
  };
  notes: string[];
  checkedAt: number;
  history: ReportHistory;
}

export interface RoutingIncidentReport {
  input: string;
  targetIp: string;
  resolvedAddresses: string[];
  resolvedFromHostname: boolean;
  prefix: string | null;
  originAsn: string | null;
  rpkiStatus: string | null;
  window: {
    start: string;
    end: string;
    hours: number;
  };
  summary: {
    updates: number;
    announcements: number;
    withdrawals: number;
    uniquePeers: number;
    uniqueOrigins: number;
    uniquePaths: number;
    pathChanges: number;
    originChanges: number;
  };
  recentEvents: Array<{
    timestamp: string;
    type: "announcement" | "withdrawal";
    sourceId: string | null;
    path: string[];
    pathLabel: string;
    originAsn: string | null;
    communityCount: number;
  }>;
  initialState: Array<{
    scope: "window-start" | "recent-announcements";
    path: string[];
    pathLabel: string;
    originAsn: string | null;
    observations: number;
    sampleSourceId: string | null;
  }>;
  recentPathObservations: Array<{
    scope: "window-start" | "recent-announcements";
    path: string[];
    pathLabel: string;
    originAsn: string | null;
    observations: number;
    sampleSourceId: string | null;
  }>;
  originTransitions: Array<{
    timestamp: string;
    sourceId: string | null;
    from: string;
    to: string;
  }>;
  pathTransitions: Array<{
    timestamp: string;
    sourceId: string | null;
    from: string;
    to: string;
  }>;
  rpkiEvidence: Array<{
    time: string;
    vrpCount: number;
    roaCount: number;
    maxLength: number | null;
  }>;
  findings: Array<{
    status: "pass" | "warn" | "info";
    title: string;
    detail: string;
  }>;
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

export interface PathMtuReport {
  input: string;
  targetIp: string;
  maxPayloadSize: number | null;
  estimatedPathMtu: number | null;
  attempts: Array<{
    payloadSize: number;
    success: boolean;
    error: string | null;
  }>;
  notes: string[];
  checkedAt: number;
  history: ReportHistory;
}

export interface WebsiteSecurityReport {
  input: string;
  hostname: string;
  zoneApex: string;
  finalUrl: string;
  score: number;
  grade: string;
  checks: Array<{
    status: "pass" | "warn" | "fail" | "info";
    title: string;
    detail: string;
  }>;
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
    status: "pass" | "warn" | "fail";
    title: string;
    detail: string;
  }>;
  checkedAt: number;
  history: ReportHistory;
}

export interface PacketCaptureProtocolStat {
  protocol: string;
  packets: number;
  bytes: number;
  share: number;
}

export interface PacketCaptureFlow {
  id: string;
  transport: "tcp" | "udp" | "other";
  source: string;
  destination: string;
  packets: number;
  bytes: number;
  stream: string | null;
  application: string | null;
}

export interface PacketCaptureExpertFinding {
  severity: "error" | "warn" | "info";
  summary: string;
  detail: string;
}

export interface PacketCaptureReport {
  filename: string;
  sizeBytes: number;
  packetCount: number;
  dataSizeBytes: number;
  durationSeconds: number | null;
  captureFileType: string | null;
  encapsulation: string | null;
  protocols: PacketCaptureProtocolStat[];
  flows: PacketCaptureFlow[];
  tcpAnalysis: {
    streamCount: number;
    retransmissions: number;
    duplicateAcks: number;
    zeroWindows: number;
    resets: number;
  };
  dns: {
    queryCount: number;
    queries: Array<{
      name: string;
      type: string;
      responses: number;
      responseCodes: string[];
    }>;
  };
  http: {
    requestCount: number;
    hosts: string[];
    methods: string[];
    statusCodes: number[];
  };
  tls: {
    handshakeCount: number;
    serverNames: string[];
    versions: string[];
    alpns: string[];
  };
  quic: {
    packetCount: number;
    versions: string[];
    connectionIds: number;
  };
  expertFindings: PacketCaptureExpertFinding[];
  notes: string[];
  analyzedAt: number;
}

export interface PacketCaptureCapacityStatus {
  acceptedExtensions: string[];
  maxFileBytes: number;
  available: boolean;
  admissionMode: "strict" | "best-effort";
  reason: string | null;
  advisories: string[];
  retryable: boolean;
  retryAfterSeconds: number | null;
  snapshot: {
    resourceBasis: "cgroup" | "host";
    cpuMetricSource: "cgroup" | "loadavg";
    memoryMetricSource: "cgroup" | "host";
    effectiveCpuLimit: number;
    cpuUtilizationPercent: number;
    loadAverage1m: number;
    memoryUtilizationPercent: number;
    memoryHeadroomMb: number;
    rssMb: number;
    activeAnalyses: number;
    maxConcurrentAnalyses: number;
    activeForRequester: number;
    maxConcurrentPerRequester: number;
  };
  thresholds: {
    maxCpuUtilizationPercent: number;
    minMemoryHeadroomMb: number;
    maxMemoryUtilizationPercent: number;
  };
}

export interface PerformanceLabReport {
  input: string;
  targetIp: string;
  sampleCount: number;
  samples: Array<{
    sequence: number;
    success: boolean;
    latencyMs: number | null;
    error: string | null;
    timestamp: number;
  }>;
  packetLossPercent: number;
  minLatencyMs: number | null;
  avgLatencyMs: number | null;
  maxLatencyMs: number | null;
  jitterMs: number | null;
  pathQuality: "excellent" | "steady" | "degraded" | "poor";
  trace: {
    host: string;
    targetIp: string;
    protocol: "icmp";
    maxHops: number;
    timeoutMs: number;
    hops: Array<{
      hop: number;
      responder: string | null;
      redacted: boolean;
      latencyMs: number | null;
      status: "hop" | "destination" | "timeout";
      reachedTarget: boolean;
    }>;
    completed: boolean;
    timestamp: number;
  };
  pathMtu: {
    maxPayloadSize: number | null;
    estimatedPathMtu: number | null;
  };
  findings: Array<{
    status: "pass" | "warn" | "info";
    title: string;
    detail: string;
  }>;
  checkedAt: number;
  history: ReportHistory;
}

export interface Ipv6TransitionReport {
  domain: string;
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  ipv4: FamilyProbeResult;
  ipv6: FamilyProbeResult;
  nat64: {
    detected: boolean;
    prefix: string | null;
    evidence: string[];
    synthesizedAddresses: string[];
  };
  happyEyeballs: {
    winner: "ipv6" | "ipv4" | "none";
    fallbackDelayMs: number;
    rationale: string;
    steps: Array<{
      order: number;
      family: "ipv6" | "ipv4";
      candidate: string | null;
      startDelayMs: number;
      latencyMs: number | null;
      outcome: "win" | "fallback" | "failed" | "not-tried";
      note: string;
    }>;
  };
  pathMtu: {
    ipv4EstimatedMtu: number | null;
    ipv6EstimatedMtu: number | null;
  };
  findings: Array<{
    status: "pass" | "warn" | "info";
    title: string;
    detail: string;
  }>;
  checkedAt: number;
  history: ReportHistory;
}
