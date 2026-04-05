import dns from "node:dns/promises";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runtimeConfig } from "../../../../config/runtime.js";
import { getRuntimeResourceSnapshot } from "../../../../config/system-resources.js";
import type {
  PacketCaptureExpertFinding,
  PacketCaptureFlow,
  PacketCaptureProtocolStat,
  PacketCaptureReport,
} from "../../engineering.types.js";

interface ServiceBindingAnswer {
  Answer?: Array<{
    data?: string;
  }>;
}

export interface ServiceBindingRecord {
  recordType: "HTTPS" | "SVCB";
  priority: number;
  targetName: string;
  alpns: string[];
  ipv4Hints: string[];
  ipv6Hints: string[];
  port: number | null;
  ech: boolean;
  raw: string;
}

export interface ServiceBindingLookupResult {
  records: ServiceBindingRecord[];
  source: "dig" | "doh" | "none";
  notes: string[];
}

export interface HttpProtocolProbeResult {
  protocol: "http2" | "http3";
  available: boolean;
  attempted: boolean;
  binary: string | null;
  succeeded: boolean | null;
  statusCode: number | null;
  httpVersion: string | null;
  remoteIp: string | null;
  connectMs: number | null;
  tlsHandshakeMs: number | null;
  ttfbMs: number | null;
  detail: string;
}

export interface Nat64DetectionResult {
  detected: boolean;
  prefix: string | null;
  evidence: string[];
}

export interface PacketCaptureUploadDescriptor {
  filename: string;
  sizeBytes: number;
  detectedFormat: "pcap" | "pcapng";
  extension: string;
}

export interface PacketCaptureCapacitySnapshot {
  resourceBasis: "cgroup" | "host";
  cpuMetricSource: "cgroup" | "loadavg";
  memoryMetricSource: "cgroup" | "host";
  effectiveCpuLimit: number;
  cpuUtilizationPercent: number;
  loadAverage1m: number;
  memoryUtilizationPercent: number;
  memoryHeadroomMb: number;
  rssMb: number;
  activeAnalyses: number;
  maxConcurrentAnalyses: number;
  activeForRequester: number;
  maxConcurrentPerRequester: number;
}

export interface PacketCaptureCapacityStatus {
  acceptedExtensions: string[];
  maxFileBytes: number;
  available: boolean;
  admissionMode: "strict" | "best-effort";
  reason: string | null;
  advisories: string[];
  retryable: boolean;
  retryAfterSeconds: number | null;
  snapshot: PacketCaptureCapacitySnapshot;
  thresholds: {
    maxCpuUtilizationPercent: number;
    minMemoryHeadroomMb: number;
    maxMemoryUtilizationPercent: number;
  };
}

export class PacketCaptureValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "INVALID_PACKET_CAPTURE_REQUEST";

  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "PacketCaptureValidationError";
  }
}

export class PacketCaptureCapacityError extends Error {
  readonly code = "PACKET_CAPTURE_CAPACITY_REACHED";

  constructor(
    message: string,
    public readonly statusCode = 503,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "PacketCaptureCapacityError";
  }
}

interface CommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

const MAX_PACKET_CAPTURE_BYTES = 12 * 1024 * 1024;
const ACCEPTED_CAPTURE_EXTENSIONS = [".pcap", ".pcapng"];
const PCAP_MAGIC_HEADERS = new Set([
  "d4c3b2a1",
  "a1b2c3d4",
  "4d3cb2a1",
  "a1b23c4d",
]);
const PCAPNG_MAGIC_HEADER = "0a0d0d0a";

