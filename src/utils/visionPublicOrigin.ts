/** Canonical storefront hosts override stale IP settings left by VPS migration. */
export function visionPublicOrigin(requestHost:string, configured:string, fallback:string):string{
 const host=requestHost.split(',')[0].trim().toLowerCase();
 if(host==='sanatpish.com'||host==='www.sanatpish.com')return 'https://'+host;
 for(const candidate of [configured,fallback]){
  try{const url=new URL(candidate);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)return url.origin;}catch{}
 }
 throw new Error('Invalid public image origin');
}
