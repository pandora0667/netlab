import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ScanSummary } from '@/domains/port-scan/model';
import { XCircle, CheckCircle, AlertCircle } from 'lucide-react';

interface PortScannerResultsProps {
  summary: ScanSummary;
  onClear: () => void;
  onExport: (format: 'JSON' | 'CSV') => void;
}

export function PortScannerResults({ summary, onClear, onExport }: PortScannerResultsProps) {
  const [showAllPorts, setShowAllPorts] = useState(false);
  const [portFilter, setPortFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Open' | 'Closed' | 'Filtered' | 'Open|Filtered' | 'All'>('All');

  // Apply filters to results
  const filteredResults = summary.results
    .filter(result => {
      // Apply Show All Ports filter
      if (!showAllPorts && result.status !== 'Open') {
        return false;
      }
      
      // Apply port number filter
      if (portFilter && !result.port.toString().includes(portFilter)) {
        return false;
      }
      
      // Apply status filter
      if (statusFilter !== 'All' && result.status !== statusFilter) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => a.port - b.port); // Keep results sorted by port number

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'Closed':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case 'Filtered':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'Open|Filtered':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
      case 'Closed':
        return 'border-border bg-muted/50 text-muted-foreground';
      case 'Filtered':
        return 'border-destructive/30 bg-destructive/10 text-destructive';
      case 'Open|Filtered':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200';
      default:
        return '';
    }
  };

  const activeFilterTokens = [
    showAllPorts ? "All ports" : "Open only",
    portFilter ? `Port contains ${portFilter}` : null,
    statusFilter !== 'All' ? `Status: ${statusFilter}` : null,
  ].filter(Boolean) as string[];

  return (
    <Card className="mt-4 border-border/60">
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="flex flex-col gap-3 text-base sm:flex-row sm:items-center sm:justify-between">
          <span>Scan Results</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onExport('CSV')}>
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExport('JSON')}>
              Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={onClear}>
              Clear Results
            </Button>
          </div>
        </CardTitle>
        <p className="text-xs text-muted-foreground sm:text-sm">
          {summary.openPorts} open · {summary.uncertainPorts} uncertain · {summary.totalScanned} scanned
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="tool-metric">
              <p className="tool-metric-label">Open</p>
              <p className="tool-metric-value">{summary.openPorts}</p>
            </div>
            <div className="tool-metric">
              <p className="tool-metric-label">Uncertain</p>
              <p className="tool-metric-value">{summary.uncertainPorts}</p>
            </div>
            <div className="tool-metric">
              <p className="tool-metric-label">Scanned</p>
              <p className="tool-metric-value">{summary.totalScanned}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center space-x-2">
              <Switch
                checked={showAllPorts}
                onCheckedChange={setShowAllPorts}
                id="show-all-ports"
              />
              <Label htmlFor="show-all-ports">Show All Ports</Label>
            </div>
            <Input
              placeholder="Filter by port number"
              value={portFilter}
              onChange={(e) => setPortFilter(e.target.value)}
              className="w-48"
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="All">All Status</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Filtered">Filtered</option>
              <option value="Open|Filtered">Open|Filtered</option>
            </select>
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
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.72rem] font-mono uppercase tracking-[0.16em] text-white/58">
              Showing {filteredResults.length}
            </span>
          </div>

          <ScrollArea className="h-[min(34rem,66vh)] rounded-[1.1rem] border border-white/8 bg-black/10">
            <div className="space-y-2 p-3">
              {filteredResults.map((result) => (
                <TooltipProvider key={`${result.port}-${result.protocol}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2 rounded-lg border border-border/60 p-2 transition-colors hover:bg-muted/40">
                        {getStatusIcon(result.status)}
                        <span className="font-mono">Port {result.port}</span>
                        <Badge variant="secondary">{result.protocol}</Badge>
                        <Badge variant="outline" className={getStatusColor(result.status)}>
                          {result.status}
                        </Badge>
                        {result.service && (
                          <span className="text-muted-foreground">{result.service}</span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{result.description || `Port ${result.port} (${result.protocol})`}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
