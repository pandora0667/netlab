import dns from "dns/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { whois } from "./whoisClient";
import {
  calculateSubnetInfo,
  netmaskToCidr,
} from "../../client/src/lib/utils/subnet";
import net from "net";

const execAsync = promisify(exec);
const whoisLookup = whois.lookup;

const allRecordTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "PTR"];

const DNS_SERVERS = {
  google: '8.8.8.8',
  cloudflare: '1.1.1.1',
  opendns: '208.67.222.222'
};

export interface PingOptions {
  type: 'icmp' | 'tcp';
  host: string;
  port?: number;
  count?: number;
  timeout?: number;
  retries?: number;
}

interface PingResult {
  success: boolean;
  latency?: number;
  error?: string;
  attempt: number;
}

interface PingSummary {
  host: string;
  type: string;
  results: PingResult[];
  statistics: {
    sent: number;
    received: number;
    lost: number;
    successRate: number;
    minLatency: number;
    maxLatency: number;
    avgLatency: number;
  }
}

class PingService {
  private async tcpPing(host: string, port: number, timeout: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const startTime = process.hrtime();
      const socket = new net.Socket();
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const latency = seconds * 1000 + nanoseconds / 1000000;
        socket.destroy();
        resolve(latency);
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Timeout'));
      });

      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });

      socket.connect(port, host);
    });
  }

  private async icmpPing(host: string, timeout: number): Promise<number> {
    const isWindows = process.platform === 'win32';
    const command = isWindows
      ? `ping -n 1 -w ${timeout} ${host}`
      : `ping -c 1 -W ${Math.ceil(timeout / 1000)} ${host}`;
    
    const { stdout } = await execAsync(command);
    return this.parseICMPPingOutput(stdout, isWindows);
  }

  async ping(options: PingOptions): Promise<PingSummary> {
    try {
      const results = await this.executePing(options);
      const statistics = this.calculateStatistics(results);
      
      return {
        host: options.host,
        type: options.type,
        results,
        statistics
      };
    } catch (err) {
      console.error('Ping error:', err);
      throw new Error(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  private async executePing(options: PingOptions): Promise<PingResult[]> {
    const { type, host, port = 80, count = 4, timeout = 5000 } = options;
    const results: PingResult[] = [];

    for (let attempt = 1; attempt <= count; attempt++) {
      try {
        const latency = type === 'tcp' 
          ? await this.tcpPing(host, port, timeout)
          : await this.icmpPing(host, timeout);
        
        results.push({ success: true, latency, attempt });
      } catch (err) {
        results.push({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to ping',
          attempt
        });
      }
    }

    return results;
  }

  private calculateStatistics(results: PingResult[]): PingSummary['statistics'] {
    const successful = results.filter(r => r.success);
    const latencies = successful.map(r => r.latency!);

    return {
      sent: results.length,
      received: successful.length,
      lost: results.length - successful.length,
      successRate: (successful.length / results.length) * 100,
      minLatency: latencies.length ? Math.min(...latencies) : 0,
      maxLatency: latencies.length ? Math.max(...latencies) : 0,
      avgLatency: latencies.length ? 
        latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
    };
  }

  private parseICMPPingOutput(output: string, isWindows: boolean = false): number {
    try {
      // macOS/Linux format: round-trip min/avg/max/stddev = 33.620/33.620/33.620/nan ms
      const macMatch = output.match(/round-trip.*?=.*?\/(.+?)\/.+?\/.*?ms/);
      if (macMatch) {
        return parseFloat(macMatch[1]);
      }

      // Windows format
      const winMatch = output.match(/[시간|time][=<](\d+)ms/i);
      if (winMatch) {
        return parseFloat(winMatch[1]);
      }

      // Linux format (alternative)
      const linuxMatch = output.match(/time=(\d+\.?\d*) ms/);
      if (linuxMatch) {
        return parseFloat(linuxMatch[1]);
      }

      console.error('Ping output:', output);
      throw new Error('Failed to parse ping output');
    } catch (err) {
      console.error('Parse error:', err);
      throw new Error('Failed to parse ping output');
    }
  }
}

export const networkServices = {
  async getIPInfo() {
    const response = await fetch("https://ipapi.co/json/");
    return response.json();
  },

  async dnsLookup(domain: string, recordType?: string, server?: string) {
    try {
      if (server) {
        const serverAddress = DNS_SERVERS[server as keyof typeof DNS_SERVERS];
        if (serverAddress) {
          dns.setServers([serverAddress]);
        }
      }

      const records = await (async () => {
        try {
          switch (recordType) {
            case "A":
              return await dns.resolve4(domain);
            case "AAAA":
              return await dns.resolve6(domain);
            case "MX":
              return await dns.resolveMx(domain);
            case "TXT":
              return await dns.resolveTxt(domain);
            case "NS":
              return await dns.resolveNs(domain);
            case "SOA":
              return await dns.resolveSoa(domain);
            case "CNAME":
              try {
                return await dns.resolveCname(domain);
              } catch (error: any) {
                if (error.code === 'ENODATA') {
                  return [];  // Return empty array if no CNAME exists
                }
                throw error;
              }
            case "PTR":
              return await dns.resolvePtr(domain);
            default:
              throw new Error("Invalid record type");
          }
        } catch (error: any) {
          if (error.code === 'ENODATA') {
            return [];  // Return empty array if no records exist
          }
          throw error;
        }
      })();

      return {
        success: true,
        domain,
        recordType,
        server: server || 'Default',
        records,
        info: recordType === 'SOA' 
          ? undefined 
          : (Array.isArray(records) && records.length === 0) 
            ? `No ${recordType} records found` 
            : undefined
      };
    } catch (error: any) {
      if (error.code === 'ENODATA') {
        return {
          success: true,
          domain,
          recordType,
          server: server || 'Default',
          records: [],
          info: `No ${recordType} records found`
        };
      }
      
      console.error('DNS Lookup error:', error);
      throw new Error(error.message || 'DNS lookup failed');
    } finally {
      dns.setServers(['8.8.8.8']);
    }
  },

  calculateSubnet(networkAddress: string, mask: string) {
    const maskBits = mask.startsWith('/')
      ? parseInt(mask.slice(1))
      : netmaskToCidr(mask);
    
    return calculateSubnetInfo(networkAddress, maskBits);
  },

  async ping(options: PingOptions): Promise<PingSummary> {
    const pingService = new PingService();
    try {
      return await pingService.ping(options);
    } catch (err) {
      throw new Error(`Ping failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  },

  async whoisLookup(domain: string) {
    const result = await whoisLookup(domain);
    return { data: result };
  },

  async validateDNSServer(serverIP: string): Promise<boolean> {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers([serverIP]);
      await resolver.resolve4('google.com');
      return true;
    } catch {
      return false;
    } finally {
      dns.setServers(['8.8.8.8']); // Restore default DNS server
    }
  }
};
