import { getDefaultPacketCaptureConcurrency } from "./system-resources.js";

function readIntegerEnv(name: string, fallback: number, minimum = 1): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < minimum) {
    return fallback;
  }

  return parsedValue;
}

function readStringEnv(name: string, fallback = ""): string {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  return rawValue.trim() || fallback;
}

function readTrustProxyEnv(
  name: string,
  fallback: boolean | number | string | string[],
) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const normalizedValue = rawValue.trim();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  if (/^\d+$/.test(normalizedValue)) {
    return Number.parseInt(normalizedValue, 10);
  }

  if (normalizedValue.includes(",")) {
    return normalizedValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return normalizedValue;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const DEFAULT_PACKET_CAPTURE_MAX_CONCURRENT_GLOBAL = getDefaultPacketCaptureConcurrency();

export const runtimeConfig = {
  server: {
    port: readIntegerEnv("PORT", 8080, 1),
    trustProxy: readTrustProxyEnv("TRUST_PROXY", 1),
  },
  seo: {
    indexNowKey: process.env.INDEXNOW_KEY?.trim() || "",
    siteUrl: process.env.VITE_SITE_URL?.trim() || "https://netlab.tools",
  },
  build: {
    sha: readStringEnv("APP_BUILD_SHA", "dev"),
    ref: readStringEnv("APP_BUILD_REF", "local"),
    builtAt: readStringEnv("APP_BUILD_TIME", ""),
  },
  rateLimits: {
    api: {
      windowMs: readIntegerEnv("API_RATE_LIMIT_WINDOW_MS", FIFTEEN_MINUTES, 1000),
      max: readIntegerEnv("API_RATE_LIMIT_MAX", 300, 1),
    },
    ping: {
      windowMs: readIntegerEnv("PING_RATE_LIMIT_WINDOW_MS", FIFTEEN_MINUTES, 1000),
      max: readIntegerEnv("PING_RATE_LIMIT_MAX", 90, 1),
    },
    dns: {
      windowMs: readIntegerEnv("DNS_RATE_LIMIT_WINDOW_MS", FIFTEEN_MINUTES, 1000),
      max: readIntegerEnv("DNS_RATE_LIMIT_MAX", 60, 1),
    },
    dnsPropagation: {
      windowMs: readIntegerEnv("DNS_PROPAGATION_RATE_LIMIT_WINDOW_MS", FIFTEEN_MINUTES, 1000),
      max: readIntegerEnv("DNS_PROPAGATION_RATE_LIMIT_MAX", 30, 1),
    },
    portScan: {
      windowMs: readIntegerEnv("PORT_SCAN_RATE_LIMIT_WINDOW_MS", FIFTEEN_MINUTES, 1000),
      max: readIntegerEnv("PORT_SCAN_RATE_LIMIT_MAX", 20, 1),
    },
  },
  limits: {
    portScanMaxPorts: readIntegerEnv("PORT_SCAN_MAX_PORTS", 256, 1),
    portScanMaxTimeoutMs: readIntegerEnv("PORT_SCAN_MAX_TIMEOUT_MS", 2000, 100),
    portScanMaxConcurrentGlobal: readIntegerEnv("PORT_SCAN_MAX_CONCURRENT_GLOBAL", 4, 1),
    portScanMaxConcurrentPerIp: readIntegerEnv("PORT_SCAN_MAX_CONCURRENT_PER_IP", 1, 1),
    dnsLookupMaxConcurrentGlobal: readIntegerEnv("DNS_LOOKUP_MAX_CONCURRENT_GLOBAL", 20, 1),
    dnsLookupMaxConcurrentPerIp: readIntegerEnv("DNS_LOOKUP_MAX_CONCURRENT_PER_IP", 3, 1),
    dnsPropagationMaxConcurrentGlobal: readIntegerEnv("DNS_PROPAGATION_MAX_CONCURRENT_GLOBAL", 8, 1),
    dnsPropagationMaxConcurrentPerIp: readIntegerEnv("DNS_PROPAGATION_MAX_CONCURRENT_PER_IP", 2, 1),
    dnsPropagationQueryConcurrency: readIntegerEnv("DNS_PROPAGATION_QUERY_CONCURRENCY", 10, 1),
    dnsPropagationQueryTimeoutMs: readIntegerEnv("DNS_PROPAGATION_QUERY_TIMEOUT_MS", 4000, 1000),
    pingMaxConcurrentGlobal: readIntegerEnv("PING_MAX_CONCURRENT_GLOBAL", 20, 1),
    pingMaxConcurrentPerIp: readIntegerEnv("PING_MAX_CONCURRENT_PER_IP", 2, 1),
    traceMaxConcurrentGlobal: readIntegerEnv("TRACE_MAX_CONCURRENT_GLOBAL", 12, 1),
    traceMaxConcurrentPerIp: readIntegerEnv("TRACE_MAX_CONCURRENT_PER_IP", 2, 1),
    httpInspectionMaxConcurrentGlobal: readIntegerEnv("HTTP_INSPECTION_MAX_CONCURRENT_GLOBAL", 16, 1),
    httpInspectionMaxConcurrentPerIp: readIntegerEnv("HTTP_INSPECTION_MAX_CONCURRENT_PER_IP", 3, 1),
    whoisMaxConcurrentGlobal: readIntegerEnv("WHOIS_MAX_CONCURRENT_GLOBAL", 12, 1),
    whoisMaxConcurrentPerIp: readIntegerEnv("WHOIS_MAX_CONCURRENT_PER_IP", 2, 1),
    packetCaptureMaxConcurrentGlobal: readIntegerEnv("PACKET_CAPTURE_MAX_CONCURRENT_GLOBAL", DEFAULT_PACKET_CAPTURE_MAX_CONCURRENT_GLOBAL, 1),
    packetCaptureMaxConcurrentPerIp: readIntegerEnv("PACKET_CAPTURE_MAX_CONCURRENT_PER_IP", 1, 1),
    packetCaptureMaxLoadPerCpuPercent: readIntegerEnv("PACKET_CAPTURE_MAX_LOAD_PER_CPU_PERCENT", 90, 1),
    packetCaptureMinFreeSystemMemoryMb: readIntegerEnv("PACKET_CAPTURE_MIN_FREE_SYSTEM_MEMORY_MB", 384, 64),
    packetCaptureMaxSystemMemoryUtilizationPercent: readIntegerEnv("PACKET_CAPTURE_MAX_SYSTEM_MEMORY_UTILIZATION_PERCENT", 92, 1),
  },
} as const;
