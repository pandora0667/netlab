import { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DownloadIcon, FileJson, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const portScannerSchema = z.object({
  targetIp: z.string().ip({ message: "Please enter a valid IP address" }),
  startPort: z.number().int().min(1).max(65535),
  endPort: z.number().int().min(1).max(65535),
  protocol: z.enum(['TCP', 'UDP', 'BOTH']),
  timeout: z.number().int().min(100).max(10000).optional(),
  exportFormat: z.enum(['JSON', 'CSV']).optional()
}).refine(data => data.startPort <= data.endPort, {
  message: "Start port must be less than or equal to end port",
  path: ["endPort"]
});

interface PortScannerFormValues {
  targetIp: string;
  startPort: number;
  endPort: number;
  protocol: "TCP" | "UDP" | "BOTH";
  timeout: number;
}

interface ScanResult {
  TCP?: { [key: number]: string };
  UDP?: { [key: number]: string };
}

export default function PortScanner() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ScanResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentResults, setCurrentResults] = useState<ScanResult | null>(null);

  const form = useForm<PortScannerFormValues>({
    resolver: zodResolver(portScannerSchema),
    defaultValues: {
      targetIp: "",
      startPort: 1,
      endPort: 1024,
      protocol: "TCP",
      timeout: 1000,
    },
  });

  const onSubmit = async (data: PortScannerFormValues) => {
    setIsScanning(true);
    setProgress(0);
    setCurrentResults(null);
    setResults(null);

    try {
      console.log('Starting port scan with data:', data);
      const eventSource = new EventSource(`/api/port-scanner/stream?${new URLSearchParams({
        targetIp: data.targetIp,
        startPort: data.startPort.toString(),
        endPort: data.endPort.toString(),
        protocol: data.protocol,
        timeout: data.timeout.toString(),
      })}`);

      console.log('EventSource created');

      eventSource.onmessage = (event) => {
        console.log('Received event:', event.data);
        const { progress, results } = JSON.parse(event.data);
        setProgress(progress);
        setCurrentResults(results);
        
        if (progress === 100) {
          setResults(results);
          eventSource.close();
          setIsScanning(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        setIsScanning(false);
        toast({
          title: "Scan failed",
          description: "An error occurred while scanning ports",
          variant: "destructive",
        });
      };
    } catch (error) {
      console.error('Port scan error:', error);
      setIsScanning(false);
      toast({
        title: "Scan failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleExport = async (format: "JSON" | "CSV") => {
    if (!results) {
      toast({
        title: "No results to export",
        description: "Please perform a scan first",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/port-scanner/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          results,
          format,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export results");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `port-scan-${Date.now()}.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `Results exported as ${format}`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Port Scanner</h1>
          <p className="text-sm text-muted-foreground">
            Scan TCP and UDP ports on a target IP address
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" disabled={!results}>
              <DownloadIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("JSON")}>
              <FileJson className="mr-2 h-4 w-4" />
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("CSV")}>
              <FileText className="mr-2 h-4 w-4" />
              Export as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isScanning && (
        <Card>
          <CardHeader>
            <CardTitle>Scanning Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Scanned {progress.toFixed(1)}% of ports
            </p>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scan Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="targetIp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target IP</FormLabel>
                      <FormControl>
                        <Input placeholder="192.168.1.1" {...field} />
                      </FormControl>
                      <FormDescription>
                        Enter the IP address to scan
                      </FormDescription>
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
                          <SelectItem value="BOTH">Both (TCP & UDP)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the protocol to scan
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          placeholder="1"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Port range start (1-65535)
                      </FormDescription>
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
                          placeholder="1024"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Port range end (1-65535)
                      </FormDescription>
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
                          placeholder="1000"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Scan timeout in milliseconds
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isScanning}>
              {isScanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isScanning ? "Scanning..." : "Start Scan"}
            </Button>
          </div>
        </form>
      </Form>

      {(results || currentResults) && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Results {!results && "(In Progress)"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {(results || currentResults)?.TCP && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">TCP Ports</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries((results || currentResults)!.TCP!).map(([port, status]) => (
                      <div
                        key={port}
                        className={cn(
                          "p-2 rounded-md text-sm flex justify-between items-center",
                          status === "Open"
                            ? "bg-green-100 dark:bg-green-900/20"
                            : "bg-red-100 dark:bg-red-900/20"
                        )}
                      >
                        <span>Port {port}</span>
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs",
                            status === "Open"
                              ? "bg-green-200 dark:bg-green-900/40 text-green-800 dark:text-green-200"
                              : "bg-red-200 dark:bg-red-900/40 text-red-800 dark:text-red-200"
                          )}
                        >
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(results || currentResults)?.UDP && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">UDP Ports</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries((results || currentResults)!.UDP!).map(([port, status]) => (
                      <div
                        key={port}
                        className={cn(
                          "p-2 rounded-md text-sm flex justify-between items-center",
                          status === "Open"
                            ? "bg-green-100 dark:bg-green-900/20"
                            : "bg-red-100 dark:bg-red-900/20"
                        )}
                      >
                        <span>Port {port}</span>
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs",
                            status === "Open"
                              ? "bg-green-200 dark:bg-green-900/40 text-green-800 dark:text-green-200"
                              : "bg-red-200 dark:bg-red-900/40 text-red-800 dark:text-red-200"
                          )}
                        >
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
