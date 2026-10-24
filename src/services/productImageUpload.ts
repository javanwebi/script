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
 const dataUrl=await new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||''));
  reader.onerror=()=>reject(new Error('خواندن فایل تصویر ناموفق بود.'));
  reader.readAsDataURL(file);
 });
 const response=await fetch('/api/catalog/product-images/upload',{
  method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({...details,dataUrl})
 });
 const result=await response.json().catch(()=>({success:false,message:'پاسخ سرور قابل خواندن نیست.'}));
 if(!response.ok||!result.success||!result.image?.url)
  throw new Error(result.message||'ذخیره تصویر و اتصال به کالا انجام نشد.');
 return result.image as StoredProductImage;
}
