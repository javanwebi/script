import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractBeltRefsFromTechnicalResearch,
  runPhase1CatalogReconstruction,
  type OldToNewFamilyMappingRecord,
  type Phase1FamilyRecord,
  type Phase1ReconstructionReport,
  type Phase1SkuRecord,
} from '../src/data/catalogPhase1Reconstruction';
import { validateFamilyMenuAssignment } from '../src/data/catalogMenuSemanticGuard';

const ROOT_DIR = process.cwd();
const UNKNOWN_LABELS = new Set(['UNKNOWN', 'GENERIC', 'UNSPECIFIED', 'N/A', 'NA', 'ثبت نشده', 'نامشخص', 'نامشخص است', '-']);

function textValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function databaseBrand(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const candidate = textValue(value);
    if (!candidate) continue;
    if (UNKNOWN_LABELS.has(candidate.toUpperCase()) || UNKNOWN_LABELS.has(candidate)) continue;
    return candidate;
  }
  return '';
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map(textValue).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
}

function keyValueSpecs(entries: Array<[string, unknown]>): Array<{ key: string; value: string }> {
  return entries
    .map(([key, value]) => {
      const normalized = value === null || value === undefined
        ? ''
        : typeof value === 'string'
          ? value.trim()
          : JSON.stringify(value);
      return { key, value: normalized };
    })
    .filter((entry) => entry.value.length > 0);
}

function familyTechnicalSpecs(family: Phase1FamilyRecord): Array<{ key: string; value: string }> {
  return keyValueSpecs([
    ['نوع محصول', family.productType],
    ['جنس و متریال', family.material],
    ['ساختار مهندسی', family.construction],
    ['پروفیل', family.profile],
    ['استاندارد مرجع', family.standard],
    ['مشخصات ثابت', family.invariantSpecifications],
    ['مشخصات متغیر مجاز', family.variantSpecifications.join('، ')],
    ['واحد', family.unit],
    ['تعداد کد کالا', family.memberCount],
    ['سطح شواهد', family.evidence],
    ['productType', family.productType],
    ['brand', databaseBrand(family.brand) || 'GENERIC_INDUSTRIAL'],
    ['material', family.material],
    ['construction', family.construction],
    ['profile', family.profile],
    ['standard', family.standard],
    ['unit', family.unit],
  ]);
}

function skuTechnicalSpecs(sku: Phase1SkuRecord): Array<{ key: string; value: string }> {
  return keyValueSpecs([
    ['نوع محصول', sku.productType],
    ['جنس و متریال', sku.material],
    ['ساختار مهندسی', sku.construction],
    ['پروفیل', sku.profile],
    ['استاندارد مرجع', sku.standard],
    ['سازنده', databaseBrand(sku.manufacturer, sku.brand) || 'تأیید نشده'],
    ['شماره فنی سازنده', sku.manufacturerPartNumber],
    ['مشخصات هویتی', sku.identitySpecifications],
    ['مشخصات متغیر', sku.variableSpecifications],
    ['شواهد فنی', [sku.technicalEvidence, sku.sourceUrl].filter(Boolean).join(' | ')],
  ]);
}

function missingIdentitySpecs(sku: Phase1SkuRecord): string[] {
  const missing = Object.entries(sku.identitySpecifications || {})
    .filter(([, value]) => {
      if (value === null || value === undefined || String(value).trim() === '') return true;
      return /^(unknown|unspecified|not verified|not established|نامشخص|ثبت نشده|تأیید نشده)$/i.test(String(value).trim());
    })
    .map(([key]) => key);
  return missing.length ? missing : ['تطبیق هویت دقیق کالا و مدرک سازنده'];
}

function resolutionKind(mapping: OldToNewFamilyMappingRecord): string {
  switch (mapping.migrationAction) {
    case 'RETAINED_1_TO_1':
    case 'MERGED_INTO_SINGLE_FAMILY':
      return 'SINGLE_FAMILY';
    case 'SPLIT_INTO_MULTIPLE':
      return 'SPLIT_MULTI_FAMILY';
    case 'CONVERTED_TO_DIRECT_PRODUCT':
      return 'DIRECT_PRODUCT';
    case 'QUARANTINED_UNRESOLVED':
      return 'QUARANTINE_UNRESOLVED';
    default:
      throw new Error(`Unsupported migration action for ${mapping.oldFamilyId}: ${String(mapping.migrationAction)}`);
  }
}

function sqlJson(tag: string, value: unknown): string {
  const json = JSON.stringify(value);
  let safeTag = tag;
  let suffix = 0;
  while (json.includes(`$${safeTag}$`)) safeTag = `${tag}_${++suffix}`;
  return `$${safeTag}$${json}$${safeTag}$::jsonb`;
}

export interface FamToPfamActivationCounts {
  sourceFamilies: number;
  sourceSkus: number;
  pfamFamilies: number;
  familyMemberSkus: number;
  directSkus: number;
  unresolvedSkus: number;
  menuAssignments: number;
  oldFamilyAliases: number;
}

export interface FamToPfamActivationArtifacts {
  sql: string;
  rollbackSql: string;
  counts: FamToPfamActivationCounts;
}

