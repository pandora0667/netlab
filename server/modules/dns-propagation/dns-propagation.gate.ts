import { runtimeConfig } from "../../config/runtime.js";
import { ConcurrencyGate } from "../../src/lib/concurrency-gate.js";

export const dnsPropagationGate = new ConcurrencyGate(
  "DNS propagation",
  runtimeConfig.limits.dnsPropagationMaxConcurrentGlobal,
  runtimeConfig.limits.dnsPropagationMaxConcurrentPerIp,
);
