import dns from 'dns/promises';

export interface DNSQueryResult {
  records: string[] | object;
  queryTime: number;
  error?: string;
}

export async function validateDNSServer(serverIP: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    const resolver = new dns.Resolver();
    resolver.setServers([serverIP]);
    
    // Try to resolve a known domain (google.com) to test the DNS server
    await resolver.resolve4('google.com');
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function performDNSLookup(
  domain: string,
  recordType: string,
  serverIP: string
): Promise<DNSQueryResult> {
  try {
    const resolver = new dns.Resolver();
    resolver.setServers([serverIP]);

    const startTime = performance.now();
    let records: string[] | object;

    switch (recordType.toUpperCase()) {
      case 'A':
        records = await resolver.resolve4(domain);
        break;
      case 'AAAA':
        records = await resolver.resolve6(domain);
        break;
      case 'MX':
        records = await resolver.resolveMx(domain);
        break;
      case 'TXT':
        records = await resolver.resolveTxt(domain);
        break;
      case 'NS':
        records = await resolver.resolveNs(domain);
        break;
      case 'CNAME':
        records = await resolver.resolveCname(domain);
        break;
      default:
        throw new Error(`Unsupported record type: ${recordType}`);
    }

    const queryTime = performance.now() - startTime;

    return {
      records,
      queryTime,
    };
  } catch (error) {
    return {
      records: [],
      queryTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
