import type {EnhancedCategory} from '../data/categories';
import type {HomePreviewProduct} from '../utils/homeCatalogPreview';

/** Single-flight, first-paint GET requests. Start before importing the heavy App bundle. */
let categoriesPending:Promise<EnhancedCategory[]>|undefined;
let productsPending:Promise<HomePreviewProduct[]>|undefined;

async function requestArray<T>(url:string,key:'categories'|'products'):Promise<T[]> {
 const response=await fetch(url,{credentials:'same-origin'});
 if(!response.ok)return [];
 const result=await response.json();
 return result?.success && Array.isArray(result[key]) ? result[key] as T[] : [];
}
export function homeCategories():Promise<EnhancedCategory[]> {
 return categoriesPending ??= requestArray<EnhancedCategory>('/api/catalog/home-categories','categories')
  .catch(()=>{categoriesPending=undefined;return [];});
}
export function homeProducts():Promise<HomePreviewProduct[]> {
 return productsPending ??= requestArray<HomePreviewProduct>('/api/catalog/home-preview','products')
  .catch(()=>{productsPending=undefined;return [];});
}
/** The homepage is the only consumer; do not add these requests to admin/FORZA routes. */
export function prefetchHomeFirstPaint():void {
 void homeCategories();
 void homeProducts();
}
