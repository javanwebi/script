import sharp from 'sharp';
import {validImageRegion} from '../utils/imageRegion';
import type {ImageRegion} from '../utils/imageRegion';
export {validImageRegion} from '../utils/imageRegion';
export type {ImageRegion} from '../utils/imageRegion';
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
