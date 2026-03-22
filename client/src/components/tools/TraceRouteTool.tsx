import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Route, Loader2, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { runTrace } from "@/domains/network/api";
import type { TraceSummary } from "@/domains/network/types";
import {
  GuidedTroubleshooting,
  type GuidedTroubleshootingItem,
} from "./GuidedTroubleshooting";

function buildTraceGuidance(result: TraceSummary | null): GuidedTroubleshootingItem[] {
  if (!result) {
    return [];
  }

  const firstTimeoutHop = result.hops.find((hop) => hop.status === "timeout");
  const lastHop = result.hops[result.hops.length - 1];
  const items: GuidedTroubleshootingItem[] = [];

  if (result.completed) {
    items.push({
      title: "The destination is reachable within the current hop budget.",
      detail:
        "You reached the target before the bounded trace stopped, so the path is visible enough for a first-pass network check.",
      nextStep:
        "If the service still feels slow, compare this path with Ping and the HTTP/TLS Inspector to see whether delay is network or application level.",
      tone: "good",
    });
  }

  if (firstTimeoutHop) {
    items.push({
      title: `Timeouts begin at hop ${firstTimeoutHop.hop}.`,
      detail:
        "This usually means filtering, ICMP rate limiting, or a path segment that no longer returns TTL-expired responses.",
      nextStep:
        "Run Ping against the same host and inspect TCP reachability before assuming the target is down.",
      tone: "warn",
    });
  }

  if (!result.completed && lastHop && lastHop.status !== "timeout") {
    items.push({
      title: "The trace did not reach the destination inside the current limit.",
      detail:
        "The host may be farther away than the current hop budget or one of the middle hops may suppress responses.",
      nextStep:
        "Increase the hop budget a little, then compare with DNS and HTTP/TLS results for the same hostname.",
      tone: "info",
    });
  }

  return items;
}

export default function TraceRouteTool() {
  const [host, setHost] = useState("");
  const [maxHops, setMaxHops] = useState("8");
  const [timeoutMs, setTimeoutMs] = useState("2000");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TraceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guidance = useMemo(() => buildTraceGuidance(result), [result]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const trace = await runTrace(host.trim(), Number(maxHops), Number(timeoutMs));
      setResult(trace);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Trace failed";
      setError(message);
      toast.error("Trace route failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <SEO page="traceTool" />
      <ToolPageShell
        title="Trace Route"
        description="Run a bounded hop-by-hop probe toward a public target to see where the path starts degrading."
      >
        <div className="space-y-4">
          <div className="tool-grid">
            <div className="space-y-4">
              <form onSubmit={handleSubmit} className="tool-surface space-y-6">
                <div className="space-y-3">
                  <span className="tool-kicker">
                    <Route className="h-3.5 w-3.5" />
                    Bounded path probe
                  </span>
                  <div className="space-y-2">
                    <p className="tool-heading">
                      Trace the public path before you blame the application.
                    </p>
                    <p className="tool-copy">
                      This is a lightweight, bounded probe meant for public-network diagnostics.
                      It stops early once the destination is reached.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-white">Host</span>
                    <Input
                      value={host}
                      onChange={(event) => setHost(event.target.value)}
                      placeholder="example.com"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-white">Max hops</span>
                    <Input
                      type="number"
                      min={1}
                      max={16}
                      value={maxHops}
                      onChange={(event) => setMaxHops(event.target.value)}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-white">Timeout (ms)</span>
                    <Input
                      type="number"
                      min={1000}
                      max={5000}
                      step={100}
                      value={timeoutMs}
                      onChange={(event) => setTimeoutMs(event.target.value)}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading || host.trim().length === 0}
                    className="rounded-full"
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Run Trace
                  </Button>
                  <p className="text-sm text-white/52">
                    Public targets only. Hop budget and timeout are intentionally capped.
                  </p>
                </div>
              </form>

              {error ? (
                <div className="rounded-[1.35rem] border border-rose-500/15 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              {result ? (
                <section className="tool-surface space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="tool-kicker">Trace results</span>
                      <h2 className="tool-heading">Hop map for {result.host}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-white/42">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        target {result.targetIp}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        {result.hops.length} hops observed
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {result.hops.map((hop) => (
                      <div
                        key={hop.hop}
                        className="flex flex-wrap items-center gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-sm font-semibold text-white">
                          {hop.hop}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white">
                            {hop.responder || "No reply"}
                          </p>
                          <p className="text-sm text-white/52">
                            {hop.status === "destination"
                              ? "Destination reached"
                              : hop.status === "timeout"
                                ? "Timed out at this hop"
                                : "Intermediate hop"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/58">
                          <LocateFixed className="h-3.5 w-3.5" />
                          {hop.latencyMs == null ? "n/a" : `${hop.latencyMs.toFixed(1)}ms`}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <GuidedTroubleshooting items={guidance} />
            </div>
          </div>
        </div>
      </ToolPageShell>
    </>
  );
}
