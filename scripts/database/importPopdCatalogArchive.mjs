import pg from 'pg';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const {Pool} = pg;
const POPD_COMMIT = 'e81218f2a248f1db9a72349a67e46af55c7977ee';
const EXPECTED_FILES = [
  {key:'engineered',path:'server/data/engineeredCatalog.json',blobSha:'174f8253087f4c5a0f4195968cc00778c447258e'},
  {key:'targets',path:'deliverables/catalog-869-audit/catalog_targets.json',blobSha:'24ec085193e0fdec82974abcd0887ceeea9cb470'},
  {key:'linkedImages',path:'deliverables/catalog-869-audit/e869_linked_catalog.json',blobSha:'c3bc75946625c239df1ff2f8ad2ac49708d387e6'},
  {key:'inventory',path:'deliverables/catalog-869-audit/inventory.json',blobSha:'e9b3ce2eda67a06d8223d55b0a7e146eac81412e'}
];

function fail(message) {
  throw new Error(message);
}

function isPrivateOrLocalHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (['localhost','127.0.0.1','::1','db','postgres','supabase-db'].includes(host)) return true;
  if (!host.includes('.')) return true;
  if (host.endsWith('.internal') || host.endsWith('.local')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127;
}

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(buffer).digest('hex');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fetchPinnedJson(file) {
  const url = `https://raw.githubusercontent.com/javanwebi/POPD/${POPD_COMMIT}/${file.path}`;
  const response = await fetch(url, {headers:{'accept':'application/octet-stream','user-agent':'sanatpish-popd-catalog-import'}});
  if (!response.ok) fail(`POPD source download failed for ${file.path}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualBlobSha = gitBlobSha(bytes);
  if (actualBlobSha !== file.blobSha) {
    fail(`POPD source integrity check failed for ${file.path}: expected Git blob ${file.blobSha}, received ${actualBlobSha}`);
  }
  let json;
  try { json = JSON.parse(bytes.toString('utf8')); }
  catch { fail(`POPD source JSON is invalid: ${file.path}`); }
  return { ...file, bytes, json, sha256:sha256(bytes), sourcePath:`github/javanwebi/POPD/${file.path}` };
}

function validateSource(files) {
  const byKey = Object.fromEntries(files.map(file => [file.key,file]));
  const targets = byKey.targets.json;
  const engineered = byKey.engineered.json;
  const linked = byKey.linkedImages.json;
  const inventory = byKey.inventory.json;

  const beltFamilies = Array.isArray(targets.beltFams) ? targets.beltFams : [];
  const nonBeltFamilies = Array.isArray(targets.nonBeltFams) ? targets.nonBeltFams : [];
  const beltDirect = Array.isArray(targets.beltDir) ? targets.beltDir : [];
  const nonBeltDirect = Array.isArray(targets.nonBeltDir) ? targets.nonBeltDir : [];
  const familyRows = [
    ...beltFamilies.map(row => ({...row,sourceKind:'belt'})),
    ...nonBeltFamilies.map(row => ({...row,sourceKind:'non_belt'}))
  ];
  const directRows = [
    ...beltDirect.map(row => ({...row,sourceKind:'belt'})),
    ...nonBeltDirect.map(row => ({...row,sourceKind:'non_belt'}))
  ];
  const familySkuCodes = familyRows.flatMap(row => Array.isArray(row.allVariantCodes) ? row.allVariantCodes : []);
  const directSkuCodes = directRows.map(row => row.skuCode).filter(Boolean);
  const familyCodes = familyRows.map(row => row.code).filter(Boolean);
  const categorySlugs = [...new Set([...familyRows,...directRows].map(row => row.slug).filter(Boolean))];
  const unique = values => new Set(values).size === values.length;
  const overlap = familySkuCodes.filter(code => new Set(directSkuCodes).has(code));

  if (familyRows.length !== 770) fail(`Expected 770 POPD families; received ${familyRows.length}`);
  if (familySkuCodes.length !== 9630 || !unique(familySkuCodes)) fail('POPD family SKU membership must contain 9,630 unique codes');
  if (directSkuCodes.length !== 678 || !unique(directSkuCodes)) fail('POPD direct SKU mapping must contain 678 unique codes');
  if (!unique(familyCodes) || familyCodes.length !== 770) fail('POPD source family codes are not unique');
  if (overlap.length) fail(`POPD direct SKU list overlaps family membership (${overlap.length} codes)`);
  if (new Set([...familySkuCodes,...directSkuCodes]).size !== 10308) fail('POPD source must contain exactly 10,308 unique catalogue SKUs');
  if (categorySlugs.length !== 40) fail(`Expected 40 POPD category slugs; received ${categorySlugs.length}`);
  if (!Array.isArray(linked.assignments) || linked.assignments.length !== 869) fail('Expected 869 linked-image audit records');
  if (!Array.isArray(inventory.entries) || inventory.entries.length !== 869) fail('Expected 869 image inventory records');
  if (!engineered || !Array.isArray(engineered.products)) fail('engineeredCatalog.json does not contain its expected products array');

  return {familyRows,directRows,familySkuCodes,directSkuCodes,categorySlugs,sourceCounts:{
    families:familyRows.length,familySkuLinks:familySkuCodes.length,directSkus:directSkuCodes.length,
    uniqueSkus:10308,categorySlugs:categorySlugs.length,linkedImageAudit:linked.assignments.length,imageInventory:inventory.entries.length
  }};
}

function createPool() {
  const env = process.env;
  if (env.NODE_ENV !== 'production') fail('Run this importer only inside the production VPS runtime (NODE_ENV=production).');
  if (env.DATABASE_ENV !== 'production') fail('DATABASE_ENV must be production.');
  if (env.DATA_BACKEND !== 'postgres' || env.DATABASE_SCHEMA !== 'adopted') fail('Expected the adopted PostgreSQL production backend.');
  if (env.DATABASE_SSL !== 'require') fail('Production database import requires DATABASE_SSL=require.');
  if (env.POPD_CATALOG_IMPORT_APPROVED !== 'yes') fail('Explicit approval required: set POPD_CATALOG_IMPORT_APPROVED=yes for this additive import.');
  if (!env.DATABASE_URL) fail('DATABASE_URL is required.');

  const databaseUrl = new URL(env.DATABASE_URL);
  const host = databaseUrl.hostname.toLowerCase();
  if (host.endsWith('.supabase.co') || host.endsWith('.supabase.com') || host.includes('pooler.supabase')) {
    fail('Refusing to write to a managed Supabase cloud project. The target must be the self-hosted production database on the VPS.');
  }
  if (!isPrivateOrLocalHost(host)) fail(`Refusing non-local database host "${host}". Use the self-hosted VPS database.`);

  const caPath = env.DATABASE_CA_CERT || join(process.cwd(),'certs','supabase-root-2021-ca.crt');
  const ca = readFileSync(caPath,'utf8');
  return new Pool({
    connectionString:env.DATABASE_URL,
    max:2,
    connectionTimeoutMillis:15000,
    idleTimeoutMillis:10000,
    ssl:{rejectUnauthorized:true,ca}
  });
}

async function main() {
  const files = await Promise.all(EXPECTED_FILES.map(fetchPinnedJson));
  const source = validateSource(files);
  const fileByKey = Object.fromEntries(files.map(file => [file.key,file]));
  const targetsFile = fileByKey.targets;
  const pool = createPool();
  const client = await pool.connect();

  try {
    const identity = (await client.query(`select current_database() as database_name, inet_server_addr()::text as server_address, inet_server_port() as server_port, current_user as database_role`)).rows[0];
    const requiredTables = (await client.query(`
      select
        to_regclass('app_private.source_archives') is not null as source_archives,
        to_regclass('app_private.catalog_popd_families') is not null as popd_families,
        to_regclass('app_private.catalog_popd_family_variants') is not null as popd_family_variants,
        to_regclass('app_private.catalog_popd_direct_skus') is not null as popd_direct_skus,
        to_regclass('public.catalog_variants') is not null as catalog_variants,
        to_regclass('public.catalog_categories') is not null as catalog_categories
    `)).rows[0];
    if (Object.values(requiredTables).some(value => value !== true)) {
      fail('Required archive/overlay tables are missing. Apply the adopted POPD catalog overlay migration first.');
    }

    const allSkuCodes = [...source.familySkuCodes,...source.directSkuCodes];
    const existingSkuCount = Number((await client.query(
      'select count(distinct code)::int as count from public.catalog_variants where code = any($1::text[])',
      [allSkuCodes]
    )).rows[0].count);
    if (existingSkuCount !== 10308) fail(`Target database contains ${existingSkuCount}/10,308 POPD SKU codes. No import was written.`);

    const existingCategoryCount = Number((await client.query(
      'select count(distinct slug)::int as count from public.catalog_categories where slug = any($1::text[])',
      [source.categorySlugs]
    )).rows[0].count);
    if (existingCategoryCount !== 40) fail(`Target database contains ${existingCategoryCount}/40 POPD category slugs. No import was written.`);

    const existing = (await client.query(`
      select
        (select count(*)::int from app_private.catalog_popd_families) as families,
        (select count(*)::int from app_private.catalog_popd_family_variants) as family_variant_links,
        (select count(*)::int from app_private.catalog_popd_direct_skus) as direct_skus,
        (select count(distinct source_sha256)::int from app_private.catalog_popd_families) as family_source_versions,
        (select min(source_sha256) from app_private.catalog_popd_families) as family_source_sha
    `)).rows[0];

    const hasOverlayRows = Number(existing.families) + Number(existing.family_variant_links) + Number(existing.direct_skus) > 0;
    if (hasOverlayRows) {
      if (Number(existing.families) !== 770 || Number(existing.family_variant_links) !== 9630 || Number(existing.direct_skus) !== 678 ||
          Number(existing.family_source_versions) !== 1 || existing.family_source_sha !== targetsFile.sha256) {
        fail('A partial or different POPD overlay already exists. Refusing to overwrite it; inspect the existing overlay before retrying.');
      }
    }

    await client.query('begin');
    for (const file of files) {
      await client.query(`
        insert into app_private.source_archives(source_path,sha256,payload)
        select $1,$2,$3::jsonb
        where not exists (
          select 1 from app_private.source_archives where source_path=$1 and sha256=$2
        )
      `,[file.sourcePath,file.sha256,JSON.stringify(file.json)]);
    }

    if (!hasOverlayRows) {
      const targetsPath = targetsFile.sourcePath;
      const targetsSha = targetsFile.sha256;

      await client.query(`
        with source as (
          select payload from app_private.source_archives where source_path=$1 and sha256=$2
        ),
        family_rows as (
          select 'belt'::text as source_kind, x as metadata
          from source cross join lateral jsonb_array_elements(payload->'beltFams') x
          union all
          select 'non_belt'::text, x
          from source cross join lateral jsonb_array_elements(payload->'nonBeltFams') x
        )
        insert into app_private.catalog_popd_families(
          source_family_code,source_kind,category_slug,family_name,brand,submenu,leaf,
          declared_variant_count,metadata,source_sha256,is_active
        )
        select
          metadata->>'code',source_kind,metadata->>'slug',
          coalesce(nullif(metadata->>'name',''),metadata->>'code'),
          coalesce(metadata->>'brand',''),coalesce(metadata->>'submenu',''),
          coalesce(metadata->>'leaf',''),
          jsonb_array_length(coalesce(metadata->'allVariantCodes','[]'::jsonb)),
          metadata,$2,true
        from family_rows
      `,[targetsPath,targetsSha]);

      await client.query(`
        with source as (
          select payload from app_private.source_archives where source_path=$1 and sha256=$2
        ),
        family_rows as (
          select x as metadata from source cross join lateral jsonb_array_elements(payload->'beltFams') x
          union all
          select x from source cross join lateral jsonb_array_elements(payload->'nonBeltFams') x
        )
        insert into app_private.catalog_popd_family_variants(source_family_code,variant_code,sort_order)
        select
          metadata->>'code',sku.value,(sku.ordinality-1)::integer
        from family_rows
        cross join lateral jsonb_array_elements_text(coalesce(metadata->'allVariantCodes','[]'::jsonb))
          with ordinality as sku(value,ordinality)
      `,[targetsPath,targetsSha]);

      await client.query(`
        with source as (
          select payload from app_private.source_archives where source_path=$1 and sha256=$2
        ),
        direct_rows as (
          select 'belt'::text as source_kind, x as metadata
          from source cross join lateral jsonb_array_elements(payload->'beltDir') x
          union all
          select 'non_belt'::text, x
          from source cross join lateral jsonb_array_elements(payload->'nonBeltDir') x
        )
        insert into app_private.catalog_popd_direct_skus(
          sku_code,category_slug,source_kind,name,brand,submenu,metadata,source_sha256,is_active
        )
        select
          metadata->>'skuCode',metadata->>'slug',source_kind,
          coalesce(nullif(metadata->>'name',''),metadata->>'skuCode'),
          coalesce(metadata->>'brand',''),coalesce(metadata->>'submenu',''),
          metadata,$2,coalesce(existing.is_active,v.active)
        from direct_rows
        join public.catalog_variants v on v.code=metadata->>'skuCode'
        left join public.catalog_direct_skus existing on existing.sku_code=metadata->>'skuCode'
      `,[targetsPath,targetsSha]);

      const hasAliasTable = Boolean((await client.query(
        `select to_regclass('public.catalog_family_aliases') is not null as present`
      )).rows[0].present);
      if (hasAliasTable) {
        await client.query(`
          with family_db_mapping as (
            select
              m.source_family_code,
              count(distinct v.family_code)::integer as db_family_count,
              min(v.family_code) as db_family_code,
              count(distinct m.variant_code)::integer as source_variant_count
            from app_private.catalog_popd_family_variants m
            join public.catalog_variants v on v.code=m.variant_code
            group by m.source_family_code
          ),
          db_family_usage as (
            select db_family_code,count(*)::integer as source_family_count
            from family_db_mapping
            where db_family_count=1
            group by db_family_code
          ),
          alias_images as (
            select
              a.new_family_code,
              count(distinct a.old_family_code)::integer as alias_count,
              coalesce(sum(coalesce(old_family.item_count,0)),0)::integer as alias_item_count,
              count(distinct gallery.family_code)::integer as verified_alias_count,
              array_agg(distinct gallery.url) filter(where gallery.url is not null) as image_urls
            from public.catalog_family_aliases a
            left join public.catalog_families old_family on old_family.code=a.old_family_code
            left join public.catalog_gallery_images gallery
              on gallery.family_code=a.old_family_code
             and gallery.scope='family-example'
             and gallery.identity_verified=true
            where a.resolution_kind='SINGLE_FAMILY' and a.new_family_code is not null
            group by a.new_family_code
          )
          update app_private.catalog_popd_families target
          set
            resolved_db_family_code=mapping.db_family_code,
            resolution_status=case
              when mapping.db_family_count=0 then 'UNRESOLVED'
              when mapping.db_family_count>1 then 'SPLIT'
              when coalesce(usage.source_family_count,0)>1 then 'COLLISION'
              else 'ONE_TO_ONE'
            end,
            family_image_urls=case
              when mapping.db_family_count=1
               and coalesce(usage.source_family_count,0)=1
               and coalesce(images.alias_count,0)>0
               and images.alias_item_count=mapping.source_variant_count
               and images.verified_alias_count=images.alias_count
              then coalesce(images.image_urls,ARRAY[]::text[])
              else ARRAY[]::text[]
            end,
            is_active=exists(
              select 1
              from app_private.catalog_popd_family_variants member
              join public.catalog_variants variant on variant.code=member.variant_code
              where member.source_family_code=target.source_family_code and variant.active
            ),
            updated_at=now()
          from family_db_mapping mapping
          left join db_family_usage usage on usage.db_family_code=mapping.db_family_code
          left join alias_images images on images.new_family_code=mapping.db_family_code
          where target.source_family_code=mapping.source_family_code
        `);
      } else {
        await client.query(`
          with family_db_mapping as (
            select m.source_family_code,count(distinct v.family_code)::integer as db_family_count,min(v.family_code) as db_family_code
            from app_private.catalog_popd_family_variants m
            join public.catalog_variants v on v.code=m.variant_code
            group by m.source_family_code
          ),
          db_family_usage as (
            select db_family_code,count(*)::integer as source_family_count
            from family_db_mapping where db_family_count=1 group by db_family_code
          )
          update app_private.catalog_popd_families target
          set resolved_db_family_code=mapping.db_family_code,
              resolution_status=case when mapping.db_family_count=0 then 'UNRESOLVED' when mapping.db_family_count>1 then 'SPLIT' when usage.source_family_count>1 then 'COLLISION' else 'ONE_TO_ONE' end,
              is_active=exists(select 1 from app_private.catalog_popd_family_variants member join public.catalog_variants variant on variant.code=member.variant_code where member.source_family_code=target.source_family_code and variant.active),
              updated_at=now()
          from family_db_mapping mapping
          left join db_family_usage usage on usage.db_family_code=mapping.db_family_code
          where target.source_family_code=mapping.source_family_code
        `);
      }
    }

    const verification = (await client.query(`
      select
        (select count(*)::int from app_private.catalog_popd_families) as families,
        (select count(*)::int from app_private.catalog_popd_family_variants) as family_variant_links,
        (select count(distinct variant_code)::int from app_private.catalog_popd_family_variants) as unique_family_skus,
        (select count(*)::int from app_private.catalog_popd_direct_skus) as direct_skus,
        (select count(*)::int from app_private.catalog_popd_direct_skus d join app_private.catalog_popd_family_variants f on f.variant_code=d.sku_code) as direct_family_overlap,
        (select count(*)::int from app_private.catalog_popd_families where is_active) as active_families,
        (select count(*)::int from app_private.catalog_popd_direct_skus where is_active) as active_direct_skus,
        (select count(*)::int from app_private.catalog_popd_families where cardinality(family_image_urls)>0) as families_with_verified_family_images,
        (select count(distinct g.variant_code)::int
           from public.catalog_gallery_images g
           join app_private.catalog_popd_family_variants m on m.variant_code=g.variant_code
          where g.scope='variant' and g.identity_verified=true) as verified_variant_images_for_popd
    `)).rows[0];

    if (Number(verification.families)!==770 || Number(verification.family_variant_links)!==9630 ||
        Number(verification.unique_family_skus)!==9630 || Number(verification.direct_skus)!==678 ||
        Number(verification.direct_family_overlap)!==0) {
      fail('Post-import verification failed. Transaction will be rolled back.');
    }

    await client.query('commit');
    console.log(JSON.stringify({
      status:hasOverlayRows?'already_imported':'imported',
      target:'self-hosted VPS PostgreSQL',
      database:{name:identity.database_name,serverAddress:identity.server_address,serverPort:identity.server_port,role:identity.database_role},
      source:{repository:'javanwebi/POPD',commit:POPD_COMMIT,files:files.map(file=>({path:file.path,sha256:file.sha256,bytes:file.bytes.length}))},
      counts:{...source.sourceCounts,activeFamilies:verification.active_families,activeDirectSkus:verification.active_direct_skus,
        familiesWithVerifiedFamilyImages:verification.families_with_verified_family_images,
        verifiedVariantImagesForPopd:verification.verified_variant_images_for_popd},
      existingCatalogRowsModified:false
    },null,2));
  } catch (error) {
    try { await client.query('rollback'); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('[POPD catalog import failed]',error?.stack || error);
  process.exitCode=1;
});
