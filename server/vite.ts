import express, { type Application, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import type { ViteDevServer } from "vite";
import {
  buildStructuredData,
  getSEOPageByPath,
  hasKnownSEOPagePath,
  normalizeSiteUrl,
  resolveSEOEntry,
} from "../shared/seo/metadata.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";

const getRequestSiteUrl = (req: Request) => {
  const configuredSiteUrl = normalizeSiteUrl(process.env.VITE_SITE_URL);
  const forwardedProtoHeader = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;
  const protocol = forwardedProto || req.protocol || "https";
  const host = req.get("host");

  if (!host) {
    return configuredSiteUrl;
  }

  try {
    const configuredUrl = new URL(configuredSiteUrl);
    if (configuredUrl.host === host) {
      return configuredSiteUrl;
    }
  } catch {
    // fall back to the request-derived origin below
  }

  return normalizeSiteUrl(`${protocol}://${host}`);
};

const escapeHtmlAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const renderSeoTemplate = (template: string, req: Request) => {
  const pathname = (() => {
    try {
      return new URL(req.originalUrl || req.url || "/", "http://localhost").pathname;
    } catch {
      return req.path;
    }
  })();
  const pageKey = getSEOPageByPath(pathname);
  const seo = resolveSEOEntry(pageKey, getRequestSiteUrl(req));
  const robotsValue = seo.noIndex
    ? "noindex,nofollow,noarchive"
    : "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1";
  const schema = JSON.stringify(buildStructuredData(seo)).replaceAll(
    "<",
    "\\u003c",
  );

  return template
    .replaceAll("__SEO_TITLE__", escapeHtmlAttribute(seo.title))
    .replaceAll("__SEO_DESCRIPTION__", escapeHtmlAttribute(seo.description))
    .replaceAll("__SEO_CANONICAL__", escapeHtmlAttribute(seo.canonicalUrl))
    .replaceAll("__SEO_OG_IMAGE__", escapeHtmlAttribute(seo.ogImageUrl))
    .replaceAll("__SEO_OG_IMAGE_TYPE__", "image/jpeg")
    .replaceAll("__SEO_IMAGE_ALT__", escapeHtmlAttribute(seo.imageAlt))
    .replaceAll("__SEO_ROBOTS__", robotsValue)
    .replaceAll("__SEO_OG_TYPE__", "website")
    .replaceAll("__SEO_SCHEMA__", schema);
};

export async function setupVite(app: Application, server: Server): Promise<ViteDevServer> {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      hmr: { server },
    },
    clearScreen: false,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      template = await vite.transformIndexHtml(url, template);
      template = renderSeoTemplate(template, req);
      const pathname = new URL(req.originalUrl || req.url || "/", "http://localhost")
        .pathname;
      const statusCode = hasKnownSEOPagePath(pathname) ? 200 : 404;
      (res as any).status(statusCode).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  return vite;
}

export function serveStatic(app: Application) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath, { index: false }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req: Request, res: Response) => {
    fs.promises
      .readFile(path.resolve(distPath, "index.html"), "utf-8")
      .then((template) => {
        const pathname = (() => {
          try {
            return new URL(req.originalUrl || req.url || "/", "http://localhost")
              .pathname;
          } catch {
            return req.path;
          }
        })();
        const statusCode = hasKnownSEOPagePath(pathname) ? 200 : 404;
        res
          .status(statusCode)
          .set({ "Content-Type": "text/html" })
          .send(renderSeoTemplate(template, req));
      })
      .catch((error) => {
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to load index.html",
        });
      });
  });
}
