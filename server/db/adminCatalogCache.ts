import {readProducts} from './repository';
import {compactCatalogReviews} from '../../src/utils/catalogPrivacy';

type CacheEntry={value:unknown[];refreshedAt:number;stale:boolean};
let cache:CacheEntry|null=null;
let inFlight:Promise<unknown[]>|null=null;
let generation=0;
let lastRefreshAttemptAt=0;
const REVALIDATE_AFTER_MS=30_000;
const RETRY_GUARD_MS=1_000;

function refreshAdminCatalog():Promise<unknown[]>{
 if(inFlight)return inFlight;
 const startedGeneration=generation;
 lastRefreshAttemptAt=Date.now();
 const request=readProducts({includeTechnicalReviews:false}).then(products=>{
  const value=compactCatalog(products);
  if(startedGeneration===generation)
   cache={value,refreshedAt:Date.now(),stale:false};
  return value;
 }).finally(()=>{if(inFlight===request)inFlight=null;});
 inFlight=request;
 return request;
}

/** Reuse the full catalogue already read by server startup; no second DB scan on first admin visit. */
function compactCatalog(products:unknown):unknown[]{
 return Array.isArray(products)?compactCatalogReviews(products) as unknown[]:[];
}

export function primeAdminCatalogCache(products:unknown){
 generation++;
 cache={value:compactCatalog(products),refreshedAt:Date.now(),stale:false};
 inFlight=null;
}

/** Keep the last usable snapshot while a background refresh obtains newer DB values. */
export function invalidateAdminCatalogCache(){
 generation++;
 inFlight=null;
 if(cache)cache={...cache,stale:true};
 if(cache && Date.now()-lastRefreshAttemptAt>=RETRY_GUARD_MS)
  void refreshAdminCatalog().catch(error=>console.warn('[Admin catalog] Background refresh failed; retaining last snapshot.',error));
}

export async function getAdminCatalogProducts():Promise<unknown[]>{
 if(cache){
  if((cache.stale || Date.now()-cache.refreshedAt>=REVALIDATE_AFTER_MS)
    && Date.now()-lastRefreshAttemptAt>=RETRY_GUARD_MS)
   void refreshAdminCatalog().catch(error=>console.warn('[Admin catalog] Background refresh failed; retaining last snapshot.',error));
  return cache.value;
 }
 return refreshAdminCatalog();
}

/** Small read-only inspection surface for regression tests and health diagnostics. */
export function inspectAdminCatalogCache(){
 return cache?{familyCount:cache.value.length,refreshedAt:cache.refreshedAt,stale:cache.stale}:null;
}
