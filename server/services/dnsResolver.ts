import dns from 'dns/promises';
import { EventEmitter } from 'events';
import { isValidIPv4, isValidIPv6, validateIPAddress } from '../src/lib/dns-utils';

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
  error?: string;
}

export class DNSError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'DNSError';
  }
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

  async validateDNSServerConnection(serverIP: string): Promise<void> {
    const validationResult = validateIPAddress(serverIP);
    
    if (!validationResult.isValid) {
      throw new DNSError(
        validationResult.error || 'Invalid DNS server IP address format',
        'INVALID_IP_FORMAT'
      );
    }

    try {
      const resolver = new dns.Resolver();
      resolver.setServers([serverIP]);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new DNSError(
          `DNS server ${serverIP} did not respond within ${this.timeout}ms`,
          'TIMEOUT',
          408
        )), this.timeout);
      });

      // Race between the actual query and timeout
      await Promise.race([
        resolver.resolve('google.com', 'A'),
        timeoutPromise
      ]);

      // If we get here, the server responded successfully
      this.emit('serverValidated', { 
        server: serverIP, 
        type: validationResult.type,
        responseTime: Date.now()
      });
    } catch (error) {
      if (error instanceof DNSError) throw error;
      
      const errorMessage = error instanceof Error 
        ? `DNS server ${serverIP} validation failed: ${error.message}`
        : `Failed to validate DNS server ${serverIP}`;
      
      throw new DNSError(
        errorMessage,
        'VALIDATION_FAILED',
        503
      );
    }
  }

  public async checkDNSServer(serverIP: string): Promise<boolean> {
    try {
      await this.validateDNSServerConnection(serverIP);
      return true;
    } catch (error) {
      return false;
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
    
    // Validate servers in parallel
    await Promise.all(servers.map(async (server) => {
      try {
        await this.validateDNSServerConnection(server);
      } catch (error) {
        this.emit('serverValidationError', { server, error });
        throw error;
      }
    }));

    for (const server of servers) {
      this.resolver.setServers([server]);
      
      try {
        const serverResults = await Promise.all(
          recordTypes.map(async (recordType) => {
            try {
              return await this.queryWithRetry(domain, recordType, server);
            } catch (error) {
              this.emit('queryError', { domain, recordType, server, error });
              return {
                recordType,
                records: [],
                server,
                timestamp: Date.now(),
                queryTime: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          })
        );
        
        results.push(...serverResults);
      } catch (error) {
        this.emit('serverError', { server, error });
      }
    }
    
    return results;
  }
}
