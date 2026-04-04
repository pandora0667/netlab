import dns from "node:dns/promises";
import { normalizeUnorderedStrings } from "../../domain/inputs.js";
import type { DnsAuthorityReport } from "../../engineering.types.js";
import { safeArray } from "../../domain/collections.js";
import { ExternalJsonClient } from "../http/external-json-client.js";

export const DNS_RECORD_TYPES = {
  SOA: 6,
  DS: 43,
  DNSKEY: 48,
} as const;

interface DnsGoogleAnswer {
  name?: string;
  type?: number;
  data?: string;
}

interface DnsGoogleResponse {
  Status?: number;
  AD?: boolean;
  Answer?: DnsGoogleAnswer[];
}

function normalizeDnsAnswerName(name: string | undefined) {
  return name?.replace(/\.+$/, "").toLowerCase() || null;
}

function readMxHost(mx: { exchange: string; priority: number }) {
  return {
    exchange: mx.exchange.replace(/\.+$/, ""),
    priority: mx.priority,
  };
}

function flattenTxtRecords(records: string[][]): string[] {
  return records.map((parts) => parts.join("").trim()).filter(Boolean);
}

export class GoogleDnsProofClient {
  constructor(private readonly externalJsonClient: ExternalJsonClient) {}

  async query(name: string, type: string) {
    const encodedName = encodeURIComponent(name);
    const url = `https://dns.google/resolve?name=${encodedName}&type=${encodeURIComponent(type)}&do=1`;
    return this.externalJsonClient.getJson<DnsGoogleResponse>(url);
  }

  async querySafe(name: string, type: string, notes: string[], label: string) {
    try {
      return await this.query(name, type);
    } catch (error) {
      notes.push(
        `${label} DNS proof could not be fetched: ${error instanceof Error ? error.message : "unknown error"}.`,
      );
      return null;
    }
  }

  filterRecordData(response: DnsGoogleResponse | null, expectedType: number) {
    return safeArray(response?.Answer)
      .filter((answer) => answer.type === expectedType)
      .map((answer) => answer.data)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
  }

  getSoaOwnerName(response: DnsGoogleResponse | null) {
    const soaOwner = safeArray(response?.Answer).find((answer) => answer.type === DNS_RECORD_TYPES.SOA);
    return normalizeDnsAnswerName(soaOwner?.name);
  }
}

export class NodeDnsAdapter {
  async resolveTxtSafe(name: string) {
    try {
      return flattenTxtRecords(await dns.resolveTxt(name));
    } catch {
      return [];
    }
  }

  async resolveMxSafe(domain: string) {
    try {
      const records = await dns.resolveMx(domain);
      return records.map(readMxHost).sort((left, right) => left.priority - right.priority);
    } catch {
      return [];
    }
  }

  async resolveNsSafe(domain: string) {
    try {
      const records = await dns.resolveNs(domain);
      return normalizeUnorderedStrings(
        [...new Set(records.map((record) => record.replace(/\.+$/, "").toLowerCase()))],
      );
    } catch {
      return [];
    }
  }

  async resolveSoaSafe(domain: string): Promise<DnsAuthorityReport["soa"]> {
    try {
      const soa = await dns.resolveSoa(domain);
      return {
        nsname: soa.nsname ?? null,
        hostmaster: soa.hostmaster ?? null,
        serial: soa.serial ?? null,
        refresh: soa.refresh ?? null,
        retry: soa.retry ?? null,
        expire: soa.expire ?? null,
        minttl: soa.minttl ?? null,
      };
    } catch {
      return null;
    }
  }

  async resolveCaaSafe(domain: string) {
    try {
      const records = await dns.resolveCaa(domain);
      return records
        .map((record) => ({
          critical: record.critical === 1,
          tag: record.issue
            ? "issue"
            : record.issuewild
              ? "issuewild"
              : record.iodef
                ? "iodef"
                : "unknown",
          value: record.issue ?? record.issuewild ?? record.iodef ?? "",
        }))
        .sort((left, right) => {
          const leftKey = `${left.tag}:${left.value}:${left.critical ? 1 : 0}`;
          const rightKey = `${right.tag}:${right.value}:${right.critical ? 1 : 0}`;
          return leftKey.localeCompare(rightKey);
        });
    } catch {
      return [];
    }
  }

  async resolve4Safe(domain: string) {
    return dns.resolve4(domain).catch(() => [] as string[]);
  }

  async resolve6Safe(domain: string) {
    return dns.resolve6(domain).catch(() => [] as string[]);
  }
}

