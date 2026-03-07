import { Router } from "express";
import dnsV1Routes from "./dns/dns.v1.routes.js";
import dnsPropagationV1Routes from "./dns-propagation/dns-propagation.v1.routes.js";
import networkV1Routes from "./network/network.v1.routes.js";
import portScanV1Routes from "./port-scan/port-scan.v1.routes.js";

const router = Router();

router.use("/network", networkV1Routes);
router.use("/dns", dnsV1Routes);
router.use("/dns-propagation", dnsPropagationV1Routes);
router.use("/port-scans", portScanV1Routes);

export default router;
