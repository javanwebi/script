export interface DesignationCheck {
 status:'listed-reference-length'|'unlisted-reference-length'|'reference-conflict';
 designation:string;sourceUrl:string;pdfPage?:number;sourcePage?:number;
 lengthMm?:number;teeth?:number;identityVerified:false;
}
export interface TimingReferenceRow {
 designation:string;reference_source:string;length_mm:number|string|null;
 teeth_count:number|null;pdf_page:number|null;source_page:number|null;
 is_conflict:boolean;source_url:string|null;
}
const lengths=new Map<string,TimingReferenceRow>();
let fallbackSourceUrl='';
/** Install verified reference data from timing_belt_reference_lengths, never a bundled JSON. */
export function installTimingReferenceRows(rows:TimingReferenceRow[]) {
 lengths.clear();fallbackSourceUrl='';
 const preferred=[...rows].sort((a,b)=>Number(a.reference_source!=='optibelt_imperial')-Number(b.reference_source!=='optibelt_imperial'));
 for(const row of preferred){
  if(row.reference_source==='optibelt_imperial' && row.source_url)fallbackSourceUrl=row.source_url;
  if(!lengths.has(row.designation))lengths.set(row.designation,row);
 }
}
export function checkImperialDesignation(number:string,profile:string):DesignationCheck {
 const designation=`${number}${profile}`;
 const row=lengths.get(designation);
 if(!row)return {status:'unlisted-reference-length',designation,sourceUrl:fallbackSourceUrl,identityVerified:false};
 if(row.is_conflict)return {status:'reference-conflict',designation,sourceUrl:row.source_url||fallbackSourceUrl,
   ...(row.pdf_page!==null?{pdfPage:row.pdf_page}:{}) ,identityVerified:false};
 return {status:'listed-reference-length',designation,
  sourceUrl:row.source_url||fallbackSourceUrl,
  ...(row.pdf_page!==null?{pdfPage:row.pdf_page}:{}),
  ...(row.source_page!==null?{sourcePage:row.source_page}:{}),
  ...(row.length_mm!==null?{lengthMm:Number(row.length_mm)}:{}),
  ...(row.teeth_count!==null?{teeth:row.teeth_count}:{}),
  identityVerified:false
 };
}
