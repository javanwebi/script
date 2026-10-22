import 'dotenv/config';
import fs from 'node:fs/promises';import crypto from 'node:crypto';
import {database,closeDatabase,transaction} from '../../server/db/connection';
import {importSourceData} from './importData';
const sha=(value:string|Buffer)=>crypto.createHash('sha256').update(value).digest('hex');
const command=process.argv[2] || 'plan';
try{
 if((await database().query("select to_regclass('public.user_profiles') as adopted")).rows[0].adopted)throw new Error('This target uses the adopted catalog_* / user_profiles schema. Do not apply the legacy profiles/product_families migrations or importer. Use the reviewed SQL under supabase/adopted; see docs/database/ADOPTED_SCHEMA.md.');
 const files=(await fs.readdir('supabase/migrations')).filter(name=>/^\d+_.+\.sql$/.test(name)).sort();
 const migrations=await Promise.all(files.map(async name=>{const sql=await fs.readFile('supabase/migrations/'+name,'utf8');if(!sql.trim())throw new Error('Empty migration: '+name);return {name,version:name.split('_')[0],sha256:sha(sql),sql};}));
 const exists=(await database().query("select to_regclass('app_private.migration_checksums') as name")).rows[0].name;
 const applied=exists?(await database().query('select version,sha256 from app_private.migration_checksums')).rows:[];
 for(const row of applied){const file=migrations.find(m=>m.version===row.version);if(!file || file.sha256!==row.sha256)throw new Error('Applied migration checksum mismatch: '+row.version);}
 const pending=migrations.filter(m=>!applied.some(row=>row.version===m.version));
 const identity=(await database().query('select current_database() as database,inet_server_addr()::text as host')).rows[0];
 const plan={target:identity,environment:process.env.DATABASE_ENV || 'development',migrations:pending.map(({sql,...m})=>m)};const digest=sha(JSON.stringify(plan));
 console.log(JSON.stringify({...plan,planSha256:digest},null,2));if(command==='plan')process.exitCode=0;
 else if(command==='apply' || command==='import'){
  if(process.env.DATABASE_ENV!=='development'){
   if(process.env.PRODUCTION_MIGRATION_APPROVED!=='yes' || process.env.REVIEWED_PLAN_SHA256!==digest)throw new Error('Production requires explicit user approval and the exact reviewed plan SHA256');
   const path=process.env.VERIFIED_BACKUP_PATH;if(!path || !process.env.VERIFIED_BACKUP_SHA256 || sha(await fs.readFile(path))!==process.env.VERIFIED_BACKUP_SHA256)throw new Error('Verified PostgreSQL backup required');
  }
  if(command==='apply')await transaction(async client=>{
   await client.query("select pg_advisory_xact_lock(hashtextextended('sanatpish:migration',0))");
   await client.query('create schema if not exists app_private');
   await client.query('create table if not exists app_private.migration_checksums(version text primary key,name text not null,sha256 text not null,applied_at timestamptz not null default now())');
   await client.query('revoke all on schema app_private from public');
   for(const migration of pending){await client.query(migration.sql);await client.query('insert into app_private.migration_checksums(version,name,sha256) values($1,$2,$3)',[migration.version,migration.name,migration.sha256]);}
  });else {if(pending.length)throw new Error('Apply reviewed pending migrations first');console.log(JSON.stringify(await transaction(client=>importSourceData(client,{portalPath:process.env.IMPORT_PORTAL_PATH,overridesPath:process.env.IMPORT_OVERRIDES_PATH,browserExportPath:process.env.IMPORT_BROWSER_EXPORT_PATH}))));}
 }else throw new Error('Use plan, apply or import');
}finally{await closeDatabase();}
