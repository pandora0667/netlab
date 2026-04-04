import { Button } from "@/components/ui/button";
import { useCommandPalette } from "@/components/layout/command-palette";
import { SEO } from "../components/SEO";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Globe2,
  Mail,
  Route,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { getTechnicalLayerGroups, getToolPages, workflowCatalog } from "../../../shared/catalog/site-catalog";

const technicalLayers = getTechnicalLayerGroups().filter((layer) => layer.key !== "overview");
const toolCount = getToolPages().length;
const workflowCount = workflowCatalog.length;

const heroSignals = [
  "Public-only scope",
  "Readable evidence",
  "Bounded checks",
];

const heroSurfaceRows = [
  {
    label: "Identity",
    title: "Anchor the target first",
    body: "Confirm public IP, ownership, and subnet context before deeper checks muddy the story.",
  },
  {
    label: "DNS and path",
    title: "Find where the symptom begins",
    body: "Keep resolver truth, propagation drift, latency, and hop behavior close enough to compare.",
  },
  {
    label: "Service edge",
    title: "Read what the internet actually receives",
    body: "Inspect HTTP, TLS, website posture, and mail controls instead of assuming the edge is healthy.",
  },
  {
    label: "Control and exposure",
    title: "Escalate with operator context",
    body: "Move into routing, authority, parity, MTU, and bounded surface checks without leaving the same workspace.",
  },
];

const proofMetrics = [
  {
    value: "1",
    label: "Workspace",
    description: "Keep identity, DNS, path, service edge, control plane, and exposure context together.",
  },
  {
    value: `${technicalLayers.length}`,
    label: "Layers",
    description: "Organized by where evidence lives on the public internet, not by random utility names.",
  },
  {
    value: `${toolCount}`,
    label: "Routes",
    description: "Focused diagnostics for public targets, from egress identity through bounded port exposure.",
  },
  {
    value: `${workflowCount}`,
    label: "Guides",
    description: "Symptom-led investigation flows for the moments when you know the pain before the layer.",
  },
];

const productNarrative = [
  {
    title: "Keep one story",
    body: "Public incidents are usually explained across too many disconnected tools. Netlab keeps identity, naming, path, service behavior, routing context, and bounded exposure in one operator-facing workspace so the evidence stays connected.",
  },
  {
    title: "Read across layers",
    body: "The goal is to show where the problem actually starts, not just return isolated raw responses. That makes it easier to separate DNS, path, service, and control-plane issues before anyone changes configuration.",
  },
  {
    title: "Stay inside policy",
    body: "Netlab is intentionally biased toward public targets and explainable diagnostics. It is built for verification and analysis, not private-network discovery or opaque active scanning.",
  },
];

const investigationArcs = [
  {
    number: "01",
    title: "Establish identity before you debug behavior.",
    label: "Identity and ownership",
    description: "Many failures get escalated before anyone confirms which public IP, registrar, ownership record, or subnet boundary is actually in play. Netlab starts by anchoring the target in something concrete.",
    questions: [
      "What public identity is the target presenting right now?",
      "Does ownership or registration context explain the issue?",
      "Are we debugging the right network boundary in the first place?",
    ],
  },
  {
    number: "02",
    title: "Separate naming from transport before blaming the app.",
    label: "Naming and reachability",
    description: "A surprising amount of edge noise comes from DNS drift, resolver disagreement, or path instability rather than the application itself. Netlab keeps those checks next to each other so they can be compared instead of guessed.",
    questions: [
      "Does the hostname resolve correctly and consistently?",
      "Is the issue propagation, path behavior, or raw reachability?",
      "Where does latency or timeout start showing up from the public edge?",
    ],
  },
  {
    number: "03",
    title: "Inspect the service the way users and mail receivers see it.",
    label: "Service edge and delivery",
    description: "When the target resolves, the next problem is usually not existence but quality. Netlab surfaces redirect chains, TLS posture, website controls, and mail security signals so teams can explain what the public edge is actually delivering.",
    questions: [
      "Is the web edge behaving correctly under HTTP and TLS?",
      "Do security headers, HSTS, DNS controls, and certificates line up?",
      "Does mail posture explain deliverability or transport trust problems?",
    ],
  },
  {
    number: "04",
    title: "Move into operator context without leaving the same workspace.",
    label: "Control plane and exposure",
    description: "Sometimes the problem is neither DNS nor the app. Routing visibility, authority drift, IPv4 or IPv6 mismatch, path MTU, or exposed surface area can all create symptoms that look like application bugs. Netlab keeps those checks in the same narrative instead of making them a separate product.",
    questions: [
      "Is routing or authority state creating the observed symptom?",
      "Do IPv4 and IPv6 present the same reality from the edge?",
      "What public surface is actually reachable right now?",
    ],
  },
];

