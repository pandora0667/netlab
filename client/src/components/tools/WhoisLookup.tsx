import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { whoisSchema } from "@/domains/network/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { lookupWhois } from "@/domains/network/api";
import type { WhoisLookupResult } from "@/domains/network/types";

export default function WhoisLookup() {
  const [results, setResults] = useState<WhoisLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(whoisSchema),
    defaultValues: {
      domain: ""
    }
  });

  async function onSubmit(data: { domain: string }) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await lookupWhois(data.domain);
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  function formatWhoisData(data: string) {
    return data.split('\n').map((line, index) => {
      const [key, ...value] = line.split(':');
      if (value.length) {
        return (
          <div key={index} className="py-1">
            <span className="font-medium">{key}:</span>
            <span className="ml-2">{value.join(':').trim()}</span>
          </div>
        );
      }
      return <div key={index} className="py-1">{line}</div>;
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">WHOIS Lookup</h2>
        <p className="text-muted-foreground">
          Get registration information for domains and IP addresses
        </p>
      </div>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain or IP Address</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="example.com or IP address" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Looking up..." : "Lookup"}
            </Button>
          </form>
        </Form>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {results && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">WHOIS Information:</h3>
            <ScrollArea className="h-[400px] rounded border p-4">
              <div className="font-mono text-sm">
                {formatWhoisData(results.data)}
              </div>
            </ScrollArea>
          </div>
        )}
      </Card>
    </div>
  );
}
