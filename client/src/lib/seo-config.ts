import {
  buildStructuredData,
  DEFAULT_OG_IMAGE_PATH,
  getSEOPageByPath,
  normalizeSiteUrl,
  resolveSEOEntry,
  resolveSeoUrl as resolveAbsoluteSeoUrl,
  seoPages,
  SITE_NAME,
  type SEOPageKey,
} from "../../../shared/seo/metadata";

export type { SEOPageKey };

const envSiteUrl =
  typeof import.meta !== "undefined" ? import.meta.env.VITE_SITE_URL : undefined;

export const siteUrl = normalizeSiteUrl(envSiteUrl);

export const pageSEOData = seoPages;

export const defaultSEO = resolveSEOEntry("home", siteUrl);

export const resolveSeoUrl = (path = "/") => resolveAbsoluteSeoUrl(siteUrl, path);

export const resolveSEOForPage = (page: SEOPageKey) =>
  resolveSEOEntry(page, siteUrl);

export const resolveSEOForPath = (pathname: string) =>
  resolveSEOEntry(getSEOPageByPath(pathname), siteUrl);

export const buildStructuredDataJson = (page: SEOPageKey) =>
  JSON.stringify(buildStructuredData(resolveSEOEntry(page, siteUrl)));

export const defaultOgImagePath = DEFAULT_OG_IMAGE_PATH;
export const siteName = SITE_NAME;
