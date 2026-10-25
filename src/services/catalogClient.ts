import type { Product } from '../types';
import { resolveCategorySlug } from '../data/categories';
import { installDatabaseProducts } from '../data/mockGenerator';

type PageResponse = { success: boolean; products: Product[]; total: number };
type DetailResponse = { success: boolean; product: Product };
let previewAllowed = false;

/** Feature-gated migration path: the existing /api/runtime remains authoritative by default. */
export function wantsCatalogV2Preview(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('catalogV2') === '1')
      window.sessionStorage.setItem('sanat-catalog-v2-preview', '1');
    return window.sessionStorage.getItem('sanat-catalog-v2-preview') === '1';
  } catch { return false; }
}
export function setCatalogV2GuestReady(ready: boolean) { previewAllowed = ready; }
export function catalogV2GuestReady() { return previewAllowed && wantsCatalogV2Preview(); }

async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', signal });
  if (!response.ok) throw new Error('کاتالوگ در دسترس نیست.');
  const body = await response.json();
  if (!body.success) throw new Error('دریافت محصولات ناموفق بود.');
  return body as T;
}

/** Only 24 families (or one exact product) are hydrated in this opt-in public preview. */
export async function hydratePublicCatalogRoute(pathname: string, search: string, signal?: AbortSignal) {
  if (!catalogV2GuestReady()) return;
  const params = new URLSearchParams(search);
  const parts = pathname.split('/').filter(Boolean);
  let products: Product[];
  if (parts[0] === 'product' && parts[1]) {
    const result = await json<DetailResponse>('/api/catalog/products/' + encodeURIComponent(decodeURIComponent(parts[1])), signal);
    products = [result.product];
  } else {
    if (!['', 'products', 'search', 'category', 'categories'].includes(parts[0] || '')) return;
    const query = new URLSearchParams({ page: '1', limit: '24' });
    if (parts[0] === 'category' && parts[1]) query.set('category', resolveCategorySlug(decodeURIComponent(parts[1])));
    if (parts[0] === 'search' || parts[0] === 'products') {
      if (params.get('q')) query.set('q', params.get('q')!);
      if (params.get('category')) query.set('category', resolveCategorySlug(params.get('category')!));
    }
    if (params.get('sub')) query.set('sub', params.get('sub')!);
    const result = await json<PageResponse>('/api/catalog/products?' + query.toString(), signal);
    products = result.products;
  }
  if (!signal?.aborted) installDatabaseProducts(products);
}
