import { useState } from "react";
import { toast } from "react-hot-toast";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { fetchEmailSecurityReport } from "@/domains/engineering/api";
import type { EmailSecurityReport as EmailSecurityReportData } from "@/domains/engineering/types";
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

export default function EmailSecurityChecker() {
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<EmailSecurityReportData | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      setReport(await fetchEmailSecurityReport(domain.trim()));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Email security report failed";
      setError(message);
      toast.error("Email security report failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <SEO page="emailSecurity" />
      <ToolPageShell
        title="Email Security Checker"
        description="Evaluate mail transport posture across MX, SPF, DMARC, DKIM heuristics, STARTTLS, MTA-STS, and TLS-RPT."
      >
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="tool-surface space-y-6">
            <div className="space-y-3">
              <span className="tool-kicker">
                <FileText className="h-3.5 w-3.5" />
                Mail posture
              </span>
              <div className="space-y-2">
                <p className="tool-heading">Turn scattered mail records into an operator-readable mail posture report.</p>
                <p className="tool-copy">
                  Use a domain. The checker inspects DNS, common DKIM selectors, and STARTTLS support on the first MX endpoints.
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
                Check mail posture
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
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">MX</p>
                    <p className="mt-3 text-xl font-semibold text-white">{report.mxRecords.length}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">DKIM selectors</p>
                    <p className="mt-3 text-xl font-semibold text-white">{report.dkim.foundSelectors.length}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/62">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Published records</p>
                    <div className="mt-4 space-y-2">
                      <p>SPF: {report.spf.record ?? "missing"}</p>
                      <p>DMARC: {report.dmarc.record ?? "missing"}</p>
                      <p>MTA-STS: {report.mtaSts.dnsRecord ?? "missing"}</p>
                      <p>TLS-RPT: {report.tlsRpt.record ?? "missing"}</p>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/62">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">MX endpoints</p>
                    <div className="mt-4 space-y-2">
                      {report.mxRecords.length > 0 ? report.mxRecords.map((mx) => (
                        <p key={`${mx.exchange}-${mx.priority}`}>
                          {mx.priority} {mx.exchange}
                        </p>
                      )) : <p>No MX endpoints were returned.</p>}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/62">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">STARTTLS probes</p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {report.startTls.length > 0 ? report.startTls.map((probe) => (
                      <div
                        key={probe.host}
                        className={`rounded-[1rem] border px-4 py-3 ${probe.supportsStartTls ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-100" : "border-amber-400/15 bg-amber-400/[0.05] text-amber-100"}`}
                      >
                        <p className="font-medium">{probe.host}</p>
                        <p className="mt-1 text-sm opacity-80">
                          {probe.supportsStartTls
                            ? `STARTTLS ${probe.tlsVersion ?? "available"}`
                            : probe.error ?? "STARTTLS not advertised"}
                        </p>
                      </div>
                    )) : <p>No MX endpoints were available for a STARTTLS probe.</p>}
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
