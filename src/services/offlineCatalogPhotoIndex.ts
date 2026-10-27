import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {photoFingerprint,sameCatalogPhotograph} from './catalogPhotoIdentity';
import type {CatalogImageRecord} from './catalogImageCorpus';

/**
 * CPU-only catalogue photo retrieval. This is similarity search, NOT a part
 * recognizer, verified SKU matcher, embedding model, or compatibility checker.
 * No external service or model is contacted.
 */
type Descriptor = {
  luminance:number[];
  contour:number[];
  foreground:number[];
  hash:number[];
  histogram:number[];
};
type Stored = {key:string; descriptor:Descriptor};
export type OfflinePhotoHit = {image:CatalogImageRecord;score:number;identicalPhotograph:boolean};
export type OfflinePhotoProgress = {stage:'preparing'|'scanning'|'verifying'|'complete';total:number;compared:number;failed:number};
export type OfflinePhotoResult = {
  hits:OfflinePhotoHit[];
  coverage:{total:number;compared:number;failed:number;complete:boolean;providerAvailable:boolean;failedImageIds:string[]};
};

const SIDE=96, CELLS=12;
function imageKey(image:CatalogImageRecord) {
  return createHash('sha256').update(JSON.stringify([image.id,image.url,image.revision])).digest('hex');
}
function mean(values:number[]) {return values.reduce((sum,n)=>sum+n,0)/Math.max(1,values.length);}
function at(values:number[],x:number,y:number,rotation:number) {
  if(rotation===1)return values[(CELLS-1-x)*CELLS+y];
  if(rotation===2)return values[(CELLS-1-y)*CELLS+(CELLS-1-x)];
  if(rotation===3)return values[x*CELLS+(CELLS-1-y)];
  return values[y*CELLS+x];
}
function validate(value:unknown):value is Descriptor {
  const d=value as Descriptor;
  return Boolean(d && typeof d==='object' &&
    ['luminance','contour','foreground','hash','histogram'].every(k=>{
      const a=(d as unknown as Record<string,unknown>)[k];
      return Array.isArray(a) && a.every(v=>typeof v==='number' && Number.isFinite(v));
    }) &&
    d.luminance.length===CELLS*CELLS && d.contour.length===CELLS*CELLS &&
    d.foreground.length===CELLS*CELLS && d.hash.length===64 && d.histogram.length===16);
}

/** Extract a compact signature from actual image pixels, not names or captions. */
export async function describeOfflineImage(bytes:Buffer):Promise<Descriptor> {
  if(!bytes.length || bytes.length>10*1024*1024)throw new Error('Image size is invalid');
  const pixels=await sharp(bytes,{limitInputPixels:40_000_000})
    .rotate().flatten({background:'#fff'}).resize(SIDE,SIDE,{fit:'contain',background:'#fff'})
    .greyscale().raw().toBuffer();
  if(pixels.length!==SIDE*SIDE)throw new Error('Unexpected image raster');
  const histogram=Array(16).fill(0);
  for(let i=0;i<pixels.length;i++)histogram[Math.min(15,Math.floor(pixels[i]/16))]++;
  const luminance:number[]=[],contour:number[]=[],foreground:number[]=[];
  const gradient=(x:number,y:number)=>{
    const i=y*SIDE+x;
    return Math.min(255,Math.abs(pixels[i+1]-pixels[i-1])+Math.abs(pixels[i+SIDE]-pixels[i-SIDE]));
  };
  for(let y=0;y<CELLS;y++)for(let x=0;x<CELLS;x++){
    let l=0,e=0,f=0;
    for(let dy=0;dy<8;dy++)for(let dx=0;dx<8;dx++){
      const xx=x*8+dx,yy=y*8+dy;
      const v=pixels[yy*SIDE+xx];
      l+=v;
      f+=v<215?1:0;
      if(xx>0&&xx<SIDE-1&&yy>0&&yy<SIDE-1)e+=gradient(xx,yy);
    }
    luminance.push(Math.round(l/64));
    contour.push(Math.round(e/64));
    foreground.push(Math.round(f/64*255));
  }
  const hash:number[]=[];
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const yy=6+y*12,xx=5+x*10;
    hash.push(pixels[yy*SIDE+xx]>pixels[yy*SIDE+xx+8]?1:0);
  }
  return {luminance,contour,foreground,hash,histogram:histogram.map(n=>n/pixels.length)};
}
function similarity(a:Descriptor,b:Descriptor):number {
  let best=0;
  for(let r=0;r<4;r++){
    let l=0,c=0,f=0;
    for(let i=0;i<CELLS*CELLS;i++){
      const x=i%CELLS,y=Math.floor(i/CELLS);
      l+=Math.abs(a.luminance[i]-at(b.luminance,x,y,r));
      c+=Math.abs(a.contour[i]-at(b.contour,x,y,r));
      f+=Math.abs(a.foreground[i]-at(b.foreground,x,y,r));
    }
    const avg=CELLS*CELLS*255;
    // Penalize strong geometric disagreements; brightness has low weight.
    const score=0.20*(1-l/avg)+0.45*(1-c/avg)+0.30*(1-f/avg);
    if(score>best)best=score;
  }
  let hist=0,hash=0;
  for(let i=0;i<16;i++)hist+=Math.abs(a.histogram[i]-b.histogram[i]);
  for(let i=0;i<64;i++)if(a.hash[i]===b.hash[i])hash++;
  // Scores are only relative ranking signals, never probabilities.
  return Math.max(0,Math.min(1,best+0.035*(1-hist/2)+0.015*(hash/64)));
}

