import net from "node:net";
import tls from "node:tls";
import { spawn } from "node:child_process";
import {
  DEFAULT_ENGINEERING_EHLO,
  DEFAULT_SMTP_TIMEOUT_MS,
  PMTU_MAX_PAYLOAD,
  PMTU_MIN_PAYLOAD,
  PMTU_TIMEOUT_MS,
  TCP_PROBE_TIMEOUT_MS,
} from "../../domain/constants.js";
import type {
  EmailSecurityReport,
  FamilyProbeResult,
  PathMtuAttempt,
} from "../../engineering.types.js";

export class TcpFamilyProbe {
  private async probeAddress(
    address: string,
    ports: number[],
    family: 4 | 6,
  ): Promise<FamilyProbeResult> {
    for (const port of ports) {
      const result = await new Promise<{
        reachable: boolean;
        latencyMs: number | null;
        error: string | null;
      }>((resolve) => {
        const socket = new net.Socket();
        const startedAt = process.hrtime.bigint();
        let settled = false;

        const finish = (payload: {
          reachable: boolean;
          latencyMs: number | null;
          error: string | null;
        }) => {
          if (settled) {
            return;
          }

          settled = true;
          socket.destroy();
          resolve(payload);
        };

        socket.setTimeout(TCP_PROBE_TIMEOUT_MS);
        socket.once("connect", () => {
          const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
          finish({
            reachable: true,
            latencyMs: elapsedMs,
            error: null,
          });
        });
        socket.once("timeout", () => {
          finish({
            reachable: false,
            latencyMs: null,
            error: "Timed out",
          });
        });
        socket.once("error", (error) => {
          finish({
            reachable: false,
            latencyMs: null,
            error: error instanceof Error ? error.message : "TCP probe failed",
          });
        });

        socket.connect({
          host: address,
          port,
          family,
        });
      });

      if (result.reachable) {
        return {
          addresses: [address],
          reachable: true,
          probePort: port,
          latencyMs: result.latencyMs,
          error: null,
        };
      }
    }

    return {
      addresses: [address],
      reachable: false,
      probePort: null,
      latencyMs: null,
      error: "No tested TCP ports accepted a connection",
    };
  }

  async probeFamily(
    addresses: string[],
    ports: number[],
    family: 4 | 6,
  ): Promise<FamilyProbeResult> {
    if (addresses.length === 0) {
      return {
        addresses: [],
        reachable: false,
        probePort: null,
        latencyMs: null,
        error: family === 4 ? "No A record" : "No AAAA record",
      };
    }

    const probeTargets = addresses.slice(0, 2);
    const settledResults = await Promise.all(
      probeTargets.map((address) => this.probeAddress(address, ports, family)),
    );

    const reachableResult = settledResults.find((result) => result.reachable);
    if (reachableResult) {
      return {
        ...reachableResult,
        addresses,
      };
    }

    const lastError = settledResults
      .map((result, index) => result.error ? `${probeTargets[index]}: ${result.error}` : null)
      .filter((value): value is string => Boolean(value))
      .join(" | ") || "No tested TCP ports accepted a connection";

    return {
      addresses,
      reachable: false,
      probePort: null,
      latencyMs: null,
      error: lastError,
    };
  }
}

export class PathMtuProbe {
  async probe(targetIp: string, family: 4 | 6 = 4) {
    const attempts: PathMtuAttempt[] = [];
    let low = PMTU_MIN_PAYLOAD;
    let high = PMTU_MAX_PAYLOAD;
    let best: number | null = null;
    const notes: string[] = [];

    const runPing = async (payloadSize: number) => {
      const isDarwin = process.platform === "darwin";
      const command = family === 6 ? "ping6" : "ping";
      const args = isDarwin
        ? family === 6
          ? ["-D", "-c", "1", "-W", String(PMTU_TIMEOUT_MS), "-s", String(payloadSize), targetIp]
          : ["-D", "-c", "1", "-W", String(PMTU_TIMEOUT_MS), "-t", "2", "-s", String(payloadSize), targetIp]
        : family === 6
          ? ["-c", "1", "-W", "2", "-s", String(payloadSize), targetIp]
          : ["-M", "do", "-c", "1", "-W", "2", "-s", String(payloadSize), targetIp];

      return new Promise<PathMtuAttempt>((resolve) => {
        const processHandle = spawn(command, args, { shell: false });
        let stderr = "";
        let stdout = "";
        let settled = false;
        const timeoutId = setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          processHandle.kill("SIGTERM");
          resolve({
            payloadSize,
            success: false,
            error: "Timed out",
          });
        }, PMTU_TIMEOUT_MS + 1_000);

        processHandle.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        processHandle.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        processHandle.on("error", (error) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeoutId);
          resolve({
            payloadSize,
            success: false,
            error: error instanceof Error ? error.message : "Ping command failed",
          });
        });
        processHandle.on("close", (code) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeoutId);
          resolve({
            payloadSize,
            success: code === 0,
            error: code === 0 ? null : (stderr.trim() || stdout.trim() || "Path MTU probe failed"),
          });
        });
      });
    };

    while (low <= high) {
      const midpoint = Math.floor((low + high) / 2);
      const attempt = await runPing(midpoint);
      attempts.push(attempt);

      if (attempt.success) {
        best = midpoint;
        low = midpoint + 1;
      } else {
        high = midpoint - 1;
      }
    }

    if (best == null) {
      notes.push("The probe did not find a successful DF packet inside the tested payload range.");
    } else {
      notes.push(
        family === 6
          ? "Estimated MTU adds the IPv6 and ICMPv6 overhead to the largest successful payload."
          : "Estimated MTU adds the IPv4 and ICMP overhead to the largest successful payload.",
      );
    }

    return {
      maxPayloadSize: best,
      estimatedPathMtu: best == null ? null : best + (family === 6 ? 48 : 28),
      attempts,
      notes,
    };
  }
}

