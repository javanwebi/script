#!/usr/bin/env bash
# Synchronize ONLY the approved staff schema migration (tested on online sanatpishatlas)
# into the site's currently connected local Docker PostgreSQL database.
# No data copy from the cloud; no changes to existing users, catalog or orders.
# Required mode: --check (read only) or --apply (backup + restore check + additive DDL).
set -Eeuo pipefail
umask 077
MODE="${1:---check}"
case "$MODE" in --check|--apply) ;; *) echo 'Usage: sudo bash sync_online_staff_to_vps.sh --check|--apply' >&2; exit 2;; esac
if [[ $EUID -ne 0 ]]; then echo 'RUN_AS_ROOT'; exit 1; fi
exec 9>/run/lock/sanatpish-staff-schema.lock
flock -n 9 || { echo 'STAFF_SCHEMA_LOCKED'; exit 1; }
cd /opt/sanatpish
PINNED=2eafc2666407cd2ecdad22f3bc44e7a77af0bedd
MIGRATION=supabase/adopted/migrations/20261104100000_admin_staff_granular_permissions.sql

# Once the pinned commit has been downloaded, this works even without Internet.
if ! git cat-file -e "$PINNED^{commit}" 2>/dev/null; then
  git fetch origin main
fi
git cat-file -e "$PINNED^{commit}" || { echo PINNED_COMMIT_NOT_AVAILABLE; exit 1; }
if git show-ref --verify --quiet refs/remotes/origin/main; then
  git merge-base --is-ancestor "$PINNED" origin/main || { echo MAIN_NO_LONGER_CONTAINS_STAFF_RELEASE; exit 1; }
fi

LIVE=''
for c in $(docker ps --format '{{.Names}}'); do
  if docker port "$c" 3000/tcp 2>/dev/null | grep -Fxq '127.0.0.1:3008'; then LIVE="$c"; break; fi
done
test -n "$LIVE" || { echo APP_CONTAINER_NOT_FOUND; exit 1; }
echo "APP_CONTAINER=$LIVE"

