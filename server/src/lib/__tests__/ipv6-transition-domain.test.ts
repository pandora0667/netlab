import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHappyEyeballsAssessment,
  buildIpv6TransitionFindings,
} from "../../../modules/engineering/domain/ipv6-transition.js";

describe("ipv6 transition domain", () => {
  it("models IPv4 fallback when IPv6 is published but unreachable", () => {
    const assessment = buildHappyEyeballsAssessment({
      ipv4Addresses: ["93.184.216.34"],
      ipv6Addresses: ["2606:2800:220:1:248:1893:25c8:1946"],
      ipv4Probe: {
        addresses: ["93.184.216.34"],
        reachable: true,
        probePort: 443,
        latencyMs: 25,
        error: null,
      },
      ipv6Probe: {
        addresses: ["2606:2800:220:1:248:1893:25c8:1946"],
        reachable: false,
        probePort: null,
        latencyMs: null,
        error: "Timed out",
      },
    });

    assert.equal(assessment.winner, "ipv4");
    assert.match(assessment.rationale, /falling back|fallback/i);
  });

  it("flags PMTUD masking context when IPv6 MTU is smaller than IPv4", () => {
    const assessment = buildIpv6TransitionFindings({
      ipv4Addresses: ["93.184.216.34"],
      ipv6Addresses: ["2606:2800:220:1:248:1893:25c8:1946"],
      ipv4Probe: {
        addresses: ["93.184.216.34"],
        reachable: true,
        probePort: 443,
        latencyMs: 20,
        error: null,
      },
      ipv6Probe: {
        addresses: ["2606:2800:220:1:248:1893:25c8:1946"],
        reachable: true,
        probePort: 443,
        latencyMs: 35,
        error: null,
      },
      nat64Detected: false,
      synthesizedAddresses: [],
      ipv4EstimatedMtu: 1500,
      ipv6EstimatedMtu: 1280,
    });

    assert.ok(assessment.findings.some((finding) => /MTU/i.test(finding.title)));
  });
});
