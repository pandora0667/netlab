import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCommandPalette } from "@/components/layout/command-palette";
import { SEO } from "../components/SEO";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Globe,
  Network,
  Radar,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { workflowCatalog } from "../../../shared/catalog/site-catalog";

const heroShortcuts = [
  {
    href: "/dns-lookup",
    label: "DNS Lookup",
    detail: "Check resolver truth first.",
  },
  {
    href: "/trace",
    label: "Trace Route",
    detail: "See where the path breaks.",
  },
  {
    href: "/http-inspector",
    label: "HTTP/TLS Inspector",
    detail: "Inspect the public edge response.",
  },
];

const heroFieldColumns = Array.from({ length: 12 });
const heroFieldStreaks = Array.from({ length: 3 });

const supportColumns = [
  {
    title: "Identity and ownership",
    body: "Confirm public IP, registrar context, and network boundaries before deeper diagnostics distort the problem.",
  },
  {
    title: "Naming and path",
    body: "Keep DNS, propagation, reachability, and hop behavior in one reading surface instead of switching tools mid-investigation.",
  },
  {
    title: "Service and control plane",
    body: "Move from web and mail posture into routing, authority, parity, MTU, and exposure without losing the same thread.",
  },
];

const featureBands = [
  {
    id: "identity",
    eyebrow: "Identity",
    title: "Start with who the target is before asking why it is failing.",
    body: "Public identity, ownership, and subnet context are the first things teams skip and the first things they need later.",
    href: "/ip-checker",
    cta: "Open IP Checker",
  },
  {
    id: "dns",
    eyebrow: "DNS and naming",
    title: "Separate naming drift from transport and service failure.",
    body: "DNS lookup and propagation belong in the same conversation as path checks because resolver truth often decides the next move.",
    href: "/dns-lookup",
    cta: "Open DNS Lookup",
  },
  {
    id: "service",
    eyebrow: "Service edge",
    title: "Read what users and mail receivers actually meet on the public edge.",
    body: "HTTP, TLS, website posture, and email security belong together when the hostname resolves but trust, redirects, or policy still feel wrong.",
    href: "/website-security",
    cta: "Open Website Security",
  },
  {
    id: "engineering",
    eyebrow: "Operator depth",
    title: "Move into routing, authority, dual-stack parity, and bounded exposure only when the evidence requires it.",
    body: "Netlab keeps the deep checks close to the front-line checks so escalation can happen with context instead of assumption.",
    href: "/network-engineering",
    cta: "Open Engineering",
  },
];

const workflowHighlights = workflowCatalog.map((workflow) => ({
  id: workflow.id,
  title: workflow.title,
  description: workflow.description,
  steps: workflow.steps.length,
}));

const operatorProof = [
  {
    icon: Globe,
    title: "Public-only scope",
    body: "Built for public targets and edge evidence, not internal network discovery.",
  },
  {
    icon: Radar,
    title: "Readable outputs",
    body: "Results are meant to explain where the problem begins, not just dump raw protocol fragments.",
  },
  {
    icon: ShieldCheck,
    title: "Bounded exposure",
    body: "Checks stay controlled and operator-facing, including redacted local trace context and bounded port probing.",
  },
];

