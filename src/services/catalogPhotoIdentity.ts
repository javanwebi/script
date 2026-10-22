import sharp from 'sharp';
export interface PhotoFingerprint {pixels:Buffer;aspect:number;variance:number;}
/** Recognises a re-upload of the same photograph, not the identity of a physical part. */
export async function photoFingerprint(input:Buffer):Promise<PhotoFingerprint>{
 // Materialise alpha compositing before resizing; transparent edge colours otherwise alter the thumbnail.
 const flattened=await sharp(input).rotate().flatten({background:'#fff'}).png().toBuffer();
 const meta=await sharp(flattened).metadata();
 const pixels=await sharp(flattened).resize(96,96,{fit:'fill'}).toColourspace('srgb').removeAlpha().raw().toBuffer();
 const means=[0,0,0];
 for(let i=0;i<pixels.length;i++)means[i%3]+=pixels[i]/(pixels.length/3);
 const variance=pixels.reduce((sum,v,i)=>sum+(v-means[i%3])**2,0)/pixels.length;
 return {pixels,aspect:meta.width!/meta.height!,variance};
}
export function sameCatalogPhotograph(a:PhotoFingerprint,b:PhotoFingerprint):boolean{
 if(a.variance<100 || b.variance<100 || Math.abs(a.aspect/b.aspect-1)>.005 || a.pixels.length!==b.pixels.length)return false;
 const mse=a.pixels.reduce((sum,v,i)=>sum+(v-b.pixels[i])**2,0)/a.pixels.length/255**2;
 return mse<0.00002;
}
