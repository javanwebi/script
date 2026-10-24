/** Admin-only upload: file content is stored on the server's persistent volume, never in Git or a product JSON field. */
export interface StoredProductImage {
 id:string;
 url:string;
 fileName:string;
 familyCode:string;
 variantCode:string|null;
 scope:'variant'|'family';
 title:string;
}
/**
 * Resize before sending large photos. On slower connections this avoids moving
 * an 8 MB camera original when the server stores a 1800 px WebP anyway.
 * Gracefully fall back to the original bytes when browser image codecs fail.
 */
async function optimizedUploadBlob(file:File):Promise<Blob>{
 if(file.size<450_000 || typeof createImageBitmap!=='function')return file;
 let bitmap:ImageBitmap|undefined;
 try{
  bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
  const width=Math.max(1,Math.round(bitmap.width*scale));
  const height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return file;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  ctx.drawImage(bitmap,0,0,width,height);
  const compressed=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',0.8));
  return compressed?.type==='image/webp' && compressed.size>0 && compressed.size<file.size
    ?compressed:file;
 }catch{return file;}
 finally{bitmap?.close();}
}
export async function uploadProductImage(file:File,details:{
 familyCode:string;variantCode?:string;title?:string;replaceId?:string;
}):Promise<StoredProductImage>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))
   throw new Error('فرمت مجاز تصویر: PNG، JPG یا WebP');
 if(!file.size||file.size>8*1024*1024)
   throw new Error('حداکثر حجم تصویر ۸ مگابایت است.');
 // Stream the image bytes directly instead of inflating them into base64 JSON.
 // The server stores an optimized WebP on the persistent Railway volume.
 const params=new URLSearchParams({familyCode:details.familyCode});
 if(details.variantCode)params.set('variantCode',details.variantCode);
 if(details.title)params.set('title',details.title.slice(0,180));
 if(details.replaceId)params.set('replaceId',details.replaceId);
 const payload=await optimizedUploadBlob(file);
 const response=await fetch('/api/catalog/product-images/upload?'+params.toString(),{
  method:'POST',
  credentials:'same-origin',
  headers:{'Content-Type':payload.type},
  body:payload
 });
 const result=await response.json().catch(()=>({success:false,message:'پاسخ سرور قابل خواندن نیست.'}));
 if(!response.ok||!result.success||!result.image?.url)
  throw new Error(result.message||'ذخیره تصویر و اتصال به کالا انجام نشد.');
 return result.image as StoredProductImage;
}
