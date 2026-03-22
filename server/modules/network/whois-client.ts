import net from "node:net";
import { assertPublicIPAddress } from "../../src/lib/public-targets.js";

interface WhoisOptions {
  server?: string;
  timeout?: number;
}

const DEFAULT_WHOIS_SERVER = "whois.iana.org";
const DEFAULT_WHOIS_PORT = 43;
const DEFAULT_WHOIS_TIMEOUT_MS = 5_000;
const MAX_WHOIS_HOPS = 3;
const WHOIS_CACHE_TTL_MS = 5 * 60 * 1000;

function isLikelyIpAddress(input: string) {
  return net.isIP(input) !== 0;
}

function isLikelyDomain(input: string) {
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input);
}

function extractReferralServer(response: string): string | null {
  const match = response.match(
    /^(?:refer|whois|ReferralServer|Registrar WHOIS Server)\s*:\s*(.+)$/im,
  );

  if (!match?.[1]) {
    return null;
  }

  const rawValue = match[1].trim().replace(/^whois:\/\//i, "");
  if (!rawValue) {
    return null;
  }

  return rawValue.split(/[\/\s]/)[0].trim() || null;
}

class WhoisClient {
  private readonly defaultServer = DEFAULT_WHOIS_SERVER;
  private readonly defaultTimeoutMs = DEFAULT_WHOIS_TIMEOUT_MS;
  private readonly cache = new Map<string, { data: string; expiresAt: number }>();

  async lookup(domain: string, options: WhoisOptions = {}): Promise<string> {
    const server = options.server || this.defaultServer;
    const timeoutMs = options.timeout || this.defaultTimeoutMs;

    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let data = "";

      client.setTimeout(timeoutMs);

      client.connect(DEFAULT_WHOIS_PORT, server, () => {
        client.write(`${domain}\r\n`);
      });

      client.on("data", (chunk) => {
        data += chunk;
      });

      client.on("close", () => {
        resolve(data);
      });

      client.on("error", (err) => {
        reject(new Error(`WHOIS lookup failed: ${err.message}`));
      });

      client.on("timeout", () => {
        client.destroy();
        reject(new Error("WHOIS lookup timeout"));
      });
    });
  }

  private normalizeQuery(input: string) {
    const normalizedInput = input.trim().toLowerCase();

    if (!normalizedInput) {
      throw new Error("WHOIS target is required");
    }

    if (isLikelyIpAddress(normalizedInput)) {
      return assertPublicIPAddress(normalizedInput, "WHOIS target");
    }

    if (!isLikelyDomain(normalizedInput)) {
      throw new Error("WHOIS target must be a valid public IP address or hostname");
    }

    return normalizedInput;
  }

  async lookupWithReferral(target: string): Promise<string> {
    const normalizedTarget = this.normalizeQuery(target);
    const cacheKey = normalizedTarget;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const visitedServers = new Set<string>();
    const responses: string[] = [];
    let currentServer: string | null = this.defaultServer;

    for (let hop = 0; hop < MAX_WHOIS_HOPS && currentServer; hop += 1) {
      const normalizedServer = currentServer.toLowerCase();
      if (visitedServers.has(normalizedServer)) {
        break;
      }

      visitedServers.add(normalizedServer);
      const response = await this.lookup(normalizedTarget, {
        server: currentServer,
      });

      responses.push(`# ${currentServer}\n\n${response.trim()}`);

      const referralServer = extractReferralServer(response);
      if (!referralServer || visitedServers.has(referralServer.toLowerCase())) {
        break;
      }

      currentServer = referralServer;
    }

    const combinedResponse = responses.join("\n\n");
    this.cache.set(cacheKey, {
      data: combinedResponse,
      expiresAt: Date.now() + WHOIS_CACHE_TTL_MS,
    });

    return combinedResponse;
  }
}

const whoisClient = new WhoisClient();

export const whois = {
  lookup: (domain: string) => whoisClient.lookupWithReferral(domain),
};

export default whois;