function HeroSignalArtwork() {
  return (
    <svg
      className="home-cinematic-artwork"
      viewBox="0 0 920 760"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="netlabSignal" x1="140" y1="96" x2="760" y2="620" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(129,255,230,0.04)" />
          <stop offset="0.36" stopColor="rgba(129,255,230,0.44)" />
          <stop offset="0.68" stopColor="rgba(114,186,255,0.32)" />
          <stop offset="1" stopColor="rgba(114,186,255,0.03)" />
        </linearGradient>
        <linearGradient id="netlabFaint" x1="80" y1="120" x2="820" y2="540" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(255,255,255,0)" />
          <stop offset="0.5" stopColor="rgba(170,245,228,0.11)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="netlabHairline" x1="120" y1="160" x2="818" y2="518" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(255,255,255,0)" />
          <stop offset="0.42" stopColor="rgba(173,246,231,0.2)" />
          <stop offset="0.74" stopColor="rgba(133,173,255,0.16)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id="netlabNode" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0.5 0.5) scale(1)">
          <stop stopColor="rgba(210,255,244,1)" />
          <stop offset="1" stopColor="rgba(210,255,244,0)" />
        </radialGradient>
      </defs>

      <g opacity="0.42" className="home-cinematic-pathfield">
        <path className="home-cinematic-path home-cinematic-path-faint" d="M72 558C190 542 260 422 378 408C496 394 566 468 670 450C786 432 836 286 914 242" stroke="url(#netlabFaint)" strokeWidth="0.55" strokeLinecap="round" pathLength="100" />
        <path className="home-cinematic-path home-cinematic-path-faint-alt" d="M54 430C162 398 242 282 358 278C466 274 560 360 652 348C760 334 834 228 910 174" stroke="url(#netlabFaint)" strokeWidth="0.52" strokeLinecap="round" pathLength="100" />
        <path className="home-cinematic-path home-cinematic-path-hairline" d="M88 626C214 592 302 486 424 474C542 462 628 520 730 498C820 478 876 392 924 336" stroke="url(#netlabHairline)" strokeWidth="0.45" strokeLinecap="round" pathLength="100" />
        <path className="home-cinematic-path home-cinematic-path-hairline-alt" d="M132 322C252 286 350 184 466 192C568 198 638 284 734 276C818 268 878 216 926 168" stroke="url(#netlabHairline)" strokeWidth="0.44" strokeLinecap="round" pathLength="100" />
        <path className="home-cinematic-path home-cinematic-path-hairline-soft" d="M104 506C198 476 280 426 388 414C502 402 596 422 704 396C806 372 884 302 938 246" stroke="url(#netlabHairline)" strokeWidth="0.42" strokeLinecap="round" pathLength="100" />
        <path className="home-cinematic-path home-cinematic-path-hairline-soft" d="M120 214C232 212 314 126 432 132C548 138 626 220 736 214C836 210 902 154 942 112" stroke="url(#netlabHairline)" strokeWidth="0.4" strokeLinecap="round" pathLength="100" />
      </g>

      <g>
        {[
          [154, 542],
          [292, 434],
          [438, 404],
          [592, 430],
          [734, 352],
          [848, 254],
          [356, 278],
          [674, 282],
          [782, 194],
          [236, 222],
        ].map(([cx, cy], index) => (
          <g key={`${cx}-${cy}`} className="home-cinematic-node" style={{ ["--node-delay" as string]: `${index * 1.1}s` }}>
            <circle className="home-cinematic-node-halo" cx={cx} cy={cy} r="11" fill="url(#netlabNode)" opacity="0.06" />
            <circle className="home-cinematic-node-core" cx={cx} cy={cy} r="1.8" fill="rgba(200,255,240,0.66)" />
            <circle className="home-cinematic-node-ring" cx={cx} cy={cy} r="4.8" stroke="rgba(170,245,228,0.1)" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export default function Home() {
  const { setOpen: openPalette } = useCommandPalette();
  const heroRef = useRef<HTMLElement | null>(null);
  const [heroMotionPaused, setHeroMotionPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = !document.hidden;
    let isIntersecting = true;

    const updateMotionState = () => {
      setHeroMotionPaused(media.matches || !isVisible || !isIntersecting);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting && entry.intersectionRatio > 0.12;
        updateMotionState();
      },
      { threshold: [0, 0.12, 0.3] },
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      updateMotionState();
    };

    media.addEventListener("change", updateMotionState);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    updateMotionState();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", updateMotionState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <>
      <SEO page="home" />
      <div className="home-surface-merge relative w-full pb-28 text-foreground">
        <section
          ref={heroRef}
          className={`home-cinematic-hero app-bleed ${heroMotionPaused ? "is-motion-paused" : ""}`}
        >
          <div className="home-cinematic-backdrop" aria-hidden="true">
            <HeroSignalArtwork />
            <div className="home-cinematic-softfield">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="home-cinematic-bloomfield">
              <span />
              <span />
            </div>
            <div className="home-cinematic-orbs">
              <span />
              <span />
            </div>
            <div className="home-cinematic-lightfield">
              {heroFieldColumns.map((_, index) => (
                <span key={`backdrop-field-${index}`} />
              ))}
            </div>
            <div className="home-cinematic-streaks">
              {heroFieldStreaks.map((_, index) => (
                <span key={`backdrop-streak-${index}`} />
              ))}
            </div>
          </div>

          <div className="home-cinematic-grid app-shell">
            <div className="home-cinematic-copy">
              <p className="home-cinematic-eyebrow">Netlab command surface</p>
              <h1 className="home-cinematic-title">
                Read the public edge.
                <span>Before you touch production.</span>
              </h1>
              <p className="home-cinematic-body">
                One workspace for identity, DNS, path, service behavior, routing context,
                and bounded exposure when the internet-facing symptom is real but the
                failing layer is still unclear.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  onClick={() => openPalette(true)}
                  className="rounded-full bg-white px-6 text-neutral-950 hover:bg-white/92"
                >
                  Open command palette
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-6 text-white/74 hover:bg-white/[0.06] hover:text-white"
                  onClick={() =>
                    document.getElementById("coverage")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                >
                  Explore coverage
                </Button>
              </div>

              <div className="home-hero-shortcuts">
                {heroShortcuts.map((item) => (
                  <Link key={item.href} href={item.href} className="home-hero-shortcut">
                    <div>
                      <p className="tool-eyebrow">{item.label}</p>
                      <p className="mt-2 text-sm leading-7 text-white/64">{item.detail}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/30" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="home-cinematic-visual" aria-hidden="true">
              <div className="home-cinematic-stage">
                <div className="home-cinematic-console">
                  <div className="home-cinematic-console-head">
                    <span>public surface</span>
                    <span>netlab.edge</span>
                  </div>

                  <div className="home-cinematic-console-list">
                    <div className="home-cinematic-console-row">
                      <span>identity.resolve()</span>
                      <span>public ip, whois, subnet</span>
                    </div>
                    <div className="home-cinematic-console-row">
                      <span>dns.inspect()</span>
                      <span>lookup, propagation, authority</span>
                    </div>
                    <div className="home-cinematic-console-row">
                      <span>path.measure()</span>
                      <span>ping, trace, mtu, parity</span>
                    </div>
                    <div className="home-cinematic-console-row">
                      <span>service.read()</span>
                      <span>http, tls, web, email</span>
                    </div>
                    <div className="home-cinematic-console-row">
                      <span>control.escalate()</span>
                      <span>routing, exposure, operator depth</span>
                    </div>
                  </div>

                  <div className="home-cinematic-console-foot">
                    <span>operator-readable evidence</span>
                    <span>public-only</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="app-shell py-24">
          <div className="home-support-intro">
            <p className="tool-eyebrow">What the workspace covers</p>
            <h2 className="home-section-title">
              One investigation surface across the public stack.
            </h2>
            <p className="home-section-copy">
              The homepage should explain the operating model first. The layer menu above is
              for direct entry when you already know the exact function.
            </p>
          </div>

          <div className="home-support-marker" aria-hidden="true">
            <span>identity</span>
            <span>naming</span>
            <span>path</span>
            <span>service</span>
            <span>control</span>
          </div>

          <div className="home-support-columns">
            {supportColumns.map((column) => (
              <article key={column.title} className="home-support-column">
                <p className="tool-eyebrow">{column.title}</p>
                <p className="mt-4 text-[1.02rem] leading-8 text-white/76">{column.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="coverage" className="app-shell py-12">
          <div className="home-feature-layout">
            <div className="home-feature-intro">
              <p className="tool-eyebrow">Coverage</p>
              <h2 className="home-section-title">
                Follow the public signal in the order operators usually have to explain it.
              </h2>
              <p className="home-section-copy">
                Netlab is most useful when it keeps the investigation story coherent from first signal to deeper operator context.
              </p>
            </div>

            <div className="home-feature-bands">
              {featureBands.map((band) => (
                <Link key={band.id} href={band.href} className="home-feature-band">
                  <div className="home-feature-band-copy">
                    <p className="tool-eyebrow">{band.eyebrow}</p>
                    <h3 className="home-feature-band-title">{band.title}</h3>
                    <p className="text-[0.98rem] leading-8 text-white/62">{band.body}</p>
                  </div>
                  <div className="home-feature-band-meta">
                    <span>{band.cta}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="home-proof-section app-bleed mt-16">
          <div className="app-shell py-24">
            <div className="home-proof-grid">
              <div className="home-proof-copy">
                <p className="tool-eyebrow">Why teams use it</p>
                <h2 className="home-section-title">
                  Investigation speed comes from keeping fewer tabs open and more context intact.
                </h2>
                <p className="home-section-copy">
                  The value is not just having many tools. The value is that each one stays close
                  enough to the others that a public-edge incident can still be read as one system.
                </p>
              </div>

              <div className="home-proof-list">
                {operatorProof.map((item) => {
                  const Icon = item.icon;

                  return (
                    <article key={item.title} className="home-proof-item">
                      <Icon className="h-5 w-5 text-[rgb(164,234,222)]" />
                      <div>
                        <p className="tool-eyebrow">{item.title}</p>
                        <p className="mt-3 text-[0.98rem] leading-8 text-white/66">{item.body}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="app-shell py-24">
          <div className="home-workflow-layout">
            <div className="home-workflow-intro">
              <p className="tool-eyebrow">Common investigations</p>
              <h2 className="home-section-title">
                Start from the symptom when the layer is still ambiguous.
              </h2>
              <p className="home-section-copy">
                Workflow guides stay secondary on the homepage, but they matter when the problem is easy to describe and hard to place.
              </p>
            </div>

            <div className="home-workflow-list">
              {workflowHighlights.map((workflow, index) => (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => openPalette(true)}
                  className="home-workflow-row"
                >
                  <span className="home-workflow-index">0{index + 1}</span>
                  <div className="home-workflow-copy">
                    <h3 className="home-workflow-title">{workflow.title}</h3>
                    <p className="text-[0.98rem] leading-8 text-white/62">{workflow.description}</p>
                  </div>
                  <div className="home-workflow-meta">
                    <span>{workflow.steps} steps</span>
                    <Waypoints className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="app-shell pb-8">
          <div className="home-final-cta">
            <div>
              <p className="tool-eyebrow">Start here</p>
              <h2 className="home-section-title">
                Search when you know the function. Browse the layers when you know the surface.
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => openPalette(true)}
                className="rounded-full bg-white px-6 text-neutral-950 hover:bg-white/92"
              >
                Search all tools
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="rounded-full border border-white/10 bg-white/[0.03] px-6 text-white/74 hover:bg-white/[0.06] hover:text-white"
              >
                <Link href="/network-engineering">
                  Open engineering
                  <Network className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
