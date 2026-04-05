export type SiteNavigationGroup = "Overview" | "Tools";
export type TechnicalLayerKey =
  | "overview"
  | "identity"
  | "addressing"
  | "dns"
  | "connectivity"
  | "service"
  | "controlPlane"
  | "exposure";

export interface TechnicalLayerDefinition {
  key: TechnicalLayerKey;
  label: string;
  description: string;
  shortLabel: string;
}

export interface SitePaletteDefinition {
  id: string;
  group: SiteNavigationGroup;
  layer: TechnicalLayerKey;
  label: string;
  description: string;
  keywords?: string[];
  category: string;
  commandHint: string;
  accent: string;
  useCase: string;
  primaryNavLabel?: string;
}

export interface SitePageCatalogDefinition {
  path: string;
  title: string;
  description: string;
  imageAlt: string;
  changeFrequency: "weekly" | "monthly";
  priority: string;
  noIndex?: boolean;
  palette?: SitePaletteDefinition;
  recommendedNext?: string[];
}

export const technicalLayerCatalog = [
  {
    key: "overview",
    label: "Overview",
    shortLabel: "Overview",
    description: "Start at the launchpad, switch layers quickly, and move into the right diagnostic surface.",
  },
  {
    key: "identity",
    label: "Identity",
    shortLabel: "Identity",
    description: "Confirm public identity, ownership, and registration context before deeper diagnostics.",
  },
  {
    key: "addressing",
    label: "Addressing",
    shortLabel: "Addressing",
    description: "Plan networks, verify masks, and reason about address boundaries and host capacity.",
  },
  {
    key: "dns",
    label: "DNS",
    shortLabel: "DNS",
    description: "Inspect resolver truth, delegation rollout, and global answer drift across the naming layer.",
  },
  {
    key: "connectivity",
    label: "Connectivity",
    shortLabel: "Path",
    description: "Measure reachability, latency, and hop-by-hop path behavior before assuming service failure.",
  },
  {
    key: "service",
    label: "Service Edge",
    shortLabel: "Service",
    description: "Inspect HTTP, TLS, and security posture where applications meet the public internet.",
  },
  {
    key: "controlPlane",
    label: "Control Plane",
    shortLabel: "Control",
    description: "Validate routing, authority, dual-stack parity, and edge policy from an operator point of view.",
  },
  {
    key: "exposure",
    label: "Exposure",
    shortLabel: "Exposure",
    description: "Review bounded surface area and externally reachable services without private-network discovery.",
  },
] as const satisfies readonly TechnicalLayerDefinition[];

