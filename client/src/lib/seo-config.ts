export interface SEOData {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  canonical?: string;
  imageAlt?: string;
}

const envSiteUrl =
  typeof import.meta !== "undefined" ? import.meta.env.VITE_SITE_URL : undefined;

export const siteUrl = (envSiteUrl || "https://netlab.tools").replace(/\/+$/, "");

export const resolveSeoUrl = (path = "/") =>
  new URL(path, `${siteUrl}/`).toString();

export const defaultSEO: SEOData = {
  title: "Netlab | Online Network Diagnostics Toolkit",
  description: "Fast online network diagnostics for DNS records, DNS propagation, IP lookup, subnet calculation, ping, WHOIS, and public port checks.",
  keywords: [
    "network tools",
    "network diagnostics",
    "DNS lookup",
    "DNS propagation checker",
    "IP lookup",
    "subnet calculator",
    "ping tool",
    "WHOIS lookup",
    "port scanner",
  ],
  ogImage: "/og-image.jpg",
  canonical: "/",
  imageAlt: "Netlab network diagnostics toolkit preview",
};

export const pageSEOData: Record<string, SEOData> = {
  home: {
    ...defaultSEO,
    canonical: "/"
  },
  ipChecker: {
    title: "IP Address Checker | Netlab",
    description: "Check your public IP address, network location, and connection details with a fast browser-based IP lookup.",
    keywords: ["ip checker", "ip lookup", "ip geolocation", "what is my ip", "ip address lookup"],
    canonical: "/ip-checker",
    ogImage: "/og-image.jpg",
    imageAlt: "Netlab IP address checker preview",
  },
  dnsLookup: {
    title: "DNS Lookup Tool | Netlab",
    description: "Query A, AAAA, MX, TXT, CNAME, and other DNS records against trusted public resolvers or a custom server.",
    keywords: ["dns lookup", "dns checker", "dns records", "mx lookup", "dns tool"],
    canonical: "/dns-lookup",
    ogImage: "/og-image.jpg",
    imageAlt: "Netlab DNS lookup tool preview",
  },
  subnetCalculator: {
    title: "Subnet Calculator | Netlab",
    description: "Calculate subnet ranges, host counts, network addresses, and export subnet plans from CIDR or dotted masks.",
    keywords: ["subnet calculator", "ip subnet", "network calculator", "cidr calculator"],
    canonical: "/subnet-calc",
    ogImage: "/og-image.jpg",
    imageAlt: "Netlab subnet calculator preview",
  },
  pingTool: {
    title: "Ping Tool | Netlab",
    description: "Test public host reachability and latency with a live ping workflow built for quick diagnostics.",
    keywords: ["ping tool", "network latency", "ping test", "network connectivity"],
    canonical: "/ping",
    ogImage: "/og-image.jpg",
    imageAlt: "Netlab ping tool preview",
  },
  whoisLookup: {
    title: "WHOIS Lookup | Netlab",
    description: "Inspect domain registration details and ownership metadata with a focused WHOIS lookup interface.",
    keywords: ["whois lookup", "domain lookup", "ip whois", "domain information"],
    canonical: "/whois",
    ogImage: "/og-image.jpg",
    imageAlt: "Netlab WHOIS lookup preview",
  },
  dnsPropagation: {
    title: "DNS Propagation Checker | Netlab",
    description: "Track DNS propagation across global resolvers and compare responses as records roll out.",
    keywords: ["dns propagation", "dns checker", "dns monitoring", "dns troubleshooting"],
    canonical: "/dns-propagation",
    ogImage: "/og-image.jpg",
    imageAlt: "Netlab DNS propagation checker preview",
  },
  portScanner: {
    title: "Port Scanner | Netlab",
    description: "Run bounded public port scans to confirm exposed services and troubleshoot connectivity issues.",
    keywords: ["port scanner", "network ports", "port checker", "security scanner"],
    canonical: "/port-scan",
    ogImage: "/og-image.jpg",
    imageAlt: "Netlab port scanner preview",
  }
};
