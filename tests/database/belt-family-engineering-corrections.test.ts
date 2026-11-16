
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migrationPath = 'ops/sql/20261117_belt_family_engineering_corrections.sql';
const rollbackPath = 'ops/sql/20261117_belt_family_engineering_corrections_rollback.sql';

const bandedFamilies = [
  'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395',
  'PFAM-تسمه-V-شکل-به--SWR-SPC-BANDED-488',
  'PFAM-تسمه-V-شکل-به--GENERIC--C-BANDED-654',
  'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641',
  'PFAM-تسمه-V-شکل-به--DONGIL-C-BANDED-655',
];
const crcFamilies = [
  'PFAM-تسمه-ذوزنقه-ای-GENERIC--CRC-046',
  'PFAM-تسمه-ذوزنقه-ای-SWR-CRC-097',
  'PFAM-تسمه-ذوزنقه-ای-MEGADYNE-CRC-107',
  'PFAM-تسمه-ذوزنقه-ای-GNR-CRC-168',
  'PFAM-تسمه-ذوزنقه-ای-GENERIC--TRC-653',
];
const xpFamilies = [
  'PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPA-061',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPB-028',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPC-085',
];
const aaFamily = 'PFAM-تسمه-V-شکل-پرو-SWR-AA-652';
const genericAaFamily = 'PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658';
const fiveVFamily = 'PFAM-تسمه-V-شکل-پرو-SWR-5V-489';
const swrEightVFamily = 'PFAM-تسمه-V-شکل-پرو-SWR-8V-140';
const optibeltEightVFamily = 'PFAM-تسمه-V-شکل-پرو-OPTIBELT-8V-642';

const oldMaterial = 'لاستیک کلروپرن با روکش بافت پارچه‌ای (Wrapped V-Belt)';
const oldBandMaterial = 'لاستیک کلروپرن با نوار پشتی مسلح یکپارچه (Tie-Band Reinforced Neoprene)';
const oldCrcMaterial = 'لاستیک کلروپرن/طبیعی ضدسایش با تاج محدب (Crowned Top)';
const fakeCrcStandard = 'Ceramic Tile Roller Kiln & Glazing Line Ridge-Top C-Belt Standard';

const specs = (entries: Array<[string, string]>) =>
  JSON.stringify(entries.map(([key, value]) => ({ key, value })));
const familySpecs = (profile: string, material: string, standard: string) => specs([
  ['نوع محصول', 'تسمه آزمایشی ' + profile],
  ['جنس و متریال', material],
  ['ساختار مهندسی', 'کورد پلی‌استر قدیمی'],
  ['استاندارد مرجع', standard],
  ['profile', profile],
  ['material', material],
  ['construction', 'کورد پلی‌استر قدیمی'],
  ['standard', standard],
]);
const review = (status: string) => JSON.stringify({
  note: 'old note',
  status,
  standardStatus: 'not-established',
  references: [],
  categoryPath: ['old', 'wrong'],
  originalTechnicalType: 'old',
});
const identity = (profile: string, material = oldMaterial, construction = 'کورد پلی‌استر قدیمی', standard = 'old standard', brand = 'SWR') =>
  JSON.stringify({ brand, profile, material, construction, standard, productType: 'تسمه V شکل پروفیل ' + profile });
const variable = (beltDivision: string, profile: string) =>
  JSON.stringify({ beltDivision, profile, sidedness: 'single-sided', supplyForm: 'endless-loop' });

