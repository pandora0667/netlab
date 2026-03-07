import { useWebSocket } from "@/lib/websocket/useWebSocket";
import {
  WebSocketDomain,
  type WebSocketMessage,
} from "@/lib/websocket/types";
import type { PingFormData } from "./schema";
import type {
  PingAttemptResult,
  PingSocketCompleteEvent,
  PingSocketResultEvent,
  PingStatistics,
  PingType,
} from "./model";

interface RawPingSocketResult {
  host?: string;
  type?: PingType;
  success?: boolean;
  latency?: number | null;
  error?: string;
  attempt?: number;
  sequence?: number;
  totalSequences?: number;
  elapsedTime?: number;
  statistics?: Partial<PingStatistics>;
}

interface RawPingSocketComplete {
  host?: string;
  type?: PingType;
  totalTime?: number;
  statistics?: Partial<PingStatistics>;
  cancelled?: boolean;
}

interface RawPingSocketError {
  message?: string;
}

function normalizePingStatistics(
  statistics?: Partial<PingStatistics>,
): PingStatistics {
  return {
    sent: statistics?.sent ?? 0,
    received: statistics?.received ?? 0,
    lost: statistics?.lost ?? 0,
    successRate: statistics?.successRate ?? 0,
    minLatency: statistics?.minLatency ?? 0,
    maxLatency: statistics?.maxLatency ?? 0,
    avgLatency: statistics?.avgLatency ?? 0,
  };
}

function normalizePingAttempt(data: RawPingSocketResult): PingAttemptResult {
  return {
    success: Boolean(data.success),
    latency: data.latency,
    error: data.error,
    attempt: typeof data.attempt === "number"
      ? data.attempt
      : (data.sequence ?? 0) + 1,
  };
}

function normalizePingResultEvent(
  message: WebSocketMessage<RawPingSocketResult>,
): PingSocketResultEvent {
  const data = message.data || {};

  return {
    host: data.host || "",
    type: data.type || "icmp",
    result: normalizePingAttempt(data),
    statistics: normalizePingStatistics(data.statistics),
    totalSequences: data.totalSequences ?? 1,
    elapsedTime: data.elapsedTime ?? 0,
  };
}

function normalizePingCompleteEvent(
  message: WebSocketMessage<RawPingSocketComplete>,
): PingSocketCompleteEvent {
  const data = message.data || {};

  return {
    host: data.host || "",
    type: data.type || "icmp",
    totalTime: data.totalTime ?? 0,
    statistics: normalizePingStatistics(data.statistics),
    cancelled: Boolean(data.cancelled),
  };
}

export interface UsePingSocketOptions {
  onResult?: (event: PingSocketResultEvent) => void;
  onComplete?: (event: PingSocketCompleteEvent) => void;
  onRequestError?: (message: string) => void;
  onConnectionError?: (error: Event) => void;
}

export function usePingSocket(options: UsePingSocketOptions = {}) {
  const socket = useWebSocket({
    domain: WebSocketDomain.PING,
    onMessage: (message) => {
      if (message.type === "pingResult") {
        options.onResult?.(normalizePingResultEvent(message));
        return;
      }

      if (message.type === "pingComplete") {
        options.onComplete?.(normalizePingCompleteEvent(message));
        return;
      }

      if (message.type === "error") {
        const data = (message as WebSocketMessage<RawPingSocketError>).data;
        options.onRequestError?.(data?.message || "Ping request failed");
      }
    },
    onError: options.onConnectionError,
  });

  const startPing = (data: PingFormData) => socket.sendMessage({
    type: "startPing",
    data: {
      ...data,
      port: data.type === "tcp" ? data.port : undefined,
    },
  });

  return {
    ...socket,
    startPing,
  };
}
