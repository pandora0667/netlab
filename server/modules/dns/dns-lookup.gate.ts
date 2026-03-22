import { runtimeConfig } from "../../config/runtime.js";
import { ConcurrencyGate } from "../../src/lib/concurrency-gate.js";

export const dnsLookupGate = new ConcurrencyGate(
  "DNS lookup",
  runtimeConfig.limits.dnsLookupMaxConcurrentGlobal,
  runtimeConfig.limits.dnsLookupMaxConcurrentPerIp,
);
