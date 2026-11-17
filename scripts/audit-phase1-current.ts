import fs from 'node:fs';
import path from 'node:path';
import {
  extractBeltRefsFromTechnicalResearch,
  runPhase1CatalogReconstruction,
  type Phase1ReconstructionReport,
  type Phase1SkuRecord,
} from '../src/data/catalogPhase1Reconstruction';
import { APPROVED_MENU_CATEGORIES } from '../src/data/approvedMenuFallback';

const root=process.cwd();
const rawFamilies=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/catalogueSource.json'),'utf8'));
const directSql=fs.readFileSync(path.join(root,'ops/sql/20261114_catalog_sku_level_menu_assignments.sql'),'utf8');
const research=JSON.parse(fs.readFileSync(path.join(root,'docs/technical-research-2642.json'),'utf8'));
const report: Phase1ReconstructionReport=runPhase1CatalogReconstruction(
 rawFamilies,{directSkuSqlText:directSql,beltRefs:extractBeltRefsFromTechnicalResearch(research)}
);
const allowedPaths=new Map<string,Set<string>>(APPROVED_MENU_CATEGORIES.map(c=>[
 c.slug,new Set((c.children||[]).flatMap(sub=>(sub.children||[]).map(leaf=>`${sub.name}\u0000${leaf.name}`)))
]));
const invalidCategory:Phase1SkuRecord[]=report.skuRecords.filter((s:Phase1SkuRecord)=>
 s.proposedCategorySlug!=='UNRESOLVED'&&!allowedPaths.has(s.proposedCategorySlug)
);
const invalidSubcategory:Phase1SkuRecord[]=report.skuRecords.filter((s:Phase1SkuRecord)=>
 s.proposedCategorySlug!=='UNRESOLVED'&&!allowedPaths.get(s.proposedCategorySlug)?.has(`${s.proposedSubmenu}\u0000${s.proposedLeaf??''}`)
);
const welded:Phase1SkuRecord[]=report.skuRecords.filter((s:Phase1SkuRecord)=>
 /جوشی|CRC|BRB|گرده.?ماهی|تسمه فلت/i.test(s.originalProductName)
);
const group=<T,>(rows:T[],fn:(row:T)=>string)=>{
 const map=new Map<string,number>();
 for(const row of rows){const key=fn(row);map.set(key,(map.get(key)||0)+1);}
 return [...map].map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count);
};
const pick=(s:Phase1SkuRecord)=>({
 sku:s.skuCode,family:s.currentFamily,sourceType:s.sourceTechnicalType,name:s.originalProductName,
 productType:s.productType,brand:s.brand,material:s.material,construction:s.construction,profile:s.profile,
 familyType:s.familyTypeId,category:s.proposedCategorySlug,submenu:s.proposedSubmenu,leaf:s.proposedLeaf,
 decision:s.familyDecision,status:s.finalStatus,evidence:s.technicalEvidence,confidence:s.confidenceScore,
 reason:s.decisionReason,taxonomyGap:s.taxonomyGap
});
const output={
 summary:report.summary,qc:report.qualityControlMetrics,
 beltCheckpoints:report.categoryStageCheckpoints.filter(c=>/^excel-v2-1-[1-4]$/.test(c.categorySlug)),
 weldedAudit:report.weldingEquipmentAudit,
 weldedCandidateCount:welded.length,
 weldedGroups:{
  category:group(welded,s=>s.proposedCategorySlug),status:group(welded,s=>s.finalStatus),
  sourceType:group(welded,s=>s.sourceTechnicalType),familyType:group(welded,s=>s.familyTypeId)
 },
 weldedSamples:welded.slice(0,90).map(pick),
 invalidCategoryCount:invalidCategory.length,invalidCategorySamples:invalidCategory.slice(0,80).map(pick),
 invalidSubcategoryCount:invalidSubcategory.length,invalidSubcategorySamples:invalidSubcategory.slice(0,100).map(pick)
};
console.log('PHASE1_CURRENT_MAIN_AUDIT_DETAIL_BEGIN');
console.log(JSON.stringify(output,null,2));
console.log('PHASE1_CURRENT_MAIN_AUDIT_DETAIL_END');
const q=report.qualityControlMetrics;
const checks=[q.allSkusAudited,q.noDuplicateFamilyMembership,q.allCategoriesValid,q.allSubcategoriesValid,
 q.noInvalidMenuAssignments,q.allFamiliesHomogeneous,q.noBrandMixingInFamilies,q.noMaterialMixingInFamilies,
 q.noSingleSkuArtificialFamilies,q.unresolvedProperlyQuarantined];
if(report.summary.totalSourceFamilies!==1383||report.summary.totalSourceSkus!==10435||
 report.skuRecords.length!==10435||report.oldToNewFamilyMappings.length!==1383||
 report.categoryStageCheckpoints.length!==34||checks.some(v=>v!==true)){
 console.error('PHASE1_CURRENT_MAIN_AUDIT_FAILED',JSON.stringify({checks,invalidCategory:invalidCategory.length,
  invalidSubcategory:invalidSubcategory.length}));
 process.exitCode=1;
}
