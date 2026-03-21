import { Helmet } from 'react-helmet-async';
import {
  defaultSEO,
  pageSEOData,
  resolveSeoUrl,
  siteUrl,
  type SEOData,
} from '../lib/seo-config';

interface SEOProps {
  page?: keyof typeof pageSEOData;
}

export function SEO({ page }: SEOProps) {
  const seo: SEOData = page ? pageSEOData[page] : defaultSEO;
  const canonicalPath = seo.canonical ?? defaultSEO.canonical ?? "/";
  const ogImagePath = seo.ogImage ?? defaultSEO.ogImage ?? "/og-image.jpg";
  const imageAlt = seo.imageAlt ?? defaultSEO.imageAlt ?? "Netlab preview";
  const canonicalUrl = resolveSeoUrl(canonicalPath);
  const ogImageUrl = resolveSeoUrl(ogImagePath);

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords.join(', ')} />
      
      {/* Open Graph */}
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={ogImageUrl} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Netlab" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={ogImageUrl} />
      <meta name="twitter:image:alt" content={imageAlt} />
      
      {/* Canonical URL */}
      {canonicalPath && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Additional Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="language" content="English" />
      <meta property="og:locale" content="en_US" />
      <meta name="application-name" content="Netlab" />
      <meta name="apple-mobile-web-app-title" content="Netlab" />
      <meta name="theme-color" content="#0f172a" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="twitter:domain" content={new URL(siteUrl).hostname} />
    </Helmet>
  );
}
