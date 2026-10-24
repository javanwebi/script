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
 const response=await fetch('/api/catalog/product-images/upload?'+params.toString(),{
  method:'POST',
  credentials:'same-origin',
  headers:{'Content-Type':file.type},
  body:file
 });
 const result=await response.json().catch(()=>({success:false,message:'پاسخ سرور قابل خواندن نیست.'}));
 if(!response.ok||!result.success||!result.image?.url)
  throw new Error(result.message||'ذخیره تصویر و اتصال به کالا انجام نشد.');
 return result.image as StoredProductImage;
}
