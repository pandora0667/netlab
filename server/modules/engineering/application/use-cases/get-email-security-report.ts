import { COMMON_DKIM_SELECTORS } from "../../domain/constants.js";
import { buildEmailSecurityAssessment } from "../../domain/email-security.js";
import { normalizeDomainInput } from "../../domain/inputs.js";
import type { EmailSecurityReport } from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";

export async function getEmailSecurityReport(
  input: string,
  deps: EngineeringDependencies,
): Promise<EmailSecurityReport> {
  const domain = normalizeDomainInput(input);
  const [mxRecords, domainTxt, dmarcTxt, mtaStsTxt, tlsRptTxt] = await Promise.all([
    deps.nodeDns.resolveMxSafe(domain),
    deps.nodeDns.resolveTxtSafe(domain),
    deps.nodeDns.resolveTxtSafe(`_dmarc.${domain}`),
    deps.nodeDns.resolveTxtSafe(`_mta-sts.${domain}`),
    deps.nodeDns.resolveTxtSafe(`_smtp._tls.${domain}`),
  ]);

  const spfRecord = domainTxt.find((record) => /^v=spf1\b/i.test(record)) || null;
  const dmarcRecord = dmarcTxt.find((record) => /^v=DMARC1\b/i.test(record)) || null;
  const dmarcPolicy = dmarcRecord?.match(/(?:^|;\s*)p=([^;]+)/i)?.[1] ?? null;
  const mtaStsRecord = mtaStsTxt.find((record) => /^v=STSv1\b/i.test(record)) || null;
  const tlsRptRecord = tlsRptTxt.find((record) => /^v=TLSRPTv1\b/i.test(record)) || null;

  const dkimResults = await Promise.all(
    COMMON_DKIM_SELECTORS.map(async (selector) => {
      const records = await deps.nodeDns.resolveTxtSafe(`${selector}._domainkey.${domain}`);
      return records.some((record) => /v=DKIM1|k=rsa|k=ed25519/i.test(record))
        ? selector
        : null;
    }),
  );
  const foundSelectors = dkimResults.filter(
    (selector): selector is (typeof COMMON_DKIM_SELECTORS)[number] => selector !== null,
  );

  const startTls = await Promise.all(
    mxRecords.slice(0, 3).map((mxRecord) => deps.startTlsProbe.probe(mxRecord.exchange)),
  );
  const mtaStsPolicyFound = mtaStsRecord
    ? await deps.mtaStsPolicyProbe.probe(domain)
    : false;
  const assessment = buildEmailSecurityAssessment({
    mxRecords,
    spfRecord,
    dmarcRecord,
    dmarcPolicy,
    foundSelectors,
    startTls,
    mtaStsRecord,
    mtaStsPolicyFound,
    tlsRptRecord,
  });
  const history = deps.historyStore.remember("email", domain, assessment.summary);

  return {
    domain,
    score: assessment.score,
    grade: assessment.grade,
    mxRecords,
    spf: {
      present: Boolean(spfRecord),
      record: spfRecord,
    },
    dmarc: {
      present: Boolean(dmarcRecord),
      record: dmarcRecord,
      policy: dmarcPolicy,
    },
    dkim: {
      foundSelectors,
      checkedSelectors: [...COMMON_DKIM_SELECTORS],
    },
    startTls,
    mtaSts: {
      dnsRecord: mtaStsRecord,
      policyFound: mtaStsPolicyFound,
    },
    tlsRpt: {
      present: Boolean(tlsRptRecord),
      record: tlsRptRecord,
    },
    checks: assessment.checks,
    checkedAt: Date.now(),
    history,
  };
}

