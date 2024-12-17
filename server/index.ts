import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { parse as parseUrl } from 'url';
import dnsPropagationRouter, { handleDNSWebSocket } from './routes/dns-propagation.route.js';
import pingRouter, { handlePingWebSocket } from './routes/ping.route.js';
import { apiLimiter } from './middleware/rateLimit';
import { requestLogger } from './middleware/logging';
import logger from './lib/logger';

const app = express();
const server = createServer(app);

// Trust proxy configuration
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(requestLogger);  
app.use('/api', apiLimiter);  

// Create a single WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Handle upgrade requests
server.on('upgrade', (request, socket, head) => {
  const { pathname } = parseUrl(request.url || '');
  
  if (pathname === '/ws/dns-propagation') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      console.log('DNS WebSocket connection upgraded');
      handleDNSWebSocket(ws, request);
    });
  } else if (pathname === '/ws/ping') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      console.log('Ping WebSocket connection upgraded');
      handlePingWebSocket(ws, request);
    });
  } else {
    socket.destroy();
  }
});

(async () => {
  // Register API routes
  registerRoutes(app);
  app.use('/api/dns-propagation', dnsPropagationRouter);
  app.use('/api/ping', pingRouter);

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    const status = 500;
    const message = err.message || "Something went wrong";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite or serve static files
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start server
  const PORT = 8080;
  server.listen(PORT, "0.0.0.0", () => {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    console.log(`[${formattedTime}] Server is running on port ${PORT}`);
  });
})();
