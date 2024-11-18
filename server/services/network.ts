import dns from "dns/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { whois } from "./whoisClient";
import {
  calculateSubnetInfo,
  netmaskToCidr,
} from "../../client/src/lib/utils/subnet";

const execAsync = promisify(exec);
const whoisAsync = promisify(whois.lookup);

const allRecordTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "PTR"];

const DNS_SERVERS = {
  google: '8.8.8.8',
  cloudflare: '1.1.1.1',
  opendns: '208.67.222.222'
};

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
                  return [];  // CNAME이 없는 경우 빈 배열 반환
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
            return [];  // 레코드가 없는 경우 빈 배열 반환
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

  async ping(host: string) {
    const { stdout } = await execAsync(`ping -c 4 ${host}`);
    return { output: stdout };
  },

  async whoisLookup(domain: string) {
    const result = await whoisAsync(domain);
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
      dns.setServers(['8.8.8.8']); // 기본 DNS 서버로 복구
    }
  }
};