# Match the actual PostgreSQL engine only; supabase/postgres-meta is a separate API service.
# Restrict to the confirmed self-hosted container name and image, never a fuzzy substring.
mapfile -t CANDIDATES < <(
  docker ps --format '{{.Names}} {{.Image}}' |
    awk '$1=="supabase-db" && $2 ~ /^supabase\/postgres:/ {print $1}'
)
if ((${#CANDIDATES[@]}!=1)); then
  echo "EXPECTED_ONE_SELF_HOSTED_POSTGRES_FOUND=${#CANDIDATES[@]}"
  docker ps --format '{{.Names}} {{.Image}}'
  exit 1
fi
DB="${CANDIDATES[0]}"
echo "POSTGRES_CONTAINER=$DB"

auth_info=$(docker exec -w /app "$LIVE" node --import tsx --input-type=module -e '
  import {database,closeDatabase} from "./server/db/connection.ts";
  try {
   const {rows:[r]}=await database().query("select current_database() as db, extract(epoch from pg_postmaster_start_time())::bigint as boot, to_regclass('\''public.user_profiles'\'') as users, to_regclass('\''auth.users'\'') as auth, to_regclass('\''public.catalog_families'\'') as families, pg_database_size(current_database()) as db_bytes");
   if(!r.users||!r.auth||!r.families)throw new Error("WRONG_DATABASE_SCHEMA");
   console.log(r.db+"|"+r.boot+"|"+r.db_bytes);
  } catch(e){console.error(String(e));process.exitCode=1}
  finally{await closeDatabase();}
')
IFS='|' read -r DBNAME APP_BOOT DB_BYTES <<< "$auth_info"
test -n "$DBNAME" && test -n "$APP_BOOT" && test -n "$DB_BYTES"
DB_BOOT=$(docker exec "$DB" sh -ec '
  export PGPASSWORD="${POSTGRES_PASSWORD:-}"
  exec psql -X -qAt -U postgres -d "$1" -c "select extract(epoch from pg_postmaster_start_time())::bigint;"
' sh "$DBNAME")
if [[ "$APP_BOOT" != "$DB_BOOT" ]]; then echo DIFFERENT_DATABASE_INSTANCE_ABORT; exit 1; fi
echo "LIVE_DATABASE_MATCHED name=$DBNAME boot=$APP_BOOT"

# Protect against mistakenly targeting an unrelated managed Supabase project or local DB.
EXISTING=$(docker exec -w /app "$LIVE" node --import tsx --input-type=module -e '
 import {database,closeDatabase} from "./server/db/connection.ts";
 try{
  const {rows:[r]}=await database().query("select to_regclass($1) as staff",["app_private.admin_staff_accounts"]);
  console.log(r.staff?"EXISTS":"MISSING");
 }catch(e){console.error(e.message);process.exitCode=1}
 finally{await closeDatabase()}
')
echo "STAFF_TABLE_BEFORE=$EXISTING"
if [[ "$MODE" == '--check' ]]; then
 echo "STAFF_SCHEMA_PREFLIGHT_OK local_database=$DBNAME staff_table=$EXISTING"
 echo 'NO_CHANGES_MADE Run with --apply for backup, restore test, then migration.'
 exit 0
fi

FREE_BYTES=$(df -PB1 /root | awk 'END{print $4}')
if (( FREE_BYTES <= DB_BYTES + 536870912 )); then
  echo "INSUFFICIENT_BACKUP_SPACE free_bytes=$FREE_BYTES database_bytes=$DB_BYTES"
  exit 1
fi
BACKUP_DIR=/root/sanatpish-db-backups
install -d -m 700 "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/pre-staff-$(date +%Y%m%d-%H%M%S)-$$.dump"
SQL="$BACKUP_DIR/staff-permissions-$PINNED.sql"
git show "$PINNED:$MIGRATION" > "$SQL"
test -s "$SQL"
if grep -Eiq '^[[:space:]]*(drop|truncate|delete[[:space:]]+from)[[:space:]]' "$SQL"; then
 echo 'UNEXPECTED_DESTRUCTIVE_SQL'; exit 1
fi
echo '===== BACKUP TARGET DATABASE ====='
docker exec "$DB" sh -ec '
  export PGPASSWORD="${POSTGRES_PASSWORD:-}"
  exec pg_dump --format=custom -U postgres -d "$1"
' sh "$DBNAME" > "$BACKUP"
test -s "$BACKUP"
# Preserve cluster roles alongside the restorable custom-format database dump.
docker exec "$DB" sh -ec '
  export PGPASSWORD="${POSTGRES_PASSWORD:-}"
  exec pg_dumpall --globals-only -U postgres
' > "$BACKUP.roles.sql"
[[ -s "$BACKUP.roles.sql" ]] || { echo 'GLOBAL_ROLES_BACKUP_FAILED'; exit 1; }
sha256sum "$BACKUP" "$BACKUP.roles.sql" > "$BACKUP.sha256"
sha256sum -c "$BACKUP.sha256"
# Archive listing and full decode: validate compressed table data is readable.
docker exec -i "$DB" pg_restore --list < "$BACKUP" > /dev/null
docker exec -i "$DB" pg_restore -f /dev/null < "$BACKUP"
echo "BACKUP_VERIFIED=$BACKUP"

# Real schema restore test in a NEW scratch database, never on the live database.
SCRATCH="sp_staff_restore_$(date +%s)_$$"
SCRATCH_CREATED=0
cleanup(){
  status=$?
  trap - EXIT
  if [[ "$SCRATCH_CREATED" == 1 ]]; then
    docker exec "$DB" sh -ec '
      export PGPASSWORD="${POSTGRES_PASSWORD:-}"
      exec dropdb -U postgres "$1"
    ' sh "$SCRATCH" || echo 'WARN: SCRATCH_DB_NOT_DROPPED'
  fi
  exit "$status"
}
trap cleanup EXIT

echo '===== ISOLATED RESTORE CHECK ====='
docker exec "$DB" sh -ec '
 export PGPASSWORD="${POSTGRES_PASSWORD:-}"
 exec createdb -U postgres -T template0 "$1"
' sh "$SCRATCH"
SCRATCH_CREATED=1
docker exec -i "$DB" sh -ec '
 export PGPASSWORD="${POSTGRES_PASSWORD:-}"
 exec pg_restore --schema-only --exit-on-error --no-owner --no-acl -U postgres -d "$1"
' sh "$SCRATCH" < "$BACKUP"
echo 'ISOLATED_SCHEMA_RESTORE_OK'

# Validate exact committed migration and apply only that one SQL file.
echo '===== APPLY ONLY STAFF PERMISSION MIGRATION ====='
docker exec -i -w /app "$LIVE" node --import tsx --input-type=module -e '
  import {readFileSync} from "node:fs";
  import {database,closeDatabase} from "./server/db/connection.ts";
  try {
    const sql=readFileSync(0,"utf8");
    if(!sql.includes("create table if not exists app_private.admin_staff_accounts") || /\b(drop|truncate)\b/i.test(sql))throw new Error("INVALID_STAFF_MIGRATION");
    await database().query(sql);
    const {rows:[r]}=await database().query("select to_regclass($1) as staff",["app_private.admin_staff_accounts"]);
    if(!r.staff)throw new Error("STAFF_TABLE_MISSING_AFTER_MIGRATION");
    const {rows:[log]}=await database().query("select to_regclass($1) as version_log",["app_private.schema_change_log"]);
    if(log.version_log)await database().query("insert into app_private.schema_change_log(version,description) values($1,$2) on conflict(version) do nothing",["20261104100000","20261104100000_admin_staff_granular_permissions.sql"]);
    console.log("STAFF_TABLE_CREATED_AND_VERIFIED");
  } catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1}
  finally{await closeDatabase()}
' < "$SQL"
# Verify table protection and catalog integrity after applying the committed SQL.
docker exec -i -w /app "$LIVE" node --import tsx --input-type=module -e '
 import {database,closeDatabase} from "./server/db/connection.ts";
 try {
  const {rows:[r]}=await database().query("select to_regclass($1) as tbl, to_regclass($2) as catalog, to_regclass($3) as users",["app_private.admin_staff_accounts","public.catalog_families","auth.users"]);
  const {rows:[a]}=await database().query("select has_table_privilege($1,$2,$3) as anon_read, has_table_privilege($4,$5,$6) as auth_read",["anon","app_private.admin_staff_accounts","SELECT","authenticated","app_private.admin_staff_accounts","SELECT"]);
  r.anon_read=a.anon_read;r.auth_read=a.auth_read;
  if(!r.tbl||!r.catalog||!r.users||r.anon_read||r.auth_read)throw Error("POSTCHECK_FAILED");
  console.log("STAFF_TABLE_AND_PRIVILEGES_OK");
 } catch(e){console.error(e.message);process.exitCode=1}
 finally{await closeDatabase()}
'
echo "STAFF_DB_INSTALL_OK backup=$BACKUP"
