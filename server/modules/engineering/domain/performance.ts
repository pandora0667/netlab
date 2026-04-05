import type { PerformanceLabReport, PerformanceSample } from "../engineering.types.js";
import type { TraceSummary } from "../../network/network.types.js";

function mean(values: number[]) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

export function calculateJitter(samples: PerformanceSample[]) {
  const latencies = samples
    .filter((sample) => sample.success && typeof sample.latencyMs === "number")
    .map((sample) => sample.latencyMs as number);

  if (latencies.length < 2) {
    return null;
  }

  const deltas = latencies.slice(1).map((latency, index) => Math.abs(latency - latencies[index]));
  return mean(deltas);
}

export function buildPerformanceAssessment(input: {
  samples: PerformanceSample[];
  trace: TraceSummary;
  estimatedPathMtu: number | null;
}) {
  const successfulLatencies = input.samples
    .filter((sample) => sample.success && typeof sample.latencyMs === "number")
    .map((sample) => sample.latencyMs as number);
  const packetLossPercent = input.samples.length > 0
    ? ((input.samples.length - successfulLatencies.length) / input.samples.length) * 100
    : 0;
  const avgLatencyMs = mean(successfulLatencies);
  const jitterMs = calculateJitter(input.samples);
  const timeoutHops = input.trace.hops.filter((hop) => hop.status === "timeout").length;
  let pathQuality: PerformanceLabReport["pathQuality"] = "excellent";

  if (packetLossPercent >= 25 || timeoutHops >= 3) {
    pathQuality = "poor";
  } else if (packetLossPercent >= 10 || (jitterMs != null && jitterMs >= 25)) {
    pathQuality = "degraded";
  } else if ((avgLatencyMs != null && avgLatencyMs >= 120) || (jitterMs != null && jitterMs >= 12)) {
    pathQuality = "steady";
  }

  const findings: PerformanceLabReport["findings"] = [];

  if (packetLossPercent === 0 && jitterMs != null && jitterMs < 8 && timeoutHops === 0) {
    findings.push({
      status: "pass",
      title: "The path looked steady during the sampled run.",
      detail: "There was no measured packet loss, jitter stayed low, and the bounded trace completed without repeated hop timeouts.",
    });
  }

  if (packetLossPercent >= 10) {
    findings.push({
      status: "warn",
      title: "Packet loss is high enough to affect user-visible quality.",
      detail: `The sample window lost ${packetLossPercent.toFixed(1)}% of probes, which is consistent with degraded interactive traffic and retransmission pressure.`,
    });
  }

  if (jitterMs != null && jitterMs >= 15) {
    findings.push({
      status: "warn",
      title: "Jitter is elevated.",
      detail: `Average latency swing between adjacent probes was ${jitterMs.toFixed(1)}ms, which often feels worse than raw average latency alone.`,
    });
  }

  if (timeoutHops >= 2) {
    findings.push({
      status: "info",
      title: "The bounded trace included repeated hop timeouts.",
      detail: "That can indicate filtering, ICMP de-prioritization, or real path instability. Compare it with HTTP/TLS behavior before assuming packet loss at the app layer.",
    });
  }

  if (input.estimatedPathMtu == null) {
    findings.push({
      status: "info",
      title: "Path MTU was not confirmed in the sampled range.",
      detail: "That does not prove a PMTUD issue, but it removes one easy explanation when sessions stall only after the handshake.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      status: "info",
      title: "The path needs more sampling before drawing a strong conclusion.",
      detail: "The sampled run did not surface a severe quality issue, but short windows can miss intermittent congestion or policy changes.",
    });
  }

  return {
    packetLossPercent,
    avgLatencyMs,
    jitterMs,
    pathQuality,
    findings,
    historySummary: {
      "Packet loss %": packetLossPercent.toFixed(1),
      "Average latency": avgLatencyMs?.toFixed(1) ?? "n/a",
      Jitter: jitterMs?.toFixed(1) ?? "n/a",
      Quality: pathQuality,
    },
  };
}
