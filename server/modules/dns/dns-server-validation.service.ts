import { Resolver } from "node:dns/promises";
import {
  assertPublicIPAddress,
  PublicTargetError,
} from "../../src/lib/public-targets.js";
import type { DnsServerValidationResult } from "./dns.types.js";
import { withTimeout } from "../../src/lib/async-utils.js";

const DNS_SERVER_VALIDATION_TIMEOUT_MS = 5_000;
const DNS_SERVER_VALIDATION_DOMAINS = [
  "google.com",
  "cloudflare.com",
  "example.com",
] as const;

async function resolveWithTimeout(
  resolver: Resolver,
  domain: string,
): Promise<void> {
  await withTimeout(
    resolver.resolve4(domain).then(() => undefined),
    DNS_SERVER_VALIDATION_TIMEOUT_MS,
    `DNS server validation timed out after ${DNS_SERVER_VALIDATION_TIMEOUT_MS}ms`,
    () => resolver.cancel(),
  );
}

class DnsServerValidationService {
  async validate(serverIP: string): Promise<DnsServerValidationResult> {
    try {
      const normalizedServerIP = assertPublicIPAddress(serverIP, "DNS server");
      const resolver = new Resolver();
      resolver.setServers([normalizedServerIP]);

      let lastErrorMessage = "DNS server failed to resolve any test domains";

      try {
        for (const domain of DNS_SERVER_VALIDATION_DOMAINS) {
          try {
            await resolveWithTimeout(resolver, domain);
            return { success: true };
          } catch (error) {
            lastErrorMessage = error instanceof Error
              ? error.message
              : "DNS server validation failed";
          }
        }

        return {
          success: false,
          error: lastErrorMessage,
        };
      } finally {
        resolver.cancel();
      }
    } catch (error) {
      if (error instanceof PublicTargetError) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "DNS server validation failed",
      };
    }
  }
}

export const dnsServerValidationService = new DnsServerValidationService();
