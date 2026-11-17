import fs from 'node:fs';
import path from 'node:path';
import { extractBeltRefsFromTechnicalResearch, runPhase1CatalogReconstruction } from '../src/data/catalogPhase1Reconstruction';
const root=process.cwd();
const rawFamilies=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/catalogueSource.json'),'utf8'));
const directSql=fs.readFileSync(path.join(root,'ops/sql/20261114_catalog_sku_level_menu_assignments.sql'),'utf8');
const research=JSON.parse(fs.readFileSync(path.join(root,'docs/technical-research-2642.json'),'utf8'));
const report=runPhase1CatalogReconstruction(rawFamilies,{directSkuSqlText:directSql,beltRefs:extractBeltRefsFromTechnicalResearch(research)});
const slug='excel-v2-1-3';
const families=report.reconstructedFamilies.filter(f=>f.categorySlug===slug).map(f=>({
 id:f.familyId,name:f.engineeringFamilyName,brand:f.brand,material:f.material,construction:f.construction,
 profile:f.profile,submenu:f.submenu,leaf:f.leaf,members:f.memberCount,sourceFamilies:f.sourceFamilyCodes,
 sampleSkus:f.memberSkuCodes.slice(0,8)
}));
const direct=report.directProducts.filter(s=>s.proposedCategorySlug===slug).map(s=>({
 sku:s.skuCode,name:s.originalProductName,brand:s.brand,material:s.material,profile:s.profile,
 submenu:s.proposedSubmenu,leaf:s.proposedLeaf
}));
const out={
 generatedAt:report.generatedAt,gitContext:report.gitContext,summary:report.summary,qc:report.qualityControlMetrics,
 decisionDistribution:report.decisionDistribution,
 beltCategoryCheckpoints:report.categoryStageCheckpoints.filter(c=>/^excel-v2-1-[1-4]$/.test(c.categorySlug)),
 weldedCategoryFamilyCount:families.length,weldedCategoryFamilySkuCount:families.reduce((n,f)=>n+f.members,0),
 weldedCategoryFamilies:families,weldedCategoryDirectProductCount:direct.length,weldedCategoryDirectProducts:direct,
 weldingEquipmentAudit:{
  total:report.weldingEquipmentAudit.totalAuditedSkus,
  equipment:report.weldingEquipmentAudit.weldingEquipmentAndClampCount,
  roundCrc:report.weldingEquipmentAudit.records.filter(r=>r.classification==='WELDED_PU_ROUND_CRC_BELT').length,
  vOrFlat:report.weldingEquipmentAudit.records.filter(r=>r.classification==='WELDED_PU_V_OR_FLAT_BELT').length
 }
};
console.log('PHASE1_CURRENT_MAIN_AUDIT_BEGIN');
console.log(JSON.stringify(out,null,2));
console.log('PHASE1_CURRENT_MAIN_AUDIT_END');
const q=report.qualityControlMetrics;
const checks=[q.allSkusAudited,q.noDuplicateFamilyMembership,q.allCategoriesValid,q.allSubcategoriesValid,
 q.noInvalidMenuAssignments,q.allFamiliesHomogeneous,q.noBrandMixingInFamilies,q.noMaterialMixingInFamilies,
 q.noSingleSkuArtificialFamilies,q.unresolvedProperlyQuarantined];
if(report.summary.totalSourceFamilies!==1383||report.summary.totalSourceSkus!==10435||
 report.skuRecords.length!==10435||report.oldToNewFamilyMappings.length!==1383||
 report.categoryStageCheckpoints.length!==34||checks.some(v=>v!==true)){
 console.error('PHASE1_CURRENT_MAIN_AUDIT_FAILED',JSON.stringify({checks,checkpoints:report.categoryStageCheckpoints.length}));
 process.exitCode=1;
}
