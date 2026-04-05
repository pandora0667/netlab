import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPerformanceAssessment, calculateJitter } from "../../../modules/engineering/domain/performance.js";

describe("performance domain", () => {
  it("calculates jitter from adjacent latency deltas", () => {
    const jitter = calculateJitter([
      { sequence: 0, success: true, latencyMs: 20, error: null, timestamp: 1 },
      { sequence: 1, success: true, latencyMs: 30, error: null, timestamp: 2 },
      { sequence: 2, success: true, latencyMs: 18, error: null, timestamp: 3 },
    ]);

    assert.equal(jitter, 11);
  });

  it("grades a lossy path as degraded or worse", () => {
    const assessment = buildPerformanceAssessment({
      samples: [
        { sequence: 0, success: true, latencyMs: 21, error: null, timestamp: 1 },
        { sequence: 1, success: false, latencyMs: null, error: "timeout", timestamp: 2 },
        { sequence: 2, success: true, latencyMs: 48, error: null, timestamp: 3 },
        { sequence: 3, success: false, latencyMs: null, error: "timeout", timestamp: 4 },
      ],
      trace: {
        host: "example.com",
        targetIp: "93.184.216.34",
        protocol: "icmp",
        maxHops: 8,
        timeoutMs: 1500,
        hops: [
          { hop: 1, responder: "redacted", redacted: true, latencyMs: 2, status: "hop", reachedTarget: false },
          { hop: 2, responder: null, redacted: false, latencyMs: null, status: "timeout", reachedTarget: false },
          { hop: 3, responder: null, redacted: false, latencyMs: null, status: "timeout", reachedTarget: false },
        ],
        completed: false,
        timestamp: Date.now(),
      },
      estimatedPathMtu: null,
    });

    assert.ok(["degraded", "poor"].includes(assessment.pathQuality));
    assert.ok(assessment.findings.length > 0);
  });
});
