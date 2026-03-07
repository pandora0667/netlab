import { postApiV1, requestApiV1 } from "@/domains/shared/api-client";
import type { IPInfo, WhoisLookupResult } from "./types";

const PUBLIC_IP_ENDPOINT = "/api/v1/network/public-ip";
const WHOIS_LOOKUP_ENDPOINT = "/api/v1/network/whois-lookups";

export function fetchPublicIpInfo() {
  return requestApiV1<IPInfo>(PUBLIC_IP_ENDPOINT);
}

export function lookupWhois(domain: string) {
  return postApiV1<{ domain: string }, WhoisLookupResult>(
    WHOIS_LOOKUP_ENDPOINT,
    { domain },
  );
}

export { PUBLIC_IP_ENDPOINT };
