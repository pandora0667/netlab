import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pingSchema } from "@/lib/validation";
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
import { Download, Loader2, HelpCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "react-hot-toast";
import { z } from "zod";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface PingResult {
  host: string;
  type: string;
  results: Array<{
    success: boolean;
    latency?: number;
    error?: string;
    attempt: number;
  }>;
  statistics: {
    sent: number;
    received: number;
    lost: number;
    successRate: number;
    minLatency: number;
    maxLatency: number;
    avgLatency: number;
  };
}

type PingFormData = z.infer<typeof pingSchema>;

export default function PingTool() {
  const [results, setResults] = useState<PingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PingFormData>({
    resolver: zodResolver(pingSchema),
    defaultValues: {
      host: "",
      type: "icmp",
      port: 80,
      count: 4,
      timeout: 5000
    }
  });

  const pingType = form.watch("type");

  const handleExport = (format: 'json' | 'csv') => {
    if (!results) return;

    const data = format === 'json' 
      ? JSON.stringify(results, null, 2)
      : convertToCSV(results);

    const blob = new Blob([data], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ping_results.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  async function onSubmit(data: PingFormData) {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          port: data.type === 'tcp' ? data.port : undefined
        })
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok || !contentType?.includes('application/json')) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }

      const result = await response.json();
      if (!result || !result.results) {
        throw new Error('잘못된 응답 형식입니다.');
      }

      setResults(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setError(errorMessage);
      toast.error('Ping test failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Ping Tool</h2>
        <p className="text-muted-foreground">Test connectivity to a host</p>
      </div>

      <Card className="p-6 shadow-lg">
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
                                <p><strong>ICMP:</strong> Standard ping test</p>
                                <p><strong>TCP:</strong> Test specific port connection</p>
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
                disabled={isLoading}
                className="w-full md:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  "Start Ping Test"
                )}
              </Button>
              {results && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleExport('json')}
                    className="transition-all duration-200 hover:scale-105 focus:ring-2"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport('csv')}
                    className="transition-all duration-200 hover:scale-105 focus:ring-2"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </>
              )}
            </div>
          </form>
        </Form>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ping Failed</AlertTitle>
          <AlertDescription>
            {error}
            <br />
            Please check the host name and try again.
          </AlertDescription>
        </Alert>
      )}

      {results && (
        <Card className="p-6 shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 className="text-lg font-semibold">Test Results</h3>
          </div>

          <ScrollArea className="h-[300px] rounded-lg border">
            <div className="space-y-2 p-4">
              {results.results.map((result, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg transition-colors ${
                    result.success 
                      ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                      : 'bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Attempt {result.attempt}</span>
                    {result.success ? (
                      <span className="text-green-700 dark:text-green-300 font-medium">
                        {result.latency?.toFixed(2)}ms
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-300 font-medium">
                        {result.error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-6 space-y-4">
            <h4 className="font-medium text-lg">Statistics</h4>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="font-medium">Success Rate: {results.statistics.successRate.toFixed(1)}%</p>
                <Progress 
                  value={results.statistics.successRate} 
                  className="h-2.5 rounded-full"
                />
              </div>
              <div className="space-y-3">
                <p className="font-medium">Response Times</p>
                <div className="space-y-2 text-sm">
                  <p>Average: {results.statistics.avgLatency.toFixed(2)}ms</p>
                  <p>Min: {results.statistics.minLatency.toFixed(2)}ms</p>
                  <p>Max: {results.statistics.maxLatency.toFixed(2)}ms</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// Utility function
function convertToCSV(results: PingResult): string {
  const headers = ['Attempt', 'Success', 'Latency', 'Error'];
  const rows = results.results.map(r => [
    r.attempt,
    r.success,
    r.latency || '',
    r.error || ''
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}
