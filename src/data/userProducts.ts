import { enrichProductTechnicalData } from './productTechnicalData';
import { groupProductFamilies } from './productFamilies';
import type { Product } from '../types';

// Never import inventory JSON into a browser or server runtime.
// The PostgreSQL-backed /api/runtime hydrates these stable references.
export const USER_PRODUCTS_RAW: Product[] = [];
export const USER_PRODUCTS: Product[] = [];
export const PRODUCT_FAMILY_ALIASES = new Map<string,string>();
export const USER_PRODUCTS_BY_CODE = new Map<string, Product>();
export const USER_PRODUCTS_BY_CATEGORY = new Map<string, Product[]>();
export let CATALOGUE_SKU_COUNT = 0;
const searchIndex = new Map<string,string>();

export function categorySlugFor(name:string):string {
  return name.trim().replace(/[\\s\\u200c]+/g, '-');
}
export const normalizeCatalogueText = (value:string) => value.toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک')
  .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\\u200c/g,' ').replace(/\\s+/g,' ').trim();

/** Called only with PostgreSQL products (or explicitly injected isolated test fixtures). */
export function installCatalogProducts(products:Product[], options:{rawFixture?:boolean}={}) {
  USER_PRODUCTS_RAW.splice(0,USER_PRODUCTS_RAW.length,...products);
  const grouped=options.rawFixture?groupProductFamilies(products).map(enrichProductTechnicalData):products;
  USER_PRODUCTS.splice(0,USER_PRODUCTS.length,...grouped);
  PRODUCT_FAMILY_ALIASES.clear();
  USER_PRODUCTS_BY_CODE.clear();
  USER_PRODUCTS_BY_CATEGORY.clear();
  searchIndex.clear();
  const familyBySku=new Map(grouped.flatMap(p=>(p.variants||[]).map(v=>[v.code,p.code] as const)));
  for(const raw of products)PRODUCT_FAMILY_ALIASES.set(raw.code.toLowerCase(),familyBySku.get(raw.variants?.[0]?.code||'')||raw.code);
  for(const product of grouped){
    USER_PRODUCTS_BY_CODE.set(product.code.toLowerCase(),product);
    for(const variant of product.variants||[])USER_PRODUCTS_BY_CODE.set(variant.code.toLowerCase(),product);
    const categories=USER_PRODUCTS_BY_CATEGORY.get(product.categorySlug)||[];
    categories.push(product);
    USER_PRODUCTS_BY_CATEGORY.set(product.categorySlug,categories);
    searchIndex.set(product.code,normalizeCatalogueText([
      product.name,product.code,product.brand,product.categoryName,product.submenu,product.subcategory,
      ...(product.technicalSpecs||[]).map(s=>s.value),
      ...(product.variants||[]).flatMap(v=>[v.code,v.size,v.name,v.model,
        ...(v.technicalSpecs||[]).map(s=>s.value),...(v.technicalReview?.categoryPath||[])]),
    ].join(' ')));
  }
  for(const [alias,canonical] of PRODUCT_FAMILY_ALIASES){
    const product=USER_PRODUCTS_BY_CODE.get(canonical.toLowerCase());
    if(product)USER_PRODUCTS_BY_CODE.set(alias,product);
  }
  CATALOGUE_SKU_COUNT=products.reduce((sum,p)=>sum+(p.variants?.length||0),0);
}

export function matchesProductSearch(product:Product,query:string){
 const terms=normalizeCatalogueText(query).split(' ').filter(Boolean);
 const haystack=searchIndex.get(product.code)||normalizeCatalogueText([
   product.name,product.code,product.brand,product.categoryName,product.submenu,product.subcategory,
   ...(product.technicalSpecs||[]).map(s=>s.value),
   ...(product.variants||[]).flatMap(v=>[v.code,v.size,v.name,v.model,...(v.technicalSpecs||[]).map(s=>s.value)])
 ].join(' '));
 return terms.every(term=>haystack.includes(term));
}
