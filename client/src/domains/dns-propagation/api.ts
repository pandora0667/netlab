import { postApiV1 } from "@/domains/shared/api-client";
import type { DNSPropagationRequest } from "./schema";

const DNS_PROPAGATION_REQUESTS_ENDPOINT = "/api/v1/dns-propagation/requests";

export interface StartDnsPropagationResponse {
  message: string;
  requestId: string;
  domain: string;
  region: string;
}

export function startDnsPropagationRequest(
  request: DNSPropagationRequest,
) {
  return postApiV1<DNSPropagationRequest, StartDnsPropagationResponse>(
    DNS_PROPAGATION_REQUESTS_ENDPOINT,
    request,
  );
}
