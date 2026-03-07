import { ipInfoService } from "./ip-info.service.js";
import { pingService } from "./ping.service.js";
import { subnetService } from "./subnet.service.js";
import { whoisService } from "./whois.service.js";

export const networkService = {
  getIPInfo: (ip: string) => ipInfoService.getIPInfo(ip),
  calculateSubnet: (networkAddress: string, mask: string) =>
    subnetService.inspect(networkAddress, mask),
  ping: pingService.ping.bind(pingService),
  executePing: pingService.executePing.bind(pingService),
  calculateStatistics: pingService.calculateStatistics.bind(pingService),
  whoisLookup: (domain: string) => whoisService.lookup(domain),
};

export type {
  NetworkIpInfo,
  PingResult,
  PingStatistics,
  PingSummary,
  WhoisLookupResult,
  PingOptions,
} from "./network.types.js";
