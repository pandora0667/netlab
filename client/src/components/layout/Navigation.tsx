import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useCommandPalette } from "@/components/layout/command-palette";
import { useModKeyLabel } from "@/hooks/use-mod-key-label";
import { commandPaletteGroups } from "@/lib/command-palette-items";
import { Command, Menu, X } from "lucide-react";

const primaryNavItems = [
  { href: "/", label: "Overview" },
  { href: "/ip-checker", label: "IP" },
  { href: "/dns-lookup", label: "DNS" },
  { href: "/ping", label: "Ping" },
  { href: "/trace", label: "Trace" },
  { href: "/http-inspector", label: "HTTP/TLS" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { setOpen: openCommandPalette } = useCommandPalette();
  const mod = useModKeyLabel();

  const isActive = (href: string): boolean => location === href;

  return (
    <header className="sticky top-0 z-50 px-4 pt-5 sm:px-6" role="banner">
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        <div className="floating-nav flex items-center gap-2 rounded-full px-2 py-2">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="nav-brand flex shrink-0 items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold tracking-[0.02em] text-foreground transition-transform duration-200 hover:scale-[0.99]"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-[11px] font-semibold uppercase tracking-[0.28em] text-white shadow-[0_10px_30px_rgba(6,12,28,0.45)]"
              aria-hidden
            >
              NL
            </span>
            <span className="flex flex-col leading-none" aria-label="Netlab Home">
              <span className="font-['Space_Grotesk'] text-[0.95rem] font-bold tracking-[0.08em]">
                NETLAB
              </span>
              <span className="text-[0.62rem] uppercase tracking-[0.26em] text-white/45">
                command surface
              </span>
            </span>
          </Link>

          <nav
            className="hidden flex-1 items-center justify-center gap-1 xl:flex"
            aria-label="Primary"
          >
            {primaryNavItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-[0.78rem] font-medium tracking-[0.18em] uppercase transition-all duration-200 ${
                    active
                      ? "bg-white text-neutral-950 shadow-[0_12px_40px_rgba(255,255,255,0.16)]"
                      : "text-white/62 hover:bg-white/6 hover:text-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[0.68rem] font-mono uppercase tracking-[0.2em] text-white/54 lg:inline-flex">
              {mod}+K
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full border border-white/10 bg-white/6 text-white hover:bg-white/10"
              onClick={() => setIsOpen((open) => !open)}
              aria-expanded={isOpen}
              aria-label={isOpen ? "Close menu" : "Open menu"}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {isOpen ? (
          <nav
            className="glass-panel rounded-[1.75rem] border border-white/10 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
            role="navigation"
            aria-label="All tools"
          >
            <div className="flex flex-col gap-3 border-b border-white/8 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-white/45">
                  All tools
                </p>
                <p className="mt-1 text-sm font-medium text-white/86">
                  Open any route directly or use the command palette.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  openCommandPalette(true);
                  setIsOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <Command className="h-4 w-4" />
                Search tools
                <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-white/48">
                  {mod}+K
                </span>
              </button>
            </div>

            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              {commandPaletteGroups.map((group) => (
                <div key={group.heading} className="space-y-3">
                  <p className="text-[0.68rem] uppercase tracking-[0.24em] text-white/36">
                    {group.heading}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.items.map((tool) => {
                      const active = isActive(tool.href);

                      return (
                        <Link
                          key={tool.id}
                          href={tool.href}
                          onClick={() => setIsOpen(false)}
                          className={`rounded-[1.2rem] border px-4 py-3 text-left transition-all ${
                            active
                              ? "border-white/16 bg-white text-neutral-950 shadow-[0_16px_35px_rgba(255,255,255,0.12)]"
                              : "border-white/8 bg-white/[0.03] text-white/74 hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
                          }`}
                          aria-current={active ? "page" : undefined}
                        >
                          <p className="text-[0.66rem] uppercase tracking-[0.22em] text-current/52">
                            {tool.category}
                          </p>
                          <p className="mt-1 text-sm font-medium text-current">
                            {tool.label}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
