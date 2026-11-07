import sharp from 'sharp';
export type ImageRegion={x:number;y:number;width:number;height:number};
export function validImageRegion(region:unknown):region is ImageRegion {
 if(!region || typeof region!=='object')return false;
 const r=region as ImageRegion;
 return [r.x,r.y,r.width,r.height].every(n=>typeof n==='number'&&Number.isFinite(n)) && r.x>=0 && r.y>=0 && r.width>=0.03 && r.height>=0.03 && r.x+r.width<=1.000001 && r.y+r.height<=1.000001;
}
export async function prepareLocalQuery(image:Buffer,region?:ImageRegion){
 if(region!==undefined && !validImageRegion(region))throw new Error('Invalid query region');
 const oriented=await sharp(image).rotate().toBuffer({resolveWithObject:true});
 let pipeline=sharp(oriented.data);
 if(region){
  const {width,height}=oriented.info;
  const left=Math.min(width-1,Math.floor(region.x*width)),top=Math.min(height-1,Math.floor(region.y*height));
  pipeline=pipeline.extract({left,top,width:Math.max(1,Math.min(width-left,Math.round(region.width*width))),height:Math.max(1,Math.min(height-top,Math.round(region.height*height)))});
 }
 return pipeline.resize(512,512,{fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:92}).toBuffer();
}
