import { buildHappyEyeballsAssessment, buildIpv6TransitionFindings } from "../../domain/ipv6-transition.js";
import { normalizeDomainInput } from "../../domain/inputs.js";
import type { Ipv6TransitionReport } from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";

export async function getIpv6TransitionReport(
  input: string,
  deps: EngineeringDependencies,
): Promise<Ipv6TransitionReport> {
  const domain = normalizeDomainInput(input);
  const [ipv4Addresses, ipv6Addresses, nat64] = await Promise.all([
    deps.nodeDns.resolve4Safe(domain),
    deps.nodeDns.resolve6Safe(domain),
    deps.nat64Probe.detect(),
  ]);

  const [ipv4Probe, ipv6Probe] = await Promise.all([
    deps.tcpFamilyProbe.probeFamily(ipv4Addresses, [443, 80], 4),
    deps.tcpFamilyProbe.probeFamily(ipv6Addresses, [443, 80], 6),
  ]);

  const [ipv4Mtu, ipv6Mtu] = await Promise.all([
    ipv4Addresses[0] ? deps.pathMtuProbe.probe(ipv4Addresses[0], 4) : Promise.resolve(null),
    ipv6Addresses[0] ? deps.pathMtuProbe.probe(ipv6Addresses[0], 6) : Promise.resolve(null),
  ]);

  const synthesizedAddresses = deps.nat64Probe.synthesizeAddresses(nat64.prefix, ipv4Addresses);
  const happyEyeballs = buildHappyEyeballsAssessment({
    ipv4Addresses,
    ipv6Addresses,
    ipv4Probe,
    ipv6Probe,
  });
  const assessment = buildIpv6TransitionFindings({
    ipv4Addresses,
    ipv6Addresses,
    ipv4Probe,
    ipv6Probe,
    nat64Detected: nat64.detected,
    synthesizedAddresses,
    ipv4EstimatedMtu: ipv4Mtu?.estimatedPathMtu ?? null,
    ipv6EstimatedMtu: ipv6Mtu?.estimatedPathMtu ?? null,
  });
  const history = deps.historyStore.remember("ipv6-transition", domain, assessment.historySummary);

  return {
    domain,
    ipv4Addresses,
    ipv6Addresses,
    ipv4: ipv4Probe,
    ipv6: ipv6Probe,
    nat64: {
      detected: nat64.detected,
      prefix: nat64.prefix,
      evidence: nat64.evidence,
      synthesizedAddresses,
    },
    happyEyeballs,
    pathMtu: {
      ipv4EstimatedMtu: ipv4Mtu?.estimatedPathMtu ?? null,
      ipv6EstimatedMtu: ipv6Mtu?.estimatedPathMtu ?? null,
    },
    findings: assessment.findings,
    checkedAt: Date.now(),
    history,
  };
}
