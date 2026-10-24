import assert from 'node:assert/strict';
import test from 'node:test';
import {getProductImageUrl,normalizeImageFileName} from '../src/assets/imagesproducts';
import {officialImageFile} from '../src/services/catalogImageCorpus';

test('official photos resolve to repo-served domain-independent paths',()=>{
 for(let n=1;n<=869;n++){
  const f=`e(${n}).png`;
  assert.equal(getProductImageUrl(f),'/products/catalog/'+f);
  assert.equal(getProductImageUrl('/storage/products/catalog/'+f),'/products/catalog/'+f);
  assert.equal(getProductImageUrl('https://raw.githubusercontent.com/javanweb/imagesatlas/main/'+f),'/products/catalog/'+f);
 }
 assert.equal(normalizeImageFileName('e(870).png'),'');
});
test('runtime uploaded gallery files remain on persistent volume until publication',()=>{
 const id='76bf63c1-e7f9-40a1-bf5b-2d1ec98bf223';
 assert.equal(getProductImageUrl('/storage/products/'+id+'.webp'),'/storage/products/'+id+'.webp');
 assert.equal(getProductImageUrl('https://images.other.example/img.png'),'https://images.other.example/img.png');
});

test('recognition keeps the same official image identity after domain-independent cutover',()=>{
  assert.equal(officialImageFile('/products/catalog/e(1).png'),'e(1).png');
  assert.equal(officialImageFile('/products/catalog/e(869).png'),'e(869).png');
  assert.equal(officialImageFile('/products/catalog/e(870).png'),undefined);
});
test('new admin media has immutable URLs and responsive paths without SKU inference',()=>{
  const id='76bf63c1-e7f9-40a1-bf5b-2d1ec98bf223',sha='0123456789ab';
  const medium='/products/uploads/optimized/'+id+'.'+sha+'.w960.webp';
  assert.equal(getProductImageUrl(medium),medium);
  assert.equal(getProductImageUrl('/products/uploads/'+id+'.png'),'/products/uploads/'+id+'.png');
  assert.equal(officialImageFile(medium),undefined);
});
