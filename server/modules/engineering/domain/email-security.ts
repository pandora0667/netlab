import { gradeFromScore } from "./grading.js";
import type { EmailSecurityReport } from "../engineering.types.js";

interface EmailSecurityAssessmentInput {
  mxRecords: EmailSecurityReport["mxRecords"];
  spfRecord: string | null;
  dmarcRecord: string | null;
  dmarcPolicy: string | null;
  foundSelectors: string[];
  startTls: EmailSecurityReport["startTls"];
  mtaStsRecord: string | null;
  mtaStsPolicyFound: boolean;
  tlsRptRecord: string | null;
}

export function buildEmailSecurityAssessment({
  mxRecords,
  spfRecord,
  dmarcRecord,
  dmarcPolicy,
  foundSelectors,
  startTls,
  mtaStsRecord,
  mtaStsPolicyFound,
  tlsRptRecord,
}: EmailSecurityAssessmentInput) {
  const checks: EmailSecurityReport["checks"] = [];
  let score = 0;

  if (mxRecords.length > 0) {
    score += 20;
    checks.push({
      status: "pass",
      title: "MX records are published.",
      detail: `${mxRecords.length} MX endpoints were returned for the domain.`,
    });
  } else {
    checks.push({
      status: "fail",
      title: "MX records are missing.",
      detail: "The domain does not advertise mail exchangers in DNS.",
    });
  }

  if (spfRecord) {
    score += 15;
    checks.push({
      status: "pass",
      title: "SPF is published.",
      detail: "A TXT record starting with v=spf1 was found on the domain apex.",
    });
  } else {
    checks.push({
      status: "warn",
      title: "SPF is missing.",
      detail: "No SPF policy was found on the domain apex.",
    });
  }

  if (dmarcRecord) {
    score += dmarcPolicy && dmarcPolicy !== "none" ? 20 : 12;
    checks.push({
      status: dmarcPolicy && dmarcPolicy !== "none" ? "pass" : "warn",
      title: "DMARC is published.",
      detail: dmarcPolicy
        ? `The domain publishes DMARC with policy ${dmarcPolicy}.`
        : "A DMARC record is present, but the policy could not be parsed.",
    });
  } else {
    checks.push({
      status: "warn",
      title: "DMARC is missing.",
      detail: "No _dmarc TXT record was found.",
    });
  }

  if (foundSelectors.length > 0) {
    score += 10;
    checks.push({
      status: "pass",
      title: "A common DKIM selector responded.",
      detail: `Selector probe found ${foundSelectors.join(", ")}. This is heuristic, not full selector discovery.`,
    });
  } else {
    checks.push({
      status: "warn",
      title: "No common DKIM selectors responded.",
      detail: "DKIM may still exist under non-standard selectors, but the common selector probe found nothing.",
    });
  }

  const startTlsSupportedCount = startTls.filter((result) => result.supportsStartTls).length;

  if (startTlsSupportedCount > 0) {
    score += 15;
    checks.push({
      status: "pass",
      title: "At least one MX host supports STARTTLS.",
      detail: `${startTlsSupportedCount} of ${startTls.length} checked MX endpoints advertised STARTTLS.`,
    });
  } else if (startTls.length > 0) {
    checks.push({
      status: "warn",
      title: "Checked MX hosts did not advertise STARTTLS.",
      detail: "Mail transport encryption appears absent from the probed MX endpoints.",
    });
  }

  if (mtaStsRecord) {
    score += mtaStsPolicyFound ? 10 : 5;
    checks.push({
      status: mtaStsPolicyFound ? "pass" : "warn",
      title: "MTA-STS is published.",
      detail: mtaStsPolicyFound
        ? "The DNS record and policy file were both reachable."
        : "The DNS record exists, but the policy file was not confirmed.",
    });
  } else {
    checks.push({
      status: "info",
      title: "MTA-STS is not published.",
      detail: "No _mta-sts TXT record was found.",
    });
  }

  if (tlsRptRecord) {
    score += 5;
    checks.push({
      status: "pass",
      title: "TLS-RPT is published.",
      detail: "The domain advertises SMTP TLS reporting.",
    });
  } else {
    checks.push({
      status: "info",
      title: "TLS-RPT is not published.",
      detail: "No _smtp._tls TXT record was found.",
    });
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: gradeFromScore(score),
    checks,
    startTlsSupportedCount,
    summary: {
      Score: score,
      MX: mxRecords.length,
      SPF: Boolean(spfRecord),
      DMARC: dmarcPolicy ?? Boolean(dmarcRecord),
      DKIM: foundSelectors.length,
      STARTTLS: startTlsSupportedCount,
      "MTA-STS": Boolean(mtaStsRecord),
      "TLS-RPT": Boolean(tlsRptRecord),
    },
  };
}

