import type {
  Http3AssessmentResult,
  HttpProtocolComparison,
  HttpProtocolProbeResult,
  HttpServiceBindingRecord,
} from "./network.types.js";

function roundDeltaMs(value: number) {
  return Math.round(value * 10) / 10;
}

export function getHttp3EvidenceSources(
  altSvcProtocols: string[],
  serviceBindings: HttpServiceBindingRecord[],
) {
  const sources: string[] = [];

  if (altSvcProtocols.some((protocol) => protocol.startsWith("h3"))) {
    sources.push("Alt-Svc");
  }

  if (
    serviceBindings.some((record) =>
      record.alpns.some((alpn) => alpn.startsWith("h3")),
    )
  ) {
    sources.push("HTTPS/SVCB");
  }

  return sources;
}

export function buildHttp3Assessment(params: {
  protocol: string | null;
  evidenceSources: string[];
  http3: HttpProtocolProbeResult;
}) : Http3AssessmentResult {
  const { protocol, evidenceSources, http3 } = params;
  const advertised = evidenceSources.length > 0;

  if (protocol !== "https:") {
    return {
      advertised,
      evidenceSources,
      verdict: "not-applicable",
      summary: "HTTP/3 inspection only applies after the final URL resolves to HTTPS.",
      nextStep: "Treat plain HTTP as the primary issue before reasoning about QUIC or HTTP/3.",
    };
  }

  if (!advertised) {
    return {
      advertised: false,
      evidenceSources,
      verdict: "not-advertised",
      summary: "The edge did not advertise HTTP/3 through Alt-Svc or HTTPS/SVCB evidence.",
      nextStep: "Treat HTTP/2 as the expected transport unless you know the edge should be announcing h3.",
    };
  }

  if (!http3.available) {
    return {
      advertised: true,
      evidenceSources,
      verdict: "binary-unavailable",
      summary: "The edge advertises HTTP/3, but this Netlab runtime cannot validate it with an HTTP/3-capable curl binary.",
      nextStep: "Run the inspector from the runtime base that includes the HTTP/3 curl toolchain before calling the edge healthy or broken.",
    };
  }

  if (http3.succeeded) {
    return {
      advertised: true,
      evidenceSources,
      verdict: "advertised-working",
      summary: "The edge advertises HTTP/3 and the real QUIC transaction completed successfully.",
      nextStep: "Compare HTTP/2 and HTTP/3 timings to see whether the h3 path is merely available or materially better.",
    };
  }

  return {
    advertised: true,
    evidenceSources,
    verdict: "advertised-failed",
    summary: "The edge advertises HTTP/3, but the real QUIC transaction did not complete cleanly.",
    nextStep: "Check UDP/443 reachability, QUIC listener health, Alt-Svc target consistency, and load balancer policy before trusting fallback behavior.",
  };
}

export function compareHttpProtocols(
  http2Probe: HttpProtocolProbeResult | null,
  http3Probe: HttpProtocolProbeResult,
): HttpProtocolComparison {
  if (
    !http2Probe ||
    !http2Probe.succeeded ||
    !http3Probe.succeeded ||
    http2Probe.ttfbMs == null ||
    http3Probe.ttfbMs == null
  ) {
    return {
      comparable: false,
      winner: null,
      ttfbDeltaMs: null,
      connectDeltaMs: null,
      summary: "HTTP/2 and HTTP/3 are not both complete enough to compare first-byte timing yet.",
    };
  }

  const ttfbDeltaMs = roundDeltaMs(http3Probe.ttfbMs - http2Probe.ttfbMs);
  const connectDeltaMs = http2Probe.connectMs != null && http3Probe.connectMs != null
    ? roundDeltaMs(http3Probe.connectMs - http2Probe.connectMs)
    : null;

  if (Math.abs(ttfbDeltaMs) < 15) {
    return {
      comparable: true,
      winner: "tie",
      ttfbDeltaMs,
      connectDeltaMs,
      summary: "HTTP/2 and HTTP/3 landed in roughly the same first-byte range for this target.",
    };
  }

  if (ttfbDeltaMs < 0) {
    return {
      comparable: true,
      winner: "http3",
      ttfbDeltaMs,
      connectDeltaMs,
      summary: `HTTP/3 reached first byte about ${Math.abs(ttfbDeltaMs)} ms sooner than HTTP/2 for this final URL.`,
    };
  }

  return {
    comparable: true,
    winner: "http2",
    ttfbDeltaMs,
    connectDeltaMs,
    summary: `HTTP/2 reached first byte about ${ttfbDeltaMs} ms sooner than HTTP/3 for this final URL.`,
  };
}
