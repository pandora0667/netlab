import { z } from "zod";
import { runtimeConfig } from "../../config/runtime.js";
import { assertPublicIPAddress } from "../../src/lib/public-targets.js";
import { PortScanError } from "./port-scan.service.js";

const MIN_PORT_NUMBER = 1;
const MAX_PORT_NUMBER = 65_535;
const MIN_TIMEOUT_MS = 100;

const portNumberSchema = z.coerce.number()
  .int()
  .min(MIN_PORT_NUMBER)
  .max(MAX_PORT_NUMBER);

const timeoutSchema = z.coerce
  .number()
  .int()
  .min(MIN_TIMEOUT_MS)
  .max(runtimeConfig.limits.portScanMaxTimeoutMs)
  .optional();

const protocolSchema = z.enum(["TCP", "UDP", "BOTH"]);

export const portScanExportSchema = z.object({
  results: z.object({
    TCP: z.record(z.string()).optional(),
    UDP: z.record(z.string()).optional(),
  }),
  format: z.enum(["JSON", "CSV"]),
});

function normalizePortList(portList: unknown): number[] {
  if (typeof portList === "string") {
    const parsedPorts = portList
      .split(",")
      .map((port) => port.trim())
      .filter(Boolean)
      .map((port) => portNumberSchema.parse(port));

    return [...new Set(parsedPorts)].sort((left, right) => left - right);
  }

  if (Array.isArray(portList)) {
    const parsedPorts = portList.map((port) => portNumberSchema.parse(port));
    return [...new Set(parsedPorts)].sort((left, right) => left - right);
  }

  return [];
}

function buildPortSelection(
  startPort: unknown,
  endPort: unknown,
  portList: unknown,
  portRange?: unknown,
) {
  const ports = normalizePortList(portList);

  if (ports.length > 0) {
    if (ports.length > runtimeConfig.limits.portScanMaxPorts) {
      throw new PortScanError(
        `Port scans are limited to ${runtimeConfig.limits.portScanMaxPorts} ports per request.`,
        "PORT_LIMIT_EXCEEDED",
      );
    }

    return {
      ports,
      portRange: [ports[0], ports[ports.length - 1]] as [number, number],
    };
  }

  const legacyPortRange = Array.isArray(portRange) ? portRange : null;
  const startCandidate = legacyPortRange?.[0] ?? startPort;
  const endCandidate = legacyPortRange?.[1] ?? endPort;
  const normalizedStartPort = portNumberSchema.parse(startCandidate);
  const normalizedEndPort = portNumberSchema.parse(endCandidate);

  if (normalizedStartPort > normalizedEndPort) {
    throw new PortScanError(
      "Start port must be less than or equal to end port",
      "INVALID_PORT_RANGE",
    );
  }

  const totalPorts = normalizedEndPort - normalizedStartPort + 1;
  if (totalPorts > runtimeConfig.limits.portScanMaxPorts) {
    throw new PortScanError(
      `Port scans are limited to ${runtimeConfig.limits.portScanMaxPorts} ports per request.`,
      "PORT_LIMIT_EXCEEDED",
    );
  }

  return {
    ports: Array.from(
      { length: totalPorts },
      (_, index) => normalizedStartPort + index,
    ),
    portRange: [normalizedStartPort, normalizedEndPort] as [number, number],
  };
}

export function parsePortScanRequest(input: Record<string, unknown>) {
  const parsedInput = z.object({
    targetIp: z.string().trim().min(1, "Target IP is required"),
    protocol: protocolSchema,
    timeout: timeoutSchema,
    startPort: z.unknown().optional(),
    endPort: z.unknown().optional(),
    portList: z.unknown().optional(),
    portRange: z.unknown().optional(),
  }).parse(input);

  const targetIp = assertPublicIPAddress(parsedInput.targetIp, "Port scan target");
  const { ports, portRange } = buildPortSelection(
    parsedInput.startPort,
    parsedInput.endPort,
    parsedInput.portList,
    parsedInput.portRange,
  );

  return {
    targetIp,
    protocol: parsedInput.protocol,
    timeout: parsedInput.timeout,
    ports,
    portRange,
  };
}