function runCommand(
  command: string,
  args: string[],
  options?: { timeoutMs?: number },
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutId = options?.timeoutMs
      ? setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        child.kill("SIGTERM");
        reject(new Error(`${command} timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve({
        stdout,
        stderr,
        code,
      });
    });
  });
}

function parseCapinfosValue(output: string, label: string) {
  const pattern = new RegExp(`^${label}:\\s+(.+)$`, "mi");
  return output.match(pattern)?.[1]?.trim() ?? null;
}

function detectCaptureFormat(buffer: Buffer) {
  if (buffer.length < 4) {
    return null;
  }

  const magic = buffer.subarray(0, 4).toString("hex").toLowerCase();
  if (PCAP_MAGIC_HEADERS.has(magic)) {
    return "pcap" as const;
  }

  if (magic === PCAPNG_MAGIC_HEADER) {
    return "pcapng" as const;
  }

  return null;
}

export function inspectPacketCaptureUpload(
  buffer: Buffer,
  filename: string,
  maxBytes = MAX_PACKET_CAPTURE_BYTES,
): PacketCaptureUploadDescriptor {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new PacketCaptureValidationError("Packet capture upload is required.");
  }

  if (buffer.length > maxBytes) {
    throw new PacketCaptureValidationError(
      `Packet capture exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB analysis limit.`,
      {
        maxFileBytes: maxBytes,
      },
    );
  }

  const safeFilename = path.basename(filename || "capture.pcapng");
  const extension = path.extname(safeFilename).toLowerCase();
  if (extension && !ACCEPTED_CAPTURE_EXTENSIONS.includes(extension)) {
    throw new PacketCaptureValidationError(
      "Only .pcap and .pcapng uploads are accepted.",
      {
        acceptedExtensions: ACCEPTED_CAPTURE_EXTENSIONS,
      },
    );
  }

  const detectedFormat = detectCaptureFormat(buffer);
  if (!detectedFormat) {
    throw new PacketCaptureValidationError(
      "Upload does not look like a valid PCAP or PCAPNG file.",
      {
        acceptedExtensions: ACCEPTED_CAPTURE_EXTENSIONS,
      },
    );
  }

  return {
    filename: safeFilename,
    sizeBytes: buffer.length,
    detectedFormat,
    extension: extension || `.${detectedFormat}`,
  };
}

function parseCapinfosInteger(output: string, label: string) {
  const raw = parseCapinfosValue(output, label);
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/,/g, "").match(/-?\d+/)?.[0];
  return normalized ? Number.parseInt(normalized, 10) : null;
}

function splitTsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return [] as Array<Record<string, string>>;
  }

  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const parts = line.split("\t");
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = parts[index] ?? "";
      return acc;
    }, {});
  });
}

function shouldCountProtocol(protocol: string) {
  return ![
    "frame",
    "eth",
    "ethertype",
    "data",
    "sll",
    "linux-sll",
  ].includes(protocol);
}

function classifyExpertSeverity(value: string) {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("malformed")
    || normalized.includes("violation")
    || normalized.includes("failed")
    || normalized.includes("reset")
  ) {
    return "error" as const;
  }

  if (
    normalized.includes("retransmission")
    || normalized.includes("duplicate ack")
    || normalized.includes("zero window")
    || normalized.includes("warning")
  ) {
    return "warn" as const;
  }

  return "info" as const;
}

function dnsTypeLabel(value: string) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric)) {
    return value || "unknown";
  }

  const labels: Record<number, string> = {
    1: "A",
    2: "NS",
    5: "CNAME",
    6: "SOA",
    12: "PTR",
    15: "MX",
    16: "TXT",
    28: "AAAA",
    33: "SRV",
    43: "DS",
    48: "DNSKEY",
    65: "HTTPS",
    64: "SVCB",
  };

  return labels[numeric] ?? value;
}

function dnsRcodeLabel(value: string) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric)) {
    return value || "UNKNOWN";
  }

  const labels: Record<number, string> = {
    0: "NOERROR",
    1: "FORMERR",
    2: "SERVFAIL",
    3: "NXDOMAIN",
    4: "NOTIMP",
    5: "REFUSED",
  };

  return labels[numeric] ?? value;
}

function parseSvcbRecordData(
  data: string,
  recordType: "HTTPS" | "SVCB",
): ServiceBindingRecord | null {
  const tokens = data.trim().split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }

  const priority = Number.parseInt(tokens[0], 10);
  if (Number.isNaN(priority)) {
    return null;
  }

  const params = tokens.slice(2);
  const record: ServiceBindingRecord = {
    recordType,
    priority,
    targetName: tokens[1] === "." ? "." : tokens[1].replace(/\.+$/, ""),
    alpns: [],
    ipv4Hints: [],
    ipv6Hints: [],
    port: null,
    ech: false,
    raw: data,
  };

  for (const token of params) {
    const [key, rawValue = ""] = token.split("=", 2);
    const value = rawValue.replace(/^"|"$/g, "");

    if (key === "alpn") {
      record.alpns = value.split(",").map((item) => item.trim()).filter(Boolean);
      continue;
    }

    if (key === "ipv4hint") {
      record.ipv4Hints = value.split(",").map((item) => item.trim()).filter(Boolean);
      continue;
    }

    if (key === "ipv6hint") {
      record.ipv6Hints = value.split(",").map((item) => item.trim()).filter(Boolean);
      continue;
    }

    if (key === "port") {
      const port = Number.parseInt(value, 10);
      record.port = Number.isNaN(port) ? null : port;
      continue;
    }

    if (key.startsWith("ech")) {
      record.ech = true;
    }
  }

  return record;
}

function expandIpv6(address: string) {
  const normalized = address.toLowerCase();
  const [left, right] = normalized.split("::");
  const leftParts = left ? left.split(":").filter(Boolean) : [];
  const rightParts = right ? right.split(":").filter(Boolean) : [];
  const fillCount = Math.max(0, 8 - leftParts.length - rightParts.length);
  const groups = [
    ...leftParts,
    ...Array(fillCount).fill("0"),
    ...rightParts,
  ].map((part) => part.padStart(4, "0"));
  return groups.slice(0, 8);
}

function compressIpv6(groups: string[]) {
  const normalized = groups.map((group) => group.replace(/^0+/, "") || "0");
  const text = normalized.join(":");
  return text.replace(/(?:^|:)0(?::0)+(?::|$)/, "::").replace(/^:::+/, "::");
}

function deriveNat64Prefix(address: string) {
  const groups = expandIpv6(address);
  const prefixGroups = [...groups];
  prefixGroups[6] = "0000";
  prefixGroups[7] = "0000";
  return compressIpv6(prefixGroups);
}

function synthesizeNat64Address(prefix: string, ipv4Address: string) {
  const octets = ipv4Address.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value))) {
    return null;
  }

  const groups = expandIpv6(prefix);
  groups[6] = ((octets[0] << 8) | octets[1]).toString(16).padStart(4, "0");
  groups[7] = ((octets[2] << 8) | octets[3]).toString(16).padStart(4, "0");
  return compressIpv6(groups);
}

interface PacketCaptureGateSnapshot {
  activeGlobal: number;
  activeForKey: number;
  maxGlobal: number;
  maxPerKey: number;
}

export class PacketCaptureResourceMonitor {
  private readonly maxCpuUtilizationPercent = runtimeConfig.limits.packetCaptureMaxLoadPerCpuPercent;
  private readonly minMemoryHeadroomMb = runtimeConfig.limits.packetCaptureMinFreeSystemMemoryMb;
  private readonly maxMemoryUtilizationPercent = runtimeConfig.limits.packetCaptureMaxSystemMemoryUtilizationPercent;
  private lastCpuSample:
    | {
      timestampMs: number;
      usageMicros: number;
    }
    | null = null;

  private measureCpuUtilization() {
    const resourceSnapshot = getRuntimeResourceSnapshot();

    if (resourceSnapshot.cpuMetricSource === "cgroup" && resourceSnapshot.cpuUsageMicros != null) {
      const now = Date.now();
      if (!this.lastCpuSample) {
        this.lastCpuSample = {
          timestampMs: now,
          usageMicros: resourceSnapshot.cpuUsageMicros,
        };

        return {
          resourceSnapshot,
          cpuUtilizationPercent: 0,
        };
      }

      let cpuUtilizationPercent = 0;
      if (now > this.lastCpuSample.timestampMs) {
        const elapsedMicros = (now - this.lastCpuSample.timestampMs) * 1000;
        const consumedMicros = Math.max(
          0,
          resourceSnapshot.cpuUsageMicros - this.lastCpuSample.usageMicros,
        );

        cpuUtilizationPercent = Number(
          Math.min(
            100,
            (consumedMicros / Math.max(1, elapsedMicros * resourceSnapshot.effectiveCpuLimit)) * 100,
          ).toFixed(1),
        );
      }

      this.lastCpuSample = {
        timestampMs: now,
        usageMicros: resourceSnapshot.cpuUsageMicros,
      };

      return {
        resourceSnapshot,
        cpuUtilizationPercent,
      };
    }

    const cpuUtilizationPercent = resourceSnapshot.effectiveCpuLimit > 0
      ? Number(
        Math.min(
          100,
          ((resourceSnapshot.loadAverage1m / resourceSnapshot.effectiveCpuLimit) || 0) * 100,
        ).toFixed(1),
      )
      : 0;

    return {
      resourceSnapshot,
      cpuUtilizationPercent,
    };
  }

  getStatus(gateSnapshot: PacketCaptureGateSnapshot): PacketCaptureCapacityStatus {
    const {
      resourceSnapshot,
      cpuUtilizationPercent,
    } = this.measureCpuUtilization();
    const memoryHeadroomMb = Math.round(resourceSnapshot.memoryHeadroomBytes / 1024 / 1024);
    const rssMb = Math.round(resourceSnapshot.rssBytes / 1024 / 1024);
    const usingHostFallback = resourceSnapshot.basis === "host";

    let reason: string | null = null;
    let retryAfterSeconds: number | null = null;
    const advisories: string[] = [];

    if (usingHostFallback && memoryHeadroomMb < this.minMemoryHeadroomMb) {
      advisories.push(
        `Host memory headroom is ${memoryHeadroomMb} MB, below the ${this.minMemoryHeadroomMb} MB guidance floor. Netlab will still allow a best-effort analysis while no other capture workers are running.`,
      );
    }

    if (usingHostFallback && resourceSnapshot.memoryUtilizationPercent >= this.maxMemoryUtilizationPercent) {
      advisories.push(
        `Host memory utilization is ${resourceSnapshot.memoryUtilizationPercent.toFixed(1)}%, above the ${this.maxMemoryUtilizationPercent}% guidance line. New capture work remains best-effort until host pressure drops.`,
      );
    }

    if (usingHostFallback && cpuUtilizationPercent >= this.maxCpuUtilizationPercent) {
      advisories.push(
        `Host CPU pressure is ${cpuUtilizationPercent.toFixed(1)}%, above the ${this.maxCpuUtilizationPercent}% guidance line. A first capture can still start, but extra work will be held back while pressure stays high.`,
      );
    }

    if (gateSnapshot.activeGlobal >= gateSnapshot.maxGlobal) {
      reason = `All ${gateSnapshot.maxGlobal} packet capture worker slots are currently in use.`;
      retryAfterSeconds = 20;
    } else if (gateSnapshot.activeForKey >= gateSnapshot.maxPerKey) {
      reason = "A packet capture analysis is already running for this requester. Wait for that run to finish before starting another.";
      retryAfterSeconds = 20;
    } else if (
      usingHostFallback
      && gateSnapshot.activeGlobal > 0
      && (
        memoryHeadroomMb < this.minMemoryHeadroomMb
        || resourceSnapshot.memoryUtilizationPercent >= this.maxMemoryUtilizationPercent
        || cpuUtilizationPercent >= this.maxCpuUtilizationPercent
      )
    ) {
      reason = "Packet capture admission is paused because host fallback is already under pressure while another capture worker is active. Wait for the running analysis to finish, then retry.";
      retryAfterSeconds = 20;
    } else if (!usingHostFallback && memoryHeadroomMb < this.minMemoryHeadroomMb) {
      reason = `Packet capture admission is paused because ${resourceSnapshot.memoryMetricSource === "cgroup" ? "container" : "host"} memory headroom is ${memoryHeadroomMb} MB, below the ${this.minMemoryHeadroomMb} MB safety floor.`;
      retryAfterSeconds = 30;
    } else if (!usingHostFallback && resourceSnapshot.memoryUtilizationPercent >= this.maxMemoryUtilizationPercent) {
      reason = `Packet capture admission is paused because ${resourceSnapshot.memoryMetricSource === "cgroup" ? "container" : "host"} memory utilization is ${resourceSnapshot.memoryUtilizationPercent.toFixed(1)}%, above the ${this.maxMemoryUtilizationPercent}% safety limit.`;
      retryAfterSeconds = 30;
    } else if (!usingHostFallback && cpuUtilizationPercent >= this.maxCpuUtilizationPercent) {
      reason = `Packet capture admission is paused because ${resourceSnapshot.cpuMetricSource === "cgroup" ? "container" : "host"} CPU pressure is ${cpuUtilizationPercent.toFixed(1)}%, above the ${this.maxCpuUtilizationPercent}% safety limit.`;
      retryAfterSeconds = 20;
    }

    return {
      acceptedExtensions: ACCEPTED_CAPTURE_EXTENSIONS,
      maxFileBytes: MAX_PACKET_CAPTURE_BYTES,
      available: reason === null,
      admissionMode: usingHostFallback ? "best-effort" : "strict",
      reason,
      advisories,
      retryable: reason !== null,
      retryAfterSeconds,
      snapshot: {
        resourceBasis: resourceSnapshot.basis,
        cpuMetricSource: resourceSnapshot.cpuMetricSource,
        memoryMetricSource: resourceSnapshot.memoryMetricSource,
        effectiveCpuLimit: resourceSnapshot.effectiveCpuLimit,
        cpuUtilizationPercent,
        loadAverage1m: resourceSnapshot.loadAverage1m,
        memoryUtilizationPercent: resourceSnapshot.memoryUtilizationPercent,
        memoryHeadroomMb,
        rssMb,
        activeAnalyses: gateSnapshot.activeGlobal,
        maxConcurrentAnalyses: gateSnapshot.maxGlobal,
        activeForRequester: gateSnapshot.activeForKey,
        maxConcurrentPerRequester: gateSnapshot.maxPerKey,
      },
      thresholds: {
        maxCpuUtilizationPercent: this.maxCpuUtilizationPercent,
        minMemoryHeadroomMb: this.minMemoryHeadroomMb,
        maxMemoryUtilizationPercent: this.maxMemoryUtilizationPercent,
      },
    };
  }

  assertCanAccept(gateSnapshot: PacketCaptureGateSnapshot) {
    const status = this.getStatus(gateSnapshot);
    if (status.available) {
      return status;
    }

    throw new PacketCaptureCapacityError(
      `${status.reason} Please try again later.`,
      503,
      status,
    );
  }
}

export class PacketCaptureAnalyzer {
  async analyze(buffer: Buffer, filename: string): Promise<PacketCaptureReport> {
    const upload = inspectPacketCaptureUpload(buffer, filename);
    const safeName = upload.filename;
    const extension = upload.extension || ".pcapng";
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "netlab-pcap-"));
    const capturePath = path.join(tempDir, `upload${extension}`);

    try {
      await writeFile(capturePath, buffer);

      const [capinfos, tshark] = await Promise.all([
        runCommand("capinfos", ["-M", capturePath], {
          timeoutMs: 5_000,
        }),
        runCommand(
          "tshark",
          [
            "-r",
            capturePath,
            "-T",
            "fields",
            "-E",
            "header=y",
            "-E",
            "separator=\t",
            "-E",
            "occurrence=f",
            "-e",
            "frame.len",
            "-e",
            "frame.protocols",
            "-e",
            "ip.src",
            "-e",
            "ip.dst",
            "-e",
            "ipv6.src",
            "-e",
            "ipv6.dst",
            "-e",
            "tcp.stream",
            "-e",
            "udp.stream",
            "-e",
            "tcp.analysis.retransmission",
            "-e",
            "tcp.analysis.fast_retransmission",
            "-e",
            "tcp.analysis.duplicate_ack",
            "-e",
            "tcp.analysis.zero_window",
            "-e",
            "tcp.flags.reset",
            "-e",
            "dns.qry.name",
            "-e",
            "dns.qry.type",
            "-e",
            "dns.flags.response",
            "-e",
            "dns.flags.rcode",
            "-e",
            "http.host",
            "-e",
            "http.request.method",
            "-e",
            "http.response.code",
            "-e",
            "tls.handshake.extensions_server_name",
            "-e",
            "tls.handshake.version",
            "-e",
            "tls.handshake.extensions_alpn_str",
            "-e",
            "quic.version",
            "-e",
            "quic.connection.number",
            "-e",
            "_ws.expert.severity",
            "-e",
            "_ws.expert.message",
          ],
          { timeoutMs: 10_000 },
        ),
      ]);

      if (capinfos.code !== 0) {
        throw new Error(capinfos.stderr.trim() || "capinfos failed");
      }

      if (tshark.code !== 0) {
        throw new Error(tshark.stderr.trim() || "tshark failed");
      }

      const rows = splitTsv(tshark.stdout);
      const protocolMap = new Map<string, { packets: number; bytes: number }>();
      const flowMap = new Map<string, PacketCaptureFlow>();
      const dnsQueries = new Map<string, {
        name: string;
        type: string;
        responses: number;
        responseCodes: Set<string>;
      }>();
      const httpHosts = new Set<string>();
      const httpMethods = new Set<string>();
      const httpStatusCodes = new Set<number>();
      const tlsServerNames = new Set<string>();
      const tlsVersions = new Set<string>();
      const tlsAlpns = new Set<string>();
      const quicVersions = new Set<string>();
      const quicConnections = new Set<string>();
      const expertFindingsMap = new Map<string, PacketCaptureExpertFinding>();

      let retransmissions = 0;
      let duplicateAcks = 0;
      let zeroWindows = 0;
      let resets = 0;
      const tcpStreams = new Set<string>();

      for (const row of rows) {
        const frameLength = Number.parseInt(row["frame.len"] || "0", 10) || 0;
        const protocolChain = (row["frame.protocols"] || "")
          .split(":")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);

        for (const protocol of [...new Set(protocolChain)].filter(shouldCountProtocol)) {
          const stat = protocolMap.get(protocol) ?? { packets: 0, bytes: 0 };
          stat.packets += 1;
          stat.bytes += frameLength;
          protocolMap.set(protocol, stat);
        }

        const source = row["ip.src"] || row["ipv6.src"] || "unknown";
        const destination = row["ip.dst"] || row["ipv6.dst"] || "unknown";
        const tcpStream = row["tcp.stream"] || "";
        const udpStream = row["udp.stream"] || "";
        const transport = tcpStream
          ? "tcp"
          : udpStream
            ? "udp"
            : "other";
        const stream = tcpStream || udpStream || null;
        const application = protocolChain.find((protocol) =>
          ["dns", "http", "tls", "quic"].includes(protocol)
        ) ?? null;
        const flowKey = `${transport}:${source}:${destination}:${stream ?? "na"}`;
        const flow = flowMap.get(flowKey) ?? {
          id: flowKey,
          transport,
          source,
          destination,
          packets: 0,
          bytes: 0,
          stream,
          application,
        };
        flow.packets += 1;
        flow.bytes += frameLength;
        flowMap.set(flowKey, flow);

        if (tcpStream) {
          tcpStreams.add(tcpStream);
        }
        if (row["tcp.analysis.retransmission"] || row["tcp.analysis.fast_retransmission"]) {
          retransmissions += 1;
        }
        if (row["tcp.analysis.duplicate_ack"]) {
          duplicateAcks += 1;
        }
        if (row["tcp.analysis.zero_window"]) {
          zeroWindows += 1;
        }
        if (row["tcp.flags.reset"]) {
          resets += 1;
        }

        if (row["dns.qry.name"]) {
          const key = `${row["dns.qry.name"]}:${row["dns.qry.type"]}`;
          const query = dnsQueries.get(key) ?? {
            name: row["dns.qry.name"],
            type: dnsTypeLabel(row["dns.qry.type"]),
            responses: 0,
            responseCodes: new Set<string>(),
          };
          if (row["dns.flags.response"] === "1") {
            query.responses += 1;
          }
          if (row["dns.flags.rcode"]) {
            query.responseCodes.add(dnsRcodeLabel(row["dns.flags.rcode"]));
          }
          dnsQueries.set(key, query);
        }

        if (row["http.host"]) {
          httpHosts.add(row["http.host"]);
        }
        if (row["http.request.method"]) {
          httpMethods.add(row["http.request.method"]);
        }
        if (row["http.response.code"]) {
          const statusCode = Number.parseInt(row["http.response.code"], 10);
          if (!Number.isNaN(statusCode)) {
            httpStatusCodes.add(statusCode);
          }
        }

        if (row["tls.handshake.extensions_server_name"]) {
          tlsServerNames.add(row["tls.handshake.extensions_server_name"]);
        }
        if (row["tls.handshake.version"]) {
          tlsVersions.add(row["tls.handshake.version"]);
        }
        if (row["tls.handshake.extensions_alpn_str"]) {
          tlsAlpns.add(row["tls.handshake.extensions_alpn_str"]);
        }

        if (row["quic.version"]) {
          quicVersions.add(row["quic.version"]);
        }
        if (row["quic.connection.number"]) {
          quicConnections.add(row["quic.connection.number"]);
        }

        if (row["_ws.expert.message"]) {
          const detail = row["_ws.expert.message"];
          if (!expertFindingsMap.has(detail)) {
            expertFindingsMap.set(detail, {
              severity: classifyExpertSeverity(detail),
              summary: detail,
              detail,
            });
          }
        }
      }

      const packetCount = parseCapinfosInteger(capinfos.stdout, "Number of packets") ?? rows.length;
      const protocols = [...protocolMap.entries()]
        .map(([protocol, stat]) => ({
          protocol,
          packets: stat.packets,
          bytes: stat.bytes,
          share: packetCount > 0 ? stat.packets / packetCount : 0,
        }))
        .sort((left, right) => right.packets - left.packets)
        .slice(0, 12) satisfies PacketCaptureProtocolStat[];

      return {
        filename: safeName,
        sizeBytes: buffer.length,
        packetCount,
        dataSizeBytes: parseCapinfosInteger(capinfos.stdout, "Data size") ?? buffer.length,
        durationSeconds: (() => {
          const raw = parseCapinfosValue(capinfos.stdout, "Capture duration");
          if (!raw || raw === "n/a") {
            return null;
          }
          const value = Number.parseFloat(raw);
          return Number.isNaN(value) ? null : value;
        })(),
        captureFileType: parseCapinfosValue(capinfos.stdout, "File type"),
        encapsulation: parseCapinfosValue(capinfos.stdout, "File encapsulation"),
        protocols,
        flows: [...flowMap.values()]
          .sort((left, right) => right.bytes - left.bytes)
          .slice(0, 12),
        tcpAnalysis: {
          streamCount: tcpStreams.size,
          retransmissions,
          duplicateAcks,
          zeroWindows,
          resets,
        },
        dns: {
          queryCount: dnsQueries.size,
          queries: [...dnsQueries.values()]
            .map((query) => ({
              name: query.name,
              type: query.type,
              responses: query.responses,
              responseCodes: [...query.responseCodes].sort(),
            }))
            .sort((left, right) => left.name.localeCompare(right.name))
            .slice(0, 12),
        },
        http: {
          requestCount: httpMethods.size,
          hosts: [...httpHosts].sort(),
          methods: [...httpMethods].sort(),
          statusCodes: [...httpStatusCodes].sort((left, right) => left - right),
        },
        tls: {
          handshakeCount: tlsServerNames.size + tlsVersions.size + tlsAlpns.size,
          serverNames: [...tlsServerNames].sort(),
          versions: [...tlsVersions].sort(),
          alpns: [...tlsAlpns].sort(),
        },
        quic: {
          packetCount: rows.filter((row) => Boolean(row["quic.version"])).length,
          versions: [...quicVersions].sort(),
          connectionIds: quicConnections.size,
        },
        expertFindings: [...expertFindingsMap.values()].slice(0, 20),
        notes: tshark.stderr.trim() ? [tshark.stderr.trim()] : [],
        analyzedAt: Date.now(),
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

export class ServiceBindingProbe {
  async lookup(hostname: string): Promise<ServiceBindingLookupResult> {
    const notes: string[] = [];
    const digHttps = await this.queryDig(hostname, "TYPE65", "HTTPS", notes);
    const digSvcb = await this.queryDig(hostname, "TYPE64", "SVCB", notes);
    const digRecords = [...digHttps, ...digSvcb];

    if (digRecords.length > 0) {
      return {
        records: digRecords,
        source: "dig",
        notes,
      };
    }

    const dohHttps = await this.queryDoh(hostname, "HTTPS", notes);
    const dohSvcb = await this.queryDoh(hostname, "SVCB", notes);
    const dohRecords = [...dohHttps, ...dohSvcb];

    return {
      records: dohRecords,
      source: dohRecords.length > 0 ? "doh" : "none",
      notes,
    };
  }

  private async queryDig(
    hostname: string,
    type: "TYPE65" | "TYPE64",
    recordType: "HTTPS" | "SVCB",
    notes: string[],
  ) {
    try {
      const result = await runCommand("dig", ["+short", type, hostname], {
        timeoutMs: 4_000,
      });
      if (result.code !== 0) {
        notes.push(`dig ${recordType} lookup failed: ${result.stderr.trim() || `exit ${result.code}`}.`);
        return [] as ServiceBindingRecord[];
      }

      const lines = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const readable = lines.filter((line) => !line.startsWith("\\# "));

      if (lines.length > 0 && readable.length === 0) {
        notes.push(`dig returned raw ${recordType} RDATA, falling back to DoH parsing.`);
      }

      return readable
        .map((line) => parseSvcbRecordData(line, recordType))
        .filter((record): record is ServiceBindingRecord => record !== null);
    } catch (error) {
      notes.push(`dig ${recordType} lookup unavailable: ${error instanceof Error ? error.message : "unknown error"}.`);
      return [];
    }
  }

  private async queryDoh(
    hostname: string,
    recordType: "HTTPS" | "SVCB",
    notes: string[],
  ) {
    try {
      const url = `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=${recordType}`;
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "Netlab Service Binding/1.0",
        },
        signal: AbortSignal.timeout(4_000),
      });

      if (!response.ok) {
        notes.push(`DoH ${recordType} lookup returned HTTP ${response.status}.`);
        return [] as ServiceBindingRecord[];
      }

      const payload = await response.json() as ServiceBindingAnswer;
      return (payload.Answer ?? [])
        .map((answer) => parseSvcbRecordData(answer.data ?? "", recordType))
        .filter((record): record is ServiceBindingRecord => record !== null);
    } catch (error) {
      notes.push(`DoH ${recordType} lookup failed: ${error instanceof Error ? error.message : "unknown error"}.`);
      return [];
    }
  }
}

function parseCurlVersionFeatures(output: string) {
  const match = output.match(/^Features:\s+(.+)$/mi);
  return match
    ? match[1].split(/\s+/).map((item) => item.trim()).filter(Boolean)
    : [];
}

async function detectHttp3CurlBinary(binary: string) {
  try {
    const result = await runCommand(binary, ["--version"], { timeoutMs: 4_000 });
    if (result.code !== 0) {
      return {
        binary,
        accessible: false,
        supportsHttp3: false,
        detail: result.stderr.trim() || `exit ${result.code ?? "unknown"}`,
      };
    }

    const features = parseCurlVersionFeatures(result.stdout);
    return {
      binary,
      accessible: true,
      supportsHttp3: features.includes("HTTP3"),
      detail: result.stdout.split(/\r?\n/)[0]?.trim() || binary,
    };
  } catch (error) {
    return {
      binary,
      accessible: false,
      supportsHttp3: false,
      detail: error instanceof Error ? error.message : "binary check failed",
    };
  }
}

export class QuicHandshakeProbe {
  private detectionPromise: Promise<{
    anyBinary: string | null;
    anyBinaryDetail: string;
    http3Binary: string | null;
    http3BinaryDetail: string;
  }> | null = null;

  private resolveCandidateBinaries() {
    const configured = process.env.NETLAB_HTTP3_CURL_BINARY?.trim();
    return [
      configured,
      "/opt/netlab-http3/bin/curl",
      "curl",
    ].filter((value, index, items): value is string => Boolean(value) && items.indexOf(value) === index);
  }

  private async resolveBinary() {
    if (this.detectionPromise) {
      return this.detectionPromise;
    }

    this.detectionPromise = (async () => {
      const candidates = this.resolveCandidateBinaries();
      const results = [];
      let anyBinary: string | null = null;
      let anyBinaryDetail = "";

      for (const binary of candidates) {
        const result = await detectHttp3CurlBinary(binary);
        results.push(result);

        if (!anyBinary && result.accessible) {
          anyBinary = result.binary;
          anyBinaryDetail = result.detail;
        }

        if (result.supportsHttp3) {
          return {
            anyBinary: anyBinary ?? result.binary,
            anyBinaryDetail: anyBinaryDetail || result.detail,
            http3Binary: result.binary,
            http3BinaryDetail: result.detail,
          };
        }
      }

      return {
        anyBinary,
        anyBinaryDetail:
          anyBinaryDetail
          || results.map((item) => `${item.binary}: ${item.detail}`).join("; "),
        http3Binary: null,
        http3BinaryDetail:
          results.map((item) => `${item.binary}: ${item.detail}`).join("; "),
      };
    })();

    return this.detectionPromise;
  }

  private parseMetricMilliseconds(output: string, name: string) {
    const rawValue = output.match(new RegExp(`${name}=([^\\n]+)`))?.[1]?.trim() || null;
    if (!rawValue) {
      return null;
    }

    const parsedValue = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsedValue)) {
      return null;
    }

    return Math.round(parsedValue * 1000 * 10) / 10;
  }

  private parseMetricString(output: string, name: string) {
    return output.match(new RegExp(`${name}=([^\\n]+)`))?.[1]?.trim() || null;
  }

  private async runProtocolProbe(
    protocol: "http2" | "http3",
    url: string,
  ): Promise<HttpProtocolProbeResult> {
    const resolved = await this.resolveBinary();
    const binary = protocol === "http3" ? resolved.http3Binary : resolved.anyBinary;
    const detail = protocol === "http3" ? resolved.http3BinaryDetail : resolved.anyBinaryDetail;

    if (!binary) {
      return {
        protocol,
        available: false,
        attempted: false,
        binary: null,
        succeeded: null,
        statusCode: null,
        httpVersion: null,
        remoteIp: null,
        connectMs: null,
        tlsHandshakeMs: null,
        ttfbMs: null,
        detail: detail || `No ${protocol.toUpperCase()} curl binary is available.`,
      };
    }

    try {
      const writeOut = [
        "status_code=%{response_code}",
        "http_version=%{http_version}",
        "remote_ip=%{remote_ip}",
        "time_connect=%{time_connect}",
        "time_appconnect=%{time_appconnect}",
        "time_starttransfer=%{time_starttransfer}",
      ].join("\\n");
      const result = await runCommand(
        binary,
        [
          "-sS",
          "-k",
          protocol === "http3" ? "--http3-only" : "--http2",
          "--connect-timeout",
          "4",
          "--max-time",
          "8",
          url,
          "-o",
          "/dev/null",
          "-w",
          writeOut,
        ],
        { timeoutMs: 10_000 },
      );

      const stderr = result.stderr.trim();
      if (/doesn't support this/i.test(stderr)) {
        return {
          protocol,
          available: false,
          attempted: false,
          binary,
          succeeded: null,
          statusCode: null,
          httpVersion: null,
          remoteIp: null,
          connectMs: null,
          tlsHandshakeMs: null,
          ttfbMs: null,
          detail: `Installed curl does not support libcurl ${protocol.toUpperCase()}.`,
        };
      }

      if (result.code !== 0) {
        return {
          protocol,
          available: true,
          attempted: true,
          binary,
          succeeded: false,
          statusCode: null,
          httpVersion: null,
          remoteIp: null,
          connectMs: null,
          tlsHandshakeMs: null,
          ttfbMs: null,
          detail: stderr || `curl exited with code ${result.code ?? "unknown"}`,
        };
      }

      const httpVersion = this.parseMetricString(result.stdout, "http_version");
      const remoteIp = this.parseMetricString(result.stdout, "remote_ip");
      const statusCodeRaw = this.parseMetricString(result.stdout, "status_code");
      const statusCode = statusCodeRaw && statusCodeRaw !== "000"
        ? Number.parseInt(statusCodeRaw, 10)
        : null;

      return {
        protocol,
        available: true,
        attempted: true,
        binary,
        succeeded: true,
        statusCode: Number.isFinite(statusCode) ? statusCode : null,
        httpVersion,
        remoteIp,
        connectMs: this.parseMetricMilliseconds(result.stdout, "time_connect"),
        tlsHandshakeMs: this.parseMetricMilliseconds(result.stdout, "time_appconnect"),
        ttfbMs: this.parseMetricMilliseconds(result.stdout, "time_starttransfer"),
        detail: `${protocol.toUpperCase()} transaction succeeded through curl.`,
      };
    } catch (error) {
      return {
        protocol,
        available: true,
        attempted: true,
        binary,
        succeeded: null,
        statusCode: null,
        httpVersion: null,
        remoteIp: null,
        connectMs: null,
        tlsHandshakeMs: null,
        ttfbMs: null,
        detail: error instanceof Error ? error.message : `${protocol.toUpperCase()} probe failed`,
      };
    }
  }

  async probe(url: string): Promise<HttpProtocolProbeResult> {
    return this.runProtocolProbe("http3", url);
  }

  async probeHttp2(url: string): Promise<HttpProtocolProbeResult> {
    return this.runProtocolProbe("http2", url);
  }
}

export class Nat64Probe {
  async detect(): Promise<Nat64DetectionResult> {
    try {
      const addresses = await dns.resolve6("ipv4only.arpa");
      if (addresses.length === 0) {
        return {
          detected: false,
          prefix: null,
          evidence: [],
        };
      }

      const prefix = deriveNat64Prefix(addresses[0]);
      return {
        detected: true,
        prefix,
        evidence: addresses,
      };
    } catch {
      return {
        detected: false,
        prefix: null,
        evidence: [],
      };
    }
  }

  synthesizeAddresses(prefix: string | null, ipv4Addresses: string[]) {
    if (!prefix) {
      return [] as string[];
    }

    return ipv4Addresses
      .map((address) => synthesizeNat64Address(prefix, address))
      .filter((address): address is string => Boolean(address));
  }
}