export const sitePageCatalog = {
  home: {
    path: "/",
    title: "Netlab | Public Network Diagnostics Workspace",
    description:
      "Run public DNS, path, routing, HTTP/TLS, website security, email posture, and bounded port diagnostics from one operator-focused network workspace.",
    imageAlt: "Netlab network diagnostics workspace preview",
    changeFrequency: "weekly",
    priority: "1.0",
    palette: {
      id: "home",
      group: "Overview",
      layer: "overview",
      label: "Home",
      description: "Return to the main diagnostics launchpad.",
      keywords: ["start", "dashboard"],
      category: "Launchpad",
      commandHint: "open netlab",
      accent: "Command Center",
      useCase: "Start a diagnostic workflow or switch to another tool.",
      primaryNavLabel: "Overview",
    },
  },
  ipChecker: {
    path: "/ip-checker",
    title: "IP Checker | Public IP and Connection Details | Netlab",
    description:
      "Check your public IP address, location context, and network details with a focused browser-based IP checker.",
    imageAlt: "Netlab IP checker preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "ip-checker",
      group: "Tools",
      layer: "identity",
      label: "IP Checker",
      description: "Inspect public IP, region, and ISP metadata.",
      keywords: ["public", "address", "geo"],
      category: "Identity",
      commandHint: "check public ip",
      accent: "Geolocation",
      useCase: "Useful when you need to confirm public egress identity first.",
      primaryNavLabel: "IP",
    },
  },
  dnsLookup: {
    path: "/dns-lookup",
    title: "DNS Lookup | Query A, AAAA, MX, TXT, and More | Netlab",
    description:
      "Look up DNS records including A, AAAA, MX, TXT, CNAME, NS, and SOA against public resolvers or a custom DNS server.",
    imageAlt: "Netlab DNS lookup preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "dns-lookup",
      group: "Tools",
      layer: "dns",
      label: "DNS Lookup",
      description: "Query and compare DNS records across resolvers.",
      keywords: ["record", "a", "mx", "txt"],
      category: "Resolution",
      commandHint: "lookup dns records",
      accent: "Resolver View",
      useCase: "Best first step for hostname resolution or record verification.",
      primaryNavLabel: "DNS",
    },
  },
  subnetCalculator: {
    path: "/subnet-calc",
    title: "Subnet Calculator | CIDR, Masks, and Host Ranges | Netlab",
    description:
      "Calculate subnet ranges, host counts, network addresses, and export subnet plans from CIDR prefixes or dotted decimal masks.",
    imageAlt: "Netlab subnet calculator preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "subnet-calc",
      group: "Tools",
      layer: "addressing",
      label: "Subnet Calculator",
      description: "Calculate CIDR ranges, masks, and host counts.",
      keywords: ["cidr", "mask", "network"],
      category: "Addressing",
      commandHint: "inspect subnet",
      accent: "CIDR Math",
      useCase: "Use for network planning, mask conversion, and host capacity checks.",
      primaryNavLabel: "Subnet",
    },
  },
  pingTool: {
    path: "/ping",
    title: "Ping Tool | Check Public Host Reachability | Netlab",
    description:
      "Test public host reachability and latency with a live ping tool designed for quick troubleshooting and repeat checks.",
    imageAlt: "Netlab ping tool preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "ping",
      group: "Tools",
      layer: "connectivity",
      label: "Ping",
      description: "Measure latency and reachability over ICMP or TCP.",
      keywords: ["latency", "icmp", "connectivity"],
      category: "Reachability",
      commandHint: "probe latency",
      accent: "Latency Trace",
      useCase: "Use when you need a fast reachability check before deeper tracing.",
      primaryNavLabel: "Ping",
    },
  },
  traceTool: {
    path: "/trace",
    title: "Trace Route | Bounded Hop-by-Hop Path Probe | Netlab",
    description:
      "Trace the public path toward a host with a bounded hop-by-hop probe to see where latency or timeouts begin.",
    imageAlt: "Netlab trace route preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "trace",
      group: "Tools",
      layer: "connectivity",
      label: "Trace Route",
      description: "Trace the public path hop by hop and spot where delay begins.",
      keywords: ["traceroute", "hops", "route", "path"],
      category: "Path",
      commandHint: "trace route",
      accent: "Hop Map",
      useCase: "Use after Ping when latency or routing looks inconsistent.",
      primaryNavLabel: "Trace",
    },
  },
  networkEngineering: {
    path: "/network-engineering",
    title: "Network Engineering Workbench | Routing, Authority, IPv6, and MTU | Netlab",
    description:
      "Inspect routing visibility, origin ASN, RPKI, DNS authority health, IPv4 and IPv6 parity, and path MTU from one operator-focused workbench.",
    imageAlt: "Netlab network engineering workbench preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "network-engineering",
      group: "Tools",
      layer: "controlPlane",
      label: "Network Engineering",
      description: "Inspect routing state, DNS authority, dual-stack parity, and path MTU.",
      keywords: ["bgp", "rpki", "authority", "ipv6", "mtu"],
      category: "Engineering",
      commandHint: "inspect control plane",
      accent: "Operator Depth",
      useCase: "Best when you need control-plane and dual-stack context, not just host reachability.",
      primaryNavLabel: "Engineering",
    },
    recommendedNext: ["routingIncidentExplorer", "ipv6TransitionLab", "performanceLab"],
  },
  routingIncidentExplorer: {
    path: "/routing-incidents",
    title: "Routing Incident Explorer | BGP Drift, Withdrawals, and ROA Context | Netlab",
    description:
      "Explore recent BGP announcements, withdrawals, AS-path changes, origin drift, and ROA evidence around a public route.",
    imageAlt: "Netlab routing incident explorer preview",
    changeFrequency: "weekly",
    priority: "0.8",
    palette: {
      id: "routing-incidents",
      group: "Tools",
      layer: "controlPlane",
      label: "Routing Incidents",
      description: "Replay recent BGP events, origin drift, and path changes.",
      keywords: ["bgp updates", "withdrawal", "bgplay", "incident", "route drift"],
      category: "Incidents",
      commandHint: "replay routing incident",
      accent: "Incident Replay",
      useCase: "Use when the current route looks wrong and you need the recent control-plane change timeline, not just the present state.",
    },
    recommendedNext: ["networkEngineering", "ipv6TransitionLab", "performanceLab"],
  },
  httpInspector: {
    path: "/http-inspector",
    title: "HTTP and TLS Inspector | Headers, Redirects, and Certificates | Netlab",
    description:
      "Inspect redirect chains, response headers, TLS versions, HSTS, and certificate expiry for a public web target.",
    imageAlt: "Netlab HTTP and TLS inspector preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "http-inspector",
      group: "Tools",
      layer: "service",
      label: "HTTP/TLS Inspector",
      description: "Inspect redirects, headers, TLS versions, and certificate health.",
      keywords: ["tls", "https", "headers", "certificate"],
      category: "Application",
      commandHint: "inspect http tls",
      accent: "Service Layer",
      useCase: "Best when the hostname resolves but the web service still feels wrong.",
      primaryNavLabel: "HTTP/TLS",
    },
    recommendedNext: ["websiteSecurity", "packetCaptureLab", "networkEngineering"],
  },
  websiteSecurity: {
    path: "/website-security",
    title: "Website Security Posture | HTTP, TLS, DNSSEC, and CAA | Netlab",
    description:
      "Score website security posture with checks for headers, TLS, HSTS, DNSSEC, CAA, and security.txt.",
    imageAlt: "Netlab website security posture preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "website-security",
      group: "Tools",
      layer: "service",
      label: "Website Security",
      description: "Score website security posture across HTTP, TLS, and DNS controls.",
      keywords: ["headers", "security.txt", "caa", "dnssec"],
      category: "Posture",
      commandHint: "score website posture",
      accent: "Security Grade",
      useCase: "Use when you want an explainable website posture score instead of raw header output.",
      primaryNavLabel: "Web Security",
    },
    recommendedNext: ["httpInspector", "dnsLookup", "emailSecurity"],
  },
  whoisLookup: {
    path: "/whois",
    title: "WHOIS Lookup | Domain Registration Details | Netlab",
    description:
      "Inspect domain registration records, registrar details, and ownership metadata with a focused WHOIS lookup tool.",
    imageAlt: "Netlab WHOIS lookup preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "whois",
      group: "Tools",
      layer: "identity",
      label: "WHOIS",
      description: "Inspect registration metadata for domains and IPs.",
      keywords: ["domain", "registration", "registrar"],
      category: "Ownership",
      commandHint: "inspect whois",
      accent: "Registration Data",
      useCase: "Useful for registrar, delegation, and registration context.",
      primaryNavLabel: "WHOIS",
    },
  },
  emailSecurity: {
    path: "/email-security",
    title: "Email Security Checker | SPF, DMARC, DKIM, and STARTTLS | Netlab",
    description:
      "Inspect email security posture across MX, SPF, DMARC, DKIM heuristics, STARTTLS, MTA-STS, and TLS-RPT.",
    imageAlt: "Netlab email security checker preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "email-security",
      group: "Tools",
      layer: "service",
      label: "Email Security",
      description: "Inspect SPF, DMARC, DKIM heuristics, MX posture, and STARTTLS.",
      keywords: ["spf", "dmarc", "dkim", "mx", "starttls"],
      category: "Mail",
      commandHint: "check mail posture",
      accent: "Mail Controls",
      useCase: "Best when mail deliverability or transport security feels incomplete.",
      primaryNavLabel: "Email",
    },
    recommendedNext: ["dnsLookup", "httpInspector", "websiteSecurity"],
  },
  dnsPropagation: {
    path: "/dns-propagation",
    title: "DNS Propagation Checker | Compare Resolver Rollout | Netlab",
    description:
      "Track DNS propagation across global resolvers and compare record responses while updates roll out.",
    imageAlt: "Netlab DNS propagation checker preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "dns-propagation",
      group: "Tools",
      layer: "dns",
      label: "DNS Propagation",
      description: "Compare answers from resolvers around the world.",
      keywords: ["nameserver", "global", "resolve"],
      category: "Propagation",
      commandHint: "watch propagation",
      accent: "Global Nodes",
      useCase: "Use after changing records and waiting for global resolver convergence.",
      primaryNavLabel: "Propagation",
    },
  },
  portScanner: {
    path: "/port-scan",
    title: "Port Scanner | Bounded Public Port Checks | Netlab",
    description:
      "Run bounded public port scans to confirm exposed services and troubleshoot connectivity without scanning private networks.",
    imageAlt: "Netlab port scanner preview",
    changeFrequency: "weekly",
    priority: "0.9",
    palette: {
      id: "port-scan",
      group: "Tools",
      layer: "exposure",
      label: "Port Scanner",
      description: "Scan exposed ports on an approved public target.",
      keywords: ["tcp", "open", "ports"],
      category: "Surface",
      commandHint: "scan tcp ports",
      accent: "Attack Surface",
      useCase: "Use when you need a bounded view of externally reachable services.",
      primaryNavLabel: "Port Scan",
    },
  },
  packetCaptureLab: {
    path: "/packet-capture-lab",
    title: "Packet Capture Analysis | Protocols, Flows, and Expert Findings | Netlab",
    description:
      "Upload a pcap or pcapng file for one-shot analysis of protocol hierarchy, flow summaries, TCP anomalies, and DNS, HTTP, TLS, or QUIC evidence.",
    imageAlt: "Netlab packet capture analysis preview",
    changeFrequency: "weekly",
    priority: "0.8",
    palette: {
      id: "packet-capture-lab",
      group: "Tools",
      layer: "service",
      label: "Packet Capture Analysis",
      description: "Analyze uploaded pcap artifacts without active scanning.",
      keywords: ["pcap", "tshark", "flow", "wireshark"],
      category: "Capture",
      commandHint: "analyze packet capture",
      accent: "Offline Analysis",
      useCase: "Use when you have a capture file and need protocol, flow, and anomaly context without probing the network again.",
    },
    recommendedNext: ["httpInspector", "performanceLab", "networkEngineering"],
  },
  performanceLab: {
    path: "/performance-lab",
    title: "Performance Analysis | Jitter, Loss, Quality, and Path Context | Netlab",
    description:
      "Sample latency, jitter, packet loss, trace behavior, and path MTU to reason about path quality without running full bandwidth tests.",
    imageAlt: "Netlab performance analysis preview",
    changeFrequency: "weekly",
    priority: "0.8",
    palette: {
      id: "performance-lab",
      group: "Tools",
      layer: "connectivity",
      label: "Performance Analysis",
      description: "Reason about jitter, loss, and path quality from lightweight probes.",
      keywords: ["jitter", "loss", "latency", "quality"],
      category: "Performance",
      commandHint: "measure path quality",
      accent: "Path Quality",
      useCase: "Use when users report slowness and you need a path-quality view before heavier testing.",
    },
    recommendedNext: ["traceTool", "networkEngineering", "ipv6TransitionLab"],
  },
  ipv6TransitionLab: {
    path: "/ipv6-transition",
    title: "IPv6 Transition Analysis | Happy Eyeballs, DNS64, NAT64, and Fallback | Netlab",
    description:
      "Inspect dual-stack behavior with Happy Eyeballs reasoning, DNS64 or NAT64 detection, fallback patterns, and family-specific path MTU signals.",
    imageAlt: "Netlab IPv6 transition analysis preview",
    changeFrequency: "weekly",
    priority: "0.8",
    palette: {
      id: "ipv6-transition",
      group: "Tools",
      layer: "controlPlane",
      label: "IPv6 Transition Analysis",
      description: "Model dual-stack fallback, DNS64/NAT64, and family drift.",
      keywords: ["happy eyeballs", "dns64", "nat64", "dual stack", "ipv6"],
      category: "Transition",
      commandHint: "inspect ipv6 transition",
      accent: "Dual-Stack Drift",
      useCase: "Best when IPv4 works, IPv6 feels inconsistent, or fallback behavior is hiding the real failure mode.",
    },
    recommendedNext: ["networkEngineering", "routingIncidentExplorer", "dnsLookup"],
  },
  notFound: {
    path: "/404",
    title: "Page Not Found | Netlab",
    description:
      "The requested Netlab page does not exist or may have moved.",
    imageAlt: "Netlab page not found preview",
    changeFrequency: "monthly",
    priority: "0.1",
    noIndex: true,
  },
} as const satisfies Record<string, SitePageCatalogDefinition>;