export function buildFamToPfamActivationArtifacts(
  report: Phase1ReconstructionReport,
  generatedAt = new Date().toISOString()
): FamToPfamActivationArtifacts {
  const skuByCode = new Map(report.skuRecords.map((sku) => [sku.skuCode, sku] as const));
  const familyIds = new Set(report.reconstructedFamilies.map((family) => family.familyId));

  const familyRows = report.reconstructedFamilies.map((family) => {
    if (family.validationVerdict !== 'PASS_HOMOGENEOUS') {
      throw new Error(`Refusing to activate non-homogeneous family ${family.familyId}: ${family.validationVerdict}`);
    }
    if (!family.familyId.startsWith('PFAM-') || family.memberCount < 2) {
      throw new Error(`Invalid reconstructed family identity/cardinality: ${family.familyId}`);
    }
    const sizes = unique(family.memberSkuCodes.map((code) => skuByCode.get(code)?.originalSize));
    const unresolvedMenu = family.categorySlug === 'UNRESOLVED';
    return {
      code: family.familyId,
      canonical_family_code: family.familyId,
      source_row: null,
      name: family.engineeringFamilyName,
      brand: databaseBrand(family.brand),
      category_slug: family.categorySlug || 'UNRESOLVED',
      category_name: unresolvedMenu ? 'نیازمند مسیر منوی مصوب' : family.categoryName,
      submenu: unresolvedMenu ? '' : family.submenu,
      subcategory: unresolvedMenu ? null : family.leaf,
      profiles: family.profile || 'نامشخص',
      sizes_summary: sizes.join(' | ') || 'نامشخص',
      unit: family.unit || 'عدد',
      item_count: family.memberCount,
      materials: family.material || 'نامشخص',
      filters_hint: family.variantSpecifications.join(' | '),
      source_status: 'engineering_audited_20261116',
      description: family.technicalIdentity,
      has_catalogue_image: false,
      images: [],
      technical_specs: familyTechnicalSpecs(family),
      tags: unique([
        family.mainGroupName,
        family.categoryName,
        family.submenu,
        family.familyTypeId,
        family.familyTypeName,
        family.productType,
        family.profile,
      ]),
      correction_pages: null,
      is_deleted: false,
      is_active: true,
      override_version: 1,
      created_at: generatedAt,
      updated_at: generatedAt,
    };
  });

  const skuRows = report.skuRecords.map((sku) => {
    const isFamilyMember = sku.finalStatus === 'FAMILY_MEMBER';
    if (!sku.currentFamily.startsWith('FAM-')) {
      throw new Error(`Expected legacy FAM source for SKU ${sku.skuCode}, received ${sku.currentFamily}`);
    }
    if (isFamilyMember && (!sku.proposedFamily || !familyIds.has(sku.proposedFamily))) {
      throw new Error(`SKU ${sku.skuCode} points to missing PFAM family ${String(sku.proposedFamily)}`);
    }
    return {
      sku_code: sku.skuCode,
      current_family: sku.currentFamily,
      family_code: isFamilyMember ? sku.proposedFamily : sku.currentFamily,
      reconstructed_family_code: isFamilyMember ? sku.proposedFamily : null,
      display_status: sku.finalStatus,
      main_group_id: sku.mainGroupId || null,
      family_type_id: sku.familyTypeId || null,
      proposed_category_slug: sku.proposedCategorySlug || 'UNRESOLVED',
      proposed_submenu: sku.proposedSubmenu || '',
      proposed_leaf: sku.proposedLeaf,
      confidence_score: sku.confidenceScore,
      research_evidence: [sku.technicalEvidence, sku.sourceUrl, sku.decisionReason, sku.requiredAction].filter(Boolean).join(' | '),
      identity_specs: sku.identitySpecifications || {},
      variable_specs: sku.variableSpecifications || {},
      unresolved_reason: sku.finalStatus === 'UNRESOLVED' ? sku.decisionReason : null,
      updated_at: generatedAt,
    };
  });

  const mapRows = report.oldToNewFamilyMappings.map((mapping) => ({
    old_family_code: mapping.oldFamilyId,
    new_family_codes: unique(mapping.newFamilyIds),
    direct_sku_codes: unique(mapping.directProductCodes),
    unresolved_sku_codes: unique(mapping.unresolvedProductCodes),
  }));

  const menuRows = report.reconstructedFamilies.flatMap((family) => {
    const validation = validateFamilyMenuAssignment({
      familyCode: family.familyId,
      familyName: family.engineeringFamilyName,
      productType: family.productType,
      material: family.material,
      profile: family.profile,
      categorySlug: family.categorySlug,
      submenuName: family.submenu,
      leafName: family.leaf,
    });
    if (!validation.valid) return [];
    return [{
      family_code: family.familyId,
      category_slug: family.categorySlug,
      submenu_name: family.submenu,
      leaf_name: family.leaf,
      method: 'engineering_audited',
      created_at: generatedAt,
      updated_at: generatedAt,
    }];
  });

  const aliasRows = report.oldToNewFamilyMappings.map((mapping) => {
    const kind = resolutionKind(mapping);
    const newFamilyCodes = unique(mapping.newFamilyIds);
    const directCodes = unique(mapping.directProductCodes);
    return {
      old_family_code: mapping.oldFamilyId,
      new_family_code: kind === 'SINGLE_FAMILY' && newFamilyCodes.length === 1 ? newFamilyCodes[0] : null,
      direct_sku_code: kind === 'DIRECT_PRODUCT' && directCodes.length === 1 ? directCodes[0] : null,
      resolution_kind: kind,
      all_new_family_codes: newFamilyCodes,
      all_direct_sku_codes: directCodes,
      updated_at: generatedAt,
    };
  });

  const directRows = report.directProducts.map((sku) => ({
    sku_code: sku.skuCode,
    name: sku.originalProductName,
    category_slug: sku.proposedCategorySlug || 'UNRESOLVED',
    category_name: sku.proposedCategory || 'نیازمند مسیر منوی مصوب',
    submenu: sku.proposedSubmenu || '',
    subcategory: sku.proposedLeaf,
    brand: databaseBrand(sku.manufacturer, sku.brand),
    image_url: null,
    technical_specs: skuTechnicalSpecs(sku),
    price_snapshot: {},
    source_family_code: sku.currentFamily,
    is_active: true,
    updated_at: generatedAt,
  }));

  const quarantineRows = report.unresolvedItems.map((sku) => ({
    sku_code: sku.skuCode,
    source_family_code: sku.currentFamily,
    original_name: sku.originalProductName,
    proposed_category_slug: sku.proposedCategorySlug || 'UNRESOLVED',
    proposed_submenu: sku.proposedSubmenu || '',
    proposed_leaf: sku.proposedLeaf,
    unresolved_reason: sku.decisionReason,
    missing_specs: missingIdentitySpecs(sku),
    technical_evidence: JSON.stringify({
      evidence: sku.technicalEvidence,
      sourceUrl: sku.sourceUrl,
      requiredAction: sku.requiredAction,
      confidence: sku.confidence,
      verificationStatus: sku.verificationStatus,
    }),
    updated_at: generatedAt,
  }));

  const familyMemberSkus = skuRows.filter((sku) => sku.display_status === 'FAMILY_MEMBER');
  const directSkus = skuRows.filter((sku) => sku.display_status === 'DIRECT_PRODUCT');
  const unresolvedSkus = skuRows.filter((sku) => sku.display_status === 'UNRESOLVED');
  const counts: FamToPfamActivationCounts = {
    sourceFamilies: report.oldToNewFamilyMappings.length,
    sourceSkus: skuRows.length,
    pfamFamilies: familyRows.length,
    familyMemberSkus: familyMemberSkus.length,
    directSkus: directSkus.length,
    unresolvedSkus: unresolvedSkus.length,
    menuAssignments: menuRows.length,
    oldFamilyAliases: aliasRows.length,
  };

  const expected: FamToPfamActivationCounts = {
    sourceFamilies: 1383,
    sourceSkus: 10435,
    pfamFamilies: 758,
    familyMemberSkus: 9675,
    directSkus: 625,
    unresolvedSkus: 135,
    menuAssignments: 719,
    oldFamilyAliases: 1383,
  };
  for (const key of Object.keys(expected) as Array<keyof FamToPfamActivationCounts>) {
    if (counts[key] !== expected[key]) {
      throw new Error(`FAM-to-PFAM generator count mismatch for ${key}: expected ${expected[key]}, got ${counts[key]}`);
    }
  }
  if (!report.qualityControlMetrics.allSkusAudited ||
      !report.qualityControlMetrics.noDuplicateFamilyMembership ||
      !report.qualityControlMetrics.noInvalidMenuAssignments ||
      !report.qualityControlMetrics.allFamiliesHomogeneous) {
    throw new Error('Phase 1 reconstruction quality gates are not all green; refusing to generate activation SQL');
  }
  if (new Set(skuRows.map((sku) => sku.sku_code)).size !== skuRows.length) {
    throw new Error('Duplicate SKU code in Phase 1 reconstruction report');
  }
  if (new Set(familyRows.map((family) => family.code)).size !== familyRows.length) {
    throw new Error('Duplicate PFAM family code in Phase 1 reconstruction report');
  }
  if (new Set(mapRows.map((mapping) => mapping.old_family_code)).size !== mapRows.length) {
    throw new Error('Duplicate old FAM code in Phase 1 mapping report');
  }
  if (familyMemberSkus.reduce((sum, sku) => sum + 1, 0) + directSkus.length + unresolvedSkus.length !== 10435) {
    throw new Error('SKU partition is not complete and disjoint');
  }

  const sql = buildActivationSql({ counts, familyRows, skuRows, mapRows, menuRows, aliasRows, directRows, quarantineRows });
  const rollbackSql = buildRollbackSql(counts);
  return { sql, rollbackSql, counts };
}

