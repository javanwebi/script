import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareProductStorage,productStorageDirectory} from '../server/productImageStorage';
import {getProductImageUrl} from '../src/assets/imagesproducts';

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

test('product URLs are served by the same site, without converting them to GitHub links',()=>{
 const url='/storage/products/00000000-0000-4000-8000-000000000000.webp';
 assert.equal(getProductImageUrl(url),url);
 assert.equal(getProductImageUrl('e(1).png'),'https://raw.githubusercontent.com/javanweb/imagesatlas/main/e(1).png');
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
