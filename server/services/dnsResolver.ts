import dns from 'dns/promises';
import { EventEmitter } from 'events';

interface DNSQueryOptions {
  timeout?: number;
  retries?: number;
  servers?: string[];
}

interface DNSResult {
  recordType: string;
  records: any[];
  server: string;
  timestamp: number;
  queryTime: number;
}

export class DNSResolver extends EventEmitter {
  private resolver: dns.Resolver;
  private timeout: number;
  private maxRetries: number;

  constructor(options: DNSQueryOptions = {}) {
    super();
    this.resolver = new dns.Resolver();
    this.timeout = options.timeout || 5000;
    this.maxRetries = options.retries || 3;
    
    if (options.servers) {
      this.resolver.setServers(options.servers);
    }
  }

  private async queryWithRetry(
    domain: string,
    recordType: string,
    server: string,
    attempt = 1
  ): Promise<DNSResult> {
    const startTime = Date.now();
    
    try {
      this.emit('queryStart', { domain, recordType, server, attempt });
      
      const records = await Promise.race([
        this.performQuery(domain, recordType),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), this.timeout)
        )
      ]) as any[];

      const queryTime = Date.now() - startTime;
      
      return {
        recordType,
        records,
        server,
        timestamp: Date.now(),
        queryTime
      };
    } catch (error) {
      if (attempt < this.maxRetries) {
        this.emit('queryRetry', { domain, recordType, server, attempt, error });
        return this.queryWithRetry(domain, recordType, server, attempt + 1);
      }
      throw error;
    }
  }

  private async performQuery(domain: string, recordType: string): Promise<any[]> {
    switch (recordType) {
      case 'A': return await this.resolver.resolve4(domain);
      case 'AAAA': return await this.resolver.resolve6(domain);
      case 'MX': return await this.resolver.resolveMx(domain);
      case 'NS': return await this.resolver.resolveNs(domain);
      case 'TXT': return await this.resolver.resolveTxt(domain);
      case 'CNAME': return await this.resolver.resolveCname(domain);
      case 'SOA': return [await this.resolver.resolveSoa(domain)];
      case 'PTR': return await this.resolver.resolvePtr(domain);
      default: throw new Error(`Unsupported record type: ${recordType}`);
    }
  }

  async queryAll(domain: string, servers: string[]) {
    const recordTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'];
    const results: DNSResult[] = [];
    
    for (const server of servers) {
      this.resolver.setServers([server]);
      
      await Promise.all(
        recordTypes.map(async (recordType) => {
          try {
            const result = await this.queryWithRetry(domain, recordType, server);
            results.push(result);
            this.emit('recordComplete', result);
          } catch (error) {
            this.emit('recordError', { domain, recordType, server, error });
          }
        })
      );
    }
    
    return results;
  }
}
