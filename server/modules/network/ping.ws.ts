import { type IncomingMessage } from "http";
import { WebSocket } from "ws";
import logger, { abuseLogger } from "../../lib/logger.js";
import { runtimeConfig } from "../../config/runtime.js";
import {
  NetworkInputError,
  normalizePingOptions,
} from "../../src/lib/network-validation.js";
import {
  ConcurrencyGate,
  ConcurrencyLimitError,
} from "../../src/lib/concurrency-gate.js";
import { PublicTargetError } from "../../src/lib/public-targets.js";
import { pingService, type PingResult } from "./ping.service.js";

const PING_RESULT_DELAY_MS = 1_000;

const pingGate = new ConcurrencyGate(
  "ping",
  runtimeConfig.limits.pingMaxConcurrentGlobal,
  runtimeConfig.limits.pingMaxConcurrentPerIp,
);

function readSocketMessageText(message: unknown) {
  if (typeof message === "string") {
    return message;
  }

  if (message instanceof Uint8Array) {
    return Buffer.from(message).toString();
  }

  if (Array.isArray(message)) {
    return Buffer.concat(message.map((chunk) => Buffer.from(chunk))).toString();
  }

  return null;
}

export function handlePingWebSocket(ws: WebSocket, req: IncomingMessage) {
  logger.info("Ping WebSocket connected", {
    ip: req.socket.remoteAddress,
  });

  let isExecutingPing = false;
  let isCancelled = false;

  const requesterIp = typeof req.headers["x-forwarded-for"] === "string"
    ? req.headers["x-forwarded-for"].split(/,\s*/)[0]
    : req.socket.remoteAddress || "unknown";

  ws.on("message", async (message) => {
    try {
      if (isExecutingPing) {
        ws.send(JSON.stringify({
          type: "error",
          data: { message: "Another ping operation is in progress" },
        }));
        return;
      }

      const rawMessage = readSocketMessageText(message);
      if (!rawMessage) {
        return;
      }

      const { type, data } = JSON.parse(rawMessage);
      if (type !== "startPing") {
        return;
      }

      let options: ReturnType<typeof normalizePingOptions> | null = null;

      try {
        options = normalizePingOptions(data);
      } catch (error) {
        const message = error instanceof NetworkInputError
          ? error.message
          : "Invalid ping request";

        if (error instanceof NetworkInputError) {
          abuseLogger.warn("Blocked invalid ping WebSocket request", {
            feature: "ping-ws",
            ip: requesterIp,
            host: typeof data?.host === "string" ? data.host : undefined,
            reason: error.message,
          });
        }

        ws.send(JSON.stringify({
          type: "error",
          data: { message },
        }));
        return;
      }

      if (!options) {
        return;
      }

      isExecutingPing = true;
      isCancelled = false;
      const startTime = Date.now();
      const allResults: PingResult[] = [];
      const pingCount = options.count ?? 1;
      let releasePing = () => {};

      try {
        releasePing = pingGate.acquire(requesterIp);

        for (let index = 0; index < pingCount; index += 1) {
          if (isCancelled) {
            break;
          }

          const results = await pingService.executePing({
            ...options,
            count: 1,
          });

          if (results.length === 0) {
            continue;
          }

          const pingResult = results[0];
          allResults.push(pingResult);

          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({
                type: "pingResult",
                data: {
                  ...pingResult,
                  host: options.host,
                  type: options.type,
                  statistics: pingService.calculateStatistics(allResults),
                  attempt: index + 1,
                  sequence: index,
                  totalSequences: pingCount,
                  elapsedTime: Date.now() - startTime,
                  latencyText: pingResult.success
                    ? `${pingResult.latency?.toFixed(2)}ms`
                    : "Failed",
                },
              }));
            } catch (sendError) {
              logger.error("Failed to send ping result", {
                error: sendError instanceof Error ? sendError.message : sendError,
              });
            }
          }

          if (index < pingCount - 1 && !isCancelled) {
            await new Promise((resolve) => setTimeout(resolve, PING_RESULT_DELAY_MS));
          }
        }
      } catch (error) {
        if (error instanceof PublicTargetError || error instanceof ConcurrencyLimitError) {
          abuseLogger.warn("Blocked or constrained ping WebSocket request", {
            feature: "ping-ws",
            ip: requesterIp,
            host: options.host,
            reason: error.message,
          });
        }

        logger.error("Ping execution failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "error",
            data: {
              message: error instanceof Error ? error.message : "Failed to execute ping",
              details: error instanceof Error ? error.message : "Unknown error",
            },
          }));
        }
      } finally {
        releasePing();
        isExecutingPing = false;

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "pingComplete",
            data: {
              host: options.host,
              type: options.type,
              totalTime: Date.now() - startTime,
              statistics: pingService.calculateStatistics(allResults),
              cancelled: isCancelled,
            },
          }));
        }
      }
    } catch (error) {
      logger.error("Failed to process ping message", {
        error: error instanceof Error ? error.message : error,
      });

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "error",
          data: {
            message: "Failed to process ping request",
            details: error instanceof Error ? error.message : "Unknown error",
          },
        }));
      }
    }
  });

  ws.on("error", (error) => {
    logger.error("Ping WebSocket error", {
      error: error instanceof Error ? error.message : error,
    });

    try {
      ws.close(1011, "Internal server error");
    } catch (closeError) {
      logger.error("Failed to close ping WebSocket", {
        error: closeError instanceof Error ? closeError.message : closeError,
      });
    }
  });

  ws.on("close", (code, reason) => {
    logger.info("Ping WebSocket disconnected", {
      code,
      reason: reason?.toString(),
    });
    isCancelled = true;
    isExecutingPing = false;
  });
}
