import { getErrorMessage } from "@/domains/shared/api-client";
import {
  PORT_GROUPS,
  type PortInfo,
  type PortScannerFormValues,
  type ScanProtocol,
  type ScanResult,
  type ScanStatus,
  type ScanSummary,
  type ScanTransport,
} from "./model";

const PORT_SCAN_STREAM_ENDPOINT = "/api/v1/port-scans/stream";
const PORT_SCAN_EXPORT_ENDPOINT = "/api/v1/port-scans/exports";

type RawScanResults = Partial<Record<Exclude<ScanTransport, "BOTH">, Record<string, string>>>;

function normalizeScanStatus(status: string): ScanStatus {
  if (
    status === "Open" ||
    status === "Closed" ||
    status === "Filtered" ||
    status === "Open|Filtered"
  ) {
    return status;
  }

  return "Filtered";
}

export function collectSelectedPorts(selectedGroups: string[]) {
  const uniquePorts = new Set<number>();

  selectedGroups.forEach((groupName) => {
    const group = PORT_GROUPS.find((portGroup) => portGroup.name === groupName);
    if (!group) {
      return;
    }

    group.ports.forEach((portInfo) => {
      uniquePorts.add(portInfo.port);
    });
  });

  return Array.from(uniquePorts).sort((left, right) => left - right);
}

export function findPortInfo(port: number): PortInfo | undefined {
  for (const group of PORT_GROUPS) {
    const portInfo = group.ports.find((candidate) => candidate.port === port);
    if (portInfo) {
      return portInfo;
    }
  }

  return undefined;
}

export function buildPortScanStreamUrl(data: PortScannerFormValues) {
  const queryParams = new URLSearchParams({
    targetIp: data.targetIp,
    protocol: data.protocol,
    timeout: data.timeout.toString(),
    showAllPorts: String(data.showAllPorts),
  });

  if (data.scanMode === "range") {
    queryParams.set("startPort", data.startPort.toString());
    queryParams.set("endPort", data.endPort.toString());
  } else {
    const selectedPorts = collectSelectedPorts(data.selectedGroups);
    queryParams.set("portList", selectedPorts.join(","));
  }

  return `${PORT_SCAN_STREAM_ENDPOINT}?${queryParams.toString()}`;
}

export async function exportPortScanResults(
  summary: ScanSummary,
  format: "JSON" | "CSV",
) {
  const exportResults = {
    TCP: {} as Record<number, string>,
    UDP: {} as Record<number, string>,
  };

  summary.results.forEach((result) => {
    exportResults[result.protocol][result.port] = result.status;
  });

  const response = await fetch(PORT_SCAN_EXPORT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      results: exportResults,
      format,
    }),
  });

  if (!response.ok) {
    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new Error(getErrorMessage(payload, "Port scan export failed"));
  }

  return response.blob();
}

export function buildScanSummary(results: RawScanResults): ScanSummary {
  const processedResults: ScanResult[] = [];

  (Object.keys(results) as Array<keyof RawScanResults>).forEach((protocol) => {
    const protocolResults = results[protocol];
    if (!protocolResults) {
      return;
    }

    Object.entries(protocolResults).forEach(([port, status]) => {
      const portNumber = Number.parseInt(port, 10);
      const normalizedStatus = normalizeScanStatus(status);
      const portInfo = findPortInfo(portNumber);

      processedResults.push({
        port: portNumber,
        status: normalizedStatus,
        protocol: protocol as ScanProtocol,
        ...(portInfo
          ? {
              service: portInfo.service,
              description: portInfo.description,
            }
          : {}),
      });
    });
  });

  processedResults.sort((left, right) => left.port - right.port);

  return {
    totalScanned: processedResults.length,
    openPorts: processedResults.filter((result) => result.status === "Open").length,
    filteredPorts: processedResults.filter((result) => result.status === "Filtered").length,
    uncertainPorts: processedResults.filter((result) => result.status === "Open|Filtered").length,
    closedPorts: processedResults.filter((result) => result.status === "Closed").length,
    results: processedResults,
  };
}
