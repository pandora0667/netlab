import type { Express } from "express";
import { networkServices, PingOptions } from "./services/network.js";
import dnsRoutes from "./routes/dns.js";
import portScannerRoutes from './routes/portScanner.js';
import dnsPropagationRoutes from './routes/dns-propagation.route.js';

export function registerRoutes(app: Express) {
  // Register DNS routes
  app.use('/api/dns', dnsRoutes);
  app.use('/dns-propagation', dnsPropagationRoutes);

  // Port Scanner routes
  app.use('/api/port-scanner', portScannerRoutes);

  app.get("/api/ip", async (req, res) => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = typeof forwarded === 'string' ? forwarded.split(/, /)[0] : req.socket.remoteAddress;

      if (!ip) {
        return res.status(400).json({ error: "Unable to extract IP address" });
      }

      const ipInfo = await networkServices.getIPInfo(ip);
      res.json(ipInfo);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch IP information" });
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
