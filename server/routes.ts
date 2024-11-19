import type { Express } from "express";
import { networkServices, PingOptions } from "./services/network";

export function registerRoutes(app: Express) {
  app.get("/api/ip", async (req, res) => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = typeof forwarded === 'string' ? forwarded.split(/, /)[0] : req.socket.remoteAddress;

      if (!ip) {
        return res.status(400).json({ error: "IP 주소를 추출할 수 없습니다." });
      }

      const ipInfo = await networkServices.getIPInfo(ip);
      res.json(ipInfo);
    } catch (error: any) {
      res.status(500).json({ error: "IP 정보를 가져오는 데 실패했습니다." });
    }
  });

  app.post("/api/dns", async (req, res) => {
    const { domain, servers, includeAllRecords } = req.body;

    if (!domain || !servers || !servers.length) {
      return res.status(400).json({
        success: false,
        error: 'Domain and servers are required'
      });
    }

    try {
      const results: Record<string, any[]> = {};
      const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA'];

      for (const recordType of recordTypes) {
        results[recordType] = [];
        for (const server of servers) {
          try {
            const result = await networkServices.dnsLookup(domain, recordType, server);
            if (result.records) {
              results[recordType].push({
                server,
                records: result.records,
                queryTime: 0,
                timestamp: Date.now()
              });
            }
          } catch (error) {
            console.error(`Error querying ${recordType} records from ${server}:`, error);
          }
        }
      }

      return res.json({
        success: true,
        domain,
        results
      });
    } catch (error: any) {
      console.error('DNS Lookup error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'DNS lookup failed'
      });
    }
  });

  app.post("/api/subnet", (req, res) => {
    try {
      const { ip, mask } = req.body;
      const info = networkServices.calculateSubnet(ip, mask);
      res.json(info);
    } catch (error: any) {
      res.status(500).json({ error: "Subnet calculation failed" });
    }
  });

  app.post("/api/ping", async (req, res) => {
    try {
      const options: PingOptions = req.body;
      const result = await networkServices.ping(options);
      res.json(result);
    } catch (error: any) {
      console.error('Ping error:', error);
      res.status(500).json({ error: "Ping failed" });
    }
  });

  app.post("/api/whois", async (req, res) => {
    try {
      const { domain } = req.body;
      const info = await networkServices.whoisLookup(domain);
      res.json(info);
    } catch (error: any) {
      res.status(500).json({ error: "WHOIS lookup failed" });
    }
  });
}
