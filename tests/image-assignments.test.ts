import test from 'node:test';
import assert from 'node:assert/strict';
import { USER_PRODUCTS } from '../src/data/userProducts';
import { getImageAssignmentAudit, imageFileName } from '../src/data/imageAssignments';
import { INDUSTRIAL_PRESET_SAMPLES } from '../src/data/recognitionSamples';

test('all image assets have review status without turning sequential filenames into warehouse SKUs',()=>{
 const audit=getImageAssignmentAudit(USER_PRODUCTS);
 assert.equal(audit.length,869);
 assert.equal(audit.filter(x=>x.status==='family-example').length,464);
 assert.equal(audit.filter(x=>x.status==='unassigned').length,405);
 assert.ok(audit.every(x=>x.requiresCodeEvidence));
 assert.ok(audit.every(x=>x.families.every(f=>f.skus.length===0)));
});
test('visually incompatible associations are removed, even when a family has a single SKU',()=>{
 const audit=getImageAssignmentAudit(USER_PRODUCTS);
 for(const file of ['e(54).png','e(52).png'])assert.equal(audit.find(x=>x.file===file)?.status,'unassigned');
 const single=audit.find(x=>x.families.some(f=>f.candidateSkuCount===1));
 assert.ok(single);assert.equal(single.status,'family-example');assert.equal(single.requiresCodeEvidence,true);
});
test('actual valid SKU bindings are reported and unknown SKU references are rejected',()=>{
 const base=USER_PRODUCTS.find(p=>p.variants?.length)!;const code=base.variants![0].code;
 const product={...base,images:[],variants:base.variants!.map(v=>({...v,images:[]})),galleryImages:[{id:'x',url:'https://raw.githubusercontent.com/javanweb/imagesatlas/main/e(1).png',scope:'variant' as const,variantCode:code}]};
 const row=getImageAssignmentAudit([product])[0];assert.equal(row.status,'sku-linked');assert.equal(row.families[0].skus[0].code,code);
 const invalid={...product,galleryImages:[{...product.galleryImages[0],variantCode:'NOT-IN-FAMILY'}]};assert.equal(getImageAssignmentAudit([invalid])[0].status,'family-example');
});
test('filename parsing handles encoded URLs but does not accept legacy product IDs',()=>{
 assert.equal(imageFileName('https://raw.githubusercontent.com/javanweb/imagesatlas/main/e%28383%29.png'),'e(383).png');
 assert.equal(imageFileName('AT-E383'),'');
 assert.equal(imageFileName('https://unrelated.example/e(1).png'),'');
});
test('recognition examples never populate fabricated technical dimensions',()=>{
 for(const sample of INDUSTRIAL_PRESET_SAMPLES){assert.equal(sample.length,0);assert.equal(sample.width,0);assert.equal(sample.features,'');}
 assert.equal(INDUSTRIAL_PRESET_SAMPLES.find(x=>x.imageUrl.includes('319'))?.title,'ریل صنعتی');
});

test('all unresolved images have detailed visual research without fabricated SKU or standard',()=>{
 const audit=getImageAssignmentAudit(USER_PRODUCTS).filter(row=>row.status==='unassigned');
 assert.equal(audit.length,405);
 for(const row of audit){assert.ok(row.research);assert.equal(row.research.sourceSha256,row.sha256);assert.equal(row.research.exactSku,null);assert.equal(row.research.standardStatus,'not-established');assert.ok(row.research.requiredChecks.length>=3);}
});
