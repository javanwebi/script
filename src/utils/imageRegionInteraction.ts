import type {ImageRegion} from '../services/localQueryImage';
export type ImagePoint={x:number;y:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** A pixel-square neighbourhood around the tap, bounded by the actual image. */
export function tapImageRegion(point:ImagePoint,aspectRatio=1):ImageRegion{
 const aspect=Number.isFinite(aspectRatio)&&aspectRatio>0?aspectRatio:1;
 const width=clamp(0.42*Math.min(1,1/aspect),0.03,1),height=clamp(0.42*Math.min(1,aspect),0.03,1);
 return {x:clamp(point.x-width/2,0,1-width),y:clamp(point.y-height/2,0,1-height),width,height};
}
