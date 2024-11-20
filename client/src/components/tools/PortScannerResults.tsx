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
import { ScanResult, ScanSummary } from '@/lib/port-scanner-types';
import { XCircle, CheckCircle, AlertCircle } from 'lucide-react';

interface PortScannerResultsProps {
  summary: ScanSummary;
  onClear: () => void;
  onExport: (format: 'JSON' | 'CSV') => void;
}

export function PortScannerResults({ summary, onClear, onExport }: PortScannerResultsProps) {
  const [showAllPorts, setShowAllPorts] = useState(false);
  const [portFilter, setPortFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Open' | 'Closed' | 'Filtered' | 'All'>('All');

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
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'Filtered':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-green-100 text-green-800';
      case 'Closed':
        return 'bg-gray-100 text-gray-800';
      case 'Filtered':
        return 'bg-red-100 text-red-800';
      default:
        return '';
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
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
        <div className="text-sm text-gray-500">
          Summary: {summary.openPorts} open ports found out of {summary.totalScanned} scanned
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
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
              className="border rounded p-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="All">All Status</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Filtered">Filtered</option>
            </select>
          </div>

          <div className="space-y-2">
            {filteredResults.map((result) => (
              <TooltipProvider key={`${result.port}-${result.protocol}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                      {getStatusIcon(result.status)}
                      <span className="font-mono">Port {result.port}</span>
                      <Badge variant="secondary">{result.protocol}</Badge>
                      <Badge className={getStatusColor(result.status)}>
                        {result.status}
                      </Badge>
                      {result.service && (
                        <span className="text-gray-600">{result.service}</span>
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
        </div>
      </CardContent>
    </Card>
  );
}
