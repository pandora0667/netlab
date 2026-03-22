import { spawn } from "child_process";
import { resolvePublicTarget } from "../../src/lib/public-targets.js";
import type { TraceHop, TraceSummary } from "./network.types.js";

const DEFAULT_TRACE_TIMEOUT_MS = 2_000;
const DEFAULT_TRACE_MAX_HOPS = 8;
const MAX_TRACE_TIMEOUT_MS = 5_000;
const MAX_TRACE_HOPS = 16;

function parseTracerouteLine(line: string, targetIp: string): TraceHop | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return null;
  }

  const hopMatch = trimmedLine.match(/^(\d+)\s+(.*)$/);
  if (!hopMatch) {
    return null;
  }

  const hop = Number.parseInt(hopMatch[1], 10);
  const rest = hopMatch[2].trim();

  if (!rest || rest === "*") {
    return {
      hop,
      responder: null,
      latencyMs: null,
      status: "timeout",
      reachedTarget: false,
    };
  }

  const responderMatch = rest.match(/([^\s(]+)(?:\s+\(([^)]+)\))?/);
  const latencyMatch = rest.match(/([0-9.]+)\s*ms/i);
  const responder = responderMatch?.[2] || responderMatch?.[1] || null;
  const latencyMs = latencyMatch ? Number.parseFloat(latencyMatch[1]) : null;
  const reachedTarget = responder === targetIp;

  return {
    hop,
    responder,
    latencyMs,
    status: reachedTarget ? "destination" : "hop",
    reachedTarget,
  };
}

async function runTracerouteCommand(
  target: string,
  timeoutMs: number,
  maxHops: number,
): Promise<string> {
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const args = [
    "-n",
    "-m",
    String(maxHops),
    "-w",
    String(timeoutSeconds),
    "-q",
    "1",
    target,
  ];

  return new Promise((resolve, reject) => {
    const traceProcess = spawn("traceroute", args, { shell: false });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      traceProcess.kill("SIGTERM");
      reject(new Error(`Trace timed out after ${timeoutMs}ms`));
    }, timeoutSeconds * 1000 * Math.max(1, maxHops) + 1_000);

    traceProcess.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    traceProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    traceProcess.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    });

    traceProcess.on("close", () => {
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
    const output = await runTracerouteCommand(resolvedTarget, timeoutMs, maxHops);
    const hops = output
      .split("\n")
      .map((line) => parseTracerouteLine(line, resolvedTarget))
      .filter((hop): hop is TraceHop => Boolean(hop));

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
