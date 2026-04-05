import type {
  FamilyProbeResult,
  Ipv6TransitionReport,
} from "../engineering.types.js";

interface HappyEyeballsAssessmentInput {
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  ipv4Probe: FamilyProbeResult;
  ipv6Probe: FamilyProbeResult;
}

export function buildHappyEyeballsAssessment({
  ipv4Addresses,
  ipv6Addresses,
  ipv4Probe,
  ipv6Probe,
}: HappyEyeballsAssessmentInput) {
  const fallbackDelayMs = 250;
  const steps: Ipv6TransitionReport["happyEyeballs"]["steps"] = [];
  let winner: Ipv6TransitionReport["happyEyeballs"]["winner"] = "none";
  let rationale = "Neither family produced a clear connection win from this vantage point.";

  steps.push({
    order: 1,
    family: "ipv6",
    candidate: ipv6Addresses[0] ?? null,
    startDelayMs: 0,
    latencyMs: ipv6Probe.latencyMs,
    outcome: ipv6Probe.reachable ? "not-tried" : "failed",
    note: ipv6Addresses.length > 0
      ? "IPv6 gets the first attempt when AAAA records are present."
      : "No native AAAA record was available to start an IPv6 attempt.",
  });

  steps.push({
    order: 2,
    family: "ipv4",
    candidate: ipv4Addresses[0] ?? null,
    startDelayMs: fallbackDelayMs,
    latencyMs: ipv4Probe.latencyMs,
    outcome: ipv4Probe.reachable ? "not-tried" : "failed",
    note: ipv4Addresses.length > 0
      ? "IPv4 acts as the fallback candidate after a short timer."
      : "No A record was available for fallback.",
  });

  if (ipv6Probe.reachable && ipv4Probe.reachable) {
    if (ipv6Probe.latencyMs != null && ipv4Probe.latencyMs != null) {
      const ipv6Wins = ipv6Probe.latencyMs <= ipv4Probe.latencyMs + fallbackDelayMs;
      winner = ipv6Wins ? "ipv6" : "ipv4";
      rationale = ipv6Wins
        ? "IPv6 completed quickly enough that the IPv4 fallback would not need to win the race."
        : "IPv4 would likely win because the IPv6 path is slower than the Happy Eyeballs fallback window.";
      steps[0].outcome = ipv6Wins ? "win" : "fallback";
      steps[1].outcome = ipv6Wins ? "fallback" : "win";
    } else {
      winner = "ipv6";
      rationale = "Both families were reachable, and the model keeps IPv6 as the preferred first-success path.";
      steps[0].outcome = "win";
      steps[1].outcome = "fallback";
    }
  } else if (ipv6Probe.reachable) {
    winner = "ipv6";
    rationale = "Only IPv6 accepted the probe, so dual-stack fallback would not be needed.";
    steps[0].outcome = "win";
    steps[1].outcome = "failed";
  } else if (ipv4Probe.reachable) {
    winner = "ipv4";
    rationale = "IPv6 failed or was absent, so Happy Eyeballs would hide the issue by falling back to IPv4.";
    steps[0].outcome = ipv6Addresses.length > 0 ? "failed" : "not-tried";
    steps[1].outcome = "win";
  }

  return {
    winner,
    fallbackDelayMs,
    rationale,
    steps,
  };
}

export function buildIpv6TransitionFindings(input: {
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  ipv4Probe: FamilyProbeResult;
  ipv6Probe: FamilyProbeResult;
  nat64Detected: boolean;
  synthesizedAddresses: string[];
  ipv4EstimatedMtu: number | null;
  ipv6EstimatedMtu: number | null;
}) {
  const findings: Ipv6TransitionReport["findings"] = [];

  if (input.ipv4Probe.reachable && input.ipv6Probe.reachable) {
    findings.push({
      status: "pass",
      title: "Both families accepted the probe from this vantage point.",
      detail: "That is the baseline for a healthy dual-stack public edge.",
    });
  }

  if (input.ipv4Addresses.length > 0 && input.ipv6Addresses.length === 0) {
    findings.push({
      status: "warn",
      title: "The host publishes only IPv4 records.",
      detail: "Happy Eyeballs has nothing to race, so IPv6 clients cannot use the same entrypoint at all.",
    });
  }

  if (input.ipv6Addresses.length > 0 && !input.ipv6Probe.reachable && input.ipv4Probe.reachable) {
    findings.push({
      status: "warn",
      title: "IPv6 is published, but IPv4 fallback is likely masking the failure.",
      detail: "Browsers would probably recover on IPv4 while pure IPv6 clients still fail, which makes this a classic dual-stack drift pattern.",
    });
  }

  if (input.nat64Detected) {
    findings.push({
      status: "info",
      title: "The resolver path looks DNS64/NAT64-capable.",
      detail: input.synthesizedAddresses.length > 0
        ? "The resolver can synthesize IPv6 answers for IPv4-only targets, which changes how fallback and reachability should be interpreted."
        : "Resolver evidence suggests DNS64/NAT64 behavior may be present on this path.",
    });
  }

  if (
    input.ipv4EstimatedMtu != null
    && input.ipv6EstimatedMtu != null
    && input.ipv6EstimatedMtu < input.ipv4EstimatedMtu
  ) {
    findings.push({
      status: "info",
      title: "IPv6 path MTU looks smaller than IPv4.",
      detail: "That can be harmless, but it is also one of the patterns that gets masked when clients fall back before operators inspect the IPv6 path directly.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      status: "info",
      title: "The transition surface looks uneventful in this sample.",
      detail: "No strong NAT64, fallback, or PMTUD masking pattern was visible from the current vantage point.",
    });
  }

  return {
    findings,
    historySummary: {
      "IPv4 reachable": input.ipv4Probe.reachable,
      "IPv6 reachable": input.ipv6Probe.reachable,
      DNS64: input.nat64Detected,
      "IPv4 MTU": input.ipv4EstimatedMtu ?? "n/a",
      "IPv6 MTU": input.ipv6EstimatedMtu ?? "n/a",
    },
  };
}
