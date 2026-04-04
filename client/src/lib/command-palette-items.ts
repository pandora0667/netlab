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
  Shield,
} from "lucide-react";
import {
  getPalettePageByPath,
  getPalettePages,
  getPrimaryNavPages,
  getToolPages,
  workflowCatalog,
  type PaletteSitePageKey,
} from "../../../shared/catalog/site-catalog";

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
  useCase: string;
};

const iconByPageKey: Record<PaletteSitePageKey, LucideIcon> = {
  home: Home,
  ipChecker: Globe,
  dnsLookup: Search,
  subnetCalculator: Calculator,
  pingTool: Activity,
  traceTool: Route,
  networkEngineering: Route,
  httpInspector: ShieldCheck,
  websiteSecurity: ShieldCheck,
  whoisLookup: FileText,
  emailSecurity: Shield,
  dnsPropagation: Globe2,
  portScanner: ScanSearch,
};

const paletteEntries = getPalettePages().map((page) => ({
  id: page.palette.id,
  label: page.palette.label,
  href: page.path,
  icon: iconByPageKey[page.key],
  keywords: page.palette.keywords,
  description: page.palette.description,
  category: page.palette.category,
  commandHint: page.palette.commandHint,
  accent: page.palette.accent,
  useCase: page.palette.useCase,
}));

export const commandPaletteGroups: {
  heading: string;
  items: CommandPaletteEntry[];
}[] = ["Overview", "Tools"].map((heading) => ({
  heading,
  items: paletteEntries.filter((entry) => {
    const page = getPalettePageByPath(entry.href);
    return page?.palette?.group === heading;
  }),
}));

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

export function getPrimaryNavigationItems() {
  return getPrimaryNavPages().map((page) => ({
    href: page.path,
    label: ("primaryNavLabel" in page.palette ? page.palette.primaryNavLabel : page.palette.label),
  }));
}

export const quickStartWorkflows: {
  id: string;
  title: string;
  description: string;
  steps: string[];
}[] = workflowCatalog.map((workflow) => ({
  ...workflow,
  steps: workflow.steps.map((step) => {
    const page = getToolPages().find((entry) => entry.key === step);
    return page?.palette.label || step;
  }),
}));
