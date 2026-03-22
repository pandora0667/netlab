import fs from "node:fs/promises";
import path from "node:path";

const siteUrl = (process.env.VITE_SITE_URL || "https://netlab.tools").replace(/\/+$/, "");
const indexNowKey = process.env.INDEXNOW_KEY?.trim();

if (!indexNowKey) {
  console.error("INDEXNOW_KEY is required.");
  process.exit(1);
}

const sitemapPath = path.resolve(process.cwd(), "client/public/sitemap.xml");
const sitemapXml = await fs.readFile(sitemapPath, "utf-8");
const urls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

if (urls.length === 0) {
  console.error("No URLs found in sitemap.xml.");
  process.exit(1);
}

const payload = {
  host: new URL(siteUrl).hostname,
  key: indexNowKey,
  keyLocation: `${siteUrl}/indexnow-key.txt`,
  urlList: urls,
};

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: {
    "Content-Type": "application/json; charset=utf-8",
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const body = await response.text();
  console.error(`IndexNow submission failed: ${response.status} ${body}`);
  process.exit(1);
}

console.log(`IndexNow submission succeeded for ${urls.length} URL(s).`);
