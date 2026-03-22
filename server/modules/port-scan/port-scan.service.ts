import net from "net";
import dgram from "dgram";
import logger from "../../lib/logger.js";

export interface PortScanOptions {
  targetIp: string;
  portRange: [number, number];
  ports?: number[];
  protocol: "TCP" | "UDP" | "BOTH";
  timeout?: number;
  signal?: AbortSignal;
  onProgress?: (currentPort: number, results: PortScanResult) => void;
}

export interface PortScanResult {
  TCP?: Record<number, string>;
  UDP?: Record<number, string>;
}

function createAbortError(): PortScanError {
  return new PortScanError("Port scan was cancelled", "SCAN_CANCELLED", 499);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function attachAbortListener(signal: AbortSignal | undefined, onAbort: () => void) {
  if (!signal) {
    return () => {};
  }

  if (signal.aborted) {
    onAbort();
    return () => {};
  }

  signal.addEventListener("abort", onAbort, { once: true });

  return () => {
    signal.removeEventListener("abort", onAbort);
  };
}

async function scanTcpPort(
  ip: string,
  port: number,
  timeout: number,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const cleanupAbortListener = attachAbortListener(signal, () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve("Filtered");
      }
    });

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      if (!resolved) {
        resolved = true;
        cleanupAbortListener();
        socket.destroy();
        resolve("Open");
      }
    });

    socket.on("timeout", () => {
      if (!resolved) {
        resolved = true;
        cleanupAbortListener();
        socket.destroy();
        resolve("Filtered");
      }
    });

    socket.on("error", (error: Error & { code?: string }) => {
      if (!resolved) {
        resolved = true;
        cleanupAbortListener();
        socket.destroy();
        resolve(error.code === "ECONNREFUSED" ? "Closed" : "Filtered");
      }
    });

    try {
      socket.connect(port, ip);
    } catch {
      if (!resolved) {
        resolved = true;
        cleanupAbortListener();
        socket.destroy();
        resolve("Filtered");
      }
    }
  });
}

async function scanUdpPort(
  ip: string,
  port: number,
  timeout: number,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanupAbortListener();
        socket.close();
        resolve("Open|Filtered");
      }
    }, timeout);

    const cleanupAbortListener = attachAbortListener(signal, () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.close();
        resolve("Filtered");
      }
    });

    socket.on("error", (error: Error & { code?: string }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanupAbortListener();
        socket.close();
        resolve(error.code === "ECONNREFUSED" ? "Closed" : "Filtered");
      }
    });

    try {
      socket.send(Buffer.alloc(0), port, ip, (error) => {
        if (error && !resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          cleanupAbortListener();
          socket.close();
          resolve("Filtered");
        }
      });
    } catch {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanupAbortListener();
        socket.close();
        resolve("Filtered");
      }
    }
  });
}

export async function portScan(options: PortScanOptions): Promise<PortScanResult> {
  const {
    targetIp,
    portRange,
    ports = Array.from(
      { length: portRange[1] - portRange[0] + 1 },
      (_, index) => portRange[0] + index,
    ),
    protocol = "TCP",
    timeout = 1_000,
    signal,
    onProgress,
  } = options;

  throwIfAborted(signal);

  const results: PortScanResult = {};
  const scanProtocols = protocol === "BOTH" ? ["TCP", "UDP"] : [protocol];

  for (const currentProtocol of scanProtocols) {
    results[currentProtocol as "TCP" | "UDP"] = {};

    for (const port of ports) {
      throwIfAborted(signal);

      try {
        const scanFunction = currentProtocol === "TCP" ? scanTcpPort : scanUdpPort;
        const status = await scanFunction(targetIp, port, timeout, signal);

        if (currentProtocol === "TCP") {
          results.TCP![port] = status;
        } else {
          results.UDP![port] = status;
        }

        onProgress?.(port, results);
      } catch (error) {
        if (error instanceof PortScanError && error.code === "SCAN_CANCELLED") {
          throw error;
        }

        logger.warn("Port scan step failed", {
          targetIp,
          port,
          protocol: currentProtocol,
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }

  return results;
}

export function exportResults(results: PortScanResult, format: "JSON" | "CSV"): string {
  if (format === "JSON") {
    return JSON.stringify(results, null, 2);
  }

  const rows = ["Protocol,Port,Status"];

  if (results.TCP) {
    Object.entries(results.TCP).forEach(([port, status]) => {
      rows.push(`TCP,${port},${status}`);
    });
  }

  if (results.UDP) {
    Object.entries(results.UDP).forEach(([port, status]) => {
      rows.push(`UDP,${port},${status}`);
    });
  }

  return rows.join("\n");
}

export class PortScanError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "PortScanError";
  }
}

export const WELL_KNOWN_PORTS = {
  TCP: {
    20: { service: "FTP-DATA", description: "File Transfer Protocol (Data)" },
    21: { service: "FTP", description: "File Transfer Protocol (Control)" },
    22: { service: "SSH", description: "Secure Shell" },
    23: { service: "Telnet", description: "Telnet protocol" },
    25: { service: "SMTP", description: "Simple Mail Transfer Protocol" },
    53: { service: "DNS", description: "Domain Name System" },
    80: { service: "HTTP", description: "Hypertext Transfer Protocol" },
    110: { service: "POP3", description: "Post Office Protocol v3" },
    143: { service: "IMAP", description: "Internet Message Access Protocol" },
    443: { service: "HTTPS", description: "HTTP over TLS/SSL" },
    465: { service: "SMTPS", description: "SMTP over TLS/SSL" },
    587: { service: "SUBMISSION", description: "Message Submission" },
    993: { service: "IMAPS", description: "IMAP over TLS/SSL" },
    995: { service: "POP3S", description: "POP3 over TLS/SSL" },
    1433: { service: "MSSQL", description: "Microsoft SQL Server" },
    3306: { service: "MySQL", description: "MySQL Database" },
    5432: { service: "PostgreSQL", description: "PostgreSQL Database" },
    27017: { service: "MongoDB", description: "MongoDB Database" },
    6379: { service: "Redis", description: "Redis Database" },
    3389: { service: "RDP", description: "Remote Desktop Protocol" },
    5900: { service: "VNC", description: "Virtual Network Computing" },
    853: { service: "DNS-TLS", description: "DNS over TLS" },
    1935: { service: "RTMP", description: "Real-Time Messaging Protocol" },
    5353: { service: "mDNS", description: "Multicast DNS" },
    27015: { service: "Source", description: "Source Engine Game Server" },
    161: { service: "SNMP", description: "Simple Network Management Protocol" },
    162: { service: "SNMPTRAP", description: "SNMP Trap" },
    88: { service: "Kerberos", description: "Kerberos Authentication" },
    389: { service: "LDAP", description: "Lightweight Directory Access Protocol" },
    636: { service: "LDAPS", description: "LDAP over TLS/SSL" },
  },
  UDP: {
    53: { service: "DNS", description: "Domain Name System" },
    67: { service: "DHCP", description: "Dynamic Host Configuration Protocol (Server)" },
    68: { service: "DHCP", description: "Dynamic Host Configuration Protocol (Client)" },
    69: { service: "TFTP", description: "Trivial File Transfer Protocol" },
    123: { service: "NTP", description: "Network Time Protocol" },
    161: { service: "SNMP", description: "Simple Network Management Protocol" },
    162: { service: "SNMPTRAP", description: "SNMP Trap" },
    514: { service: "Syslog", description: "System Logging Protocol" },
  },
} as const;
