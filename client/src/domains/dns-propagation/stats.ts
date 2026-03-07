import type { DNSQueryResult, QueryStats } from "./model";

const EMPTY_QUERY_STATS: QueryStats = {
  totalQueries: 0,
  successfulQueries: 0,
  failedQueries: 0,
  averageLatency: 0,
  dnssecEnabled: 0,
};

export function createEmptyQueryStats(): QueryStats {
  return { ...EMPTY_QUERY_STATS };
}

export function calculateDnsPropagationStats(
  results: DNSQueryResult[],
): QueryStats {
  if (results.length === 0) {
    return createEmptyQueryStats();
  }

  const successfulQueries = results.filter(
    (result) => result.status === "success",
  ).length;
  const totalLatency = results.reduce(
    (sum, result) => sum + result.latency,
    0,
  );
  const dnssecEnabled = results.filter(
    (result) => result.server.dnssec,
  ).length;

  return {
    totalQueries: results.length,
    successfulQueries,
    failedQueries: results.length - successfulQueries,
    averageLatency: Math.round(totalLatency / results.length),
    dnssecEnabled,
  };
}
