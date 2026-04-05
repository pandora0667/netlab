import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Loader2, Download, Map, PieChart, Orbit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getDnsPropagationRequestStatus,
  startDnsPropagationRequest,
} from "@/domains/dns-propagation/api";
import { ApiClientError } from "@/domains/shared/api-client";
import {
  createDnsPropagationRequestId,
  useDnsPropagationSocket,
} from "@/domains/dns-propagation/socket";
import {
  dnsPropagationFormSchema,
  dnsPropagationRequestSchema,
} from "@/domains/dns-propagation/schema";
import { serializeDnsPropagationReport } from "@/domains/dns-propagation/report";
import {
  calculateDnsPropagationStats,
  createEmptyQueryStats,
} from "@/domains/dns-propagation/stats";
import {
  type DNSQueryResult,
  type FilterState,
  type QueryStats,
  REGIONS,
} from './dns-propagation/shared';
import { SEO } from '../SEO';
import { ToolPageShell } from '@/components/layout/ToolPageShell';

const DNSPropagationMap = lazy(
  () => import('./dns-propagation/DNSPropagationMap'),
);
const DNSPropagationChart = lazy(
  () => import('./dns-propagation/DNSPropagationChart'),
);

const ACTIVE_DNS_PROPAGATION_REQUEST_STORAGE_KEY =
  "netlab:dns-propagation:active-request";

interface PersistedDnsPropagationRequest {
  requestId: string;
  domain: string;
  region: string;
}

function readPersistedDnsPropagationRequest(): PersistedDnsPropagationRequest | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      ACTIVE_DNS_PROPAGATION_REQUEST_STORAGE_KEY,
    );

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedDnsPropagationRequest>;

    if (
      typeof parsedValue.requestId !== "string" ||
      typeof parsedValue.domain !== "string" ||
      typeof parsedValue.region !== "string"
    ) {
      return null;
    }

    return {
      requestId: parsedValue.requestId,
      domain: parsedValue.domain,
      region: parsedValue.region,
    };
  } catch {
    return null;
  }
}