const operatorMoments = [
  {
    title: "During cutovers and changes",
    description: "Use Netlab when a DNS, edge, or security change has been made and you need public evidence before rolling forward or rolling back.",
    outcomes: [
      "Confirm whether propagation is complete or still drifting.",
      "Check whether the web edge matches the intended policy.",
      "Collect evidence that can be shared outside the change window.",
    ],
  },
  {
    title: "During incidents and escalations",
    description: "Use it when the symptom is real but the failing layer is still ambiguous. The goal is to stop guessing which team owns the next move.",
    outcomes: [
      "Separate resolver issues from path or service failures.",
      "Show where the symptom begins from the public side.",
      "Escalate with context instead of screenshots and intuition.",
    ],
  },
  {
    title: "During periodic review",
    description: "Use Netlab to audit public posture and exposure before there is an outage, especially for domains, external services, and mail edge configuration.",
    outcomes: [
      "Identify posture gaps that are easy to miss in raw output.",
      "Review public surface area without crossing into private discovery.",
      "Keep an operator-readable record of what the edge looks like today.",
    ],
  },
];

const trustBoundaries = [
  {
    title: "Public targets only",
    body: "The workspace is built around public domains, hostnames, and IPs. It is not a pivot into internal networks.",
  },
  {
    title: "Bounded probing",
    body: "Diagnostics are designed to stay explainable and contained, including bounded port checks and redacted local trace context.",
  },
  {
    title: "Readable outputs",
    body: "The goal is to translate edge behavior into operator evidence, not just return raw protocol fragments without context.",
  },
  {
    title: "Cross-layer context",
    body: "Identity, naming, path, service, and control-plane evidence stay close enough to be compared during one investigation.",
  },
];

