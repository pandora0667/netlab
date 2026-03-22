import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Globe, MapPin, Wifi, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { SEO } from "../SEO";
import { usePublicIpInfo } from "@/domains/network/use-public-ip-info";
import { ToolPageShell } from "@/components/layout/ToolPageShell";

export default function IPChecker() {
  const { data, error, isLoading, mutate } = usePublicIpInfo();

  const handleRetry = () => {
    void mutate();
  };

  if (error) {
    return (
      <ToolPageShell
        title="IP Checker"
        description="View your current public IP with approximate location and ISP details."
      >
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>Unable to load IP information.</AlertDescription>
          </Alert>
          <Button onClick={handleRetry} className="w-full sm:w-auto">
            Try again
          </Button>
        </div>
      </ToolPageShell>
    );
  }

  return (
    <>
      <SEO page="ipChecker" />
      <ToolPageShell
        title="IP Checker"
        description="View your current public IP with approximate location and ISP details."
      >
        <div className="tool-grid">
          <section className="tool-surface space-y-6">
            <div className="space-y-3">
              <span className="tool-kicker">
                <ShieldCheck className="h-3.5 w-3.5" />
                Public identity
              </span>
              <div className="space-y-2">
                <p className="tool-heading">See how your connection appears from the public internet.</p>
                <p className="tool-copy">
                  This view prioritizes the essentials first: the public IP, the rough
                  network region, the upstream ISP, and the timezone returned by the provider.
                </p>
              </div>
            </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.35rem] border border-white/8 bg-white/[0.02] p-4 sm:p-5">
                <div className="space-y-1">
                  <div className="tool-eyebrow">
                    Current public address
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <span className="font-mono text-lg font-semibold tracking-tight sm:text-xl">
                      {data?.ip || "N/A"}
                    </span>
                  </div>
                  {data?.message ? (
                    <div className="text-sm text-destructive">{data.message}</div>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRetry}
                  className="shrink-0"
                  aria-label="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="tool-metric">
                  <div className="mb-2 flex items-center gap-2 tool-metric-label">
                    <MapPin className="h-4 w-4" strokeWidth={1.75} />
                    Location
                  </div>
                  <div className="text-base font-medium text-white">
                    {data?.city && data?.country
                      ? `${data.city}, ${data.country}`
                      : "N/A"}
                  </div>
                </div>

                <div className="tool-metric">
                  <div className="mb-2 flex items-center gap-2 tool-metric-label">
                    <Wifi className="h-4 w-4" strokeWidth={1.75} />
                    ISP
                  </div>
                  <div className="text-base font-medium text-white">{data?.isp || "N/A"}</div>
                </div>

                <div className="tool-metric sm:col-span-2">
                  <div className="mb-2 flex items-center gap-2 tool-metric-label">
                    <Clock className="h-4 w-4" strokeWidth={1.75} />
                    Timezone
                  </div>
                  <div className="text-base font-medium text-white">{data?.timezone || "N/A"}</div>
                </div>
              </div>
            </div>
          )}
          </section>

          <aside className="tool-surface space-y-4">
            <div className="space-y-2">
              <p className="tool-eyebrow">What this is for</p>
              <p className="tool-heading">Use it as a quick baseline before deeper diagnostics.</p>
            </div>
            <div className="space-y-3 text-sm text-white/66">
              <div className="tool-surface-muted">
                Confirm the public IP your browser is currently exposing.
              </div>
              <div className="tool-surface-muted">
                Cross-check approximate geography before DNS, ping, or port tests.
              </div>
              <div className="tool-surface-muted">
                Verify ISP and timezone context when comparing multi-region results.
              </div>
            </div>
          </aside>
        </div>
      </ToolPageShell>
    </>
  );
}
