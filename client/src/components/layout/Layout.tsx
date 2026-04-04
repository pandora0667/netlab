import { ReactNode, Suspense } from "react";
import { Link } from "wouter";
import Navigation from "./Navigation";
import { CommandPaletteProvider } from "@/components/layout/command-palette";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { commandPaletteGroups } from "@/lib/command-palette-items";
import { Loader2 } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="glass-panel flex items-center gap-3 rounded-full px-5 py-3">
        <Loader2 className="h-5 w-5 animate-spin text-white/72" />
        <span className="text-sm uppercase tracking-[0.26em] text-white/55">
          Loading surface
        </span>
      </div>
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  const footerGroups = commandPaletteGroups.filter(
    (group) => group.items.length > 0 && group.key !== "overview",
  );

  return (
    <CommandPaletteProvider>
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div className="netlab-ambient" aria-hidden />
        <div className="netlab-grid" aria-hidden />
        <div className="relative z-10 flex min-h-screen flex-col">
          <Navigation />

          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <main
                id="main-content"
                className="app-shell flex w-full flex-1 pb-20 pt-6"
                role="main"
                tabIndex={-1}
              >
                {children}
              </main>
            </Suspense>
          </ErrorBoundary>

          <footer
            className="mt-auto border-t border-white/6 bg-black/20 backdrop-blur-xl"
            role="contentinfo"
          >
            <div className="app-shell grid gap-10 py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
              <div className="space-y-4">
                <p className="text-[0.7rem] uppercase tracking-[0.28em] text-white/42">
                  Netlab layers
                </p>
                <p className="max-w-md font-['Space_Grotesk'] text-2xl font-bold leading-tight text-white">
                  A diagnostic workspace organized by technical layer, not by random utility names.
                </p>
                <p className="max-w-lg text-sm leading-7 text-white/58">
                  Public-facing network workflows now read from identity through control plane
                  and exposure, so operators can move with cleaner intent.
                </p>
              </div>

              <div className="grid gap-8 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
                {footerGroups.map((group) => (
                  <div key={group.heading} className="space-y-3">
                    <p className="text-[0.68rem] uppercase tracking-[0.26em] text-white/38">
                      {group.heading}
                    </p>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block text-sm text-white/62 transition-colors hover:text-white"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="app-shell flex flex-col gap-3 border-t border-white/6 py-5 text-[0.7rem] uppercase tracking-[0.24em] text-white/32 sm:flex-row sm:items-center sm:justify-between">
              <p>© {new Date().getFullYear()} Netlab</p>
              <div className="flex items-center gap-4">
                <a
                  href="https://github.com/pandora0667/netlab"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white/72"
                >
                  GitHub
                </a>
                <span>Public Diagnostic Surface</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
