import { spawn } from "child_process";
import net from "net";
import logger from "../../lib/logger.js";
import { resolveFixedExecutable } from "../../src/lib/system-binaries.js";
import {
  normalizePingOptions,
  type PingOptions,
} from "../../src/lib/network-validation.js";
import {
  PublicTargetError,
  resolvePublicTarget,
} from "../../src/lib/public-targets.js";
import type {
  PingResult,
  PingStatistics,
  PingSummary,
} from "./network.types.js";

const DEFAULT_PING_TIMEOUT_MS = 5_000;
const DEFAULT_TCP_PORT = 80;
const WINDOWS_PING_TIMEOUT_GRACE_MS = 1_000;
const UNIX_PING_TIMEOUT_PER_PACKET_MS = 1_000;
const PING_EXECUTABLE_CANDIDATES = process.platform === "win32"
  ? ["C:\\Windows\\System32\\PING.EXE"]
  : ["/sbin/ping", "/usr/sbin/ping", "/bin/ping", "/usr/bin/ping"];

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.endsWith("\r") ? line.slice(0, -1) : line);
}

function readUnsignedNumber(value: string) {
  if (!value) {
    return null;
  }

  let hasDecimalPoint = false;

  for (const char of value) {
    const isDigit = char >= "0" && char <= "9";
    if (isDigit) {
      continue;
    }

    if (char === "." && !hasDecimalPoint) {
      hasDecimalPoint = true;
      continue;
    }

    return null;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function isInlineWhitespace(char: string | undefined) {
  return char === " " || char === "\t";
}

function extractWindowsAverageLatency(output: string) {
  for (const line of splitLines(output)) {
    const markerIndex = line.indexOf("Average = ");
    if (markerIndex === -1) {
      continue;
    }

    let cursor = markerIndex + "Average = ".length;
    let rawLatency = "";

    while (cursor < line.length) {
      const char = line[cursor];
      if (char < "0" || char > "9") {
        break;
      }

      rawLatency += char;
      cursor += 1;
    }

    if (!rawLatency) {
      continue;
    }

    const suffix = line.slice(cursor).trimStart().toLowerCase();
    if (!suffix.startsWith("ms")) {
      continue;
    }

    return Number.parseInt(rawLatency, 10);
  }

  return null;
}

function extractUnixLatencies(output: string) {
  const latencies: number[] = [];

  for (const rawLine of splitLines(output)) {
    const line = rawLine.toLowerCase();
    const markerIndex = line.indexOf("time");

    if (markerIndex === -1) {
      continue;
    }

    let cursor = markerIndex + "time".length;
    const relationChar = line[cursor];
    if (relationChar === "=" || relationChar === "<") {
      cursor += 1;
    }

    while (cursor < line.length && isInlineWhitespace(line[cursor])) {
      cursor += 1;
    }

    let rawLatency = "";
    while (cursor < line.length) {
      const char = line[cursor];
      const isDigit = char >= "0" && char <= "9";
      if (isDigit || char === ".") {
        rawLatency += char;
        cursor += 1;
        continue;
      }

      break;
    }

    if (!rawLatency) {
      continue;
    }

    const suffix = line.slice(cursor).trimStart();
    if (!suffix.startsWith("ms")) {
      continue;
    }

    const parsedLatency = readUnsignedNumber(rawLatency);
    if (parsedLatency != null) {
      latencies.push(parsedLatency);
    }
  }

  return latencies;
}

function countIcmpResponses(output: string) {
  return splitLines(output).filter((line) => line.includes(" bytes from")).length;
}

class PingService {
  private async executeICMPCommand(
    host: string,
    timeout: number,
    count: number,
  ): Promise<string> {
    const isWindows = process.platform === "win32";
    const args = isWindows
      ? ["-n", String(count), "-w", String(timeout), host]
      : ["-c", String(count), host];
    const pingExecutable = resolveFixedExecutable("ping", PING_EXECUTABLE_CANDIDATES);

    return new Promise((resolve, reject) => {
      const pingProcess = spawn(pingExecutable, args, { shell: false });
      let stdout = "";
      let stderr = "";
      let settled = false;

      const timeoutMs = isWindows
        ? timeout * count + WINDOWS_PING_TIMEOUT_GRACE_MS
        : timeout + count * UNIX_PING_TIMEOUT_PER_PACKET_MS + WINDOWS_PING_TIMEOUT_GRACE_MS;

      const timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        pingProcess.kill("SIGTERM");
        reject(new Error(`Ping timed out after ${timeout}ms`));
      }, timeoutMs);

      pingProcess.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      pingProcess.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      pingProcess.on("error", (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        reject(error);
      });

      pingProcess.on("close", (code) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);

        if (code === 0) {
          resolve(stdout);
          return;
        }

        const output = stderr.trim() || stdout.trim();
        reject(new Error(output || `Ping exited with code ${code ?? "unknown"}`));
      });
    });
  }

  private async tcpPing(host: string, port: number, timeout: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const startTime = process.hrtime();
      const socket = new net.Socket();

      socket.setTimeout(timeout);

      socket.on("connect", () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const latency = seconds * 1000 + nanoseconds / 1_000_000;
        socket.destroy();
        resolve(latency);
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Timeout"));
      });

      socket.on("error", (error) => {
        socket.destroy();
        reject(error);
      });

      socket.connect(port, host);
    });
  }

  private async icmpPing(
    host: string,
    timeout: number,
    count = 1,
  ): Promise<number[]> {
    const isWindows = process.platform === "win32";

    try {
      const stdout = await this.executeICMPCommand(host, timeout, count);
      const latencies = this.parseICMPPingOutput(stdout, isWindows);

      if (latencies.length === 0) {
        throw new Error("Failed to parse ping response");
      }

      return latencies;
    } catch (error) {
      logger.warn("ICMP ping execution failed", {
        host,
        timeout,
        count,
        error: error instanceof Error ? error.message : error,
      });
      throw new Error(error instanceof Error ? error.message : "Ping failed");
    }
  }

  private parseICMPPingOutput(output: string, isWindows: boolean): number[] {
    try {
      if (isWindows) {
        const averageLatency = extractWindowsAverageLatency(output);
        if (averageLatency != null) {
          return [averageLatency];
        }
      } else {
        const latencies = extractUnixLatencies(output);
        if (latencies.length > 0) {
          return latencies;
        }
      }

      const responseCount = countIcmpResponses(output);
      if (responseCount > 0) {
        return Array(responseCount).fill(0);
      }

      return [];
    } catch (error) {
      logger.warn("Failed to parse ICMP ping output", {
        error: error instanceof Error ? error.message : error,
      });
      logger.debug("Raw ICMP ping output", { output });
      return [];
    }
  }

  async executePing(options: PingOptions): Promise<PingResult[]> {
    const normalizedOptions = normalizePingOptions(options);
    const {
      type,
      host,
      port = DEFAULT_TCP_PORT,
      timeout = DEFAULT_PING_TIMEOUT_MS,
    } = normalizedOptions;
    const results: PingResult[] = [];

    try {
      const { resolvedTarget } = await resolvePublicTarget(host, "Host");

      if (type === "tcp") {
        const latency = await this.tcpPing(resolvedTarget, port, timeout);
        results.push({
          success: true,
          latency,
          sequence: 0,
          timestamp: Date.now(),
        });
      } else {
        const latencies = await this.icmpPing(resolvedTarget, timeout, 1);
        latencies.forEach((latency, index) => {
          results.push({
            success: true,
            latency,
            sequence: index,
            timestamp: Date.now(),
          });
        });
      }
    } catch (error) {
      if (error instanceof PublicTargetError) {
        throw error;
      }

      results.push({
        success: false,
        error: error instanceof Error ? error.message : "Failed to ping",
        latency: null,
        sequence: 0,
        timestamp: Date.now(),
      });
    }

    return results;
  }

  calculateStatistics(results: PingResult[]): PingStatistics {
    const successfulResults = results.filter((result) => result.success);
    const latencies = successfulResults
      .map((result) => result.latency)
      .filter((latency): latency is number => typeof latency === "number");

    return {
      sent: results.length,
      received: successfulResults.length,
      lost: results.length - successfulResults.length,
      successRate: results.length > 0
        ? (successfulResults.length / results.length) * 100
        : 0,
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      avgLatency: latencies.length > 0
        ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
        : 0,
      timestamp: Date.now(),
    };
  }

  async ping(options: PingOptions): Promise<PingSummary> {
    const normalizedOptions = normalizePingOptions(options);

    try {
      const results = await this.executePing(normalizedOptions);
      return {
        host: normalizedOptions.host,
        type: normalizedOptions.type,
        results,
        statistics: this.calculateStatistics(results),
        timestamp: Date.now(),
      };
    } catch (error) {
      if (error instanceof PublicTargetError) {
        throw error;
      }

      throw new Error(error instanceof Error ? error.message : "Unknown error");
    }
  }
}

export const pingService = new PingService();

export type {
  PingOptions,
  PingResult,
  PingStatistics,
  PingSummary,
} from "./network.types.js";
