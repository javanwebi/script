/** Rebuild the row-by-row audit; a reference match is never stocked-item certification. */
import { writeFileSync } from 'node:fs';
import { USER_PRODUCTS, USER_PRODUCTS_RAW } from '../src/data/userProducts';
import cohort from '../tests/fixtures/technicalResearchCohort.json';
const skus=new Set(cohort.skus);
const original=new Map(USER_PRODUCTS_RAW.flatMap(p=>(p.variants||[]).map(v=>[v.code,v] as const)));
const sources: string[]=[];
const sourceIndex=(url:string)=>{let i=sources.indexOf(url);if(i===-1){i=sources.length;sources.push(url);}return i;};
const records=USER_PRODUCTS.flatMap(p=>(p.variants||[]).filter(v=>skus.has(v.code)).map(v=>{
 const source=original.get(v.code)!;
 const review=v.technicalReview!;
 return {
  sku:v.code,originalName:source.name,originalSize:source.size,
  originalIdentityPreserved:v.code===source.code&&v.name===source.name&&v.size===source.size,
  partType:v.technicalSpecs?.find(s=>s.key==='نوع قطعه')?.value,
  model:v.model||null,catalogMarking:review.catalogPartCode||null,
  referenceLengthCheck:review.designationCheck ? {status:review.designationCheck.status,designation:review.designationCheck.designation,lengthMm:review.designationCheck.lengthMm,teeth:review.designationCheck.teeth,pdfPage:review.designationCheck.pdfPage,sourcePage:review.designationCheck.sourcePage,source:sourceIndex(review.designationCheck.sourceUrl)} : null,
  ownerCatalogue:review.ownerCatalogue||null,
  outcome:review.ownerCatalogue?(review.ownerCatalogue.conflict?'owner-table-conflict':'owner-table-dimensions'):review.designationCheck?.status==='listed-reference-length'?'nominal-length-in-primary-table':review.catalogPartCode?'original-marking-only':'incomplete-manufacturer-identity',
  references:[...new Set([...review.references,...(review.comparisonReferences||[])].map(r=>sourceIndex(r.url)))],
  warnings:review.researchWarnings||[],
 };
}));
if(records.length!==2642||new Set(records.map(r=>r.sku)).size!==2642||records.some(r=>!r.originalIdentityPreserved))throw Error('Cohort or original identifiers changed');
const outcomes=records.reduce<Record<string,number>>((a,r)=>{a[r.outcome]=(a[r.outcome]||0)+1;return a;},{});
const report={checkedOn:'2026-10-19',scope:'2642 original SKU rows checked against parsed primary-reference tables and the immutable catalog. This is not 2642 independently verified manufacturer identities or 2642 individual web searches.',summary:{reviewed:records.length,outcomes,addedWarehouseCodes:0,changedOriginalIdentifiers:0,exactManufacturerIdentitiesVerified:0},sources,records};
if(process.argv.includes('--write'))writeFileSync('docs/technical-research-2642.json',JSON.stringify(report)+'\n');
console.log(JSON.stringify(report.summary,null,2));
