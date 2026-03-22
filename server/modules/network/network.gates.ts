import { runtimeConfig } from "../../config/runtime.js";
import { ConcurrencyGate } from "../../src/lib/concurrency-gate.js";

export const traceGate = new ConcurrencyGate(
  "trace",
  runtimeConfig.limits.traceMaxConcurrentGlobal,
  runtimeConfig.limits.traceMaxConcurrentPerIp,
);

export const httpInspectionGate = new ConcurrencyGate(
  "HTTP inspection",
  runtimeConfig.limits.httpInspectionMaxConcurrentGlobal,
  runtimeConfig.limits.httpInspectionMaxConcurrentPerIp,
);

export const whoisGate = new ConcurrencyGate(
  "WHOIS lookup",
  runtimeConfig.limits.whoisMaxConcurrentGlobal,
  runtimeConfig.limits.whoisMaxConcurrentPerIp,
);
