import { promises as fs } from "node:fs";
import { EventEmitter } from "node:events";
import { Resolver } from "node:dns/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import logger from "../../lib/logger.js";
import { runtimeConfig } from "../../config/runtime.js";
import { mapWithConcurrency, withTimeout } from "../../src/lib/async-utils.js";

interface DNSServer {
  country_code: string;
  name: string;
  ip_address: string;
  reliability: number;
  dnssec: boolean;
  is_working: boolean;
}

interface DNSQueryResult {
  requestId: string;
  server: DNSServer;
  response: string;
  latency: number;
  status: 'success' | 'error';
  error?: string;
  timestamp?: number;
}

interface DNSQueryProgress {
  requestId: string;
  completedQueries: number;
  totalQueries: number;
  timestamp: number;
}

interface DNSQueryComplete {
  requestId: string;
  domain: string;
  region: string;
  totalQueries: number;
  timestamp: number;
}

interface RegionMapping {
  [key: string]: string[];
}

const DNS_SERVERS_FILE_NAME = "dns-servers.csv";
const DNS_SERVERS_CACHE_TTL_MS = 60 * 60 * 1000;
const DNS_SERVER_DATA_PATHS = [
  path.resolve(process.cwd(), "server/data", DNS_SERVERS_FILE_NAME),
  path.resolve(process.cwd(), "data", DNS_SERVERS_FILE_NAME),
];
const DNS_PROPAGATION_QUERY_TIMEOUT_MS = runtimeConfig.limits.dnsPropagationQueryTimeoutMs;
const DNS_PROPAGATION_QUERY_CONCURRENCY = runtimeConfig.limits.dnsPropagationQueryConcurrency;

const REGIONS: RegionMapping = {
  "All Regions": ["*"],
  Asia: ["JP", "KR", "CN", "SG", "IN", "HK"],
  Europe: ["GB", "DE", "FR", "IT", "ES", "NL"],
  "North America": ["US", "CA", "MX"],
  "South America": ["BR", "AR", "CL", "CO"],
  Africa: ["ZA", "EG", "NG", "KE"],
  Oceania: ["AU", "NZ"],
};

async function resolveDnsServersFilePath(): Promise<string> {
  for (const candidatePath of DNS_SERVER_DATA_PATHS) {
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch {
      // Try the next known runtime path.
    }
  }

  throw new Error(
    `Could not locate ${DNS_SERVERS_FILE_NAME}. Checked: ${DNS_SERVER_DATA_PATHS.join(", ")}`,
  );
}

export class DNSPropagationService extends EventEmitter {
  private dnsServers: DNSServer[] = [];
  private lastUpdate: number = 0;
  private readonly updateIntervalMs = DNS_SERVERS_CACHE_TTL_MS;

  constructor() {
    super();
    this.loadDNSServers();
  }

  private async loadDNSServers() {
    if (this.dnsServers.length > 0 && Date.now() - this.lastUpdate < this.updateIntervalMs) {
      return;
    }

    try {
      const filePath = await resolveDnsServersFilePath();
      const fileContent = await fs.readFile(filePath, "utf-8");

      this.dnsServers = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
      }).map((record: any) => ({
        country_code: record.country_code,
        name: record.name,
        ip_address: record.ip_address,
        reliability: parseFloat(record.reliability),
        dnssec: record.dnssec === "true",
        is_working: record.is_working === "true",
      }));

