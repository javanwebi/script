-- Engineering corrections backed by the SWR Europe manufacturer catalogue and the approved belt-menu audit.
-- Separates crowned CRC from welded PU round belts; banded V-belts from single V-belts;
-- American wedge (3V/5V/8V) from metric narrow wedge (SPZ/SPA/SPB/SPC);
-- and corrects SWR XP raw-edge cogged material/construction metadata.
-- No family or SKU is deleted. Uncertain exact SKU matches remain needs-identification.

BEGIN;

CREATE SCHEMA IF NOT EXISTS internal;

DO $$
BEGIN
  IF to_regclass('internal.catalog_belt_family_engineering_backup_20261117') IS NOT NULL THEN
    RAISE EXCEPTION 'Belt engineering backup already exists; inspect the prior run before retrying';
  END IF;

  IF (SELECT count(*) FROM public.catalog_variants WHERE variable_specs->>'beltDivision'='vbelt-crowned-crc') <> 103 THEN
    RAISE EXCEPTION 'Expected 103 crowned CRC/TRC variants';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants WHERE variable_specs->>'beltDivision'='vbelt-banded') <> 15 THEN
    RAISE EXCEPTION 'Expected 15 banded V-belt variants';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE upper(coalesce(brand,''))='SWR'
        AND upper(coalesce(identity_specs->>'profile','')) IN ('XPZ','XPA','XPB','XPC')) <> 139 THEN
    RAISE EXCEPTION 'Expected 139 SWR XP raw-edge cogged variants';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE upper(coalesce(brand,''))='SWR'
        AND upper(coalesce(identity_specs->>'profile',''))='AA') <> 2 THEN
    RAISE EXCEPTION 'Expected 2 SWR AA double-V variants';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE upper(coalesce(identity_specs->>'profile',''))='AA') <> 4 THEN
    RAISE EXCEPTION 'Expected 4 AA double-V variants across SWR and generic families';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE upper(coalesce(identity_specs->>'profile','')) IN ('3V','3VX','5V','5VX','8V','8VX')) <> 31 THEN
    RAISE EXCEPTION 'Expected 31 American wedge V-belt variants';
  END IF;
  IF (SELECT count(*) FROM public.catalog_direct_skus
      WHERE sku_code IN ('33969','39183','27843','27850','37496','41253','28363','37186','37188','41602','52319','39861','31315','32280')) <> 14 THEN
    RAISE EXCEPTION 'Expected 14 direct wedge/banded SKUs';
  END IF;
  IF (SELECT count(*) FROM public.catalog_families
      WHERE code IN (
        'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395',
        'PFAM-تسمه-V-شکل-به--SWR-SPC-BANDED-488',
        'PFAM-تسمه-V-شکل-به--GENERIC--C-BANDED-654',
        'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641',
        'PFAM-تسمه-V-شکل-به--DONGIL-C-BANDED-655'
      ) AND is_active=true AND coalesce(is_deleted,false)=false) <> 5 THEN
    RAISE EXCEPTION 'Expected 5 active banded families';
  END IF;
  IF (SELECT count(*) FROM public.catalog_families
      WHERE code IN (
        'PFAM-تسمه-V-شکل-پرو-SWR-5V-489',
        'PFAM-تسمه-V-شکل-پرو-SWR-8V-140',
        'PFAM-تسمه-V-شکل-پرو-OPTIBELT-8V-642'
      ) AND is_active=true AND coalesce(is_deleted,false)=false) <> 3 THEN
    RAISE EXCEPTION 'Expected the 3 active pure 5V/8V wedge families';
  END IF;
  IF (SELECT count(*) FROM public.catalog_family_menu_assignments
      WHERE family_code IN (
        'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395',
        'PFAM-تسمه-V-شکل-به--SWR-SPC-BANDED-488',
        'PFAM-تسمه-V-شکل-به--GENERIC--C-BANDED-654',
        'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641',
        'PFAM-تسمه-V-شکل-به--DONGIL-C-BANDED-655',
        'PFAM-تسمه-V-شکل-پرو-SWR-8V-140',
        'PFAM-تسمه-V-شکل-پرو-OPTIBELT-8V-642',
        'PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105'
      )) <> 8 THEN
    RAISE EXCEPTION 'Expected 8 active family menu assignments for banded, 8V and XPZ corrections';
  END IF;
END $$;

CREATE TABLE internal.catalog_belt_family_engineering_backup_20261117 (
  table_name text NOT NULL CHECK (
    table_name IN ('catalog_variants','catalog_families','catalog_family_menu_assignments','catalog_direct_skus')
  ),
  row_key text NOT NULL,
  row_data jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name,row_key)
);
ALTER TABLE internal.catalog_belt_family_engineering_backup_20261117 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE internal.catalog_belt_family_engineering_backup_20261117 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE internal.catalog_belt_family_engineering_backup_20261117 IS
  'Private exact pre-change snapshot for 2026-11-17 industrial belt engineering corrections; retained for rollback and audit.';

-- Snapshot every variant touched by this correction.
INSERT INTO internal.catalog_belt_family_engineering_backup_20261117(table_name,row_key,row_data)
SELECT 'catalog_variants',v.code,to_jsonb(v)
FROM public.catalog_variants v
WHERE v.variable_specs->>'beltDivision' IN ('vbelt-crowned-crc','vbelt-banded')
   OR (upper(coalesce(v.brand,''))='SWR'
       AND upper(coalesce(v.identity_specs->>'profile','')) IN ('XPZ','XPA','XPB','XPC'))
   OR upper(coalesce(v.identity_specs->>'profile','')) IN ('AA','3V','3VX','5V','5VX','8V','8VX');

