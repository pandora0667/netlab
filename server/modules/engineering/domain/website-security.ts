import type { HttpTlsInspectionResult } from "../../network/network.types.js";
import type {
  DnsAuthorityReport,
  WebsiteSecurityCheck,
} from "../engineering.types.js";
import { gradeFromScore } from "./grading.js";

interface WebsiteSecurityAssessmentInput {
  hostname: string;
  httpInspection: HttpTlsInspectionResult;
  authority: DnsAuthorityReport;
  securityTxt: {
    found: boolean;
    url: string | null;
  };
}

export function buildWebsiteSecurityAssessment({
  hostname,
  httpInspection,
  authority,
  securityTxt,
}: WebsiteSecurityAssessmentInput) {
  const headers = httpInspection.responseHeaders;
  const headerChecks: Array<[boolean, string, string]> = [
    [Boolean(headers["content-security-policy"]), "CSP", "Content-Security-Policy is present."],
    [
      Boolean(headers["x-frame-options"]) || Boolean(headers["content-security-policy"]?.includes("frame-ancestors")),
      "Frame protection",
      "Clickjacking protection is present.",
    ],
    [headers["x-content-type-options"] === "nosniff", "nosniff", "X-Content-Type-Options is set to nosniff."],
    [Boolean(headers["referrer-policy"]), "Referrer policy", "Referrer-Policy is present."],
    [Boolean(headers["permissions-policy"]), "Permissions policy", "Permissions-Policy is present."],
  ];

  const checks: WebsiteSecurityCheck[] = [];
  let score = 100;

  if (httpInspection.protocol !== "https:") {
    score -= 20;
    checks.push({
      status: "fail",
      title: "The final response is not HTTPS.",
      detail: "The request landed on plain HTTP, so TLS protections are not being enforced at the edge.",
    });
  }

  if (httpInspection.tlsAuthorized === false) {
    score -= 20;
    checks.push({
      status: "fail",
      title: "The certificate chain did not verify cleanly.",
      detail: httpInspection.tlsAuthorizationError || "The TLS handshake completed but the certificate did not validate.",
    });
  }

  if (httpInspection.hsts) {
    checks.push({
      status: "pass",
      title: "HSTS is enabled.",
      detail: "The response includes Strict-Transport-Security.",
    });
  } else {
    score -= 8;
    checks.push({
      status: "warn",
      title: "HSTS is missing.",
      detail: "Browsers may still attempt HTTP before upgrading unless another policy forces HTTPS.",
    });
  }

  for (const [passed, title, passDetail] of headerChecks) {
    if (passed) {
      checks.push({
        status: "pass",
        title,
        detail: passDetail,
      });
    } else {
      score -= 6;
      checks.push({
        status: "warn",
        title: `${title} is missing.`,
        detail: `${title} is not visible in the final response headers.`,
      });
    }
  }

  if (authority.dnssec.enabled) {
    checks.push({
      status: "pass",
      title: "DNSSEC is published.",
      detail: "The hostname's zone exposes DS and DNSKEY material.",
    });
  } else {
    score -= 7;
    checks.push({
      status: "warn",
      title: "DNSSEC is not active.",
      detail: "No validated DS and DNSKEY chain was found for this hostname's zone.",
    });
  }

  if (authority.caaRecords.length > 0) {
    checks.push({
      status: "pass",
      title: "CAA records are published.",
      detail: "Certificate issuance is constrained by explicit CAA policy.",
    });
  } else {
    score -= 5;
    checks.push({
      status: "warn",
      title: "CAA records are missing.",
      detail: "No certificate authority authorization policy was found.",
    });
  }

  if (securityTxt.found) {
    checks.push({
      status: "pass",
      title: "security.txt is published.",
      detail: `A disclosure policy was found at ${securityTxt.url}.`,
    });
  } else {
    score -= 4;
    checks.push({
      status: "warn",
      title: "security.txt was not found.",
      detail: "The site does not expose a standard security contact file at the common paths.",
    });
  }

  if (
    typeof httpInspection.certificate?.expiresInDays === "number"
    && httpInspection.certificate.expiresInDays >= 0
    && httpInspection.certificate.expiresInDays <= 30
  ) {
    score -= 8;
    checks.push({
      status: "warn",
      title: "Certificate expiry is close.",
      detail: `The certificate expires in ${httpInspection.certificate.expiresInDays} days.`,
    });
  }

  score = Math.max(0, score);
  const grade = gradeFromScore(score);

  return {
    hostname,
    score,
    grade,
    checks,
    keyHeaders: {
      "content-security-policy": headers["content-security-policy"] || null,
      "x-frame-options": headers["x-frame-options"] || null,
      "x-content-type-options": headers["x-content-type-options"] || null,
      "referrer-policy": headers["referrer-policy"] || null,
      "permissions-policy": headers["permissions-policy"] || null,
      "strict-transport-security": headers["strict-transport-security"] || null,
    },
    dnssecEnabled: authority.dnssec.enabled,
    caaPresent: authority.caaRecords.length > 0,
    tlsVersion: httpInspection.tlsVersion,
    certificateExpiresInDays: httpInspection.certificate?.expiresInDays ?? null,
    summary: {
      Score: score,
      Grade: grade,
      "TLS version": httpInspection.tlsVersion ?? "n/a",
      HSTS: Boolean(httpInspection.hsts),
      CSP: Boolean(headers["content-security-policy"]),
      DNSSEC: authority.dnssec.enabled,
      "security.txt": securityTxt.found,
      Hostname: hostname,
    },
  };
}

