export type ImageRegion={x:number;y:number;width:number;height:number};
export function validImageRegion(region:unknown):region is ImageRegion{
 if(!region || typeof region!=='object')return false;
 const r=region as ImageRegion;
 return [r.x,r.y,r.width,r.height].every(n=>typeof n==='number'&&Number.isFinite(n)) &&
  r.x>=0 && r.y>=0 && r.width>=0.03 && r.height>=0.03 &&
  r.x+r.width<=1.000001 && r.y+r.height<=1.000001;
}


export interface ImagePixelBounds {
 x: number;
 y: number;
 width: number;
 height: number;
}

/** Convert normalized viewer coordinates into a clamped, non-empty source-image crop. */
export function imageRegionToPixelBounds(region: unknown, imageWidth: number, imageHeight: number): ImagePixelBounds | null {
 if (!validImageRegion(region) || !Number.isFinite(imageWidth) || !Number.isFinite(imageHeight)) return null;
 const width = Math.floor(imageWidth);
 const height = Math.floor(imageHeight);
 if (width < 1 || height < 1) return null;
 const left = Math.max(0, Math.min(width - 1, Math.floor(region.x * width)));
 const top = Math.max(0, Math.min(height - 1, Math.floor(region.y * height)));
 const right = Math.max(left + 1, Math.min(width, Math.ceil((region.x + region.width) * width)));
 const bottom = Math.max(top + 1, Math.min(height, Math.ceil((region.y + region.height) * height)));
 return { x: left, y: top, width: right - left, height: bottom - top };
}
