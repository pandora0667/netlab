import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { resolvePublicTarget } from "../../src/lib/public-targets.js";
import { ipInfoService } from "../network/ip-info.service.js";
import { httpInspectorService } from "../network/http-inspector.service.js";
import type {
  DnsAuthorityReport,
  EmailSecurityReport,
  FamilyProbeResult,
  IpParityReport,
  PathMtuAttempt,
  PathMtuReport,
  ReportHistory,
  ReportHistoryChange,
  RoutingControlPlaneReport,
  WebsiteSecurityCheck,
  WebsiteSecurityReport,
} from "./engineering.types.js";

const EXTERNAL_FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ENGINEERING_EHLO = "EHLO netlab.tools\r\n";
const DEFAULT_SMTP_TIMEOUT_MS = 5_000;
const COMMON_DKIM_SELECTORS = [
  "default",
  "google",
  "selector1",
  "selector2",
  "dkim",
  "mail",
  "smtp",
  "k1",
  "s1",
  "s2",
] as const;
const PMTU_MIN_PAYLOAD = 1200;
const PMTU_MAX_PAYLOAD = 1472;
const PMTU_TIMEOUT_MS = 2_000;
const TCP_PROBE_TIMEOUT_MS = 1_500;
const execFileAsync = promisify(execFile);

interface CachedValue<T> {
  expiresAt: number;
  value: T;
}

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

interface SummarySnapshot {
  checkedAt: number;
  summary: Record<string, string>;
}

function shouldPreferCurl(url: string) {
  try {
    return new URL(url).hostname === "stat.ripe.net";
  } catch {
    return false;
  }
}

async function fetchJsonViaCurl<T>(url: string): Promise<T> {
  const { stdout } = await execFileAsync("curl", [
    "-sS",
    "-L",
    "--connect-timeout",
    "5",
    "--max-time",
    String(Math.ceil(EXTERNAL_FETCH_TIMEOUT_MS / 1000)),
    "-H",
    "accept: application/json",
    "-H",
    "user-agent: Netlab Engineering/1.0",
    url,
  ]);

  return JSON.parse(stdout) as T;
}

function normalizeUrlInput(input: string): URL {
  const trimmedInput = input.trim();
  const normalizedInput = trimmedInput.startsWith("http://") || trimmedInput.startsWith("https://")
    ? trimmedInput
    : `https://${trimmedInput}`;
  return new URL(normalizedInput);
}

function normalizeHostnameInput(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    throw new Error("A hostname is required");
  }

  if (trimmedInput.startsWith("http://") || trimmedInput.startsWith("https://")) {
    return new URL(trimmedInput).hostname.toLowerCase();
  }

  return trimmedInput.toLowerCase();
}

function normalizeDomainInput(input: string): string {
  const hostname = normalizeHostnameInput(input);

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) {
    throw new Error("A valid domain is required");
  }

  return hostname.replace(/\.+$/, "");
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

