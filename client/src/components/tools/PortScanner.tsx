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

type FormData = z.infer<typeof portScannerSchema>;

interface ScanResult {
  TCP?: { [key: number]: string };
  UDP?: { [key: number]: string };
}

export default function PortScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ScanResult | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(portScannerSchema),
    defaultValues: {
      targetIp: '',
      startPort: 1,
      endPort: 1024,
      protocol: 'TCP',
      timeout: 1000
    }
  });

  const onSubmit = async (data: FormData) => {
    setIsScanning(true);
    try {
      // 숫자 값이 비어있는 경우 기본값 사용
      const startPort = data.startPort || 1;
      const endPort = data.endPort || 1024;
      const timeout = data.timeout || 1000;

      const response = await fetch('/api/port-scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetIp: data.targetIp,
          portRange: [startPort, endPort],
          protocol: data.protocol,
          timeout: timeout,
          exportFormat: data.exportFormat
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Scan failed');
      }

      const scanResults = await response.json();
      setResults(scanResults);
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: error instanceof Error ? error.message : "An error occurred during the scan",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Port Scanner Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="targetIp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target IP</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
                          onChange={e => {
                            const value = e.target.value === '' ? '' : parseInt(e.target.value);
                            field.onChange(value);
                          }}
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
                          onChange={e => {
                            const value = e.target.value === '' ? '' : parseInt(e.target.value);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                name="timeout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeout (ms)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={100}
                        max={10000}
                        step={100}
                        {...field}
                        onChange={e => {
                          const value = e.target.value === '' ? '' : parseInt(e.target.value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exportFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Export Format (Optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select export format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="JSON">JSON</SelectItem>
                        <SelectItem value="CSV">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button type="submit" disabled={isScanning}>
            {isScanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isScanning ? 'Scanning...' : 'Start Scan'}
          </Button>
        </form>
      </Form>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.TCP && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">TCP Results</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(results.TCP).map(([port, status]) => (
                      <div
                        key={port}
                        className={`p-2 rounded ${
                          status === 'Open'
                            ? 'bg-green-100 dark:bg-green-900'
                            : 'bg-red-100 dark:bg-red-900'
                        }`}
                      >
                        Port {port}: {status}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.UDP && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">UDP Results</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(results.UDP).map(([port, status]) => (
                      <div
                        key={port}
                        className={`p-2 rounded ${
                          status === 'Open'
                            ? 'bg-green-100 dark:bg-green-900'
                            : 'bg-red-100 dark:bg-red-900'
                        }`}
                      >
                        Port {port}: {status}
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
