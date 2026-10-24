/**
 * Product image URL resolver.
 * The authoritative catalogue is in PostgreSQL and original image binaries
 * are served from the persistent /data/storage/products/catalog Volume.
 * Direct links to the old image repository are normalized to local paths.
 */
export const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/javanweb/imagesatlas/main';
export const JSDELIVR_CDN_BASE = 'https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@main';
export const TOTAL_OFFICIAL_IMAGES_COUNT=869;
export const PERSISTENT_CATALOG_IMAGE_BASE='/storage/products/catalog';
export const LEGACY_IMAGE_BASE='/storage/products/legacy-jpg/images';

export function normalizeImageFileName(imageName?:string|null):string {
 if(!imageName)return '';
 const value=imageName.trim();
 const match=value.match(/(?:e\(?|at-e)?(\d+)\)?(?:\.(png|jpe?g|webp|svg))?/i);
 if(!match)return '';
 const n=Number(match[1]);
 return Number.isInteger(n)&&n>=1&&n<=869?`e(${n}).png`:'';
}
export function isVerifiedCatalogueImage(imageName?:string|null):boolean {
 return Boolean(normalizeImageFileName(imageName));
}
function legacyImageFile(input:string):string {
 try {
  const url=new URL(input);
  if(url.protocol!=='https:')return '';
  const raw=url.hostname==='raw.githubusercontent.com' && url.pathname.startsWith('/javanweb/IMAGE/main/images/')
    ?url.pathname.slice('/javanweb/IMAGE/main/images/'.length)
    :url.hostname==='raw.githubusercontent.com' && url.pathname.startsWith('/javanweb/IMAGE/5e8fadaef9f16d0ed03dae3462b60cae4c2a50e6/images/')
      ?url.pathname.slice('/javanweb/IMAGE/5e8fadaef9f16d0ed03dae3462b60cae4c2a50e6/images/'.length)
      :'';
  const decoded=decodeURIComponent(raw);
  const match=/^e\\(([1-9]\\d{0,3})\\)\\.jpg$/.exec(decoded);
  if(match&&Number(match[1])>=131&&Number(match[1])<=856&&Number(match[1])!==695)return decoded;
 }catch{}
 return '';
}
function oldGithubOfficialFile(input:string):string {
 try{
  const url=new URL(input);
  const repoPath='/javanweb/imagesatlas/main/';
  const jsDelivrPath='/gh/javanweb/imagesatlas@main/';
  const github=url.protocol==='https:'&&url.hostname==='raw.githubusercontent.com'&&url.pathname.startsWith(repoPath);
  const jsdelivr=url.protocol==='https:'&&url.hostname==='cdn.jsdelivr.net'&&url.pathname.startsWith(jsDelivrPath);
  if(!github&&!jsdelivr)return '';
  const pathname=decodeURIComponent(url.pathname);
  const raw=pathname.slice((github?repoPath:jsDelivrPath).length);
  return /^e\([1-9]\d{0,3}\)\.png$/.test(raw)?normalizeImageFileName(raw):'';
 }catch{return '';}
}
export function getProductImageUrl(imageName?:string|null):string {
 if(!imageName)return '';
 const input=imageName.trim();
 // Server-uploaded images are also on the same persistent mounted Volume.
 if(/^\/storage\/products\/[a-f0-9-]{36}\.webp$/.test(input))return input;
 // The separately imported 725 IMAGE JPEGs keep their original filenames.
 // Never silently turn e(131).jpg into an unrelated e(131).png.
 const legacy=/^\\/storage\\/products\\/legacy-jpg\\/images\\/(e\\(([1-9]\\d{0,3})\\)\\.jpg)$/.exec(input);
 if(legacy&&Number(legacy[2])>=131&&Number(legacy[2])<=856&&Number(legacy[2])!==695)return input;
 const historicalJpeg=legacyImageFile(input);
 if(historicalJpeg)return LEGACY_IMAGE_BASE+'/'+historicalJpeg;
 const local=/^\/storage\/products\/catalog\/(e\([1-9]\d{0,3}\)\.png)$/.exec(input);
 if(local)return normalizeImageFileName(local[1])?input:'';
 // Normalize historical GitHub links; they must not reach the browser once migrated.
 const historical=oldGithubOfficialFile(input);
 if(historical)return `${PERSISTENT_CATALOG_IMAGE_BASE}/${historical}`;
 if(/^(https?:|data:|blob:)/i.test(input))return input;
 const file=normalizeImageFileName(input);
 return file?`${PERSISTENT_CATALOG_IMAGE_BASE}/${file}`:'';
}
export default getProductImageUrl;