test('belt engineering correction migrates exact rows and rolls back from its private snapshot', async () => {
  const migration = await readFile(resolve(process.cwd(), migrationPath), 'utf8');
  const rollback = await readFile(resolve(process.cwd(), rollbackPath), 'utf8');
  assert.match(migration, /FT-BELT-CROWNED-CRC/);
  assert.match(migration, /FT-VBELT-BANDED/);
  assert.match(migration, /FT-VBELT-WEDGE/);
  assert.match(migration, /OFFICIAL_CATALOG/);
  assert.match(rollback, /catalog_belt_family_engineering_backup_20261117/);

  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create table public.catalog_variants (
        code text primary key, family_code text, brand text, identity_specs jsonb, variable_specs jsonb,
        family_type_id text, proposed_category_slug text, proposed_submenu text, proposed_leaf text,
        technical_specs jsonb, technical_review jsonb, research_evidence text,
        updated_at timestamptz not null default now()
      );
      create table public.catalog_families (
        code text primary key, name text, description text, brand text, category_slug text, category_name text,
        submenu text, subcategory text, profiles text, item_count integer, materials text, technical_specs jsonb,
        is_active boolean not null default true, is_deleted boolean not null default false,
        updated_at timestamptz not null default now()
      );
      create table public.catalog_family_menu_assignments (
        family_code text primary key, category_slug text, submenu_name text, leaf_name text, method text,
        updated_at timestamptz not null default now()
      );
      create table public.catalog_direct_skus (
        sku_code text primary key, name text, brand text, source_family_code text, category_slug text,
        category_name text, submenu text, subcategory text, technical_specs jsonb,
        updated_at timestamptz not null default now()
      );
    `);

    const addFamily = async (
      code: string, profile: string, brand: string, material: string, standard: string,
      submenu: string | null, subcategory: string | null, categorySlug = 'excel-v2-1-2',
    ) => {
      await db.query(
        `insert into public.catalog_families
          (code,name,description,brand,category_slug,category_name,submenu,subcategory,profiles,item_count,materials,technical_specs,is_active,is_deleted)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,2,$10,$11::jsonb,true,false)`,
        [
          code, 'تسمه V شکل پروفیل ' + profile + ' | ' + material + ' | ' + standard,
          'توضیح ' + material + ' | ' + standard, brand, categorySlug,
          categorySlug === 'UNRESOLVED' ? 'نیازمند تعیین تکلیف' : 'تسمه وی‌بلت (V-Belt)',
          submenu, subcategory, profile, material, familySpecs(profile, material, standard),
        ],
      );
    };

    for (const code of bandedFamilies) {
      const profile = code.includes('SPC') ? 'SPC-BANDED' : code.includes('C-BANDED') ? 'C-BANDED' : '3VX-BANDED';
      const brand = code.includes('DONGIL') ? 'DONGIL' : code.includes('SWR') ? 'SWR' : 'GENERIC_INDUSTRIAL';
      const submenu = profile.includes('SPC') || profile.includes('3VX') ? 'تسمه اسپشیال' : 'کلاسیک و دنده‌دار';
      await addFamily(code, profile, brand, oldBandMaterial, 'ISO 5290 / RMA IP-20', submenu, 'old leaf');
    }
    for (const code of crcFamilies) {
      const profile = code.includes('TRC') ? 'TRC' : 'CRC';
      await addFamily(code, profile, 'GENERIC', oldCrcMaterial, fakeCrcStandard, 'تسمه بارکش', 'انواع تسمه بارکش صنعتی', 'excel-v2-1-4');
    }
    for (let i = 0; i < xpFamilies.length; i++) {
      const profile = ['XPZ', 'XPA', 'XPB', 'XPC'][i];
      await addFamily(xpFamilies[i], profile, 'SWR', oldMaterial, 'DIN 7753-1 / ISO 4184', 'تسمه اسپشیال', 'SPA , SPB , SPC و دندانه‌دار');
    }
    await addFamily(aaFamily, 'AA', 'SWR', oldMaterial, 'old AA standard', null, null, 'UNRESOLVED');
    await addFamily(genericAaFamily, 'AA', 'GENERIC', oldMaterial, 'old AA standard', null, null, 'UNRESOLVED');
    await addFamily(fiveVFamily, '5V', 'SWR', oldMaterial, 'RMA IP-22 / ISO 4184', 'تسمه اسپشیال', null);
    await addFamily(swrEightVFamily, '8V', 'SWR', oldMaterial, 'RMA IP-22 / ISO 4184', 'کلاسیک و دنده‌دار', 'old leaf');
    await addFamily(optibeltEightVFamily, '8V', 'OPTIBELT', oldMaterial, 'RMA IP-22 / ISO 4184', 'کلاسیک و دنده‌دار', 'old leaf');

    const assignments = [
      ...bandedFamilies.map((family_code, i) => ({
        family_code,
        submenu_name: i === 0 || i === 1 || i === 3 ? 'تسمه اسپشیال' : 'کلاسیک و دنده‌دار',
        leaf_name: 'old leaf',
      })),
      { family_code: swrEightVFamily, submenu_name: 'کلاسیک و دنده‌دار', leaf_name: 'old leaf' },
      { family_code: optibeltEightVFamily, submenu_name: 'کلاسیک و دنده‌دار', leaf_name: 'old leaf' },
      { family_code: xpFamilies[0], submenu_name: 'تسمه اسپشیال', leaf_name: null },
    ];
    for (const row of assignments) {
      await db.query(
        `insert into public.catalog_family_menu_assignments
          (family_code,category_slug,submenu_name,leaf_name,method)
         values($1,'excel-v2-1-2',$2,$3,'admin_verified')`,
        [row.family_code, row.submenu_name, row.leaf_name],
      );
    }

    const addVariant = async (row: {
      code: string; family: string; brand: string; profile: string; division: string; familyType: string;
      material?: string; construction?: string; standard?: string; reviewStatus?: string; research?: string;
      category?: string; submenu?: string; leaf?: string | null;
    }) => {
      const material = row.material ?? oldMaterial;
      const construction = row.construction ?? 'کورد پلی‌استر قدیمی';
      await db.query(
        `insert into public.catalog_variants
          (code,family_code,brand,identity_specs,variable_specs,family_type_id,proposed_category_slug,
           proposed_submenu,proposed_leaf,technical_specs,technical_review,research_evidence)
         values($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)`,
        [
          row.code, row.family, row.brand,
          identity(row.profile, material, construction, row.standard ?? 'old standard', row.brand),
          variable(row.division, row.profile), row.familyType, row.category ?? 'excel-v2-1-2',
          row.submenu ?? 'کلاسیک و دنده‌دار', row.leaf === undefined ? 'old leaf' : row.leaf,
          specs([
            ['پروفیل', row.profile], ['نوع محصول', 'تسمه V شکل پروفیل ' + row.profile],
            ['جنس و متریال', material], ['ساختار مهندسی', construction],
            ['استاندارد مرجع', row.standard ?? 'old standard'], ['beltDivision', row.division],
          ]),
          review(row.reviewStatus ?? 'needs-identification'), row.research ?? 'STANDARD_REFERENCE',
        ],
      );
    };

    for (let i = 0; i < 103; i++) {
      const family = crcFamilies[i % crcFamilies.length];
      const profile = i >= 101 ? 'TRC' : 'CRC';
      await addVariant({
        code: 'CRC-' + i, family, brand: i % 2 ? 'SWR' : 'GENERIC', profile,
        division: 'vbelt-crowned-crc', familyType: 'FT-BELT-ROUND-CRC',
        material: oldCrcMaterial, standard: fakeCrcStandard,
        category: 'excel-v2-1-4', submenu: 'تسمه بارکش',
      });
    }

    const bandedRows = [
      ...Array.from({ length: 4 }, (_, i) => ({ family: bandedFamilies[0], brand: 'SWR', profile: '3VX-BANDED', code: 'BAND-SWR-3VX-' + i })),
      ...Array.from({ length: 3 }, (_, i) => ({ family: bandedFamilies[1], brand: 'SWR', profile: 'SPC-BANDED', code: 'BAND-SWR-SPC-' + i })),
      ...Array.from({ length: 2 }, (_, i) => ({ family: bandedFamilies[2], brand: 'GENERIC', profile: 'C-BANDED', code: 'BAND-GEN-C-' + i })),
      ...Array.from({ length: 2 }, (_, i) => ({ family: bandedFamilies[3], brand: 'GENERIC', profile: '3VX-BANDED', code: 'BAND-GEN-3VX-' + i })),
      ...Array.from({ length: 2 }, (_, i) => ({ family: bandedFamilies[4], brand: 'DONGIL', profile: 'C-BANDED', code: 'BAND-DONGIL-C-' + i })),
      { family: 'FAM-38906', brand: 'SWR', profile: 'AX-BANDED', code: 'BAND-OLD-SWR-AX' },
      { family: 'FAM-35525', brand: 'GENERIC', profile: 'AX-BANDED', code: 'BAND-OLD-GEN-AX' },
    ];
    for (const row of bandedRows) {
      await addVariant({
        code: row.code, family: row.family, brand: row.brand, profile: row.profile,
        division: 'vbelt-banded', familyType: 'FT-VBELT-CLASSICAL', material: oldBandMaterial,
      });
    }

    const xpCounts = [35, 35, 35, 34];
    for (let i = 0; i < xpFamilies.length; i++) {
      const profile = ['XPZ', 'XPA', 'XPB', 'XPC'][i];
      for (let j = 0; j < xpCounts[i]; j++) {
        await addVariant({
          code: 'XP-' + profile + '-' + j, family: xpFamilies[i], brand: 'SWR', profile,
          division: 'vbelt-narrow-wedge', familyType: 'FT-VBELT-COGGED',
          material: oldMaterial, standard: 'DIN 7753-1 / ISO 4184', reviewStatus: 'catalog-extracted',
        });
      }
    }
    for (let i = 0; i < 2; i++) {
      await addVariant({
        code: 'AA-SWR-' + i, family: aaFamily, brand: 'SWR', profile: 'AA',
        division: 'vbelt-hexagonal', familyType: 'FT-VBELT-HEXAGONAL',
        material: oldMaterial, standard: 'old AA standard',
      });
      await addVariant({
        code: 'AA-GENERIC-' + i, family: genericAaFamily, brand: 'GENERIC', profile: 'AA',
        division: 'vbelt-hexagonal', familyType: 'FT-VBELT-HEXAGONAL',
        material: oldMaterial, standard: 'old AA standard',
      });
    }

    const wedgeRows = [
      { profile: '3V', count: 1, brand: 'DONGIL' },
      { profile: '3VX', count: 1, brand: 'SWR' },
      { profile: '5V', count: 3, brand: 'SWR', family: fiveVFamily },
      { profile: '5V', count: 4, brand: 'DONGIL' },
      { profile: '8V', count: 14, brand: 'SWR', family: swrEightVFamily },
      { profile: '8V', count: 2, brand: 'OPTIBELT', family: optibeltEightVFamily },
      { profile: '8V', count: 5, brand: 'GENERIC' },
      { profile: '8VX', count: 1, brand: 'SWR' },
    ];
    let wedgeIndex = 0;
    for (const row of wedgeRows) {
      for (let i = 0; i < row.count; i++) {
        await addVariant({
          code: 'WEDGE-' + wedgeIndex++, family: row.family ?? 'LEGACY-WEDGE',
          brand: row.brand, profile: row.profile, division: 'vbelt-narrow-wedge',
          familyType: 'FT-VBELT-NARROW',
          material: row.profile.endsWith('X') ? 'Raw-edge old material' : oldMaterial,
        });
      }
    }

    for (let i = 0; i < 121; i++) {
      await addVariant({
        code: 'WELDED-' + i, family: 'WELDED-PU', brand: 'GENERIC', profile: 'CRC',
        division: 'welded-pu-round-crc', familyType: 'FT-BELT-ROUND-CRC',
      });
    }

    const directRows = [
      ['33969','DONGIL','3V','vbelt-narrow-wedge','کلاسیک و دنده‌دار','old leaf'],
      ['39183','SWR','3VX','vbelt-narrow-wedge','کلاسیک و دنده‌دار','old leaf'],
      ['27843','DONGIL','5V','vbelt-narrow-wedge','تسمه اسپشیال',''],
      ['27850','OPTIBELT','5V','vbelt-narrow-wedge','تسمه اسپشیال',''],
      ['37496','HANCHANG','5V','vbelt-narrow-wedge','تسمه اسپشیال',''],
      ['41253','INTROTECH','5V','vbelt-narrow-wedge','تسمه اسپشیال',''],
      ['28363','DONGIL','8V','vbelt-narrow-wedge','کلاسیک و دنده‌دار','old leaf'],
      ['37186','HANCHANG','8V','vbelt-narrow-wedge','کلاسیک و دنده‌دار','old leaf'],
      ['37188','','8V','vbelt-narrow-wedge','کلاسیک و دنده‌دار','old leaf'],
      ['41602','INTROTECH','8V','vbelt-narrow-wedge','کلاسیک و دنده‌دار','old leaf'],
      ['52319','FORZA','8V','vbelt-narrow-wedge','کلاسیک و دنده‌دار','old leaf'],
      ['39861','SWR','8VX','vbelt-narrow-wedge','کلاسیک و دنده‌دار','old leaf'],
      ['31315','','AX-BANDED','vbelt-banded','کلاسیک و دنده‌دار','old leaf'],
      ['32280','SWR','AX-BANDED','vbelt-banded','کلاسیک و دنده‌دار','old leaf'],
    ] as const;
    for (const [sku, brand, profile, division, submenu, subcategory] of directRows) {
      const material = profile.endsWith('X') && !profile.endsWith('BANDED')
        ? 'Raw-edge old material'
        : profile.endsWith('BANDED') ? oldBandMaterial : oldMaterial;
      await db.query(
        `insert into public.catalog_direct_skus
          (sku_code,name,brand,source_family_code,category_slug,category_name,submenu,subcategory,technical_specs)
         values($1,$2,$3,'FAM-LEGACY','excel-v2-1-2','تسمه وی‌بلت (V-Belt)',$4,$5,$6::jsonb)`,
        [
          sku, 'direct ' + profile, brand, submenu, subcategory,
          specs([
            ['پروفیل', profile], ['profile', profile], ['beltDivision', division],
            ['نوع محصول', 'تسمه V شکل پروفیل ' + profile],
            ['جنس و متریال', material], ['ساختار و مکانیزم', 'کورد پلی‌استر قدیمی'],
          ]),
        ],
      );
    }

    await db.exec(migration);

    const backup = await db.query(
      `select
        (select count(*)::int from internal.catalog_belt_family_engineering_backup_20261117 where table_name='catalog_variants') variants,
        (select count(*)::int from internal.catalog_belt_family_engineering_backup_20261117 where table_name='catalog_families') families,
        (select count(*)::int from internal.catalog_belt_family_engineering_backup_20261117 where table_name='catalog_family_menu_assignments') assignments,
        (select count(*)::int from internal.catalog_belt_family_engineering_backup_20261117 where table_name='catalog_direct_skus') direct`,
    );
    assert.deepEqual(backup.rows[0], { variants: 292, families: 19, assignments: 8, direct: 14 });

    const checks = await db.query(
      `select
        (select count(*)::int from public.catalog_variants where variable_specs->>'beltDivision'='vbelt-crowned-crc' and family_type_id='FT-BELT-CROWNED-CRC') crc,
        (select count(*)::int from public.catalog_variants where variable_specs->>'beltDivision'='welded-pu-round-crc' and family_type_id='FT-BELT-ROUND-CRC') welded,
        (select count(*)::int from public.catalog_variants where variable_specs->>'beltDivision'='vbelt-banded' and family_type_id='FT-VBELT-BANDED' and proposed_leaf is null) banded,
        (select count(*)::int from public.catalog_variants where upper(identity_specs->>'profile') in ('3V','5V','8V') and family_type_id='FT-VBELT-WEDGE' and variable_specs->>'beltDivision'='vbelt-wedge' and proposed_submenu='تسمه اسپشیال' and proposed_leaf is null) wedge,
        (select count(*)::int from public.catalog_variants where upper(identity_specs->>'profile') in ('3VX','5VX','8VX') and family_type_id='FT-VBELT-COGGED' and variable_specs->>'beltDivision'='vbelt-wedge' and proposed_submenu='تسمه اسپشیال' and proposed_leaf is null) cogged`,
    );
    assert.deepEqual(checks.rows[0], { crc: 103, welded: 121, banded: 15, wedge: 29, cogged: 2 });

    const aa = await db.query(
      `select count(*)::int count from public.catalog_variants
       where upper(identity_specs->>'profile')='AA'
         and family_type_id='FT-VBELT-HEXAGONAL'
         and identity_specs->>'productType'='تسمه V دوطرفه شش‌ضلعی پروفیل AA (Double V-Belt)'
         and identity_specs->>'standard'='ISO 5289 / DIN 7722 (Double V / Hexagonal AA / HAA)'`,
    );
    assert.equal(aa.rows[0].count, 4);

    const xp = await db.query(
      `select count(*)::int count from public.catalog_variants
       where brand='SWR' and upper(identity_specs->>'profile') in ('XPZ','XPA','XPB','XPC')
         and identity_specs->>'material' like '%Raw-Edge Cogged%'
         and research_evidence='OFFICIAL_CATALOG'
         and technical_review->>'status'='catalog-extracted'
         and proposed_category_slug='excel-v2-1-2'
         and proposed_submenu='تسمه اسپشیال'
         and proposed_leaf='SPA , SPB , SPC و دندانه‌دار'`,
    );
    assert.equal(xp.rows[0].count, 139);

    const xpzAssignment = await db.query(
      `select leaf_name,method from public.catalog_family_menu_assignments where family_code=$1`,
      [xpFamilies[0]],
    );
    assert.deepEqual(xpzAssignment.rows[0], {
      leaf_name: 'SPA , SPB , SPC و دندانه‌دار',
      method: 'engineering_audited',
    });

    const direct = await db.query(
      `select
        (select count(*)::int from public.catalog_direct_skus where sku_code in ('33969','39183','27843','27850','37496','41253','28363','37186','37188','41602','52319','39861') and submenu='تسمه اسپشیال' and subcategory='') wedge,
        (select count(*)::int from public.catalog_direct_skus where sku_code in ('31315','32280') and submenu='کلاسیک و دنده‌دار' and subcategory='') banded`,
    );
    assert.deepEqual(direct.rows[0], { wedge: 12, banded: 2 });

    await db.exec(rollback);

    const restored = await db.query(
      `select
        (select count(*)::int from public.catalog_variants where variable_specs->>'beltDivision'='vbelt-crowned-crc' and family_type_id='FT-BELT-ROUND-CRC') crc,
        (select count(*)::int from public.catalog_variants where variable_specs->>'beltDivision'='vbelt-banded' and family_type_id='FT-VBELT-CLASSICAL') banded,
        (select count(*)::int from public.catalog_variants where upper(identity_specs->>'profile') in ('3V','3VX','5V','5VX','8V','8VX') and family_type_id='FT-VBELT-NARROW') wedge,
        (select count(*)::int from public.catalog_variants where brand='SWR' and upper(identity_specs->>'profile') in ('XPZ','XPA','XPB','XPC') and identity_specs->>'material'=$1) xp`,
      [oldMaterial],
    );
    assert.deepEqual(restored.rows[0], { crc: 103, banded: 15, wedge: 31, xp: 139 });

    const aaRestored = await db.query(
      `select count(*)::int count from public.catalog_variants
       where upper(identity_specs->>'profile')='AA' and identity_specs->>'material'=$1`,
      [oldMaterial],
    );
    assert.equal(aaRestored.rows[0].count, 4);

    const xpzRestored = await db.query(
      `select leaf_name from public.catalog_family_menu_assignments where family_code=$1`,
      [xpFamilies[0]],
    );
    assert.equal(xpzRestored.rows[0].leaf_name, null);

    const directRestored = await db.query(
      `select submenu,subcategory from public.catalog_direct_skus where sku_code='39861'`,
    );
    assert.deepEqual(directRestored.rows[0], { submenu: 'کلاسیک و دنده‌دار', subcategory: 'old leaf' });

    const familyRestored = await db.query(
      `select leaf_name from public.catalog_family_menu_assignments where family_code=$1`,
      [bandedFamilies[1]],
    );
    assert.equal(familyRestored.rows[0].leaf_name, 'old leaf');
  } finally {
    await db.close();
  }
});
