import './catalogFixtures';
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {photoFingerprint,sameCatalogPhotograph} from '../src/services/catalogPhotoIdentity';
test('same catalogue photograph survives upload compression and alpha compositing; similar parts and blank images do not',async()=>{
 const fixture=Buffer.from('<svg width="400" height="400"><circle cx="190" cy="180" r="115" fill="#555"/><circle cx="190" cy="180" r="45" fill="#ddd"/><path d="M50 310 L350 310 L270 360 Z" fill="#d65320"/></svg>');
 const png=await sharp(fixture).png().toBuffer();
 const upload=await sharp(png).flatten({background:'#fff'}).jpeg({quality:94}).toBuffer();
 const first=await photoFingerprint(png);
 assert.equal(sameCatalogPhotograph(first,await photoFingerprint(upload)),true);
 const different=await sharp(fixture).flop().png().toBuffer();
 assert.equal(sameCatalogPhotograph(first,await photoFingerprint(different)),false);
 const blank=await sharp({create:{width:400,height:400,channels:3,background:'#fff'}}).png().toBuffer();
 assert.equal(sameCatalogPhotograph(await photoFingerprint(blank),await photoFingerprint(blank)),false);
 const colour=await sharp({create:{width:400,height:400,channels:3,background:'#f46b20'}}).png().toBuffer();
 assert.equal(sameCatalogPhotograph(await photoFingerprint(colour),await photoFingerprint(colour)),false);
});
test('an identical re-upload ranks above model suggestions without claiming a warehouse SKU',async()=>{
 const {scanEveryCatalogImage}=await import('../src/services/exhaustiveImageScan');
 const {buildCatalogImageCorpus}=await import('../src/services/catalogImageCorpus');
 const svg=Buffer.from('<svg width="300" height="300"><rect x="40" y="50" width="160" height="180" fill="#555"/><circle cx="130" cy="120" r="32" fill="white"/></svg>');
 const original=await sharp(svg).png().toBuffer();
 const query=await sharp(original).flatten({background:'#fff'}).jpeg({quality:94}).toBuffer();
 const images=buildCatalogImageCorpus([]).slice(0,1).map(row=>({...row,id:'identity-fixture',revision:'identity-test'}));
 const result=await scanEveryCatalogImage({query,images,detectDuplicatePhotos:true,readImage:async()=>original,vision:async()=>'{"picks":[]}'});
 assert.equal(result.matches[0].imageId,'identity-fixture');assert.equal(result.matches[0].score,99);
 assert.ok(result.matches[0].reason.includes('کد دقیق'));assert.equal(result.coverage.complete,true);
});
