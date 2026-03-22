import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactTraceHop } from "../../../modules/network/trace.service.js";
import type { TraceHop } from "../../../modules/network/network.types.js";

function createHop(overrides: Partial<TraceHop>): TraceHop {
  return {
    hop: 3,
    responder: "8.8.8.8",
    redacted: false,
    latencyMs: 12.5,
    status: "hop",
    reachedTarget: false,
    ...overrides,
  };
}

describe("trace hop redaction", () => {
  it("redacts the first two hops", () => {
    const redactedHop = redactTraceHop(createHop({
      hop: 1,
      responder: "198.51.100.1",
    }));

    assert.equal(redactedHop.responder, "redacted");
    assert.equal(redactedHop.redacted, true);
  });

  it("redacts non-public responder addresses after the first two hops", () => {
    const redactedHop = redactTraceHop(createHop({
      hop: 4,
      responder: "10.0.0.1",
    }));

    assert.equal(redactedHop.responder, "redacted");
    assert.equal(redactedHop.redacted, true);
  });

  it("preserves public responders after the early-hop boundary", () => {
    const publicHop = redactTraceHop(createHop({
      hop: 5,
      responder: "8.8.8.8",
    }));

    assert.equal(publicHop.responder, "8.8.8.8");
    assert.equal(publicHop.redacted, false);
  });
});
