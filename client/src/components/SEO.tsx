import { useEffect } from "react";
import {
  buildStructuredDataJson,
  resolveSEOForPage,
  siteName,
  type SEOPageKey,
} from "../lib/seo-config";

interface SEOProps {
  page: SEOPageKey;
}

const upsertMetaByName = (name: string, content: string) => {
  const selector = `meta[name="${name}"]`;
  const element =
    document.head.querySelector<HTMLMetaElement>(selector) ??
    document.createElement("meta");

  if (!element.parentNode) {
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
};

const upsertMetaByProperty = (property: string, content: string) => {
  const selector = `meta[property="${property}"]`;
  const element =
    document.head.querySelector<HTMLMetaElement>(selector) ??
    document.createElement("meta");

  if (!element.parentNode) {
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
};

const upsertLink = (rel: string, href: string) => {
  const selector = `link[rel="${rel}"]`;
  const element =
    document.head.querySelector<HTMLLinkElement>(selector) ??
    document.createElement("link");

  if (!element.parentNode) {
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
};

const upsertJsonLd = (json: string) => {
  const selector = 'script[type="application/ld+json"][data-seo-schema="true"]';
  const element =
    document.head.querySelector<HTMLScriptElement>(selector) ??
    document.createElement("script");

  if (!element.parentNode) {
    element.setAttribute("type", "application/ld+json");
    element.setAttribute("data-seo-schema", "true");
    document.head.appendChild(element);
  }

  element.textContent = json;
};

export function SEO({ page }: SEOProps) {
  useEffect(() => {
    const seo = resolveSEOForPage(page);
    const structuredData = buildStructuredDataJson(page);
    const robotsValue = seo.noIndex
      ? "noindex,nofollow,noarchive"
      : "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1";

    document.title = seo.title;
    document.documentElement.lang = "en";

    upsertMetaByName("description", seo.description);
    upsertMetaByName("robots", robotsValue);
    upsertMetaByName("googlebot", robotsValue);
    upsertMetaByName("bingbot", robotsValue);
    upsertMetaByName("application-name", siteName);
    upsertMetaByName("apple-mobile-web-app-title", siteName);
    upsertMetaByName("theme-color", "#050505");
    upsertMetaByName("format-detection", "telephone=no");
    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:title", seo.title);
    upsertMetaByName("twitter:description", seo.description);
    upsertMetaByName("twitter:image", seo.ogImageUrl);
    upsertMetaByName("twitter:image:src", seo.ogImageUrl);
    upsertMetaByName("twitter:image:alt", seo.imageAlt);
    upsertMetaByProperty("og:type", "website");
    upsertMetaByProperty("og:site_name", siteName);
    upsertMetaByProperty("og:title", seo.title);
    upsertMetaByProperty("og:description", seo.description);
    upsertMetaByProperty("og:url", seo.canonicalUrl);
    upsertMetaByProperty("og:image", seo.ogImageUrl);
    upsertMetaByProperty("og:image:url", seo.ogImageUrl);
    upsertMetaByProperty("og:image:type", "image/jpeg");
    upsertMetaByProperty("og:image:alt", seo.imageAlt);
    upsertMetaByProperty("og:locale", "en_US");

    upsertLink("canonical", seo.canonicalUrl);
    upsertJsonLd(structuredData);
  }, [page]);

  return null;
}
