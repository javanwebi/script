import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {database,closeDatabase,adoptedSchema} from '../../server/db/connection';
const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"';
try{
 if(!adoptedSchema())throw new Error('DATABASE_SCHEMA=adopted is required');
 const db=database(),manifest=JSON.parse(await readFile('docs/database/sanatpishatlas-transfer.json','utf8'));
 const tables=(await db.query("select count(*)::int as n,count(*) filter(where not c.relrowsecurity)::int as unprotected from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")).rows[0];
 if(tables.n<63 || tables.unprotected!==0)throw new Error('Missing tables or RLS');
 const invalid=(await db.query("select count(*)::int as n from pg_constraint where contype='f' and not convalidated")).rows[0].n;if(invalid)throw new Error('Unvalidated foreign keys');
 const sql=manifest.tables.map((t:any)=>`select '${t.name}' as name,count(*)::bigint as n,md5(coalesce(string_agg(md5(jsonb_build_array(${t.columns.map(quote).join(',')})::text),'' order by ${t.primaryKey.map(quote).join(',')}),'')) as digest from public.${quote(t.name)}`).join(' union all ');
 const rows:{name:string;n:string;digest:string}[]=(await db.query(sql)).rows;
 const changed=rows.filter(row=>{const original=manifest.tables.find((t:any)=>t.name===row.name);return Number(row.n)!==Number(original.n)||row.digest!==original.digest;});
 if(changed.length)throw new Error('Source verification differs for: '+changed.map(r=>r.name).join(', '));
 const probe='__verify_connection_'+randomUUID();const client=await db.connect();try{
  await client.query('begin');await client.query('insert into public.portal_kv_store(key,value) values($1,$2)',[probe,JSON.stringify({probe:true})]);
  const result=(await client.query('select value from public.portal_kv_store where key=$1',[probe])).rows[0];if(result?.value?.probe!==true)throw new Error('Read/write failed');
  await client.query('set local role anon');
  await client.query(`do $$declare n integer;begin
   begin perform retail_price from public.variant_commercial_specs limit 1;raise exception 'Commercial data is public';exception when insufficient_privilege then null;end;
   begin select count(*) into n from public.portal_kv_store;if n<>0 then raise exception 'Private documents are public';end if;exception when insufficient_privilege then null;end;
  end$$`);
 }finally{await client.query('rollback');client.release();}
 if((await db.query('select 1 from public.portal_kv_store where key=$1',[probe])).rows.length)throw new Error('Rollback failed');
 console.log(JSON.stringify({database:'verified',publicTables:tables.n,sourceTables:rows.length,sourceRows:rows.reduce((sum,r)=>sum+Number(r.n),0),originalColumnDigestsMatch:true,foreignKeysValidated:true,transactionReadWriteRollback:true,anonymousIsolation:true}));
}catch(error:any){console.error('Database verification failed:',error.code || error.message);process.exitCode=1;}finally{await closeDatabase();}
