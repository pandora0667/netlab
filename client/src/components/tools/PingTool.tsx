import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pingSchema } from "@/lib/validation";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PingResult {
  output: string;
}

export default function PingTool() {
  const [results, setResults] = useState<PingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(pingSchema),
    defaultValues: {
      host: ""
    }
  });

  async function onSubmit(data: { host: string }) {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error("Failed to ping host");
      }
      
      const result = await response.json();
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
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
              {isLoading ? "Pinging..." : "Ping"}
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
            <h3 className="font-medium mb-2">Ping Results:</h3>
            <ScrollArea className="h-[200px] rounded border p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {results.output}
              </pre>
            </ScrollArea>
          </div>
        )}
      </Card>
    </div>
  );
}
