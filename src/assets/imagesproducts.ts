/**
 * Product image URLs come from sanatpishatlas PostgreSQL.
 * The official 869 PNGs are served straight from immutable jsDelivr CDN
 * URLs for the verified GitHub source commit, not the Railway server volume.
 * New admin images have unique, commit-pinned CDN URLs in the database.
 */
export const GITHUB_RAW_BASE='https://raw.githubusercontent.com/javanweb/imagesatlas/main';
export const IMAGE_REPO_COMMIT='5bbaec971a05771939663d47803b5d5c2c624c6d';
export const JSDELIVR_CDN_BASE=`https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@${IMAGE_REPO_COMMIT}`;
export const TOTAL_OFFICIAL_IMAGES_COUNT=869;
// This constant is retained for compatibility. It is now a CDN prefix.
export const PERSISTENT_CATALOG_IMAGE_BASE=JSDELIVR_CDN_BASE;

export function normalizeImageFileName(imageName?:string|null):string{
 if(!imageName)return '';
 const value=imageName.trim();
 const match=value.match(/(?:e\(?|at-e)?(\d+)\)?(?:\.(png|jpe?g|webp|svg))?/i);
 if(!match)return '';
 const n=Number(match[1]);
 return Number.isInteger(n)&&n>=1&&n<=869?`e(${n}).png`:'';
}
export function isVerifiedCatalogueImage(imageName?:string|null):boolean{
 return Boolean(normalizeImageFileName(imageName));
}
function legacyOfficialName(input:string):string {
 const local=/^\/storage\/products\/catalog\/(e\([1-9]\d{0,3}\)\.png)$/.exec(input);
 if(local)return normalizeImageFileName(local[1]);
 if(/^e\([1-9]\d{0,3}\)\.png$/.test(input))return normalizeImageFileName(input);
 try{
  const u=new URL(input);
  if(u.protocol!=='https:'||u.username||u.password)return '';
  const raw=decodeURIComponent(u.pathname);
  const allowed=(u.hostname==='raw.githubusercontent.com'&&/^\/javanweb\/imagesatlas\/(?:main|[a-f0-9]{40})\//.test(raw))
    ||(u.hostname==='cdn.jsdelivr.net'&&/^\/gh\/javanweb\/imagesatlas@(?:main|[a-f0-9]{40})\//.test(raw));
  if(!allowed)return '';
  const filename=raw.split('/').pop()||'';
  if(!/^e\([1-9]\d{0,3}\)\.png$/.test(filename))return '';
  // Only the exact original root photo is canonicalized. Future storage/products
  // paths are versioned and must keep their own unique CDN URL.
  if(!/^\/(?:javanweb\/imagesatlas\/(?:main|[a-f0-9]{40})|gh\/javanweb\/imagesatlas@(?:main|[a-f0-9]{40}))\/e\([1-9]\d{0,3}\)\.png$/.test(raw))return '';
  return normalizeImageFileName(filename);
 }catch{return '';}
}
export function getProductImageUrl(imageName?:string|null):string{
 if(!imageName)return '';
 const input=imageName.trim();
 const official=legacyOfficialName(input);
 if(official)return `${JSDELIVR_CDN_BASE}/${official}`;
 // Legacy uploads must remain reachable until their binary migration is verified.
 if(/^\/storage\/products\/[a-f0-9-]{36}\.webp$/.test(input))return input;
 // All other database URLs (including commit-pinned admin uploads) are kept.
 if(/^https:\/\//i.test(input))return input;
 if(/^(?:data:|blob:)/i.test(input))return input;
 return '';
}
export default getProductImageUrl;
