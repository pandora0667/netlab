import { spawn } from "child_process";
import net from "net";
import logger from "../../lib/logger.js";
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

    return new Promise((resolve, reject) => {
      const pingProcess = spawn("ping", args, { shell: false });
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
        const windowsAverageMatch = output.match(/Average = (\d+)ms/);
        if (windowsAverageMatch) {
          return [Number.parseInt(windowsAverageMatch[1], 10)];
        }
      } else {
        const timeMatches = [...output.matchAll(/time[=<]?\s*([0-9.]+)\s*ms/gi)];
        if (timeMatches.length > 0) {
          return timeMatches.map((match) => Number.parseFloat(match[1]));
        }
      }

      const responseRegex = /(\d+) bytes from/gi;
      const responses = [...output.matchAll(responseRegex)];
      if (responses.length > 0) {
        return Array(responses.length).fill(0);
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
