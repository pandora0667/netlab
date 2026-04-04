import { HISTORY_TTL_MS } from "../../domain/constants.js";
import {
  buildHistory,
  normalizeSummary,
  type ReportHistoryStore,
  type SummarySnapshot,
} from "../../domain/history.js";

export class InMemoryReportHistoryStore implements ReportHistoryStore {
  private readonly history = new Map<string, SummarySnapshot>();

  remember(kind: string, key: string, summary: Record<string, unknown>) {
    const normalizedKey = `${kind}:${key.toLowerCase()}`;
    const previous = this.history.get(normalizedKey);

    if (previous && previous.checkedAt + HISTORY_TTL_MS <= Date.now()) {
      this.history.delete(normalizedKey);
    }

    const history = buildHistory(previous, summary);
    this.history.set(normalizedKey, {
      checkedAt: Date.now(),
      summary: normalizeSummary(summary),
    });

    return history;
  }
}

