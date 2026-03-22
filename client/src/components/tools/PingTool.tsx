import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pingSchema, type PingFormData } from "@/domains/ping/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2, HelpCircle, Radar } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "react-hot-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { convertPingSummaryToCsv } from "@/domains/ping/export";
import {
  type PingSocketCompleteEvent,
  type PingSocketResultEvent,
  type PingSummary,
} from "@/domains/ping/model";
import { usePingSocket } from "@/domains/ping/socket";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import {
  GuidedTroubleshooting,
  type GuidedTroubleshootingItem,
} from "./GuidedTroubleshooting";

function buildPingGuidance(results: PingSummary | null): GuidedTroubleshootingItem[] {
  if (!results) {
    return [];
  }

  const items: GuidedTroubleshootingItem[] = [];
  const { statistics } = results;

  if (statistics.successRate === 0) {
    items.push({
      title: "The target did not answer any attempts.",
      detail:
        "That usually points to filtering, routing failure, host unreachability, or a service that is not listening on the chosen TCP port.",
      nextStep:
        "Run Trace Route next, then compare with Port Scanner or HTTP/TLS Inspector for the same host.",
      tone: "warn",
    });
  }

  if (statistics.successRate > 0 && statistics.successRate < 100) {
    items.push({
      title: "There is packet loss or intermittent success.",
      detail:
        "Some attempts returned while others failed, which suggests instability rather than a clean up/down state.",
      nextStep:
        "Repeat the same target and compare the path with Trace Route to see whether the failure starts at a consistent hop.",
      tone: "warn",
    });
  }

  if (statistics.avgLatency > 150) {
    items.push({
      title: "Latency is high enough to justify a path check.",
      detail:
        "The host is reachable, but the average round-trip time is elevated for a quick first-pass probe.",
      nextStep: "Use Trace Route to see whether delay grows early or only near the destination.",
      tone: "info",
    });
  }

  if (items.length === 0) {
    items.push({
      title: "Reachability looks healthy at first pass.",
      detail:
        "The target answered consistently and latency stayed within a normal range for a short diagnostic run.",
      nextStep:
        "If the service still feels broken, inspect DNS behavior or HTTP/TLS response details next.",
      tone: "good",
    });
  }

  return items;
}