function toSummaryValue(value: unknown): string {
  if (value == null) {
    return "n/a";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildHistory(
  previous: SummarySnapshot | undefined,
  summary: Record<string, unknown>,
): ReportHistory {
  const nextSummary = Object.fromEntries(
    Object.entries(summary).map(([label, value]) => [label, toSummaryValue(value)]),
  );
  const changes: ReportHistoryChange[] = [];

  if (previous) {
    const labels = new Set([...Object.keys(previous.summary), ...Object.keys(nextSummary)]);
    labels.forEach((label) => {
      const before = previous.summary[label] ?? "n/a";
      const after = nextSummary[label] ?? "n/a";

      if (before !== after) {
        changes.push({ label, before, after });
      }
    });
  }

  return {
    previousCheckedAt: previous?.checkedAt ?? null,
    changed: changes.length > 0,
    changes,
  };
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeUnorderedStrings(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

const DNS_RECORD_TYPES = {
  SOA: 6,
  DS: 43,
  DNSKEY: 48,
} as const;

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  if (shouldPreferCurl(url)) {
    return fetchJsonViaCurl<T>(url);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Netlab Engineering/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`External request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    try {
      return await fetchJsonViaCurl<T>(url);
    } catch {
      throw error;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeDnsAnswerName(name: string | undefined) {
  return name?.replace(/\.+$/, "").toLowerCase() || null;
}

class EngineeringService {
  private readonly cache = new Map<string, CachedValue<unknown>>();

  private readonly history = new Map<string, SummarySnapshot>();

  private getCached<T>(key: string): T | null {
    const cachedValue = this.cache.get(key);
    if (!cachedValue) {
      return null;
    }

    if (cachedValue.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return cachedValue.value as T;
  }

  private setCached<T>(key: string, value: T, ttlMs = CACHE_TTL_MS) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private async fetchCachedJson<T>(url: string, ttlMs = CACHE_TTL_MS): Promise<T> {
    const cachedValue = this.getCached<T>(url);
    if (cachedValue) {
      return cachedValue;
    }

    const value = await fetchJsonWithTimeout<T>(url);
    this.setCached(url, value, ttlMs);
    return value;
  }

  private async fetchCachedJsonSafe<T>(url: string, notes: string[], label: string, ttlMs = CACHE_TTL_MS) {
    try {
      return await this.fetchCachedJson<T>(url, ttlMs);
    } catch (error) {
      notes.push(
        `${label} source did not respond cleanly: ${error instanceof Error ? error.message : "unknown error"}.`,
      );
      return null;
    }
  }

  private rememberSummary(kind: string, key: string, summary: Record<string, unknown>) {
    const normalizedKey = `${kind}:${key.toLowerCase()}`;
    const previous = this.history.get(normalizedKey);

    if (previous && previous.checkedAt + HISTORY_TTL_MS <= Date.now()) {
      this.history.delete(normalizedKey);
    }

    const history = buildHistory(previous, summary);
    this.history.set(normalizedKey, {
      checkedAt: Date.now(),
      summary: Object.fromEntries(
        Object.entries(summary).map(([label, value]) => [label, toSummaryValue(value)]),
      ),
    });

    return history;
  }

  private async queryDnsGoogle(name: string, type: string) {
    const encodedName = encodeURIComponent(name);
    const url = `https://dns.google/resolve?name=${encodedName}&type=${encodeURIComponent(type)}&do=1`;
    return this.fetchCachedJson<DnsGoogleResponse>(url);
  }

  private async queryDnsGoogleSafe(name: string, type: string, notes: string[], label: string) {
    try {
      return await this.queryDnsGoogle(name, type);
    } catch (error) {
      notes.push(
        `${label} DNS proof could not be fetched: ${error instanceof Error ? error.message : "unknown error"}.`,
      );
      return null;
    }
  }

  private filterDnsGoogleRecordData(
    response: DnsGoogleResponse | null,
    expectedType: number,
  ) {
    return safeArray(response?.Answer)
      .filter((answer) => answer.type === expectedType)
      .map((answer) => answer.data)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
  }

  private async findZoneApex(domain: string, notes: string[]) {
    let currentDomain = domain;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const soaResponse = await this.queryDnsGoogleSafe(currentDomain, "SOA", notes, "SOA");
      const soaOwner = safeArray(soaResponse?.Answer)
        .find((answer) => answer.type === DNS_RECORD_TYPES.SOA);
      const normalizedOwner = normalizeDnsAnswerName(soaOwner?.name);

      if (normalizedOwner) {
        return normalizedOwner;
      }

      const nextDomain = currentDomain.split(".").slice(1).join(".");
      if (!nextDomain || nextDomain === currentDomain || !nextDomain.includes(".")) {
        break;
      }

      currentDomain = nextDomain;
    }

    notes.push("Zone apex could not be derived from SOA proof, so the input hostname was used directly.");
    return domain;
  }

  private async resolveTxtSafe(name: string) {
    try {
      return flattenTxtRecords(await dns.resolveTxt(name));
    } catch {
      return [];
    }
  }

  private async resolveMxSafe(domain: string) {
    try {
      const records = await dns.resolveMx(domain);
      return records.map(readMxHost).sort((left, right) => left.priority - right.priority);
    } catch {
      return [];
    }
  }

  private async resolveNsSafe(domain: string) {
    try {
      const records = await dns.resolveNs(domain);
      return normalizeUnorderedStrings(
        [...new Set(records.map((record) => record.replace(/\.+$/, "").toLowerCase()))],
      );
    } catch {
      return [];
    }
  }

  private async resolveSoaSafe(domain: string) {
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

  private async resolveCaaSafe(domain: string) {
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

  private async probeTcpAddress(
    address: string,
    ports: number[],
    family: 4 | 6,
  ): Promise<FamilyProbeResult> {
    for (const port of ports) {
      const result = await new Promise<{
        reachable: boolean;
        latencyMs: number | null;
        error: string | null;
      }>((resolve) => {
        const socket = new net.Socket();
        const startedAt = process.hrtime.bigint();
        let settled = false;

        const finish = (payload: {
          reachable: boolean;
          latencyMs: number | null;
          error: string | null;
        }) => {
          if (settled) {
            return;
          }

          settled = true;
          socket.destroy();
          resolve(payload);
        };

        socket.setTimeout(TCP_PROBE_TIMEOUT_MS);
        socket.once("connect", () => {
          const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
          finish({
            reachable: true,
            latencyMs: elapsedMs,
            error: null,
          });
        });
        socket.once("timeout", () => {
          finish({
            reachable: false,
            latencyMs: null,
            error: "Timed out",
          });
        });
        socket.once("error", (error) => {
          finish({
            reachable: false,
            latencyMs: null,
            error: error instanceof Error ? error.message : "TCP probe failed",
          });
        });

        socket.connect({
          host: address,
          port,
          family,
        });
      });

      if (result.reachable) {
        return {
          addresses: [address],
          reachable: true,
          probePort: port,
          latencyMs: result.latencyMs,
          error: null,
        };
      }
    }

    return {
      addresses: [address],
      reachable: false,
      probePort: null,
      latencyMs: null,
      error: "No tested TCP ports accepted a connection",
    };
  }

  private async probeTcpFamily(
    addresses: string[],
    ports: number[],
    family: 4 | 6,
  ): Promise<FamilyProbeResult> {
    if (addresses.length === 0) {
      return {
        addresses: [],
        reachable: false,
        probePort: null,
        latencyMs: null,
        error: family === 4 ? "No A record" : "No AAAA record",
      };
    }

    const probeTargets = addresses.slice(0, 2);
    const settledResults = await Promise.all(
      probeTargets.map((address) => this.probeTcpAddress(address, ports, family)),
    );

    const reachableResult = settledResults.find((result) => result.reachable);
    if (reachableResult) {
      return {
        ...reachableResult,
        addresses,
      };
    }

    const lastError = settledResults
      .map((result, index) => result.error ? `${probeTargets[index]}: ${result.error}` : null)
      .filter((value): value is string => Boolean(value))
      .join(" | ") || "No tested TCP ports accepted a connection";

    return {
      addresses,
      reachable: false,
      probePort: null,
      latencyMs: null,
      error: lastError,
    };
  }

  private async runPathMtuProbe(targetIp: string) {
    const attempts: PathMtuAttempt[] = [];
    let low = PMTU_MIN_PAYLOAD;
    let high = PMTU_MAX_PAYLOAD;
    let best: number | null = null;
    const notes: string[] = [];

    const runPing = async (payloadSize: number) => {
      const isDarwin = process.platform === "darwin";
      const args = isDarwin
        ? ["-D", "-c", "1", "-W", String(PMTU_TIMEOUT_MS), "-t", "2", "-s", String(payloadSize), targetIp]
        : ["-M", "do", "-c", "1", "-W", "2", "-s", String(payloadSize), targetIp];

      return new Promise<PathMtuAttempt>((resolve) => {
        const processHandle = spawn("ping", args, { shell: false });
        let stderr = "";
        let stdout = "";
        let settled = false;
        const timeoutId = setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          processHandle.kill("SIGTERM");
          resolve({
            payloadSize,
            success: false,
            error: "Timed out",
          });
        }, PMTU_TIMEOUT_MS + 1_000);

        processHandle.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        processHandle.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        processHandle.on("error", (error) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeoutId);
          resolve({
            payloadSize,
            success: false,
            error: error instanceof Error ? error.message : "Ping command failed",
          });
        });
        processHandle.on("close", (code) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeoutId);
          resolve({
            payloadSize,
            success: code === 0,
            error: code === 0 ? null : (stderr.trim() || stdout.trim() || "Path MTU probe failed"),
          });
        });
      });
    };

    while (low <= high) {
      const midpoint = Math.floor((low + high) / 2);
      const attempt = await runPing(midpoint);
      attempts.push(attempt);

      if (attempt.success) {
        best = midpoint;
        low = midpoint + 1;
      } else {
        high = midpoint - 1;
      }
    }

    if (best == null) {
      notes.push("The probe did not find a successful DF packet inside the tested payload range.");
    } else {
      notes.push("Estimated MTU adds the IPv4 and ICMP overhead to the largest successful payload.");
    }

    return {
      maxPayloadSize: best,
      estimatedPathMtu: best == null ? null : best + 28,
      attempts,
      notes,
    };
  }

  private async probeSecurityTxt(hostname: string) {
    const candidates = [
      `https://${hostname}/.well-known/security.txt`,
      `https://${hostname}/security.txt`,
    ];

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          headers: {
            accept: "text/plain",
            "user-agent": "Netlab Security/1.0",
          },
          signal: AbortSignal.timeout(5_000),
        });

        if (response.ok) {
          return {
            found: true,
            url,
          };
        }
      } catch {
        continue;
      }
    }

    return {
      found: false,
      url: null,
    };
  }

  private gradeFromScore(score: number) {
    if (score >= 90) {
      return "A";
    }

    if (score >= 80) {
      return "B";
    }

    if (score >= 70) {
      return "C";
    }

    if (score >= 60) {
      return "D";
    }

    return "F";
  }

  async getRoutingReport(input: string): Promise<RoutingControlPlaneReport> {
    const target = await resolvePublicTarget(input, "Routing target");
    const targetIp = target.resolvedTarget;
    const notes: string[] = [];

    const [networkInfoPayload, prefixOverviewPayload, routingStatusPayload, geo] = await Promise.all([
      this.fetchCachedJsonSafe<any>(
        `https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(targetIp)}`,
        notes,
        "Network-info",
      ),
      this.fetchCachedJsonSafe<any>(
        `https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(targetIp)}`,
        notes,
        "Prefix-overview",
      ),
      this.fetchCachedJsonSafe<any>(
        `https://stat.ripe.net/data/routing-status/data.json?resource=${encodeURIComponent(targetIp)}`,
        notes,
        "Routing-status",
      ),
      ipInfoService.getIPInfo(targetIp),
    ]);

    const prefix = prefixOverviewPayload?.data?.resource
      ?? networkInfoPayload?.data?.prefix
      ?? null;
    const originAsn = routingStatusPayload?.data?.origins?.[0]?.origin != null
      ? String(routingStatusPayload.data.origins[0].origin)
      : (networkInfoPayload?.data?.asns?.[0] != null
        ? String(networkInfoPayload.data.asns[0])
        : null);
    const originHolder = prefixOverviewPayload?.data?.asns?.[0]?.holder ?? null;
    const rpkiValidationPayload = prefix && originAsn
      ? await this.fetchCachedJsonSafe<any>(
        `https://stat.ripe.net/data/rpki-validation/data.json?resource=${encodeURIComponent(originAsn)}&prefix=${encodeURIComponent(prefix)}`,
        notes,
        "RPKI validation",
      )
      : null;

    notes.push(...safeArray<string>(routingStatusPayload?.messages?.map((item: unknown) => {
      if (!Array.isArray(item) || typeof item[1] !== "string") {
        return null;
      }

      return item[1];
    }).filter(Boolean)));

    const history = this.rememberSummary("routing", input, {
      Prefix: prefix,
      "Origin ASN": originAsn,
      "RPKI status": rpkiValidationPayload?.data?.status ?? "unknown",
      "IPv4 visibility": routingStatusPayload?.data?.visibility?.v4?.ris_peers_seeing ?? "n/a",
      "IPv6 visibility": routingStatusPayload?.data?.visibility?.v6?.ris_peers_seeing ?? "n/a",
    });

    return {
      input,
      targetIp,
      resolvedAddresses: target.addresses,
      resolvedFromHostname: target.resolvedFromHostname,
      prefix,
      originAsn,
      originHolder,
      rpkiStatus: rpkiValidationPayload?.data?.status ?? null,
      validatingRoas: safeArray<any>(rpkiValidationPayload?.data?.validating_roas).map((roa) => ({
        origin: String(roa.origin),
        prefix: String(roa.prefix),
        validity: String(roa.validity),
        maxLength: typeof roa.max_length === "number" ? roa.max_length : null,
      })),
      visibility: {
        ipv4RisPeersSeeing: routingStatusPayload?.data?.visibility?.v4?.ris_peers_seeing ?? null,
        ipv4RisPeersTotal: routingStatusPayload?.data?.visibility?.v4?.total_ris_peers ?? null,
        ipv6RisPeersSeeing: routingStatusPayload?.data?.visibility?.v6?.ris_peers_seeing ?? null,
        ipv6RisPeersTotal: routingStatusPayload?.data?.visibility?.v6?.total_ris_peers ?? null,
      },
      firstSeen: routingStatusPayload?.data?.first_seen?.time ?? null,
      lastSeen: routingStatusPayload?.data?.last_seen?.time ?? null,
      lessSpecifics: safeArray<any>(routingStatusPayload?.data?.less_specifics).map((item) => ({
        prefix: String(item.prefix),
        origin: typeof item.origin === "number" ? item.origin : null,
      })),
      moreSpecifics: safeArray<any>(routingStatusPayload?.data?.more_specifics).map((item) => ({
        prefix: String(item.prefix),
        origin: typeof item.origin === "number" ? item.origin : null,
      })),
      registryBlock: {
        resource: prefixOverviewPayload?.data?.block?.resource ?? null,
        name: prefixOverviewPayload?.data?.block?.name ?? null,
        description: prefixOverviewPayload?.data?.block?.desc ?? null,
      },
      geo,
      notes,
      checkedAt: Date.now(),
      history,
    };
  }

  async getDnsAuthorityReport(input: string): Promise<DnsAuthorityReport> {
    const domain = normalizeDomainInput(input);
    const notes: string[] = [];
    const zoneApex = await this.findZoneApex(domain, notes);
    const [nameservers, soa, caaRecords, dsResponse, dnskeyResponse] = await Promise.all([
      this.resolveNsSafe(zoneApex),
      this.resolveSoaSafe(zoneApex),
      this.resolveCaaSafe(zoneApex),
      this.queryDnsGoogleSafe(zoneApex, "DS", notes, "DS"),
      this.queryDnsGoogleSafe(zoneApex, "DNSKEY", notes, "DNSKEY"),
    ]);

    const dsRecords = this.filterDnsGoogleRecordData(dsResponse, DNS_RECORD_TYPES.DS);
    const dnskeyRecords = this.filterDnsGoogleRecordData(dnskeyResponse, DNS_RECORD_TYPES.DNSKEY);
    const dnssecEnabled = dsRecords.length > 0 && dnskeyRecords.length > 0;
    const dnssecValidated = dnssecEnabled && Boolean(dsResponse?.AD && dnskeyResponse?.AD);
    const findings: DnsAuthorityReport["findings"] = [];

    if (zoneApex !== domain) {
      findings.push({
        status: "info",
        title: "The input is below the authoritative zone apex.",
        detail: `Authority checks were normalized from ${domain} to zone apex ${zoneApex}.`,
      });
    }

    if (nameservers.length >= 2) {
      findings.push({
        status: "pass",
        title: "Multiple authoritative nameservers are published.",
        detail: "The zone exposes at least two NS records, which is the minimum healthy redundancy baseline.",
      });
    } else if (nameservers.length === 1) {
      findings.push({
        status: "warn",
        title: "Only one authoritative nameserver is published.",
        detail: "Single-NS delegation reduces resilience during outages or maintenance.",
      });
    } else {
      findings.push({
        status: "warn",
        title: "No NS records were returned.",
        detail: "The zone delegation looks incomplete from this vantage point.",
      });
    }

    if (!soa) {
      findings.push({
        status: "warn",
        title: "SOA data was not returned.",
        detail: "The zone did not expose a readable SOA record during this check.",
      });
    } else {
      findings.push({
        status: "pass",
        title: "SOA record is present.",
        detail: `Serial ${soa.serial ?? "n/a"} was returned with primary NS ${soa.nsname ?? "unknown"}.`,
      });
    }

    if (dnssecEnabled && dnssecValidated) {
      findings.push({
        status: "pass",
        title: "DNSSEC chain looks published and validated.",
        detail: "DS and DNSKEY records were both returned and the validating resolver marked the response authenticated.",
      });
    } else if (dsRecords.length > 0 && dnskeyRecords.length === 0) {
      findings.push({
        status: "warn",
        title: "DS exists but DNSKEY did not return.",
        detail: "This can indicate a broken DNSSEC chain or missing child signing material.",
      });
    } else if (dsRecords.length === 0 && dnskeyRecords.length > 0) {
      findings.push({
        status: "warn",
        title: "DNSKEY exists without parent DS.",
        detail: "The zone looks signed locally but not fully delegated through the parent.",
      });
    } else {
      findings.push({
        status: "info",
        title: "The zone is effectively unsigned.",
        detail: "No DS or DNSKEY records were found from this vantage point.",
      });
    }

    if (caaRecords.length > 0) {
      findings.push({
        status: "pass",
        title: "CAA records are published.",
        detail: "Certificate issuance is constrained by explicit CAA policy.",
      });
    } else {
      findings.push({
        status: "info",
        title: "CAA records are not published.",
        detail: "Lack of CAA is common, but it removes one certificate issuance control.",
      });
    }

    const history = this.rememberSummary("authority", domain, {
      "Zone apex": zoneApex,
      Nameservers: normalizeUnorderedStrings(nameservers).join(", ") || "none",
      DNSSEC: dnssecEnabled ? "enabled" : "unsigned",
      "CAA records": caaRecords.length,
      "SOA serial": soa?.serial ?? "n/a",
    });

    return {
      domain,
      zoneApex,
      nameservers,
      soa,
      caaRecords,
      dnssec: {
        enabled: dnssecEnabled,
        validated: dnssecValidated,
        dsRecords,
        dnskeyRecords,
      },
      delegationStatus: dnssecEnabled ? "healthy" : (nameservers.length > 0 ? "unsigned" : "warning"),
      findings,
      checkedAt: Date.now(),
      history,
    };
  }

  async getIpParityReport(input: string): Promise<IpParityReport> {
    const domain = normalizeDomainInput(input);
    const [ipv4Addresses, ipv6Addresses] = await Promise.all([
      dns.resolve4(domain).catch(() => [] as string[]),
      dns.resolve6(domain).catch(() => [] as string[]),
    ]);

    const [ipv4Probe, ipv6Probe] = await Promise.all([
      this.probeTcpFamily(ipv4Addresses, [443, 80], 4),
      this.probeTcpFamily(ipv6Addresses, [443, 80], 6),
    ]);

    let status: IpParityReport["status"] = "unreachable";
    if (ipv4Addresses.length > 0 && ipv6Addresses.length > 0) {
      status = ipv4Probe.reachable === ipv6Probe.reachable ? "balanced" : "mismatch";
    } else if (ipv4Addresses.length > 0) {
      status = "ipv4-only";
    } else if (ipv6Addresses.length > 0) {
      status = "ipv6-only";
    }

    const findings: IpParityReport["findings"] = [];

    if (status === "balanced" && ipv4Probe.reachable && ipv6Probe.reachable) {
      findings.push({
        status: "pass",
        title: "IPv4 and IPv6 both resolved and accepted a TCP probe.",
        detail: "The service looks dual-stack reachable from this vantage point.",
      });
    }

    if (status === "ipv4-only") {
      findings.push({
        status: "warn",
        title: "Only IPv4 records were published.",
        detail: "There is no AAAA record to compare against, so IPv6 clients cannot follow the same path.",
      });
    }

    if (status === "ipv6-only") {
      findings.push({
        status: "warn",
        title: "Only IPv6 records were published.",
        detail: "There is no IPv4 fallback, which may be intentional but narrows reachability.",
      });
    }

    if (status === "mismatch") {
      findings.push({
        status: "warn",
        title: "IPv4 and IPv6 do not behave the same way.",
        detail: "One family resolved but did not accept the same TCP probe, which is a common dual-stack drift pattern.",
      });
    }

    if (!ipv4Probe.reachable && !ipv6Probe.reachable) {
      findings.push({
        status: "info",
        title: "Neither family accepted the tested TCP probes.",
        detail: "This may still be expected if the service does not listen on 80 or 443.",
      });
    }

    const history = this.rememberSummary("parity", domain, {
      Status: status,
      "IPv4 addresses": ipv4Addresses.length,
      "IPv6 addresses": ipv6Addresses.length,
      "IPv4 reachable": ipv4Probe.reachable,
      "IPv6 reachable": ipv6Probe.reachable,
    });

    return {
      domain,
      ipv4: ipv4Probe,
      ipv6: ipv6Probe,
      status,
      findings,
      checkedAt: Date.now(),
      history,
    };
  }

  async getPathMtuReport(input: string): Promise<PathMtuReport> {
    const target = await resolvePublicTarget(input, "Path MTU target");
    const ipv4Target = target.addresses.find((address) => net.isIP(address) === 4);

    if (!ipv4Target) {
      throw new Error("Path MTU probing currently requires an IPv4-reachable target");
    }

    const result = await this.runPathMtuProbe(ipv4Target);
    const history = this.rememberSummary("pmtu", input, {
      "Max payload": result.maxPayloadSize ?? "n/a",
      "Estimated MTU": result.estimatedPathMtu ?? "n/a",
    });

    return {
      input,
      targetIp: ipv4Target,
      ...result,
      checkedAt: Date.now(),
      history,
    };
  }

  async getWebsiteSecurityReport(input: string): Promise<WebsiteSecurityReport> {
    const url = normalizeUrlInput(input);
    const hostname = url.hostname.toLowerCase();
    const [httpInspection, authority, securityTxt] = await Promise.all([
      httpInspectorService.inspect(input),
      this.getDnsAuthorityReport(hostname),
      this.probeSecurityTxt(hostname),
    ]);

    const headers = httpInspection.responseHeaders;
    const headerChecks: Array<[boolean, string, string, string]> = [
      [Boolean(headers["content-security-policy"]), "CSP", "pass", "Content-Security-Policy is present."],
      [Boolean(headers["x-frame-options"]) || Boolean(headers["content-security-policy"]?.includes("frame-ancestors")), "Frame protection", "pass", "Clickjacking protection is present."],
      [headers["x-content-type-options"] === "nosniff", "nosniff", "pass", "X-Content-Type-Options is set to nosniff."],
      [Boolean(headers["referrer-policy"]), "Referrer policy", "pass", "Referrer-Policy is present."],
      [Boolean(headers["permissions-policy"]), "Permissions policy", "pass", "Permissions-Policy is present."],
    ];

    const checks: WebsiteSecurityCheck[] = [];
    let score = 100;

    if (httpInspection.protocol !== "https:") {
      score -= 20;
      checks.push({
        status: "fail",
        title: "The final response is not HTTPS.",
        detail: "The request landed on plain HTTP, so TLS protections are not being enforced at the edge.",
      });
    }

    if (httpInspection.tlsAuthorized === false) {
      score -= 20;
      checks.push({
        status: "fail",
        title: "The certificate chain did not verify cleanly.",
        detail: httpInspection.tlsAuthorizationError || "The TLS handshake completed but the certificate did not validate.",
      });
    }

    if (httpInspection.hsts) {
      checks.push({
        status: "pass",
        title: "HSTS is enabled.",
        detail: "The response includes Strict-Transport-Security.",
      });
    } else {
      score -= 8;
      checks.push({
        status: "warn",
        title: "HSTS is missing.",
        detail: "Browsers may still attempt HTTP before upgrading unless another policy forces HTTPS.",
      });
    }

    for (const [passed, title, passStatus, passDetail] of headerChecks) {
      if (passed) {
        checks.push({
          status: passStatus as "pass",
          title,
          detail: passDetail,
        });
      } else {
        score -= 6;
        checks.push({
          status: "warn",
          title: `${title} is missing.`,
          detail: `${title} is not visible in the final response headers.`,
        });
      }
    }

    if (authority.dnssec.enabled) {
      checks.push({
        status: "pass",
        title: "DNSSEC is published.",
        detail: "The hostname's zone exposes DS and DNSKEY material.",
      });
    } else {
      score -= 7;
      checks.push({
        status: "warn",
        title: "DNSSEC is not active.",
        detail: "No validated DS and DNSKEY chain was found for this hostname's zone.",
      });
    }

    if (authority.caaRecords.length > 0) {
      checks.push({
        status: "pass",
        title: "CAA records are published.",
        detail: "Certificate issuance is constrained by explicit CAA policy.",
      });
    } else {
      score -= 5;
      checks.push({
        status: "warn",
        title: "CAA records are missing.",
        detail: "No certificate authority authorization policy was found.",
      });
    }

    if (securityTxt.found) {
      checks.push({
        status: "pass",
        title: "security.txt is published.",
        detail: `A disclosure policy was found at ${securityTxt.url}.`,
      });
    } else {
      score -= 4;
      checks.push({
        status: "warn",
        title: "security.txt was not found.",
        detail: "The site does not expose a standard security contact file at the common paths.",
      });
    }

    if (
      typeof httpInspection.certificate?.expiresInDays === "number"
      && httpInspection.certificate.expiresInDays >= 0
      && httpInspection.certificate.expiresInDays <= 30
    ) {
      score -= 8;
      checks.push({
        status: "warn",
        title: "Certificate expiry is close.",
        detail: `The certificate expires in ${httpInspection.certificate.expiresInDays} days.`,
      });
    }

    score = Math.max(0, score);
    const history = this.rememberSummary("website", hostname, {
      Score: score,
      Grade: this.gradeFromScore(score),
      "TLS version": httpInspection.tlsVersion ?? "n/a",
      HSTS: Boolean(httpInspection.hsts),
      CSP: Boolean(headers["content-security-policy"]),
      DNSSEC: authority.dnssec.enabled,
      "security.txt": securityTxt.found,
    });

    return {
      input,
      hostname,
      zoneApex: authority.zoneApex,
      finalUrl: httpInspection.finalUrl,
      score,
      grade: this.gradeFromScore(score),
      checks,
      keyHeaders: {
        "content-security-policy": headers["content-security-policy"] || null,
        "x-frame-options": headers["x-frame-options"] || null,
        "x-content-type-options": headers["x-content-type-options"] || null,
        "referrer-policy": headers["referrer-policy"] || null,
        "permissions-policy": headers["permissions-policy"] || null,
        "strict-transport-security": headers["strict-transport-security"] || null,
      },
      dnssecEnabled: authority.dnssec.enabled,
      caaPresent: authority.caaRecords.length > 0,
      securityTxt,
      tlsVersion: httpInspection.tlsVersion,
      certificateExpiresInDays: httpInspection.certificate?.expiresInDays ?? null,
      checkedAt: Date.now(),
      history,
    };
  }

  private async probeStartTls(host: string) {
    return new Promise<EmailSecurityReport["startTls"][number]>((resolve) => {
      const socket = net.createConnection({ host, port: 25 });
      let stage: "greeting" | "ehlo" | "starttls" = "greeting";
      let buffer = "";
      const ehloLines: string[] = [];
      let settled = false;

      const finish = (
        payload: EmailSecurityReport["startTls"][number],
      ) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();
        resolve(payload);
      };

      const timeoutId = setTimeout(() => {
        finish({
          host,
          supportsStartTls: false,
          tlsVersion: null,
          tlsAuthorized: null,
          tlsAuthorizationError: null,
          error: "SMTP probe timed out",
        });
      }, DEFAULT_SMTP_TIMEOUT_MS);

      const handleLine = (line: string) => {
        if (stage === "greeting" && /^220\b/.test(line)) {
          stage = "ehlo";
          socket.write(DEFAULT_ENGINEERING_EHLO);
          return;
        }

        if (stage === "ehlo" && /^250[\s-]/.test(line)) {
          ehloLines.push(line);

          if (line.startsWith("250 ")) {
            if (!ehloLines.some((ehloLine) => /STARTTLS/i.test(ehloLine))) {
              clearTimeout(timeoutId);
              finish({
                host,
                supportsStartTls: false,
                tlsVersion: null,
                tlsAuthorized: null,
                tlsAuthorizationError: null,
                error: null,
              });
              return;
            }

            stage = "starttls";
            socket.write("STARTTLS\r\n");
          }

          return;
        }

        if (stage === "starttls" && /^220\b/.test(line)) {
          socket.removeAllListeners("data");

          const tlsSocket = tls.connect({
            socket,
            servername: host,
            rejectUnauthorized: false,
          });

          tlsSocket.once("secureConnect", () => {
            clearTimeout(timeoutId);
            finish({
              host,
              supportsStartTls: true,
              tlsVersion: tlsSocket.getProtocol() || null,
              tlsAuthorized: tlsSocket.authorized,
              tlsAuthorizationError: tlsSocket.authorizationError
                ? String(tlsSocket.authorizationError)
                : null,
              error: null,
            });
            tlsSocket.end();
          });

          tlsSocket.once("error", (error) => {
            clearTimeout(timeoutId);
            finish({
              host,
              supportsStartTls: true,
              tlsVersion: null,
              tlsAuthorized: null,
              tlsAuthorizationError: null,
              error: error instanceof Error ? error.message : "TLS upgrade failed",
            });
          });

          return;
        }

        if (/^[45]\d\d\b/.test(line)) {
          clearTimeout(timeoutId);
          finish({
            host,
            supportsStartTls: false,
            tlsVersion: null,
            tlsAuthorized: null,
            tlsAuthorizationError: null,
            error: line,
          });
        }
      };

      socket.on("data", (chunk) => {
        buffer += chunk.toString();

        while (buffer.includes("\n")) {
          const newlineIndex = buffer.indexOf("\n");
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line) {
            handleLine(line);
          }
        }
      });

      socket.once("error", (error) => {
        clearTimeout(timeoutId);
        finish({
          host,
          supportsStartTls: false,
          tlsVersion: null,
          tlsAuthorized: null,
          tlsAuthorizationError: null,
          error: error instanceof Error ? error.message : "SMTP probe failed",
        });
      });
    });
  }

  async getEmailSecurityReport(input: string): Promise<EmailSecurityReport> {
    const domain = normalizeDomainInput(input);
    const [mxRecords, domainTxt, dmarcTxt, mtaStsTxt, tlsRptTxt] = await Promise.all([
      this.resolveMxSafe(domain),
      this.resolveTxtSafe(domain),
      this.resolveTxtSafe(`_dmarc.${domain}`),
      this.resolveTxtSafe(`_mta-sts.${domain}`),
      this.resolveTxtSafe(`_smtp._tls.${domain}`),
    ]);

    const spfRecord = domainTxt.find((record) => /^v=spf1\b/i.test(record)) || null;
    const dmarcRecord = dmarcTxt.find((record) => /^v=DMARC1\b/i.test(record)) || null;
    const dmarcPolicy = dmarcRecord?.match(/(?:^|;\s*)p=([^;]+)/i)?.[1] ?? null;
    const mtaStsRecord = mtaStsTxt.find((record) => /^v=STSv1\b/i.test(record)) || null;
    const tlsRptRecord = tlsRptTxt.find((record) => /^v=TLSRPTv1\b/i.test(record)) || null;

    const dkimResults = await Promise.all(
      COMMON_DKIM_SELECTORS.map(async (selector) => {
        const records = await this.resolveTxtSafe(`${selector}._domainkey.${domain}`);
        return records.some((record) => /v=DKIM1|k=rsa|k=ed25519/i.test(record))
          ? selector
          : null;
      }),
    );
    const foundSelectors = dkimResults.filter(
      (selector): selector is (typeof COMMON_DKIM_SELECTORS)[number] => selector !== null,
    );

    const startTls = await Promise.all(
      mxRecords.slice(0, 3).map((mxRecord) => this.probeStartTls(mxRecord.exchange)),
    );

    let mtaStsPolicyFound = false;
    if (mtaStsRecord) {
      try {
        const response = await fetch(`https://mta-sts.${domain}/.well-known/mta-sts.txt`, {
          headers: {
            accept: "text/plain",
            "user-agent": "Netlab Mail/1.0",
          },
          signal: AbortSignal.timeout(5_000),
        });
        mtaStsPolicyFound = response.ok;
      } catch {
        mtaStsPolicyFound = false;
      }
    }

    const checks: EmailSecurityReport["checks"] = [];
    let score = 0;

    if (mxRecords.length > 0) {
      score += 20;
      checks.push({
        status: "pass",
        title: "MX records are published.",
        detail: `${mxRecords.length} MX endpoints were returned for the domain.`,
      });
    } else {
      checks.push({
        status: "fail",
        title: "MX records are missing.",
        detail: "The domain does not advertise mail exchangers in DNS.",
      });
    }

    if (spfRecord) {
      score += 15;
      checks.push({
        status: "pass",
        title: "SPF is published.",
        detail: "A TXT record starting with v=spf1 was found on the domain apex.",
      });
    } else {
      checks.push({
        status: "warn",
        title: "SPF is missing.",
        detail: "No SPF policy was found on the domain apex.",
      });
    }

    if (dmarcRecord) {
      score += dmarcPolicy && dmarcPolicy !== "none" ? 20 : 12;
      checks.push({
        status: dmarcPolicy && dmarcPolicy !== "none" ? "pass" : "warn",
        title: "DMARC is published.",
        detail: dmarcPolicy
          ? `The domain publishes DMARC with policy ${dmarcPolicy}.`
          : "A DMARC record is present, but the policy could not be parsed.",
      });
    } else {
      checks.push({
        status: "warn",
        title: "DMARC is missing.",
        detail: "No _dmarc TXT record was found.",
      });
    }

    if (foundSelectors.length > 0) {
      score += 10;
      checks.push({
        status: "pass",
        title: "A common DKIM selector responded.",
        detail: `Selector probe found ${foundSelectors.join(", ")}. This is heuristic, not full selector discovery.`,
      });
    } else {
      checks.push({
        status: "warn",
        title: "No common DKIM selectors responded.",
        detail: "DKIM may still exist under non-standard selectors, but the common selector probe found nothing.",
      });
    }

    const startTlsSupportedCount = startTls.filter((result) => result.supportsStartTls).length;
    if (startTlsSupportedCount > 0) {
      score += 15;
      checks.push({
        status: "pass",
        title: "At least one MX host supports STARTTLS.",
        detail: `${startTlsSupportedCount} of ${startTls.length} checked MX endpoints advertised STARTTLS.`,
      });
    } else if (startTls.length > 0) {
      checks.push({
        status: "warn",
        title: "Checked MX hosts did not advertise STARTTLS.",
        detail: "Mail transport encryption appears absent from the probed MX endpoints.",
      });
    }

    if (mtaStsRecord) {
      score += mtaStsPolicyFound ? 10 : 5;
      checks.push({
        status: mtaStsPolicyFound ? "pass" : "warn",
        title: "MTA-STS is published.",
        detail: mtaStsPolicyFound
          ? "The DNS record and policy file were both reachable."
          : "The DNS record exists, but the policy file was not confirmed.",
      });
    } else {
      checks.push({
        status: "info",
        title: "MTA-STS is not published.",
        detail: "No _mta-sts TXT record was found.",
      });
    }

    if (tlsRptRecord) {
      score += 5;
      checks.push({
        status: "pass",
        title: "TLS-RPT is published.",
        detail: "The domain advertises SMTP TLS reporting.",
      });
    } else {
      checks.push({
        status: "info",
        title: "TLS-RPT is not published.",
        detail: "No _smtp._tls TXT record was found.",
      });
    }

    score = Math.max(0, Math.min(100, score));
    const history = this.rememberSummary("email", domain, {
      Score: score,
      MX: mxRecords.length,
      SPF: Boolean(spfRecord),
      DMARC: dmarcPolicy ?? Boolean(dmarcRecord),
      DKIM: foundSelectors.length,
      STARTTLS: startTlsSupportedCount,
      "MTA-STS": Boolean(mtaStsRecord),
      "TLS-RPT": Boolean(tlsRptRecord),
    });

    return {
      domain,
      score,
      grade: this.gradeFromScore(score),
      mxRecords,
      spf: {
        present: Boolean(spfRecord),
        record: spfRecord,
      },
      dmarc: {
        present: Boolean(dmarcRecord),
        record: dmarcRecord,
        policy: dmarcPolicy,
      },
      dkim: {
        foundSelectors,
        checkedSelectors: [...COMMON_DKIM_SELECTORS],
      },
      startTls,
      mtaSts: {
        dnsRecord: mtaStsRecord,
        policyFound: mtaStsPolicyFound,
      },
      tlsRpt: {
        present: Boolean(tlsRptRecord),
        record: tlsRptRecord,
      },
      checks,
      checkedAt: Date.now(),
      history,
    };
  }
}

export const engineeringService = new EngineeringService();
