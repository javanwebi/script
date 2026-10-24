#!/usr/bin/env node
/** CI guard: operational catalog data must come from PostgreSQL, not bundled JSON. */
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const operationalRoots=['src','server'];
const errors=[];
async function scan(dir){
 for(const item of await readdir(dir,{withFileTypes:true})){
  const full=path.join(dir,item.name);
  if(item.isDirectory()){await scan(full);continue;}
  if(!/\.(?:ts|tsx|js|mjs)$/.test(item.name))continue;
  const source=await readFile(full,'utf8');
  // Keep JSON serialization and HTTP media types: they are protocols, not local state.
  if(/(?:import\s+[^;]+?from\s*|require\s*\()\s*['"][^'"]+\.json['"]/.test(source))
   errors.push(full+': static JSON import');
  if(/(?:readFileSync|writeFileSync|readFile|writeFile)\s*\([^\n]*?(?:src[\\/]data|catalogueSource|imageEmbeddings|imageHashes)[^\n]*?\.json/.test(source))
   errors.push(full+': operational catalog file I/O');
 }
}
for(const root of operationalRoots)await scan(root);
const operational=(await readdir('src/data')).filter(n=>n.endsWith('.json'));
if(operational.length)errors.push(...operational.map(n=>'src/data/'+n+': bundled JSON remains'));
if(errors.length){
 console.error('Runtime JSON retirement FAILED:\n'+errors.join('\n'));
 process.exitCode=1;
}else console.log('Runtime JSON retirement verified: no static JSON imports or src/data/*.json');
