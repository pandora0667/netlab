import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useModKeyLabel } from "@/hooks/use-mod-key-label";
import {
  findCommandPaletteGroupByLayer,
  findCommandPaletteEntryByHref,
} from "@/lib/command-palette-items";
import { Command, Compass, Home } from "lucide-react";
import { getRecommendedNextToolPages } from "../../../../shared/catalog/site-catalog";
import type { PaletteSitePageEntry } from "../../../../shared/catalog/site-catalog";

type ToolPageShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function ToolPageShell({
  title,
  description,
  actions,
  children,
}: ToolPageShellProps) {
  const [location] = useLocation();
  const mod = useModKeyLabel();
  const activeEntry = findCommandPaletteEntryByHref(location);
  const activeLayerGroup = activeEntry ? findCommandPaletteGroupByLayer(activeEntry.layer) : undefined;
  const recommendedTools = getRecommendedNextToolPages(location)
    .map((page: PaletteSitePageEntry) => findCommandPaletteEntryByHref(page.path))
    .filter((entry: ReturnType<typeof findCommandPaletteEntryByHref>): entry is NonNullable<typeof entry> => entry !== undefined);
  const adjacentTools = recommendedTools.length > 0
    ? recommendedTools
    : (activeLayerGroup?.items ?? [])
      .filter((item) => item.href !== location)
      .slice(0, 3);
  const contextLabel = activeLayerGroup?.heading ?? activeEntry?.category ?? "Diagnostic";

  return (
    <div className="mx-auto w-full max-w-none space-y-3 sm:space-y-4">
      <section className="workbench-header rounded-[1.45rem] px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="space-y-4">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-white/42"
          >
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 hover:text-white">
              <Home className="h-3.5 w-3.5" />
              Home
            </Link>
            <span>/</span>
            <span>{contextLabel}</span>
            <span>/</span>
            <span className="text-white/72">{title}</span>
          </nav>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/58">
                {contextLabel}
              </span>
              {activeEntry ? (
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-cyan-200">
                  {activeEntry.accent}
                </span>
              ) : null}
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[0.68rem] font-mono uppercase tracking-[0.2em] text-white/56">
                {activeEntry?.commandHint ?? "open tool"}
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="font-['Space_Grotesk'] text-[1.75rem] font-bold leading-none tracking-[-0.035em] text-white sm:text-[2.1rem]">
                {title}
              </h1>
              {description ? (
                <p className="max-w-4xl text-sm leading-6 text-white/62 sm:text-[0.98rem]">
                  {description}
                </p>
              ) : null}
              {activeEntry?.useCase ? (
                <p className="max-w-4xl text-sm leading-6 text-cyan-100/72">
                  Best for: {activeEntry.useCase}
                </p>
              ) : null}
            </div>
          </div>

            <aside className="tool-surface-muted space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Compass className="h-4 w-4 text-cyan-200" />
                <p className="text-sm font-medium">Operator context</p>
              </div>
              <div className="space-y-2 text-sm leading-6 text-white/62">
                <p>Stay on approved public targets and compare results across layers before concluding root cause.</p>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[0.68rem] font-mono uppercase tracking-[0.2em] text-white/56">
                  <Command className="h-3.5 w-3.5" />
                  {mod}+K switch tools
                </div>
              </div>
            </aside>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3 border-t border-white/8 pt-3">
            <div className="space-y-2">
              <p className="text-[0.68rem] uppercase tracking-[0.24em] text-white/40">
                Continue with
              </p>
              <div className="flex flex-wrap gap-2">
                {adjacentTools.length > 0 ? (
                  adjacentTools.map((tool: NonNullable<typeof adjacentTools[number]>) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/72 transition-colors hover:border-white/16 hover:text-white"
                    >
                      {tool.label}
                    </Link>
                  ))
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/48">
                    Use the command palette to jump across layers.
                  </span>
                )}
              </div>
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[2rem] border border-white/8 p-4 sm:p-5">
        {children}
      </section>
    </div>
  );
}
