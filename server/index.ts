import { createServer } from "http";
import { attachWebSocketHandlers, createApp, registerErrorHandler } from "./app.js";
import { setupVite, serveStatic } from "./vite";
import logger from "./lib/logger";
import { runtimeConfig } from "./config/runtime.js";

const app = createApp({ includeErrorHandler: false });
const server = createServer(app);
const webSocketServer = attachWebSocketHandlers(server);

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info("Shutdown signal received", {
    signal,
  });

  const forceExitTimer = setTimeout(() => {
    logger.error("Forced shutdown after timeout", {
      signal,
      timeoutMs: 10_000,
    });
    process.exit(1);
  }, 10_000);

  forceExitTimer.unref();

  webSocketServer.close(() => {
    logger.info("WebSocket server closed", {
      signal,
    });
  });

  server.close((error) => {
    clearTimeout(forceExitTimer);

    if (error) {
      logger.error("Failed to close server gracefully", {
        signal,
        error: error.message,
      });
      process.exit(1);
      return;
    }

    logger.info("HTTP server closed", {
      signal,
    });
    process.exit(0);
  });
}

async function startServer() {
  logger.info("Server starting", {
    env: app.get("env"),
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  registerErrorHandler(app);

  const port = runtimeConfig.server.port;
  server.listen(port, "0.0.0.0", () => {
    logger.info("Server listening", {
      port,
      env: app.get("env"),
    });
  });
}

startServer().catch((error) => {
  logger.error("Failed to start server", {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
