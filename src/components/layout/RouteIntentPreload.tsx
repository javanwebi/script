import { useEffect } from 'react';

/**
 * Warm only on deliberate navigation intent; idle storefront browsing does not
 * eagerly download AI, product detail, cart or category chunks.
 */
const warmForza=()=>Promise.all([
  import('../../pages/AiForzaPage'),
  import('../forza/AiForzaCallExperience'),
  import('../forza/ParticleAvatar'),
]);
const loaders: Record<string, () => Promise<unknown>> = {
  '/ai-forza': warmForza,
  '/face-to-face': warmForza,
  '/ai-consult': () => import('../../pages/AiConsultPage'),
  '/identify-part': () => import('../search/AiVisualPartSearchModal'),
  '/products': () => import('../../pages/ProductsPage'),
  '/categories': () => import('../../pages/AllCategoriesPage'),
  '/cart': () => import('../../pages/CartPage'),
  '/checkout': () => import('../../pages/CheckoutPage'),
  '/industry-ceramic': () => import('../../pages/TileCeramicIndustryPage'),
  '/product/:code': () => import('../../pages/ProductDetailPage'),
  '/category/:slug': () => import('../../pages/CategoryPage'),
  '/direct-product/:code': () => import('../../pages/DirectSkuDetailPage'),
};

export function resolvePreloadKey(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (loaders[path]) return path;
  if (path.startsWith('/product/') || /^\/(?:account|consumer-dashboard)\/product\/[^/]+/.test(path))
    return '/product/:code';
  if (path.startsWith('/direct-product/')) return '/direct-product/:code';
  if (['/category/ceramic-tiles', '/industries/ceramic', '/industries/tile-ceramic', '/industry/ceramic-tile'].includes(path))
    return '/industry-ceramic';
  if (path.startsWith('/category/')) return '/category/:slug';
  return null;
}

const pending = new Map<string, Promise<unknown>>();
export function RouteIntentPreload() {
  useEffect(() => {
    const warm = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!anchor) return;
      let url: URL;
      try {
        url = new URL(anchor.getAttribute('href') || '', window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const key = resolvePreloadKey(url.pathname);
      if (!key || pending.has(key)) return;
      const load = loaders[key];
      const task = load().catch(() => {
        // Permit retry on the next intentional navigation if a chunk failed.
        pending.delete(key);
      });
      pending.set(key, task);
    };

    document.addEventListener('pointerover', warm, { passive: true });
    document.addEventListener('focusin', warm);
    document.addEventListener('touchstart', warm, { passive: true });
    return () => {
      document.removeEventListener('pointerover', warm);
      document.removeEventListener('focusin', warm);
      document.removeEventListener('touchstart', warm);
    };
  }, []);
  return null;
}
