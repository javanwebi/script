import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {adoptedDatabase} from './adopted.fixture';

test('manual Supabase SQL is executable and idempotent in an isolated PostgreSQL fixture',async()=>{
 const script=await readFile('docs/database/sql/Apply_On_SanatPishAtlas_Now.sql','utf8');
 assert.match(script,/\bBEGIN;/);
 assert.match(script,/\bCOMMIT;\s*$/);
 assert.match(script,/do \$backfill_gate\$\s*declare\s*v_res jsonb;/i);
 assert.match(script,/end\$backfill_gate\$;/i);
 assert.doesNotMatch(script,/do \$\s*declare\s*v_res jsonb;/i);
 const db=await adoptedDatabase();
 try{
  await db.exec(script);
  const count=Number((await db.query<any>("select count(*)::int as n from app_private.schema_change_log where version='20261022120000'")).rows[0].n);
  assert.equal(count,1);
  // A second run must not multiply records or alter migration history.
  await db.exec(script);
  const repeated=Number((await db.query<any>("select count(*)::int as n from app_private.schema_change_log where version='20261022120000'")).rows[0].n);
  assert.equal(repeated,1);
 }finally{await db.close();}
});
