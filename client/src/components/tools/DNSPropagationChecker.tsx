import {
  lazy,
  Suspense,
  useState,
  useEffect,
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
import { Loader2, Download, Map, PieChart } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { startDnsPropagationRequest } from "@/domains/dns-propagation/api";
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

const DNSPropagationMap = lazy(
  () => import('./dns-propagation/DNSPropagationMap'),
);
const DNSPropagationChart = lazy(
  () => import('./dns-propagation/DNSPropagationChart'),
);

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
      setIsLoading(false);
      setActiveRequestId(null);
    },
    onRequestError: (message) => {
      toast.error(message);
      setIsLoading(false);
      setActiveRequestId(null);
    },
    onConnectionError: () => {
      toast.error('Connection error occurred');
      setIsLoading(false);
      setActiveRequestId(null);
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
      setActiveRequestId(null);
      setIsLoading(false);
      toast.error(error instanceof Error ? error.message : 'Failed to check DNS propagation');
      console.error('Error:', error);
    }
  };

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>DNS Server</TableHead>
                <TableHead>Server IP</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>DNSSEC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
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
        );
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">DNS Propagation Checker</h2>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView('table')}
              className={view === 'table' ? 'bg-primary text-primary-foreground' : ''}
            >
              Table
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView('map')}
              className={view === 'map' ? 'bg-primary text-primary-foreground' : ''}
            >
              <Map className="w-4 h-4 mr-2" />
              Map
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView('chart')}
              className={view === 'chart' ? 'bg-primary text-primary-foreground' : ''}
            >
              <PieChart className="w-4 h-4 mr-2" />
              Chart
            </Button>
          </div>
        </div>
        
        <div className="flex space-x-4">
          <Input
            placeholder="Enter domain name (e.g., example.com)"
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
          <div className="w-full bg-secondary rounded-full h-2.5 mb-4">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-medium">Total Queries</h3>
              <p className="text-2xl font-bold">{stats.totalQueries}</p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium">Success Rate</h3>
              <p className="text-2xl font-bold text-green-500">
                {Math.round((stats.successfulQueries / stats.totalQueries) * 100)}%
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium">Average Latency</h3>
              <p className="text-2xl font-bold">{stats.averageLatency}ms</p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium">DNSSEC Enabled</h3>
              <p className="text-2xl font-bold text-blue-500">
                {Math.round((stats.dnssecEnabled / stats.totalQueries) * 100)}%
              </p>
            </Card>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex space-x-4">
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

            {renderContent()}
          </div>
        )}
      </div>
    </Card>
  );
}

function VisualizationFallback() {
  return (
    <div className="flex h-[400px] items-center justify-center rounded-lg border bg-muted/20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
