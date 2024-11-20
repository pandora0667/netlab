import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from 'cors';
import dnsPropagationRouter, { setupWebSocket } from './routes/dns-propagation.route.js';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  // Register API routes
  registerRoutes(app);
  app.use('/api/dns-propagation', dnsPropagationRouter);

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    const status = 500;
    const message = err.message || "Something went wrong";

    res.status(status).json({ message });
    throw err;
  });

  // Set up WebSocket server
  setupWebSocket(server);

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
    console.log(`[${formattedTime}] Server running at http://localhost:${PORT}`);
  });
})();
