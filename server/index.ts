import { createServer } from "http";
import { attachWebSocketHandlers, createApp, registerErrorHandler } from "./app.js";
import { setupVite, serveStatic } from "./vite";
import logger from "./lib/logger";
import { runtimeConfig } from "./config/runtime.js";

const app = createApp({ includeErrorHandler: false });
const server = createServer(app);

attachWebSocketHandlers(server);

async function startServer() {
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
