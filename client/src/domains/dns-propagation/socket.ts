import { useCallback } from "react";
import { useWebSocket } from "@/lib/websocket/useWebSocket";
import {
  WebSocketDomain,
  type WebSocketMessage,
} from "@/lib/websocket/types";
import type {
  DNSPropagationCompleteEvent,
  DNSPropagationProgressEvent,
  DNSQueryResult,
  DNSServer,
} from "./model";

const UNKNOWN_DNS_SERVER: DNSServer = {
  country_code: "UN",
  name: "Unknown Server",
  ip_address: "0.0.0.0",
  reliability: 0,
  dnssec: false,
  is_working: false,
};

interface RawDnsQueryResult {
  requestId?: string;
  server?: Partial<DNSServer>;
  response?: string;
  latency?: number;
  status?: "success" | "error";
  error?: string;
  timestamp?: number;
}

interface RawDnsQueryProgress {
  requestId?: string;
  completedQueries?: number;
  totalQueries?: number;
  timestamp?: number;
}

interface RawDnsQueryComplete {
  requestId?: string;
  domain?: string;
  region?: string;
  totalQueries?: number;
  timestamp?: number;
}

interface RawDnsSocketError {
  message?: string;
}

function normalizeDnsServer(server?: Partial<DNSServer>): DNSServer {
  return {
    country_code: server?.country_code || UNKNOWN_DNS_SERVER.country_code,
    name: server?.name || UNKNOWN_DNS_SERVER.name,
    ip_address: server?.ip_address || UNKNOWN_DNS_SERVER.ip_address,
    reliability: server?.reliability ?? UNKNOWN_DNS_SERVER.reliability,
    dnssec: server?.dnssec ?? UNKNOWN_DNS_SERVER.dnssec,
    is_working: server?.is_working ?? UNKNOWN_DNS_SERVER.is_working,
  };
}

function normalizeDnsQueryResult(
  message: WebSocketMessage<RawDnsQueryResult>,
): DNSQueryResult {
  const data = message.data || {};

  return {
    requestId: data.requestId,
    server: normalizeDnsServer(data.server),
    response: data.response || "",
    latency: data.latency ?? 0,
    status: data.status || "error",
    error: data.error,
    timestamp: data.timestamp ?? Date.now(),
  };
}

function normalizeDnsProgressEvent(
  message: WebSocketMessage<RawDnsQueryProgress>,
): DNSPropagationProgressEvent {
  const data = message.data || {};
  const totalQueries = data.totalQueries ?? 0;
  const completedQueries = data.completedQueries ?? 0;

  return {
    requestId: data.requestId || "",
    completedQueries,
    totalQueries,
    timestamp: data.timestamp ?? Date.now(),
    progress: totalQueries > 0 ? (completedQueries / totalQueries) * 100 : 0,
  };
}

function normalizeDnsCompleteEvent(
  message: WebSocketMessage<RawDnsQueryComplete>,
): DNSPropagationCompleteEvent {
  const data = message.data || {};

  return {
    requestId: data.requestId || "",
    domain: data.domain || "",
    region: data.region || "All Regions",
    totalQueries: data.totalQueries ?? 0,
    timestamp: data.timestamp ?? Date.now(),
  };
}

export function createDnsPropagationRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export interface UseDnsPropagationSocketOptions {
  activeRequestId?: string | null;
  onResult?: (result: DNSQueryResult) => void;
  onProgress?: (event: DNSPropagationProgressEvent) => void;
  onComplete?: (event: DNSPropagationCompleteEvent) => void;
  onRequestError?: (message: string) => void;
  onConnectionError?: (error: Event) => void;
}

export function useDnsPropagationSocket(
  options: UseDnsPropagationSocketOptions = {},
) {
  const socket = useWebSocket({
    domain: WebSocketDomain.DNS_PROPAGATION,
    onMessage: (message) => {
      const messageRequestId =
        message.data && typeof message.data === "object" &&
        "requestId" in message.data &&
        typeof message.data.requestId === "string"
          ? message.data.requestId
          : undefined;

      if (
        options.activeRequestId &&
        messageRequestId &&
        messageRequestId !== options.activeRequestId
      ) {
        return;
      }

      if (message.type === "queryResult") {
        options.onResult?.(normalizeDnsQueryResult(message));
        return;
      }

      if (message.type === "queryProgress") {
        options.onProgress?.(normalizeDnsProgressEvent(message));
        return;
      }

      if (message.type === "queryComplete") {
        const completeEvent = normalizeDnsCompleteEvent(message);
        if (completeEvent.requestId) {
          unsubscribeFromRequest(completeEvent.requestId);
        }
        options.onComplete?.(completeEvent);
        return;
      }

      if (message.type === "error") {
        if (options.activeRequestId) {
          unsubscribeFromRequest(options.activeRequestId);
        }
        const data = (message as WebSocketMessage<RawDnsSocketError>).data;
        options.onRequestError?.(
          data?.message || "DNS propagation request failed",
        );
      }
    },
    onError: options.onConnectionError,
  });

  const subscribeToRequest = useCallback(
    (requestId: string) =>
      socket.sendMessage({
        type: "subscribe",
        data: { requestId },
      }),
    [socket],
  );

  const unsubscribeFromRequest = useCallback(
    (requestId: string) =>
      socket.sendMessage({
        type: "unsubscribe",
        data: { requestId },
      }),
    [socket],
  );

  return {
    ...socket,
    subscribeToRequest,
    unsubscribeFromRequest,
  };
}
