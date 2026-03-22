import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useModKeyLabel } from "@/hooks/use-mod-key-label";
import { findCommandPaletteEntryByHref, getHomeToolTiles } from "@/lib/command-palette-items";
import { ArrowUpRight } from "lucide-react";

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
  const otherTools = getHomeToolTiles()
    .filter((item) => item.href !== location)
    .slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-[112rem] space-y-3 sm:space-y-4">
      <section className="workbench-header rounded-[1.45rem] px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/58">
                {activeEntry?.category ?? "Diagnostic"}
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
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3 xl:items-end">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[0.68rem] font-mono uppercase tracking-[0.2em] text-white/56">
              {mod}+K switch tools
            </span>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {otherTools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="workbench-route-chip group"
            >
              <span className="min-w-0">
                <span className="block text-[0.62rem] uppercase tracking-[0.2em] text-white/38">
                  {tool.category}
                </span>
                <span className="mt-1 block text-sm font-medium text-white">
                  {tool.label}
                </span>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/32 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/72" />
            </Link>
          ))}
        </div>
      </section>

      <section className="glass-panel rounded-[2rem] border border-white/8 p-4 sm:p-5">
        {children}
      </section>
    </div>
  );
}
