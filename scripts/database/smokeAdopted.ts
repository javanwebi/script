/**
 * Read-only online PostgreSQL smoke test. Run on a staging database with a
 * secure server-only DATABASE_URL, never in the browser. Makes zero DDL/DML writes.
 */
import 'dotenv/config';
import {database,closeDatabase,assertProductionDatabaseConfig} from '../../server/db/connection';
const objects=[
 'public.user_profiles','public.catalog_families','public.catalog_variants',
 'public.variant_commercial_specs','public.orders','public.order_items',
 'public.price_inquiries','public.agency_applications','public.support_tickets',
 'public.portal_kv_store','app_private.portal_version','app_private.document_versions'
];
try{
 assertProductionDatabaseConfig();
 const db=database();
 const missing:string[]=[];
 for(const object of objects){
  const row=(await db.query('select to_regclass($1) is not null as exists',[object])).rows[0];
  if(!row?.exists)missing.push(object);
 }
 if(missing.length)throw new Error('Required adopted tables are absent: '+missing.join(', '));
 const familyCount=Number((await db.query('select count(*)::bigint as n from public.catalog_families')).rows[0].n);
 const variantCount=Number((await db.query('select count(*)::bigint as n from public.catalog_variants')).rows[0].n);
 const version=Number((await db.query('select revision from app_private.portal_version where singleton=true')).rows[0]?.revision);
 if(!Number.isFinite(version))throw new Error('app_private.portal_version has no valid singleton revision');
 if(familyCount<=0 || variantCount<=0)throw new Error('Live catalog tables are empty');
 const pending=(await db.query("select not exists (select 1 from app_private.schema_change_log where version = '20261022120000') as migration_pending")).rows[0].migration_pending;
 console.log(JSON.stringify({status:'read-only-smoke-passed',familyCount,variantCount,portalRevision:version,migration20261022120000Pending:pending},null,2));
} catch(error){
 console.error('Read-only database verification failed:',error instanceof Error?error.message:error);
 process.exitCode=1;
} finally {
 await closeDatabase();
}
