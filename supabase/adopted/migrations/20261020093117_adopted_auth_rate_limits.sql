-- The existing Auth BFF rate-limit query needs this private runtime table.
create table app_private.rate_limits(bucket text primary key,attempts integer not null default 0 check(attempts>=0),expires_at timestamptz not null);
create index rate_limits_expiry on app_private.rate_limits(expires_at);
alter table app_private.rate_limits enable row level security;
revoke all on app_private.rate_limits from public,anon,authenticated;
insert into app_private.schema_change_log(version,description) values('20261020093117','Private durable Auth request throttling');
