import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHttp3Assessment,
  compareHttpProtocols,
  getHttp3EvidenceSources,
} from "../../../modules/network/http-inspector.domain.js";

describe("http inspector domain", () => {
  it("classifies an advertised and working HTTP/3 edge", () => {
    const evidenceSources = getHttp3EvidenceSources(["h3", "h2"], []);
    const assessment = buildHttp3Assessment({
      protocol: "https:",
      evidenceSources,
      http3: {
        protocol: "http3",
        available: true,
        attempted: true,
        binary: "/opt/netlab-http3/bin/curl",
        succeeded: true,
        statusCode: 200,
        httpVersion: "3",
        remoteIp: "1.1.1.1",
        connectMs: 12,
        tlsHandshakeMs: 28,
        ttfbMs: 55,
        detail: "HTTP/3 transaction succeeded through curl.",
      },
    });

    assert.equal(assessment.verdict, "advertised-working");
    assert.equal(assessment.advertised, true);
  });

  it("classifies advertised but failed HTTP/3 separately from lack of advertisement", () => {
    const assessment = buildHttp3Assessment({
      protocol: "https:",
      evidenceSources: ["HTTPS/SVCB"],
      http3: {
        protocol: "http3",
        available: true,
        attempted: true,
        binary: "/opt/netlab-http3/bin/curl",
        succeeded: false,
        statusCode: null,
        httpVersion: null,
        remoteIp: null,
        connectMs: null,
        tlsHandshakeMs: null,
        ttfbMs: null,
        detail: "curl exited with code 28",
      },
    });

    assert.equal(assessment.verdict, "advertised-failed");
  });

  it("compares HTTP/2 and HTTP/3 timing when both probes complete", () => {
    const comparison = compareHttpProtocols(
      {
        protocol: "http2",
        available: true,
        attempted: true,
        binary: "curl",
        succeeded: true,
        statusCode: 200,
        httpVersion: "2",
        remoteIp: "1.1.1.1",
        connectMs: 15,
        tlsHandshakeMs: 31,
        ttfbMs: 92,
        detail: "HTTP/2 transaction succeeded through curl.",
      },
      {
        protocol: "http3",
        available: true,
        attempted: true,
        binary: "/opt/netlab-http3/bin/curl",
        succeeded: true,
        statusCode: 200,
        httpVersion: "3",
        remoteIp: "1.1.1.1",
        connectMs: 12,
        tlsHandshakeMs: 24,
        ttfbMs: 70,
        detail: "HTTP/3 transaction succeeded through curl.",
      },
    );

    assert.equal(comparison.comparable, true);
    assert.equal(comparison.winner, "http3");
    assert.equal(comparison.ttfbDeltaMs, -22);
  });
});
