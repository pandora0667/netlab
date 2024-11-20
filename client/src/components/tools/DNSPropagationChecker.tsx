import React, { useState, useEffect } from 'react';
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  Marker,
  ZoomableGroup
} from 'react-simple-maps';

interface DNSServer {
  country_code: string;
  name: string;
  ip_address: string;
  reliability: number;
  dnssec: boolean;
  is_working: boolean;
}

interface DNSQueryResult {
  server: DNSServer;
  response: string;
  latency: number;
  status: 'success' | 'error';
  error?: string;
  timestamp?: number;
}

interface QueryStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageLatency: number;
  dnssecEnabled: number;
}

const REGIONS = {
  'All Regions': ['*'],
  'Asia': ['JP', 'KR', 'CN', 'SG', 'IN', 'HK'],
  'Europe': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL'],
  'North America': ['US', 'CA', 'MX'],
  'South America': ['BR', 'AR', 'CL', 'CO'],
  'Africa': ['ZA', 'EG', 'NG', 'KE'],
  'Oceania': ['AU', 'NZ'],
};

const serverCoordinates: { [key: string]: [number, number] } = {
  // Asia
  'JP': [139.6917, 35.6895],  // Tokyo
  'KR': [126.9780, 37.5665],  // Seoul
  'CN': [116.4074, 39.9042],  // Beijing
  'SG': [103.8198, 1.3521],   // Singapore
  'IN': [77.2090, 28.6139],   // New Delhi
  'HK': [114.1694, 22.3193],  // Hong Kong

  // Europe
  'GB': [-0.1276, 51.5074],   // London
  'DE': [13.4050, 52.5200],   // Berlin
  'FR': [2.3522, 48.8566],    // Paris
  'IT': [12.4964, 41.9028],   // Rome
  'ES': [-3.7038, 40.4168],   // Madrid
  'NL': [4.9041, 52.3676],    // Amsterdam

  // North America
  'US': [-95.7129, 37.0902],  // United States (center)
  'CA': [-106.3468, 56.1304], // Canada (center)
  'MX': [-102.5528, 23.6345], // Mexico (center)

  // South America
  'BR': [-47.9292, -15.7801], // Brasilia
  'AR': [-58.3816, -34.6037], // Buenos Aires
  'CL': [-70.6483, -33.4489], // Santiago
  'CO': [-74.0721, 4.7110],   // Bogota

  // Africa
  'ZA': [28.0473, -26.2041],  // Johannesburg
  'EG': [31.2357, 30.0444],   // Cairo
  'NG': [3.3792, 6.5244],     // Lagos
  'KE': [36.8219, -1.2921],   // Nairobi

  // Oceania
  'AU': [149.1300, -35.2809], // Canberra
  'NZ': [174.7787, -41.2924], // Wellington
};

const getRegionColor = (countryCode: string) => {
  for (const [region, countries] of Object.entries(REGIONS)) {
    if (countries.includes('*') || countries.includes(countryCode)) {
      switch (region) {
        case 'Asia':
          return '#FFE0B2';
        case 'Europe':
          return '#C8E6C9';
        case 'North America':
          return '#B3E5FC';
        case 'South America':
          return '#F8BBD0';
        case 'Africa':
          return '#FFE0B2';
        case 'Oceania':
          return '#E1BEE7';
        default:
          return '#EAEAEC';
      }
    }
  }
  return '#EAEAEC';
};

const geoUrl = "/world-countries.json";

