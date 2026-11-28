import test from 'node:test';
import assert from 'node:assert/strict';
import { adoptedDatabase } from './adopted.fixture';

test('anonymous quote workflow stores catalog lines only and keeps browser roles out of the tables', async () => {
 const db = await adoptedDatabase();
 try {
  const tables = (await db.query<{ relname: string; relrowsecurity: boolean }>(`
   select c.relname,c.relrowsecurity
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('guest_quote_requests','guest_quote_request_items')
    order by c.relname
  `)).rows;
  assert.deepEqual(tables.map(row => row.relname), ['guest_quote_request_items','guest_quote_requests']);
  assert.ok(tables.every(row => row.relrowsecurity));

  const columns = (await db.query<{ column_name: string }>(`
   select column_name from information_schema.columns
    where table_schema='public' and table_name='guest_quote_requests'
  `)).rows.map(row => row.column_name);
  for (const forbidden of ['customer_name','phone','email','company_name','address','user_id'])
   assert.equal(columns.includes(forbidden), false, `guest request must not store ${forbidden}`);

  const requestKey = '33333333-3333-4333-8333-333333333333';
  const request = (await db.query<{ id: string; request_number: string }>(
   'insert into public.guest_quote_requests(request_key) values($1) returning id,request_number',
   [requestKey]
  )).rows[0];
  assert.ok(request.id);
  assert.equal(Number(request.request_number) > 0, true);
  await db.query(
   'insert into public.guest_quote_request_items(request_id,product_code,product_name,quantity) values($1,$2,$3,$4)',
   [request.id,'A-49','تسمه وی A-49',12]
  );
  assert.equal((await db.query<{ quantity: number }>(
   'select quantity from public.guest_quote_request_items where request_id=$1',
   [request.id]
  )).rows[0].quantity, 12);
  await assert.rejects(db.query(
   'insert into public.guest_quote_request_items(request_id,product_code,product_name,quantity) values($1,$2,$3,$4)',
   [request.id,'A-50','تسمه وی A-50',0]
  ));

  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.guest_quote_requests'));
  await assert.rejects(db.query('insert into public.guest_quote_requests(request_key) values($1)', ['44444444-4444-4444-8444-444444444444']));
  await db.exec('reset role');
 } finally {
  await db.close();
 }
});

test('warehouse operator identities are isolated from generic staff accounts', async () => {
 const db = await adoptedDatabase();
 try {
  const flags = (await db.query<{ relrowsecurity: boolean }>(`
   select c.relrowsecurity from pg_class c
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='app_private' and c.relname='warehouse_operator_accounts'
  `)).rows;
  assert.equal(flags.length, 1);
  assert.equal(flags[0].relrowsecurity, true);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from app_private.warehouse_operator_accounts'));
  await db.exec('reset role');
 } finally {
  await db.close();
 }
});
