import { useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Orbit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { fetchIpv6TransitionReport } from "@/domains/engineering/api";
import type { Ipv6TransitionReport } from "@/domains/engineering/types";
import { ReportHistory } from "./ReportHistory";

function outcomeTone(outcome: "win" | "fallback" | "failed" | "not-tried") {
  if (outcome === "win") {
    return "text-emerald-200";
  }
  if (outcome === "fallback") {
    return "text-cyan-200";
  }
  if (outcome === "failed") {
    return "text-rose-200";
  }
  return "text-white/56";
}

export default function IPv6TransitionLab() {
  const [domain, setDomain] = useState("");
  const [report, setReport] = useState<Ipv6TransitionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      setReport(await fetchIpv6TransitionReport(domain.trim()));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "IPv6 transition report failed";
      setError(message);
      toast.error("IPv6 transition report failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <SEO page="ipv6TransitionLab" />
      <ToolPageShell
        title="IPv6 Transition Analysis"
        description="Model how dual-stack fallback behaves from this vantage point, including Happy Eyeballs, DNS64 or NAT64 evidence, and family-specific PMTU hints."
      >
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="tool-surface space-y-6">
            <div className="space-y-3">
              <span className="tool-kicker">
                <Orbit className="h-3.5 w-3.5" />
                Dual-stack reasoning
              </span>
              <div className="space-y-2">
                <p className="tool-heading">See how IPv6 can fail while users think the site is fine.</p>
                <p className="tool-copy">
                  This view models Happy Eyeballs fallback, looks for DNS64 or NAT64 evidence, and compares family reachability with IPv4 and IPv6 path MTU signals.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder="example.com"
              />
              <Button type="submit" disabled={isLoading || domain.trim().length === 0} className="rounded-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Inspect transition
              </Button>
            </div>
          </form>

          {error ? (
            <div className="rounded-[1.35rem] border border-rose-500/15 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {report ? (
            <>
              <section className="tool-surface space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Happy Eyeballs winner</p>
                    <p className="mt-3 text-2xl font-semibold capitalize text-white">{report.happyEyeballs.winner}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">DNS64 / NAT64</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{report.nat64.detected ? "Detected" : "Not seen"}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">IPv4 MTU</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{report.pathMtu.ipv4EstimatedMtu ?? "n/a"}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">IPv6 MTU</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{report.pathMtu.ipv6EstimatedMtu ?? "n/a"}</p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Family reachability</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64">
                        <p className="font-medium text-white">IPv4</p>
                        <p className="mt-1">{report.ipv4Addresses.join(", ") || "No A record"}</p>
                        <p className="mt-1">{report.ipv4.reachable ? "Reachable" : report.ipv4.error ?? "No confirmed path"}</p>
                      </div>
                      <div className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64">
                        <p className="font-medium text-white">IPv6</p>
                        <p className="mt-1">{report.ipv6Addresses.join(", ") || "No AAAA record"}</p>
                        <p className="mt-1">{report.ipv6.reachable ? "Reachable" : report.ipv6.error ?? "No confirmed path"}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64">
                      <p className="font-medium text-white">Resolver evidence</p>
                      <p className="mt-1">Prefix: {report.nat64.prefix ?? "n/a"}</p>
                      <p className="mt-1">{report.nat64.evidence.join(", ") || "No synthesized ipv4only.arpa AAAA answer was observed."}</p>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Happy Eyeballs model</p>
                    <p className="mt-3 text-sm text-white/62">{report.happyEyeballs.rationale}</p>
                    <div className="mt-4 space-y-3">
                      {report.happyEyeballs.steps.map((step) => (
                        <div key={`${step.family}-${step.order}`} className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-white">
                              {step.order}. {step.family.toUpperCase()}
                            </p>
                            <p className={`capitalize ${outcomeTone(step.outcome)}`}>{step.outcome}</p>
                          </div>
                          <p className="mt-1">Start delay: {step.startDelayMs}ms</p>
                          <p className="mt-1">Candidate: {step.candidate ?? "none"}</p>
                          <p className="mt-1">Latency: {step.latencyMs != null ? `${step.latencyMs.toFixed(1)}ms` : "n/a"}</p>
                          <p className="mt-1">{step.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {report.findings.map((finding) => (
                    <div key={finding.title} className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/68">
                      <p className="font-medium text-white">{finding.title}</p>
                      <p className="mt-1">{finding.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <ReportHistory history={report.history} />
            </>
          ) : null}
        </div>
      </ToolPageShell>
    </>
  );
}
