export type PingType = "icmp" | "tcp";

export interface PingAttemptResult {
  success: boolean;
  latency?: number | null;
  error?: string;
  attempt: number;
}

export interface PingStatistics {
  sent: number;
  received: number;
  lost: number;
  successRate: number;
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
}

export interface PingSummary {
  host: string;
  type: PingType;
  results: PingAttemptResult[];
  statistics: PingStatistics;
}

export interface PingSocketResultEvent {
  host: string;
  type: PingType;
  result: PingAttemptResult;
  statistics: PingStatistics;
  totalSequences: number;
  elapsedTime: number;
}

export interface PingSocketCompleteEvent {
  host: string;
  type: PingType;
  totalTime: number;
  statistics: PingStatistics;
  cancelled: boolean;
}
