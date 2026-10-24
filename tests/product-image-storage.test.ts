import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareProductStorage,productStorageDirectory} from '../server/productImageStorage';
import {getProductImageUrl} from '../src/assets/imagesproducts';
import {IMAGE_IMPORT_SOURCES} from '../server/catalogImageVolumeMigration';
import {officialImageFile} from '../src/services/catalogImageCorpus';

test('product image folder is writable and remains outside the Git working tree',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sanat-product-volume-'));
 const prevDir=process.env.PRODUCT_STORAGE_DIR,prevNode=process.env.NODE_ENV;
 try{
  process.env.NODE_ENV='test';
  process.env.PRODUCT_STORAGE_DIR=path.join(tmp,'storage','products');
  const dir=await prepareProductStorage();
  assert.equal(dir,productStorageDirectory());
  assert.ok((await fs.stat(dir)).isDirectory());
  await fs.writeFile(path.join(dir,'volume-check'),Buffer.from('persistent'));
  assert.equal((await fs.readFile(path.join(dir,'volume-check'),'utf8')),'persistent');
 }finally{
  if(prevDir===undefined)delete process.env.PRODUCT_STORAGE_DIR;else process.env.PRODUCT_STORAGE_DIR=prevDir;
  if(prevNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=prevNode;
  await fs.rm(tmp,{recursive:true,force:true});
 }
});

test('official product photos resolve to a pinned CDN release instead of the Railway image volume',()=>{
 const url='/storage/products/00000000-0000-4000-8000-000000000000.webp';
 const pinned='https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@5bbaec971a05771939663d47803b5d5c2c624c6d/';
 assert.equal(getProductImageUrl(url),url); // Old uploaded binaries remain accessible.
 assert.equal(getProductImageUrl('e(1).png'),pinned+'e(1).png');
 assert.equal(getProductImageUrl('https://raw.githubusercontent.com/javanweb/imagesatlas/main/e(1).png'),pinned+'e(1).png');
 assert.equal(getProductImageUrl('/storage/products/catalog/e(869).png'),pinned+'e(869).png');
 assert.equal(getProductImageUrl(pinned+'e(131).png'),pinned+'e(131).png');
 assert.equal(getProductImageUrl('https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@abcdef1234567890abcdef1234567890abcdef12/storage/products/abc.webp'),'https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@abcdef1234567890abcdef1234567890abcdef12/storage/products/abc.webp');
 assert.equal(getProductImageUrl('/storage/products/../private.txt'),'');
});

test('production photo folder requires a mounted path',async()=>{
 const previousDir=process.env.PRODUCT_STORAGE_DIR,previousNode=process.env.NODE_ENV;
 try{
  process.env.NODE_ENV='production';
  process.env.PRODUCT_STORAGE_DIR='storage/products';
  await assert.rejects(prepareProductStorage(),/absolute mounted-volume path/);
 }finally{
  if(previousDir===undefined)delete process.env.PRODUCT_STORAGE_DIR;else process.env.PRODUCT_STORAGE_DIR=previousDir;
  if(previousNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousNode;
 }
});

test('verified source is only the 869 original PNGs from imagesatlas',()=>{
 assert.equal(IMAGE_IMPORT_SOURCES.length,1);
 const [source]=IMAGE_IMPORT_SOURCES;
 assert.equal(source.repo,'javanweb/imagesatlas');
 assert.equal(source.count,869);
 assert.equal(source.target,'catalog');
 assert.ok(source.pattern.test('e(1).png'));
 assert.ok(source.pattern.test('e(869).png'));
 assert.equal(source.pattern.test('e(131).jpg'),false);
 assert.equal(source.pattern.test('../e(1).png'),false);
 assert.equal(officialImageFile('/storage/products/catalog/e(131).png'),'e(131).png');
 assert.equal(officialImageFile('https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@5bbaec971a05771939663d47803b5d5c2c624c6d/e(131).png'),'e(131).png');
 assert.equal(officialImageFile('/storage/products/catalog/../../etc/passwd'),undefined);
});
