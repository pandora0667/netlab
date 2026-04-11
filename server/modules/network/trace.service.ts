import { spawn } from "child_process";
import { resolvePublicTarget } from "../../src/lib/public-targets.js";
import { resolveFixedExecutable } from "../../src/lib/system-binaries.js";
import { isPublicIPAddress } from "../../../shared/network/ip.js";
import type { TraceHop, TraceSummary } from "./network.types.js";

const DEFAULT_TRACE_TIMEOUT_MS = 2_000;
const DEFAULT_TRACE_MAX_HOPS = 8;
const MAX_TRACE_TIMEOUT_MS = 5_000;
const MAX_TRACE_HOPS = 16;
const TRACEROUTE_EXECUTABLE_CANDIDATES = process.platform === "win32"
  ? ["C:\\Windows\\System32\\tracert.exe"]
  : ["/usr/sbin/traceroute", "/sbin/traceroute", "/usr/bin/traceroute", "/bin/traceroute"];

function splitWhitespaceTokens(value: string) {
  const tokens: string[] = [];
  let currentToken = "";

  for (const char of value) {
    if (char === " " || char === "\t") {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = "";
      }

      continue;
    }

    currentToken += char;
  }

  if (currentToken) {
    tokens.push(currentToken);
  }

  return tokens;
}

function parseLeadingHop(value: string) {
  let cursor = 0;
  let rawHop = "";

  while (cursor < value.length) {
    const char = value[cursor];
    if (char < "0" || char > "9") {
      break;
    }

    rawHop += char;
    cursor += 1;
  }

  if (!rawHop) {
    return null;
  }

  while (cursor < value.length) {
    const char = value[cursor];
    if (char !== " " && char !== "\t") {
      break;
    }

    cursor += 1;
  }

  return {
    hop: Number.parseInt(rawHop, 10),
    rest: value.slice(cursor).trim(),
  };
}

function parseTraceResponder(tokens: string[]) {
  if (tokens.length === 0 || tokens[0] === "*") {
    return null;
  }

  if (tokens.length > 1 && tokens[1].startsWith("(") && tokens[1].endsWith(")")) {
    return tokens[1].slice(1, -1) || tokens[0];
  }

  return tokens[0];
}

function parseTraceLatency(tokens: string[]) {
  for (let index = 0; index < tokens.length; index += 1) {
    const lowerToken = tokens[index].toLowerCase();

    if (lowerToken === "ms" && index > 0) {
      const parsedValue = Number.parseFloat(tokens[index - 1]);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    if (!lowerToken.endsWith("ms")) {
      continue;
    }

    const parsedValue = Number.parseFloat(tokens[index].slice(0, -2));
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function parseTracerouteLine(line: string, targetIp: string): TraceHop | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return null;
  }

  const parsedHop = parseLeadingHop(trimmedLine);
  if (!parsedHop) {
    return null;
  }

  const { hop, rest } = parsedHop;

  if (!rest || rest === "*") {
    return {
      hop,
      responder: null,
      redacted: false,
      latencyMs: null,
      status: "timeout",
      reachedTarget: false,
    };
  }

  const tokens = splitWhitespaceTokens(rest);
  const responder = parseTraceResponder(tokens);
  const latencyMs = parseTraceLatency(tokens);
  const reachedTarget = responder === targetIp;

  return {
    hop,
    responder,
    redacted: false,
    latencyMs,
    status: reachedTarget ? "destination" : "hop",
    reachedTarget,
  };
}

function shouldRedactHop(hop: TraceHop): boolean {
  if (!hop.responder) {
    return false;
  }

  if (hop.hop <= 2) {
    return true;
  }

  return !isPublicIPAddress(hop.responder);
}

export function redactTraceHop(hop: TraceHop): TraceHop {
  if (!shouldRedactHop(hop)) {
    return hop;
  }

  return {
    ...hop,
    responder: "redacted",
    redacted: true,
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
  const tracerouteExecutable = resolveFixedExecutable(
    "traceroute",
    TRACEROUTE_EXECUTABLE_CANDIDATES,
  );

  return new Promise((resolve, reject) => {
    const traceProcess = spawn(tracerouteExecutable, args, { shell: false });
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
      .filter((hop): hop is TraceHop => Boolean(hop))
      .map((hop) => redactTraceHop(hop));

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
