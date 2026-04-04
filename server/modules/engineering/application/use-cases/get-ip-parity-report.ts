import { buildIpParityAssessment } from "../../domain/ip-parity.js";
import { normalizeDomainInput } from "../../domain/inputs.js";
import type { IpParityReport } from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";

export async function getIpParityReport(
  input: string,
  deps: EngineeringDependencies,
): Promise<IpParityReport> {
  const domain = normalizeDomainInput(input);
  const [ipv4Addresses, ipv6Addresses] = await Promise.all([
    deps.nodeDns.resolve4Safe(domain),
    deps.nodeDns.resolve6Safe(domain),
  ]);

  const [ipv4Probe, ipv6Probe] = await Promise.all([
    deps.tcpFamilyProbe.probeFamily(ipv4Addresses, [443, 80], 4),
    deps.tcpFamilyProbe.probeFamily(ipv6Addresses, [443, 80], 6),
  ]);

  const assessment = buildIpParityAssessment({
    ipv4Addresses,
    ipv6Addresses,
    ipv4Probe,
    ipv6Probe,
  });
  const history = deps.historyStore.remember("parity", domain, assessment.summary);

  return {
    domain,
    ipv4: ipv4Probe,
    ipv6: ipv6Probe,
    status: assessment.status,
    findings: assessment.findings,
    checkedAt: Date.now(),
    history,
  };
}

