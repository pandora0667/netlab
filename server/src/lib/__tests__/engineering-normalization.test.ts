import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeUnorderedStrings } from "../../../modules/engineering/engineering.service.js";

describe("normalizeUnorderedStrings", () => {
  it("returns a stable sorted copy for unordered string sets", () => {
    const original = ["ns3.google.com", "ns1.google.com", "ns2.google.com"];

    const normalized = normalizeUnorderedStrings(original);

    assert.deepEqual(normalized, [
      "ns1.google.com",
      "ns2.google.com",
      "ns3.google.com",
    ]);
    assert.deepEqual(original, [
      "ns3.google.com",
      "ns1.google.com",
      "ns2.google.com",
    ]);
  });
});
