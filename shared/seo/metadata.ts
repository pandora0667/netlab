export type SEOPageKey =
  | "home"
  | "ipChecker"
  | "dnsLookup"
  | "subnetCalculator"
  | "pingTool"
  | "traceTool"
  | "httpInspector"
  | "whoisLookup"
  | "dnsPropagation"
  | "portScanner"
  | "notFound";

export interface SEOPageDefinition {
  key: SEOPageKey;
  path: string;
  title: string;
  description: string;
  imageAlt: string;
  changeFrequency: "weekly" | "monthly";
  priority: string;
  noIndex?: boolean;
}

export interface ResolvedSEOEntry extends SEOPageDefinition {
  siteRootUrl: string;
  canonicalUrl: string;
  ogImageUrl: string;
  breadcrumbName: string;
}

const DEFAULT_SITE_URL = "https://netlab.tools";
export const DEFAULT_OG_IMAGE_PATH = "/og-image.jpg";
export const SITE_NAME = "Netlab";

export const normalizeSiteUrl = (value?: string) =>
  (value || DEFAULT_SITE_URL).replace(/\/+$/, "");

export const resolveSeoUrl = (siteUrl: string, path = "/") =>
  new URL(path, `${normalizeSiteUrl(siteUrl)}/`).toString();

export const seoPages: Record<SEOPageKey, SEOPageDefinition> = {
  home: {
    key: "home",
    path: "/",
    title: "Netlab | Public Network Diagnostics Workspace",
    description:
      "Run public DNS lookup, DNS propagation checks, IP inspection, subnet planning, ping, WHOIS, and bounded port scans from one network diagnostics workspace.",
    imageAlt: "Netlab network diagnostics workspace preview",
    changeFrequency: "weekly",
    priority: "1.0",
  },
  ipChecker: {
    key: "ipChecker",
    path: "/ip-checker",
    title: "IP Checker | Public IP and Connection Details | Netlab",
    description:
      "Check your public IP address, location context, and network details with a focused browser-based IP checker.",
    imageAlt: "Netlab IP checker preview",
    changeFrequency: "weekly",
    priority: "0.9",
  },
  dnsLookup: {
    key: "dnsLookup",
    path: "/dns-lookup",
    title: "DNS Lookup | Query A, AAAA, MX, TXT, and More | Netlab",
    description:
      "Look up DNS records including A, AAAA, MX, TXT, CNAME, NS, and SOA against public resolvers or a custom DNS server.",
    imageAlt: "Netlab DNS lookup preview",
    changeFrequency: "weekly",
    priority: "0.9",
  },
  subnetCalculator: {
    key: "subnetCalculator",
    path: "/subnet-calc",
    title: "Subnet Calculator | CIDR, Masks, and Host Ranges | Netlab",
    description:
      "Calculate subnet ranges, host counts, network addresses, and export subnet plans from CIDR prefixes or dotted decimal masks.",
    imageAlt: "Netlab subnet calculator preview",
    changeFrequency: "weekly",
    priority: "0.9",
  },
  pingTool: {
    key: "pingTool",
    path: "/ping",
    title: "Ping Tool | Check Public Host Reachability | Netlab",
    description:
      "Test public host reachability and latency with a live ping tool designed for quick troubleshooting and repeat checks.",
    imageAlt: "Netlab ping tool preview",
    changeFrequency: "weekly",
    priority: "0.9",
  },
  traceTool: {
    key: "traceTool",
    path: "/trace",
    title: "Trace Route | Bounded Hop-by-Hop Path Probe | Netlab",
    description:
      "Trace the public path toward a host with a bounded hop-by-hop probe to see where latency or timeouts begin.",
    imageAlt: "Netlab trace route preview",
    changeFrequency: "weekly",
    priority: "0.9",
  },
  httpInspector: {
    key: "httpInspector",
    path: "/http-inspector",
    title: "HTTP and TLS Inspector | Headers, Redirects, and Certificates | Netlab",
    description:
      "Inspect redirect chains, response headers, TLS versions, HSTS, and certificate expiry for a public web target.",
    imageAlt: "Netlab HTTP and TLS inspector preview",
    changeFrequency: "weekly",
    priority: "0.9",
  },
  whoisLookup: {
    key: "whoisLookup",
    path: "/whois",
    title: "WHOIS Lookup | Domain Registration Details | Netlab",
    description:
      "Inspect domain registration records, registrar details, and ownership metadata with a focused WHOIS lookup tool.",
    imageAlt: "Netlab WHOIS lookup preview",
    changeFrequency: "weekly",
    priority: "0.9",
  },
  dnsPropagation: {
    key: "dnsPropagation",
    path: "/dns-propagation",
    title: "DNS Propagation Checker | Compare Resolver Rollout | Netlab",
    description:
      "Track DNS propagation across global resolvers and compare record responses while updates roll out.",
    imageAlt: "Netlab DNS propagation checker preview",
    changeFrequency: "weekly",
    priority: "0.9",
  },
  portScanner: {
    key: "portScanner",
    path: "/port-scan",
    title: "Port Scanner | Bounded Public Port Checks | Netlab",
    description:
      "Run bounded public port scans to confirm exposed services and troubleshoot connectivity without scanning private networks.",
    imageAlt: "Netlab port scanner preview",
    changeFrequency: "weekly",
    priority: "0.9",
  },
  notFound: {
    key: "notFound",
    path: "/404",
    title: "Page Not Found | Netlab",
    description:
      "The requested Netlab page does not exist or may have moved.",
    imageAlt: "Netlab page not found preview",
    changeFrequency: "monthly",
    priority: "0.1",
    noIndex: true,
  },
};