export type SitePageKey = keyof typeof sitePageCatalog;
export type SitePageEntry<K extends SitePageKey = SitePageKey> = {
  key: K;
} & (typeof sitePageCatalog)[K];
export type PaletteSitePageKey = {
  [K in SitePageKey]: (typeof sitePageCatalog)[K] extends { palette: SitePaletteDefinition }
    ? K
    : never;
}[SitePageKey];
export type PaletteSitePageEntry = {
  [K in PaletteSitePageKey]: SitePageEntry<K>;
}[PaletteSitePageKey];
export type TechnicalLayerEntry = (typeof technicalLayerCatalog)[number];

export interface WorkflowCatalogDefinition {
  id: string;
  title: string;
  description: string;
  steps: SitePageKey[];
}

export const workflowCatalog: WorkflowCatalogDefinition[] = [
  {
    id: "domain-debug",
    title: "A hostname is not resolving",
    description: "Start with resolver truth, then confirm whether propagation or ownership is involved.",
    steps: ["dnsLookup", "dnsPropagation", "whoisLookup"],
  },
  {
    id: "service-debug",
    title: "A site is up, but users report failures",
    description: "Separate transport, path, and application issues instead of guessing one layer.",
    steps: ["pingTool", "traceTool", "websiteSecurity"],
  },
  {
    id: "surface-review",
    title: "You need a public exposure snapshot",
    description: "Confirm identity first, then inspect open surface and ownership context.",
    steps: ["ipChecker", "portScanner", "whoisLookup"],
  },
  {
    id: "control-plane-debug",
    title: "The route or edge policy feels wrong",
    description: "Check origin state, authority health, dual-stack drift, and path MTU before escalating upstream.",
    steps: ["networkEngineering", "routingIncidentExplorer", "ipv6TransitionLab", "performanceLab"],
  },
  {
    id: "capture-review",
    title: "You already have a packet capture",
    description: "Start with the offline artifact, then branch into edge or path checks only where the capture points next.",
    steps: ["packetCaptureLab", "httpInspector", "performanceLab"],
  },
];

