import fs from 'node:fs/promises';
import path from 'node:path';
import {hashStringSync, generateUUID} from '../utils/cryptoUtils';
import sharp from 'sharp';
import type {CatalogImageRecord} from './catalogImageCorpus';

export type EmbedImages=(buffers:Buffer[])=>Promise<number[][]>;
type Entry={signature:string;vector:number[]};
export interface VisualIndexPersistence { loadEntries():Promise<Record<string,Entry>>; saveEntries(rows:Array<{id:string;signature:string;vector:number[]}>):Promise<void>; }
export interface VisualIndexOptions {model:string;dimensions:number;batchSize?:number;concurrency?:number;imageSize?:number;}
const defaults:VisualIndexOptions={model:'gemini-embedding-2:768',dimensions:768,batchSize:6,concurrency:3,imageSize:768};
const signature=(row:CatalogImageRecord)=>hashStringSync(JSON.stringify([row.url,row.revision]));
function normalized(value:unknown,dimensions:number):number[] {
 if(!Array.isArray(value)||value.length!==dimensions||!value.every(n=>typeof n==='number'&&Number.isFinite(n)))throw new Error('Invalid visual embedding');
 const norm=Math.hypot(...value);if(norm<1e-10)throw new Error('Empty visual embedding');
 return value.map(n=>n/norm);
}
/** This index only retrieves candidates. It never certifies a SKU or physical compatibility. */
export class CatalogVisualIndex {
 private entries=new Map<string,Entry>();
 private loaded=false;
 private writes:Promise<void>=Promise.resolve();
 private building?:Promise<void>;
 constructor(private file:string, private persistence?:VisualIndexPersistence, private options:VisualIndexOptions=defaults){}
 async load(){
  if(this.loaded)return;
  try{const saved=this.persistence?{model:this.options.model,entries:await this.persistence.loadEntries()}:JSON.parse(await fs.readFile(this.file,'utf8'));if(saved.model===this.options.model)for(const [id,entry] of Object.entries(saved.entries || {}) as [string,Entry][]){
   try{this.entries.set(id,{signature:entry.signature,vector:normalized(entry.vector,this.options.dimensions)});}catch{}
  }
  this.loaded=true;
  }catch(error){if(this.persistence)throw error;this.loaded=true;}
 }
 coverage(images:CatalogImageRecord[]){const indexed=images.filter(row=>this.entries.get(row.id)?.signature===signature(row)).length;return {total:images.length,indexed,ready:indexed===images.length};}
 async update(images:CatalogImageRecord[],read:(row:CatalogImageRecord)=>Promise<Buffer|null>,embed:EmbedImages){
  await this.load();
  if(this.building){await this.building;if(this.coverage(images).ready)return;}
  const task=(async()=>{
   const missing=images.filter(row=>this.entries.get(row.id)?.signature!==signature(row));
   let next=0,stopped=false;
   const batchSize=this.options.batchSize || 6;
   const outcomes=await Promise.allSettled(Array.from({length:Math.min(this.options.concurrency || 3,Math.ceil(missing.length/batchSize))},async()=>{
   try{while(next<missing.length && !stopped){
    const offset=next;next+=batchSize;const rows=missing.slice(offset,offset+batchSize);
    const loaded=await Promise.all(rows.map(async row=>{
     try{
      const bytes=await read(row);if(!bytes)return null;
      const buffer=await sharp(bytes).rotate().resize(this.options.imageSize || 768,this.options.imageSize || 768,{fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:92}).toBuffer();
      return {row,buffer};
     }catch(error:any){
      console.warn('[Visual index] Image unavailable for this pass:',row.id,String(error?.message || 'read_failed').slice(0,120));
      return null;
     }
    }));
    const usable=loaded.filter((item):item is NonNullable<typeof item>=>item!==null);
    if(!usable.length)continue;
    const vectors=await embed(usable.map(item=>item.buffer));if(vectors.length!==usable.length)throw new Error('Embedding count mismatch');
    const entries=vectors.map((v,i)=>({id:usable[i].row.id,signature:signature(usable[i].row),vector:normalized(v,this.options.dimensions)}));
    // Persist each batch before publishing it in memory. A failed database/file
    // write must never make coverage look complete for vectors that cannot survive restart.
    const write=this.writes.catch(()=>{}).then(async()=>{
     if(this.persistence) await this.persistence.saveEntries(entries);
     else {
      const merged=new Map(this.entries);
      for(const entry of entries)merged.set(entry.id,{signature:entry.signature,vector:entry.vector});
      await fs.mkdir(path.dirname(this.file),{recursive:true});
      const temp=this.file+'.'+generateUUID()+'.tmp';
      await fs.writeFile(temp,JSON.stringify({model:this.options.model,entries:Object.fromEntries(merged)}),{mode:0o600});
      await fs.rename(temp,this.file);
     }
    });this.writes=write;await write;
    for(const entry of entries)this.entries.set(entry.id,{signature:entry.signature,vector:entry.vector});
    if(this.options.concurrency===1)await new Promise(resolve=>setTimeout(resolve,50));
   }}catch(error){stopped=true;throw error;}
   }));
   const failure=outcomes.find(result=>result.status==='rejected');
   if(failure?.status==='rejected')throw failure.reason;

  })();this.building=task;
  try{await task;}finally{if(this.building===task)this.building=undefined;}
 }
 async rank(query:Buffer,images:CatalogImageRecord[],embed:EmbedImages,limit=48){
  await this.load();if(!this.coverage(images).ready)return null; // Never quietly exclude unindexed new products.
  const full=await sharp(query).rotate().resize(this.options.imageSize || 768,this.options.imageSize || 768,{fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:92}).toBuffer();
  const vectors=await embed([full]);if(vectors.length!==1)throw new Error('Query embedding missing');
  return this.rankVectors(vectors,images,limit);
 }
 async rankVectors(vectors:number[][],images:CatalogImageRecord[],limit=48,independentViews=false){
  await this.load();if(!this.coverage(images).ready)return null;
  if(!vectors.length || vectors.length>4)throw new Error('Invalid query views');
  const queries=vectors.map(v=>normalized(v,this.options.dimensions));
  return images.map(row=>{
   const vector=this.entries.get(row.id)!.vector;
   const viewScores=queries.map(q=>vector.reduce((sum,n,i)=>sum+n*q[i],0));
   const bestCrop=viewScores.length>1?Math.max(...viewScores.slice(1)):viewScores[0];
   const score=independentViews ? Math.max(...viewScores) : viewScores.length===1 ? viewScores[0] : Math.max(viewScores[0],0.25*viewScores[0]+0.75*bestCrop);
   return {row,score,viewScores};
  }).sort((a,b)=>b.score-a.score || a.row.id.localeCompare(b.row.id)).slice(0,limit);
 }

 async retrieve(query:Buffer,images:CatalogImageRecord[],embed:EmbedImages,limit=48){
  return (await this.rank(query,images,embed,limit))?.map(hit=>hit.row) ?? null;
 }

}
