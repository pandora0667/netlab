import { useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dnsLookupSchema } from "@/lib/validation";
import {
  Form, FormControl, FormField, FormItem, FormLabel,
  FormMessage, FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import {
  Loader2, AlertCircle, CheckCircle2, XCircle,
  Download, Plus, Trash2, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

interface Domain {
  id: string;
  value: string;
}

interface DNSResult {
  domain: string;
  results: {
    [recordType: string]: {
      server: string;
      recordType: string;
      records: string[] | object;
      queryTime: number;
    }[];
  };
}

export type ServerStatus = {
  id: string;
  name: string;
  address: string;
  status: 'querying' | 'retrying' | 'success' | 'error' | 'idle';
  attempt: number;
  error?: string;
};

const DNS_SERVERS = [
  { id: "google", name: "Google DNS", address: "8.8.8.8" },
  { id: "cloudflare", name: "Cloudflare", address: "1.1.1.1" },
  { id: "opendns", name: "OpenDNS", address: "208.67.222.222" },
];

interface ResultCardProps {
  result: DNSResult;
  serverStatuses: ServerStatus[];
}

function ResultCard({ result, serverStatuses }: ResultCardProps) {
  const formatRecordValue = (record: any): string => {
    if (typeof record === 'string') return record;
    if (Array.isArray(record)) return record.join(', ');
    if (typeof record === 'object') {
      if ('exchange' in record && 'priority' in record) {
        return `${record.exchange} (priority: ${record.priority})`;
      }
      return JSON.stringify(record, null, 2);
    }
    return String(record);
  };

  return (
    <Card className="p-4">
      <Tabs defaultValue="records" className="w-full">
        <TabsList>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="records">
          <div className="space-y-4">
            {Object.entries(result.results).map(([recordType, servers]) => (
              <Accordion
                key={recordType}
                type="single"
                collapsible
                className="border rounded-lg"
              >
                <AccordionItem value={recordType}>
                  <AccordionTrigger className="px-4">
                    {recordType} Records
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <div className="space-y-4">
                      {servers.map((server, idx) => (
                        <div key={`${server.server}-${idx}`} className="border-l-2 pl-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <span>{server.server}</span>
                            <span>•</span>
                            <span>{server.queryTime}ms</span>
                          </div>
                          <div className="bg-muted/50 p-3 rounded-md">
                            {Array.isArray(server.records) ? (
                              <div className="space-y-1">
                                {server.records.map((record, recordIdx) => (
                                  <div key={recordIdx} className="font-mono text-sm">
                                    {formatRecordValue(record)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="font-mono text-sm">
                                {formatRecordValue(server.records)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="servers">
          <div className="space-y-4">
            {serverStatuses.map((status) => (
              <div
                key={status.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <div className="font-medium">{status.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {status.address}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {status.status === 'success' && (
                    <CheckCircle2 className="text-green-500 h-5 w-5" />
                  )}
                  {status.status === 'error' && (
                    <AlertCircle className="text-red-500 h-5 w-5" />
                  )}
                  {status.status === 'querying' && (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

export default function DNSLookup() {
  const [domains, setDomains] = useState<Domain[]>([{ id: '1', value: '' }]);
  const [serverStatuses, setServerStatuses] = useState<ServerStatus[]>([]);
  const [results, setResults] = useState<DNSResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortController = useRef<AbortController>();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(dnsLookupSchema),
    defaultValues: {
      domains: [{ id: '1', value: '' }],
      servers: ['google'],
      includeAllRecords: true,
      customServer: ''
    }
  });

  const addDomain = useCallback(() => {
    setDomains(prev => [...prev, { id: Date.now().toString(), value: '' }]);
  }, []);

  const removeDomain = useCallback((id: string) => {
    setDomains(prev => prev.filter(domain => domain.id !== id));
  }, []);

  const handleExport = useCallback((format: 'json' | 'csv') => {
    if (!results.length) return;

    const data = format === 'json' 
      ? JSON.stringify(results, null, 2)
      : convertToCSV(results);

    const blob = new Blob([data], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dns_lookup_results.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [results]);

  const cancelQueries = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
      setIsLoading(false);
      toast({
        title: "Queries Cancelled",
        description: "All DNS queries have been cancelled.",
      });
    }
  }, [toast]);

  async function onSubmit(data: z.infer<typeof dnsLookupSchema>) {
    setIsLoading(true);
    setResults([]);
    abortController.current = new AbortController();

    try {
      const cleanDomains = data.domains
        .map(d => d.value.trim())
        .filter(Boolean)
        .map(domain => domain.replace(/^(https?:\/\/)?(www\.)?/, ''));

      if (!cleanDomains.length) {
        throw new Error("Please enter a domain");
      }

      const selectedServers = data.servers.map(serverId => {
        const server = DNS_SERVERS.find(s => s.id === serverId);
        return server?.address;
      }).filter(Boolean) as string[];

      const servers = [...selectedServers];
      if (data.customServer?.trim()) {
        const customServer = data.customServer.trim();
        if (!servers.includes(customServer)) {
          servers.push(customServer);
        }
      }

      if (!servers.length) {
        throw new Error("Please select a DNS server");
      }

      const serverStatuses = servers.map(server => ({
        id: server,
        name: DNS_SERVERS.find(s => s.address === server)?.name || 'Custom Server',
        address: server,
        status: 'querying' as const,
        attempt: 0
      }));
      setServerStatuses(serverStatuses);

      const queries = cleanDomains.map(async domain => {
        try {
          const response = await fetch('/api/dns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domain,
              servers,
              includeAllRecords: true
            }),
            signal: abortController.current?.signal
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `DNS lookup failed for ${domain}`);
          }

          const result = await response.json();
          
          setServerStatuses(prev => 
            prev.map(status => ({
              ...status,
              status: 'success' as const
            }))
          );

          return result;
        } catch (error: any) {
          if (error.name === 'AbortError') return null;
          
          setServerStatuses(prev =>
            prev.map(status => ({
              ...status,
              status: 'error' as const,
              error: error.message
            }))
          );
          
          throw error;
        }
      });

      const results = await Promise.all(queries);
      setResults(results.filter(Boolean));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "DNS lookup failed"
      });
    } finally {
      setIsLoading(false);
      abortController.current = undefined;
    }
  }

  const updateServerStatus = useCallback((serverId: string, status: ServerStatus['status'], error?: string) => {
    setServerStatuses(prev => prev.map(server => 
      server.id === serverId 
        ? { 
            ...server, 
            status,
            error,
            attempt: status === 'retrying' ? server.attempt + 1 : server.attempt 
          }
        : server
    ));
  }, []);

  const convertToCSV = useCallback((results: DNSResult[]) => {
    const headers = ['Domain', 'Record Type', 'Server', 'Result', 'Query Time'];
    const rows = results.flatMap(result => 
      Object.entries(result.results).flatMap(([recordType, servers]) =>
        servers.map(server => [
          result.domain,
          recordType,
          server.server,
          Array.isArray(server.records) ? server.records.join(';') : JSON.stringify(server.records),
          server.queryTime
        ])
      )
    );
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }, []);

  return (
    <div className="space-y-6">
      <motion.div
        className="text-center space-y-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          DNS Lookup Tool
        </h2>
        <p className="text-muted-foreground text-lg">
          Query multiple DNS servers and record types simultaneously
        </p>
      </motion.div>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {domains.map((domain, index) => (
                <div key={domain.id} className="flex gap-2">
                  <FormField
                    control={form.control}
                    name={`domains.${index}`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            placeholder="example.com"
                            value={domain.value}
                            onChange={e => {
                              const newValue = e.target.value;
                              field.onChange({ id: domain.id, value: newValue });
                              setDomains(prev => prev.map(d => 
                                d.id === domain.id ? { ...d, value: newValue } : d
                              ));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {domains.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeDomain(domain.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDomain}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Domain
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="servers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNS Servers</FormLabel>
                    <div className="space-y-2">
                      {DNS_SERVERS.map(server => (
                        <div key={server.id} className="flex items-center space-x-2">
                          <Checkbox
                            checked={field.value.includes(server.id)}
                            onCheckedChange={(checked) => {
                              const value = checked
                                ? [...field.value, server.id]
                                : field.value.filter((id: string) => id !== server.id);
                              field.onChange(value);
                            }}
                          />
                          <span>{server.name} ({server.address})</span>
                        </div>
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customServer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom DNS Server</FormLabel>
                    <FormControl>
                      <Input placeholder="8.8.4.4" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional: Enter a custom DNS server IP
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Querying DNS...
                  </>
                ) : (
                  'Lookup'
                )}
              </Button>
              {isLoading && (
                <Button type="button" variant="outline" onClick={cancelQueries}>
                  Cancel
                </Button>
              )}
              {results.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleExport('json')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleExport('csv')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </>
              )}
            </div>
          </form>
        </Form>

        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              className="mt-6 space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {results.map((result, index) => (
                <ResultCard
                  key={`${result.domain}-${index}`}
                  result={result}
                  serverStatuses={serverStatuses}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
