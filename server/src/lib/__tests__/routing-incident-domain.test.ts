import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRoutingIncidentAssessment } from "../../../modules/engineering/domain/routing-incidents.js";

describe("routing incident domain", () => {
  it("detects origin and path drift from peer-scoped updates", () => {
    const assessment = buildRoutingIncidentAssessment({
      updates: [
        {
          timestamp: "2026-04-04T00:00:00Z",
          type: "announcement",
          sourceId: "rrc00-peer-a",
          path: ["64500", "15169"],
          pathLabel: "AS64500 -> AS15169",
          originAsn: "15169",
          communityCount: 2,
        },
        {
          timestamp: "2026-04-04T00:05:00Z",
          type: "announcement",
          sourceId: "rrc00-peer-a",
          path: ["64501", "15169"],
          pathLabel: "AS64501 -> AS15169",
          originAsn: "15169",
          communityCount: 1,
        },
        {
          timestamp: "2026-04-04T00:10:00Z",
          type: "announcement",
          sourceId: "rrc00-peer-a",
          path: ["64501", "64555"],
          pathLabel: "AS64501 -> AS64555",
          originAsn: "64555",
          communityCount: 1,
        },
        {
          timestamp: "2026-04-04T00:12:00Z",
          type: "withdrawal",
          sourceId: "rrc00-peer-b",
          path: [],
          pathLabel: "Withdrawn",
          originAsn: null,
          communityCount: 0,
        },
      ],
      initialState: [
        {
          sourceId: "rrc00-peer-a",
          path: ["64500", "15169"],
          pathLabel: "AS64500 -> AS15169",
          originAsn: "15169",
        },
        {
          sourceId: "rrc00-peer-b",
          path: ["64510", "15169"],
          pathLabel: "AS64510 -> AS15169",
          originAsn: "15169",
        },
      ],
      rpkiEvidence: [
        {
          time: "2026-04-03T00:00:00Z",
          vrpCount: 1,
          roaCount: 1,
          maxLength: 24,
        },
        {
          time: "2026-04-04T00:00:00Z",
          vrpCount: 0,
          roaCount: 0,
          maxLength: 24,
        },
      ],
      rpkiStatus: "invalid",
    });

    assert.equal(assessment.summary.withdrawals, 1);
    assert.equal(assessment.summary.originChanges, 1);
    assert.equal(assessment.summary.pathChanges, 2);
    assert.ok(assessment.findings.some((finding) => /validate|invalid/i.test(finding.detail)));
    assert.ok(assessment.originTransitions.some((transition) => transition.to === "AS64555"));
  });
});
