import { whois } from "./whois-client.js";
import type { WhoisLookupResult } from "./network.types.js";

class WhoisService {
  async lookup(domain: string): Promise<WhoisLookupResult> {
    const data = await whois.lookup(domain);
    return { data };
  }
}

export const whoisService = new WhoisService();
