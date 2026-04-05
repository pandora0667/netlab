import { httpInspectorService } from "../../network/http-inspector.service.js";
import { ipInfoService } from "../../network/ip-info.service.js";
import { pingService } from "../../network/ping.service.js";
import { traceService } from "../../network/trace.service.js";
import type { ReportHistoryStore } from "../domain/history.js";
import { InMemoryExpiringCache } from "../infrastructure/cache/in-memory-expiring-cache.js";
import { InMemoryReportHistoryStore } from "../infrastructure/cache/in-memory-report-history.js";
import {
  GoogleDnsProofClient,
  NodeDnsAdapter,
} from "../infrastructure/dns/dns-adapter.js";
import { ExternalJsonClient } from "../infrastructure/http/external-json-client.js";
import {
  Nat64Probe,
  PacketCaptureAnalyzer,
} from "../infrastructure/probes/lab-probes.js";
import {
  MtaStsPolicyProbe,
  PathMtuProbe,
  SecurityTxtProbe,
  StartTlsProbe,
  TcpFamilyProbe,
} from "../infrastructure/probes/network-probes.js";

export interface EngineeringDependencies {
  externalJsonClient: ExternalJsonClient;
  historyStore: ReportHistoryStore;
  nodeDns: NodeDnsAdapter;
  googleDns: GoogleDnsProofClient;
  tcpFamilyProbe: TcpFamilyProbe;
  pathMtuProbe: PathMtuProbe;
  securityTxtProbe: SecurityTxtProbe;
  startTlsProbe: StartTlsProbe;
  mtaStsPolicyProbe: MtaStsPolicyProbe;
  geoIpLookup: Pick<typeof ipInfoService, "getIPInfo">;
  httpInspection: Pick<typeof httpInspectorService, "inspect">;
  ping: Pick<typeof pingService, "executePing" | "calculateStatistics">;
  trace: Pick<typeof traceService, "trace">;
  packetCaptureAnalyzer: PacketCaptureAnalyzer;
  nat64Probe: Nat64Probe;
}

export function createEngineeringDependencies(): EngineeringDependencies {
  const externalJsonCache = new InMemoryExpiringCache<unknown>();
  const externalJsonClient = new ExternalJsonClient(externalJsonCache);

  return {
    externalJsonClient,
    historyStore: new InMemoryReportHistoryStore(),
    nodeDns: new NodeDnsAdapter(),
    googleDns: new GoogleDnsProofClient(externalJsonClient),
    tcpFamilyProbe: new TcpFamilyProbe(),
    pathMtuProbe: new PathMtuProbe(),
    securityTxtProbe: new SecurityTxtProbe(),
    startTlsProbe: new StartTlsProbe(),
    mtaStsPolicyProbe: new MtaStsPolicyProbe(),
    geoIpLookup: ipInfoService,
    httpInspection: httpInspectorService,
    ping: pingService,
    trace: traceService,
    packetCaptureAnalyzer: new PacketCaptureAnalyzer(),
    nat64Probe: new Nat64Probe(),
  };
}
