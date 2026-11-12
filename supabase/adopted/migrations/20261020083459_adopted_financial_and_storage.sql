-- Additive, compatible with the adopted user_profiles/catalog_* schema.
-- Existing amounts/currencies are preserved; NO IRR/IRT conversion is performed.
alter table public.variant_commercial_specs add column if not exists stock_reserved integer not null default 0 check(stock_reserved>=0);
alter table public.variant_commercial_specs add column if not exists stock_version bigint not null default 0;
alter table public.orders add column if not exists final_amount numeric(18,2) check(final_amount>=0);
alter table public.orders add column if not exists payment_status text not null default 'unpaid' check(payment_status in ('unpaid','pending_review','paid','refunded'));
alter table public.orders add column if not exists currency text not null default 'IRR' check(currency in ('IRR','IRT'));
alter table public.orders add column if not exists shipping_amount numeric(18,2) not null default 0 check(shipping_amount>=0);
alter table public.club_milestones add column if not exists portal text check(portal in ('consumer','high_volume'));
alter table public.club_milestones add column if not exists min_purchase_volume numeric(18,2) check(min_purchase_volume>=0);
create table public.customer_finance_accounts(user_id uuid primary key references public.user_profiles(id),opening_debt numeric(18,2) not null default 0,opening_wallet numeric(18,2) not null default 0 check(opening_wallet>=0),opening_points bigint not null default 0 check(opening_points>=0),currency text not null check(currency in ('IRR','IRT')),source_reference text not null,created_at timestamptz not null default now());
create table public.financial_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.customer_finance_accounts(user_id),debt_delta numeric(18,2) not null default 0,wallet_delta numeric(18,2) not null default 0,points_delta bigint not null default 0,kind text not null check(kind in ('invoice','payment','refund','earn','redeem','adjustment')),reference text not null,order_id text references public.orders(id),description text not null default '',created_at timestamptz not null default now(),check(debt_delta<>0 or wallet_delta<>0 or points_delta<>0),unique(user_id,reference));
create index financial_entries_user on public.financial_entries(user_id,created_at);
create table public.inventory_events(id uuid primary key default gen_random_uuid(),variant_code text not null references public.catalog_variants(code),quantity_delta integer not null check(quantity_delta<>0),reference text not null,reason text not null,created_at timestamptz not null default now(),unique(variant_code,reference));
create index inventory_events_sku on public.inventory_events(variant_code,created_at);
create table public.stock_reservations(id uuid primary key default gen_random_uuid(),order_id text not null references public.orders(id),variant_code text not null references public.catalog_variants(code),quantity integer not null check(quantity>0),state text not null default 'active' check(state in ('active','released','consumed')),expires_at timestamptz not null,created_at timestamptz not null default now(),unique(order_id,variant_code));
create index stock_reservations_expiry on public.stock_reservations(expires_at) where state='active';
create table public.credit_reservations(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.customer_finance_accounts(user_id),order_id text not null unique references public.orders(id),amount numeric(18,2) not null check(amount>0),state text not null default 'active' check(state in ('active','released','captured')),expires_at timestamptz not null,created_at timestamptz not null default now());
create index credit_reservations_user on public.credit_reservations(user_id,state,expires_at);
create table public.payment_attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.user_profiles(id),order_id text not null references public.orders(id),provider text not null,amount numeric(18,2) not null check(amount>0),currency text not null check(currency in ('IRR','IRT')),state text not null default 'pending' check(state in ('pending','verified','failed','cancelled')),request_key uuid not null unique,provider_reference text,evidence jsonb,created_at timestamptz not null default now(),verified_at timestamptz);
create unique index payment_attempt_provider_reference on public.payment_attempts(provider,provider_reference) where provider_reference is not null;
create unique index payment_attempt_one_verified_order on public.payment_attempts(order_id) where state='verified';
create index payment_attempt_user on public.payment_attempts(user_id,created_at);
create table public.payment_refunds(id uuid primary key default gen_random_uuid(),payment_id uuid not null references public.payment_attempts(id),amount numeric(18,2) not null check(amount>0),state text not null default 'pending' check(state in ('pending','verified','rejected')),request_key uuid not null unique,provider_reference text,evidence jsonb,created_at timestamptz not null default now());
create table public.order_shipments(id uuid primary key default gen_random_uuid(),order_id text not null references public.orders(id),carrier text not null,tracking_code text,state text not null default 'pending' check(state in ('pending','shipped','delivered','returned')),payload jsonb not null default '{}',created_at timestamptz not null default now());
create index order_shipments_order on public.order_shipments(order_id);
create table public.order_status_events(id uuid primary key default gen_random_uuid(),order_id text not null references public.orders(id),actor_id uuid references auth.users(id),from_status public.order_status_type,to_status public.order_status_type not null,note text not null default '',created_at timestamptz not null default now());
create index order_status_events_order on public.order_status_events(order_id,created_at);
create table public.user_addresses(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.user_profiles(id),title text not null,province text not null,city text not null,full_address text not null,postal_code text,recipient_name text,recipient_phone text,active boolean not null default true,created_at timestamptz not null default now());
create index user_addresses_user on public.user_addresses(user_id) where active;
create table public.document_assets(id uuid primary key default gen_random_uuid(),user_id uuid references public.user_profiles(id),bucket_id text not null check(bucket_id in ('catalogue','customer-documents')),object_path text not null,sha256 text check(sha256 ~ '^[a-f0-9]{64}$'),mime_type text not null,byte_size bigint not null check(byte_size>=0),purpose text not null,created_at timestamptz not null default now(),unique(bucket_id,object_path));
create index document_assets_user on public.document_assets(user_id);
create table public.ticket_messages(id uuid primary key default gen_random_uuid(),ticket_id text not null references public.support_tickets(id),author_id uuid not null references public.user_profiles(id),body text not null check(length(body) between 1 and 20000),internal boolean not null default false,file_id uuid references public.document_assets(id),created_at timestamptz not null default now());
create index ticket_messages_ticket on public.ticket_messages(ticket_id,created_at);
create table public.reward_redemptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.user_profiles(id),reward_id text not null references public.club_rewards(id),points_spent bigint not null check(points_spent>=0),state text not null default 'requested' check(state in ('requested','approved','fulfilled','rejected','cancelled')),request_key uuid not null unique,created_at timestamptz not null default now());
create table public.checkout_requests(user_id uuid not null references public.user_profiles(id),request_key uuid not null,order_id text not null references public.orders(id),request_sha256 text not null check(request_sha256 ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now(),primary key(user_id,request_key));
create table app_private.notification_outbox(id uuid primary key default gen_random_uuid(),user_id uuid references public.user_profiles(id),channel text not null check(channel in ('sms','email','in_app')),destination text not null,template text not null,payload jsonb not null default '{}',state text not null default 'pending' check(state in ('pending','sending','sent','failed')),attempts integer not null default 0 check(attempts>=0),request_key text not null unique,provider_reference text,last_error text,available_at timestamptz not null default now(),created_at timestamptz not null default now(),sent_at timestamptz);
create index notification_outbox_pending on app_private.notification_outbox(available_at) where state in ('pending','failed');
create table app_private.schema_change_log(version text primary key,description text not null,applied_at timestamptz not null default now());
do $$declare t text;begin foreach t in array array['customer_finance_accounts','financial_entries','inventory_events','stock_reservations','credit_reservations','payment_attempts','payment_refunds','order_shipments','order_status_events','user_addresses','document_assets','ticket_messages','reward_redemptions','checkout_requests'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);end loop;end$$;
alter table app_private.notification_outbox enable row level security;
alter table app_private.schema_change_log enable row level security;
revoke all on app_private.notification_outbox,app_private.schema_change_log from public,anon,authenticated;
grant select,insert,update on public.user_addresses to authenticated;
create policy own_address_read on public.user_addresses for select to authenticated using(user_id=(select auth.uid()));
create policy own_address_insert on public.user_addresses for insert to authenticated with check(user_id=(select auth.uid()));
create policy own_address_update on public.user_addresses for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Financial accounts must be explicitly reconciled before first posting; no guessed opening balances.
create function app_private.post_financial_entry(p_user uuid,p_reference text,p_kind text,p_debt numeric default 0,p_wallet numeric default 0,p_points bigint default 0,p_order text default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare account public.customer_finance_accounts;old public.financial_entries;wallet numeric;points bigint;result uuid;begin
 select * into account from public.customer_finance_accounts where user_id=p_user for update;if not found then raise exception 'Reconciled opening account required';end if;
 if nullif(p_reference,'') is null or p_debt is null or p_wallet is null or p_points is null then raise exception 'Invalid financial entry';end if;
 select * into old from public.financial_entries where user_id=p_user and reference=p_reference;
 if found then if old.debt_delta<>p_debt or old.wallet_delta<>p_wallet or old.points_delta<>p_points or old.kind<>p_kind or old.order_id is distinct from p_order then raise exception 'Idempotency conflict';end if;return old.id;end if;
 if p_order is not null and not exists(select 1 from public.orders where id=p_order and user_id=p_user) then raise exception 'Order ownership mismatch';end if;
 select account.opening_wallet+coalesce(sum(wallet_delta),0),account.opening_points+coalesce(sum(points_delta),0) into wallet,points from public.financial_entries where user_id=p_user;
 if wallet+p_wallet<0 or points+p_points<0 then raise exception 'Insufficient wallet or points';end if;
 insert into public.financial_entries(user_id,reference,kind,debt_delta,wallet_delta,points_delta,order_id) values(p_user,p_reference,p_kind,p_debt,p_wallet,p_points,p_order) returning id into result;return result;
end$$;
create function app_private.adjust_stock(p_sku text,p_delta integer,p_reference text,p_reason text) returns integer language plpgsql security invoker set search_path='' as $$
declare old public.inventory_events;result integer;begin
 if p_delta is null or p_delta=0 or nullif(p_reference,'') is null or nullif(p_reason,'') is null then raise exception 'Invalid inventory adjustment';end if;
 perform 1 from public.variant_commercial_specs where variant_code=p_sku for update;if not found then raise exception 'Unknown SKU';end if;
 select * into old from public.inventory_events where variant_code=p_sku and reference=p_reference;if found then if old.quantity_delta<>p_delta or old.reason<>p_reason then raise exception 'Idempotency conflict';end if;select stock into result from public.variant_commercial_specs where variant_code=p_sku;return result;end if;
 update public.variant_commercial_specs set stock=stock+p_delta,stock_known=true,stock_version=stock_version+1,updated_at=now() where variant_code=p_sku and stock+p_delta>=stock_reserved returning stock into result;if not found then raise exception 'Insufficient unreserved stock';end if;
 insert into public.inventory_events(variant_code,quantity_delta,reference,reason) values(p_sku,p_delta,p_reference,p_reason);return result;
end$$;
create function app_private.reserve_order_stock(p_order text,p_expiry timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare item record;old public.stock_reservations;begin
 if p_expiry is null or p_expiry<=now() then raise exception 'Invalid reservation expiry';end if;
 perform 1 from public.orders where id=p_order and status not in ('cancelled','delivered') for update;if not found then raise exception 'Order not reservable';end if;
 if not exists(select 1 from public.order_items where order_id=p_order) then raise exception 'Empty order';end if;
 for item in select product_code,sum(quantity)::integer as quantity from public.order_items where order_id=p_order group by product_code order by product_code loop
 select * into old from public.stock_reservations where order_id=p_order and variant_code=item.product_code;
 if found then if old.quantity<>item.quantity or old.state<>'active' or old.expires_at<=now() then raise exception 'Reservation conflict';end if;continue;end if;
 update public.variant_commercial_specs set stock_reserved=stock_reserved+item.quantity,stock_version=stock_version+1 where variant_code=item.product_code and stock_known and stock-stock_reserved>=item.quantity;if not found then raise exception 'Insufficient known stock';end if;
 insert into public.stock_reservations(order_id,variant_code,quantity,expires_at) values(p_order,item.product_code,item.quantity,p_expiry);end loop;
end$$;
create function app_private.finish_order_stock(p_order text,p_consume boolean) returns void language plpgsql security invoker set search_path='' as $$
declare item record;begin
 if p_consume is null then raise exception 'Action required';end if;perform 1 from public.orders where id=p_order for update;
 for item in select * from public.stock_reservations where order_id=p_order and state='active' order by variant_code for update loop
 if p_consume and item.expires_at<=now() then raise exception 'Reservation expired';end if;
 update public.variant_commercial_specs set stock_reserved=stock_reserved-item.quantity,stock=stock-case when p_consume then item.quantity else 0 end,stock_version=stock_version+1 where variant_code=item.variant_code and stock_reserved>=item.quantity and (not p_consume or stock>=item.quantity);if not found then raise exception 'Reservation inconsistency';end if;
 update public.stock_reservations set state=case when p_consume then 'consumed' else 'released' end where id=item.id;
 if p_consume then insert into public.inventory_events(variant_code,quantity_delta,reference,reason) values(item.variant_code,-item.quantity,'reservation:'||item.id,'order fulfilment');end if;end loop;
end$$;
create function app_private.record_verified_payment(p_id uuid,p_reference text,p_amount numeric,p_currency text,p_evidence jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare payment public.payment_attempts;target public.orders;begin
 select * into payment from public.payment_attempts where id=p_id for update;if not found then raise exception 'Unknown payment';end if;
 if nullif(p_reference,'') is null or p_amount is distinct from payment.amount or p_currency is distinct from payment.currency or p_evidence is null or jsonb_typeof(p_evidence)<>'object' or p_evidence='{}'::jsonb then raise exception 'Payment verification mismatch';end if;
 if payment.state='verified' then if payment.provider_reference<>p_reference then raise exception 'Payment replay conflict';end if;return;end if;
 if payment.state<>'pending' then raise exception 'Payment not pending';end if;
 select * into target from public.orders where id=payment.order_id for update;
 if not found or target.user_id is distinct from payment.user_id or target.final_amount is distinct from payment.amount or target.currency is distinct from payment.currency or target.status='cancelled' then raise exception 'Order/payment mismatch';end if;
 update public.payment_attempts set state='verified',provider_reference=p_reference,evidence=p_evidence,verified_at=now() where id=p_id;
 update public.orders set payment_status='paid',receipt_verified=true,updated_at=now() where id=target.id;
end$$;
create function app_private.claim_notifications(p_limit integer default 20) returns setof app_private.notification_outbox language sql security invoker set search_path='' as $$
 update app_private.notification_outbox set state='sending',attempts=attempts+1 where id in(select id from app_private.notification_outbox where state in ('pending','failed') and available_at<=now() and attempts<5 order by available_at for update skip locked limit greatest(0,least(p_limit,100))) returning *;
$$;
create function app_private.reject_journal_edit() returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Append-only journal: use a compensating entry';end$$;
create trigger immutable_financial_entries before update or delete on public.financial_entries for each row execute function app_private.reject_journal_edit();
create trigger immutable_inventory_events before update or delete on public.inventory_events for each row execute function app_private.reject_journal_edit();
revoke execute on all functions in schema app_private from public,anon,authenticated;
grant execute on function app_private.content_visible(text,jsonb,jsonb,jsonb) to anon,authenticated;

create function app_private.hold_order_credit(p_user uuid,p_order text,p_expiry timestamptz) returns uuid language plpgsql security invoker set search_path='' as $$
declare account public.customer_finance_accounts;target public.orders;old public.credit_reservations;debt numeric;held numeric;limit_amount numeric;result uuid;begin
 select * into account from public.customer_finance_accounts where user_id=p_user for update;if not found then raise exception 'Reconciled opening account required';end if;
 select * into target from public.orders where id=p_order and user_id=p_user;if not found or target.final_amount is null or target.final_amount<=0 or target.currency<>account.currency or target.status='cancelled' or p_expiry is null or p_expiry<=now() then raise exception 'Invalid credit order';end if;
 select * into old from public.credit_reservations where order_id=p_order;if found then if old.user_id<>p_user or old.amount<>target.final_amount or old.state<>'active' or old.expires_at<=now() then raise exception 'Credit hold conflict';end if;return old.id;end if;
 select credit_limit into limit_amount from public.user_profiles where id=p_user and status='active';if limit_amount is null or limit_amount<=0 then raise exception 'Credit not authorized';end if;
 select account.opening_debt+coalesce(sum(debt_delta),0) into debt from public.financial_entries where user_id=p_user;
 select coalesce(sum(amount),0) into held from public.credit_reservations where user_id=p_user and state='active' and expires_at>now();
 if greatest(debt,0)+held+target.final_amount>limit_amount then raise exception 'Credit limit exceeded';end if;
 insert into public.credit_reservations(user_id,order_id,amount,expires_at) values(p_user,p_order,target.final_amount,p_expiry) returning id into result;return result;
end$$;
create function app_private.finish_order_credit(p_id uuid,p_capture boolean) returns void language plpgsql security invoker set search_path='' as $$
declare hold public.credit_reservations;begin
 if p_capture is null then raise exception 'Action required';end if;select * into hold from public.credit_reservations where id=p_id;if not found then raise exception 'Unknown credit hold';end if;
 perform 1 from public.customer_finance_accounts where user_id=hold.user_id for update;select * into hold from public.credit_reservations where id=p_id for update;
 if hold.state=(case when p_capture then 'captured' else 'released' end) then return;end if;
 if hold.state<>'active' then raise exception 'Credit hold finalized';end if;
 if p_capture then if hold.expires_at<=now() then raise exception 'Credit hold expired';end if;perform app_private.post_financial_entry(hold.user_id,'credit-hold:'||hold.id,'invoice',hold.amount,0,0,hold.order_id);end if;
 update public.credit_reservations set state=case when p_capture then 'captured' else 'released' end where id=p_id;
end$$;
create function app_private.record_verified_refund(p_id uuid,p_reference text,p_evidence jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare refund public.payment_refunds;payment public.payment_attempts;refunded numeric;begin
 select * into refund from public.payment_refunds where id=p_id;if not found then raise exception 'Unknown refund';end if;
 select * into payment from public.payment_attempts where id=refund.payment_id for update;
 select * into refund from public.payment_refunds where id=p_id for update;
 if payment.state<>'verified' or nullif(p_reference,'') is null or p_evidence is null or jsonb_typeof(p_evidence)<>'object' or p_evidence='{}'::jsonb then raise exception 'Refund verification mismatch';end if;
 if refund.state='verified' then if refund.provider_reference<>p_reference then raise exception 'Refund replay conflict';end if;return;end if;
 if refund.state<>'pending' then raise exception 'Refund not pending';end if;
 select coalesce(sum(amount),0) into refunded from public.payment_refunds where payment_id=payment.id and state='verified';
 if refunded+refund.amount>payment.amount then raise exception 'Refund exceeds payment';end if;
 update public.payment_refunds set state='verified',provider_reference=p_reference,evidence=p_evidence where id=p_id;
 if refunded+refund.amount=payment.amount then update public.orders set payment_status='refunded',updated_at=now() where id=payment.order_id;end if;
end$$;
create function app_private.release_expired_stock(p_limit integer default 100) returns integer language plpgsql security invoker set search_path='' as $$
declare item record;released integer=0;begin
 for item in select distinct order_id from public.stock_reservations where state='active' and expires_at<=now() order by order_id limit greatest(0,least(p_limit,1000)) loop perform app_private.finish_order_stock(item.order_id,false);released=released+1;end loop;return released;
end$$;
revoke execute on all functions in schema app_private from public,anon,authenticated;
grant execute on function app_private.content_visible(text,jsonb,jsonb,jsonb) to anon,authenticated;

-- Real Supabase Storage owns its catalogs. No custom auth.users/storage.objects replacements.
do $$begin
 if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then raise exception 'Supabase Storage schema required';end if;
 if exists(select 1 from storage.buckets where id='catalogue' and public is not true) or exists(select 1 from storage.buckets where id='customer-documents' and public is true) then raise exception 'Existing bucket visibility mismatch: review before changing';end if;
end$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catalogue','catalogue',true,20971520,array['image/jpeg','image/png','image/webp','application/pdf']),('customer-documents','customer-documents',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
create policy sanat_private_document_read on storage.objects for select to authenticated using(bucket_id='customer-documents' and split_part(name,'/',1)=(select auth.uid())::text);
create policy sanat_private_document_insert on storage.objects for insert to authenticated with check(bucket_id='customer-documents' and split_part(name,'/',1)=(select auth.uid())::text);
-- Uploads are append-only: no customer replacement/delete policy is added.
insert into app_private.schema_change_log(version,description) values('20261020083418','Adopt existing schema and harden authorization'),('20261020083459','Add financial journals, stock reservations, payment audit and private storage');
