import { normalizeUrlInput } from "../../domain/inputs.js";
import { buildWebsiteSecurityAssessment } from "../../domain/website-security.js";
import type { WebsiteSecurityReport } from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";
import { getDnsAuthorityReport } from "./get-dns-authority-report.js";

export async function getWebsiteSecurityReport(
  input: string,
  deps: EngineeringDependencies,
): Promise<WebsiteSecurityReport> {
  const url = normalizeUrlInput(input);
  const hostname = url.hostname.toLowerCase();
  const [httpInspection, authority, securityTxt] = await Promise.all([
    deps.httpInspection.inspect(input),
    getDnsAuthorityReport(hostname, deps),
    deps.securityTxtProbe.probe(hostname),
  ]);

  const assessment = buildWebsiteSecurityAssessment({
    hostname,
    httpInspection,
    authority,
    securityTxt,
  });
  const history = deps.historyStore.remember("website", hostname, assessment.summary);

  return {
    input,
    hostname,
    zoneApex: authority.zoneApex,
    finalUrl: httpInspection.finalUrl,
    score: assessment.score,
    grade: assessment.grade,
    checks: assessment.checks,
    keyHeaders: assessment.keyHeaders,
    dnssecEnabled: assessment.dnssecEnabled,
    caaPresent: assessment.caaPresent,
    securityTxt,
    tlsVersion: assessment.tlsVersion,
    certificateExpiresInDays: assessment.certificateExpiresInDays,
    checkedAt: Date.now(),
    history,
  };
}

