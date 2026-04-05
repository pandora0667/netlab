import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import {
  fetchPacketCaptureCapacityStatus,
  uploadPacketCapture,
} from "@/domains/engineering/api";
import type {
  PacketCaptureCapacityStatus,
  PacketCaptureReport,
} from "@/domains/engineering/types";
import { ApiClientError } from "@/domains/shared/api-client";

function toneForSeverity(severity: "error" | "warn" | "info") {
  if (severity === "error") {
    return "border-rose-500/15 bg-rose-500/[0.06] text-rose-100";
  }

  if (severity === "warn") {
    return "border-amber-400/15 bg-amber-400/[0.05] text-amber-100";
  }

  return "border-cyan-400/15 bg-cyan-400/[0.05] text-cyan-100";
}

export default function PacketCaptureAnalysisLab() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<PacketCaptureReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [capacity, setCapacity] = useState<PacketCaptureCapacityStatus | null>(null);
  const [capacityLoading, setCapacityLoading] = useState(true);

  async function refreshCapacity() {
    setCapacityLoading(true);
    try {
      setCapacity(await fetchPacketCaptureCapacityStatus());
    } catch {
      setCapacity(null);
    } finally {
      setCapacityLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | null = null;

    async function loadCapacity() {
      setCapacityLoading(true);
      try {
        const status = await fetchPacketCaptureCapacityStatus();
        if (!cancelled) {
          setCapacity(status);
        }
      } catch {
        if (!cancelled) {
          setCapacity(null);
        }
      } finally {
        if (!cancelled) {
          setCapacityLoading(false);
        }
      }
    }

    void loadCapacity();
    refreshTimer = window.setInterval(() => {
      void loadCapacity();
    }, 10_000);

    return () => {
      cancelled = true;
      if (refreshTimer !== null) {
        window.clearInterval(refreshTimer);
      }
    };
  }, []);

  const acceptedExtensions = useMemo(() => (
    capacity?.acceptedExtensions.join(", ") || ".pcap, .pcapng"
  ), [capacity]);

  function validateFile(candidate: File) {
    const extension = candidate.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    const maxFileBytes = capacity?.maxFileBytes ?? 12 * 1024 * 1024;
    if (extension && ![".pcap", ".pcapng"].includes(extension)) {
      return `Only ${acceptedExtensions} files are accepted.`;
    }

    if (candidate.size > maxFileBytes) {
      return `Capture files must be ${Math.floor(maxFileBytes / 1024 / 1024)} MB or smaller.`;
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      return;
    }

    const validationMessage = validateFile(file);
    if (validationMessage) {
      setError(validationMessage);
      toast.error("Packet capture analysis failed");
      return;
    }

    if (capacity && !capacity.available) {
      setError(capacity.reason || "Packet capture analysis is temporarily unavailable.");
      toast.error("Packet capture admission is paused");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setReport(await uploadPacketCapture(file));
    } catch (requestError) {
      let message = requestError instanceof Error ? requestError.message : "Packet capture analysis failed";

      if (requestError instanceof ApiClientError) {
        const details = requestError.details as PacketCaptureCapacityStatus | undefined;
        if (details && typeof details === "object" && "available" in details) {
          setCapacity(details);
        }

        if (requestError.code === "PACKET_CAPTURE_CAPACITY_REACHED" && details?.retryAfterSeconds) {
          message = `${message} Try again in about ${details.retryAfterSeconds} seconds.`;
        }
      }

      setError(message);
      toast.error("Packet capture analysis failed");
    } finally {
      setIsLoading(false);
      void refreshCapacity();
    }
  }

  const capacityBasisLabel = capacity
    ? capacity.snapshot.resourceBasis === "cgroup"
      ? "Container limits"
      : "Host estimate"
    : null;

  const capacitySummary = capacity?.reason
    ? capacity.reason
    : capacity?.advisories[0]
      ? capacity.advisories[0]
      : capacityBasisLabel === "Container limits"
        ? "Admission control is using container CPU and memory limits so one-shot analysis can stay responsive under load."
        : "Admission control is using host-level estimates because no container limits were detected. Netlab keeps host fallback best-effort while no other capture workers are active.";

  return (
    <>
      <SEO page="packetCaptureLab" />
      <ToolPageShell
        title="Packet Capture Analysis"
        description="Upload a pcap or pcapng file for one-shot protocol, flow, and anomaly analysis without re-probing the public internet."
      >
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="tool-surface space-y-6">
            <div className="space-y-3">
              <span className="tool-kicker">
                <FileUp className="h-3.5 w-3.5" />
                Offline evidence
              </span>
              <div className="space-y-2">
                <p className="tool-heading">Turn a capture file into protocol, flow, and expert context.</p>
                <p className="tool-copy">
                  Files are analyzed once and discarded. This tool summarizes protocol hierarchy, flow weight, TCP anomalies, and visible DNS, HTTP, TLS, or QUIC evidence.
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64">
                <p className="font-medium text-white">Accepted uploads</p>
                <p className="mt-1">
                  {acceptedExtensions} only
                  {capacity?.maxFileBytes ? ` · max ${Math.floor(capacity.maxFileBytes / 1024 / 1024)} MB` : ""}
                </p>
                <p className="mt-1 text-white/48">
                  The backend rejects non-PCAP magic bytes before any tshark process starts.
                </p>
              </div>
              <div
                className={`rounded-[1rem] border px-4 py-3 text-sm ${
                  capacity?.available === false
                    ? "border-amber-400/15 bg-amber-400/[0.05] text-amber-100"
                    : capacity?.advisories.length
                      ? "border-amber-400/15 bg-amber-400/[0.05] text-amber-100"
                      : "border-cyan-400/15 bg-cyan-400/[0.05] text-cyan-100"
                }`}
              >
                <p className="font-medium">
                  {capacityLoading
                    ? "Checking capture admission"
                    : capacity?.available === false
                      ? "Capture admission is paused"
                      : capacity?.advisories.length
                        ? "Capture admission is open with host-pressure warnings"
                      : "Capture admission is open"}
                </p>
                <p className="mt-1 opacity-80">{capacitySummary}</p>
                {capacity ? (
                  <div className="mt-2 space-y-1 text-xs opacity-75">
                    <p>
                      {capacityBasisLabel} · Workers {capacity.snapshot.activeAnalyses}/{capacity.snapshot.maxConcurrentAnalyses}
                      {" · "}
                      CPU {capacity.snapshot.cpuUtilizationPercent.toFixed(1)}% of {capacity.snapshot.effectiveCpuLimit.toFixed(2)} cores
                    </p>
                    <p>
                      Memory {capacity.snapshot.memoryUtilizationPercent.toFixed(1)}% used
                      {" · "}
                      Headroom {capacity.snapshot.memoryHeadroomMb} MB
                    </p>
                    {capacity.admissionMode === "best-effort" ? (
                      <p>Host fallback stays best-effort while no other capture worker is active.</p>
                    ) : null}
                    <p>
                      Safety floor: CPU &lt; {capacity.thresholds.maxCpuUtilizationPercent}%
                      {" · "}
                      Memory &lt; {capacity.thresholds.maxMemoryUtilizationPercent}%
                      {" · "}
                      Headroom &gt; {capacity.thresholds.minMemoryHeadroomMb} MB
                    </p>
                    {capacity.advisories.length > 1 ? (
                      <p>{capacity.advisories.slice(1).join(" ")}</p>
                    ) : null}
                    {capacity.retryAfterSeconds ? (
                      <p>Suggested retry: about {capacity.retryAfterSeconds} seconds</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="space-y-2">
                <span className="text-sm font-medium text-white">PCAP or PCAPNG file</span>
                <input
                  type="file"
                  accept=".pcap,.pcapng,application/octet-stream"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    setReport(null);
                    if (nextFile) {
                      setError(validateFile(nextFile));
                    } else {
                      setError(null);
                    }
                  }}
                  className="block w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:text-white"
                />
              </label>

              <Button
                type="submit"
                disabled={isLoading || !file || Boolean(error) || capacity?.available === false}
                className="rounded-full"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Analyze capture
              </Button>
            </div>
          </form>

          {error ? (
            <div className="rounded-[1.35rem] border border-rose-500/15 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {report ? (
            <section className="tool-surface space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Packets</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{report.packetCount}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Duration</p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {report.durationSeconds != null ? `${report.durationSeconds.toFixed(3)}s` : "n/a"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Capture type</p>
                  <p className="mt-3 text-xl font-semibold text-white">{report.captureFileType ?? "n/a"}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Link layer</p>
                  <p className="mt-3 text-xl font-semibold text-white">{report.encapsulation ?? "n/a"}</p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Protocol hierarchy</p>
                  <div className="mt-4 space-y-3">
                    {report.protocols.map((protocol) => (
                      <div key={protocol.protocol} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm text-white">
                          <span>{protocol.protocol}</span>
                          <span className="text-white/48">{protocol.packets} packets</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/6">
                          <div
                            className="h-full rounded-full bg-cyan-300/70"
                            style={{ width: `${Math.max(6, protocol.share * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Flow weight</p>
                  <div className="mt-4 space-y-3">
                    {report.flows.map((flow) => (
                      <div key={flow.id} className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64">
                        <p className="font-medium text-white">
                          {flow.source} → {flow.destination}
                        </p>
                        <p className="mt-1">
                          {flow.transport.toUpperCase()}
                          {flow.application ? ` · ${flow.application.toUpperCase()}` : ""}
                          {flow.stream ? ` · stream ${flow.stream}` : ""}
                        </p>
                        <p className="mt-1">{flow.packets} packets · {flow.bytes} bytes</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">TCP analysis</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-white/64">
                    <p>Streams: {report.tcpAnalysis.streamCount}</p>
                    <p>Retransmissions: {report.tcpAnalysis.retransmissions}</p>
                    <p>Duplicate ACKs: {report.tcpAnalysis.duplicateAcks}</p>
                    <p>Zero windows: {report.tcpAnalysis.zeroWindows}</p>
                    <p>Resets: {report.tcpAnalysis.resets}</p>
                  </div>
                </div>

                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">Application evidence</p>
                  <div className="mt-4 space-y-3 text-sm text-white/64">
                    <p>DNS queries: {report.dns.queryCount}</p>
                    <p>HTTP requests: {report.http.requestCount}</p>
                    <p>TLS handshakes: {report.tls.handshakeCount}</p>
                    <p>QUIC packets: {report.quic.packetCount}</p>
                    <p>ALPNs: {report.tls.alpns.join(", ") || "n/a"}</p>
                  </div>
                </div>
              </div>

              {report.dns.queries.length > 0 ? (
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">DNS summary</p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {report.dns.queries.map((query) => (
                      <div key={`${query.name}-${query.type}`} className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/64">
                        <p className="font-medium text-white">{query.name}</p>
                        <p className="mt-1">{query.type} · {query.responses} responses</p>
                        <p className="mt-1">{query.responseCodes.join(", ") || "No response code"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {report.expertFindings.length > 0 ? (
                <div className="space-y-3">
                  {report.expertFindings.map((finding) => (
                    <div
                      key={`${finding.severity}-${finding.detail}`}
                      className={`rounded-[1rem] border px-4 py-3 text-sm ${toneForSeverity(finding.severity)}`}
                    >
                      <p className="font-medium">{finding.summary}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </ToolPageShell>
    </>
  );
}
