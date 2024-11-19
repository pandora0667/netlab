import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Globe, MapPin, Wifi, Clock, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface IPInfo {
  ip: string;
  city: string;
  country: string;
  region: string;
  isp: string;
  timezone: string;
  message?: string;
}

export default function IPChecker() {
  const { data, error, isLoading, mutate } = useSWR<IPInfo>("/api/ip", {
    revalidateOnFocus: false,
    refreshInterval: 0,
    dedupingInterval: 10000,
    errorRetryInterval: 5000,
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      if (retryCount >= 3) return;
      setTimeout(() => revalidate({ retryCount }), 5000);
    },
    fallbackData: {
      ip: "Loading...",
      city: "",
      country: "",
      region: "",
      isp: "",
      timezone: ""
    }
  });

  const handleRetry = () => {
    mutate();
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>Failed to load IP information.</AlertDescription>
        </Alert>
        <Button onClick={handleRetry} className="w-full">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4">
      <motion.div
        className="text-center space-y-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          IP Address Checker
        </h2>
        <p className="text-muted-foreground text-lg">
          Check your current IP address and location information
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-8">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Your IP Address
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-semibold">
                      {data?.ip || "N/A"}
                    </span>
                  </div>
                  {data?.message && (
                    <div className="text-red-500 text-sm">
                      {data.message}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRetry}
                  className="hover:rotate-180 transition-transform duration-500"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-primary">
                    <MapPin className="w-5 h-5" />
                    <span className="font-medium">Location</span>
                  </div>
                  <div className="text-lg">
                    {data?.city && data?.country
                      ? `${data.city}, ${data.country}`
                      : "N/A"}
                  </div>
                </div>

                <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-primary">
                    <Wifi className="w-5 h-5" />
                    <span className="font-medium">ISP</span>
                  </div>
                  <div className="text-lg">{data?.isp || "N/A"}</div>
                </div>

                <div className="space-y-2 p-4 rounded-lg bg-muted/50 md:col-span-2">
                  <div className="flex items-center gap-2 text-primary">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Timezone</span>
                  </div>
                  <div className="text-lg">{data?.timezone || "N/A"}</div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