export default function DNSPropagationChecker() {
  const [domain, setDomain] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All Regions');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DNSQueryResult[]>([]);
  const [filter, setFilter] = useState({
    status: 'all',
    dnssec: 'all',
  });
  const [view, setView] = useState<'table' | 'map' | 'chart'>('table');
  const [stats, setStats] = useState<QueryStats>({
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    averageLatency: 0,
    dnssecEnabled: 0,
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8080';
    const ws = new WebSocket(`${protocol}//${host}/ws`);
    let isConnected = false;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      isConnected = true;
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'queryResult') {
          setResults(prev => {
            const newResults = [...prev];
            const index = newResults.findIndex(r => 
              r.server.ip_address === message.data.server.ip_address
            );
            if (index >= 0) {
              newResults[index] = message.data;
            } else {
              newResults.push(message.data);
            }
            calculateStats(newResults);
            setProgress(Math.round((newResults.length / (prev.length || 1)) * 100));
            return newResults;
          });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (isConnected) {
        toast.error('WebSocket connection error');
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      isConnected = false;
    };

    const handleResize = () => {
      // Force map re-render on window resize
      setView(prev => prev === 'map' ? 'chart' : 'map');
      setTimeout(() => setView('map'), 0);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const calculateStats = (results: DNSQueryResult[]) => {
    const successful = results.filter(r => r.status === 'success').length;
    const total = results.length;
    const avgLatency = results.reduce((acc, cur) => acc + cur.latency, 0) / total;
    const dnssecEnabled = results.filter(r => r.server.dnssec).length;

    setStats({
      totalQueries: total,
      successfulQueries: successful,
      failedQueries: total - successful,
      averageLatency: Math.round(avgLatency),
      dnssecEnabled,
    });
  };

  const handleCheck = async () => {
    if (!domain) {
      toast.error('Please enter a domain name');
      return;
    }

    setIsLoading(true);
    setResults([]);
    setProgress(0);
    
    try {
      const response = await fetch('/api/dns-propagation/propagation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          region: selectedRegion,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check DNS propagation');
      }

      const data = await response.json();
      const resultsWithTimestamp = data.map((result: DNSQueryResult) => ({
        ...result,
        timestamp: Date.now(),
      }));
      
      setResults(resultsWithTimestamp);
      calculateStats(resultsWithTimestamp);
    } catch (error) {
      toast.error('Failed to check DNS propagation');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResults = results.filter((result) => {
    if (filter.status !== 'all' && result.status !== filter.status) return false;
    if (filter.dnssec !== 'all' && result.server.dnssec !== (filter.dnssec === 'enabled')) return false;
    return true;
  });

  const generateReport = () => {
    const report = {
      domain,
      timestamp: new Date().toISOString(),
      stats,
      results: filteredResults,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
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
          <div className="relative w-full max-w-full overflow-hidden bg-white rounded-lg shadow-sm">
            <div className="w-full aspect-[16/9] min-h-[400px] max-h-[600px]">
              <ComposableMap
                projectionConfig={{
                  scale: 140,
                  center: [0, 20],
                  rotate: [-10, 0, 0]
                }}
                className="w-full h-full"
                style={{
                  maxWidth: '100%',
                  height: 'auto'
                }}
              >
                <ZoomableGroup>
                  <Geographies geography={geoUrl}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const countryCode = geo.properties.iso_a2;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={getRegionColor(countryCode)}
                            stroke="#FFFFFF"
                            strokeWidth={0.5}
                            style={{
                              default: {
                                outline: 'none'
                              },
                              hover: {
                                fill: '#F5F5F5',
                                outline: 'none',
                                transition: 'all 250ms'
                              },
                              pressed: {
                                outline: 'none'
                              }
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                  {filteredResults.map((result, index) => {
                    const coordinates = serverCoordinates[result.server.country_code];
                    if (!coordinates) return null;
                    
                    return (
                      <Marker key={index} coordinates={coordinates}>
                        <g
                          transform="translate(-12, -24)"
                          style={{ cursor: 'pointer' }}
                        >
                          <circle
                            r={6}
                            fill={result.status === 'success' ? '#4CAF50' : '#f44336'}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          />
                          <circle
                            r={15}
                            fill={result.status === 'success' ? '#4CAF50' : '#f44336'}
                            fillOpacity={0.2}
                            stroke="none"
                          >
                            <animate
                              attributeName="r"
                              from="8"
                              to="20"
                              dur="1.5s"
                              begin="0s"
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="opacity"
                              from="0.6"
                              to="0"
                              dur="1.5s"
                              begin="0s"
                              repeatCount="indefinite"
                            />
                          </circle>
                          <title>
                            {result.server.name} ({result.server.country_code})
                            {'\n'}Status: {result.status}
                            {'\n'}Latency: {result.latency}ms
                          </title>
                        </g>
                      </Marker>
                    );
                  })}
                </ZoomableGroup>
              </ComposableMap>
              <div className="absolute bottom-2 right-2 bg-white/80 p-2 rounded-lg shadow-md text-sm z-10">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    Success
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    Failed
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'chart':
        return (
          <div className="h-[400px] w-full">
            <ResponsiveContainer>
              <BarChart data={[stats]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="successfulQueries" fill="#34D399" name="Successful" />
                <Bar dataKey="failedQueries" fill="#EF4444" name="Failed" />
                <Bar dataKey="dnssecEnabled" fill="#3B82F6" name="DNSSEC Enabled" />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
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
                onValueChange={(value) => setFilter({ ...filter, status: value })}
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
                onValueChange={(value) => setFilter({ ...filter, dnssec: value })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by DNSSEC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All DNSSEC</SelectItem>
                  <SelectItem value="enabled">DNSSEC Enabled</SelectItem>
                  <SelectItem value="disabled">DNSSEC Disabled</SelectItem>
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
