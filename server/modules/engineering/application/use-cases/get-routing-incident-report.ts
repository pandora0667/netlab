import { safeArray } from "../../domain/collections.js";
import {
  buildRoutingIncidentAssessment,
  toRoutingIncidentEvents,
  toRoutingPathSample,
} from "../../domain/routing-incidents.js";
import type {
  RoutingIncidentReport,
  RoutingRoaEvidencePoint,
} from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";
import { fetchRoutingControlPlaneContext } from "./get-routing-report.js";

interface RipeBgpUpdatesPayload {
  data?: {
    updates?: Array<{
      timestamp?: string;
      type?: string;
      attrs?: {
        source_id?: string;
        path?: Array<string | number>;
        community?: unknown[];
      };
    }>;
  };
}

interface RipeBgplayPayload {
  data?: {
    initial_state?: Array<{
      source_id?: string;
      path?: Array<string | number>;
    }>;
  };
}

interface RipeRpkiHistoryPayload {
  data?: {
    timeseries?: Array<{
      time?: string;
      vrp_count?: number;
      count?: number;
      max_length?: number;
    }>;
  };
}

const DEFAULT_WINDOW_HOURS = 24;
const EXTENDED_WINDOW_HOURS = 72;

function toIso(value: Date) {
  return value.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function buildWindow(hours: number) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

  return {
    start: toIso(start),
    end: toIso(end),
    hours,
  };
}

function toPath(path: Array<string | number> | undefined) {
  return safeArray(path).map((value) => String(value));
}

function mapRpkiEvidence(payload: RipeRpkiHistoryPayload | null) {
  return safeArray(payload?.data?.timeseries)
    .map<RoutingRoaEvidencePoint | null>((item) => {
      if (typeof item?.time !== "string") {
        return null;
      }

      return {
        time: item.time,
        vrpCount: typeof item.vrp_count === "number" ? item.vrp_count : 0,
        roaCount: typeof item.count === "number" ? item.count : 0,
        maxLength: typeof item.max_length === "number" ? item.max_length : null,
      };
    })
    .filter((item): item is RoutingRoaEvidencePoint => item !== null)
    .slice(-10);
}

export async function getRoutingIncidentReport(
  input: string,
  deps: EngineeringDependencies,
): Promise<RoutingIncidentReport> {
  const routingReport = await fetchRoutingControlPlaneContext(input, deps);
  const notes = [...routingReport.notes];
  const resource = routingReport.prefix ?? routingReport.targetIp;

  let window = buildWindow(DEFAULT_WINDOW_HOURS);
  let updatesPayload = await deps.externalJsonClient.getJsonSafe<RipeBgpUpdatesPayload>(
    `https://stat.ripe.net/data/bgp-updates/data.json?resource=${encodeURIComponent(resource)}&starttime=${encodeURIComponent(window.start)}&endtime=${encodeURIComponent(window.end)}`,
    notes,
    "BGP updates",
  );

  let updates = toRoutingIncidentEvents(
    safeArray(updatesPayload?.data?.updates).map((item) => ({
      timestamp: typeof item?.timestamp === "string" ? item.timestamp : null,
      type: typeof item?.type === "string" ? item.type : null,
      sourceId: typeof item?.attrs?.source_id === "string" ? item.attrs.source_id : null,
      path: toPath(item?.attrs?.path),
      communityCount: safeArray(item?.attrs?.community).length,
    })),
  );

  if (updates.length === 0) {
    window = buildWindow(EXTENDED_WINDOW_HOURS);
    notes.push("Extended the incident window to 72 hours because the last 24 hours were quiet.");
    updatesPayload = await deps.externalJsonClient.getJsonSafe<RipeBgpUpdatesPayload>(
      `https://stat.ripe.net/data/bgp-updates/data.json?resource=${encodeURIComponent(resource)}&starttime=${encodeURIComponent(window.start)}&endtime=${encodeURIComponent(window.end)}`,
      notes,
      "BGP updates (extended window)",
    );
    updates = toRoutingIncidentEvents(
      safeArray(updatesPayload?.data?.updates).map((item) => ({
        timestamp: typeof item?.timestamp === "string" ? item.timestamp : null,
        type: typeof item?.type === "string" ? item.type : null,
        sourceId: typeof item?.attrs?.source_id === "string" ? item.attrs.source_id : null,
        path: toPath(item?.attrs?.path),
        communityCount: safeArray(item?.attrs?.community).length,
      })),
    );
  }

  const [bgplayPayload, rpkiHistoryPayload] = await Promise.all([
    deps.externalJsonClient.getJsonSafe<RipeBgplayPayload>(
      `https://stat.ripe.net/data/bgplay/data.json?resource=${encodeURIComponent(resource)}&starttime=${encodeURIComponent(window.start)}&endtime=${encodeURIComponent(window.end)}`,
      notes,
      "BGPlay",
    ),
    deps.externalJsonClient.getJsonSafe<RipeRpkiHistoryPayload>(
      `https://stat.ripe.net/data/rpki-history/data.json?resource=${encodeURIComponent(resource)}`,
      notes,
      "RPKI history",
    ),
  ]);

  const initialState = toRoutingPathSample(
    safeArray(bgplayPayload?.data?.initial_state).map((item) => ({
      sourceId: typeof item?.source_id === "string" ? item.source_id : null,
      path: toPath(item?.path),
    })),
  );
  const rpkiEvidence = mapRpkiEvidence(rpkiHistoryPayload);
  const assessment = buildRoutingIncidentAssessment({
    updates,
    initialState,
    rpkiEvidence,
    rpkiStatus: routingReport.rpkiStatus,
  });
  const history = deps.historyStore.remember("routing-incident", routingReport.input, {
    Prefix: routingReport.prefix,
    "Origin ASN": routingReport.originAsn,
    Updates: assessment.summary.updates,
    Withdrawals: assessment.summary.withdrawals,
    "Origin changes": assessment.summary.originChanges,
    "Path changes": assessment.summary.pathChanges,
    "RPKI status": routingReport.rpkiStatus,
  });

  if (rpkiEvidence.length > 0) {
    notes.push("Historical RPKI evidence reflects ROA counts over time, not full origin-validation replay.");
  }

  return {
    input: routingReport.input,
    targetIp: routingReport.targetIp,
    resolvedAddresses: routingReport.resolvedAddresses,
    resolvedFromHostname: routingReport.resolvedFromHostname,
    prefix: routingReport.prefix,
    originAsn: routingReport.originAsn,
    rpkiStatus: routingReport.rpkiStatus,
    window,
    summary: assessment.summary,
    recentEvents: assessment.recentEvents,
    initialState: assessment.initialState,
    recentPathObservations: assessment.recentPathObservations,
    originTransitions: assessment.originTransitions,
    pathTransitions: assessment.pathTransitions,
    rpkiEvidence,
    findings: assessment.findings,
    notes,
    checkedAt: Date.now(),
    history,
  };
}
