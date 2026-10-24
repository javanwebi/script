import type {Request,Response} from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const inflight=new Map<string,Promise<Buffer>>();
const MAX_PENDING=32;
const MIN_DISK_FREE=20*1024*1024;
/** Two fixed responsive sizes prevent arbitrary image-resize CPU abuse. */
export async function serveProductImage(req:Request,res:Response,source:string,root:string,originalType:'image/png'|'image/jpeg'|'image/webp'){
 const width=Number(req.query.w);
 const optimize=width===420||width===840;
 const headers={'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'};
 if(!optimize){
  return res.sendFile(source,{dotfiles:'deny',headers:{...headers,'Content-Type':originalType}},
   e=>{if(e&&!res.headersSent)res.status((e as any).status||404).end()});
 }
 const folder=path.join(root,'thumbs',String(width));
 const output=path.join(folder,path.basename(source)+'.webp');
 const imageHeaders={...headers,'Content-Type':'image/webp'};
 if(await fs.stat(output).then(s=>s.isFile()).catch(()=>false))
  return res.sendFile(output,{dotfiles:'deny',headers:imageHeaders},
   e=>{if(e&&!res.headersSent)res.status((e as any).status||404).end()});
 try{
  const key=output;
  let promise=inflight.get(key);
  if(!promise){
   if(inflight.size>=MAX_PENDING)return res.sendFile(source,{dotfiles:'deny',headers:{...headers,'Content-Type':originalType}});
   promise=(async()=>{
    const image=await sharp(source,{limitInputPixels:24_000_000})
     .rotate().resize({width,withoutEnlargement:true,fit:'inside'})
     .webp({quality:74,effort:1}).toBuffer();
    try{
     const stats=await fs.statfs(root);
     if(stats.bavail*stats.bsize>image.length+MIN_DISK_FREE){
      await fs.mkdir(folder,{recursive:true,mode:0o750});
      const temp=output+'.'+crypto.randomUUID()+'.tmp';
      try{await fs.writeFile(temp,image,{flag:'wx',mode:0o640});await fs.rename(temp,output);}
      finally{await fs.rm(temp,{force:true}).catch(()=>{});}
     }
    }catch{ /* Low disk space never breaks delivery of a valid image. */ }
    return image;
   })().finally(()=>inflight.delete(key));
   inflight.set(key,promise);
  }
  const optimized=await promise;
  res.set(imageHeaders);
  return res.end(optimized);
 }catch(e){
  console.warn('[Product thumbnails] Could not optimize image:',path.basename(source));
  return res.sendFile(source,{dotfiles:'deny',headers:{...headers,'Content-Type':originalType}});
 }
}
/** Pre-warm small images without blocking server startup or consuming unbounded disk. */
export async function warmProductThumbs(files:string[],root:string){
 let successful=0;
 for(const file of files){
  const relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative))continue;
  const dest=path.join(root,'thumbs','420',path.basename(file)+'.webp');
  if(await fs.stat(dest).then(s=>s.isFile()).catch(()=>false))continue;
  try{
   const stat=await fs.statfs(root);
   if(stat.bavail*stat.bsize<MIN_DISK_FREE+3*1024*1024)break;
   const buf=await sharp(file,{limitInputPixels:24_000_000})
     .rotate().resize({width:420,fit:'inside',withoutEnlargement:true})
     .webp({quality:74,effort:1}).toBuffer();
   await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o750});
   const tmp=dest+'.'+crypto.randomUUID()+'.tmp';
   try{await fs.writeFile(tmp,buf,{flag:'wx'});await fs.rename(tmp,dest);}
   finally{await fs.rm(tmp,{force:true}).catch(()=>{});}
   successful++;
  }catch{ /* A corrupted image must not poison the rest of the import. */ }
 }
 console.log('[Product thumbnails] Cached additional 420px WebP:',successful);
}
