import {
  buildDnsAuthorityAssessment,
} from "../../domain/dns-authority.js";
import { normalizeDomainInput } from "../../domain/inputs.js";
import {
  DNS_RECORD_TYPES,
} from "../../infrastructure/dns/dns-adapter.js";
import type { DnsAuthorityReport } from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";

async function findZoneApex(domain: string, notes: string[], deps: EngineeringDependencies) {
  let currentDomain = domain;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const soaResponse = await deps.googleDns.querySafe(currentDomain, "SOA", notes, "SOA");
    const normalizedOwner = deps.googleDns.getSoaOwnerName(soaResponse);

    if (normalizedOwner) {
      return normalizedOwner;
    }

    const nextDomain = currentDomain.split(".").slice(1).join(".");
    if (!nextDomain || nextDomain === currentDomain || !nextDomain.includes(".")) {
      break;
    }

    currentDomain = nextDomain;
  }

  notes.push("Zone apex could not be derived from SOA proof, so the input hostname was used directly.");
  return domain;
}

export async function getDnsAuthorityReport(
  input: string,
  deps: EngineeringDependencies,
): Promise<DnsAuthorityReport> {
  const domain = normalizeDomainInput(input);
  const notes: string[] = [];
  const zoneApex = await findZoneApex(domain, notes, deps);
  const [nameservers, soa, caaRecords, dsResponse, dnskeyResponse] = await Promise.all([
    deps.nodeDns.resolveNsSafe(zoneApex),
    deps.nodeDns.resolveSoaSafe(zoneApex),
    deps.nodeDns.resolveCaaSafe(zoneApex),
    deps.googleDns.querySafe(zoneApex, "DS", notes, "DS"),
    deps.googleDns.querySafe(zoneApex, "DNSKEY", notes, "DNSKEY"),
  ]);

  const dsRecords = deps.googleDns.filterRecordData(dsResponse, DNS_RECORD_TYPES.DS);
  const dnskeyRecords = deps.googleDns.filterRecordData(dnskeyResponse, DNS_RECORD_TYPES.DNSKEY);
  const assessment = buildDnsAuthorityAssessment({
    domain,
    zoneApex,
    nameservers,
    soa,
    caaRecords,
    dsRecords,
    dnskeyRecords,
    dsAuthenticated: Boolean(dsResponse?.AD),
    dnskeyAuthenticated: Boolean(dnskeyResponse?.AD),
  });

  const history = deps.historyStore.remember("authority", domain, assessment.summary);

  return {
    domain,
    zoneApex,
    nameservers,
    soa,
    caaRecords,
    dnssec: {
      enabled: assessment.dnssecEnabled,
      validated: assessment.dnssecValidated,
      dsRecords,
      dnskeyRecords,
    },
    delegationStatus: assessment.delegationStatus,
    findings: assessment.findings,
    checkedAt: Date.now(),
    history,
  };
}

