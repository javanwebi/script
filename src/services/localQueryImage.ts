import sharp from 'sharp';
import {imageRegionToPixelBounds,validImageRegion} from '../utils/imageRegion';
import type {ImageRegion} from '../utils/imageRegion';
export {validImageRegion} from '../utils/imageRegion';
export type {ImageRegion} from '../utils/imageRegion';
export async function prepareLocalQuery(image:Buffer,region?:ImageRegion){
 if(region!==undefined && !validImageRegion(region))throw new Error('Invalid query region');
 const oriented=await sharp(image).rotate().toBuffer({resolveWithObject:true});
 let pipeline=sharp(oriented.data);
 if(region){
  const bounds=imageRegionToPixelBounds(region,oriented.info.width,oriented.info.height);
  if(!bounds)throw new Error('Invalid query region bounds');
  pipeline=pipeline.extract({left:bounds.x,top:bounds.y,width:bounds.width,height:bounds.height});
 }
 return pipeline.resize(512,512,{fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:92}).toBuffer();
}