export default function PingTool() {
  const [results, setResults] = useState<PingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentPingCount, setCurrentPingCount] = useState(0);

  const form = useForm<PingFormData>({
    resolver: zodResolver(pingSchema),
    defaultValues: {
      host: "",
      type: "icmp",
      port: 80,
      count: 4,
      timeout: 5000,
    },
  });

  const pingType = form.watch("type");

  const handlePingResult = useCallback((event: PingSocketResultEvent) => {
    setResults((prev) => {
      const nextResults: PingSummary = prev
        ? {
            ...prev,
            results: [...prev.results, event.result],
            statistics: event.statistics,
          }
        : {
            host: event.host,
            type: event.type,
            results: [event.result],
            statistics: event.statistics,
          };

      setProgress(
        Math.min(100, (nextResults.results.length / event.totalSequences) * 100),
      );
      setCurrentPingCount(nextResults.results.length);

      if (nextResults.results.length >= event.totalSequences) {
        setIsLoading(false);
      }

      return nextResults;
    });
  }, []);

  const handlePingComplete = useCallback((event: PingSocketCompleteEvent) => {
    setIsLoading(false);
    setResults((prev) => {
      if (!prev) {
        return {
          host: event.host,
          type: event.type,
          results: [],
          statistics: event.statistics,
        };
      }

      return {
        ...prev,
        statistics: event.statistics,
      };
    });
  }, []);

  const handleRequestError = useCallback((message: string) => {
    setError(message);
    setIsLoading(false);
    toast.error("Ping test failed");
  }, []);

  const handleConnectionError = useCallback(() => {
    toast.error("WebSocket connection error");
    setIsLoading(false);
  }, []);

  const { startPing, isConnected } = usePingSocket({
    onResult: handlePingResult,
    onComplete: handlePingComplete,
    onRequestError: handleRequestError,
    onConnectionError: handleConnectionError,
  });

  async function onSubmit(data: PingFormData) {
    if (!isConnected) {
      setError("Ping WebSocket is still connecting. Try again in a moment.");
      toast.error("Ping connection is not ready");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    setProgress(0);
    setCurrentPingCount(0);

    try {
      const messageSent = startPing(data);
      if (!messageSent) {
        throw new Error("Failed to send ping request over WebSocket");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast.error("Ping test failed");
      setIsLoading(false);
    }
  }

  const handleExport = useCallback((format: "json" | "csv") => {
    if (!results) return;

    const data = format === "json"
      ? JSON.stringify(results, null, 2)
      : convertPingSummaryToCsv(results);

    const blob = new Blob([data], {
      type: format === "json" ? "application/json" : "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ping_results.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [results]);

  return (
    <>
      <SEO page="pingTool" />
      <ToolPageShell
        title="Ping"
        description="Measure reachability and latency to a public target over ICMP or TCP. Progress updates over WebSocket."
      >
      <div className="space-y-4">
        <div className="tool-grid">
          <div className="space-y-4">
          <div className="tool-surface space-y-6">
            <div className="space-y-3">
              <span className="tool-kicker">
                <Radar className="h-3.5 w-3.5" />
                Live reachability
              </span>
              <div className="space-y-2">
                <p className="tool-heading">Run a short public latency check without leaving the command surface.</p>
                <p className="tool-copy">
                  Choose ICMP for basic reachability or TCP when you want to probe a specific
                  service port. Progress updates stream as each attempt completes.
                </p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="host"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Host</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="example.com or IP address"
                              className="transition-all focus:ring-2"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs mt-1" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2 mb-2">
                            <FormLabel className="text-sm font-medium">Ping Type</FormLabel>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  <div className="space-y-2">
                                    <p>
                                      <strong>ICMP:</strong> Standard ping test
                                    </p>
                                    <p>
                                      <strong>TCP:</strong> Test specific port connection
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full transition-all focus:ring-2">
                                <SelectValue placeholder="Choose ping method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="icmp">ICMP Ping</SelectItem>
                              <SelectItem value="tcp">TCP Ping</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs mt-1" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-6">
                    {pingType === "tcp" && (
                      <FormField
                        control={form.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Port</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={65535}
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Enter a port number between 1 and 65535
                            </FormDescription>
                            <FormMessage className="text-xs mt-1" />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Number of Attempts</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Enter a number between 1 and 10
                          </FormDescription>
                          <FormMessage className="text-xs mt-1" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isLoading || !isConnected}
                    className="w-full md:w-auto"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running Test...
                      </>
                    ) : !isConnected ? (
                      "Connecting..."
                    ) : (
                      "Start Ping Test"
                    )}
                  </Button>
                  {results && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleExport("json")}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export JSON
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleExport("csv")}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                    </>
                  )}
                </div>
              </form>
            </Form>
          </div>

      {isLoading && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span>
                {currentPingCount} / {form.getValues("count")} pings completed
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
          </div>
          <aside className="tool-surface space-y-4">
        <div className="space-y-2">
          <p className="tool-eyebrow">Read this before running</p>
          <p className="tool-heading">Use short, intentional probes instead of long test runs.</p>
        </div>
        <div className="tool-inline-guidance text-sm text-white/66">
          <div className="tool-surface-muted">
            ICMP gives a plain reachability baseline. TCP is better when latency to a single service matters.
          </div>
          <div className="tool-surface-muted">
            The timeout sets how long each attempt waits before the request is treated as failed.
          </div>
          <div className="tool-surface-muted">
            Export JSON for full logs and CSV when you need a quick comparison in a spreadsheet.
          </div>
        </div>
      </aside>
      </div>

      {results && (
        <div className="tool-surface space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="tool-metric">
              <p className="tool-metric-label">Success rate</p>
              <p className="tool-metric-value">{results.statistics.successRate.toFixed(1)}%</p>
            </div>
            <div className="tool-metric">
              <p className="tool-metric-label">Average latency</p>
              <p className="tool-metric-value">{results.statistics.avgLatency.toFixed(2)}ms</p>
            </div>
            <div className="tool-metric">
              <p className="tool-metric-label">Minimum latency</p>
              <p className="tool-metric-value">{results.statistics.minLatency.toFixed(2)}ms</p>
            </div>
            <div className="tool-metric">
              <p className="tool-metric-label">Maximum latency</p>
              <p className="tool-metric-value">{results.statistics.maxLatency.toFixed(2)}ms</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <h3 className="tool-heading">Attempt log</h3>
              <p className="text-sm text-white/48">
                {results.results.length} of {form.getValues("count")} attempts captured
              </p>
            </div>

            <ScrollArea className="h-[min(34rem,68vh)] rounded-[1.15rem] border border-white/8 bg-black/15">
              <div className="space-y-2 p-3 sm:p-4">
                {results.results.map((result, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border p-3 text-sm ${
                      result.success
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Attempt {result.attempt}</span>
                      {result.success ? (
                        <span className="font-mono text-muted-foreground">
                          {result.latency?.toFixed(2)}ms
                        </span>
                      ) : (
                        <span className="text-destructive">{result.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-4 border-t border-white/8 pt-5">
            <h4 className="tool-heading">Stability summary</h4>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Success rate {results.statistics.successRate.toFixed(1)}%
                </p>
                <Progress
                  value={results.statistics.successRate}
                  className="h-2 rounded-full"
                />
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Latency distribution</p>
                <p>Average {results.statistics.avgLatency.toFixed(2)}ms</p>
                <p>Minimum {results.statistics.minLatency.toFixed(2)}ms</p>
                <p>Maximum {results.statistics.maxLatency.toFixed(2)}ms</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <GuidedTroubleshooting items={buildPingGuidance(results)} />
      </div>
      </ToolPageShell>
    </>
  );
}
