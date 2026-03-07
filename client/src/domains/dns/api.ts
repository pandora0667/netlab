import { postApiV1, getErrorMessage } from "@/domains/shared/api-client";
import { isValidIPv4, isValidIPv6 } from "../../../../shared/network/ip";
import type {
  DNSLookupResult,
  DnsServerValidationResult,
} from "./types";

const DNS_LOOKUP_ENDPOINT = "/api/v1/dns/lookups";
const DNS_SERVER_VALIDATION_ENDPOINT = "/api/v1/dns/servers/validate";

interface DNSLookupRequest {
  domain: string;
  servers: string[];
  includeAllRecords?: boolean;
  signal?: AbortSignal;
}

interface DNSValidationResponse {
  isValid: boolean;
  message: string;
}

export function lookupDnsRecords(request: DNSLookupRequest) {
  const { signal, ...payload } = request;

  return postApiV1<typeof payload, DNSLookupResult>(
    DNS_LOOKUP_ENDPOINT,
    payload,
    { signal },
  );
}

export async function validateDnsServer(
  serverIP: string,
): Promise<DnsServerValidationResult> {
  const normalizedServerIP = serverIP.trim();

  if (!normalizedServerIP) {
    return { isValid: true };
  }

  if (!isValidIPv4(normalizedServerIP) && !isValidIPv6(normalizedServerIP)) {
    return {
      isValid: false,
      error: "Invalid IP address format.",
    };
  }

  try {
    const response = await postApiV1<{ serverIP: string }, DNSValidationResponse>(
      DNS_SERVER_VALIDATION_ENDPOINT,
      { serverIP: normalizedServerIP },
    );

    return {
      isValid: Boolean(response.isValid),
    };
  } catch (error) {
    return {
      isValid: false,
      error: getErrorMessage(
        error,
        "An error occurred during DNS server validation.",
      ),
    };
  }
}
