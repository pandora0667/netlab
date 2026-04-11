import {
  getStructuredDataFeatureList,
  sitePageCatalog,
  sitePageKeys,
  type SitePageKey,
} from "../catalog/site-catalog.js";

export type SEOPageKey = SitePageKey;

export interface SEOPageDefinition {
  key: SEOPageKey;
  path: string;
  title: string;
  description: string;
  imageAlt: string;
  changeFrequency: "weekly" | "monthly";
  priority: string;
  noIndex?: boolean;
}

export interface ResolvedSEOEntry extends SEOPageDefinition {
  siteRootUrl: string;
  canonicalUrl: string;
  ogImageUrl: string;
  breadcrumbName: string;
}

const DEFAULT_SITE_URL = "https://netlab.tools";
export const DEFAULT_OG_IMAGE_PATH = "/og-image.jpg";
export const SITE_NAME = "Netlab";

function trimTrailingSlashes(value: string) {
  let end = value.length;

  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }

  return value.slice(0, end);
}

export const normalizeSiteUrl = (value?: string) =>
  trimTrailingSlashes(value || DEFAULT_SITE_URL);

export const resolveSeoUrl = (siteUrl: string, path = "/") =>
  new URL(path, `${normalizeSiteUrl(siteUrl)}/`).toString();

export const seoPages = Object.fromEntries(
  sitePageKeys.map((key) => {
    const page = sitePageCatalog[key];
    return [
      key,
      {
        key,
        path: page.path,
        title: page.title,
        description: page.description,
        imageAlt: page.imageAlt,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        ...("noIndex" in page ? { noIndex: page.noIndex } : {}),
      } satisfies SEOPageDefinition,
    ];
  }),
) as Record<SEOPageKey, SEOPageDefinition>;

const seoPageKeys = sitePageKeys;

export const hasKnownSEOPagePath = (pathname: string) => {
  const normalizedPath = trimTrailingSlashes(pathname) || "/";
  return seoPageKeys.some(
    (key) => key !== "notFound" && seoPages[key].path === normalizedPath,
  );
};

export const getSEOPageByPath = (pathname: string) => {
  const normalizedPath = trimTrailingSlashes(pathname) || "/";
  return (
    seoPageKeys.find(
      (key) => key !== "notFound" && seoPages[key].path === normalizedPath,
    ) ?? "notFound"
  );
};

export const resolveSEOEntry = (
  pageKey: SEOPageKey,
  siteUrl: string,
): ResolvedSEOEntry => {
  const page = seoPages[pageKey];
  const siteRootUrl = resolveSeoUrl(siteUrl, "/");
  return {
    ...page,
    siteRootUrl,
    canonicalUrl: resolveSeoUrl(siteUrl, page.path),
    ogImageUrl: resolveSeoUrl(siteUrl, DEFAULT_OG_IMAGE_PATH),
    breadcrumbName: page.key === "home" ? SITE_NAME : page.title.split(" | ")[0],
  };
};

export const buildStructuredData = (entry: ResolvedSEOEntry) => {
  const websiteNode: Record<string, unknown> = {
    "@type": "WebSite",
    "@id": `${entry.siteRootUrl}#website`,
    url: entry.siteRootUrl,
    name: SITE_NAME,
    description: seoPages.home.description,
    inLanguage: "en",
  };

  const graph: Array<Record<string, unknown>> = entry.key === "home"
    ? [
        websiteNode,
        {
          "@type": "WebApplication",
          "@id": `${entry.canonicalUrl}#app`,
          name: SITE_NAME,
          url: entry.canonicalUrl,
          applicationCategory: "NetworkingApplication",
          operatingSystem: "Any",
          browserRequirements: "Requires JavaScript",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          featureList: [
            ...getStructuredDataFeatureList(),
          ],
        },
      ]
    : [
        websiteNode,
        {
          "@type": "WebPage",
          "@id": `${entry.canonicalUrl}#webpage`,
          url: entry.canonicalUrl,
          name: entry.title,
          description: entry.description,
          isPartOf: {
            "@id": `${entry.siteRootUrl}#website`,
          },
          inLanguage: "en",
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${entry.canonicalUrl}#breadcrumb`,
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: SITE_NAME,
              item: entry.siteRootUrl,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: entry.breadcrumbName,
              item: entry.canonicalUrl,
            },
          ],
        },
      ];

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
};
