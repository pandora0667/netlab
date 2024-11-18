import net from 'net';

interface WhoisOptions {
  server?: string;
  timeout?: number;
}

class WhoisClient {
  private defaultServer = 'whois.iana.org';
  private defaultTimeout = 5000;

  async lookup(domain: string, options: WhoisOptions = {}): Promise<string> {
    const server = options.server || this.defaultServer;
    const timeout = options.timeout || this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let data = '';

      client.setTimeout(timeout);

      client.connect(43, server, () => {
        client.write(domain + '\r\n');
      });

      client.on('data', (chunk) => {
        data += chunk;
      });

      client.on('close', () => {
        resolve(data);
      });

      client.on('error', (err) => {
        reject(new Error(`WHOIS lookup failed: ${err.message}`));
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error('WHOIS lookup timeout'));
      });
    });
  }
}

export const whois = {
  lookup: (domain: string) => {
    const client = new WhoisClient();
    return client.lookup(domain);
  }
};

export default whois;