interface ActivationSeed {
  counts: FamToPfamActivationCounts;
  familyRows: Array<Record<string, unknown>>;
  skuRows: Array<Record<string, unknown>>;
  mapRows: Array<Record<string, unknown>>;
  menuRows: Array<Record<string, unknown>>;
  aliasRows: Array<Record<string, unknown>>;
  directRows: Array<Record<string, unknown>>;
  quarantineRows: Array<Record<string, unknown>>;
}

function buildActivationSql(seed: ActivationSeed): string {
  const { counts } = seed;
  const families = sqlJson('pfam_families', seed.familyRows);
  const skus = sqlJson('pfam_skus', seed.skuRows);
  const maps = sqlJson('pfam_old_map', seed.mapRows);
  const menus = sqlJson('pfam_menus', seed.menuRows);
  const aliases = sqlJson('pfam_aliases', seed.aliasRows);
  const direct = sqlJson('pfam_direct', seed.directRows);
  const quarantine = sqlJson('pfam_quarantine', seed.quarantineRows);

  return `-- Generated from the current Phase 1 reconstruction code and approved Excel taxonomy.
-- Never equates legacy FAM identifiers with reconstructed PFAM identifiers.
-- No source rows are deleted; all original records are backed up before activation.
-- Family and SKU image assets are intentionally untouched by this taxonomy migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';
CREATE SCHEMA IF NOT EXISTS internal;

CREATE TEMP TABLE _pfam_family_seed ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${families}) AS x(
  code text,canonical_family_code text,source_row integer,name text,brand text,category_slug text,category_name text,
  submenu text,subcategory text,profiles text,sizes_summary text,unit text,item_count integer,materials text,
  filters_hint text,source_status text,description text,has_catalogue_image boolean,images jsonb,technical_specs jsonb,
  tags jsonb,correction_pages text,is_deleted boolean,is_active boolean,override_version integer,created_at timestamptz,updated_at timestamptz
);
CREATE TEMP TABLE _pfam_sku_seed ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${skus}) AS x(
  sku_code text,current_family text,family_code text,reconstructed_family_code text,display_status text,
  main_group_id text,family_type_id text,proposed_category_slug text,proposed_submenu text,proposed_leaf text,
  confidence_score numeric,research_evidence text,identity_specs jsonb,variable_specs jsonb,unresolved_reason text,updated_at timestamptz
);
CREATE TEMP TABLE _pfam_old_map_seed ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${maps}) AS x(
  old_family_code text,new_family_codes text[],direct_sku_codes text[],unresolved_sku_codes text[]
);
CREATE TEMP TABLE _pfam_menu_seed ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${menus}) AS x(
  family_code text,category_slug text,submenu_name text,leaf_name text,method text,created_at timestamptz,updated_at timestamptz
);
CREATE TEMP TABLE _pfam_alias_seed ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${aliases}) AS x(
  old_family_code text,new_family_code text,direct_sku_code text,resolution_kind text,
  all_new_family_codes text[],all_direct_sku_codes text[],updated_at timestamptz
);
CREATE TEMP TABLE _pfam_direct_seed ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${direct}) AS x(
  sku_code text,name text,category_slug text,category_name text,submenu text,subcategory text,brand text,image_url text,
  technical_specs jsonb,price_snapshot jsonb,source_family_code text,is_active boolean,updated_at timestamptz
);
CREATE TEMP TABLE _pfam_quarantine_seed ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${quarantine}) AS x(
  sku_code text,source_family_code text,original_name text,proposed_category_slug text,proposed_submenu text,proposed_leaf text,
  unresolved_reason text,missing_specs text[],technical_evidence text,updated_at timestamptz
);

DO $preflight$
DECLARE fam_total integer; fam_active integer; pfam_total integer; variants_total integer; fam_variants integer;
        commercial_total integer; fam_menu_total integer; map_total integer;
BEGIN
  SELECT count(*),count(*) FILTER(WHERE is_active AND NOT is_deleted) INTO fam_total,fam_active
    FROM public.catalog_families WHERE code LIKE 'FAM-%';
  SELECT count(*) INTO pfam_total FROM public.catalog_families WHERE code LIKE 'PFAM-%';
  SELECT count(*),count(*) FILTER(WHERE family_code LIKE 'FAM-%') INTO variants_total,fam_variants FROM public.catalog_variants;
  SELECT count(*) INTO commercial_total FROM public.variant_commercial_specs;
  SELECT count(*) INTO fam_menu_total FROM public.catalog_family_menu_assignments WHERE family_code LIKE 'FAM-%';
  SELECT count(*) INTO map_total FROM public.catalog_reconstruction_family_map;
  IF fam_total<>1454 OR fam_active<>1383 OR pfam_total<>0 THEN
    RAISE EXCEPTION 'FAM/PFAM baseline mismatch: total FAM %, active FAM %, PFAM %',fam_total,fam_active,pfam_total;
  END IF;
  IF variants_total<>10435 OR fam_variants<>10435 OR commercial_total<>10435 THEN
    RAISE EXCEPTION 'SKU/commercial baseline mismatch: variants %, FAM variants %, commercial %',variants_total,fam_variants,commercial_total;
  END IF;
  IF fam_menu_total<>1383 OR map_total<>1383 THEN
    RAISE EXCEPTION 'Legacy family menu/map baseline mismatch: assignments %, map rows %',fam_menu_total,map_total;
  END IF;
  IF (SELECT count(*) FROM _pfam_family_seed)<>${counts.pfamFamilies}
     OR (SELECT count(*) FROM _pfam_sku_seed)<>${counts.sourceSkus}
     OR (SELECT count(*) FROM _pfam_old_map_seed)<>${counts.sourceFamilies}
     OR (SELECT count(*) FROM _pfam_menu_seed)<>${counts.menuAssignments}
     OR (SELECT count(*) FROM _pfam_alias_seed)<>${counts.oldFamilyAliases}
     OR (SELECT count(*) FROM _pfam_direct_seed)<>${counts.directSkus}
     OR (SELECT count(*) FROM _pfam_quarantine_seed)<>${counts.unresolvedSkus} THEN
    RAISE EXCEPTION 'Generated PFAM seed row counts do not match the audited manifest';
  END IF;
  IF (SELECT count(*) FROM _pfam_sku_seed WHERE display_status='FAMILY_MEMBER')<>${counts.familyMemberSkus}
     OR (SELECT count(*) FROM _pfam_sku_seed WHERE display_status='DIRECT_PRODUCT')<>${counts.directSkus}
     OR (SELECT count(*) FROM _pfam_sku_seed WHERE display_status='UNRESOLVED')<>${counts.unresolvedSkus} THEN
    RAISE EXCEPTION 'SKU status partition mismatch in generated seed';
  END IF;
  IF EXISTS(
    SELECT 1 FROM _pfam_sku_seed s LEFT JOIN public.catalog_variants v ON v.code=s.sku_code
    WHERE v.code IS NULL OR v.family_code IS DISTINCT FROM s.current_family
  ) THEN RAISE EXCEPTION 'SKU seed does not match the current FAM database rows'; END IF;
  IF EXISTS(
    SELECT 1 FROM _pfam_sku_seed s LEFT JOIN _pfam_family_seed f ON f.code=s.family_code
    WHERE s.display_status='FAMILY_MEMBER' AND f.code IS NULL
  ) THEN RAISE EXCEPTION 'A FAMILY_MEMBER SKU points to a PFAM family absent from the seed'; END IF;
  IF EXISTS(
    SELECT 1 FROM _pfam_old_map_seed s LEFT JOIN public.catalog_reconstruction_family_map m ON m.old_family_code=s.old_family_code
    WHERE m.old_family_code IS NULL
       OR NOT (coalesce(m.new_family_codes,ARRAY[]::text[]) @> coalesce(s.new_family_codes,ARRAY[]::text[])
           AND coalesce(s.new_family_codes,ARRAY[]::text[]) @> coalesce(m.new_family_codes,ARRAY[]::text[]))
       OR NOT (coalesce(m.direct_sku_codes,ARRAY[]::text[]) @> coalesce(s.direct_sku_codes,ARRAY[]::text[])
           AND coalesce(s.direct_sku_codes,ARRAY[]::text[]) @> coalesce(m.direct_sku_codes,ARRAY[]::text[]))
       OR NOT (coalesce(m.unresolved_sku_codes,ARRAY[]::text[]) @> coalesce(s.unresolved_sku_codes,ARRAY[]::text[])
           AND coalesce(s.unresolved_sku_codes,ARRAY[]::text[]) @> coalesce(m.unresolved_sku_codes,ARRAY[]::text[]))
  ) THEN RAISE EXCEPTION 'Generated old-FAM mapping differs from the preserved reconstruction map'; END IF;
  IF EXISTS(SELECT 1 FROM public.catalog_reconstruction_family_map m LEFT JOIN _pfam_old_map_seed s ON s.old_family_code=m.old_family_code WHERE s.old_family_code IS NULL) THEN
    RAISE EXCEPTION 'Generated old-FAM map omits an existing reconstruction mapping';
  END IF;
  IF EXISTS(
    SELECT 1 FROM _pfam_menu_seed m
    LEFT JOIN _pfam_family_seed f ON f.code=m.family_code
    LEFT JOIN public.catalog_categories c ON c.slug=m.category_slug
    WHERE f.code IS NULL OR c.slug IS NULL
  ) THEN RAISE EXCEPTION 'PFAM menu seed contains missing family/category references'; END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='catalog_variants' AND column_name='reconstructed_family_code')
     OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='catalog_variants' AND column_name='display_status')
     OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='catalog_variants' AND column_name='identity_specs')
     OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='catalog_variants' AND column_name='variable_specs') THEN
    RAISE EXCEPTION 'Apply catalog identity compatibility migration before FAM-to-PFAM activation';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS internal.catalog_fam_to_pfam_activation_backup_20261117(
  table_name text NOT NULL,row_key text NOT NULL,row_data jsonb NOT NULL,PRIMARY KEY(table_name,row_key)
);
ALTER TABLE internal.catalog_fam_to_pfam_activation_backup_20261117 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE internal.catalog_fam_to_pfam_activation_backup_20261117 FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE internal.catalog_fam_to_pfam_activation_backup_20261117 IS
  'Private exact pre-activation snapshot for the FAM-to-PFAM catalog activation. Retain for rollback/audit.';

DO $backup$
DECLARE aliases_existed boolean := to_regclass('public.catalog_family_aliases') IS NOT NULL;
BEGIN
  IF EXISTS(SELECT 1 FROM internal.catalog_fam_to_pfam_activation_backup_20261117) THEN
    RAISE EXCEPTION 'FAM-to-PFAM backup already exists; inspect the previous run before retrying';
  END IF;
  INSERT INTO internal.catalog_fam_to_pfam_activation_backup_20261117
    VALUES('__meta__','catalog_family_aliases_existed',jsonb_build_object('existed',aliases_existed));
  INSERT INTO internal.catalog_fam_to_pfam_activation_backup_20261117
    SELECT 'catalog_families',f.code,to_jsonb(f) FROM public.catalog_families f WHERE f.code LIKE 'FAM-%';
  INSERT INTO internal.catalog_fam_to_pfam_activation_backup_20261117
    SELECT 'catalog_variants',v.code,to_jsonb(v) FROM public.catalog_variants v;
  INSERT INTO internal.catalog_fam_to_pfam_activation_backup_20261117
    SELECT 'variant_commercial_specs',s.variant_code,to_jsonb(s) FROM public.variant_commercial_specs s;
  INSERT INTO internal.catalog_fam_to_pfam_activation_backup_20261117
    SELECT 'catalog_family_menu_assignments',a.family_code,to_jsonb(a)
    FROM public.catalog_family_menu_assignments a WHERE a.family_code LIKE 'FAM-%';
  INSERT INTO internal.catalog_fam_to_pfam_activation_backup_20261117
    SELECT 'catalog_direct_skus',d.sku_code,to_jsonb(d) FROM public.catalog_direct_skus d;
  INSERT INTO internal.catalog_fam_to_pfam_activation_backup_20261117
    SELECT 'catalog_unresolved_quarantine',q.sku_code,to_jsonb(q) FROM public.catalog_unresolved_quarantine q;
  IF aliases_existed THEN
    EXECUTE 'INSERT INTO internal.catalog_fam_to_pfam_activation_backup_20261117 SELECT ''catalog_family_aliases'',a.old_family_code,to_jsonb(a) FROM public.catalog_family_aliases a';
  END IF;
END
$backup$;

CREATE TABLE IF NOT EXISTS public.catalog_family_aliases(
  old_family_code text PRIMARY KEY,
  new_family_code text REFERENCES public.catalog_families(code) ON DELETE SET NULL,
  direct_sku_code text,
  resolution_kind text NOT NULL,
  all_new_family_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  all_direct_sku_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalog_family_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_family_aliases FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.catalog_family_aliases TO service_role;

INSERT INTO public.catalog_families(
  code,canonical_family_code,source_row,name,brand,category_slug,category_name,submenu,subcategory,profiles,sizes_summary,
  unit,item_count,materials,filters_hint,source_status,description,has_catalogue_image,image_scope,images,technical_specs,tags,
  correction_pages,is_deleted,is_active,override_version,created_at,updated_at
)
SELECT code,canonical_family_code,source_row,name,brand,category_slug,category_name,submenu,subcategory,profiles,sizes_summary,
  unit,item_count,materials,filters_hint,source_status,description,false,NULL::public.image_scope_type,'[]'::jsonb,
  technical_specs,tags,correction_pages,false,true,override_version,created_at,updated_at
FROM _pfam_family_seed;

UPDATE public.catalog_variants v SET
  family_code=s.family_code,
  reconstructed_family_code=s.reconstructed_family_code,
  display_status=s.display_status,
  main_group_id=s.main_group_id,
  family_type_id=s.family_type_id,
  proposed_category_slug=s.proposed_category_slug,
  proposed_submenu=s.proposed_submenu,
  proposed_leaf=s.proposed_leaf,
  confidence_score=s.confidence_score,
  research_evidence=s.research_evidence,
  identity_specs=s.identity_specs,
  variable_specs=s.variable_specs,
  unresolved_reason=s.unresolved_reason,
  updated_at=s.updated_at
FROM _pfam_sku_seed s WHERE v.code=s.sku_code;

UPDATE public.variant_commercial_specs c SET family_code=s.family_code,updated_at=now()
FROM _pfam_sku_seed s WHERE s.display_status='FAMILY_MEMBER' AND c.variant_code=s.sku_code;

INSERT INTO public.catalog_family_menu_assignments(family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at)
SELECT family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at FROM _pfam_menu_seed
ON CONFLICT(family_code) DO UPDATE SET category_slug=EXCLUDED.category_slug,submenu_name=EXCLUDED.submenu_name,
  leaf_name=EXCLUDED.leaf_name,method=EXCLUDED.method,updated_at=EXCLUDED.updated_at;

INSERT INTO public.catalog_family_aliases(old_family_code,new_family_code,direct_sku_code,resolution_kind,
  all_new_family_codes,all_direct_sku_codes,updated_at)
SELECT old_family_code,new_family_code,direct_sku_code,resolution_kind,all_new_family_codes,all_direct_sku_codes,updated_at
FROM _pfam_alias_seed
ON CONFLICT(old_family_code) DO UPDATE SET new_family_code=EXCLUDED.new_family_code,direct_sku_code=EXCLUDED.direct_sku_code,
  resolution_kind=EXCLUDED.resolution_kind,all_new_family_codes=EXCLUDED.all_new_family_codes,
  all_direct_sku_codes=EXCLUDED.all_direct_sku_codes,updated_at=EXCLUDED.updated_at;

INSERT INTO public.catalog_direct_skus(sku_code,name,category_slug,category_name,submenu,subcategory,brand,image_url,
  technical_specs,price_snapshot,source_family_code,is_active,updated_at)
SELECT sku_code,name,category_slug,category_name,submenu,subcategory,brand,NULL,technical_specs,'{}'::jsonb,
  source_family_code,is_active,updated_at FROM _pfam_direct_seed
ON CONFLICT(sku_code) DO UPDATE SET name=EXCLUDED.name,category_slug=EXCLUDED.category_slug,
  category_name=EXCLUDED.category_name,submenu=EXCLUDED.submenu,subcategory=EXCLUDED.subcategory,
  brand=EXCLUDED.brand,technical_specs=EXCLUDED.technical_specs,source_family_code=EXCLUDED.source_family_code,
  is_active=EXCLUDED.is_active,updated_at=now();

INSERT INTO public.catalog_unresolved_quarantine(sku_code,source_family_code,original_name,proposed_category_slug,
  proposed_submenu,proposed_leaf,unresolved_reason,missing_specs,technical_evidence,updated_at)
SELECT sku_code,source_family_code,original_name,proposed_category_slug,proposed_submenu,proposed_leaf,
  unresolved_reason,missing_specs,technical_evidence,updated_at FROM _pfam_quarantine_seed
ON CONFLICT(sku_code) DO UPDATE SET source_family_code=EXCLUDED.source_family_code,original_name=EXCLUDED.original_name,
  proposed_category_slug=EXCLUDED.proposed_category_slug,proposed_submenu=EXCLUDED.proposed_submenu,
  proposed_leaf=EXCLUDED.proposed_leaf,unresolved_reason=EXCLUDED.unresolved_reason,missing_specs=EXCLUDED.missing_specs,
  technical_evidence=EXCLUDED.technical_evidence,updated_at=EXCLUDED.updated_at;

UPDATE public.catalog_families SET is_active=false,updated_at=now()
WHERE code LIKE 'FAM-%' AND is_active=true;

DO $postflight$
DECLARE pfam integer; fam integer; members integer; direct integer; unresolved integer; menu integer; aliases integer; commercial integer;
BEGIN
  SELECT count(*) INTO pfam FROM public.catalog_families WHERE code LIKE 'PFAM-%' AND is_active AND NOT is_deleted;
  SELECT count(*) INTO fam FROM public.catalog_families WHERE code LIKE 'FAM-%' AND is_active AND NOT is_deleted;
  SELECT count(*) INTO members FROM public.catalog_variants WHERE display_status='FAMILY_MEMBER' AND family_code LIKE 'PFAM-%';
  SELECT count(*) INTO direct FROM public.catalog_variants WHERE display_status='DIRECT_PRODUCT' AND family_code LIKE 'FAM-%';
  SELECT count(*) INTO unresolved FROM public.catalog_variants WHERE display_status='UNRESOLVED' AND family_code LIKE 'FAM-%';
  SELECT count(*) INTO menu FROM public.catalog_family_menu_assignments WHERE family_code LIKE 'PFAM-%';
  SELECT count(*) INTO aliases FROM public.catalog_family_aliases WHERE old_family_code IN (SELECT old_family_code FROM _pfam_old_map_seed);
  SELECT count(*) INTO commercial FROM public.variant_commercial_specs WHERE family_code LIKE 'PFAM-%';
  IF pfam<>${counts.pfamFamilies} OR fam<>0 OR members<>${counts.familyMemberSkus}
     OR direct<>${counts.directSkus} OR unresolved<>${counts.unresolvedSkus}
     OR menu<>${counts.menuAssignments} OR aliases<>${counts.oldFamilyAliases}
     OR commercial<>${counts.familyMemberSkus} THEN
    RAISE EXCEPTION 'FAM-to-PFAM postflight failed: PFAM %, active FAM %, members %, direct %, unresolved %, menu %, aliases %, commercial %',
      pfam,fam,members,direct,unresolved,menu,aliases,commercial;
  END IF;
END
$postflight$;
COMMIT;
`;
}

