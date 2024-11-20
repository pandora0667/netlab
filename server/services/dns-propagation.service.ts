import { promises as fs } from 'fs';
import { parse } from 'csv-parse/sync';
import dns, { Resolver } from 'node:dns/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DNSServer {
  country_code: string;
  name: string;
  ip_address: string;
  reliability: number;
  dnssec: boolean;
  is_working: boolean;
}

interface DNSQueryResult {
  server: DNSServer;
  response: string;
  latency: number;
  status: 'success' | 'error';
  error?: string;
  timestamp?: number;
}

interface RegionMapping {
  [key: string]: string[];
}

const REGIONS: RegionMapping = {
  'All Regions': ['*'],
  'Asia': ['JP', 'KR', 'CN', 'SG', 'IN', 'HK'],
  'Europe': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL'],
  'North America': ['US', 'CA', 'MX'],
  'South America': ['BR', 'AR', 'CL', 'CO'],
  'Africa': ['ZA', 'EG', 'NG', 'KE'],
  'Oceania': ['AU', 'NZ'],
};

export class DNSPropagationService extends EventEmitter {
  private dnsServers: DNSServer[] = [];
  private lastUpdate: number = 0;
  private readonly UPDATE_INTERVAL = 3600000; // 1 hour

  constructor() {
    super();
    this.loadDNSServers();
  }

  private async loadDNSServers() {
    if (this.dnsServers.length > 0 && Date.now() - this.lastUpdate < this.UPDATE_INTERVAL) {
      return;
    }

    try {
      const filePath = path.join(__dirname, '../data/dns-servers.csv');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      this.dnsServers = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      }).map((record: any) => ({
        country_code: record.country_code,
        name: record.name,
        ip_address: record.ip_address,
        reliability: parseFloat(record.reliability),
        dnssec: record.dnssec === 'true',
        is_working: record.is_working === 'true'
      }));

      this.lastUpdate = Date.now();
    } catch (error) {
      console.error('Error loading DNS servers:', error);
      throw new Error('Failed to load DNS servers');
    }
  }

  private async queryDNS(server: DNSServer, domain: string): Promise<DNSQueryResult> {
    const startTime = Date.now();
    const resolver = new Resolver();
    resolver.setServers([server.ip_address]);
    
    try {
      const [ipv4Records, ipv6Records] = await Promise.allSettled([
        resolver.resolve4(domain, { ttl: true }),
        resolver.resolve6(domain, { ttl: true })
      ]);

      const records = [
        ...(ipv4Records.status === 'fulfilled' ? ipv4Records.value : []),
        ...(ipv6Records.status === 'fulfilled' ? ipv6Records.value : [])
      ];

      const latency = Date.now() - startTime;
      const response = records.map(record => {
        if ('address' in record) {
          return `${record.address} (TTL: ${record.ttl})`;
        }
        return JSON.stringify(record);
      }).join(', ');
      
      const result = {
        server,
        response,
        latency,
        status: 'success' as const,
        timestamp: Date.now()
      };

      this.emit('queryResult', result);
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      const result = {
        server,
        response: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency,
        status: 'error' as const,
        timestamp: Date.now()
      };

      this.emit('queryResult', result);
      return result;
    }
  }

  async checkPropagation(domain: string, region: string = 'All Regions'): Promise<DNSQueryResult[]> {
    await this.loadDNSServers();

    let filteredServers = this.dnsServers;
    if (region !== 'All Regions') {
      const regionCountries = REGIONS[region] || [];
      filteredServers = this.dnsServers.filter(server => 
        regionCountries.includes(server.country_code)
      );
    }

    // Sort servers by reliability
    filteredServers.sort((a, b) => b.reliability - a.reliability);

    const results = await Promise.all(
      filteredServers.map(server => this.queryDNS(server, domain))
    );

    return results;
  }

  // Add methods for WebSocket support
  onQueryResult(callback: (result: DNSQueryResult) => void) {
    this.on('queryResult', callback);
    return () => this.off('queryResult', callback);
  }
}
