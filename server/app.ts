import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { type Server } from "http";
import cors from "cors";
import { WebSocketServer } from "ws";
import { registerRoutes } from "./routes.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/logging.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import { handleDnsPropagationWebSocket } from "./modules/dns-propagation/dns-propagation.ws.js";
import { handlePingWebSocket } from "./modules/network/ping.ws.js";
import logger from "./lib/logger.js";
import { runtimeConfig } from "./config/runtime.js";

interface CreateAppOptions {
  includeErrorHandler?: boolean;
}

export function registerErrorHandler(app: Express) {
  app.use(
    (err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error("Unhandled request error", {
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
      });

      if (res.headersSent) {
        return next(err);
      }

      return res.status(500).json({
        message: err.message || "Something went wrong",
        requestId: res.locals.requestId,
      });
    },
  );
}

export function createApp(options: CreateAppOptions = {}) {
  const { includeErrorHandler = true } = options;
  const app = express();

  app.set("trust proxy", runtimeConfig.server.trustProxy);
  app.use(cors());
  app.use(requestContextMiddleware);
  app.use(requestLogger);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.get("/indexnow-key.txt", (_req, res) => {
    if (!runtimeConfig.seo.indexNowKey) {
      res.status(404).end();
      return;
    }

    res.type("text/plain").send(runtimeConfig.seo.indexNowKey);
  });
  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      requestId: res.locals.requestId,
    });
  });
  app.get("/readyz", (_req, res) => {
    res.json({
      status: "ready",
      uptime: process.uptime(),
      env: app.get("env"),
      port: runtimeConfig.server.port,
      trustProxy: runtimeConfig.server.trustProxy,
      requestId: res.locals.requestId,
    });
  });
  app.use("/api", apiLimiter);

  registerRoutes(app);

  if (includeErrorHandler) {
    registerErrorHandler(app);
  }

  return app;
}

export function attachWebSocketHandlers(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = (() => {
      try {
        return new URL(request.url || "", "http://localhost").pathname;
      } catch {
        return "";
      }
    })();

    if (pathname === "/ws/dns-propagation") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        logger.debug("DNS propagation WebSocket upgraded", {
          ip: request.socket.remoteAddress,
        });
        handleDnsPropagationWebSocket(ws, request);
      });
      return;
    }

    if (pathname === "/ws/ping") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        logger.debug("Ping WebSocket upgraded", {
          ip: request.socket.remoteAddress,
        });
        handlePingWebSocket(ws, request);
      });
      return;
    }

    if (pathname?.startsWith("/ws/")) {
      socket.destroy();
    }
  });

  return wss;
}
