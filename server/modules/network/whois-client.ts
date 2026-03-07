import net from "node:net";

interface WhoisOptions {
  server?: string;
  timeout?: number;
}

const DEFAULT_WHOIS_SERVER = "whois.iana.org";
const DEFAULT_WHOIS_PORT = 43;
const DEFAULT_WHOIS_TIMEOUT_MS = 5_000;

class WhoisClient {
  private readonly defaultServer = DEFAULT_WHOIS_SERVER;
  private readonly defaultTimeoutMs = DEFAULT_WHOIS_TIMEOUT_MS;

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
}

export const whois = {
  lookup: (domain: string) => {
    const client = new WhoisClient();
    return client.lookup(domain);
  },
};

export default whois;
