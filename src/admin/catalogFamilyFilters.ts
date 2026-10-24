/** Shared, database-derived admin catalog hierarchy. Never invent family associations. */
import type {Product} from '../types';

const normalize=(value:unknown)=>String(value??'').replace(/ي/g,'ی').replace(/ك/g,'ک')
 .replace(/\u200c/g,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase();
const same=(a:unknown,b:unknown)=>normalize(a)===normalize(b);
const unique=(values:string[])=>Array.from(new Map(values.filter(v=>v.trim())
  .map(v=>[normalize(v),v.trim()])).values()).sort((a,b)=>a.localeCompare(b,'fa'));

export type FamilyHierarchyFilter={category:string;submenu:string;subcategory:string};
export function matchesFamilyHierarchy(product:Pick<Product,'categoryName'|'categorySlug'|'submenu'|'subcategory'>,filter:FamilyHierarchyFilter){
 if(filter.category!=='all' && !same(product.categoryName,filter.category) && !same(product.categorySlug,filter.category))return false;
 if(filter.submenu!=='all' && !same(product.submenu,filter.submenu))return false;
 if(filter.subcategory!=='all' && !same(product.subcategory,filter.subcategory))return false;
 return true;
}
export function catalogHierarchyOptions(products:Product[],filter:FamilyHierarchyFilter){
 const categories=unique(products.map(p=>p.categoryName||''));
 const withinCategory=products.filter(p=>matchesFamilyHierarchy(p,{...filter,submenu:'all',subcategory:'all'}));
 const submenus=unique(withinCategory.map(p=>p.submenu||''));
 const withinSubmenu=withinCategory.filter(p=>filter.submenu==='all'||same(p.submenu,filter.submenu));
 const subcategories=unique(withinSubmenu.map(p=>p.subcategory||''));
 return {categories,submenus,subcategories};
}
export function catalogFamilyCount(products:Product[],category:string){
 return products.filter(p=>matchesFamilyHierarchy(p,{category,submenu:'all',subcategory:'all'})).length;
}
