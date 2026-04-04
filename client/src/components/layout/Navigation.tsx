import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useCommandPalette } from "@/components/layout/command-palette";
import { useModKeyLabel } from "@/hooks/use-mod-key-label";
import {
  findCommandPaletteEntryByHref,
  getNavigationLayerGroups,
  type CommandPaletteLayerGroup,
} from "@/lib/command-palette-items";
import { ChevronDown, Command, Menu, X } from "lucide-react";

export default function Navigation() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(min-width: 1024px)").matches;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [desktopLayerKey, setDesktopLayerKey] = useState<CommandPaletteLayerGroup["key"] | null>(null);
  const [mobileLayerKey, setMobileLayerKey] = useState<CommandPaletteLayerGroup["key"] | null>(null);
  const [location] = useLocation();
  const { setOpen: openCommandPalette } = useCommandPalette();
  const mod = useModKeyLabel();
  const layerGroups = useMemo(() => getNavigationLayerGroups(), []);
  const activeEntry = findCommandPaletteEntryByHref(location);
  const activeLayerKey = activeEntry && activeEntry.layer !== "overview"
    ? activeEntry.layer
    : null;

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setDesktopLayerKey(null);
    setMobileLayerKey(activeLayerKey ?? layerGroups[0]?.key ?? null);
  }, [activeLayerKey, location, layerGroups]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => {
      setIsDesktop(media.matches);
    };

    updateViewport();
    media.addEventListener("change", updateViewport);

    return () => {
      media.removeEventListener("change", updateViewport);
    };
  }, []);

  const desktopGroup = useMemo(
    () => layerGroups.find((group) => group.key === desktopLayerKey) ?? null,
    [desktopLayerKey, layerGroups],
  );

  return (
    <header className="sticky top-0 z-50 pt-5" role="banner">
      <div className="app-shell flex flex-col gap-3">
        <div className="floating-nav rounded-[1.6rem] px-3 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setDesktopLayerKey(null);
              }}
              className="nav-brand flex shrink-0 items-center gap-3 rounded-full px-2 py-1 text-sm font-semibold tracking-[0.02em] text-foreground transition-transform duration-200 hover:scale-[0.99]"
            >
              <img
                src="/favicon.svg"
                alt=""
                aria-hidden="true"
                className="h-9 w-9 rounded-2xl border border-white/10 object-cover shadow-[0_10px_30px_rgba(6,12,28,0.45)]"
              />
              <span className="flex flex-col leading-none" aria-label="Netlab Home">
                <span className="font-['Space_Grotesk'] text-[0.95rem] font-bold tracking-[0.08em]">
                  NETLAB
                </span>
                <span className="text-[0.62rem] uppercase tracking-[0.26em] text-white/45">
                  command surface
                </span>
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-white/74 hover:bg-white/[0.08] hover:text-white md:inline-flex"
                onClick={() => {
                  openCommandPalette(true);
                  setIsMobileMenuOpen(false);
                }}
              >
                <Command className="mr-2 h-4 w-4" />
                Search
              </Button>
              {isDesktop ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[0.68rem] font-mono uppercase tracking-[0.2em] text-white/54">
                  {mod}+K
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full border border-white/10 bg-white/6 text-white hover:bg-white/10"
                  onClick={() => setIsMobileMenuOpen((open) => !open)}
                  aria-expanded={isMobileMenuOpen}
                  aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                >
                  {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              )}
            </div>
          </div>

          {isDesktop ? (
            <div
              className="mt-3 border-t border-white/8 pt-3"
              onMouseLeave={() => setDesktopLayerKey(null)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDesktopLayerKey(null);
                }
              }}
            >
              <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Primary layers">
                {layerGroups.map((group) => {
                  const isActiveLayer = activeLayerKey === group.key;
                  const isOpenLayer = desktopLayerKey === group.key;

                  return (
                    <button
                      key={group.key}
                      type="button"
                      onMouseEnter={() => setDesktopLayerKey(group.key)}
                      onFocus={() => setDesktopLayerKey(group.key)}
                      className={`inline-flex items-center gap-2 border-b px-0.5 py-1 text-[0.74rem] font-medium uppercase tracking-[0.18em] transition-colors ${
                        isOpenLayer || isActiveLayer
                          ? "border-white/70 text-white"
                          : "border-transparent text-white/54 hover:text-white"
                      }`}
                      aria-expanded={isOpenLayer}
                      aria-haspopup="true"
                    >
                      {group.shortLabel}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpenLayer ? "rotate-180" : ""}`} />
                    </button>
                  );
                })}
              </nav>

              {desktopGroup ? (
                <div className="mt-3 rounded-[1.2rem] border border-white/10 bg-white/[0.035] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-white/40">
                    <span>{desktopGroup.heading}</span>
                    <span>{desktopGroup.items.length} tools</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {desktopGroup.items.map((tool) => {
                      const active = location === tool.href;

                      return (
                        <Link
                          key={tool.href}
                          href={tool.href}
                          className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                            active
                              ? "border-white/16 bg-white text-neutral-950"
                              : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/16 hover:text-white"
                          }`}
                        >
                          {tool.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {!isDesktop && isMobileMenuOpen ? (
          <nav
            className="glass-panel rounded-[1.75rem] border border-white/10 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
            role="navigation"
            aria-label="Mobile menu"
          >
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  openCommandPalette(true);
                  setIsMobileMenuOpen(false);
                }}
                className="inline-flex w-full items-center justify-between rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/74 transition-all hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
              >
                <span>Search tools</span>
                <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-white/48">
                  {mod}+K
                </span>
              </button>

              <div className="space-y-2">
                {layerGroups.map((group) => {
                  const expanded = mobileLayerKey === group.key;
                  const isActiveLayer = activeLayerKey === group.key;

                  return (
                    <div
                      key={group.key}
                      className={`rounded-[1.1rem] border transition-colors ${
                        expanded || isActiveLayer
                          ? "border-white/14 bg-white/[0.05]"
                          : "border-white/8 bg-white/[0.03]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setMobileLayerKey((current) => current === group.key ? null : group.key)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        aria-expanded={expanded}
                      >
                        <span className="space-y-1">
                          <span className="block text-[0.72rem] uppercase tracking-[0.18em] text-white/48">
                            {group.shortLabel}
                          </span>
                          <span className="block text-sm text-white/76">
                            {group.items.length} tools
                          </span>
                        </span>
                        <ChevronDown className={`h-4 w-4 text-white/46 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>

                      {expanded ? (
                        <div className="flex flex-wrap gap-2 border-t border-white/8 px-4 py-4">
                          {group.items.map((tool) => {
                            const active = location === tool.href;

                            return (
                              <Link
                                key={tool.href}
                                href={tool.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                                  active
                                    ? "border-white/16 bg-white text-neutral-950"
                                    : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/16 hover:text-white"
                                }`}
                              >
                                {tool.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