-- Snapshot the 18 pure engineering family records whose labels or approved menu path change.
INSERT INTO internal.catalog_belt_family_engineering_backup_20261117(table_name,row_key,row_data)
SELECT 'catalog_families',f.code,to_jsonb(f)
FROM public.catalog_families f
WHERE f.code IN (
  'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395',
  'PFAM-تسمه-V-شکل-به--SWR-SPC-BANDED-488',
  'PFAM-تسمه-V-شکل-به--GENERIC--C-BANDED-654',
  'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641',
  'PFAM-تسمه-V-شکل-به--DONGIL-C-BANDED-655',
  'PFAM-تسمه-ذوزنقه-ای-GENERIC--CRC-046',
  'PFAM-تسمه-ذوزنقه-ای-SWR-CRC-097',
  'PFAM-تسمه-ذوزنقه-ای-MEGADYNE-CRC-107',
  'PFAM-تسمه-ذوزنقه-ای-GNR-CRC-168',
  'PFAM-تسمه-ذوزنقه-ای-GENERIC--TRC-653',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPA-061',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPB-028',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPC-085',
  'PFAM-تسمه-V-شکل-پرو-SWR-AA-652',
  'PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658',
  'PFAM-تسمه-V-شکل-پرو-SWR-5V-489',
  'PFAM-تسمه-V-شکل-پرو-SWR-8V-140',
  'PFAM-تسمه-V-شکل-پرو-OPTIBELT-8V-642'
);

INSERT INTO internal.catalog_belt_family_engineering_backup_20261117(table_name,row_key,row_data)
SELECT 'catalog_family_menu_assignments',a.family_code,to_jsonb(a)
FROM public.catalog_family_menu_assignments a
WHERE a.family_code IN (
  'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395',
  'PFAM-تسمه-V-شکل-به--SWR-SPC-BANDED-488',
  'PFAM-تسمه-V-شکل-به--GENERIC--C-BANDED-654',
  'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641',
  'PFAM-تسمه-V-شکل-به--DONGIL-C-BANDED-655',
  'PFAM-تسمه-V-شکل-پرو-SWR-8V-140',
  'PFAM-تسمه-V-شکل-پرو-OPTIBELT-8V-642',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105'
);

INSERT INTO internal.catalog_belt_family_engineering_backup_20261117(table_name,row_key,row_data)
SELECT 'catalog_direct_skus',d.sku_code,to_jsonb(d)
FROM public.catalog_direct_skus d
WHERE d.sku_code IN (
  '33969','39183','27843','27850','37496','41253',
  '28363','37186','37188','41602','52319','39861','31315','32280'
);