      this.lastUpdate = Date.now();
    } catch (error) {
      logger.error("Error loading DNS propagation server list", {
        error: error instanceof Error ? error.message : error,
      });
      throw new Error("Failed to load DNS servers");
    }
  }

  private async queryDNS(
    server: DNSServer,
    domain: string,
    requestId: string,
  ): Promise<DNSQueryResult> {
    const startTime = Date.now();
    const resolver = new Resolver();
    resolver.setServers([server.ip_address]);

    try {
      const [ipv4Records, ipv6Records] = await Promise.allSettled([
        withTimeout(
          resolver.resolve4(domain, { ttl: true }),
          DNS_PROPAGATION_QUERY_TIMEOUT_MS,
          `DNS propagation query timed out after ${DNS_PROPAGATION_QUERY_TIMEOUT_MS}ms`,
          () => resolver.cancel(),
        ),
        withTimeout(
          resolver.resolve6(domain, { ttl: true }),
          DNS_PROPAGATION_QUERY_TIMEOUT_MS,
          `DNS propagation query timed out after ${DNS_PROPAGATION_QUERY_TIMEOUT_MS}ms`,
          () => resolver.cancel(),
        ),
      ]);

      const records = [
        ...(ipv4Records.status === 'fulfilled' ? ipv4Records.value : []),
        ...(ipv6Records.status === 'fulfilled' ? ipv6Records.value : []),
      ];
      const errors = [
        ipv4Records.status === "rejected" ? ipv4Records.reason : null,
        ipv6Records.status === "rejected" ? ipv6Records.reason : null,
      ].filter(Boolean);

      const latency = Date.now() - startTime;
      if (records.length === 0) {
        const result = {
          requestId,
          server,
          response: "",
          error: errors[0] instanceof Error
            ? errors[0].message
            : "No DNS records returned",
          latency,
          status: "error" as const,
          timestamp: Date.now(),
        };

        this.emit('queryResult', result);
        return result;
      }

      const response = records.map((record) => {
        if ("address" in record) {
          return `${record.address} (TTL: ${record.ttl})`;
        }
        return JSON.stringify(record);
      }).join(', ');

      const result = {
        requestId,
        server,
        response,
        latency,
        status: "success" as const,
        timestamp: Date.now(),
      };

      this.emit('queryResult', result);
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      const result = {
        requestId,
        server,
        response: "",
        error: error instanceof Error ? error.message : "Unknown error",
        latency,
        status: "error" as const,
        timestamp: Date.now(),
      };

      this.emit('queryResult', result);
      return result;
    } finally {
      resolver.cancel();
    }
  }

  async checkPropagation(
    domain: string,
    region: string = "All Regions",
    requestId: string,
  ): Promise<DNSQueryResult[]> {
    await this.loadDNSServers();

    let filteredServers = this.dnsServers.filter((server) => server.is_working);
    if (region !== "All Regions") {
      const regionCountries = REGIONS[region] || [];
      filteredServers = this.dnsServers.filter((server) =>
        server.is_working && regionCountries.includes(server.country_code),
      );
    }

    filteredServers = [...filteredServers].sort((a, b) => b.reliability - a.reliability);
    const totalQueries = filteredServers.length;
    let completedQueries = 0;

    const results = await mapWithConcurrency(
      filteredServers,
      DNS_PROPAGATION_QUERY_CONCURRENCY,
      async (server) => {
        const result = await this.queryDNS(server, domain, requestId);
        completedQueries += 1;

        this.emit('queryProgress', {
          requestId,
          completedQueries,
          totalQueries,
          timestamp: Date.now(),
        } satisfies DNSQueryProgress);

        return result;
      },
    );

    this.emit('queryComplete', {
      requestId,
      domain,
      region,
      totalQueries,
      timestamp: Date.now(),
    } satisfies DNSQueryComplete);

    return results;
  }

  // Add methods for WebSocket support
  onQueryResult(callback: (result: DNSQueryResult) => void) {
    this.on("queryResult", callback);
    return () => this.off("queryResult", callback);
  }

  onQueryProgress(callback: (progress: DNSQueryProgress) => void) {
    this.on("queryProgress", callback);
    return () => this.off("queryProgress", callback);
  }

  onQueryComplete(callback: (complete: DNSQueryComplete) => void) {
    this.on("queryComplete", callback);
    return () => this.off("queryComplete", callback);
  }
}
