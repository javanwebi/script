#!/usr/bin/env node
/**
 * READ-ONLY catalogue reconciliation against the configured PostgreSQL/Supabase database.
 * This script MUST pass, followed by an authenticated runtime smoke test and a verified
 * production backup/restore, before anyone removes bundled catalogue JSON files.
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/database/verify-catalogue-parity.mjs
 * Never log connection strings, credentials or complete customer records.
 */
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for read-only catalogue reconciliation.');
  process.exit(2);
}
const source=JSON.parse(await readFile(new URL('../../src/data/catalogueSource.json',import.meta.url),'utf8'));
if(!Array.isArray(source))throw new Error('Expected an array of source catalogue families');
const expectedFamilyCodes=new Set(source.map(f=>String(f.code)));
const sourceVariantCodes=source.flatMap(f=>(f.variants||[]).map(v=>String(v.code)));
const expectedVariantCodes=new Set(sourceVariantCodes);
const unique=(items)=>new Set(items).size===items.length;
if(!unique(source.map(f=>String(f.code)))||!unique(sourceVariantCodes))throw new Error('Source catalogue has duplicate family or SKU codes');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
const client=await pool.connect();
try {
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const [families,variants,gallery,audit,features,summary]=await Promise.all([
   client.query('select code,name,category_name,subcategory,submenu from public.catalog_families where is_active and not is_deleted order by code'),
   client.query('select code,family_code,name,technical_specs from public.catalog_variants where active order by code'),
   client.query('select id,family_code,variant_code,url from public.catalog_gallery_images'),
   client.query('select file_name from public.catalog_image_audits'),
   client.query('select file_name from public.catalog_image_features'),
   client.query('select code from public.catalog_summary_entries'),
 ]);
 const databaseFamilies=new Set(families.rows.map(x=>x.code));
 const databaseSkus=new Set(variants.rows.map(x=>x.code));
 const sample=(values)=>[...values].slice(0,25);
 const diff=(left,right)=>new Set([...left].filter(code=>!right.has(code)));
 const missingFamilies=diff(expectedFamilyCodes,databaseFamilies);
 const extraFamilies=diff(databaseFamilies,expectedFamilyCodes);
 const missingSkus=diff(expectedVariantCodes,databaseSkus);
 const extraSkus=diff(databaseSkus,expectedVariantCodes);
 const orphanSkus=variants.rows.filter(x=>!databaseFamilies.has(x.family_code));
 const galleryBroken=gallery.rows.filter(x=>!databaseFamilies.has(x.family_code)||(x.variant_code&&!databaseSkus.has(x.variant_code))||!x.url);
 const audited=new Set(audit.rows.map(x=>x.file_name));
 const indexed=new Set(features.rows.map(x=>x.file_name));
 const missingImageFeatures=diff(audited,indexed);
 const missingSpecs=variants.rows.filter(v=>!Array.isArray(v.technical_specs)||!v.technical_specs.length);
 const report={
   source:{families:source.length,skus:sourceVariantCodes.length},
   database:{families:families.rowCount,skus:variants.rowCount,gallery:gallery.rowCount,imageAudits:audit.rowCount,imageFeatures:features.rowCount,summaryEntries:summary.rowCount},
   discrepancies:{
     missingFamilies:{count:missingFamilies.size,sample:sample(missingFamilies)},
     extraFamilies:{count:extraFamilies.size,sample:sample(extraFamilies)},
     missingSkus:{count:missingSkus.size,sample:sample(missingSkus)},
     extraSkus:{count:extraSkus.size,sample:sample(extraSkus)},
     orphanSkus:{count:orphanSkus.length,sample:sample(orphanSkus.map(x=>x.code))},
     galleryBroken:{count:galleryBroken.length,sample:sample(galleryBroken.map(x=>x.id))},
     variantsWithoutTechnicalSpecs:{count:missingSpecs.length,sample:sample(missingSpecs.map(x=>x.code))},
     auditedImagesWithoutFeatures:{count:missingImageFeatures.size,sample:sample(missingImageFeatures)}
   }
 };
 console.log(JSON.stringify(report,null,2));
 const parity=missingFamilies.size===0&&missingSkus.size===0&&orphanSkus.length===0&&galleryBroken.length===0;
 // The JSON input may contain historical codes not present in the live DB;
 // never automatically import, modify, delete or deactivate those records.
 await client.query('ROLLBACK');
 if(!parity){
   console.error('Catalogue parity NOT verified. Preserve all JSON source files. Investigate differences and back up before any migration.');
   process.exitCode=1;
 }else{
   console.log('Catalogue code parity verified (READ ONLY). A backup/restore test and browser/API verification are still required before removing JSON.');
 }
}finally{
 try{await client.query('ROLLBACK')}catch{}
 client.release();
 await pool.end();
}