export class SecurityTxtProbe {
  async probe(hostname: string) {
    const candidates = [
      `https://${hostname}/.well-known/security.txt`,
      `https://${hostname}/security.txt`,
    ];

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          headers: {
            accept: "text/plain",
            "user-agent": "Netlab Security/1.0",
          },
          signal: AbortSignal.timeout(5_000),
        });

        if (response.ok) {
          return {
            found: true,
            url,
          };
        }
      } catch {
        continue;
      }
    }

    return {
      found: false,
      url: null,
    };
  }
}

export class MtaStsPolicyProbe {
  async probe(domain: string) {
    try {
      const response = await fetch(`https://mta-sts.${domain}/.well-known/mta-sts.txt`, {
        headers: {
          accept: "text/plain",
          "user-agent": "Netlab Mail/1.0",
        },
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export class StartTlsProbe {
  async probe(host: string): Promise<EmailSecurityReport["startTls"][number]> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port: 25 });
      let stage: "greeting" | "ehlo" | "starttls" = "greeting";
      let buffer = "";
      const ehloLines: string[] = [];
      let settled = false;

      const finish = (payload: EmailSecurityReport["startTls"][number]) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();
        resolve(payload);
      };

      const timeoutId = setTimeout(() => {
        finish({
          host,
          supportsStartTls: false,
          tlsVersion: null,
          tlsAuthorized: null,
          tlsAuthorizationError: null,
          error: "SMTP probe timed out",
        });
      }, DEFAULT_SMTP_TIMEOUT_MS);

      const handleLine = (line: string) => {
        if (stage === "greeting" && /^220\b/.test(line)) {
          stage = "ehlo";
          socket.write(DEFAULT_ENGINEERING_EHLO);
          return;
        }

        if (stage === "ehlo" && /^250[\s-]/.test(line)) {
          ehloLines.push(line);

          if (line.startsWith("250 ")) {
            if (!ehloLines.some((ehloLine) => /STARTTLS/i.test(ehloLine))) {
              clearTimeout(timeoutId);
              finish({
                host,
                supportsStartTls: false,
                tlsVersion: null,
                tlsAuthorized: null,
                tlsAuthorizationError: null,
                error: null,
              });
              return;
            }

            stage = "starttls";
            socket.write("STARTTLS\r\n");
          }

          return;
        }

        if (stage === "starttls" && /^220\b/.test(line)) {
          socket.removeAllListeners("data");

          const tlsSocket = tls.connect({
            socket,
            servername: host,
            rejectUnauthorized: false,
          });

          tlsSocket.once("secureConnect", () => {
            clearTimeout(timeoutId);
            finish({
              host,
              supportsStartTls: true,
              tlsVersion: tlsSocket.getProtocol() || null,
              tlsAuthorized: tlsSocket.authorized,
              tlsAuthorizationError: tlsSocket.authorizationError
                ? String(tlsSocket.authorizationError)
                : null,
              error: null,
            });
            tlsSocket.end();
          });

          tlsSocket.once("error", (error) => {
            clearTimeout(timeoutId);
            finish({
              host,
              supportsStartTls: true,
              tlsVersion: null,
              tlsAuthorized: null,
              tlsAuthorizationError: null,
              error: error instanceof Error ? error.message : "TLS upgrade failed",
            });
          });

          return;
        }

        if (/^[45]\d\d\b/.test(line)) {
          clearTimeout(timeoutId);
          finish({
            host,
            supportsStartTls: false,
            tlsVersion: null,
            tlsAuthorized: null,
            tlsAuthorizationError: null,
            error: line,
          });
        }
      };

      socket.on("data", (chunk) => {
        buffer += chunk.toString();

        while (buffer.includes("\n")) {
          const newlineIndex = buffer.indexOf("\n");
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line) {
            handleLine(line);
          }
        }
      });

      socket.once("error", (error) => {
        clearTimeout(timeoutId);
        finish({
          host,
          supportsStartTls: false,
          tlsVersion: null,
          tlsAuthorized: null,
          tlsAuthorizationError: null,
          error: error instanceof Error ? error.message : "SMTP probe failed",
        });
      });
    });
  }
}
