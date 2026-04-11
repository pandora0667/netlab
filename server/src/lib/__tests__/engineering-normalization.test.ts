import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeDomainInput,
  normalizeUnorderedStrings,
  trimTrailingDots,
} from "../../../modules/engineering/domain/inputs.js";

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

describe("trimTrailingDots", () => {
  it("removes trailing dots without touching the rest of the value", () => {
    assert.equal(trimTrailingDots("example.com..."), "example.com");
    assert.equal(trimTrailingDots("example.com"), "example.com");
    assert.equal(trimTrailingDots("..."), "");
  });
});

describe("normalizeDomainInput", () => {
  it("accepts a trailing root dot and normalizes it away", () => {
    assert.equal(normalizeDomainInput("Example.COM."), "example.com");
  });

  it("rejects labels with invalid boundaries", () => {
    assert.throws(() => normalizeDomainInput("-example.com"));
    assert.throws(() => normalizeDomainInput("example..com"));
    assert.throws(() => normalizeDomainInput("example.c0m"));
  });
});
