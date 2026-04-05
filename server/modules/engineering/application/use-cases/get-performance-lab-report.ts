import { resolvePublicTarget } from "../../../../src/lib/public-targets.js";
import { buildPerformanceAssessment } from "../../domain/performance.js";
import type { PerformanceLabReport } from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";

export async function getPerformanceLabReport(
  input: string,
  deps: EngineeringDependencies,
): Promise<PerformanceLabReport> {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    throw new Error("A public host or IP is required");
  }

  const target = await resolvePublicTarget(normalizedInput, "Performance target");
  const sampleCount = 6;
  const samples: PerformanceLabReport["samples"] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const results = await deps.ping.executePing({
      host: normalizedInput,
      type: "icmp",
      timeout: 2_000,
      count: 1,
    });
    const result = results[0];
    samples.push({
      sequence: index,
      success: result?.success ?? false,
      latencyMs: result?.latency ?? null,
      error: result?.error ?? null,
      timestamp: result?.timestamp ?? Date.now(),
    });
  }

  const [trace, pathMtu] = await Promise.all([
    deps.trace.trace(normalizedInput, {
      maxHops: 8,
      timeoutMs: 1_500,
    }),
    deps.pathMtuProbe.probe(target.resolvedTarget, 4),
  ]);

  const assessment = buildPerformanceAssessment({
    samples,
    trace,
    estimatedPathMtu: pathMtu.estimatedPathMtu,
  });
  const successfulLatencies = samples
    .filter((sample) => sample.success && typeof sample.latencyMs === "number")
    .map((sample) => sample.latencyMs as number);
  const history = deps.historyStore.remember("performance", normalizedInput, assessment.historySummary);

  return {
    input: normalizedInput,
    targetIp: target.resolvedTarget,
    sampleCount,
    samples,
    packetLossPercent: assessment.packetLossPercent,
    minLatencyMs: successfulLatencies.length > 0 ? Math.min(...successfulLatencies) : null,
    avgLatencyMs: assessment.avgLatencyMs,
    maxLatencyMs: successfulLatencies.length > 0 ? Math.max(...successfulLatencies) : null,
    jitterMs: assessment.jitterMs,
    pathQuality: assessment.pathQuality,
    trace,
    pathMtu: {
      maxPayloadSize: pathMtu.maxPayloadSize,
      estimatedPathMtu: pathMtu.estimatedPathMtu,
    },
    findings: assessment.findings,
    checkedAt: Date.now(),
    history,
  };
}
