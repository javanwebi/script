import type { Express } from 'express';
import {
  APPROVED_CATEGORY_SEO_ROUTES,
  SANAT_PISH_CANONICAL_ORIGIN,
  getCategorySeoRouteSlug,
  getInternalCategorySlugFromRouteSlug,
  LEGACY_CATEGORY_ROUTE_GROUPS,
} from '../src/data/categorySeoRoutes';

const siteOrigin = () => SANAT_PISH_CANONICAL_ORIGIN;

const INDUSTRY_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  'ceramic-tile': 'ceramic',
  'tile-ceramic': 'ceramic',
  'ceramic-tiles': 'ceramic',
  'textile-machinery': 'textile',
  'packaging-carton': 'packaging',
  'food-beverage': 'food',
  'machinery-equipment': 'machinery',
  'rubber-plastics': 'rubber',
};

const querySuffix = (originalUrl: string): string => {
  const queryIndex = originalUrl.indexOf('?');
  return queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';
};

const appendQuerySuffix = (destination: string, originalUrl: string): string => {
  const suffix = querySuffix(originalUrl);
  if (!suffix) return destination;
  return destination + (destination.includes('?') ? '&' : '?') + suffix.slice(1);
};

/** Register crawlable canonical category URLs, permanent legacy redirects and the category sitemap. */
export const registerCategorySeoRoutes = (app: Express): void => {
  app.get('/category/:slug', (req, res, next) => {
    const slug = String(req.params.slug || '');
    const industryTarget = INDUSTRY_ROUTE_ALIASES[slug];
    if (industryTarget) return res.redirect(301, '/industries/' + industryTarget + querySuffix(req.originalUrl));
    const internalSlug = getInternalCategorySlugFromRouteSlug(slug);
    if (internalSlug) {
      const canonicalSlug = getCategorySeoRouteSlug(internalSlug);
      if (slug === canonicalSlug) return next();
      return res.redirect(301, '/category/' + encodeURIComponent(canonicalSlug) + querySuffix(req.originalUrl));
    }

    if (Object.prototype.hasOwnProperty.call(LEGACY_CATEGORY_ROUTE_GROUPS, slug)) {
      const group = LEGACY_CATEGORY_ROUTE_GROUPS[slug];
      const destination = group ? '/categories?group=' + encodeURIComponent(group) : '/categories';
      return res.redirect(301, appendQuerySuffix(destination, req.originalUrl));
    }
    return next();
  });

  app.get(['/industry/:slug', '/industries/:slug'], (req, res, next) => {
    const slug = String(req.params.slug || '');
    const canonicalSlug = INDUSTRY_ROUTE_ALIASES[slug] || slug;
    const isLegacySingularPath = req.path.startsWith('/industry/');
    if (canonicalSlug !== slug || isLegacySingularPath) {
      return res.redirect(301, '/industries/' + encodeURIComponent(canonicalSlug) + querySuffix(req.originalUrl));
    }
    return next();
  });

  app.get('/sitemap.xml', (_req, res) => {
    const origin = siteOrigin();
    const staticPaths = ['/', '/products', '/categories', '/about', '/services', '/contact', '/industries', '/brands', '/knowledge', '/ai-forza'];
    const industryPaths = ['ceramic', 'textile', 'packaging', 'food', 'machinery', 'rubber'].map(slug => '/industries/' + slug);
    const articlePaths = ['identify-belt', 'part-photo', 'custom-part', 'maintenance'].map(slug => '/knowledge/' + slug);
    const categoryPaths = APPROVED_CATEGORY_SEO_ROUTES.map(route => '/category/' + encodeURIComponent(route.routeSlug));
    const urls = [...staticPaths, ...industryPaths, ...articlePaths, ...categoryPaths].map(path => '<url><loc>' + origin + path + '</loc></url>').join('');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>');
  });

  app.get('/robots.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send('User-agent: *\nAllow: /\nSitemap: ' + siteOrigin() + '/sitemap.xml\n');
  });
};
