import type { DNSQueryResult, QueryStats } from "./model";

export interface DNSPropagationReport {
  domain: string;
  timestamp: string;
  stats: QueryStats;
  results: DNSQueryResult[];
}

export function serializeDnsPropagationReport(
  report: DNSPropagationReport,
): string {
  return JSON.stringify(report, null, 2);
}
