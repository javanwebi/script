import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDefaultGalleryImages } from '../src/data/mockGenerator';
import type { Product } from '../src/types';

test('gallery preserves exact code ownership, includes variant-owned photos and rejects orphan bindings', () => {
  const product = {
    code: 'family', name: 'قطعات', images: ['family.png'],
    variants: [{code:'A',name:'قطعه A',images:['a.png']},{code:'B',name:'قطعه B',images:[]}],
    galleryImages: [
      {id:'family',url:'family.png',scope:'family'},
      {id:'a',url:'a.png',scope:'variant',variantCode:'A'},
      {id:'orphan',url:'other.png',scope:'variant',variantCode:'DELETED'},
    ],
  } as Product;
  const gallery = buildDefaultGalleryImages(product);
  assert.equal(gallery.filter(img => img.variantCode === 'A').length,1);
  assert.equal(gallery.findIndex(img => img.variantCode === 'B'),-1);
  assert.ok(!gallery.some(img => img.url === 'other.png'));
  product.variants![1].images=['b.png'];
  const linked = buildDefaultGalleryImages(product).find(img => img.variantCode === 'B');
  assert.equal(linked?.url,'b.png');
  assert.equal(linked?.scope,'variant');
  assert.equal(product.galleryImages!.length,3);
});

test('an unbound family photo never becomes a dedicated photo, even for a singleton SKU', () => {
  const gallery=buildDefaultGalleryImages({code:'family',name:'قطعه',images:['example.png'],variants:[{code:'A',name:'قطعه'}]} as Product);
  assert.equal(gallery.length,1);
  assert.equal(gallery[0].scope,'family');
  assert.equal(gallery[0].variantCode,undefined);
});
