import type { Express } from 'express';
import {
  APPROVED_CATEGORY_SEO_ROUTES,
  SANAT_PISH_CANONICAL_ORIGIN,
  getCategorySeoRouteSlug,
  getInternalCategorySlugFromRouteSlug,
  LEGACY_CATEGORY_ROUTE_GROUPS,
} from '../src/data/categorySeoRoutes';

const siteOrigin = () => (process.env.PUBLIC_SITE_URL || SANAT_PISH_CANONICAL_ORIGIN).replace(/\/+$/, '');

/** Register crawlable canonical category URLs, permanent legacy redirects and the category sitemap. */
export const registerCategorySeoRoutes = (app: Express): void => {
  app.get('/category/:slug', (req, res, next) => {
    const slug = String(req.params.slug || '');
    const internalSlug = getInternalCategorySlugFromRouteSlug(slug);
    if (internalSlug) {
      const canonicalSlug = getCategorySeoRouteSlug(internalSlug);
      if (slug === canonicalSlug) return next();
      const queryIndex = req.originalUrl.indexOf('?');
      const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
      return res.redirect(301, '/category/' + encodeURIComponent(canonicalSlug) + query);
    }

    if (Object.prototype.hasOwnProperty.call(LEGACY_CATEGORY_ROUTE_GROUPS, slug)) {
      const group = LEGACY_CATEGORY_ROUTE_GROUPS[slug];
      return res.redirect(301, group ? '/categories?group=' + encodeURIComponent(group) : '/categories');
    }
    return next();
  });

  app.get('/sitemap.xml', (_req, res) => {
    const origin = siteOrigin();
    const staticPaths = ['/', '/products', '/categories', '/about', '/services', '/contact', '/industries', '/knowledge'];
    const categoryPaths = APPROVED_CATEGORY_SEO_ROUTES.map(route => '/category/' + encodeURIComponent(route.routeSlug));
    const urls = [...staticPaths, ...categoryPaths].map(path => '<url><loc>' + origin + path + '</loc></url>').join('');
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
