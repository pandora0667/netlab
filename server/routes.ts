import type { Express } from "express";
import v1Routes from "./modules/v1.routes.js";
import legacyNetworkRoutes from "./modules/network/network.legacy.routes.js";
import dnsRoutes from "./modules/dns/dns.legacy.routes.js";
import portScannerRoutes from "./modules/port-scan/port-scan.legacy.routes.js";
import dnsPropagationRoutes from "./modules/dns-propagation/dns-propagation.legacy.routes.js";

export function registerRoutes(app: Express) {
  app.use("/api/v1", v1Routes);
  app.use("/api", legacyNetworkRoutes);
  app.use("/api/dns", dnsRoutes);
  app.use("/api/dns-propagation", dnsPropagationRoutes);
  app.use("/api/port-scanner", portScannerRoutes);
}
