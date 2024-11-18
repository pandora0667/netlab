import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { ServerStatus } from "./DNSLookup";

const DNS_SERVERS = [
  { id: "google", name: "Google DNS", address: "8.8.8.8" },
  { id: "cloudflare", name: "Cloudflare", address: "1.1.1.1" },
  { id: "opendns", name: "OpenDNS", address: "208.67.222.222" },
];

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

interface ResultCardProps {
  result: DNSResult;
  serverStatuses: ServerStatus[];
}

function ServerStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "querying":
      return <Loader2 className="animate-spin" />;
    case "error":
      return <XCircle className="text-destructive" />;
    case "success":
      return <CheckCircle2 className="text-success" />;
    case "retrying":
      return <RefreshCw className="animate-spin text-warning" />;
    default:
      return <AlertCircle className="text-muted-foreground" />;
  }
}

function formatRecordValue(records: string[] | object): string {
  if (Array.isArray(records)) {
    return records.join('\n');
  }
  return JSON.stringify(records, null, 2);
}

function getRecordCount(records: string[] | object): number {
  if (Array.isArray(records)) {
    return records.length;
  }
  return Object.keys(records).length;
}

export function ResultCard({ result, serverStatuses }: ResultCardProps) {
  return (
    <Card className="p-4">
      <div className="mb-4 text-lg font-semibold">
        Domain: {result.domain}
      </div>
      
      <Tabs defaultValue="records" className="w-full">
        <TabsList>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          <Accordion type="single" collapsible className="space-y-2">
            {Object.entries(result.results).map(([recordType, servers]) => (
              <AccordionItem key={recordType} value={recordType}>
                <AccordionTrigger className="text-lg font-medium">
                  {recordType} Records ({servers.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {servers.map((server, idx) => (
                      <div key={`${server.server}-${idx}`} 
                           className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {DNS_SERVERS.find(s => s.address === server.server)?.name || server.server}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({server.queryTime}ms)
                            </span>
                          </div>
                        </div>
                        {getRecordCount(server.records) > 0 ? (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <pre className="font-mono text-sm whitespace-pre-wrap">
                              {formatRecordValue(server.records)}
                            </pre>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No records found
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="servers">
          <div className="space-y-4">
            {serverStatuses.map((status) => (
              <div key={status.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium">{status.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {status.address}
                    </div>
                  </div>
                  <ServerStatusIcon status={status.status} />
                </div>
                {status.status === 'success' && (
                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium">Found Records:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(result.results).map(([recordType, servers]) => {
                        const serverResult = servers.find(s => s.server === status.address);
                        if (!serverResult) return null;
                        
                        return (
                          <div key={recordType} 
                               className="bg-muted/50 p-2 rounded-md">
                            <div className="text-sm font-medium mb-1">
                              {recordType}
                            </div>
                            <div className="text-sm">
                              {getRecordCount(serverResult.records)} records
                              {serverResult.queryTime && 
                                ` (${serverResult.queryTime}ms)`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
