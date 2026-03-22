import { postApiV1, requestApiV1 } from "@/domains/shared/api-client";
import type {
  HttpTlsInspectionResult,
  IPInfo,
  TraceSummary,
  WhoisLookupResult,
} from "./types";

const PUBLIC_IP_ENDPOINT = "/api/v1/network/public-ip";
const WHOIS_LOOKUP_ENDPOINT = "/api/v1/network/whois-lookups";
const TRACE_ENDPOINT = "/api/v1/network/traces";
const HTTP_INSPECTION_ENDPOINT = "/api/v1/network/http-inspections";

export function fetchPublicIpInfo() {
  return requestApiV1<IPInfo>(PUBLIC_IP_ENDPOINT);
}

export function lookupWhois(domain: string) {
  return postApiV1<{ domain: string }, WhoisLookupResult>(
    WHOIS_LOOKUP_ENDPOINT,
    { domain },
  );
}

export function runTrace(host: string, maxHops: number, timeoutMs: number) {
  return postApiV1<{ host: string; maxHops: number; timeoutMs: number }, TraceSummary>(
    TRACE_ENDPOINT,
    { host, maxHops, timeoutMs },
  );
}

export function inspectHttpTarget(input: string, timeoutMs: number) {
  return postApiV1<{ input: string; timeoutMs: number }, HttpTlsInspectionResult>(
    HTTP_INSPECTION_ENDPOINT,
    { input, timeoutMs },
  );
}

export { PUBLIC_IP_ENDPOINT };
