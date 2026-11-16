import test from 'node:test';
import assert from 'node:assert/strict';
import {updateFamilyImageUrls,updateVariantImageUrls} from '../server/productImageStorage';

test('SKU-owned images never enter the shared family image list',()=>{
  assert.deepEqual(
    updateFamilyImageUrls(['/family.webp'],undefined,undefined,'/sku.webp','variant'),
    ['/family.webp'],
  );
  assert.deepEqual(
    updateFamilyImageUrls(['/family-old.webp'],'/family-old.webp','family','/sku.webp','variant'),
    [],
  );
});

test('family images are inherited and SKU images can be replaced independently',()=>{
  assert.deepEqual(
    updateFamilyImageUrls(['/family.webp'],undefined,undefined,'/family.webp','family'),
    ['/family.webp'],
  );
  assert.deepEqual(
    updateVariantImageUrls(['/sku-old.webp'],'/sku-old.webp','/sku-new.webp'),
    ['/sku-new.webp'],
  );
});
