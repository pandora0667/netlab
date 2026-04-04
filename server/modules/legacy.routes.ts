import { Router } from "express";
import dnsLegacyRoutes from "./dns/dns.legacy.routes.js";
import dnsPropagationLegacyRoutes from "./dns-propagation/dns-propagation.legacy.routes.js";
import networkLegacyRoutes from "./network/network.legacy.routes.js";
import portScanLegacyRoutes from "./port-scan/port-scan.legacy.routes.js";

const router = Router();

router.use("/", networkLegacyRoutes);
router.use("/dns", dnsLegacyRoutes);
router.use("/dns-propagation", dnsPropagationLegacyRoutes);
router.use("/port-scanner", portScanLegacyRoutes);

export default router;

