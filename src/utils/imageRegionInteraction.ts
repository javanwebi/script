import {validImageRegion,type ImageRegion} from './imageRegion';
export type ImagePoint={x:number;y:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** Legacy helper for an explicitly drawn fallback rectangle. */
export function tapImageRegion(point:ImagePoint,aspectRatio=1):ImageRegion{
 const aspect=Number.isFinite(aspectRatio)&&aspectRatio>0?aspectRatio:1;
 const width=clamp(0.42*Math.min(1,1/aspect),0.03,1),height=clamp(0.42*Math.min(1,aspect),0.03,1);
 return {x:clamp(point.x-width/2,0,1-width),y:clamp(point.y-height/2,0,1-height),width,height};
}
/** A tap may switch only to a server-proposed object box. Taps on empty background
 * deliberately return undefined so the current automatic selection is preserved.
 */
export function findImageRegionAtPoint(point:ImagePoint,regions:ImageRegion[]):ImageRegion|undefined{
 return regions.filter(validImageRegion).filter(region=>
  point.x>=region.x && point.x<=region.x+region.width &&
  point.y>=region.y && point.y<=region.y+region.height
 ).sort((a,b)=>(a.width*a.height)-(b.width*b.height))[0];
}
