import {
  DNS_RESOLVER_RETRIES,
  DNS_RESOLVER_TIMEOUT_MS,
} from "./dns.contract.js";
import { DNSResolver } from "./dns-resolver.service.js";
import type { DnsLookupResponse } from "./dns.types.js";

class DnsLookupService {
  async lookup(domain: string, servers: string[]): Promise<DnsLookupResponse> {
    const resolver = new DNSResolver({
      timeout: DNS_RESOLVER_TIMEOUT_MS,
      retries: DNS_RESOLVER_RETRIES,
    });

    const results = await resolver.queryAll(domain, servers);

    return {
      domain,
      results,
    };
  }
}

export const dnsLookupService = new DnsLookupService();
