import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Calculator,
  FileText,
  Globe,
  Globe2,
  Home,
  Route,
  ScanSearch,
  Search,
  ShieldCheck,
} from "lucide-react";

export type CommandPaletteEntry = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
  description: string;
  category: string;
  commandHint: string;
  accent: string;
};

export const commandPaletteGroups: {
  heading: string;
  items: CommandPaletteEntry[];
}[] = [
  {
    heading: "General",
    items: [
      {
        id: "home",
        label: "Home",
        href: "/",
        icon: Home,
        keywords: ["start", "dashboard"],
        description: "Return to the main diagnostics launchpad.",
        category: "Launchpad",
        commandHint: "open netlab",
        accent: "Command Center",
      },
    ],
  },
  {
    heading: "Network tools",
    items: [
      {
        id: "ip-checker",
        label: "IP Checker",
        href: "/ip-checker",
        icon: Globe,
        keywords: ["public", "address", "geo"],
        description: "Inspect public IP, region, and ISP metadata.",
        category: "Identity",
        commandHint: "check public ip",
        accent: "Geolocation",
      },
      {
        id: "dns-lookup",
        label: "DNS Lookup",
        href: "/dns-lookup",
        icon: Search,
        keywords: ["record", "a", "mx", "txt"],
        description: "Query and compare DNS records across resolvers.",
        category: "Resolution",
        commandHint: "lookup dns records",
        accent: "Resolver View",
      },
      {
        id: "subnet-calc",
        label: "Subnet Calculator",
        href: "/subnet-calc",
        icon: Calculator,
        keywords: ["cidr", "mask", "network"],
        description: "Calculate CIDR ranges, masks, and host counts.",
        category: "Addressing",
        commandHint: "inspect subnet",
        accent: "CIDR Math",
      },
      {
        id: "ping",
        label: "Ping",
        href: "/ping",
        icon: Activity,
        keywords: ["latency", "icmp", "connectivity"],
        description: "Measure latency and reachability over ICMP or TCP.",
        category: "Reachability",
        commandHint: "probe latency",
        accent: "Latency Trace",
      },
      {
        id: "trace",
        label: "Trace Route",
        href: "/trace",
        icon: Route,
        keywords: ["traceroute", "hops", "route", "path"],
        description: "Trace the public path hop by hop and spot where delay begins.",
        category: "Path",
        commandHint: "trace route",
        accent: "Hop Map",
      },
      {
        id: "http-inspector",
        label: "HTTP/TLS Inspector",
        href: "/http-inspector",
        icon: ShieldCheck,
        keywords: ["tls", "https", "headers", "certificate"],
        description: "Inspect redirects, headers, TLS versions, and certificate health.",
        category: "Application",
        commandHint: "inspect http tls",
        accent: "Service Layer",
      },
      {
        id: "whois",
        label: "WHOIS",
        href: "/whois",
        icon: FileText,
        keywords: ["domain", "registration", "registrar"],
        description: "Inspect registration metadata for domains and IPs.",
        category: "Ownership",
        commandHint: "inspect whois",
        accent: "Registration Data",
      },
    ],
  },
  {
    heading: "Utilities",
    items: [
      {
        id: "dns-propagation",
        label: "DNS Propagation",
        href: "/dns-propagation",
        icon: Globe2,
        keywords: ["nameserver", "global", "resolve"],
        description: "Compare answers from resolvers around the world.",
        category: "Propagation",
        commandHint: "watch propagation",
        accent: "Global Nodes",
      },
      {
        id: "port-scan",
        label: "Port Scanner",
        href: "/port-scan",
        icon: ScanSearch,
        keywords: ["tcp", "open", "ports"],
        description: "Scan exposed ports on an approved public target.",
        category: "Surface",
        commandHint: "scan tcp ports",
        accent: "Attack Surface",
      },
    ],
  },
];

export function getAllCommandPaletteEntries(): CommandPaletteEntry[] {
  return commandPaletteGroups.flatMap((group) => group.items);
}

export function getHomeToolTiles(): CommandPaletteEntry[] {
  return getAllCommandPaletteEntries().filter((item) => item.id !== "home");
}

export function findCommandPaletteEntryByHref(
  href: string,
): CommandPaletteEntry | undefined {
  return getAllCommandPaletteEntries().find((item) => item.href === href);
}
