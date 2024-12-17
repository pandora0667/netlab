export interface SEOData {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  canonical?: string;
}

export const defaultSEO: SEOData = {
  title: "Netlab - Professional Network Tools Suite",
  description: "Free online network tools for system administrators and developers. Comprehensive suite including IP checker, DNS lookup, subnet calculator, and more.",
  keywords: ["network tools", "network diagnostics", "network monitoring", "online network tools"],
  ogImage: "/og-image.jpg"
};

export const pageSEOData: Record<string, SEOData> = {
  home: {
    ...defaultSEO,
    canonical: "/"
  },
  ipChecker: {
    title: "IP Address Checker - Netlab Tools",
    description: "Check your IP address, location, and network information. Free online IP lookup tool with detailed geolocation data.",
    keywords: ["ip checker", "ip lookup", "ip geolocation", "what is my ip", "ip address lookup"],
    canonical: "/ip-checker",
    ogImage: "/og-image.jpg"
  },
  dnsLookup: {
    title: "DNS Lookup Tool - Netlab Tools",
    description: "Perform DNS lookups and check DNS records. Query A, AAAA, MX, TXT, and other DNS record types online.",
    keywords: ["dns lookup", "dns checker", "dns records", "mx lookup", "dns tool"],
    canonical: "/dns-lookup",
    ogImage: "/og-image.jpg"
  },
  subnetCalculator: {
    title: "Subnet Calculator - Netlab Tools",
    description: "Calculate IP subnets, network addresses, and host ranges. Free online subnet calculator for IPv4 and IPv6.",
    keywords: ["subnet calculator", "ip subnet", "network calculator", "cidr calculator"],
    canonical: "/subnet-calc",
    ogImage: "/og-image.jpg"
  },
  pingTool: {
    title: "Ping Tool - Netlab Tools",
    description: "Online ping tool to test network connectivity and measure latency. Support for multiple protocols and locations.",
    keywords: ["ping tool", "network latency", "ping test", "network connectivity"],
    canonical: "/ping",
    ogImage: "/og-image.jpg"
  },
  whoisLookup: {
    title: "WHOIS Lookup - Netlab Tools",
    description: "Look up domain registration information, IP ownership, and network details with our WHOIS lookup tool.",
    keywords: ["whois lookup", "domain lookup", "ip whois", "domain information"],
    canonical: "/whois",
    ogImage: "/og-image.jpg"
  },
  dnsPropagation: {
    title: "DNS Propagation Checker - Netlab Tools",
    description: "Check DNS propagation across multiple nameservers worldwide. Monitor DNS changes and troubleshoot DNS issues.",
    keywords: ["dns propagation", "dns checker", "dns monitoring", "dns troubleshooting"],
    canonical: "/dns-propagation",
    ogImage: "/og-image.jpg"
  },
  portScanner: {
    title: "Port Scanner - Netlab Tools",
    description: "Scan network ports to check for open services and security. Online port scanning tool with common port database.",
    keywords: ["port scanner", "network ports", "port checker", "security scanner"],
    canonical: "/port-scan",
    ogImage: "/og-image.jpg"
  }
};
