import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { getHomeToolTiles } from "@/lib/command-palette-items";
import { useModKeyLabel } from "@/hooks/use-mod-key-label";
import { useCommandPalette } from "@/components/layout/command-palette";
import { SEO } from "../components/SEO";
import { ArrowUpRight, Search } from "lucide-react";

const principles = [
  {
    title: "Command-first",
    description: "Move through routes with the feel of a launcher instead of a generic dashboard.",
  },
  {
    title: "Public-by-default",
    description: "Every flow is framed around safe diagnostics for public infrastructure and internet-facing targets.",
  },
  {
    title: "Utility over noise",
    description: "The interface favors scanability, state, and action instead of ornamental marketing blocks.",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const mod = useModKeyLabel();
  const { setOpen: openPalette } = useCommandPalette();
  const tiles = getHomeToolTiles();
  const heroRoutes = tiles.slice(0, 6);

  return (
    <>
      <SEO page="home" />
      <div className="mx-auto w-full max-w-7xl space-y-20 pb-20">
        <section className="home-hero -mx-4 overflow-hidden sm:-mx-6">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="max-w-4xl">
              <p className="text-[0.72rem] font-medium uppercase tracking-[0.34em] text-white/46">
                NETLAB
              </p>
              <h1 className="mt-5 font-['Space_Grotesk'] text-6xl font-bold leading-[0.88] tracking-[-0.08em] text-white sm:text-7xl lg:text-[7.5rem]">
                NETLAB
              </h1>
              <h2 className="mt-5 max-w-3xl font-['Space_Grotesk'] text-2xl font-medium tracking-[-0.04em] text-white/86 sm:text-3xl">
                Public network diagnostics in a quieter, command-first workspace.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
                Inspect IP, DNS, latency, WHOIS, propagation, and ports without
                bouncing between tabs or wrestling with noisy UI.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="group rounded-full bg-white px-6 text-neutral-950 hover:bg-white/92"
                  onClick={() => openPalette(true)}
                >
                  Open command palette
                  <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[0.03] px-6 text-white hover:bg-white/[0.06] hover:text-white"
                  onClick={() => setLocation("/dns-lookup")}
                >
                  Start with DNS Lookup
                </Button>
              </div>
            </div>

            <div className="home-hero-plane mt-14 lg:mt-16">
              <div className="home-search-row">
                <Search className="h-4 w-4 text-white/42" />
                <span className="flex-1 truncate text-sm text-white/58">
                  Search routes, run a diagnostic, or jump to a tool
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-white/54">
                  {mod}+K
                </span>
              </div>

              <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  {heroRoutes.map((tool, index) => {
                    const Icon = tool.icon;

                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => setLocation(tool.href)}
                        className={`home-list-row w-full text-left ${
                          index === 0 ? "home-list-row-active" : ""
                        }`}
                      >
                        <span className="flex items-center gap-4">
                          <span className="home-list-icon">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-current/46">
                              {tool.category}
                            </span>
                            <span className="mt-1 block text-lg font-medium text-current">
                              {tool.label}
                            </span>
                          </span>
                        </span>
                        <span className="rounded-full border border-current/10 px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-current/62">
                          {tool.commandHint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="home-detail-panel">
                  <p className="text-[0.68rem] uppercase tracking-[0.26em] text-white/40">
                    Why it reads better
                  </p>
                  <div className="mt-5 space-y-5">
                    <div>
                      <p className="text-sm font-medium text-white">One primary promise</p>
                      <p className="mt-2 text-sm leading-7 text-white/56">
                        The first viewport is one composition: brand, promise, action, and a
                        single product plane.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Real product anchor</p>
                      <p className="mt-2 text-sm leading-7 text-white/56">
                        The hero visual is not decorative chrome. It previews how navigation and
                        tool discovery actually feel.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Lower visual pressure</p>
                      <p className="mt-2 text-sm leading-7 text-white/56">
                        The palette stays dark and polished, but the glow, contrast, and number
                        of competing blocks stay restrained.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-3">
          {principles.map((item) => (
            <div key={item.title} className="space-y-3 border-t border-white/8 pt-5">
              <p className="font-['Space_Grotesk'] text-2xl font-semibold tracking-[-0.04em] text-white">
                {item.title}
              </p>
              <p className="max-w-md text-sm leading-7 text-white/58">
                {item.description}
              </p>
            </div>
          ))}
        </section>

        <section className="space-y-6">
          <div className="max-w-3xl space-y-3">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-white/40">
              Tool index
            </p>
            <h2 className="font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-white sm:text-4xl">
              Each route does one clear job.
            </h2>
            <p className="text-sm leading-7 text-white/56 sm:text-base">
              A calmer interface does not mean a weaker one. It means each section earns its
              place and each route reads in a single scan.
            </p>
          </div>

          <div className="border-t border-white/8">
            {tiles.map((tool) => {
              const Icon = tool.icon;

              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setLocation(tool.href)}
                  className="home-tool-row"
                >
                  <span className="flex items-center gap-4">
                    <span className="home-tool-icon">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-left">
                      <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-white/38">
                        {tool.category}
                      </span>
                      <span className="mt-1 block font-['Space_Grotesk'] text-2xl font-semibold tracking-[-0.04em] text-white">
                        {tool.label}
                      </span>
                      <span className="mt-2 block text-sm leading-7 text-white/54">
                        {tool.description}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.24em] text-white/40">
                    <span>{tool.accent}</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
