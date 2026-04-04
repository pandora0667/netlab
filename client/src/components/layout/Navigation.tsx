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
    <header className="sticky top-0 z-50 pt-4" role="banner">
      <div className="app-shell flex flex-col gap-2">
        <div className="netlab-header-frame">
          <div className="netlab-header-top">
            <Link
              href="/"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setDesktopLayerKey(null);
              }}
              className="netlab-header-brand"
            >
              <span className="netlab-header-brandmark">
                <img
                  src="/favicon.svg"
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-8 rounded-2xl object-cover"
                />
              </span>
              <span className="flex flex-col leading-none" aria-label="Netlab Home">
                <span className="font-['Space_Grotesk'] text-[0.95rem] font-bold tracking-[0.08em] text-white">
                  NETLAB
                </span>
                <span className="text-[0.62rem] uppercase tracking-[0.26em] text-white/38">
                  command surface
                </span>
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-3">
              {isDesktop ? (
                <span className="netlab-header-meta">
                  public edge / operator surface / bounded diagnostics
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="netlab-header-search hidden md:inline-flex"
                onClick={() => {
                  openCommandPalette(true);
                  setIsMobileMenuOpen(false);
                }}
              >
                <Command className="mr-2 h-4 w-4" />
                Search
              </Button>
              {isDesktop ? (
                <span className="netlab-header-kbd">
                  {mod}+K
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
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
              className="netlab-header-navline"
              onMouseLeave={() => setDesktopLayerKey(null)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDesktopLayerKey(null);
                }
              }}
            >
              <nav className="flex flex-wrap items-center gap-x-7 gap-y-2" aria-label="Primary layers">
                {layerGroups.map((group) => {
                  const isActiveLayer = activeLayerKey === group.key;
                  const isOpenLayer = desktopLayerKey === group.key;

                  return (
                    <button
                      key={group.key}
                      type="button"
                      onMouseEnter={() => setDesktopLayerKey(group.key)}
                      onFocus={() => setDesktopLayerKey(group.key)}
                      className={`netlab-header-trigger ${
                        isOpenLayer || isActiveLayer
                          ? "is-active"
                          : ""
                      }`}
                      aria-expanded={isOpenLayer}
                      aria-haspopup="true"
                    >
                      {group.shortLabel}
                      <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isOpenLayer ? "rotate-180" : ""}`} />
                    </button>
                  );
                })}
              </nav>

              {desktopGroup ? (
                <div className="netlab-header-dropdown">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-white/34">
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
                              : "border-white/10 bg-white/[0.02] text-white/72 hover:border-white/16 hover:bg-white/[0.05] hover:text-white"
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
            className="netlab-header-mobile"
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
