import type {ImageRegion} from '../services/localQueryImage';

/** A manual tap is only authoritative when it yields a real, accepted catalogue result. */
export function shouldRetryAutomaticRegion(
 manualRegion:ImageRegion|undefined,
 automaticFallback:ImageRegion|null|undefined,
 hasAcceptedProduct:boolean,
):boolean{
 if(!manualRegion || automaticFallback===undefined || hasAcceptedProduct)return false;
 if(automaticFallback && ['x','y','width','height'].every(key=>
  Math.abs(manualRegion[key as keyof ImageRegion]-automaticFallback[key as keyof ImageRegion])<0.0001
 ))return false;
 return true;
}
