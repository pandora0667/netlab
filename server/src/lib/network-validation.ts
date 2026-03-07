import net from "net";

export interface PingOptions {
  type: "icmp" | "tcp";
  host: string;
  port?: number;
  count?: number;
  timeout?: number;
  retries?: number;
}

export class NetworkInputError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "NetworkInputError";
  }
}

const HOSTNAME_LABEL_PATTERN =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

function isValidHostname(host: string): boolean {
  if (host.length > 253) {
    return false;
  }

  const normalizedHost = host.endsWith(".") ? host.slice(0, -1) : host;

  if (normalizedHost === "localhost") {
    return true;
  }

  const labels = normalizedHost.split(".");
  return labels.length > 0 && labels.every((label) => HOSTNAME_LABEL_PATTERN.test(label));
}

export function isValidPingHost(host: string): boolean {
  const normalizedHost = host.trim();

  if (!normalizedHost) {
    return false;
  }

  return net.isIP(normalizedHost) !== 0 || isValidHostname(normalizedHost);
}

export function normalizePingOptions(input: Partial<PingOptions>): PingOptions {
  const host = String(input.host ?? "").trim();

  if (!isValidPingHost(host)) {
    throw new NetworkInputError(
      "Host must be a valid IPv4, IPv6, or hostname",
    );
  }

  const type = input.type;
  if (type !== "icmp" && type !== "tcp") {
    throw new NetworkInputError("Ping type must be either icmp or tcp");
  }

  const count = input.count == null ? 4 : Number(input.count);
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new NetworkInputError("Ping count must be an integer between 1 and 10");
  }

  const timeout = input.timeout == null ? 5000 : Number(input.timeout);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 30000) {
    throw new NetworkInputError(
      "Timeout must be an integer between 1000 and 30000 milliseconds",
    );
  }

  if (type === "tcp") {
    const port = Number(input.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new NetworkInputError("TCP ping requires a port between 1 and 65535");
    }

    return {
      type,
      host,
      port,
      count,
      timeout,
      retries: input.retries,
    };
  }

  return {
    type,
    host,
    count,
    timeout,
    retries: input.retries,
  };
}
