import { runtimeConfig } from "../../config/runtime.js";
import { ConcurrencyGate } from "../../src/lib/concurrency-gate.js";

export const portScanGate = new ConcurrencyGate(
  "port scan",
  runtimeConfig.limits.portScanMaxConcurrentGlobal,
  runtimeConfig.limits.portScanMaxConcurrentPerIp,
);
