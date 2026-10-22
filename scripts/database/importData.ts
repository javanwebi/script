import {clientDefaults} from './clientDefaults';
import {DEFAULT_BANNERS,DEFAULT_ANNOUNCEMENTS,DEFAULT_CLUB_MILESTONES,DEFAULT_CONSUMER_CLUB_MILESTONES,DEFAULT_PORTAL_CONFIGS} from '../../src/services/portalContentService';
import {INITIAL_BANNERS,INITIAL_CLUB_CONFIG,INITIAL_SMS_TEMPLATES,adminService} from '../../src/services/adminService';
import {INITIAL_PRICE_LISTS} from '../../src/services/pricingCreditService';
import fs from 'node:fs/promises';import crypto from 'node:crypto';import {sourceInventory} from './sourceInventory';
import {getManagedCatalogProducts,normalizeMergedProduct} from '../../src/data/mockGenerator';import {USER_PRODUCTS_RAW} from '../../src/data/userProducts';import {BRANDS} from '../../src/data/brands';import {CATEGORIES} from '../../src/data/categories';
import {persistUsers,writeDocument,saveProducts} from '../../server/db/repository';import type {SqlClient} from '../../server/db/connection';import {domainFor} from '../../server/db/namespaces';
export async function importSourceData(client:SqlClient,options:{portalPath?:string;overridesPath?:string;browserExportPath?:string}={}){
 const sources=await sourceInventory();
 const runtimeHashes=[];for(const file of [options.portalPath,options.overridesPath,options.browserExportPath].filter(Boolean) as string[])runtimeHashes.push(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'));
 const digest=crypto.createHash('sha256').update(JSON.stringify({sources:sources.map(({payload,...source})=>source),runtimeHashes,seedVersion:3})).digest('hex');
 const exists=(await client.query('select id from app_private.import_runs where manifest_sha256=$1 and status=$2',[digest,'complete'])).rows.length;if(exists)return {alreadyImported:true,manifestSha256:digest};
 for(const source of sources)await client.query('insert into app_private.source_archives(source_path,sha256,payload) values($1,$2,$3) on conflict do nothing',[source.path,source.sha256,JSON.stringify(source.payload)]);
 const defaults={atlas_clients_logos_v3_moshtari:await clientDefaults(),atlas_admin_banners_v1:INITIAL_BANNERS,atlas_admin_club_config_v1:INITIAL_CLUB_CONFIG,atlas_admin_sms_templates_v1:INITIAL_SMS_TEMPLATES,atlas_admin_settings_v1:adminService.getSettings(),atlas_price_lists_v2:INITIAL_PRICE_LISTS,atlas_portal_content_banners_v1:DEFAULT_BANNERS,atlas_portal_content_announcements_v1:DEFAULT_ANNOUNCEMENTS,atlas_portal_club_milestones_v1:{consumer:DEFAULT_CONSUMER_CLUB_MILESTONES,high_volume:DEFAULT_CLUB_MILESTONES},atlas_portal_layout_configs_v1:DEFAULT_PORTAL_CONFIGS};
 const runtimeOverrides=options.overridesPath?JSON.parse(await fs.readFile(options.overridesPath,'utf8')):null;
 const productMap=new Map(getManagedCatalogProducts({includeInactive:true}).map(product=>[product.code,product]));
 if(runtimeOverrides)for(const [code,override] of Object.entries(runtimeOverrides.families || {}))productMap.set(code,normalizeMergedProduct(productMap.get(code) || null,override as any));
 const fixtures=new Set(['34265-Z18','34265-Z22','34265-Z28']);
 const products=[...productMap.values()].map(product=>({...product,active:runtimeOverrides?.deletedCodes?.includes(product.code)?false:product.active,variants:product.variants?.map(variant=>fixtures.has(variant.code)?{...variant,active:false}:variant)}));
 // Import is additive. An existing live catalogue is never silently overwritten by a source seed.
 const old=(await client.query('select count(*)::int as count from public.product_families')).rows[0].count;
 if(old)throw new Error('Destination catalogue is not empty: reconcile a reviewed import plan instead of overwriting it');
 await saveProducts(client,products);
 await writeDocument(client,'catalogue/base',USER_PRODUCTS_RAW,'global',undefined,'reference');
 for(const [key,value] of Object.entries(defaults))await writeDocument(client,key,value);
 await writeDocument(client,'atlas_admin_brands_v1',BRANDS);await writeDocument(client,'atlas_admin_categories_v1',CATEGORIES);
 const overrides=runtimeOverrides || sources.find(source=>source.path==='src/data/catalogOverridesDb.json')?.payload;
 if(overrides)await writeDocument(client,'catalog_overrides/runtime',overrides,'global',undefined,'catalog_overrides');
 let users=0;
 if(options.portalPath){const portal=JSON.parse(await fs.readFile(options.portalPath,'utf8'));const sha=crypto.createHash('sha256').update(JSON.stringify(portal)).digest('hex');await client.query('insert into app_private.source_archives(source_path,sha256,payload) values($1,$2,$3) on conflict do nothing',['runtime/portal.json',sha,JSON.stringify(portal)]);await persistUsers(client,portal.users || []);users=portal.users?.length || 0;for(const [key,value] of Object.entries(portal.values || {}))if(domainFor(key))await writeDocument(client,key,value);await client.query('update app_private.portal_version set revision=$1 where singleton=true',[portal.revision || 0]);}
 if(options.browserExportPath){const browser=JSON.parse(await fs.readFile(options.browserExportPath,'utf8'));await client.query('insert into app_private.source_archives(source_path,sha256,payload) values($1,$2,$3) on conflict do nothing',['runtime/browser-export.json',crypto.createHash('sha256').update(JSON.stringify(browser)).digest('hex'),JSON.stringify(browser)]);/* Untrusted browser financial records require reconciliation, never automatic promotion. */}
 const counts={families:products.length,variants:products.reduce((count,p)=>count+(p.variants?.length || 0),0),sourceFiles:sources.length,users};
 await client.query('insert into app_private.import_runs(manifest_sha256,source,status,counts) values($1,$2,$3,$4)',[digest,'repository-and-reviewed-runtime-export','complete',JSON.stringify(counts)]);
 return {...counts,manifestSha256:digest};
}
