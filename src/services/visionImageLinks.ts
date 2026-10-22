import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readdir,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
export type ImagePublisher=(buffer:Buffer,mimeType:string)=>Promise<string>;
const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
/** Opaque, temporary image links. A link changes transport size, not model image-token usage. */
export function createVisionImagePublisher(directory:string,publicOrigin:string):ImagePublisher {
 const origin=new URL(publicOrigin);
 const saved=new Map<string,Promise<string>>();
 return async(buffer,mimeType)=>{
  if(origin.protocol!=='https:')throw new Error('برای دسترسی ورکر به تصویر، APP_URL یا PUBLIC_APP_URL را با آدرس HTTPS عمومی سرور تنظیم کنید.');
  const extension=extensions[mimeType];if(!extension || !buffer.length || buffer.length>10*1024*1024)throw new Error('Invalid vision image');
  const key=createHash('sha256').update(mimeType).update(buffer).digest('hex');
  if(!saved.has(key))saved.set(key,(async()=>{
   await mkdir(directory,{recursive:true});const fileName=`vision-${randomUUID()}.${extension}`;
   await writeFile(path.join(directory,fileName),buffer,{mode:0o600});
   return `${origin.origin}/imageai/${encodeURIComponent(fileName)}`;
  })());
  return saved.get(key)!;
 };
}
export async function cleanVisionImageLinks(directory:string,ttlMs=2*60*60*1000) {
 const now=Date.now();
 try{for(const name of await readdir(directory)){
  if(!/^vision-[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name))continue;
  const file=path.join(directory,name);try{if(now-(await stat(file)).mtimeMs>ttlMs)await unlink(file);}catch{}
 }}catch{}
}