function buildRollbackSql(counts: FamToPfamActivationCounts): string {
  return `-- Exact rollback for the generated FAM-to-PFAM activation.
-- Run only before further manual catalog edits; the preflight intentionally fails if counts drift.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='10min';
DO $preflight$
DECLARE backup_rows integer; pfam integer; members integer;
BEGIN
  IF to_regclass('internal.catalog_fam_to_pfam_activation_backup_20261117') IS NULL THEN
    RAISE EXCEPTION 'FAM-to-PFAM activation backup not found';
  END IF;
  SELECT count(*) INTO backup_rows FROM internal.catalog_fam_to_pfam_activation_backup_20261117;
  SELECT count(*) INTO pfam FROM public.catalog_families WHERE code LIKE 'PFAM-%';
  SELECT count(*) INTO members FROM public.catalog_variants WHERE display_status='FAMILY_MEMBER' AND family_code LIKE 'PFAM-%';
  IF backup_rows < 25000 OR pfam<>${counts.pfamFamilies} OR members<>${counts.familyMemberSkus} THEN
    RAISE EXCEPTION 'Rollback preflight mismatch: backup rows %, PFAM rows %, PFAM members %',backup_rows,pfam,members;
  END IF;
END
$preflight$;

DELETE FROM public.catalog_family_menu_assignments WHERE family_code LIKE 'PFAM-%';

UPDATE public.catalog_variants v SET
  family_code=b.row_data->>'family_code',
  reconstructed_family_code=b.row_data->>'reconstructed_family_code',
  display_status=b.row_data->>'display_status',
  main_group_id=b.row_data->>'main_group_id',
  family_type_id=b.row_data->>'family_type_id',
  proposed_category_slug=b.row_data->>'proposed_category_slug',
  proposed_submenu=b.row_data->>'proposed_submenu',
  proposed_leaf=b.row_data->>'proposed_leaf',
  confidence_score=NULLIF(b.row_data->>'confidence_score','')::numeric,
  research_evidence=b.row_data->>'research_evidence',
  identity_specs=b.row_data->'identity_specs',
  variable_specs=b.row_data->'variable_specs',
  unresolved_reason=b.row_data->>'unresolved_reason',
  updated_at=NULLIF(b.row_data->>'updated_at','')::timestamptz
FROM internal.catalog_fam_to_pfam_activation_backup_20261117 b
WHERE b.table_name='catalog_variants' AND b.row_key=v.code;

UPDATE public.variant_commercial_specs c SET
  family_code=b.row_data->>'family_code',
  updated_at=NULLIF(b.row_data->>'updated_at','')::timestamptz
FROM internal.catalog_fam_to_pfam_activation_backup_20261117 b
WHERE b.table_name='variant_commercial_specs' AND b.row_key=c.variant_code;

DELETE FROM public.catalog_direct_skus d
WHERE NOT EXISTS(
  SELECT 1 FROM internal.catalog_fam_to_pfam_activation_backup_20261117 b
  WHERE b.table_name='catalog_direct_skus' AND b.row_key=d.sku_code
);
INSERT INTO public.catalog_direct_skus
SELECT (jsonb_populate_record(NULL::public.catalog_direct_skus,b.row_data)).*
FROM internal.catalog_fam_to_pfam_activation_backup_20261117 b
WHERE b.table_name='catalog_direct_skus'
ON CONFLICT(sku_code) DO UPDATE SET
  name=EXCLUDED.name,category_slug=EXCLUDED.category_slug,category_name=EXCLUDED.category_name,
  submenu=EXCLUDED.submenu,subcategory=EXCLUDED.subcategory,brand=EXCLUDED.brand,image_url=EXCLUDED.image_url,
  technical_specs=EXCLUDED.technical_specs,price_snapshot=EXCLUDED.price_snapshot,
  source_family_code=EXCLUDED.source_family_code,is_active=EXCLUDED.is_active,updated_at=EXCLUDED.updated_at;

DELETE FROM public.catalog_unresolved_quarantine q
WHERE NOT EXISTS(
  SELECT 1 FROM internal.catalog_fam_to_pfam_activation_backup_20261117 b
  WHERE b.table_name='catalog_unresolved_quarantine' AND b.row_key=q.sku_code
);
INSERT INTO public.catalog_unresolved_quarantine
SELECT (jsonb_populate_record(NULL::public.catalog_unresolved_quarantine,b.row_data)).*
FROM internal.catalog_fam_to_pfam_activation_backup_20261117 b
WHERE b.table_name='catalog_unresolved_quarantine'
ON CONFLICT(sku_code) DO UPDATE SET
  source_family_code=EXCLUDED.source_family_code,original_name=EXCLUDED.original_name,
  proposed_category_slug=EXCLUDED.proposed_category_slug,proposed_submenu=EXCLUDED.proposed_submenu,
  proposed_leaf=EXCLUDED.proposed_leaf,unresolved_reason=EXCLUDED.unresolved_reason,
  missing_specs=EXCLUDED.missing_specs,technical_evidence=EXCLUDED.technical_evidence,updated_at=EXCLUDED.updated_at;

DO $alias_restore$
DECLARE existed boolean;
BEGIN
  SELECT COALESCE((row_data->>'existed')::boolean,false) INTO existed
  FROM internal.catalog_fam_to_pfam_activation_backup_20261117
  WHERE table_name='__meta__' AND row_key='catalog_family_aliases_existed';
  IF existed THEN
    DELETE FROM public.catalog_family_aliases a
    WHERE NOT EXISTS(
      SELECT 1 FROM internal.catalog_fam_to_pfam_activation_backup_20261117 b
      WHERE b.table_name='catalog_family_aliases' AND b.row_key=a.old_family_code
    );
    INSERT INTO public.catalog_family_aliases
    SELECT (jsonb_populate_record(NULL::public.catalog_family_aliases,b.row_data)).*
    FROM internal.catalog_fam_to_pfam_activation_backup_20261117 b
    WHERE b.table_name='catalog_family_aliases'
    ON CONFLICT(old_family_code) DO UPDATE SET
      new_family_code=EXCLUDED.new_family_code,direct_sku_code=EXCLUDED.direct_sku_code,
      resolution_kind=EXCLUDED.resolution_kind,all_new_family_codes=EXCLUDED.all_new_family_codes,
      all_direct_sku_codes=EXCLUDED.all_direct_sku_codes,updated_at=EXCLUDED.updated_at;
  ELSE
    DROP TABLE IF EXISTS public.catalog_family_aliases;
  END IF;
END
$alias_restore$;

DELETE FROM public.catalog_families WHERE code LIKE 'PFAM-%';
UPDATE public.catalog_families f SET
  is_active=(b.row_data->>'is_active')::boolean,
  updated_at=NULLIF(b.row_data->>'updated_at','')::timestamptz
FROM internal.catalog_fam_to_pfam_activation_backup_20261117 b
WHERE b.table_name='catalog_families' AND b.row_key=f.code;

COMMIT;
`;
}

function main(): void {
  const rawFamilies = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'tests/fixtures/catalogueSource.json'), 'utf8'));
  const directSql = fs.readFileSync(path.join(ROOT_DIR, 'ops/sql/20261114_catalog_sku_level_menu_assignments.sql'), 'utf8');
  const research = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'docs/technical-research-2642.json'), 'utf8'));
  const report = runPhase1CatalogReconstruction(rawFamilies, {
    directSkuSqlText: directSql,
    beltRefs: extractBeltRefsFromTechnicalResearch(research),
  });
  const artifacts = buildFamToPfamActivationArtifacts(report);
  console.log('FAM_TO_PFAM_ACTIVATION_COUNTS', JSON.stringify(artifacts.counts));
  if (!process.argv.includes('--check')) {
    const outputDir = path.join(ROOT_DIR, 'ops/sql');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, '20261117_fam_to_pfam_activation.sql'), artifacts.sql, 'utf8');
    fs.writeFileSync(path.join(outputDir, '20261117_fam_to_pfam_activation_rollback.sql'), artifacts.rollbackSql, 'utf8');
    console.log('FAM_TO_PFAM_ACTIVATION_SQL_WRITTEN');
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) main();