DO $$
BEGIN
  IF (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_variants') <> 292 THEN
    RAISE EXCEPTION 'Backup failed: expected 292 catalog variant rows';
  END IF;
  IF (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_families') <> 19 THEN
    RAISE EXCEPTION 'Backup failed: expected 19 catalog family rows';
  END IF;
  IF (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_family_menu_assignments') <> 8 THEN
    RAISE EXCEPTION 'Backup failed: expected 8 family menu assignment rows';
  END IF;
  IF (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_direct_skus') <> 14 THEN
    RAISE EXCEPTION 'Backup failed: expected 14 direct SKU rows';
  END IF;
END $$;

-- 1) CRC is not one family type: crowned ridge-top CRC is separate from welded PU round CRC.
UPDATE public.catalog_variants
SET family_type_id='FT-BELT-CROWNED-CRC',
    proposed_category_slug='excel-v2-1-4',
    proposed_submenu='تسمه بارکش',
    proposed_leaf='انواع تسمه بارکش صنعتی',
    identity_specs=jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(identity_specs,'{}'::jsonb),
          '{material}',
          to_jsonb('لاستیک/الاستومر با سطح تاج‌دار (Crowned / Ridge-Top); ترکیب دقیق نیازمند دیتاشیت سازنده است'::text),
          true
        ),
        '{construction}',
        to_jsonb('تسمه مداربسته با سطح فوقانی تاج‌دار؛ نوع لایه‌ها و عضو کششی نیازمند دیتاشیت سازنده است'::text),
        true
      ),
      '{standard}',
      to_jsonb('استاندارد رسمی CRC/TRC در منابع موجود تأیید نشده؛ دیتاشیت سازنده لازم است'::text),
      true
    ),
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material'
            THEN jsonb_set(e,'{value}',to_jsonb('لاستیک/الاستومر با سطح تاج‌دار (Crowned / Ridge-Top); ترکیب دقیق نیازمند دیتاشیت سازنده است'::text),true)
          WHEN e->>'key'='ساختار مهندسی' OR e->>'key'='ساختار و مکانیزم' OR e->>'key'='construction'
            THEN jsonb_set(e,'{value}',to_jsonb('تسمه مداربسته با سطح فوقانی تاج‌دار؛ نوع لایه‌ها و عضو کششی نیازمند دیتاشیت سازنده است'::text),true)
          WHEN e->>'key'='استاندارد مرجع' OR e->>'key'='standard'
            THEN jsonb_set(e,'{value}',to_jsonb('استاندارد رسمی CRC/TRC در منابع موجود تأیید نشده؛ دیتاشیت سازنده لازم است'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    technical_review=jsonb_set(
      jsonb_set(
        coalesce(technical_review,'{}'::jsonb),
        '{references}',
        coalesce(technical_review->'references','[]'::jsonb) ||
          jsonb_build_array(jsonb_build_object(
            'source','esbelt official ceramics application reference',
            'url','https://www.esbelt.com/en/sectors/industrial/ceramics/',
            'scope','application-only',
            'note','Supports ridge-top transport belts for ceramic tile/glazing lines; does not verify the exact SWR/CRC manufacturer SKU.'
          )),
        true
      ),
      '{note}',
      to_jsonb('ساختار تاج‌دار/گرده‌ماهی CRC از تسمه گرد پلی‌یورتان جوشی جداست. منبع Esbelt فقط کاربرد Ridge-Top در خطوط سرامیک را پشتیبانی می‌کند؛ استاندارد، ترکیب لاستیک، کورد و ابعاد دقیق این SKU هنوز با دیتاشیت همان سازنده تطبیق نشده است.'::text),
      true
    ),
    updated_at=now()
WHERE variable_specs->>'beltDivision'='vbelt-crowned-crc';

-- Correct the five active CRC/TRC family records too: do not publish invented compound, cord or standard claims.
UPDATE public.catalog_families f
SET materials='لاستیک/الاستومر با سطح تاج‌دار (Crowned / Ridge-Top); ترکیب دقیق نیازمند دیتاشیت سازنده',
    name=replace(
      replace(f.name,'لاستیک کلروپرن/طبیعی ضدسایش با تاج محدب (Crowned Top)','لاستیک/الاستومر با سطح تاج‌دار (Crowned / Ridge-Top)'),
      'Ceramic Tile Roller Kiln & Glazing Line Ridge-Top C-Belt Standard',
      'استاندارد رسمی تأیید نشده؛ نیازمند دیتاشیت سازنده'
    ),
    description=replace(
      replace(f.description,'لاستیک کلروپرن/طبیعی ضدسایش با تاج محدب (Crowned Top)','لاستیک/الاستومر با سطح تاج‌دار (Crowned / Ridge-Top)'),
      'Ceramic Tile Roller Kiln & Glazing Line Ridge-Top C-Belt Standard',
      'استاندارد رسمی تأیید نشده؛ نیازمند دیتاشیت سازنده'
    ),
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material'
            THEN jsonb_set(e,'{value}',to_jsonb('لاستیک/الاستومر با سطح تاج‌دار (Crowned / Ridge-Top); ترکیب دقیق نیازمند دیتاشیت سازنده'::text),true)
          WHEN e->>'key'='ساختار مهندسی' OR e->>'key'='construction'
            THEN jsonb_set(e,'{value}',to_jsonb('تسمه مداربسته با سطح فوقانی تاج‌دار؛ نوع لایه‌ها و عضو کششی نیازمند دیتاشیت سازنده است'::text),true)
          WHEN e->>'key'='استاندارد مرجع' OR e->>'key'='standard'
            THEN jsonb_set(e,'{value}',to_jsonb('استاندارد رسمی CRC/TRC در منابع موجود تأیید نشده؛ دیتاشیت سازنده لازم است'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(f.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    updated_at=now()
WHERE f.code IN (
  'PFAM-تسمه-ذوزنقه-ای-GENERIC--CRC-046',
  'PFAM-تسمه-ذوزنقه-ای-SWR-CRC-097',
  'PFAM-تسمه-ذوزنقه-ای-MEGADYNE-CRC-107',
  'PFAM-تسمه-ذوزنقه-ای-GNR-CRC-168',
  'PFAM-تسمه-ذوزنقه-ای-GENERIC--TRC-653'
);

-- 2) Banded V-belts have a separate family type and must not sit in a single-belt leaf.
UPDATE public.catalog_variants v
SET family_type_id='FT-VBELT-BANDED',
    identity_specs=jsonb_set(
      jsonb_set(
        coalesce(v.identity_specs,'{}'::jsonb),
        '{material}',
        to_jsonb('بدنه لاستیکی با نوار پیونددهنده فوقانی (Tie-Band / Banded V-Belt); ترکیب دقیق لاستیک نیازمند دیتاشیت سازنده است'::text),
        true
      ),
      '{construction}',
      to_jsonb('چند شاخه V متصل به نوار پشتی مشترک؛ جنس و آرایش دقیق عضو کششی نیازمند دیتاشیت سازنده است'::text),
      true
    ),
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material'
            THEN jsonb_set(e,'{value}',to_jsonb('بدنه لاستیکی با نوار پیونددهنده فوقانی (Tie-Band / Banded V-Belt); ترکیب دقیق لاستیک نیازمند دیتاشیت سازنده است'::text),true)
          WHEN e->>'key'='ساختار مهندسی' OR e->>'key'='ساختار و مکانیزم' OR e->>'key'='construction'
            THEN jsonb_set(e,'{value}',to_jsonb('چند شاخه V متصل به نوار پشتی مشترک؛ جنس و آرایش دقیق عضو کششی نیازمند دیتاشیت سازنده است'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(v.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    technical_review=jsonb_set(
      coalesce(v.technical_review,'{}'::jsonb),
      '{note}',
      to_jsonb('ساختار Banded / Powerband از روی پروفیل و نوار پیونددهنده شناسایی شده است؛ ترکیب دقیق لاستیک و جنس/آرایش کورد بدون دیتاشیت سازنده تأیید نشده است.'::text),
      true
    ),
    proposed_leaf=NULL,
    updated_at=now()
WHERE v.variable_specs->>'beltDivision'='vbelt-banded';

UPDATE public.catalog_families
SET subcategory=NULL,
    updated_at=now()
WHERE code IN (
  'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395',
  'PFAM-تسمه-V-شکل-به--SWR-SPC-BANDED-488',
  'PFAM-تسمه-V-شکل-به--GENERIC--C-BANDED-654',
  'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641',
  'PFAM-تسمه-V-شکل-به--DONGIL-C-BANDED-655'
);

UPDATE public.catalog_families f
SET materials='بدنه لاستیکی با نوار پیونددهنده فوقانی (Tie-Band / Banded V-Belt); ترکیب دقیق لاستیک نیازمند دیتاشیت سازنده است',
    name=replace(f.name,'لاستیک کلروپرن با نوار پشتی مسلح یکپارچه (Tie-Band Reinforced Neoprene)','بدنه لاستیکی با نوار پیونددهنده فوقانی (Tie-Band / Banded V-Belt)'),
    description=replace(f.description,'لاستیک کلروپرن با نوار پشتی مسلح یکپارچه (Tie-Band Reinforced Neoprene)','بدنه لاستیکی با نوار پیونددهنده فوقانی (Tie-Band / Banded V-Belt)'),
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material'
            THEN jsonb_set(e,'{value}',to_jsonb('بدنه لاستیکی با نوار پیونددهنده فوقانی (Tie-Band / Banded V-Belt); ترکیب دقیق لاستیک نیازمند دیتاشیت سازنده است'::text),true)
          WHEN e->>'key'='ساختار مهندسی' OR e->>'key'='construction'
            THEN jsonb_set(e,'{value}',to_jsonb('چند شاخه V متصل به نوار پشتی مشترک؛ جنس و آرایش دقیق عضو کششی نیازمند دیتاشیت سازنده است'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(f.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    updated_at=now()
WHERE f.code IN (
  'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395',
  'PFAM-تسمه-V-شکل-به--SWR-SPC-BANDED-488',
  'PFAM-تسمه-V-شکل-به--GENERIC--C-BANDED-654',
  'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641',
  'PFAM-تسمه-V-شکل-به--DONGIL-C-BANDED-655'
);

UPDATE public.catalog_family_menu_assignments
SET leaf_name=NULL,
    method='engineering_audited',
    updated_at=now()
WHERE family_code IN (
  'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395',
  'PFAM-تسمه-V-شکل-به--SWR-SPC-BANDED-488',
  'PFAM-تسمه-V-شکل-به--GENERIC--C-BANDED-654',
  'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641',
  'PFAM-تسمه-V-شکل-به--DONGIL-C-BANDED-655'
);

-- 3) American wedge profiles (3V/5V/8V) and their cogged VX versions are not metric narrow wedge.
UPDATE public.catalog_variants v
SET family_type_id=CASE
      WHEN upper(coalesce(v.identity_specs->>'profile','')) IN ('3V','5V','8V') THEN 'FT-VBELT-WEDGE'
      ELSE 'FT-VBELT-COGGED'
    END,
    identity_specs=jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(v.identity_specs,'{}'::jsonb),
          '{productType}',
          to_jsonb(
            'تسمه V گوه‌ای آمریکایی ' ||
            CASE WHEN upper(coalesce(v.identity_specs->>'profile','')) IN ('3VX','5VX','8VX')
              THEN 'دنده‌ای لبه‌خام ' ELSE '' END ||
            'پروفیل ' || upper(coalesce(v.identity_specs->>'profile',''))
          ),
          true
        ),
        '{material}',
        to_jsonb(
          CASE WHEN upper(coalesce(v.identity_specs->>'profile','')) IN ('3VX','5VX','8VX')
            THEN 'لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber); ترکیب دقیق نیازمند دیتاشیت سازنده'
            ELSE 'لاستیک با روکش پارچه‌ای (Wrapped V-Belt); ترکیب دقیق نیازمند دیتاشیت سازنده'
          END
        ),
        true
      ),
      '{construction}',
      to_jsonb('عضو کششی داخلی؛ جنس و آرایش دقیق کورد باید از دیتاشیت همان سازنده تأیید شود'::text),
      true
    ),
    variable_specs=jsonb_set(
      coalesce(v.variable_specs,'{}'::jsonb),
      '{beltDivision}',
      to_jsonb('vbelt-wedge'::text),
      true
    ),
    proposed_category_slug='excel-v2-1-2',
    proposed_submenu='تسمه اسپشیال',
    proposed_leaf=NULL,
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='beltDivision' THEN jsonb_set(e,'{value}',to_jsonb('vbelt-wedge'::text),true)
          WHEN e->>'key'='نوع محصول' THEN jsonb_set(e,'{value}',to_jsonb(
            'تسمه V گوه‌ای آمریکایی ' ||
            CASE WHEN upper(coalesce(v.identity_specs->>'profile','')) IN ('3VX','5VX','8VX')
              THEN 'دنده‌ای لبه‌خام ' ELSE '' END ||
            'پروفیل ' || upper(coalesce(v.identity_specs->>'profile',''))
          ),true)
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material' THEN jsonb_set(e,'{value}',to_jsonb(
            CASE WHEN upper(coalesce(v.identity_specs->>'profile','')) IN ('3VX','5VX','8VX')
              THEN 'لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber); ترکیب دقیق نیازمند دیتاشیت سازنده'
              ELSE 'لاستیک با روکش پارچه‌ای (Wrapped V-Belt); ترکیب دقیق نیازمند دیتاشیت سازنده'
            END
          ),true)
          WHEN e->>'key'='ساختار مهندسی' OR e->>'key'='ساختار و مکانیزم' OR e->>'key'='construction' THEN jsonb_set(e,'{value}',to_jsonb('عضو کششی داخلی؛ جنس و آرایش دقیق کورد باید از دیتاشیت همان سازنده تأیید شود'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(v.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    technical_review=jsonb_set(
      coalesce(v.technical_review,'{}'::jsonb),
      '{note}',
      to_jsonb('پروفیل‌های 3V/5V/8V از نوع گوه‌ای آمریکایی‌اند؛ نسخه‌های VX دنده‌ای لبه‌خام هستند. در منوی اکسل برگ اختصاصی این سری‌ها وجود ندارد؛ فقط زیرمنوی تسمه اسپشیال ثبت می‌شوند و برگ نامرتبط به آن‌ها اختصاص داده نمی‌شود.'::text),
      true
    ),
    updated_at=now()
WHERE upper(coalesce(v.identity_specs->>'profile','')) IN ('3V','3VX','5V','5VX','8V','8VX');

-- 4) SWR XPZ/XPA/XPB/XPC are raw-edge cogged; the former wrapped-material label was wrong.
UPDATE public.catalog_variants v
SET identity_specs=jsonb_set(
      jsonb_set(
        coalesce(v.identity_specs,'{}'::jsonb),
        '{material}',
        to_jsonb('لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)'::text),
        true
      ),
      '{construction}',
      to_jsonb('بدنه دنده‌دار لبه‌خام با عضو کششی داخلی؛ جنس و آرایش دقیق کورد نیازمند دیتاشیت سری سازنده است.'::text),
      true
    ),
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='جنس و متریال' THEN jsonb_set(e,'{value}',to_jsonb('لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)'::text),true)
          WHEN e->>'key'='ساختار مهندسی' THEN jsonb_set(e,'{value}',to_jsonb('بدنه دنده‌دار لبه‌خام با عضو کششی داخلی؛ جنس و آرایش دقیق کورد نیازمند دیتاشیت سری سازنده است.'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(v.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    proposed_category_slug='excel-v2-1-2',
    proposed_submenu='تسمه اسپشیال',
    proposed_leaf='SPA , SPB , SPC و دندانه‌دار',
    research_evidence='OFFICIAL_CATALOG',
    technical_review=jsonb_set(
      jsonb_set(
        coalesce(v.technical_review,'{}'::jsonb),
        '{references}',
        coalesce(v.technical_review->'references','[]'::jsonb) ||
          jsonb_build_array(jsonb_build_object(
            'source','SWR Europe official manufacturer catalogue',
            'url','https://www.swr-europe.de/download/SWR_Imagebroschuere_en.pdf',
            'scope','series-level',
            'note','Pages 4-5 list XPZ, XPA, XPB and XPC in the raw-edge cogged V-belt programme; this confirms the series construction, not the exact internal SKU/length.'
          )),
        true
      ),
      '{note}',
      to_jsonb('کاتالوگ رسمی SWR سری XPZ/XPA/XPB/XPC را در گروه Raw-edge cogged V-belts قرار می‌دهد؛ جنس ترکیب و کورد دقیق و تطبیق کد کامل داخلی هنوز نیازمند دیتاشیت همان محصول است.'::text),
      true
    ),
    updated_at=now()
WHERE upper(coalesce(v.brand,''))='SWR'
  AND upper(coalesce(v.identity_specs->>'profile','')) IN ('XPZ','XPA','XPB','XPC');

-- 5) Add manufacturer-series evidence only where the SWR catalogue actually lists the series.
UPDATE public.catalog_variants v
SET research_evidence='OFFICIAL_CATALOG',
    technical_review=jsonb_set(
      jsonb_set(
        coalesce(v.technical_review,'{}'::jsonb),
        '{references}',
        coalesce(v.technical_review->'references','[]'::jsonb) ||
          jsonb_build_array(jsonb_build_object(
            'source','SWR Europe official manufacturer catalogue',
            'url','https://www.swr-europe.de/download/SWR_Imagebroschuere_en.pdf',
            'scope','series-level',
            'note','Catalogue pages 3-5 list wrapped 5V/8V wedge belts, banded 3VX/SPC belts and Double-V AA belts. The catalogue does not identify the local inventory code or confirm each exact length.'
          )),
        true
      ),
      '{note}',
      to_jsonb('کاتالوگ رسمی SWR نوع سری/پروفیل را تأیید می‌کند، اما کد داخلی و طول دقیق هر SKU هنوز با دیتاشیت یا مارکینگ خود تسمه تطبیق نشده است.'::text),
      true
    ),
    updated_at=now()
WHERE upper(coalesce(v.brand,''))='SWR'
  AND (
    upper(coalesce(v.identity_specs->>'profile','')) IN ('AA','5V','8V','3VX','XPZ','XPA','XPB','XPC')
    OR (
      v.variable_specs->>'beltDivision'='vbelt-banded'
      AND upper(coalesce(v.identity_specs->>'profile','')) IN ('3VX-BANDED','SPC-BANDED')
    )
  );

-- 6) AA is a Double-V / hexagonal belt. Keep it unresolved in the menu because no approved Excel leaf exists.
UPDATE public.catalog_variants v
SET identity_specs=jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            coalesce(v.identity_specs,'{}'::jsonb),
            '{productType}',
            to_jsonb('تسمه V دوطرفه شش‌ضلعی پروفیل AA (Double V-Belt)'::text),
            true
          ),
          '{material}',
          to_jsonb('بدنه لاستیکی تسمه V دوطرفه؛ ترکیب دقیق لاستیک نیازمند دیتاشیت سازنده است'::text),
          true
        ),
        '{construction}',
        to_jsonb('مقطع متقارن دوطرفه AA؛ نوع و آرایش عضو کششی نیازمند دیتاشیت سازنده است'::text),
        true
      ),
      '{standard}',
      to_jsonb('ISO 5289 / DIN 7722 (Double V / Hexagonal AA / HAA)'::text),
      true
    ),
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='نوع محصول' THEN jsonb_set(e,'{value}',to_jsonb('تسمه V دوطرفه شش‌ضلعی پروفیل AA (Double V-Belt)'::text),true)
          WHEN e->>'key'='استاندارد مرجع' THEN jsonb_set(e,'{value}',to_jsonb('ISO 5289 / DIN 7722 (Double V / Hexagonal AA / HAA)'::text),true)
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material' THEN jsonb_set(e,'{value}',to_jsonb('بدنه لاستیکی تسمه V دوطرفه؛ ترکیب دقیق لاستیک نیازمند دیتاشیت سازنده است'::text),true)
          WHEN e->>'key'='ساختار مهندسی' OR e->>'key'='ساختار و مکانیزم' OR e->>'key'='construction' THEN jsonb_set(e,'{value}',to_jsonb('مقطع متقارن دوطرفه AA؛ نوع و آرایش عضو کششی نیازمند دیتاشیت سازنده است'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(v.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    updated_at=now()
WHERE upper(coalesce(v.identity_specs->>'profile',''))='AA';

-- 7) Correct family-level names/specifications for the SWR raw-edge XP families.
UPDATE public.catalog_families f
SET materials='لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)',
    name=replace(f.name,'لاستیک کلروپرن با روکش بافت پارچه‌ای (Wrapped V-Belt)','لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)'),
    description=replace(f.description,'لاستیک کلروپرن با روکش بافت پارچه‌ای (Wrapped V-Belt)','لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)'),
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='جنس و متریال' THEN jsonb_set(e,'{value}',to_jsonb('لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)'::text),true)
          WHEN e->>'key'='ساختار مهندسی' THEN jsonb_set(e,'{value}',to_jsonb('بدنه دنده‌دار لبه‌خام با عضو کششی داخلی؛ جنس و آرایش دقیق کورد نیازمند دیتاشیت سری سازنده است.'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(f.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    updated_at=now()
WHERE f.code IN (
  'PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPA-061',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPB-028',
  'PFAM-تسمه-V-شکل-پرو-SWR-XPC-085'
);

-- 8) Family display names now distinguish American wedge and Double-V from generic V-belts.
UPDATE public.catalog_families f
SET materials='لاستیک با روکش پارچه‌ای (Wrapped V-Belt); ترکیب دقیق نیازمند دیتاشیت سازنده',
    name=replace(replace(f.name,'تسمه V شکل پروفیل 5V','تسمه V گوه‌ای آمریکایی پروفیل 5V'),'لاستیک کلروپرن با روکش بافت پارچه‌ای (Wrapped V-Belt)','لاستیک با روکش پارچه‌ای (Wrapped V-Belt)'),
    description=replace(replace(f.description,'تسمه V شکل پروفیل 5V','تسمه V گوه‌ای آمریکایی پروفیل 5V'),'لاستیک کلروپرن با روکش بافت پارچه‌ای (Wrapped V-Belt)','لاستیک با روکش پارچه‌ای (Wrapped V-Belt)'),
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='نوع محصول' THEN jsonb_set(e,'{value}',to_jsonb('تسمه V گوه‌ای آمریکایی پروفیل 5V'::text),true)
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material' THEN jsonb_set(e,'{value}',to_jsonb('لاستیک با روکش پارچه‌ای (Wrapped V-Belt); ترکیب دقیق نیازمند دیتاشیت سازنده'::text),true)
          WHEN e->>'key'='ساختار مهندسی' OR e->>'key'='ساختار و مکانیزم' OR e->>'key'='construction' THEN jsonb_set(e,'{value}',to_jsonb('عضو کششی داخلی؛ جنس و آرایش دقیق کورد نیازمند دیتاشیت سازنده است'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(f.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    updated_at=now()
WHERE f.code='PFAM-تسمه-V-شکل-پرو-SWR-5V-489';

UPDATE public.catalog_families f
SET materials='لاستیک با روکش پارچه‌ای (Wrapped V-Belt); ترکیب دقیق نیازمند دیتاشیت سازنده',
    name=replace(replace(f.name,'تسمه V شکل پروفیل 8V','تسمه V گوه‌ای آمریکایی پروفیل 8V'),'لاستیک کلروپرن با روکش بافت پارچه‌ای (Wrapped V-Belt)','لاستیک با روکش پارچه‌ای (Wrapped V-Belt)'),
    description=replace(replace(f.description,'تسمه V شکل پروفیل 8V','تسمه V گوه‌ای آمریکایی پروفیل 8V'),'لاستیک کلروپرن با روکش بافت پارچه‌ای (Wrapped V-Belt)','لاستیک با روکش پارچه‌ای (Wrapped V-Belt)'),
    submenu='تسمه اسپشیال',
    subcategory=NULL,
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='نوع محصول' THEN jsonb_set(e,'{value}',to_jsonb('تسمه V گوه‌ای آمریکایی پروفیل 8V'::text),true)
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material' THEN jsonb_set(e,'{value}',to_jsonb('لاستیک با روکش پارچه‌ای (Wrapped V-Belt); ترکیب دقیق نیازمند دیتاشیت سازنده'::text),true)
          WHEN e->>'key'='ساختار مهندسی' OR e->>'key'='ساختار و مکانیزم' OR e->>'key'='construction' THEN jsonb_set(e,'{value}',to_jsonb('عضو کششی داخلی؛ جنس و آرایش دقیق کورد نیازمند دیتاشیت سازنده است'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(f.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    updated_at=now()
WHERE f.code IN (
  'PFAM-تسمه-V-شکل-پرو-SWR-8V-140',
  'PFAM-تسمه-V-شکل-پرو-OPTIBELT-8V-642'
);

UPDATE public.catalog_families f
SET materials='بدنه لاستیکی تسمه V دوطرفه؛ ترکیب دقیق لاستیک نیازمند دیتاشیت سازنده است',
    name=replace(f.name,'تسمه V شکل پروفیل AA','تسمه V دوطرفه شش‌ضلعی پروفیل AA'),
    description=replace(f.description,'تسمه V شکل پروفیل AA','تسمه V دوطرفه شش‌ضلعی پروفیل AA'),
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='نوع محصول' THEN jsonb_set(e,'{value}',to_jsonb('تسمه V دوطرفه شش‌ضلعی پروفیل AA (Double V-Belt)'::text),true)
          WHEN e->>'key'='استاندارد مرجع' THEN jsonb_set(e,'{value}',to_jsonb('ISO 5289 / DIN 7722 (Double V / Hexagonal AA / HAA)'::text),true)
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material' THEN jsonb_set(e,'{value}',to_jsonb('بدنه لاستیکی تسمه V دوطرفه؛ ترکیب دقیق لاستیک نیازمند دیتاشیت سازنده است'::text),true)
          WHEN e->>'key'='ساختار مهندسی' OR e->>'key'='ساختار و مکانیزم' OR e->>'key'='construction' THEN jsonb_set(e,'{value}',to_jsonb('مقطع متقارن دوطرفه AA؛ نوع و آرایش عضو کششی نیازمند دیتاشیت سازنده است'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(f.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    updated_at=now()
WHERE f.code IN (
  'PFAM-تسمه-V-شکل-پرو-SWR-AA-652',
  'PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658'
);

-- 9) Approved menu paths: 8V belongs in the wedge/special submenu, not the classical leaf.
UPDATE public.catalog_family_menu_assignments
SET submenu_name='تسمه اسپشیال',
    leaf_name=NULL,
    method='engineering_audited',
    updated_at=now()
WHERE family_code IN (
  'PFAM-تسمه-V-شکل-پرو-SWR-8V-140',
  'PFAM-تسمه-V-شکل-پرو-OPTIBELT-8V-642'
);

-- XPZ is a verified raw-edge cogged narrow-wedge profile and belongs to the approved cogged leaf.
UPDATE public.catalog_family_menu_assignments
SET leaf_name='SPA , SPB , SPC و دندانه‌دار',
    method='engineering_audited',
    updated_at=now()
WHERE family_code='PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105';

UPDATE public.catalog_families
SET subcategory='SPA , SPB , SPC و دندانه‌دار',
    updated_at=now()
WHERE code='PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105';

UPDATE public.catalog_variants v
SET proposed_category_slug='excel-v2-1-2',
    proposed_submenu='تسمه اسپشیال',
    proposed_leaf=NULL,
    updated_at=now()
WHERE upper(coalesce(v.identity_specs->>'profile','')) IN ('3V','3VX','5V','5VX','8V','8VX');

-- 10) Update the direct-SKU projection as well as the family-variant projection.
WITH direct_profiles AS (
  SELECT d.sku_code,
         max(e->>'value') FILTER (WHERE e->>'key'='profile') AS profile
  FROM public.catalog_direct_skus d
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.technical_specs,'[]'::jsonb)) e
  GROUP BY d.sku_code
)
UPDATE public.catalog_direct_skus d
SET submenu='تسمه اسپشیال',
    subcategory='',
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='beltDivision' THEN jsonb_set(e,'{value}',to_jsonb('vbelt-wedge'::text),true)
          WHEN e->>'key'='نوع محصول' THEN jsonb_set(e,'{value}',to_jsonb(
            'تسمه V گوه‌ای آمریکایی ' ||
            CASE WHEN p.profile IN ('3VX','5VX','8VX') THEN 'دنده‌ای لبه‌خام ' ELSE '' END ||
            'پروفیل ' || p.profile
          ),true)
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material' THEN jsonb_set(e,'{value}',to_jsonb(
            CASE WHEN p.profile IN ('3VX','5VX','8VX')
              THEN 'لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber); ترکیب دقیق نیازمند دیتاشیت سازنده'
              ELSE 'لاستیک با روکش پارچه‌ای (Wrapped V-Belt); ترکیب دقیق نیازمند دیتاشیت سازنده'
            END
          ),true)
          WHEN e->>'key'='ساختار و مکانیزم' OR e->>'key'='ساختار مهندسی' OR e->>'key'='construction'
            THEN jsonb_set(e,'{value}',to_jsonb('عضو کششی داخلی؛ جنس و آرایش دقیق کورد باید از دیتاشیت همان سازنده تأیید شود'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(d.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    updated_at=now()
FROM direct_profiles p
WHERE d.sku_code=p.sku_code
  AND p.profile IN ('3V','3VX','5V','5VX','8V','8VX');

UPDATE public.catalog_direct_skus d
SET submenu='کلاسیک و دنده‌دار',
    subcategory='',
    technical_specs=(
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN e->>'key'='جنس و متریال' OR e->>'key'='material'
            THEN jsonb_set(e,'{value}',to_jsonb('بدنه لاستیکی با نوار پیونددهنده فوقانی (Tie-Band / Banded V-Belt); ترکیب دقیق لاستیک نیازمند دیتاشیت سازنده است'::text),true)
          WHEN e->>'key'='ساختار و مکانیزم' OR e->>'key'='ساختار مهندسی' OR e->>'key'='construction'
            THEN jsonb_set(e,'{value}',to_jsonb('چند شاخه V متصل به نوار پشتی مشترک؛ جنس و آرایش دقیق عضو کششی نیازمند دیتاشیت سازنده است'::text),true)
          ELSE e
        END ORDER BY x.ord
      ),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(d.technical_specs,'[]'::jsonb)) WITH ORDINALITY AS x(e,ord)
    ),
    updated_at=now()
WHERE d.sku_code IN ('31315','32280');

-- Keep the technical review path aligned with the same approved category/submenu decision.
UPDATE public.catalog_variants
SET technical_review=jsonb_set(
      coalesce(technical_review,'{}'::jsonb),
      '{categoryPath}',
      to_jsonb(ARRAY['تسمه و انتقال نیرو','تسمه بارکش و تجهیزات جوشی','تسمه بارکش','انواع تسمه بارکش صنعتی']::text[]),
      true
    )
WHERE variable_specs->>'beltDivision'='vbelt-crowned-crc';

UPDATE public.catalog_variants v
SET technical_review=jsonb_set(
      coalesce(v.technical_review,'{}'::jsonb),
      '{categoryPath}',
      to_jsonb(
        CASE
          WHEN upper(coalesce(v.identity_specs->>'profile','')) IN ('3VX-BANDED','SPC-BANDED')
            THEN ARRAY['تسمه و انتقال نیرو','تسمه وی‌بلت (V-Belt)','تسمه اسپشیال']::text[]
          ELSE ARRAY['تسمه و انتقال نیرو','تسمه وی‌بلت (V-Belt)','کلاسیک و دنده‌دار']::text[]
        END
      ),
      true
    )
WHERE v.variable_specs->>'beltDivision'='vbelt-banded';

UPDATE public.catalog_variants
SET technical_review=jsonb_set(
      jsonb_set(
        coalesce(technical_review,'{}'::jsonb),
        '{categoryPath}',
        to_jsonb(ARRAY['تسمه و انتقال نیرو','تسمه وی‌بلت (V-Belt)','تسمه اسپشیال']::text[]),
        true
      ),
      '{originalTechnicalType}',
      to_jsonb('تسمه V گوه‌ای آمریکایی (3V / 5V / 8V)'::text),
      true
    )
WHERE upper(coalesce(identity_specs->>'profile','')) IN ('3V','3VX','5V','5VX','8V','8VX');

UPDATE public.catalog_variants
SET technical_review=jsonb_set(
      jsonb_set(
        coalesce(technical_review,'{}'::jsonb),
        '{categoryPath}',
        to_jsonb(ARRAY['تسمه و انتقال نیرو','تسمه وی‌بلت (V-Belt)','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار']::text[]),
        true
      ),
      '{originalTechnicalType}',
      to_jsonb('تسمه V باریک دنده‌ای لبه‌خام (XPZ / XPA / XPB / XPC)'::text),
      true
    )
WHERE upper(coalesce(brand,''))='SWR'
  AND upper(coalesce(identity_specs->>'profile','')) IN ('XPZ','XPA','XPB','XPC');

UPDATE public.catalog_variants
SET technical_review=jsonb_set(
      jsonb_set(
        coalesce(technical_review,'{}'::jsonb),
        '{categoryPath}',
        to_jsonb(ARRAY['تسمه و انتقال نیرو','نیازمند تعیین تکلیف','تسمه V دوطرفه شش‌ضلعی AA (Double V)']::text[]),
        true
      ),
      '{originalTechnicalType}',
      to_jsonb('تسمه V دوطرفه شش‌ضلعی AA (Double V-Belt)'::text),
      true
    )
WHERE upper(coalesce(identity_specs->>'profile',''))='AA';

-- 11) Keep the exact SKU evidence honest: series-level catalogue evidence is not an exact model match.
-- The official SWR catalogue confirms the series and construction families, while exact local SKU/length matching remains open.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE variable_specs->>'beltDivision'='vbelt-crowned-crc'
        AND family_type_id='FT-BELT-CROWNED-CRC') <> 103 THEN
    RAISE EXCEPTION 'Postcondition failed: crowned CRC type split';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE variable_specs->>'beltDivision'='vbelt-crowned-crc'
        AND identity_specs->>'standard'='استاندارد رسمی CRC/TRC در منابع موجود تأیید نشده؛ دیتاشیت سازنده لازم است'
        AND technical_review->>'standardStatus'='not-established') <> 103 THEN
    RAISE EXCEPTION 'Postcondition failed: CRC/TRC must not retain an invented standard';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE variable_specs->>'beltDivision'='welded-pu-round-crc'
        AND family_type_id='FT-BELT-ROUND-CRC') <> 121 THEN
    RAISE EXCEPTION 'Postcondition failed: welded PU round CRC must remain separate';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE variable_specs->>'beltDivision'='vbelt-banded'
        AND family_type_id='FT-VBELT-BANDED'
        AND proposed_leaf IS NULL) <> 15 THEN
    RAISE EXCEPTION 'Postcondition failed: banded V-belt family separation';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE upper(coalesce(identity_specs->>'profile','')) IN ('3V','5V','8V')
        AND family_type_id='FT-VBELT-WEDGE'
        AND variable_specs->>'beltDivision'='vbelt-wedge'
        AND proposed_submenu='تسمه اسپشیال'
        AND proposed_leaf IS NULL) <> 29 THEN
    RAISE EXCEPTION 'Postcondition failed: American wedge profile classification';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE upper(coalesce(identity_specs->>'profile','')) IN ('3VX','5VX','8VX')
        AND family_type_id='FT-VBELT-COGGED'
        AND variable_specs->>'beltDivision'='vbelt-wedge'
        AND proposed_submenu='تسمه اسپشیال'
        AND proposed_leaf IS NULL) <> 2 THEN
    RAISE EXCEPTION 'Postcondition failed: raw-edge cogged American wedge classification';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE upper(coalesce(brand,''))='SWR'
        AND upper(coalesce(identity_specs->>'profile','')) IN ('XPZ','XPA','XPB','XPC')
        AND identity_specs->>'material'='لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)'
        AND technical_review->>'status'='catalog-extracted'
        AND proposed_category_slug='excel-v2-1-2'
        AND proposed_submenu='تسمه اسپشیال'
        AND proposed_leaf='SPA , SPB , SPC و دندانه‌دار') <> 139 THEN
    RAISE EXCEPTION 'Postcondition failed: SWR XP raw-edge evidence/material or approved menu path';
  END IF;
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE upper(coalesce(identity_specs->>'profile',''))='AA'
        AND family_type_id='FT-VBELT-HEXAGONAL'
        AND identity_specs->>'productType'='تسمه V دوطرفه شش‌ضلعی پروفیل AA (Double V-Belt)'
        AND identity_specs->>'standard'='ISO 5289 / DIN 7722 (Double V / Hexagonal AA / HAA)') <> 4 THEN
    RAISE EXCEPTION 'Postcondition failed: all AA profiles must be identified as Double-V';
  END IF;
  IF (SELECT count(*) FROM public.catalog_family_menu_assignments
      WHERE family_code='PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105'
        AND leaf_name='SPA , SPB , SPC و دندانه‌دار'
        AND method='engineering_audited') <> 1 THEN
    RAISE EXCEPTION 'Postcondition failed: XPZ must use the approved cogged leaf';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.catalog_families
    WHERE code IN (
      'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395',
      'PFAM-تسمه-V-شکل-به--SWR-SPC-BANDED-488',
      'PFAM-تسمه-V-شکل-به--GENERIC--C-BANDED-654',
      'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641',
      'PFAM-تسمه-V-شکل-به--DONGIL-C-BANDED-655',
      'PFAM-تسمه-V-شکل-پرو-SWR-8V-140',
      'PFAM-تسمه-V-شکل-پرو-OPTIBELT-8V-642'
    ) AND subcategory IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Postcondition failed: non-matching banded/wedge leaf still assigned';
  END IF;
  IF (SELECT count(*) FROM public.catalog_direct_skus
      WHERE sku_code IN ('33969','39183','27843','27850','37496','41253','28363','37186','37188','41602','52319','39861')
        AND submenu='تسمه اسپشیال' AND subcategory='') <> 12 THEN
    RAISE EXCEPTION 'Postcondition failed: direct American wedge SKU paths';
  END IF;
  IF (SELECT count(*) FROM public.catalog_direct_skus
      WHERE sku_code IN ('31315','32280')
        AND submenu='کلاسیک و دنده‌دار' AND subcategory='') <> 2 THEN
    RAISE EXCEPTION 'Postcondition failed: direct banded AX SKU paths';
  END IF;
END $$;

COMMIT;
