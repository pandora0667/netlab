export interface DnsServerValidationResult {
  success: boolean;
  error?: string;
}

export interface DNSQueryOptions {
  timeout?: number;
  retries?: number;
  servers?: string[];
}

export interface DNSResult {
  recordType: string;
  records: unknown[];
  server: string;
  timestamp: number;
  queryTime: number;
  error?: string;
}

export interface DnsLookupResponse {
  domain: string;
  results: DNSResult[];
}
