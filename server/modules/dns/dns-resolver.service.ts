import dns from "dns/promises";
import { EventEmitter } from "events";
import { validateIPAddress } from "../../src/lib/dns-utils.js";
import {
  assertPublicIPAddress,
  PublicTargetError,
} from "../../src/lib/public-targets.js";
import {
  DNS_RESOLVER_RETRIES,
  DNS_RESOLVER_TIMEOUT_MS,
} from "./dns.contract.js";
import type { DNSQueryOptions, DNSResult } from "./dns.types.js";
import { withTimeout } from "../../src/lib/async-utils.js";

export class DNSError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "DNSError";
  }
}

export class DNSResolver extends EventEmitter {
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options: DNSQueryOptions = {}) {
    super();
    this.timeout = options.timeout ?? DNS_RESOLVER_TIMEOUT_MS;
    this.maxRetries = options.retries ?? DNS_RESOLVER_RETRIES;
  }

  async validateDNSServerConnection(serverIP: string): Promise<void> {
    let normalizedServerIP: string;

    try {
      normalizedServerIP = assertPublicIPAddress(serverIP, "DNS server");
    } catch (error) {
      if (error instanceof PublicTargetError) {
        throw new DNSError(error.message, "PUBLIC_DNS_SERVER_REQUIRED");
      }

      throw error;
    }

    const validationResult = validateIPAddress(normalizedServerIP);
    if (!validationResult.isValid) {
      throw new DNSError(
        validationResult.error || "Invalid DNS server IP address format",
        "INVALID_IP_FORMAT",
      );
    }

    try {
      const resolver = new dns.Resolver();
      resolver.setServers([normalizedServerIP]);

      await withTimeout(
        resolver.resolve("google.com", "A"),
        this.timeout,
        `DNS server ${normalizedServerIP} did not respond within ${this.timeout}ms`,
        () => resolver.cancel(),
      );

      this.emit("serverValidated", {
        server: normalizedServerIP,
        type: validationResult.type,
        responseTime: Date.now(),
      });
    } catch (error) {
      if (error instanceof DNSError) {
        throw error;
      }

      const errorMessage = error instanceof Error
        ? `DNS server ${normalizedServerIP} validation failed: ${error.message}`
        : `Failed to validate DNS server ${normalizedServerIP}`;

      throw new DNSError(errorMessage, "VALIDATION_FAILED", 503);
    }
  }

  async checkDNSServer(serverIP: string): Promise<boolean> {
    try {
      await this.validateDNSServerConnection(serverIP);
      return true;
    } catch {
      return false;
    }
  }

  private async queryWithRetry(
    domain: string,
    recordType: string,
    server: string,
    attempt = 1,
  ): Promise<DNSResult> {
    const startTime = Date.now();

    try {
      this.emit("queryStart", { domain, recordType, server, attempt });

      const records = await this.performQuery(domain, recordType, server);

      return {
        recordType,
        records,
        server,
        timestamp: Date.now(),
        queryTime: Date.now() - startTime,
      };
    } catch (error) {
      if (attempt < this.maxRetries) {
        this.emit("queryRetry", { domain, recordType, server, attempt, error });
        return this.queryWithRetry(domain, recordType, server, attempt + 1);
      }

      throw error;
    }
  }

  private async performQuery(
    domain: string,
    recordType: string,
    server: string,
  ): Promise<unknown[]> {
    const resolver = new dns.Resolver();
    resolver.setServers([server]);

    switch (recordType) {
      case "A":
        return withTimeout(
          resolver.resolve4(domain),
          this.timeout,
          "Query timeout",
          () => resolver.cancel(),
        );
      case "AAAA":
        return withTimeout(
          resolver.resolve6(domain),
          this.timeout,
          "Query timeout",
          () => resolver.cancel(),
        );
      case "MX":
        return withTimeout(
          resolver.resolveMx(domain),
          this.timeout,
          "Query timeout",
          () => resolver.cancel(),
        );
      case "NS":
        return withTimeout(
          resolver.resolveNs(domain),
          this.timeout,
          "Query timeout",
          () => resolver.cancel(),
        );
      case "TXT":
        return withTimeout(
          resolver.resolveTxt(domain),
          this.timeout,
          "Query timeout",
          () => resolver.cancel(),
        );
      case "CNAME":
        return withTimeout(
          resolver.resolveCname(domain),
          this.timeout,
          "Query timeout",
          () => resolver.cancel(),
        );
      case "SOA":
        return [
          await withTimeout(
            resolver.resolveSoa(domain),
            this.timeout,
            "Query timeout",
            () => resolver.cancel(),
          ),
        ];
      case "PTR":
        return withTimeout(
          resolver.resolvePtr(domain),
          this.timeout,
          "Query timeout",
          () => resolver.cancel(),
        );
      default:
        throw new Error(`Unsupported record type: ${recordType}`);
    }
  }

  async queryAll(domain: string, servers: string[]): Promise<DNSResult[]> {
    const recordTypes = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"];
    const results: DNSResult[] = [];

    await Promise.all(servers.map(async (server) => {
      try {
        await this.validateDNSServerConnection(server);
      } catch (error) {
        this.emit("serverValidationError", { server, error });
        throw error;
      }
    }));

    for (const server of servers) {
      try {
        const serverResults = await Promise.all(recordTypes.map(async (recordType) => {
          try {
            return await this.queryWithRetry(domain, recordType, server);
          } catch (error) {
            this.emit("queryError", { domain, recordType, server, error });
            return {
              recordType,
              records: [],
              server,
              timestamp: Date.now(),
              queryTime: 0,
              error: error instanceof Error ? error.message : "Unknown error",
            } satisfies DNSResult;
          }
        }));

        results.push(...serverResults);
      } catch (error) {
        this.emit("serverError", { server, error });
      }
    }

    return results;
  }
}
