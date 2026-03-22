import { cn } from "@/lib/utils";
import { useState, useCallback, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dnsLookupSchema } from "@/domains/dns/schema";
import {
  Form, FormControl, FormField, FormItem, FormLabel,
  FormMessage, FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2, AlertCircle, CheckCircle2, XCircle,
  Download, Plus, Trash2, Server
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Accordion, AccordionItem, AccordionTrigger, 
  AccordionContent 
} from "@/components/ui/accordion";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { lookupDnsRecords, validateDnsServer } from "@/domains/dns/api";
import { DNS_RESOLVER_OPTIONS } from "@/domains/dns/constants";
import type { DNSLookupResult } from "@/domains/dns/types";

export type ServerStatus = {
  id: string;
  name: string;
  address: string;
  status: 'querying' | 'retrying' | 'success' | 'error' | 'idle';
  attempt: number;
  error?: string;
};

interface ResultCardProps {
  result: DNSLookupResult;
  serverStatuses: ServerStatus[];
}

function ResultCard({ result, serverStatuses }: ResultCardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  
  // Function to group results by record type
  const groupByRecordType = (results: DNSLookupResult["results"]) => {
    return results.reduce((acc, curr) => {
      if (!acc[curr.recordType]) {
        acc[curr.recordType] = [];
      }
      acc[curr.recordType].push(curr);
      return acc;
    }, {} as Record<string, typeof results>);
  };

  const groupedResults = groupByRecordType(result.results);
  const recordTypes = Object.keys(groupedResults);

  const getRecordSummary = (records: DNSLookupResult["results"][0][]): string => {
    let totalRecords = 0;
    records.forEach(server => {
      if (Array.isArray(server.records)) {
        totalRecords += server.records.length;
      }
    });
    
    if (totalRecords === 0) return "No records";
    return `${totalRecords} record${totalRecords > 1 ? 's' : ''}`;
  };

  const formatRecordValue = (record: any): string => {
    if (!record) return 'No data';
    if (typeof record === 'string') return record;
    if (Array.isArray(record)) return record.join(', ');
    
    // Special handling for different DNS record types
    if (typeof record === 'object') {
      // MX record
      if ('exchange' in record && 'priority' in record) {
        return `${record.exchange} (priority: ${record.priority})`;
      }
      // A, AAAA records
      if ('address' in record) return record.address;
      // TXT record
      if ('entries' in record && Array.isArray(record.entries)) {
        return record.entries.join(', ');
      }
      // CNAME, NS records
      if ('value' in record) return record.value;
      // Other records
      return JSON.stringify(record);
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
                    {getRecordSummary(groupedResults[type])}
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
                        {getRecordSummary(groupedResults[type])}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <div className="space-y-4">
                      {groupedResults[type].map((server, idx) => (
                        <div key={`${server.server}-${idx}`} 
                             className="border-l-2 pl-4 py-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Server className="h-4 w-4" />
                            <span>{server.server}</span>
                            <span>•</span>
                            <span>{server.queryTime}ms</span>
                            {server.error && (
                              <span className="text-red-500">• {server.error}</span>
                            )}
                          </div>
                          <div className="bg-muted/50 p-3 rounded-md space-y-2">
                            {Array.isArray(server.records) && server.records.length > 0 ? (
                              server.records.map((record, recordIdx) => (
                                <div key={recordIdx} className="font-mono text-sm">
                                  {formatRecordValue(record)}
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                {server.error || 'No records found'}
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
  const [results, setResults] = useState<DNSLookupResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customServerValidation, setCustomServerValidation] = useState<DNSServerValidationStatus>({
    address: '',
    isValidating: false,
    isValid: true,
  });
  const abortController = useRef<AbortController>();
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
  const customServer = form.watch("customServer");

  const addDomain = useCallback(() => {
    appendDomain({ id: Date.now().toString(), value: '' });
  }, [appendDomain]);

  const convertToCSV = useCallback((lookupResults: DNSLookupResult[]) => {
    const headers = ['Domain', 'Record Type', 'Server', 'Result', 'Query Time'];
    const rows = lookupResults.flatMap(result =>
      result.results.map(server => [
        result.domain,
        server.recordType,
        server.server,
        Array.isArray(server.records) ? server.records.join(';') : JSON.stringify(server.records),
        server.queryTime
      ])
    );
    return [headers, ...rows].map(row => row.join(',')).join('\n');
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
  }, [convertToCSV, results]);

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

  const applyCustomServerValidation = useCallback((
    serverIP: string,
    validation: { isValid: boolean; error?: string },
    isValidating = false,
  ) => {
    setCustomServerValidation({
      address: serverIP,
      isValidating,
      isValid: validation.isValid,
      error: validation.error,
    });
  }, []);

  const runCustomServerValidation = useCallback(async (serverIP: string) => {
    const trimmedServerIP = serverIP.trim();

    if (!trimmedServerIP) {
      applyCustomServerValidation("", { isValid: true });
      return { isValid: true };
    }

    const validation = await validateDnsServer(trimmedServerIP);
    applyCustomServerValidation(trimmedServerIP, validation);
    return validation;
  }, [applyCustomServerValidation]);

  useEffect(() => {
    const trimmedCustomServer = customServer?.trim() ?? "";

    if (!trimmedCustomServer) {
      applyCustomServerValidation("", { isValid: true });
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      applyCustomServerValidation(trimmedCustomServer, { isValid: true }, true);
      const validation = await validateDnsServer(trimmedCustomServer);
      applyCustomServerValidation(trimmedCustomServer, validation);
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [applyCustomServerValidation, customServer]);

  useEffect(() => {
    return () => {
      abortController.current?.abort();
    };
  }, []);

  // Validate before form submission
  const onSubmit = useCallback(async (data: z.infer<typeof dnsLookupSchema>) => {
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
        const server = DNS_RESOLVER_OPTIONS.find(s => s.id === serverId);
        return server?.address;
      }).filter(Boolean) as string[];

      const servers = [...selectedServers];
      const customServer = data.customServer?.trim() ?? "";

      if (customServer) {
        const validation = await runCustomServerValidation(customServer);
        if (!validation.isValid) {
          toast({
            title: "Invalid Custom DNS Server",
            description: validation.error || "Please enter a valid DNS server address",
            variant: "destructive",
          });
          return;
        }

        if (!servers.includes(customServer)) {
          servers.push(customServer);
        }
      }

      if (!servers.length) {
        throw new Error("Please select a DNS server");
      }

      const serverStatuses = servers.map(server => ({
        id: server,
        name: DNS_RESOLVER_OPTIONS.find(s => s.address === server)?.name || 'Custom Server',
        address: server,
        status: 'querying' as const,
        attempt: 0
      }));
      setServerStatuses(serverStatuses);

      const queries = cleanDomains.map(async domain => {
        try {
          const result = await lookupDnsRecords({
            domain,
            servers,
            includeAllRecords: data.includeAllRecords,
            signal: abortController.current?.signal,
          });

          const serverErrors = new Map<string, string | undefined>();
          result.results.forEach((record) => {
            if (record.error && !serverErrors.has(record.server)) {
              serverErrors.set(record.server, record.error);
            }

            if (!record.error) {
              serverErrors.set(record.server, undefined);
            }
          });

          setServerStatuses(prev =>
            prev.map((status) => ({
              ...status,
              status: serverErrors.get(status.address) ? 'error' : 'success',
              error: serverErrors.get(status.address),
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
      setResults(results.filter((result): result is DNSLookupResult => result !== null));
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
  }, [runCustomServerValidation, toast]);

  return (
    <>
      <SEO page="dnsLookup" />
      <ToolPageShell
        title="DNS Lookup"
        description="Query A, MX, TXT, and related records using public resolvers or a custom server."
      >
      <div className="space-y-4">
      <div className="tool-grid">
      <div className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="border-white/8 bg-white/[0.02]">
              <CardHeader>
                <CardTitle className="space-y-2">
                  <div className="tool-eyebrow">Query setup</div>
                  <div className="text-xl text-white">Target domains and resolvers</div>
                </CardTitle>
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
                  <>
                    {domainFields.map((field, index) => (
                      <div
                        key={field.id}
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
                      </div>
                    ))}
                  </>
                </div>

                {/* DNS Servers Selection */}
                <div className="space-y-2">
                  <FormLabel>DNS Servers</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {DNS_RESOLVER_OPTIONS.map((server) => (
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
                            }}
                            onBlur={(e) => {
                              field.onBlur();
                              void runCustomServerValidation(e.target.value);
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

            <div className="flex flex-wrap justify-between gap-3">
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

      </div>
      <aside className="tool-surface space-y-4">
        <div className="space-y-2">
          <p className="tool-eyebrow">Operator guidance</p>
          <p className="tool-heading">Use multiple public resolvers when you care about disagreement, not just raw answers.</p>
        </div>
        <div className="tool-inline-guidance text-sm text-white/66">
          <div className="tool-surface-muted">
            Add more than one resolver when you want to spot cache drift or resolver-specific failures.
          </div>
          <div className="tool-surface-muted">
            Use a custom server only when you need to inspect a known resolver directly.
          </div>
          <div className="tool-surface-muted">
            Enable all records when you need a broad registry view. Keep it narrower for faster routine checks.
          </div>
        </div>
      </aside>
      </div>
      <div className="space-y-4">
        {results.map((result, index) => (
          <div key={`${result.domain}-${index}`}>
            <ResultCard
              result={result}
              serverStatuses={serverStatuses}
            />
          </div>
        ))}
      </div>
      </div>
      </ToolPageShell>
    </>
  );
}
