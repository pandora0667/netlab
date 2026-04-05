import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { ShieldCheck, Loader2, ArrowUpRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { inspectHttpTarget } from "@/domains/network/api";
import type { HttpTlsInspectionResult } from "@/domains/network/types";
import {
  GuidedTroubleshooting,
  type GuidedTroubleshootingItem,
} from "./GuidedTroubleshooting";

function formatProbeMetric(value: number | null) {
  return value == null ? "n/a" : `${value.toFixed(1)} ms`;
}

function verdictBadgeCopy(verdict: HttpTlsInspectionResult["http3Assessment"]["verdict"]) {
  switch (verdict) {
    case "advertised-working":
      return "advertised / working";
    case "advertised-failed":
      return "advertised / failed";
    case "binary-unavailable":
      return "advertised / unverified";
    case "not-advertised":
      return "not advertised";
    default:
      return "not applicable";
  }
}

function buildInspectorGuidance(
  result: HttpTlsInspectionResult | null,
): GuidedTroubleshootingItem[] {
  if (!result) {
    return [];
  }

  const items: GuidedTroubleshootingItem[] = [];
  const hasRedirects = result.redirects.length > 1;
  const expiresInDays = result.certificate?.expiresInDays;

  if (result.protocol !== "https:") {
    items.push({
      title: "The final service is not using HTTPS.",
      detail:
        "You are landing on an HTTP endpoint, so transport security, HSTS, and modern TLS checks are not in effect.",
      nextStep: "Redirect the public entrypoint to HTTPS and inspect the certificate again.",
      tone: "warn",
    });
  }

  if (hasRedirects) {
    items.push({
      title: "There is a redirect chain in front of the final response.",
      detail:
        "Extra hops at the HTTP layer can add latency and complicate caching or canonical behavior.",
      nextStep: "Collapse unnecessary redirects if you can reach the same final URL directly.",
      tone: "info",
    });
  }

  if (result.protocol === "https:" && !result.hsts) {
    items.push({
      title: "HTTPS is active, but HSTS is missing.",
      detail:
        "Without Strict-Transport-Security, browsers may still attempt plain HTTP before upgrading.",
      nextStep: "Add a safe HSTS policy once you are certain every subresource is HTTPS-ready.",
      tone: "warn",
    });
  }

  if (result.protocol === "https:" && result.tlsAuthorized === false) {
    items.push({
      title: "The TLS certificate chain did not verify cleanly.",
      detail:
        result.tlsAuthorizationError
          ? `The connection negotiated TLS, but verification reported: ${result.tlsAuthorizationError}.`
          : "The connection negotiated TLS, but the certificate chain did not verify cleanly.",
      nextStep:
        "Check the served certificate chain and intermediate certificates on the public edge.",
      tone: "warn",
    });
  }

  if (result.http3Assessment.verdict === "advertised-working") {
    items.push({
      title: "The edge is advertising and serving HTTP/3.",
      detail:
        `${result.http3Assessment.summary} ${result.httpComparison.summary}`,
      nextStep: result.http3Assessment.nextStep,
      tone: "good",
    });
  }

  if (result.http3Assessment.verdict === "advertised-failed") {
    items.push({
      title: "HTTP/3 was advertised, but the real QUIC transaction did not complete cleanly.",
      detail: `${result.http3Assessment.summary} ${result.http3.detail}`,
      nextStep: result.http3Assessment.nextStep,
      tone: "warn",
    });
  }

  if (result.http3Assessment.verdict === "binary-unavailable") {
    items.push({
      title: "The edge advertises HTTP/3, but this runtime could not validate it.",
      detail: result.http3Assessment.summary,
      nextStep: result.http3Assessment.nextStep,
      tone: "info",
    });
  }

  if (result.http3Assessment.verdict === "not-advertised" && result.protocol === "https:") {
    items.push({
      title: "The HTTPS edge looks conventional HTTP/2-first right now.",
      detail: result.http3Assessment.summary,
      nextStep: result.http3Assessment.nextStep,
      tone: "info",
    });
  }

  if (typeof expiresInDays === "number" && expiresInDays >= 0 && expiresInDays <= 30) {
    items.push({
      title: "The TLS certificate is approaching expiry.",
      detail:
        "Short remaining certificate lifetime increases the risk of an avoidable outage if renewal fails.",
      nextStep: "Verify automated renewal and check the served certificate on every edge or proxy layer.",
      tone: "warn",
    });
  }

  if (items.length === 0) {
    items.push({
      title: "The service layer looks healthy at first pass.",
      detail:
        "The inspector found a stable final response without an obvious TLS or redirect issue.",
      nextStep: "If users still report problems, compare this result with Ping, Trace Route, and DNS Propagation.",
      tone: "good",
    });
  }

  return items;
}

export default function HttpTlsInspector() {
  const [input, setInput] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("5000");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HttpTlsInspectionResult | null>(null);

  const guidance = useMemo(() => buildInspectorGuidance(result), [result]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const inspection = await inspectHttpTarget(input.trim(), Number(timeoutMs));
      setResult(inspection);
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : "HTTP inspection failed";
      setError(message);
      toast.error("HTTP/TLS inspection failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <SEO page="httpInspector" />
      <ToolPageShell
        title="HTTP/TLS Inspector"
        description="Inspect redirect chains, response headers, TLS version, HSTS, and certificate health for a public web target."
      >
        <div className="space-y-4">
          <div className="tool-grid">
            <div className="space-y-4">
              <form onSubmit={handleSubmit} className="tool-surface space-y-6">
                <div className="space-y-3">
                  <span className="tool-kicker">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Service layer
                  </span>
                  <div className="space-y-2">
                    <p className="tool-heading">
                      Inspect what happens after DNS and before users blame the app.
                    </p>
                    <p className="tool-copy">
                      Use a host or full URL. The inspector follows a short redirect chain and
                      captures response headers, HSTS, TLS version, and certificate timing.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-white">URL or host</span>
                    <Input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="https://example.com"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-white">Timeout (ms)</span>
                    <Input
                      type="number"
                      min={1000}
                      max={10000}
                      step={250}
                      value={timeoutMs}
                      onChange={(event) => setTimeoutMs(event.target.value)}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading || input.trim().length === 0}
                    className="rounded-full"
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Inspect HTTP/TLS
                  </Button>
                  <p className="text-sm text-white/52">
                    Public URLs only. Redirect depth and timeout are intentionally bounded.
                  </p>
                </div>
              </form>

              {error ? (
                <div className="rounded-[1.35rem] border border-rose-500/15 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              {result ? (
                <section className="tool-surface space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="tool-kicker">Inspection result</span>
                      <h2 className="tool-heading">{result.finalUrl}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-white/42">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        status {result.status}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        {result.tlsVersion ?? "no tls"}
                      </span>
                      {result.alpnProtocol ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          ALPN {result.alpnProtocol}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                        Final status
                      </p>
                      <p className="mt-3 text-3xl font-semibold text-white">{result.status}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                        Redirects
                      </p>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {Math.max(0, result.redirects.length - 1)}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                        TLS
                      </p>
                      <p className="mt-3 text-xl font-semibold text-white">
                        {result.tlsVersion ?? "Unavailable"}
                      </p>
                      {result.alpnProtocol ? (
                        <p className="mt-2 text-sm text-cyan-100">
                          ALPN {result.alpnProtocol}
                        </p>
                      ) : null}
                      {result.tlsAuthorized === false ? (
                        <p className="mt-2 text-sm text-amber-200">
                          Verification warning
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                        Transport
                      </p>
                      <p className="mt-3 text-xl font-semibold text-white">
                        {verdictBadgeCopy(result.http3Assessment.verdict)}
                      </p>
                      <p className="mt-2 text-sm text-white/52">
                        {result.http3Assessment.evidenceSources.join(" + ") || "HTTP/2 only"}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                        HSTS
                      </p>
                      <p className="mt-3 text-xl font-semibold text-white">
                        {result.hsts ? "Enabled" : "Missing"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <div className="space-y-2">
                        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                          HTTP/3 verdict
                        </p>
                        <p className="text-lg font-semibold text-white">
                          {result.http3Assessment.summary}
                        </p>
                        <p className="text-sm text-white/54">
                          {result.http3Assessment.nextStep}
                        </p>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-white/62">
                        <p><span className="text-white/42">Alt-Svc:</span> {result.altSvcRaw ?? "none"}</p>
                        <p><span className="text-white/42">Advertised protocols:</span> {result.altSvcProtocols.join(", ") || "none"}</p>
                        <p><span className="text-white/42">Evidence sources:</span> {result.http3Assessment.evidenceSources.join(", ") || "none"}</p>
                        <p><span className="text-white/42">HTTP/3 probe:</span> {result.http3.succeeded == null ? "not attempted" : result.http3.succeeded ? "succeeded" : "failed"}</p>
                        <p><span className="text-white/42">Detail:</span> {result.http3.detail}</p>
                        {result.http3.httpVersion ? (
                          <p><span className="text-white/42">HTTP version:</span> {result.http3.httpVersion}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                        HTTPS / SVCB records
                      </p>
                      <div className="mt-4 space-y-3">
                        {result.serviceBindings.length > 0 ? (
                          result.serviceBindings.map((record, index) => (
                            <div
                              key={`${record.recordType}-${record.priority}-${index}`}
                              className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64"
                            >
                              <p className="font-medium text-white">
                                {record.recordType} priority {record.priority} → {record.targetName}
                              </p>
                              <p className="mt-1">ALPN: {record.alpns.join(", ") || "n/a"}</p>
                              <p className="mt-1">Port: {record.port ?? "default"}</p>
                              <p className="mt-1">IPv4 hints: {record.ipv4Hints.join(", ") || "n/a"}</p>
                              <p className="mt-1">IPv6 hints: {record.ipv6Hints.join(", ") || "n/a"}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-white/54">
                            No structured HTTPS/SVCB records were parsed for this hostname.
                          </p>
                        )}
                        {result.serviceBindingNotes.map((note) => (
                          <p key={note} className="text-xs text-white/42">{note}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {[result.http2Probe, result.http3].filter(Boolean).map((probe) => (
                      <div
                        key={probe?.protocol}
                        className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4"
                      >
                        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                          {probe?.protocol === "http2" ? "HTTP/2 transaction" : "HTTP/3 transaction"}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/36">Status</p>
                            <p className="mt-1 text-base font-semibold text-white">
                              {probe?.succeeded == null ? "not attempted" : probe.succeeded ? "succeeded" : "failed"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/36">HTTP version</p>
                            <p className="mt-1 text-base font-semibold text-white">
                              {probe?.httpVersion ?? "n/a"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/36">Status code</p>
                            <p className="mt-1 text-base font-semibold text-white">
                              {probe?.statusCode ?? "n/a"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/36">Remote IP</p>
                            <p className="mt-1 text-base font-semibold text-white">
                              {probe?.remoteIp ?? "n/a"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/36">Connect</p>
                            <p className="mt-1 text-base font-semibold text-white">
                              {formatProbeMetric(probe?.connectMs ?? null)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/36">TLS handshake</p>
                            <p className="mt-1 text-base font-semibold text-white">
                              {formatProbeMetric(probe?.tlsHandshakeMs ?? null)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/36">TTFB</p>
                            <p className="mt-1 text-base font-semibold text-white">
                              {formatProbeMetric(probe?.ttfbMs ?? null)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/36">Binary</p>
                            <p className="mt-1 text-sm text-white/62">
                              {probe?.binary ?? "n/a"}
                            </p>
                          </div>
                        </div>
                        <p className="mt-4 text-sm text-white/54">{probe?.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                      Protocol comparison
                    </p>
                    <div className="mt-4 space-y-2 text-sm text-white/62">
                      <p>{result.httpComparison.summary}</p>
                      <p><span className="text-white/42">TTFB delta:</span> {result.httpComparison.ttfbDeltaMs == null ? "n/a" : `${result.httpComparison.ttfbDeltaMs} ms (HTTP/3 - HTTP/2)`}</p>
                      <p><span className="text-white/42">Connect delta:</span> {result.httpComparison.connectDeltaMs == null ? "n/a" : `${result.httpComparison.connectDeltaMs} ms (HTTP/3 - HTTP/2)`}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                        Certificate
                      </p>
                      <div className="mt-4 space-y-3 text-sm text-white/62">
                        <p><span className="text-white/42">Subject:</span> {result.certificate?.subject ?? "n/a"}</p>
                        <p><span className="text-white/42">Issuer:</span> {result.certificate?.issuer ?? "n/a"}</p>
                        <p><span className="text-white/42">Valid to:</span> {result.certificate?.validTo ?? "n/a"}</p>
                        <p><span className="text-white/42">Days left:</span> {result.certificate?.expiresInDays ?? "n/a"}</p>
                        <p>
                          <span className="text-white/42">Verification:</span>{" "}
                          {result.tlsAuthorized == null
                            ? "n/a"
                            : result.tlsAuthorized
                              ? "Trusted"
                              : result.tlsAuthorizationError ?? "Verification failed"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                        Redirect chain
                      </p>
                      <div className="mt-4 space-y-3">
                        {result.redirects.map((redirect, index) => (
                          <div
                            key={`${redirect.url}-${index}`}
                            className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3"
                          >
                            <div className="flex items-center gap-2 text-sm font-medium text-white">
                              <Lock className="h-4 w-4 text-white/42" />
                              <span>{redirect.status}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-white/34" />
                              <span className="truncate">{redirect.url}</span>
                            </div>
                            {redirect.location ? (
                              <p className="mt-2 text-sm text-white/54">
                                Location: {redirect.location}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
                      Response headers
                    </p>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {Object.entries(result.responseHeaders).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3"
                        >
                          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/36">
                            {key}
                          </p>
                          <p className="mt-2 break-all text-sm text-white/64">{value}</p>
                        </div>
                      ))}
                    </div>
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
