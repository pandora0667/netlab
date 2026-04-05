import { postApiV1, requestApiV1 } from "@/domains/shared/api-client";
import type { DNSPropagationRequest } from "./schema";

const DNS_PROPAGATION_REQUESTS_ENDPOINT = "/api/v1/dns-propagation/requests";

export interface StartDnsPropagationResponse {
  message: string;
  requestId: string;
  domain: string;
  region: string;
}

export interface DnsPropagationRequestStatus {
  requestId: string;
  domain: string;
  region: string;
  status: "running" | "complete" | "error";
  totalQueries: number;
  completedQueries: number;
  progress: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
  results: Array<{
    requestId: string;
    server: {
      country_code: string;
      name: string;
      ip_address: string;
      reliability: number;
      dnssec: boolean;
      is_working: boolean;
    };
    response: string;
    latency: number;
    status: "success" | "error";
    error?: string;
    timestamp?: number;
  }>;
}

export function startDnsPropagationRequest(
  request: DNSPropagationRequest,
) {
  return postApiV1<DNSPropagationRequest, StartDnsPropagationResponse>(
    DNS_PROPAGATION_REQUESTS_ENDPOINT,
    request,
  );
}

export function getDnsPropagationRequestStatus(requestId: string) {
  return requestApiV1<DnsPropagationRequestStatus>(
    `${DNS_PROPAGATION_REQUESTS_ENDPOINT}/${encodeURIComponent(requestId)}`,
  );
}
