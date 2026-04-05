import { useState } from "react";
import { toast } from "react-hot-toast";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { fetchPerformanceLabReport } from "@/domains/engineering/api";
import type { PerformanceLabReport } from "@/domains/engineering/types";
import { ReportHistory } from "./ReportHistory";

function qualityTone(quality: PerformanceLabReport["pathQuality"]) {
  if (quality === "excellent") {
    return "text-emerald-200";
  }
  if (quality === "steady") {
    return "text-cyan-100";
  }
  if (quality === "degraded") {
    return "text-amber-200";
  }
  return "text-rose-200";
}

export default function PerformanceLab() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<PerformanceLabReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      setReport(await fetchPerformanceLabReport(input.trim()));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Performance analysis failed";
      setError(message);
      toast.error("Performance analysis failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <SEO page="performanceLab" />
      <ToolPageShell
        title="Performance Analysis"
        description="Use bounded ping, trace, and path MTU evidence to reason about jitter, loss, and path quality before heavier testing."
      >
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="tool-surface space-y-6">
            <div className="space-y-3">
              <span className="tool-kicker">
                <Activity className="h-3.5 w-3.5" />
                Lightweight path quality
              </span>
              <div className="space-y-2">
                <p className="tool-heading">Measure what the path feels like, not just whether it answers.</p>
                <p className="tool-copy">
                  This view combines a short ICMP sample window, a bounded trace, and path MTU context to estimate whether the path feels steady, degraded, or poor.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="example.com or 1.1.1.1"
              />
              <Button type="submit" disabled={isLoading || input.trim().length === 0} className="rounded-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Measure quality
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
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Average latency</p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {report.avgLatencyMs != null ? `${report.avgLatencyMs.toFixed(1)}ms` : "n/a"}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Jitter</p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {report.jitterMs != null ? `${report.jitterMs.toFixed(1)}ms` : "n/a"}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Packet loss</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{report.packetLossPercent.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Path quality</p>
                    <p className={`mt-3 text-2xl font-semibold capitalize ${qualityTone(report.pathQuality)}`}>
                      {report.pathQuality}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Latency samples</p>
                    <div className="mt-4 space-y-3">
                      {report.samples.map((sample) => (
                        <div key={sample.sequence} className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-white">Probe {sample.sequence + 1}</p>
                            <p>{sample.success && sample.latencyMs != null ? `${sample.latencyMs.toFixed(1)}ms` : "failed"}</p>
                          </div>
                          {sample.error ? <p className="mt-1 text-rose-200">{sample.error}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Path context</p>
                    <div className="mt-4 space-y-3 text-sm text-white/64">
                      <p>Resolved target: {report.targetIp}</p>
                      <p>Trace completed: {report.trace.completed ? "yes" : "no"}</p>
                      <p>Observed hop count: {report.trace.hops.length}</p>
                      <p>Estimated path MTU: {report.pathMtu.estimatedPathMtu ?? "n/a"}</p>
                    </div>

                    <div className="mt-4 space-y-3">
                      {report.trace.hops.map((hop) => (
                        <div key={hop.hop} className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64">
                          <p className="font-medium text-white">Hop {hop.hop}</p>
                          <p className="mt-1">{hop.responder ?? "timeout"}</p>
                          <p className="mt-1">{hop.latencyMs != null ? `${hop.latencyMs.toFixed(1)}ms` : "no latency sample"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {report.findings.map((finding) => (
                    <div
                      key={finding.title}
                      className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/68"
                    >
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
