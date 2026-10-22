import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import type {CatalogImageRecord} from './catalogImageCorpus';

export type EmbedImages=(buffers:Buffer[])=>Promise<number[][]>;
type Entry={signature:string;vector:number[]};
const MODEL='gemini-embedding-2:768';
const signature=(row:CatalogImageRecord)=>createHash('sha256').update(JSON.stringify([row.url,row.revision])).digest('hex');
function normalized(value:unknown):number[] {
 if(!Array.isArray(value)||value.length!==768||!value.every(n=>typeof n==='number'&&Number.isFinite(n)))throw new Error('Invalid visual embedding');
 const norm=Math.hypot(...value);if(norm<1e-10)throw new Error('Empty visual embedding');
 return value.map(n=>n/norm);
}
/** This index only retrieves candidates. It never certifies a SKU or physical compatibility. */
export class CatalogVisualIndex {
 private entries=new Map<string,Entry>();
 private loaded=false;
 private writes:Promise<void>=Promise.resolve();
 private building?:Promise<void>;
 constructor(private file:string){}
 async load(){
  if(this.loaded)return;this.loaded=true;
  try{const saved=JSON.parse(await fs.readFile(this.file,'utf8'));if(saved.model===MODEL)for(const [id,entry] of Object.entries(saved.entries || {}) as [string,Entry][]){
   try{this.entries.set(id,{signature:entry.signature,vector:normalized(entry.vector)});}catch{}
  }}catch{}
 }
 coverage(images:CatalogImageRecord[]){const indexed=images.filter(row=>this.entries.get(row.id)?.signature===signature(row)).length;return {total:images.length,indexed,ready:indexed===images.length};}
 async update(images:CatalogImageRecord[],read:(row:CatalogImageRecord)=>Promise<Buffer|null>,embed:EmbedImages){
  await this.load();
  if(this.building){await this.building;if(this.coverage(images).ready)return;}
  const task=(async()=>{
   const missing=images.filter(row=>this.entries.get(row.id)?.signature!==signature(row));
   let next=0,stopped=false;
   const outcomes=await Promise.allSettled(Array.from({length:Math.min(3,Math.ceil(missing.length/6))},async()=>{
   try{while(next<missing.length && !stopped){
    const offset=next;next+=6;const rows=missing.slice(offset,offset+6);
    const loaded=await Promise.all(rows.map(async row=>{const bytes=await read(row);if(!bytes)throw new Error('Catalogue image unavailable: '+row.id);return sharp(bytes).rotate().resize(768,768,{fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:92}).toBuffer();}));
    const vectors=await embed(loaded);if(vectors.length!==rows.length)throw new Error('Embedding count mismatch');
    const entries=vectors.map((v,i)=>({id:rows[i].id,signature:signature(rows[i]),vector:normalized(v)}));
    for(const entry of entries)this.entries.set(entry.id,{signature:entry.signature,vector:entry.vector});
    // Persist completed batches so a provider interruption does not restart the entire index.
    const write=this.writes.catch(()=>{}).then(async()=>{
     await fs.mkdir(path.dirname(this.file),{recursive:true});
     const temp=this.file+'.'+randomUUID()+'.tmp';
     await fs.writeFile(temp,JSON.stringify({model:MODEL,entries:Object.fromEntries(this.entries)}),{mode:0o600});
     await fs.rename(temp,this.file);
    });this.writes=write;await write;
   }}catch(error){stopped=true;throw error;}
   }));
   const failure=outcomes.find(result=>result.status==='rejected');
   if(failure?.status==='rejected')throw failure.reason;

  })();this.building=task;
  try{await task;}finally{if(this.building===task)this.building=undefined;}
 }
 async retrieve(query:Buffer,images:CatalogImageRecord[],embed:EmbedImages,limit=48){
  await this.load();if(!this.coverage(images).ready)return null; // Never quietly exclude unindexed new products.
  const full=await sharp(query).rotate().resize(768,768,{fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:92}).toBuffer();
  const vectors=await embed([full]);if(vectors.length!==1)throw new Error('Query embedding missing');
  const vector=normalized(vectors[0]);
  return images.map(row=>({row,score:this.entries.get(row.id)!.vector.reduce((sum,n,i)=>sum+n*vector[i],0)})).sort((a,b)=>b.score-a.score || a.row.id.localeCompare(b.row.id)).slice(0,limit).map(hit=>hit.row);
 }
}
