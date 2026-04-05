import { safeArray } from "./collections.js";
import type {
  RoutingIncidentEvent,
  RoutingIncidentReport,
  RoutingIncidentTransition,
  RoutingPathObservation,
  RoutingRoaEvidencePoint,
} from "../engineering.types.js";

interface RoutingIncidentAssessmentInput {
  updates: RoutingIncidentEvent[];
  initialState: Array<{
    sourceId: string | null;
    path: string[];
    pathLabel: string;
    originAsn: string | null;
  }>;
  rpkiEvidence: RoutingRoaEvidencePoint[];
  rpkiStatus: string | null;
}

interface RoutingIncidentAssessment {
  summary: RoutingIncidentReport["summary"];
  recentEvents: RoutingIncidentEvent[];
  initialState: RoutingPathObservation[];
  recentPathObservations: RoutingPathObservation[];
  originTransitions: RoutingIncidentTransition[];
  pathTransitions: RoutingIncidentTransition[];
  findings: RoutingIncidentReport["findings"];
  historySummary: Record<string, string | number>;
}

function parseTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getOriginAsn(path: string[]) {
  return path.length > 0 ? path[path.length - 1] : null;
}

export function formatAsPath(path: string[]) {
  if (path.length === 0) {
    return "Withdrawn";
  }

  return path.map((asn) => `AS${asn}`).join(" -> ");
}

function groupObservations(
  items: Array<{
    scope: RoutingPathObservation["scope"];
    sourceId: string | null;
    path: string[];
    pathLabel: string;
    originAsn: string | null;
  }>,
  limit = 6,
) {
  const grouped = new Map<string, RoutingPathObservation>();

  items.forEach((item) => {
    const key = `${item.scope}:${item.pathLabel}`;
    const current = grouped.get(key);

    if (current) {
      current.observations += 1;
      return;
    }

    grouped.set(key, {
      scope: item.scope,
      path: item.path,
      pathLabel: item.pathLabel,
      originAsn: item.originAsn,
      observations: 1,
      sampleSourceId: item.sourceId,
    });
  });

  return [...grouped.values()]
    .sort((left, right) => right.observations - left.observations)
    .slice(0, limit);
}

function buildTransitions(
  updates: RoutingIncidentEvent[],
): Pick<RoutingIncidentAssessment, "originTransitions" | "pathTransitions"> {
  const updatesBySource = new Map<string, RoutingIncidentEvent[]>();

  updates.forEach((update) => {
    const key = update.sourceId ?? "unknown";
    const items = updatesBySource.get(key) ?? [];
    items.push(update);
    updatesBySource.set(key, items);
  });

  const originTransitions: RoutingIncidentTransition[] = [];
  const pathTransitions: RoutingIncidentTransition[] = [];

  updatesBySource.forEach((items, sourceId) => {
    const sortedItems = [...items].sort((left, right) => (
      parseTimestamp(left.timestamp) - parseTimestamp(right.timestamp)
    ));

    for (let index = 1; index < sortedItems.length; index += 1) {
      const previous = sortedItems[index - 1];
      const current = sortedItems[index];

      if (previous.originAsn && current.originAsn && previous.originAsn !== current.originAsn) {
        originTransitions.push({
          timestamp: current.timestamp,
          sourceId: sourceId === "unknown" ? null : sourceId,
          from: `AS${previous.originAsn}`,
          to: `AS${current.originAsn}`,
        });
      }

      if (
        previous.path.length > 0
        && current.path.length > 0
        && previous.pathLabel !== current.pathLabel
      ) {
        pathTransitions.push({
          timestamp: current.timestamp,
          sourceId: sourceId === "unknown" ? null : sourceId,
          from: previous.pathLabel,
          to: current.pathLabel,
        });
      }
    }
  });

  const sortDescending = (left: RoutingIncidentTransition, right: RoutingIncidentTransition) => (
    parseTimestamp(right.timestamp) - parseTimestamp(left.timestamp)
  );

  return {
    originTransitions: originTransitions.sort(sortDescending).slice(0, 10),
    pathTransitions: pathTransitions.sort(sortDescending).slice(0, 10),
  };
}

