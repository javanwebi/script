import './catalogFixtures';
import test from 'node:test';
import assert from 'node:assert/strict';
import data from './fixtures/imperialTimingReference.json';
import { checkImperialDesignation } from '../src/data/imperialTimingReference';
import report from '../docs/technical-research-2642.json';
import cohort from './fixtures/technicalResearchCohort.json';
test('all imported reference lengths agree with an integer tooth count and the profile pitch',()=>{
 const pitch:Record<string,number>={MXL:2.032,XL:5.08,L:9.525,H:12.7,XH:22.225,XXH:31.75,DXL:5.08,DL:9.525,DH:12.7};
 assert.equal(Object.keys(data.lengths).length,581);
 for(const [designation,row] of Object.entries(data.lengths)){
  const profile=designation.replace(/^\d+/,'');
  assert.ok(Number.isInteger(row.teeth)&&row.teeth>0);
  assert.ok(Math.abs(row.lengthMm-row.teeth*pitch[profile])<.011,designation);
 }
 assert.equal(checkImperialDesignation('817','L').status,'reference-conflict');
 assert.equal(checkImperialDesignation('1235','H').lengthMm,undefined);
 assert.equal(checkImperialDesignation('1020','H').sourceUrl,'https://global.mitsuboshi.com/assetFiles/timing_belt_design_manual_en.pdf');
});
test('the persisted 2642-row audit contains existing identifiers only and claims no exact stocked-item verification',()=>{
 assert.deepEqual(report.records.map(r=>r.sku).sort(),[...cohort.skus].sort());
 assert.equal(new Set(report.records.map(r=>r.sku)).size,2642);
 assert.equal(report.summary.addedWarehouseCodes,0);
 assert.equal(report.summary.exactManufacturerIdentitiesVerified,0);
 for(const row of report.records)assert.equal(row.originalIdentityPreserved,true);
});
