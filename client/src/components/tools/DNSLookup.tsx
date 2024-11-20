import { cn } from "@/lib/utils";
import { useState, useCallback, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dnsLookupSchema } from "@/lib/validation";
import {
  Form, FormControl, FormField, FormItem, FormLabel,
  FormMessage, FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import {
  Loader2, AlertCircle, CheckCircle2, XCircle,
  Download, Plus, Trash2, RefreshCw, Server
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Accordion, AccordionItem, AccordionTrigger, 
  AccordionContent 
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validateDNSServer } from "@/lib/dns-utils";

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
  const [activeTab, setActiveTab] = useState("overview");
  const recordTypes = Object.keys(result.results);
  
  const getRecordSummary = (records: any[]): string => {
    if (!records.length) return "No records";
    return `${records.length} record${records.length > 1 ? 's' : ''}`;
  };

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
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">
          <div className="flex items-center justify-between">
            <span>{result.domain}</span>
            <div className="flex gap-2">
              {serverStatuses.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center gap-1 text-sm text-muted-foreground"
                >
                  <Server className="h-4 w-4" />
                  <span>{status.name}</span>
                  {status.status === 'success' && (
                    <CheckCircle2 className="text-green-500 h-4 w-4" />
                  )}
                  {status.status === 'error' && (
                    <AlertCircle className="text-red-500 h-4 w-4" />
                  )}
                  {status.status === 'querying' && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Detailed Records</TabsTrigger>
            <TabsTrigger value="raw">Raw Data</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
              {recordTypes.map((type) => (
                <Card key={type} className="p-4">
                  <h3 className="font-medium mb-2">{type} Records</h3>
                  <p className="text-sm text-muted-foreground">
                    {getRecordSummary(result.results[type])}
                  </p>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="details">
            <Accordion type="single" collapsible className="w-full">
              {recordTypes.map((type) => (
                <AccordionItem key={type} value={type}>
                  <AccordionTrigger className="px-4">
                    <div className="flex items-center justify-between w-full">
                      <span>{type} Records</span>
                      <span className="text-sm text-muted-foreground">
                        {getRecordSummary(result.results[type])}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <div className="space-y-4">
                      {result.results[type].map((server, idx) => (
                        <div key={`${server.server}-${idx}`} 
                             className="border-l-2 pl-4 py-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Server className="h-4 w-4" />
                            <span>{server.server}</span>
                            <span>•</span>
                            <span>{server.queryTime}ms</span>
                          </div>
                          <div className="bg-muted/50 p-3 rounded-md">
                            {Array.isArray(server.records) ? (
                              <div className="space-y-1">
                                {server.records.map((record, recordIdx) => (
                                  <div key={recordIdx} 
                                       className="font-mono text-sm">
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
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="raw">
            <div className="p-4">
              <pre className="bg-muted/50 p-4 rounded-lg overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface DNSServerValidationStatus {
  address: string;
  isValidating: boolean;
  isValid: boolean;
  error?: string;
}

export default function DNSLookup() {
  const [serverStatuses, setServerStatuses] = useState<ServerStatus[]>([]);
  const [results, setResults] = useState<DNSResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customServerValidation, setCustomServerValidation] = useState<DNSServerValidationStatus>({
    address: '',
    isValidating: false,
    isValid: true,
  });
  const abortController = useRef<AbortController>();
  const validationTimeout = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof dnsLookupSchema>>({
    resolver: zodResolver(dnsLookupSchema),
    defaultValues: {
      domains: [{ id: '1', value: '' }],
      servers: ['google'],
      includeAllRecords: true,
      customServer: ''
    }
  });

  const { fields: domainFields, append: appendDomain, remove: removeDomain } = useFieldArray({
    control: form.control,
    name: "domains"
  });

  const addDomain = useCallback(() => {
    appendDomain({ id: Date.now().toString(), value: '' });
  }, [appendDomain]);

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

  // DNS server validation function
  const validateCustomServer = useCallback(async (serverIP: string) => {
    if (!serverIP) {
      setCustomServerValidation({
        address: '',
        isValidating: false,
        isValid: true,
      });
      return;
    }

    // Cancel previous validation timer if exists
    if (validationTimeout.current) {
      clearTimeout(validationTimeout.current);
    }

    // Start validation after 500ms of input
    validationTimeout.current = setTimeout(async () => {
      setCustomServerValidation(prev => ({
        ...prev,
        address: serverIP,
        isValidating: true,
      }));

      try {
        const result = await validateDNSServer(serverIP);
        
        setCustomServerValidation({
          address: serverIP,
          isValidating: false,
          isValid: result.isValid,
          error: result.error,
        });

        if (!result.isValid) {
          toast({
            title: "DNS Server Validation Failed",
            description: result.error,
            variant: "destructive",
          });
        } else if (result.error) {
          // If warning message exists
          toast({
            title: "DNS Server Warning",
            description: result.error,
            variant: "default",
          });
        }
      } catch (error) {
        setCustomServerValidation({
          address: serverIP,
          isValidating: false,
          isValid: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
        
        toast({
          title: "DNS Server Validation Error",
          description: "Failed to validate DNS server",
          variant: "destructive",
        });
      }
    }, 500);
  }, [toast]);

  // Validate before form submission
  const onSubmit = useCallback(async (data: z.infer<typeof dnsLookupSchema>) => {
    // If custom server exists and validation fails
    if (data.customServer && !customServerValidation.isValid) {
      toast({
        title: "Invalid Custom DNS Server",
        description: customServerValidation.error || "Please enter a valid DNS server address",
        variant: "destructive",
      });
      return;
    }

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
  }, [customServerValidation, toast]);

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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Domain Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Domains Input */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDomain}
                    disabled={domainFields.length >= 5}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Domain
                  </Button>
                </div>
                <AnimatePresence>
                  {domainFields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2"
                    >
                      <FormField
                        control={form.control}
                        name={`domains.${index}.value`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Enter domain (e.g., example.com)"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {domainFields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDomain(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* DNS Servers Selection */}
              <div className="space-y-2">
                <FormLabel>DNS Servers</FormLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {DNS_SERVERS.map((server) => (
                    <FormField
                      key={server.id}
                      control={form.control}
                      name="servers"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={field.value?.includes(server.id)}
                                onCheckedChange={(checked) => {
                                  const value = field.value || [];
                                  if (checked) {
                                    field.onChange([...value, server.id]);
                                  } else {
                                    field.onChange(
                                      value.filter((id) => id !== server.id)
                                    );
                                  }
                                }}
                              />
                              <div className="space-y-1">
                                <FormLabel>{server.name}</FormLabel>
                                <FormDescription>
                                  {server.address}
                                </FormDescription>
                              </div>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Custom DNS Server Input with Validation */}
              <FormField
                control={form.control}
                name="customServer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom DNS Server (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder="8.8.4.4"
                          onChange={(e) => {
                            field.onChange(e);
                            validateCustomServer(e.target.value);
                          }}
                          className={cn(
                            customServerValidation.isValidating && "pr-10",
                            !customServerValidation.isValid && "border-red-500",
                          )}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {customServerValidation.isValidating && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {!customServerValidation.isValidating && field.value && (
                            <>
                              {customServerValidation.isValid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </FormControl>
                    {customServerValidation.error && (
                      <FormMessage>
                        {customServerValidation.error}
                      </FormMessage>
                    )}
                    <FormDescription>
                      Enter a custom DNS server IP address (IPv4 or IPv6)
                    </FormDescription>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lookup DNS
              </Button>
              {isLoading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelQueries}
                >
                  Cancel
                </Button>
              )}
            </div>
            {results.length > 0 && (
              <div className="flex gap-2">
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
              </div>
            )}
          </div>
        </form>
      </Form>

      <AnimatePresence>
        {results.map((result, index) => (
          <motion.div
            key={`${result.domain}-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ResultCard
              result={result}
              serverStatuses={serverStatuses}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
