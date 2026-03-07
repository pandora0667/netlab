export interface DNSLookupRecordResult {
  recordType: string;
  records: unknown[];
  server: string;
  timestamp: number;
  queryTime: number;
  error?: string;
}

export interface DNSLookupResult {
  domain: string;
  results: DNSLookupRecordResult[];
}

export interface DNSResolverOption {
  id: string;
  name: string;
  address: string;
}

export interface DnsServerValidationResult {
  isValid: boolean;
  error?: string;
}
