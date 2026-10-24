import assert from 'node:assert/strict';
import test from 'node:test';
import {getProductImageUrl,normalizeImageFileName} from '../src/assets/imagesproducts';

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
