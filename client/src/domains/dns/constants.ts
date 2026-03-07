import type { DNSResolverOption } from "./types";

export const DNS_RESOLVER_OPTIONS: DNSResolverOption[] = [
  { id: "google", name: "Google DNS", address: "8.8.8.8" },
  { id: "cloudflare", name: "Cloudflare", address: "1.1.1.1" },
  { id: "opendns", name: "OpenDNS", address: "208.67.222.222" },
];