const seoPageKeys = Object.keys(seoPages) as SEOPageKey[];

export const hasKnownSEOPagePath = (pathname: string) => {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return seoPageKeys.some(
    (key) => key !== "notFound" && seoPages[key].path === normalizedPath,
  );
};

export const getSEOPageByPath = (pathname: string) => {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return (
    seoPageKeys.find(
      (key) => key !== "notFound" && seoPages[key].path === normalizedPath,
    ) ?? "notFound"
  );
};

export const resolveSEOEntry = (
  pageKey: SEOPageKey,
  siteUrl: string,
): ResolvedSEOEntry => {
  const page = seoPages[pageKey];
  const siteRootUrl = resolveSeoUrl(siteUrl, "/");
  return {
    ...page,
    siteRootUrl,
    canonicalUrl: resolveSeoUrl(siteUrl, page.path),
    ogImageUrl: resolveSeoUrl(siteUrl, DEFAULT_OG_IMAGE_PATH),
    breadcrumbName: page.key === "home" ? SITE_NAME : page.title.split(" | ")[0],
  };
};

export const buildStructuredData = (entry: ResolvedSEOEntry) => {
  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "WebSite",
      "@id": `${entry.siteRootUrl}#website`,
      url: entry.siteRootUrl,
      name: SITE_NAME,
      description: seoPages.home.description,
      inLanguage: "en",
    },
  ];

  const document: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  if (entry.key === "home") {
    graph.push({
      "@type": "WebApplication",
      "@id": `${entry.canonicalUrl}#app`,
      name: SITE_NAME,
      url: entry.canonicalUrl,
      applicationCategory: "NetworkingApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "IP checker",
        "DNS lookup",
        "DNS propagation checker",
        "Subnet calculator",
        "Ping tool",
        "WHOIS lookup",
        "Bounded public port scanner",
      ],
    });

    return document;
  }

  graph.push(
    {
      "@type": "WebPage",
      "@id": `${entry.canonicalUrl}#webpage`,
      url: entry.canonicalUrl,
      name: entry.title,
      description: entry.description,
      isPartOf: {
        "@id": `${entry.siteRootUrl}#website`,
      },
      inLanguage: "en",
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${entry.canonicalUrl}#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          item: entry.siteRootUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: entry.breadcrumbName,
          item: entry.canonicalUrl,
        },
      ],
    },
  );

  return document;
};
