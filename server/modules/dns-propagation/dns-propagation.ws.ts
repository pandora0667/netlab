import { type IncomingMessage } from "http";
import { WebSocket } from "ws";
import logger from "../../lib/logger.js";
import { dnsPropagationService } from "./dns-propagation.registry.js";

export function handleDnsPropagationWebSocket(
  ws: WebSocket,
  req: IncomingMessage,
) {
  logger.info("DNS propagation WebSocket connected", {
    ip: req.socket.remoteAddress,
  });

  const subscribedRequests = new Set<string>();

  const sendSocketMessage = (type: string, data: unknown) => {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      ws.send(JSON.stringify({ type, data }));
    } catch (error) {
      logger.error("Failed to send DNS propagation WebSocket message", {
        type,
        error: error instanceof Error ? error.message : error,
      });
      ws.close(1011, "Failed to send result");
    }
  };

  const cleanupQueryResult = dnsPropagationService.onQueryResult((result) => {
    if (subscribedRequests.has(result.requestId)) {
      sendSocketMessage("queryResult", result);
    }
  });

  const cleanupQueryProgress = dnsPropagationService.onQueryProgress((progress) => {
    if (subscribedRequests.has(progress.requestId)) {
      sendSocketMessage("queryProgress", progress);
    }
  });

  const cleanupQueryComplete = dnsPropagationService.onQueryComplete((complete) => {
    if (subscribedRequests.has(complete.requestId)) {
      sendSocketMessage("queryComplete", complete);
    }
  });

  ws.on("message", (message) => {
    try {
      const { type, data } = JSON.parse(message.toString());

      if (type === "subscribe" && typeof data?.requestId === "string") {
        subscribedRequests.add(data.requestId);
        return;
      }

      if (type === "unsubscribe" && typeof data?.requestId === "string") {
        subscribedRequests.delete(data.requestId);
      }
    } catch (error) {
      logger.warn("Invalid DNS propagation WebSocket message", {
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  ws.on("close", (code, reason) => {
    cleanupQueryResult();
    cleanupQueryProgress();
    cleanupQueryComplete();
    subscribedRequests.clear();
    logger.info("DNS propagation WebSocket disconnected", {
      code,
      reason: reason?.toString(),
    });
  });

  ws.on("error", (error) => {
    logger.error("DNS propagation WebSocket error", {
      error: error instanceof Error ? error.message : error,
    });
    try {
      ws.close(1011, "Internal server error");
    } catch (closeError) {
      logger.error("Failed to close DNS propagation WebSocket", {
        error: closeError instanceof Error ? closeError.message : closeError,
      });
    }
  });
}
