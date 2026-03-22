import { useState } from "react";
import { toast } from "react-hot-toast";
import { Activity, Globe2, Loader2, Route, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import {
  fetchDnsAuthorityReport,
  fetchIpParityReport,
  fetchPathMtuReport,
  fetchRoutingReport,
} from "@/domains/engineering/api";
import type {
  DnsAuthorityReport,
  FamilyProbeResult,
  IpParityReport,
  PathMtuReport,
  RoutingControlPlaneReport,
} from "@/domains/engineering/types";
import { ReportHistory } from "./ReportHistory";

function renderFindingTone(status: "pass" | "warn" | "info") {
  if (status === "pass") {
    return "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-100";
  }

  if (status === "warn") {
    return "border-amber-400/15 bg-amber-400/[0.05] text-amber-100";
  }

  return "border-cyan-400/15 bg-cyan-400/[0.05] text-cyan-100";
}

function FamilyProbeCard({
  title,
  probe,
}: {
  title: string;
  probe: FamilyProbeResult;
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
        {title}
      </p>
      <p className="mt-3 text-xl font-semibold text-white">
        {probe.reachable ? "Reachable" : "No confirmed TCP path"}
      </p>
      <p className="mt-2 text-sm text-white/56">
        {probe.addresses.length > 0
          ? probe.addresses.join(", ")
          : "No addresses returned"}
      </p>
      <p className="mt-2 text-sm text-white/56">
        {probe.probePort != null
          ? `Port ${probe.probePort} responded in ${probe.latencyMs?.toFixed(1) ?? "n/a"}ms`
          : probe.error ?? "No probe result"}
      </p>
    </div>
  );
}

export default function NetworkEngineeringWorkbench() {
  const [routingInput, setRoutingInput] = useState("");
  const [authorityInput, setAuthorityInput] = useState("");
  const [parityInput, setParityInput] = useState("");
  const [mtuInput, setMtuInput] = useState("");

  const [routingLoading, setRoutingLoading] = useState(false);
  const [authorityLoading, setAuthorityLoading] = useState(false);
  const [parityLoading, setParityLoading] = useState(false);
  const [mtuLoading, setMtuLoading] = useState(false);

  const [routingError, setRoutingError] = useState<string | null>(null);
  const [authorityError, setAuthorityError] = useState<string | null>(null);
  const [parityError, setParityError] = useState<string | null>(null);
  const [mtuError, setMtuError] = useState<string | null>(null);

  const [routingReport, setRoutingReport] = useState<RoutingControlPlaneReport | null>(null);
  const [authorityReport, setAuthorityReport] = useState<DnsAuthorityReport | null>(null);
  const [parityReport, setParityReport] = useState<IpParityReport | null>(null);
  const [mtuReport, setMtuReport] = useState<PathMtuReport | null>(null);

  async function handleRoutingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRoutingLoading(true);
    setRoutingError(null);

    try {
      setRoutingReport(await fetchRoutingReport(routingInput.trim()));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Routing report failed";
      setRoutingError(message);
      toast.error("Routing report failed");
    } finally {
      setRoutingLoading(false);
    }
  }

  async function handleAuthoritySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthorityLoading(true);
    setAuthorityError(null);

    try {
      setAuthorityReport(await fetchDnsAuthorityReport(authorityInput.trim()));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authority report failed";
      setAuthorityError(message);
      toast.error("Authority report failed");
    } finally {
      setAuthorityLoading(false);
    }
  }

  async function handleParitySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParityLoading(true);
    setParityError(null);

    try {
      setParityReport(await fetchIpParityReport(parityInput.trim()));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Parity report failed";
      setParityError(message);
      toast.error("Parity report failed");
    } finally {
      setParityLoading(false);
    }
  }

  async function handleMtuSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMtuLoading(true);
    setMtuError(null);

    try {
      setMtuReport(await fetchPathMtuReport(mtuInput.trim()));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Path MTU report failed";
      setMtuError(message);
      toast.error("Path MTU report failed");
    } finally {
      setMtuLoading(false);
    }
  }

  return (
    <>
      <SEO page="networkEngineering" />
      <ToolPageShell
        title="Network Engineering Workbench"
        description="Inspect control-plane state, authority health, dual-stack drift, and path MTU from one operator-focused workbench."
      >
        <Tabs defaultValue="routing" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start rounded-[1rem] border border-white/8 bg-white/[0.03] p-1">
            <TabsTrigger value="routing">Routing</TabsTrigger>
            <TabsTrigger value="authority">Authority</TabsTrigger>
            <TabsTrigger value="parity">IPv4/IPv6</TabsTrigger>
            <TabsTrigger value="mtu">Path MTU</TabsTrigger>
          </TabsList>

          <TabsContent value="routing" className="space-y-4">
            <form onSubmit={handleRoutingSubmit} className="tool-surface space-y-6">
              <div className="space-y-3">
                <span className="tool-kicker">
                  <Route className="h-3.5 w-3.5" />
                  Control plane
                </span>
                <div className="space-y-2">
                  <p className="tool-heading">Map a target to prefix, origin ASN, visibility, and RPKI state.</p>
                  <p className="tool-copy">
                    Use a public hostname or IP. The report combines server-side target resolution with RIPEstat control-plane data.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={routingInput}
                  onChange={(event) => setRoutingInput(event.target.value)}
                  placeholder="example.com or 8.8.8.8"
                />
                <Button type="submit" disabled={routingLoading || routingInput.trim().length === 0} className="rounded-full">
                  {routingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Run routing report
                </Button>
              </div>
            </form>

            {routingError ? (
              <div className="rounded-[1.35rem] border border-rose-500/15 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-100">
                {routingError}
              </div>
            ) : null}

            {routingReport ? (
              <>
                <section className="tool-surface space-y-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Prefix</p>
                      <p className="mt-3 text-2xl font-semibold text-white">{routingReport.prefix ?? "n/a"}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Origin ASN</p>
                      <p className="mt-3 text-2xl font-semibold text-white">{routingReport.originAsn ?? "n/a"}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">RPKI</p>
                      <p className="mt-3 text-2xl font-semibold text-white">{routingReport.rpkiStatus ?? "n/a"}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">IPv4 visibility</p>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        {routingReport.visibility.ipv4RisPeersSeeing ?? "n/a"}
                        {routingReport.visibility.ipv4RisPeersTotal != null
                          ? ` / ${routingReport.visibility.ipv4RisPeersTotal}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/62">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Target context</p>
                      <div className="mt-4 space-y-2">
                        <p>Resolved target: {routingReport.targetIp}</p>
                        <p>All addresses: {routingReport.resolvedAddresses.join(", ")}</p>
                        <p>Holder: {routingReport.originHolder ?? "n/a"}</p>
                        <p>Registry block: {routingReport.registryBlock.resource ?? "n/a"}</p>
                        <p>Region: {routingReport.geo.region}, {routingReport.geo.country}</p>
                        <p>ISP: {routingReport.geo.isp}</p>
                      </div>
                    </div>

                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/62">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Routing edges</p>
                      <div className="mt-4 space-y-2">
                        <p>First seen: {routingReport.firstSeen ?? "n/a"}</p>
                        <p>Last seen: {routingReport.lastSeen ?? "n/a"}</p>
                        <p>Less specifics: {routingReport.lessSpecifics.map((item) => item.prefix).join(", ") || "none"}</p>
                        <p>More specifics: {routingReport.moreSpecifics.map((item) => item.prefix).join(", ") || "none"}</p>
                      </div>
                    </div>
                  </div>

                  {routingReport.notes.length > 0 ? (
                    <div className="space-y-3">
                      {routingReport.notes.map((note) => (
                        <div
                          key={note}
                          className="rounded-[1rem] border border-cyan-400/15 bg-cyan-400/[0.05] px-4 py-3 text-sm text-cyan-100"
                        >
                          {note}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                <ReportHistory history={routingReport.history} />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="authority" className="space-y-4">
            <form onSubmit={handleAuthoritySubmit} className="tool-surface space-y-6">
              <div className="space-y-3">
                <span className="tool-kicker">
                  <Search className="h-3.5 w-3.5" />
                  Authority chain
                </span>
                <div className="space-y-2">
                  <p className="tool-heading">Inspect NS, SOA, CAA, DS, and DNSKEY from an operator lens.</p>
                  <p className="tool-copy">
                    Use a domain. The report focuses on delegation health and signing posture rather than generic record browsing.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={authorityInput}
                  onChange={(event) => setAuthorityInput(event.target.value)}
                  placeholder="example.com"
                />
                <Button type="submit" disabled={authorityLoading || authorityInput.trim().length === 0} className="rounded-full">
                  {authorityLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Inspect authority
                </Button>
              </div>
            </form>

            {authorityError ? (
              <div className="rounded-[1.35rem] border border-rose-500/15 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-100">
                {authorityError}
              </div>
            ) : null}

            {authorityReport ? (
              <>
                <section className="tool-surface space-y-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Delegation</p>
                      <p className="mt-3 text-xl font-semibold text-white">{authorityReport.delegationStatus}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Nameservers</p>
                      <p className="mt-3 text-xl font-semibold text-white">{authorityReport.nameservers.length}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">DNSSEC</p>
                      <p className="mt-3 text-xl font-semibold text-white">
                        {authorityReport.dnssec.enabled ? "Enabled" : "Unsigned"}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">CAA</p>
                      <p className="mt-3 text-xl font-semibold text-white">{authorityReport.caaRecords.length}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/62">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Authority data</p>
                      <div className="mt-4 space-y-2">
                        <p>Zone apex: {authorityReport.zoneApex}</p>
                        <p>NS: {authorityReport.nameservers.join(", ") || "none"}</p>
                        <p>SOA primary: {authorityReport.soa?.nsname ?? "n/a"}</p>
                        <p>SOA serial: {authorityReport.soa?.serial ?? "n/a"}</p>
                        <p>DS records: {authorityReport.dnssec.dsRecords.length}</p>
                        <p>DNSKEY records: {authorityReport.dnssec.dnskeyRecords.length}</p>
                      </div>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/62">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">CAA entries</p>
                      <div className="mt-4 space-y-2">
                        {authorityReport.caaRecords.length > 0 ? authorityReport.caaRecords.map((record) => (
                          <p key={`${record.tag}-${record.value}`}>
                            {record.critical ? "critical " : ""}
                            {record.tag}: {record.value}
                          </p>
                        )) : <p>No CAA records were returned.</p>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {authorityReport.findings.map((finding) => (
                      <div
                        key={`${finding.title}-${finding.detail}`}
                        className={`rounded-[1rem] border px-4 py-3 text-sm ${renderFindingTone(finding.status)}`}
                      >
                        <p className="font-medium">{finding.title}</p>
                        <p className="mt-1 opacity-80">{finding.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <ReportHistory history={authorityReport.history} />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="parity" className="space-y-4">
            <form onSubmit={handleParitySubmit} className="tool-surface space-y-6">
              <div className="space-y-3">
                <span className="tool-kicker">
                  <Globe2 className="h-3.5 w-3.5" />
                  Dual-stack parity
                </span>
                <div className="space-y-2">
                  <p className="tool-heading">Check whether IPv4 and IPv6 publish and respond in the same shape.</p>
                  <p className="tool-copy">
                    The probe resolves A and AAAA, then checks common web ports from the current server vantage point.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={parityInput}
                  onChange={(event) => setParityInput(event.target.value)}
                  placeholder="example.com"
                />
                <Button type="submit" disabled={parityLoading || parityInput.trim().length === 0} className="rounded-full">
                  {parityLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Compare parity
                </Button>
              </div>
            </form>

            {parityError ? (
              <div className="rounded-[1.35rem] border border-rose-500/15 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-100">
                {parityError}
              </div>
            ) : null}

            {parityReport ? (
              <>
                <section className="tool-surface space-y-5">
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Parity status</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{parityReport.status}</p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <FamilyProbeCard title="IPv4" probe={parityReport.ipv4} />
                    <FamilyProbeCard title="IPv6" probe={parityReport.ipv6} />
                  </div>

                  <div className="space-y-3">
                    {parityReport.findings.map((finding) => (
                      <div
                        key={`${finding.title}-${finding.detail}`}
                        className={`rounded-[1rem] border px-4 py-3 text-sm ${renderFindingTone(finding.status)}`}
                      >
                        <p className="font-medium">{finding.title}</p>
                        <p className="mt-1 opacity-80">{finding.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <ReportHistory history={parityReport.history} />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="mtu" className="space-y-4">
            <form onSubmit={handleMtuSubmit} className="tool-surface space-y-6">
              <div className="space-y-3">
                <span className="tool-kicker">
                  <Activity className="h-3.5 w-3.5" />
                  Path MTU
                </span>
                <div className="space-y-2">
                  <p className="tool-heading">Sweep DF payload size to estimate usable MTU from this vantage point.</p>
                  <p className="tool-copy">
                    This first slice focuses on IPv4-reachable public targets and keeps the sweep bounded for safety.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={mtuInput}
                  onChange={(event) => setMtuInput(event.target.value)}
                  placeholder="example.com or 1.1.1.1"
                />
                <Button type="submit" disabled={mtuLoading || mtuInput.trim().length === 0} className="rounded-full">
                  {mtuLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Estimate MTU
                </Button>
              </div>
            </form>

            {mtuError ? (
              <div className="rounded-[1.35rem] border border-rose-500/15 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-100">
                {mtuError}
              </div>
            ) : null}

            {mtuReport ? (
              <>
                <section className="tool-surface space-y-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Target</p>
                      <p className="mt-3 text-xl font-semibold text-white">{mtuReport.targetIp}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Max payload</p>
                      <p className="mt-3 text-xl font-semibold text-white">{mtuReport.maxPayloadSize ?? "n/a"}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Estimated MTU</p>
                      <p className="mt-3 text-xl font-semibold text-white">{mtuReport.estimatedPathMtu ?? "n/a"}</p>
                    </div>
                  </div>

                  {mtuReport.notes.length > 0 ? (
                    <div className="space-y-3">
                      {mtuReport.notes.map((note) => (
                        <div
                          key={note}
                          className="rounded-[1rem] border border-cyan-400/15 bg-cyan-400/[0.05] px-4 py-3 text-sm text-cyan-100"
                        >
                          {note}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {mtuReport.attempts.map((attempt) => (
                      <div
                        key={attempt.payloadSize}
                        className={`rounded-[1rem] border px-4 py-3 text-sm ${
                          attempt.success
                            ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-100"
                            : "border-amber-400/15 bg-amber-400/[0.05] text-amber-100"
                        }`}
                      >
                        <p className="font-medium">Payload {attempt.payloadSize}</p>
                        <p className="mt-1 opacity-80">
                          {attempt.success ? "Success" : attempt.error ?? "Failed"}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <ReportHistory history={mtuReport.history} />
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </ToolPageShell>
    </>
  );
}
