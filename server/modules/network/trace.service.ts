import { spawn } from "child_process";
import { resolvePublicTarget } from "../../src/lib/public-targets.js";
import type { TraceHop, TraceSummary } from "./network.types.js";

const DEFAULT_TRACE_TIMEOUT_MS = 2_000;
const DEFAULT_TRACE_MAX_HOPS = 8;
const MAX_TRACE_TIMEOUT_MS = 5_000;
const MAX_TRACE_HOPS = 16;

function resolveTraceTtlFlag() {
  return process.platform === "darwin" ? "-m" : "-t";
}

function parseResponder(output: string): string | null {
  const destinationMatch = output.match(/bytes from\s+([^\s:]+)/i);
  if (destinationMatch) {
    return destinationMatch[1];
  }

  const ttlExceededMatch = output.match(/from\s+([^\s:]+).*time to live exceeded/i);
  if (ttlExceededMatch) {
    return ttlExceededMatch[1];
  }

  return null;
}

function parseLatency(output: string): number | null {
  const latencyMatch = output.match(/time[=<]?\s*([0-9.]+)\s*ms/i);
  return latencyMatch ? Number.parseFloat(latencyMatch[1]) : null;
}

function buildHop(hop: number, output: string): TraceHop {
  const responder = parseResponder(output);
  const latencyMs = parseLatency(output);
  const reachedTarget = /bytes from/i.test(output) && !/time to live exceeded/i.test(output);

  if (responder) {
    return {
      hop,
      responder,
      latencyMs,
      status: reachedTarget ? "destination" : "hop",
      reachedTarget,
    };
  }

  return {
    hop,
    responder: null,
    latencyMs: null,
    status: "timeout",
    reachedTarget: false,
  };
}

async function runSingleHopProbe(
  target: string,
  timeoutMs: number,
  ttl: number,
): Promise<string> {
  const ttlFlag = resolveTraceTtlFlag();
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const args =
    process.platform === "darwin"
      ? ["-c", "1", ttlFlag, String(ttl), "-W", String(timeoutMs), target]
      : ["-c", "1", ttlFlag, String(ttl), "-W", String(timeoutSeconds), target];

  return new Promise((resolve, reject) => {
    const pingProcess = spawn("ping", args, { shell: false });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      pingProcess.kill("SIGTERM");
      resolve("");
    }, timeoutMs + 1_000);

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

    pingProcess.on("close", () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      resolve(`${stdout}\n${stderr}`.trim());
    });
  });
}

class TraceService {
  async trace(
    host: string,
    options?: { maxHops?: number; timeoutMs?: number },
  ): Promise<TraceSummary> {
    const timeoutMs = Math.min(
      MAX_TRACE_TIMEOUT_MS,
      Math.max(1_000, options?.timeoutMs ?? DEFAULT_TRACE_TIMEOUT_MS),
    );
    const maxHops = Math.min(
      MAX_TRACE_HOPS,
      Math.max(1, options?.maxHops ?? DEFAULT_TRACE_MAX_HOPS),
    );
    const { resolvedTarget } = await resolvePublicTarget(host, "Trace target");
    const hops: TraceHop[] = [];

    for (let hop = 1; hop <= maxHops; hop += 1) {
      const output = await runSingleHopProbe(resolvedTarget, timeoutMs, hop);
      const parsedHop = buildHop(hop, output);
      hops.push(parsedHop);

      if (parsedHop.reachedTarget) {
        break;
      }
    }

    return {
      host,
      targetIp: resolvedTarget,
      protocol: "icmp",
      maxHops,
      timeoutMs,
      hops,
      completed: hops.some((hop) => hop.reachedTarget),
      timestamp: Date.now(),
    };
  }
}

export const traceService = new TraceService();