export default function Home() {
  const { setOpen: openPalette } = useCommandPalette();

  return (
    <>
      <SEO page="home" />
      <div className="w-full space-y-24 pb-24">
        <section className="home-hero app-bleed overflow-hidden">
          <div className="app-shell py-14 lg:py-20">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
              <div className="max-w-[42rem]">
                <div className="flex flex-wrap gap-2">
                  {heroSignals.map((signal) => (
                    <span key={signal} className="tool-kicker">
                      {signal}
                    </span>
                  ))}
                </div>

                <h1 className="mt-6 max-w-[7.5ch] font-['Space_Grotesk'] text-5xl font-bold leading-[0.9] tracking-[-0.07em] text-white sm:text-6xl lg:text-[5.8rem]">
                  Explain the public edge before you change it.
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-8 text-white/62 sm:text-lg">
                  Netlab gives network, platform, and security teams one public diagnostics
                  workspace for reading identity, naming, path behavior, service edge,
                  routing context, and bounded exposure without losing the investigation narrative.
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
                    onClick={() =>
                      document.getElementById("coverage")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                  >
                    See what the workspace covers
                  </Button>
                </div>
              </div>

              <div className="home-hero-visual">
                <div className="home-hero-console">
                  <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
                    <div className="space-y-2">
                      <p className="tool-eyebrow">Public investigation surface</p>
                      <p className="max-w-md text-sm leading-7 text-white/58">
                        Start with the big public question, then move downward only as far as the evidence requires.
                      </p>
                    </div>
                    <div className="rounded-full border border-emerald-300/18 bg-emerald-300/8 px-3 py-2 text-[0.68rem] uppercase tracking-[0.18em] text-emerald-100/72">
                      Public-only
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {heroSurfaceRows.map((row) => (
                      <article key={row.title} className="home-hero-console-row">
                        <div className="space-y-2">
                          <p className="tool-eyebrow">{row.label}</p>
                          <h3 className="font-['Space_Grotesk'] text-xl font-semibold tracking-[-0.04em] text-white">
                            {row.title}
                          </h3>
                          <p className="text-sm leading-7 text-white/62">
                            {row.body}
                          </p>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/28" />
                      </article>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
                    {technicalLayers.map((layer) => (
                      <span
                        key={layer.key}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[0.7rem] uppercase tracking-[0.18em] text-white/54"
                      >
                        {layer.shortLabel}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="home-hero-metrics mt-10">
              {proofMetrics.map((metric) => (
                <article key={metric.label} className="home-hero-metric">
                  <p className="tool-metric-label">{metric.label}</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <p className="tool-metric-value">{metric.value}</p>
                    <ArrowUpRight className="mb-1 h-4 w-4 shrink-0 text-white/24" />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/56">
                    {metric.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="max-w-xl space-y-4">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-white/40">
              Investigation Model
            </p>
            <h2 className="font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-white sm:text-4xl">
              One public narrative from identity through exposure.
            </h2>
            <p className="text-sm leading-7 text-white/56 sm:text-base">
              Netlab is designed to keep public evidence in order, so teams can explain
              what layer is actually failing before a change window, an escalation, or a postmortem
              turns into guesswork.
            </p>
          </div>

          <div className="space-y-4">
            {productNarrative.map((item) => (
              <article key={item.title} className="tool-surface-muted space-y-3">
                <p className="tool-eyebrow">{item.title}</p>
                <p className="text-sm leading-7 text-white/64">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="coverage" className="space-y-8">
          <div className="max-w-3xl space-y-3">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-white/40">
              Investigation Coverage
            </p>
            <h2 className="font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-white sm:text-4xl">
              Follow the public stack in the order operators usually have to explain it.
            </h2>
            <p className="text-sm leading-7 text-white/56 sm:text-base">
              Instead of reading like a pile of unrelated utilities, Netlab is organized
              around the questions teams actually ask while debugging internet-facing systems.
            </p>
          </div>

          <div className="hero-panel overflow-hidden">
            {investigationArcs.map((arc, index) => (
              <article
                key={arc.number}
                className={`grid gap-6 p-6 lg:grid-cols-[minmax(0,0.76fr)_minmax(0,1.24fr)] lg:gap-10 lg:p-8 ${
                  index === 0 ? "" : "border-t border-white/8"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-['IBM_Plex_Mono'] text-[0.72rem] uppercase tracking-[0.18em] text-white/52">
                      {arc.number}
                    </span>
                    <span className="tool-eyebrow">{arc.label}</span>
                  </div>
                  <h3 className="max-w-xl font-['Space_Grotesk'] text-2xl font-semibold tracking-[-0.04em] text-white sm:text-[2rem]">
                    {arc.title}
                  </h3>
                  <p className="max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                    {arc.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {arc.questions.map((question) => (
                    <div
                      key={question}
                      className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-white/72"
                    >
                      {question}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div className="max-w-3xl space-y-3">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-white/40">
              Typical Moments
            </p>
            <h2 className="font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-white sm:text-4xl">
              Use the workspace when the symptom is obvious but the owning layer is not.
            </h2>
            <p className="text-sm leading-7 text-white/56 sm:text-base">
              These are the moments when operator teams usually need a shared public view
              before they can decide whether to change something, escalate something, or leave it alone.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {operatorMoments.map((moment) => (
              <article key={moment.title} className="tool-surface space-y-5">
                <div className="space-y-3">
                  <p className="tool-eyebrow">{moment.title}</p>
                  <p className="text-base leading-8 text-white/72">
                    {moment.description}
                  </p>
                </div>
                <div className="space-y-3 border-t border-white/8 pt-4">
                  {moment.outcomes.map((outcome) => (
                    <div
                      key={outcome}
                      className="flex items-start gap-3 rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3"
                    >
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/34" />
                      <span className="text-sm leading-7 text-white/68">{outcome}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="max-w-xl space-y-4">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-white/40">
              Trust Boundary
            </p>
            <h2 className="font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-white sm:text-4xl">
              Public by design, bounded by policy, and written for humans who need evidence.
            </h2>
            <p className="text-sm leading-7 text-white/56 sm:text-base">
              A diagnostics workspace only stays useful if people can trust where it stops.
              Netlab should make that boundary explicit instead of hiding it in a footer note.
            </p>

            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <div className="tool-surface-muted flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(181,219,235)]" />
                <div className="space-y-1">
                  <p className="tool-eyebrow">Readable by default</p>
                  <p className="text-sm leading-7 text-white/62">
                    Focused on explanation, not raw protocol noise.
                  </p>
                </div>
              </div>
              <div className="tool-surface-muted flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(181,219,235)]" />
                <div className="space-y-1">
                  <p className="tool-eyebrow">Bounded actions</p>
                  <p className="text-sm leading-7 text-white/62">
                    Public-only targets and constrained diagnostics.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {trustBoundaries.map((item, index) => {
              const Icon = [Globe2, Route, Waypoints, Mail][index] ?? BadgeCheck;

              return (
                <article key={item.title} className="tool-surface space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[rgb(181,219,235)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-['Space_Grotesk'] text-xl font-semibold tracking-[-0.04em] text-white">
                      {item.title}
                    </p>
                  </div>
                  <p className="text-sm leading-7 text-white/62">
                    {item.body}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="hero-panel overflow-hidden">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-10">
            <div className="max-w-3xl space-y-4">
              <p className="text-[0.72rem] uppercase tracking-[0.26em] text-white/40">
                Start When Ready
              </p>
              <h2 className="font-['Space_Grotesk'] text-3xl font-bold tracking-[-0.05em] text-white sm:text-4xl">
                Use search when you know the function. Use the layer menu when you know the surface. Use the homepage when you need the story first.
              </h2>
              <p className="text-sm leading-7 text-white/58 sm:text-base">
                The top navigation is there for direct access. This page is here to explain
                what Netlab is actually for, how broad the workspace is, and why its boundary matters.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
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
                onClick={() =>
                  document.getElementById("coverage")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              >
                Review coverage
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
