import { Helmet } from 'react-helmet-async';
import { defaultSEO, pageSEOData, type SEOData } from '../lib/seo-config';

interface SEOProps {
  page?: keyof typeof pageSEOData;
}

export function SEO({ page }: SEOProps) {
  const seo: SEOData = page ? pageSEOData[page] : defaultSEO;
  const baseUrl = 'https://netlab.wisoft.io'; // Update with actual production domain

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
      <meta property="og:image" content={`${baseUrl}${seo.ogImage}`} />
      <meta property="og:url" content={`${baseUrl}${seo.canonical}`} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={`${baseUrl}${seo.ogImage}`} />
      
      {/* Canonical URL */}
      {seo.canonical && <link rel="canonical" href={`${baseUrl}${seo.canonical}`} />}
      
      {/* Additional Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="language" content="English" />
    </Helmet>
  );
}
