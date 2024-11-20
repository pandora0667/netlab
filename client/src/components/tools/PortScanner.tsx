import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  PortScannerFormValues, 
  PORT_GROUPS, 
  ScanProgress, 
  ScanResult, 
  ScanSummary,
  PortInfo
} from '@/lib/port-scanner-types';
import { PortScannerResults } from './PortScannerResults';

const portScannerSchema = z.object({
  targetIp: z.string().ip({ message: "Please enter a valid IP address" }),
  scanMode: z.enum(['range', 'well-known']),
  startPort: z.number().int().min(1).max(65535),
  endPort: z.number().int().min(1).max(65535),
  selectedGroups: z.array(z.string()),
  protocol: z.enum(['TCP', 'UDP', 'BOTH']),
  timeout: z.number().int().min(100).max(10000).default(1000),
  showAllPorts: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.scanMode === 'range') {
    if (data.startPort > data.endPort) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start port must be less than or equal to end port",
        path: ["startPort"],
      });
    }
  } else {
    if (data.selectedGroups.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select at least one port group",
        path: ["selectedGroups"],
      });
    }
  }
});

export default function PortScanner() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    scannedPorts: 0,
    totalPorts: 0,
    percentage: 0
  });
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [eventSourceRef, setEventSourceRef] = useState<EventSource | null>(null);

  const form = useForm<PortScannerFormValues>({
    resolver: zodResolver(portScannerSchema),
    defaultValues: {
      targetIp: '',
      scanMode: 'range',
      startPort: 1,
      endPort: 1024,
      selectedGroups: [],
      protocol: 'TCP',
      timeout: 1000,
      showAllPorts: false,
    },
  });

  const scanMode = form.watch('scanMode');
  const selectedGroups = form.watch('selectedGroups');

  // Calculate total ports to be scanned
  useEffect(() => {
    if (scanMode === 'well-known' && selectedGroups.length > 0) {
      const uniquePorts = new Set<number>();
      selectedGroups.forEach(groupName => {
        const group = PORT_GROUPS.find(g => g.name === groupName);
        if (group) {
          group.ports.forEach(p => uniquePorts.add(p.port));
        }
      });
      form.setValue('startPort', Math.min(...Array.from(uniquePorts)));
      form.setValue('endPort', Math.max(...Array.from(uniquePorts)));
    }
  }, [scanMode, selectedGroups, form]);

  const handleExport = async (format: 'JSON' | 'CSV') => {
    if (!scanSummary) return;

    try {
      // Convert scan summary results to the expected format
      const exportResults = {
        TCP: {} as { [key: number]: string },
        UDP: {} as { [key: number]: string }
      };

      scanSummary.results.forEach(result => {
        const protocol = result.protocol as 'TCP' | 'UDP';
        exportResults[protocol][result.port] = result.status;
      });

      const response = await fetch('/api/port-scanner/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          results: exportResults,
          format
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `port-scan-${Date.now()}.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export Successful',
        description: `Results exported as ${format}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export results',
        variant: 'destructive',
      });
    }
  };

  const stopScanning = () => {
    if (eventSourceRef) {
      eventSourceRef.close();
      setEventSourceRef(null);
      setIsScanning(false);
      toast({
        title: 'Scan Stopped',
        description: 'Port scanning has been stopped',
      });
    }
  };

  const onSubmit = async (data: PortScannerFormValues) => {
    try {
      setIsScanning(true);
      setScanSummary(null);

      // Close existing EventSource if any
      if (eventSourceRef) {
        eventSourceRef.close();
      }

      let portList: number[] | undefined;
      if (data.scanMode === 'well-known') {
        const uniquePorts = new Set<number>();
        data.selectedGroups.forEach(groupName => {
          const group = PORT_GROUPS.find(g => g.name === groupName);
          if (group) {
            group.ports.forEach(p => uniquePorts.add(p.port));
          }
        });
        portList = Array.from(uniquePorts);
      }

      const queryParams = new URLSearchParams({
        targetIp: data.targetIp,
        protocol: data.protocol,
        timeout: data.timeout.toString(),
        ...(data.scanMode === 'range' 
          ? {
              startPort: data.startPort.toString(),
              endPort: data.endPort.toString()
            }
          : {
              portList: portList?.join(',') || ''
            }
        )
      });

      const eventSource = new EventSource(`/api/port-scanner/stream?${queryParams}`);
      setEventSourceRef(eventSource);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          toast({
            title: "Error",
            description: data.error.message,
            variant: "destructive",
          });
          setIsScanning(false);
          eventSource.close();
          return;
        }

        if (data.progress) {
          const { scanned, total, currentPort, status } = data.progress;
          setScanProgress({
            scannedPorts: scanned,
            totalPorts: total,
            percentage: (scanned / total) * 100,
            currentPort
          });

          if (status === 'completed') {
            setIsScanning(false);
            eventSource.close();
            
            // Process results
            const results = data.results;
            const processedResults: ScanResult[] = [];
            
            for (const protocol of Object.keys(results)) {
              for (const [port, status] of Object.entries(results[protocol])) {
                const portNumber = parseInt(port);
                const portInfo = findPortInfo(portNumber);
                
                processedResults.push({
                  port: portNumber,
                  status: status as 'Open' | 'Closed' | 'Filtered',
                  protocol: protocol as 'TCP' | 'UDP',
                  ...(portInfo && {
                    service: portInfo.service,
                    description: portInfo.description
                  })
                });
              }
            }

            // Sort results by port number
            processedResults.sort((a, b) => a.port - b.port);

            setScanSummary({
              totalScanned: processedResults.length,
              openPorts: processedResults.filter(r => r.status === 'Open').length,
              filteredPorts: processedResults.filter(r => r.status === 'Filtered').length,
              closedPorts: processedResults.filter(r => r.status === 'Closed').length,
              results: processedResults
            });
          }
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to scan progress stream",
          variant: "destructive",
        });
        setIsScanning(false);
        eventSource.close();
      };
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setIsScanning(false);
    }
  };

  // Helper function to find port info
  const findPortInfo = (port: number): PortInfo | undefined => {
    for (const group of PORT_GROUPS) {
      const portInfo = group.ports.find(p => p.port === port);
      if (portInfo) return portInfo;
    }
    return undefined;
  };

  const clearResults = () => {
    setScanSummary(null);
    setScanProgress({
      scannedPorts: 0,
      totalPorts: 0,
      percentage: 0
    });
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Port Scanner</h2>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="targetIp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target IP</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter IP address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="protocol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protocol</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select protocol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="TCP">TCP</SelectItem>
                          <SelectItem value="UDP">UDP</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scanMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scan Mode</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select scan mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="range">Port Range</SelectItem>
                          <SelectItem value="well-known">Well-Known Ports</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timeout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeout (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={100}
                          max={10000}
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {scanMode === 'range' ? (
                  <>
                    <FormField
                      control={form.control}
                      name="startPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Port</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={65535}
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Port</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={65535}
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="selectedGroups"
                      render={() => (
                        <FormItem>
                          <FormLabel>Port Groups</FormLabel>
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            {PORT_GROUPS.map((group) => (
                              <div key={group.name} className="flex items-start space-x-2">
                                <Checkbox
                                  checked={selectedGroups.includes(group.name)}
                                  onCheckedChange={(checked) => {
                                    const current = new Set(selectedGroups);
                                    if (checked) {
                                      current.add(group.name);
                                    } else {
                                      current.delete(group.name);
                                    }
                                    form.setValue('selectedGroups', Array.from(current));
                                  }}
                                />
                                <div className="grid gap-1.5 leading-none">
                                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {group.name}
                                  </label>
                                  <p className="text-xs text-gray-500">
                                    {group.ports.map(p => p.port).join(', ')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Button type="submit" disabled={isScanning}>
                  {isScanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isScanning ? 'Scanning...' : 'Start Scan'}
                </Button>
                {isScanning && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={stopScanning}
                  >
                    Stop Scan
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      {isScanning && scanProgress.totalPorts > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>
                  Scanning port {scanProgress.currentPort} 
                  ({scanProgress.scannedPorts} of {scanProgress.totalPorts} ports)
                </span>
                <span>{Math.round(scanProgress.percentage)}%</span>
              </div>
              <Progress value={scanProgress.percentage} />
            </div>
          </CardContent>
        </Card>
      )}

      {scanSummary && (
        <PortScannerResults
          summary={scanSummary}
          onClear={clearResults}
          onExport={handleExport}
        />
      )}
    </div>
  );
}
