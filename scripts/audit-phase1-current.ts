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
const allowedPaths=new Map<string,Map<string,Set<string>>>(APPROVED_MENU_CATEGORIES.map(c=>[
 c.slug,new Map((c.children||[]).map(sub=>[sub.name,new Set((sub.children||[]).map(leaf=>leaf.name))]))
]));
const invalidCategory:Phase1SkuRecord[]=report.skuRecords.filter((s:Phase1SkuRecord)=>
 s.proposedCategorySlug!=='UNRESOLVED'&&!allowedPaths.has(s.proposedCategorySlug)
);
const invalidSubcategory:Phase1SkuRecord[]=report.skuRecords.filter((s:Phase1SkuRecord)=>{
 if(s.proposedCategorySlug==='UNRESOLVED')return false;
 const leaves=allowedPaths.get(s.proposedCategorySlug)?.get(s.proposedSubmenu);
 if(!leaves)return true;
 return s.proposedLeaf!==null&&s.proposedLeaf.trim()!==''&&!leaves.has(s.proposedLeaf);
});
const normName=(value:string)=>value.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\s]+/g,' ').toLowerCase();
const welded:Phase1SkuRecord[]=report.skuRecords.filter((s:Phase1SkuRecord)=>{
 const division=String(s.engineeringSpecifications.beltDivision||'');
 return ['welded-round-material-unverified','conveyor-crowned-crc','welded-pu-round-crc','welded-pu-v-flat'].includes(division) ||
  /جوشی|CRC|BRB|گرد\s*ه?\s*ماهی|تسمه فلت/i.test(normName(s.originalProductName));
});
const selectSku=(s:Phase1SkuRecord)=>({
 sku:s.skuCode,sourceFamilyCode:s.currentFamily,name:s.originalProductName,productType:s.productType,
 familyType:s.familyTypeId,brand:s.brand,material:s.material,construction:s.construction,profile:s.profile,
 category:s.proposedCategorySlug,submenu:s.proposedSubmenu,leaf:s.proposedLeaf,decision:s.familyDecision,
 status:s.finalStatus,proposedFamily:s.proposedFamily,familyName:s.familyName,unit:s.unit,size:s.originalSize,
 confidence:s.confidenceScore,taxonomyGap:s.taxonomyGap
});
const roundWeldedSkus=report.skuRecords.filter((s:Phase1SkuRecord)=>s.engineeringSpecifications.beltDivision==='welded-round-material-unverified').map(selectSku);
const ridgeTopSkus=report.skuRecords.filter((s:Phase1SkuRecord)=>s.engineeringSpecifications.beltDivision==='conveyor-crowned-crc').map(selectSku);
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
const beltFamilySummary=(slug:string)=>report.reconstructedFamilies
 .filter(f=>f.categorySlug===slug)
 .map(f=>({
  familyId:f.familyId,name:f.engineeringFamilyName,productType:f.productType,brand:f.brand,
  material:f.material,construction:f.construction,profile:f.profile,submenu:f.submenu,leaf:f.leaf,
  memberCount:f.memberCount,sourceFamilyCodes:f.sourceFamilyCodes,memberSkuCodes:f.memberSkuCodes
 }));
const beltDirectSummary=(slug:string)=>report.directProducts
 .filter(s=>s.proposedCategorySlug===slug)
 .map(s=>({sku:s.skuCode,name:s.originalProductName,brand:s.brand,material:s.material,profile:s.profile,
  submenu:s.proposedSubmenu,leaf:s.proposedLeaf}));
const output={
 summary:report.summary,qc:report.qualityControlMetrics,
 category3Families:beltFamilySummary('excel-v2-1-3'),
 category4Families:beltFamilySummary('excel-v2-1-4'),
 category3DirectProducts:beltDirectSummary('excel-v2-1-3'),
 category4DirectProducts:beltDirectSummary('excel-v2-1-4'),
 beltCheckpoints:report.categoryStageCheckpoints.filter(c=>/^excel-v2-1-[1-4]$/.test(c.categorySlug)),
 weldedAudit:report.weldingEquipmentAudit,
 weldedCandidateCount:welded.length,
 weldedGroups:{
  category:group(welded,s=>s.proposedCategorySlug),status:group(welded,s=>s.finalStatus),
  sourceType:group(welded,s=>s.sourceTechnicalType),familyType:group(welded,s=>s.familyTypeId)
 },
 weldedSamples:welded.slice(0,90).map(pick),
 weldedUnresolvedSamples:welded.filter(s=>s.finalStatus==='UNRESOLVED').map(pick),
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
 report.categoryStageCheckpoints.length!==34||checks.some(v=>v!==true)||
 report.categoryStageCheckpoints.find(c=>c.categorySlug==='excel-v2-1-3')?.familyCount===0||
 report.categoryStageCheckpoints.find(c=>c.categorySlug==='excel-v2-1-4')?.familyCount===0){
 console.error('PHASE1_CURRENT_MAIN_AUDIT_FAILED',JSON.stringify({checks,invalidCategory:invalidCategory.length,
  invalidSubcategory:invalidSubcategory.length}));
 process.exitCode=1;
}
