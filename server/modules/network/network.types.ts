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
