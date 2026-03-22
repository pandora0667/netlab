import { useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { fetchWebsiteSecurityReport } from "@/domains/engineering/api";
import type { WebsiteSecurityReport as WebsiteSecurityReportData } from "@/domains/engineering/types";
import { ReportHistory } from "./ReportHistory";

function resolveCheckTone(status: "pass" | "warn" | "fail" | "info") {
  if (status === "pass") {
    return "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-100";
  }

  if (status === "warn") {
    return "border-amber-400/15 bg-amber-400/[0.05] text-amber-100";
  }

  if (status === "info") {
    return "border-cyan-400/15 bg-cyan-400/[0.05] text-cyan-100";
  }

  return "border-rose-500/15 bg-rose-500/[0.06] text-rose-100";
}

export default function WebsiteSecurityReport() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WebsiteSecurityReportData | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      setReport(await fetchWebsiteSecurityReport(input.trim()));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Website security report failed";
      setError(message);
      toast.error("Website security report failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <SEO page="websiteSecurity" />
      <ToolPageShell
        title="Website Security Posture"
        description="Turn raw HTTP, TLS, and DNS signals into a concise website security score with operational findings."
      >
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="tool-surface space-y-6">
            <div className="space-y-3">
              <span className="tool-kicker">
                <ShieldCheck className="h-3.5 w-3.5" />
                Security posture
              </span>
              <div className="space-y-2">
                <p className="tool-heading">Score the web edge, not just the raw headers.</p>
                <p className="tool-copy">
                  Use a host or URL. The report combines transport checks with CAA, DNSSEC, and security.txt presence.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="https://example.com"
              />
              <Button type="submit" disabled={isLoading || input.trim().length === 0} className="rounded-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate posture report
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
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Score</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{report.score}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Grade</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{report.grade}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">TLS</p>
                    <p className="mt-3 text-xl font-semibold text-white">{report.tlsVersion ?? "n/a"}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">security.txt</p>
                    <p className="mt-3 text-xl font-semibold text-white">{report.securityTxt.found ? "Found" : "Missing"}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/62">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Context</p>
                    <div className="mt-4 space-y-2">
                      <p>Hostname: {report.hostname}</p>
                      <p>Zone apex: {report.zoneApex}</p>
                      <p>Final URL: {report.finalUrl}</p>
                      <p>DNSSEC: {report.dnssecEnabled ? "enabled" : "not detected"}</p>
                      <p>CAA: {report.caaPresent ? "present" : "missing"}</p>
                      <p>Certificate days left: {report.certificateExpiresInDays ?? "n/a"}</p>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/62">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Key headers</p>
                    <div className="mt-4 space-y-2">
                      {Object.entries(report.keyHeaders).map(([key, value]) => (
                        <p key={key}>
                          <span className="text-white/42">{key}:</span> {value ?? "missing"}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {report.checks.map((check) => (
                    <div
                      key={`${check.title}-${check.detail}`}
                      className={`rounded-[1rem] border px-4 py-3 text-sm ${resolveCheckTone(check.status)}`}
                    >
                      <p className="font-medium">{check.title}</p>
                      <p className="mt-1 opacity-80">{check.detail}</p>
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