export function buildRoutingIncidentAssessment({
  updates,
  initialState,
  rpkiEvidence,
  rpkiStatus,
}: RoutingIncidentAssessmentInput): RoutingIncidentAssessment {
  const sortedUpdates = [...updates].sort((left, right) => (
    parseTimestamp(left.timestamp) - parseTimestamp(right.timestamp)
  ));
  const announcements = sortedUpdates.filter((update) => update.type === "announcement");
  const withdrawals = sortedUpdates.filter((update) => update.type === "withdrawal");

  const initialObservations = groupObservations(initialState.map((item) => ({
    ...item,
    scope: "window-start" as const,
  })));
  const recentPathObservations = groupObservations(
    announcements.slice(-40).map((item) => ({
      scope: "recent-announcements" as const,
      sourceId: item.sourceId,
      path: item.path,
      pathLabel: item.pathLabel,
      originAsn: item.originAsn,
    })),
  );

  const uniquePeers = new Set([
    ...sortedUpdates.map((update) => update.sourceId).filter(Boolean),
    ...initialState.map((item) => item.sourceId).filter(Boolean),
  ]);
  const uniqueOrigins = new Set([
    ...sortedUpdates.map((update) => update.originAsn).filter(Boolean),
    ...initialState.map((item) => item.originAsn).filter(Boolean),
  ]);
  const uniquePaths = new Set([
    ...sortedUpdates.map((update) => update.pathLabel).filter((label) => label !== "Withdrawn"),
    ...initialState.map((item) => item.pathLabel).filter((label) => label !== "Withdrawn"),
  ]);
  const transitions = buildTransitions(sortedUpdates);
  const hasRoaDrift = rpkiEvidence.some((point, index) => {
    if (index === 0) {
      return false;
    }

    const previous = rpkiEvidence[index - 1];
    return previous.vrpCount !== point.vrpCount || previous.roaCount !== point.roaCount;
  });

  const findings: RoutingIncidentReport["findings"] = [];

  if (sortedUpdates.length === 0) {
    findings.push({
      status: "info",
      title: "No recent BGP updates observed",
      detail: "The recent observation window did not show announcements or withdrawals for this resource.",
    });
  } else {
    findings.push({
      status: withdrawals.length > 0 ? "warn" : "pass",
      title: withdrawals.length > 0 ? "Withdrawals were observed" : "No withdrawals observed",
      detail: withdrawals.length > 0
        ? `${withdrawals.length} withdrawal events appeared in the observation window.`
        : "The recent window only showed announcement activity.",
    });
  }

  if (transitions.originTransitions.length > 0) {
    findings.push({
      status: "warn",
      title: "Origin drift detected",
      detail: `${transitions.originTransitions.length} peer-scoped origin changes were seen across the captured update window.`,
    });
  } else if (uniqueOrigins.size === 1 && uniqueOrigins.values().next().value) {
    findings.push({
      status: "pass",
      title: "Origin looked stable",
      detail: `Visible paths converged on AS${uniqueOrigins.values().next().value} during the observed window.`,
    });
  }

  if (transitions.pathTransitions.length > 0) {
    findings.push({
      status: transitions.pathTransitions.length >= 6 ? "warn" : "info",
      title: "AS-path diversity changed during the window",
      detail: `${transitions.pathTransitions.length} peer-scoped AS-path changes were seen in recent announcements.`,
    });
  }

  if (rpkiStatus === "invalid") {
    findings.push({
      status: "warn",
      title: "Current origin validation is invalid",
      detail: "The present origin/prefix pair does not validate against published ROAs.",
    });
  } else if (rpkiStatus === "valid") {
    findings.push({
      status: "pass",
      title: "Current origin validation is valid",
      detail: "The present origin/prefix pair validates against published ROAs.",
    });
  } else {
    findings.push({
      status: "info",
      title: "Current origin validation is inconclusive",
      detail: "The present report could not confirm a clean RPKI validation state from public data alone.",
    });
  }

  if (rpkiEvidence.length === 0) {
    findings.push({
      status: "info",
      title: "Historical ROA evidence was not available",
      detail: "No RIPEstat RPKI history samples were returned for this resource.",
    });
  } else if (hasRoaDrift) {
    findings.push({
      status: "info",
      title: "Historical ROA evidence changed over time",
      detail: "ROA evidence counts shifted within the available history samples. Treat this as routing context, not full validation replay.",
    });
  }

  return {
    summary: {
      updates: sortedUpdates.length,
      announcements: announcements.length,
      withdrawals: withdrawals.length,
      uniquePeers: uniquePeers.size,
      uniqueOrigins: uniqueOrigins.size,
      uniquePaths: uniquePaths.size,
      pathChanges: transitions.pathTransitions.length,
      originChanges: transitions.originTransitions.length,
    },
    recentEvents: sortedUpdates.slice(-14).reverse(),
    initialState: initialObservations,
    recentPathObservations,
    originTransitions: transitions.originTransitions,
    pathTransitions: transitions.pathTransitions,
    findings,
    historySummary: {
      Updates: sortedUpdates.length,
      Withdrawals: withdrawals.length,
      Origins: uniqueOrigins.size,
      Paths: uniquePaths.size,
      "Origin changes": transitions.originTransitions.length,
      "Path changes": transitions.pathTransitions.length,
      "RPKI status": rpkiStatus ?? "unknown",
    },
  };
}

export function toRoutingIncidentEvents(
  updates: Array<{
    timestamp: string | null;
    type: string | null;
    sourceId: string | null;
    path: string[];
    communityCount: number;
  }>,
) {
  return updates
    .filter((update) => typeof update.timestamp === "string")
    .map<RoutingIncidentEvent>((update) => ({
      timestamp: update.timestamp as string,
      type: update.type === "W" ? "withdrawal" : "announcement",
      sourceId: update.sourceId,
      path: update.path,
      pathLabel: formatAsPath(update.path),
      originAsn: getOriginAsn(update.path),
      communityCount: update.communityCount,
    }));
}

export function toRoutingPathSample(
  items: Array<{
    sourceId: string | null;
    path: string[];
  }>,
) {
  return safeArray(items).map((item) => ({
    sourceId: item.sourceId,
    path: item.path,
    pathLabel: formatAsPath(item.path),
    originAsn: getOriginAsn(item.path),
  }));
}
