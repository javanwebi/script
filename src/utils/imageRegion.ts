export type ImageRegion={x:number;y:number;width:number;height:number};
export function validImageRegion(region:unknown):region is ImageRegion{
 if(!region || typeof region!=='object')return false;
 const r=region as ImageRegion;
 return [r.x,r.y,r.width,r.height].every(n=>typeof n==='number'&&Number.isFinite(n)) &&
  r.x>=0 && r.y>=0 && r.width>=0.03 && r.height>=0.03 &&
  r.x+r.width<=1.000001 && r.y+r.height<=1.000001;
}
