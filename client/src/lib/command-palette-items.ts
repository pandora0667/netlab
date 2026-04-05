import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Calculator,
  FileText,
  GitBranch,
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
  getPrimaryNavigationPages,
  getPalettePages,
  getTechnicalLayerGroups,
  getToolPages,
  workflowCatalog,
  type PaletteSitePageKey,
  type TechnicalLayerKey,
} from "../../../shared/catalog/site-catalog";

export type CommandPaletteEntry = {
  id: string;
  label: string;
  href: string;
  layer: TechnicalLayerKey;
  icon: LucideIcon;
  keywords?: string[];
  description: string;
  category: string;
  commandHint: string;
  accent: string;
  useCase: string;
  primaryNavLabel?: string;
};

export type CommandPaletteLayerGroup = {
  key: TechnicalLayerKey;
  heading: string;
  description: string;
  shortLabel: string;
  items: CommandPaletteEntry[];
};

const iconByPageKey: Record<PaletteSitePageKey, LucideIcon> = {
  home: Home,
  ipChecker: Globe,
  dnsLookup: Search,
  subnetCalculator: Calculator,
  pingTool: Activity,
  traceTool: Route,
  networkEngineering: Route,
  routingIncidentExplorer: GitBranch,
  packetCaptureLab: FileText,
  performanceLab: Activity,
  ipv6TransitionLab: Globe2,
  httpInspector: ShieldCheck,
  websiteSecurity: ShieldCheck,
  whoisLookup: FileText,
  emailSecurity: Shield,
  dnsPropagation: Globe2,
  portScanner: ScanSearch,
};

const paletteEntries: CommandPaletteEntry[] = getPalettePages().map((page) => ({
  id: page.palette.id,
  label: page.palette.label,
  href: page.path,
  layer: page.palette.layer,
  icon: iconByPageKey[page.key],
  keywords: page.palette.keywords,
  description: page.palette.description,
  category: page.palette.category,
  commandHint: page.palette.commandHint,
  accent: page.palette.accent,
  useCase: page.palette.useCase,
  primaryNavLabel: "primaryNavLabel" in page.palette ? page.palette.primaryNavLabel : undefined,
}));

const paletteEntriesByHref = new Map(
  paletteEntries.map((entry) => [entry.href, entry]),
);

export const commandPaletteGroups: CommandPaletteLayerGroup[] = getTechnicalLayerGroups().map((layer) => ({
  key: layer.key,
  heading: layer.label,
  description: layer.description,
  shortLabel: layer.shortLabel,
  items: layer.pages
    .map((page) => paletteEntriesByHref.get(page.path))
    .filter((entry): entry is CommandPaletteEntry => entry !== undefined),
}));

export function getAllCommandPaletteEntries(): CommandPaletteEntry[] {
  return commandPaletteGroups.flatMap((group) => group.items);
}

export function getHomeToolTiles(): CommandPaletteEntry[] {
  return getAllCommandPaletteEntries().filter((item) => item.id !== "home");
}

export function getPrimaryNavigationEntries(): CommandPaletteEntry[] {
  const primaryPages = getPrimaryNavigationPages();

  return primaryPages
    .map((page) => paletteEntriesByHref.get(page.path))
    .filter((entry): entry is CommandPaletteEntry => entry !== undefined);
}

export function findCommandPaletteEntryByHref(
  href: string,
): CommandPaletteEntry | undefined {
  return getAllCommandPaletteEntries().find((item) => item.href === href);
}

export function findCommandPaletteGroupByLayer(layer: TechnicalLayerKey) {
  return commandPaletteGroups.find((group) => group.key === layer);
}

export function getNavigationLayerGroups() {
  return commandPaletteGroups.filter((group) => group.key !== "overview");
}

export function getHomeLayerGroups() {
  return getNavigationLayerGroups();
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
