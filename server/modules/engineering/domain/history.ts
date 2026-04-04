import type {
  ReportHistory,
  ReportHistoryChange,
} from "../engineering.types.js";

export interface SummarySnapshot {
  checkedAt: number;
  summary: Record<string, string>;
}

export interface ReportHistoryStore {
  remember(kind: string, key: string, summary: Record<string, unknown>): ReportHistory;
}

export function toSummaryValue(value: unknown): string {
  if (value == null) {
    return "n/a";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function normalizeSummary(summary: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(summary).map(([label, value]) => [label, toSummaryValue(value)]),
  );
}

export function buildHistory(
  previous: SummarySnapshot | undefined,
  summary: Record<string, unknown>,
): ReportHistory {
  const nextSummary = normalizeSummary(summary);
  const changes: ReportHistoryChange[] = [];

  if (previous) {
    const labels = new Set([...Object.keys(previous.summary), ...Object.keys(nextSummary)]);
    labels.forEach((label) => {
      const before = previous.summary[label] ?? "n/a";
      const after = nextSummary[label] ?? "n/a";

      if (before !== after) {
        changes.push({ label, before, after });
      }
    });
  }

  return {
    previousCheckedAt: previous?.checkedAt ?? null,
    changed: changes.length > 0,
    changes,
  };
}