function writePersistedDnsPropagationRequest(
  request: PersistedDnsPropagationRequest | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!request) {
    window.sessionStorage.removeItem(ACTIVE_DNS_PROPAGATION_REQUEST_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(
    ACTIVE_DNS_PROPAGATION_REQUEST_STORAGE_KEY,
    JSON.stringify(request),
  );
}

export default function DNSPropagationChecker() {
  const [domain, setDomain] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All Regions');
  const [results, setResults] = useState<DNSQueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'table' | 'map' | 'chart'>('table');
  const [stats, setStats] = useState<QueryStats>(createEmptyQueryStats);
  const [progress, setProgress] = useState(0);

  const [filter, setFilter] = useState<FilterState>({
    status: 'all',
    dnssec: 'all'
  });
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const clearActiveRequest = useCallback(() => {
    writePersistedDnsPropagationRequest(null);
    setActiveRequestId(null);
    setIsLoading(false);
  }, []);

  const {
    isConnected,
    subscribeToRequest,
    unsubscribeFromRequest,
  } = useDnsPropagationSocket({
    activeRequestId,
    onResult: (result) => {
      setResults((previousResults) => {
        const nextResults = [...previousResults, result];
        setStats(calculateDnsPropagationStats(nextResults));
        return nextResults;
      });
    },
    onProgress: (event) => {
      setProgress(event.progress);
    },
    onComplete: () => {
      setProgress(100);
      clearActiveRequest();
    },
    onRequestError: (message) => {
      toast.error(message);
      clearActiveRequest();
    },
    onConnectionError: () => {
      toast.error('Connection error occurred');
      clearActiveRequest();
    },
  });

  const handleCheck = async () => {
    const parsedForm = dnsPropagationFormSchema.safeParse({
      domain,
      region: selectedRegion,
    });

    if (!parsedForm.success) {
      toast.error(parsedForm.error.issues[0]?.message || 'Please enter a valid domain name');
      return;
    }

    if (!isConnected) {
      toast.error('Live update connection is still initializing');
      return;
    }

    let nextRequestId: string | null = null;

    try {
      nextRequestId = createDnsPropagationRequestId();

      if (activeRequestId) {
        unsubscribeFromRequest(activeRequestId);
      }

      const subscribed = subscribeToRequest(nextRequestId);

      if (!subscribed) {
        throw new Error('Failed to subscribe to live DNS updates');
      }

      const request = dnsPropagationRequestSchema.parse({
        ...parsedForm.data,
        requestId: nextRequestId,
      });

      writePersistedDnsPropagationRequest({
        requestId: request.requestId,
        domain: request.domain,
        region: request.region,
      });
      setActiveRequestId(nextRequestId);
      setIsLoading(true);
      setResults([]);
      setStats(createEmptyQueryStats());
      setProgress(0);
      
      await startDnsPropagationRequest(request);
    } catch (error) {
      if (nextRequestId) {
        unsubscribeFromRequest(nextRequestId);
      }
      writePersistedDnsPropagationRequest(null);
      setActiveRequestId(null);
      setIsLoading(false);
      toast.error(error instanceof Error ? error.message : 'Failed to check DNS propagation');
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    if (!isConnected || activeRequestId) {
      return;
    }

    const persistedRequest = readPersistedDnsPropagationRequest();

    if (!persistedRequest) {
      return;
    }

    const subscribed = subscribeToRequest(persistedRequest.requestId);

    if (!subscribed) {
      return;
    }

    setDomain(persistedRequest.domain);
    setSelectedRegion(persistedRequest.region);
    setActiveRequestId(persistedRequest.requestId);
    setIsLoading(true);
  }, [activeRequestId, isConnected, subscribeToRequest]);

  useEffect(() => {
    if (!activeRequestId) {
      return;
    }

    let cancelled = false;

    const syncRequestStatus = async () => {
      try {
        const snapshot = await getDnsPropagationRequestStatus(activeRequestId);

        if (cancelled) {
          return;
        }

        setResults(snapshot.results);
        setStats(calculateDnsPropagationStats(snapshot.results));
        setProgress(snapshot.progress);

        if (snapshot.status === "complete") {
          clearActiveRequest();
          return;
        }

        if (snapshot.status === "error") {
          toast.error(snapshot.error || "DNS propagation request failed");
          clearActiveRequest();
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 404) {
          clearActiveRequest();
          return;
        }
      }
    };

    void syncRequestStatus();
    const intervalId = window.setInterval(() => {
      void syncRequestStatus();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeRequestId, clearActiveRequest]);

  useEffect(() => {
    return () => {
      if (activeRequestId) {
        unsubscribeFromRequest(activeRequestId);
      }
    };
  }, [activeRequestId, unsubscribeFromRequest]);

  const filteredResults = results.filter((result) => {
    if (filter.status !== 'all' && result.status !== filter.status) return false;
    if (filter.dnssec === 'enabled' && !result.server.dnssec) return false;
    if (filter.dnssec === 'disabled' && result.server.dnssec) return false;
    return true;
  });

  const activeFilterTokens = [
    `View: ${view}`,
    filter.status !== 'all' ? `Status: ${filter.status}` : null,
    filter.dnssec !== 'all' ? `DNSSEC: ${filter.dnssec}` : null,
    `Showing ${filteredResults.length}`,
  ].filter(Boolean) as string[];

  const generateReport = () => {
    const serializedReport = serializeDnsPropagationReport({
      domain,
      timestamp: new Date().toISOString(),
      stats,
      results: filteredResults,
    });

    const blob = new Blob([serializedReport], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dns-propagation-report-${domain}-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    switch (view) {
      case 'map':
        return (
          <Suspense fallback={<VisualizationFallback />}>
            <DNSPropagationMap results={filteredResults} />
          </Suspense>
        );

      case 'chart':
        return (
          <Suspense fallback={<VisualizationFallback />}>
            <DNSPropagationChart stats={stats} />
          </Suspense>
        );

      default:
        return (
          <div className="max-h-[68vh] overflow-auto rounded-[1.1rem] border border-white/8 bg-black/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-[rgb(14_17_27_/_0.96)] backdrop-blur">Country</TableHead>
                  <TableHead className="sticky top-0 bg-[rgb(14_17_27_/_0.96)] backdrop-blur">DNS Server</TableHead>
                  <TableHead className="sticky top-0 bg-[rgb(14_17_27_/_0.96)] backdrop-blur">Server IP</TableHead>
                  <TableHead className="sticky top-0 bg-[rgb(14_17_27_/_0.96)] backdrop-blur">Response</TableHead>
                  <TableHead className="sticky top-0 bg-[rgb(14_17_27_/_0.96)] backdrop-blur">DNSSEC</TableHead>
                  <TableHead className="sticky top-0 bg-[rgb(14_17_27_/_0.96)] backdrop-blur">Status</TableHead>
                  <TableHead className="sticky top-0 bg-[rgb(14_17_27_/_0.96)] backdrop-blur">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>{result.server.country_code}</TableCell>
                    <TableCell>{result.server.name || 'N/A'}</TableCell>
                    <TableCell>{result.server.ip_address}</TableCell>
                    <TableCell>{result.response}</TableCell>
                    <TableCell>
                      <Badge variant={result.server.dnssec ? 'default' : 'secondary'}>
                        {result.server.dnssec ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                        {result.status === 'success' ? 'Working' : 'Error'}
                      </Badge>
                    </TableCell>
                    <TableCell>{result.latency}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
    }
  };

  return (
    <>
      <SEO page="dnsPropagation" />
      <ToolPageShell
        title="DNS Propagation"
        description="Compare the same domain response across multiple resolvers. Live updates stream over WebSocket."
        actions={
          <div className="flex flex-wrap gap-1">
            <Button
              variant={view === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("table")}
            >
              Table
            </Button>
            <Button
              variant={view === "map" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("map")}
            >
              <Map className="mr-1.5 h-4 w-4" />
              Map
            </Button>
            <Button
              variant={view === "chart" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("chart")}
            >
              <PieChart className="mr-1.5 h-4 w-4" />
              Chart
            </Button>
          </div>
        }
      >
    <div className="space-y-4">
    <div className="tool-grid">
    <div className="tool-surface space-y-6">
      <div className="space-y-3">
        <span className="tool-kicker">
          <Orbit className="h-3.5 w-3.5" />
          Distributed resolution
        </span>
        <div className="space-y-2">
          <p className="tool-heading">Track how the same DNS answer spreads across public resolvers.</p>
          <p className="tool-copy">
            Start with a domain and region scope, then switch between table, map, and chart views
            depending on whether you need raw inspection or a quick propagation read.
          </p>
        </div>
      </div>

    <Card className="border-white/8 bg-white/[0.02] p-4 sm:p-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Input
            className="sm:min-w-[12rem] sm:flex-1"
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />

          <Select
            value={selectedRegion}
            onValueChange={setSelectedRegion}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(REGIONS).map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleCheck}
            disabled={isLoading || !isConnected}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : !isConnected ? (
              'Connecting...'
            ) : (
              'Check Propagation'
            )}
          </Button>

          {results.length > 0 && (
            <Button
              variant="outline"
              onClick={generateReport}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-2">
            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-white/58">
              {progress > 0
                ? `Live results are still arriving. ${progress}% of resolver checks have reported so far.`
                : 'Live results are still arriving. The request will stay open until all resolver checks complete.'}
            </p>
          </div>
        )}

      </div>
    </Card>
    </div>
    <aside className="tool-surface space-y-4">
      <div className="space-y-2">
        <p className="tool-eyebrow">How to read it</p>
        <p className="tool-heading">Propagation is disagreement over time, not a single pass/fail value.</p>
      </div>
      <div className="tool-inline-guidance text-sm text-white/66">
        <div className="tool-surface-muted">
          Use the table when you need exact resolver output and latency per server.
        </div>
        <div className="tool-surface-muted">
          Use the map for geographic drift and the chart for quick ratio summaries.
        </div>
        <div className="tool-surface-muted">
          A failed resolver does not always mean a broken domain. It can also reflect stale caches or regional recursion issues.
        </div>
      </div>
    </aside>
    </div>
    {results.length > 0 && (
      <div className="tool-surface space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-3 sm:p-4">
            <h3 className="text-xs font-medium text-muted-foreground">
              Total Queries
            </h3>
            <p className="text-xl font-semibold tabular-nums">
              {stats.totalQueries}
            </p>
          </Card>
          <Card className="p-3 sm:p-4">
            <h3 className="text-xs font-medium text-muted-foreground">
              Success Rate
            </h3>
            <p className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {Math.round((stats.successfulQueries / stats.totalQueries) * 100)}%
            </p>
          </Card>
          <Card className="p-3 sm:p-4">
            <h3 className="text-xs font-medium text-muted-foreground">
              Avg Latency
            </h3>
            <p className="text-xl font-semibold tabular-nums">
              {stats.averageLatency}ms
            </p>
          </Card>
          <Card className="p-3 sm:p-4">
            <h3 className="text-xs font-medium text-muted-foreground">
              DNSSEC
            </h3>
            <p className="text-xl font-semibold tabular-nums text-sky-600 dark:text-sky-400">
              {Math.round((stats.dnssecEnabled / stats.totalQueries) * 100)}%
            </p>
          </Card>
        </div>

        <div className="flex flex-wrap gap-4">
          <Select
            value={filter.status}
            onValueChange={(value: FilterState['status']) =>
              setFilter({ ...filter, status: value })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Working</SelectItem>
              <SelectItem value="error">Not Working</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filter.dnssec}
            onValueChange={(value: FilterState['dnssec']) =>
              setFilter({ ...filter, dnssec: value })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by DNSSEC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enabled">DNSSEC Enabled</SelectItem>
              <SelectItem value="disabled">DNSSEC Disabled</SelectItem>
              <SelectItem value="all">All DNSSEC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeFilterTokens.map((token) => (
            <span
              key={token}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.72rem] font-mono uppercase tracking-[0.16em] text-white/58"
            >
              {token}
            </span>
          ))}
        </div>

        {renderContent()}
      </div>
    )}
    </div>
      </ToolPageShell>
    </>
  );
}

function VisualizationFallback() {
  return (
    <div className="flex h-[400px] items-center justify-center rounded-lg border bg-muted/20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