/** Optional persisted, incrementally refreshed descriptors; safe on read-only hosts. */
export class OfflineCatalogPhotoIndex {
  private entries=new Map<string,Stored>();
  private loaded=false;
  private building?:Promise<void>;
  constructor(private readonly persistenceFile?:string){}
  private async load() {
    if(this.loaded)return;
    this.loaded=true;
    if(!this.persistenceFile)return;
    try {
      const saved=JSON.parse(await fs.readFile(this.persistenceFile,'utf8'));
      if(saved?.version!==1 || !saved.entries || typeof saved.entries!=='object')return;
      for(const [id,item] of Object.entries(saved.entries) as [string,Stored][])
        if(item && typeof item.key==='string' && validate(item.descriptor))
          this.entries.set(id,item);
    }catch{/* New deployment or unavailable cache: rebuild without failing the request. */}
  }
  private async persist() {
    if(!this.persistenceFile)return;
    try {
      await fs.mkdir(path.dirname(this.persistenceFile),{recursive:true});
      const temp=this.persistenceFile+'.'+randomUUID()+'.tmp';
      await fs.writeFile(temp,JSON.stringify({version:1,entries:Object.fromEntries(this.entries)}),{mode:0o600});
      await fs.rename(temp,this.persistenceFile);
    }catch{/* Caching is an optimization, not a dependency. */}
  }
  private async ensure(images:CatalogImageRecord[],read:(row:CatalogImageRecord)=>Promise<Buffer|null>,progress?:(state:OfflinePhotoProgress)=>void) {
    await this.load();
    if(this.building)await this.building;
    const missing=images.filter(image=>this.entries.get(image.id)?.key!==imageKey(image));
    if(!missing.length)return;
    let next=0;
    let completed=images.length-missing.length;
    let failed=0;
    const task=(async()=>{
      await Promise.all(Array.from({length:Math.min(6,missing.length)},async()=>{
        while(next<missing.length){
          const row=missing[next++];
          try {
            const bytes=await read(row);
            if(!bytes)throw new Error('Image unavailable');
            this.entries.set(row.id,{key:imageKey(row),descriptor:await describeOfflineImage(bytes)});
          } catch {
            this.entries.delete(row.id);failed++;
          }
          completed++;
          progress?.({stage:'preparing',total:images.length,compared:completed-failed,failed});
        }
      }));
      const ids=new Set(images.map(row=>row.id));
      for(const id of this.entries.keys())if(!ids.has(id))this.entries.delete(id);
      await this.persist();
    })();
    this.building=task;
    try{await task;}finally{if(this.building===task)this.building=undefined;}
  }
  async search(query:Buffer,images:CatalogImageRecord[],read:(row:CatalogImageRecord)=>Promise<Buffer|null>,
    options:{limit?:number;progress?:(state:OfflinePhotoProgress)=>void}={}):Promise<OfflinePhotoResult> {
    const limit=Math.max(1,Math.min(30,Math.floor(options.limit??12)));
    await this.ensure(images,read,options.progress);
    const descriptor=await describeOfflineImage(query);
    const usable=images.filter(row=>this.entries.get(row.id)?.key===imageKey(row));
    const failedImageIds=images.filter(row=>this.entries.get(row.id)?.key!==imageKey(row)).map(row=>row.id);
    options.progress?.({stage:'scanning',total:images.length,compared:usable.length,failed:failedImageIds.length});
    const ranked=usable.map(image=>({image,score:Math.round(similarity(descriptor,this.entries.get(image.id)!.descriptor)*1000)/10}))
      .sort((a,b)=>b.score-a.score||a.image.id.localeCompare(b.image.id));
    // A strict same-photo check can only support a verified SKU-specific image.
    // High visual similarity, even 100, never qualifies as exact part identity.
    const queryPhoto=await photoFingerprint(query);
    const top=ranked.slice(0,Math.max(30,limit));
    const duplicates=new Set<string>();
    options.progress?.({stage:'verifying',total:images.length,compared:usable.length,failed:failedImageIds.length});
    await Promise.all(top.map(async hit=>{
      try {
        const bytes=await read(hit.image);
        if(bytes&&sameCatalogPhotograph(queryPhoto,await photoFingerprint(bytes)))duplicates.add(hit.image.id);
      }catch{/* Keep ranked candidates if verification is unavailable. */}
    }));
    const hits=[...ranked].sort((a,b)=>Number(duplicates.has(b.image.id))-Number(duplicates.has(a.image.id))||b.score-a.score)
      .slice(0,limit).map(hit=>({...hit,identicalPhotograph:duplicates.has(hit.image.id)}));
    const coverage={total:images.length,compared:usable.length,failed:failedImageIds.length,
      complete:failedImageIds.length===0,providerAvailable:true,failedImageIds};
    options.progress?.({stage:'complete',total:images.length,compared:usable.length,failed:failedImageIds.length});
    return {hits,coverage};
  }
}
