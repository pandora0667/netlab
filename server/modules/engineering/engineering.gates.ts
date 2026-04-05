import { runtimeConfig } from "../../config/runtime.js";
import { ConcurrencyGate } from "../../src/lib/concurrency-gate.js";

export const engineeringGate = new ConcurrencyGate("engineering report", 16, 4);
export const websiteSecurityGate = new ConcurrencyGate("website security report", 10, 3);
export const emailSecurityGate = new ConcurrencyGate("email security report", 10, 3);
export const packetCaptureGate = new ConcurrencyGate(
  "packet capture analysis",
  runtimeConfig.limits.packetCaptureMaxConcurrentGlobal,
  runtimeConfig.limits.packetCaptureMaxConcurrentPerIp,
);
