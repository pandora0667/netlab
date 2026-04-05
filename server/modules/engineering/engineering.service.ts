import { createEngineeringDependencies } from "./application/engineering.dependencies.js";
import { getDnsAuthorityReport } from "./application/use-cases/get-dns-authority-report.js";
import { getEmailSecurityReport } from "./application/use-cases/get-email-security-report.js";
import { getIpParityReport } from "./application/use-cases/get-ip-parity-report.js";
import { getIpv6TransitionReport } from "./application/use-cases/get-ipv6-transition-report.js";
import { getPacketCaptureReport } from "./application/use-cases/get-packet-capture-report.js";
import { getPathMtuReport } from "./application/use-cases/get-path-mtu-report.js";
import { getPerformanceLabReport } from "./application/use-cases/get-performance-lab-report.js";
import { getRoutingIncidentReport } from "./application/use-cases/get-routing-incident-report.js";
import { getRoutingReport } from "./application/use-cases/get-routing-report.js";
import { getWebsiteSecurityReport } from "./application/use-cases/get-website-security-report.js";
export { normalizeUnorderedStrings } from "./domain/inputs.js";

const dependencies = createEngineeringDependencies();

class EngineeringService {
  getRoutingReport(input: string) {
    return getRoutingReport(input, dependencies);
  }

  getRoutingIncidentReport(input: string) {
    return getRoutingIncidentReport(input, dependencies);
  }

  getDnsAuthorityReport(input: string) {
    return getDnsAuthorityReport(input, dependencies);
  }

  getIpParityReport(input: string) {
    return getIpParityReport(input, dependencies);
  }

  getPathMtuReport(input: string) {
    return getPathMtuReport(input, dependencies);
  }

  getPacketCaptureReport(payload: Buffer, filename: string) {
    return getPacketCaptureReport(payload, filename, dependencies);
  }

  getPerformanceLabReport(input: string) {
    return getPerformanceLabReport(input, dependencies);
  }

  getIpv6TransitionReport(input: string) {
    return getIpv6TransitionReport(input, dependencies);
  }

  getWebsiteSecurityReport(input: string) {
    return getWebsiteSecurityReport(input, dependencies);
  }

  getEmailSecurityReport(input: string) {
    return getEmailSecurityReport(input, dependencies);
  }
}

export const engineeringService = new EngineeringService();
