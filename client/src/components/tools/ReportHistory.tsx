import type { ReportHistory as ReportHistoryType } from "@/domains/engineering/types";

interface ReportHistoryProps {
  history: ReportHistoryType;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

export function ReportHistory({ history }: ReportHistoryProps) {
  if (!history.previousCheckedAt) {
    return (
      <section className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
          Recent diff
        </p>
        <p className="mt-3 text-sm text-white/62">
          No previous in-memory sample exists yet. Run the same check again to see drift.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/38">
          Recent diff
        </p>
        <p className="text-xs text-white/42">
          Previous sample {formatTimestamp(history.previousCheckedAt)}
        </p>
      </div>

      {history.changed ? (
        <div className="mt-4 space-y-3">
          {history.changes.map((change) => (
            <div
              key={`${change.label}-${change.before}-${change.after}`}
              className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm"
            >
              <p className="font-medium text-white">{change.label}</p>
              <p className="mt-1 text-white/56">
                {change.before} → {change.after}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-emerald-200">
          No material field changes from the previous in-memory sample.
        </p>
      )}
    </section>
  );
}
