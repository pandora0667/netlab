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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { lookupWhois } from "@/domains/network/api";
import type { WhoisLookupResult } from "@/domains/network/types";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Database, FileSearch } from "lucide-react";

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
    <>
      <SEO page="whoisLookup" />
      <ToolPageShell
        title="WHOIS"
        description="Inspect registration and contact metadata for a domain or IP address."
      >
        <div className="tool-grid">
          <section className="tool-surface space-y-6">
            <div className="space-y-3">
              <span className="tool-kicker">
                <Database className="h-3.5 w-3.5" />
                Registration context
              </span>
              <div className="space-y-2">
                <p className="tool-heading">Pull the raw ownership and registrar record for a domain or IP.</p>
                <p className="tool-copy">
                  WHOIS is best when you need the unfiltered response: registrar,
                  name servers, status codes, and registration timestamps in one place.
                </p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domain or IP address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="example.com or 8.8.8.8"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Looking up..." : "Run WHOIS"}
                  </Button>
                  <div className="tool-kicker">Examples: openai.com, 1.1.1.1</div>
                </div>
              </form>
            </Form>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {results ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-white/56" />
                  <p className="tool-eyebrow">Raw WHOIS response</p>
                </div>
                <ScrollArea className="h-[min(28rem,52vh)] rounded-[1.2rem] border border-white/8 bg-black/20 p-3 sm:p-4">
                  <div className="font-mono text-xs leading-relaxed text-white/78 sm:text-sm">
                    {formatWhoisData(results.data)}
                  </div>
                </ScrollArea>
              </div>
            ) : null}
          </section>

          <aside className="tool-surface space-y-4">
            <div className="space-y-2">
              <p className="tool-eyebrow">When to use it</p>
              <p className="tool-heading">Treat WHOIS as source material, not a polished summary.</p>
            </div>
            <div className="space-y-3 text-sm text-white/66">
              <div className="tool-surface-muted">
                Use it to confirm registrar, status locks, and delegation history.
              </div>
              <div className="tool-surface-muted">
                Expect raw formatting and registry-specific differences across TLDs.
              </div>
              <div className="tool-surface-muted">
                Pair it with DNS Lookup when you need record state plus registration context.
              </div>
            </div>
          </aside>
        </div>
      </ToolPageShell>
    </>
  );
}
