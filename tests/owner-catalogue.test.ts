import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerPinDimensions } from '../src/data/ownerCatalogue';
import pins from '../src/data/ownerCataloguePinTable.json';
import photos from '../src/data/ownerCataloguePhotos.json';
import review from '../docs/product-image-review.json';
import { USER_PRODUCTS, USER_PRODUCTS_RAW, USER_PRODUCTS_BY_CODE } from '../src/data/userProducts';
import source from '../src/data/catalogueSource.json';
import { getImageAssignmentAudit } from '../src/data/imageAssignments';
import { matchesCatalogCategory } from '../src/data/categories';
import { enrichTechnicalVariant } from '../src/data/productTechnicalData';
test('owner pin table is applied to existing matching SKU names with explicit mm and drawing axes',()=>{
 const p=USER_PRODUCTS_BY_CODE.get('39373')!;const v=p.variants!.find(v=>v.code==='39373')!;
 assert.equal(v.technicalSpecs?.find(s=>s.key==='2R — طبق نقشهٔ کاتالوگ اطلس')?.value,'10 میلی‌متر');
 assert.equal(v.technicalSpecs?.find(s=>s.key==='h — طبق نقشهٔ کاتالوگ اطلس')?.value,'27 میلی‌متر');
 assert.equal(v.technicalReview?.ownerCatalogue?.pdfPage,106);
 assert.equal(v.technicalReview?.ownerCatalogue?.printedPage,88);
 assert.equal(ownerPinDimensions('39373','پولی صنعتی'),undefined);
 const oval=ownerPinDimensions('90156','پین سر رولر')!;
 assert.ok(oval.specifications.some(s=>s.value==='بیضی؛ ارتفاع عددی مشخص نشده'));
 assert.ok(!oval.specifications.some(s=>s.key.startsWith('h —')));
});
test('contradictory duplicate owner rows and absent inventory codes never invent data',()=>{
 const conflict=ownerPinDimensions('90155','پین سر رولر')!;
 assert.ok(conflict.evidence.conflict);assert.deepEqual(conflict.specifications,[]);
 assert.equal(USER_PRODUCTS_BY_CODE.has('90148'),false);
 assert.equal(pins.rows.filter(r=>r.sku==='90155').length,2);
});
test('catalog corrections repair family navigation while preserving every original SKU name and size',()=>{
 const sourceRows=source.flatMap(p=>p.variants).map(v=>JSON.stringify([v.code,v.name,v.size])).sort();
 const current=USER_PRODUCTS.flatMap(p=>p.variants||[]).map(v=>JSON.stringify([v.code,v.name,v.size])).sort();
 assert.deepEqual(current,sourceRows);
 const pulley=USER_PRODUCTS_BY_CODE.get('40997')!;
 assert.equal(pulley.categoryName,'پولی و انتقال نیرو');
 assert.ok(matchesCatalogCategory(pulley,pulley.categorySlug,'پولی'));
 assert.equal(USER_PRODUCTS_BY_CODE.get('33365')?.subcategory,'چرخ هرزگرد');
 assert.equal(USER_PRODUCTS_BY_CODE.get('34318')?.name,'قطعات پمپ دیافراگم');
 const tensioner=USER_PRODUCTS_BY_CODE.get('32711')!;
 assert.equal(tensioner.categoryName,'قطعات مکانیکی');
 assert.equal(tensioner.variants![0].technicalReview?.technicalCode,undefined);
 assert.equal(tensioner.variants![0].technicalSpecs?.find(s=>s.key==='نوع قطعه')?.value,'تسمه‌سفت‌کن');
});
test('143 owner photo matches have page/hash evidence but never imply a warehouse-SKU binding',()=>{
 assert.equal(photos.items.length,143);
 const hashes=new Map(review.items.map(r=>[r.file,r.sha256]));
 const audit=getImageAssignmentAudit(USER_PRODUCTS_RAW);
 for(const row of photos.items){
  assert.equal(row.imageSha256,hashes.get(row.file));
  assert.equal(row.exactWarehouseSku,null);assert.equal(row.printedPage,row.page-18);
  assert.ok(row.catalogueGroup&&row.page>18&&row.page<=107);
  const item=audit.find(x=>x.file===row.file)!;
  assert.ok(item.ownerCatalogue);assert.equal(item.status,'unassigned');
 }
 assert.equal(photos.documentSha256,pins.sha256);
 assert.equal(photos.items.find(x=>x.file==='e(129).png')?.catalogueGroup,'نازل شعله‌پخش‌کن');
});
test('owner-provided dimensions remain idempotent and manual edits keep priority',()=>{
 const p=USER_PRODUCTS_BY_CODE.get('39373')!;const v=p.variants!.find(v=>v.code==='39373')!;
 assert.deepEqual(enrichTechnicalVariant(p,v),v);
 const changed={...v,technicalSpecs:v.technicalSpecs!.map(s=>s.key==='2R — طبق نقشهٔ کاتالوگ اطلس'?{...s,value:'تأیید مدیر'}:s)};
 assert.equal(enrichTechnicalVariant(p,changed).technicalSpecs?.find(s=>s.key==='2R — طبق نقشهٔ کاتالوگ اطلس')?.value,'تأیید مدیر');
});
