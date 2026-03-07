import type { PingSummary } from "./model";

export function convertPingSummaryToCsv(results: PingSummary): string {
  const headers = ["Attempt", "Success", "Latency", "Error"];
  const rows = results.results.map((result) => [
    result.attempt,
    result.success,
    result.latency ?? "",
    result.error || "",
  ]);

  return [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");
}
