import type { Express } from "express";
import v1Routes from "./modules/v1.routes.js";
import legacyRoutes from "./modules/legacy.routes.js";

export function registerRoutes(app: Express) {
  app.use("/api/v1", v1Routes);
  app.use("/api", legacyRoutes);
}