export const sitePageKeys = Object.keys(sitePageCatalog) as SitePageKey[];

export function getSitePageEntry<K extends SitePageKey>(key: K): SitePageEntry<K> {
  return {
    key,
    ...sitePageCatalog[key],
  };
}

export function getAllSitePages() {
  return sitePageKeys.map((key) => getSitePageEntry(key));
}

export function getRoutableSitePages() {
  return getAllSitePages().filter((page) => page.key !== "notFound");
}

function hasPalette(page: SitePageEntry): page is PaletteSitePageEntry {
  return "palette" in page;
}

export function getPalettePages() {
  return getAllSitePages().filter(hasPalette);
}

export function getPalettePageByPath(path: string) {
  return getPalettePages().find((page) => page.path === path);
}

export function getTechnicalLayers() {
  return [...technicalLayerCatalog];
}

export function getTechnicalLayerByKey(key: TechnicalLayerKey) {
  return technicalLayerCatalog.find((layer) => layer.key === key);
}

export function getTechnicalLayerGroups() {
  return technicalLayerCatalog.map((layer) => ({
    ...layer,
    pages: getPalettePages().filter((page) => page.palette.layer === layer.key),
  })).filter((group) => group.pages.length > 0);
}

export function getToolPages() {
  return getPalettePages().filter((page) => page.palette.group === "Tools");
}

export function getPrimaryNavigationPages() {
  return getToolPages().filter((page) => "primaryNavLabel" in page.palette && Boolean(page.palette.primaryNavLabel));
}

export function getStructuredDataFeatureList() {
  return getToolPages().map((page) => page.palette.label);
}

export function getRecommendedNextToolPages(path: string) {
  const activePage = getPalettePageByPath(path);
  if (!activePage || !("recommendedNext" in activePage) || !activePage.recommendedNext?.length) {
    return [];
  }

  return activePage.recommendedNext
    .filter((key: string): key is SitePageKey => key in sitePageCatalog)
    .map((key: SitePageKey) => getSitePageEntry(key))
    .filter(hasPalette);
}
