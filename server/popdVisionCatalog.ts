import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {activeCatalogDirectory,productStorageDirectory} from './productImageStorage';
import {readReferenceVisionProducts} from './catalogReferenceApi';
import {buildPopdVisionCorpus} from '../src/services/catalogImageCorpus';

// The deployer verifies each PNG against the pinned POPD Git tree and atomically
// selects an immutable release directory. Cache its content hashes, not legacy
// audit metadata, and invalidate on an actual release change.
let cached:{directory:string;promise:Promise<Map<string,string>>}|undefined;
async function actualRevisions(){
 const directory=await fs.realpath(await activeCatalogDirectory(productStorageDirectory()));
 if(cached?.directory===directory)return cached.promise;
 const promise=(async()=>{
  const hashes=new Map<string,string>();
  const names=Array.from({length:869},(_,i)=>'e('+(i+1)+').png');
  for(let offset=0;offset<names.length;offset+=8){
   await Promise.all(names.slice(offset,offset+8).map(async name=>{
    const bytes=await fs.readFile(path.join(directory,name));
    if(bytes.length<1000 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
     throw new Error('Invalid mounted POPD photo: '+name);
    hashes.set(name,createHash('sha256').update(bytes).digest('hex'));
   }));
  }
  return hashes;
 })();
 cached={directory,promise};
 try{return await promise;}catch(error){if(cached?.promise===promise)cached=undefined;throw error;}
}
export async function readPopdVisionCatalog(){
 const [products,revisions]=await Promise.all([readReferenceVisionProducts(),actualRevisions()]);
 return {products,images:buildPopdVisionCorpus(products,revisions)};
}
