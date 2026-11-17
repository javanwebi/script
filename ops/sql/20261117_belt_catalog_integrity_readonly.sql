-- Sanat Pish | Industrial belt catalogue production integrity audit (READ-ONLY).
-- Never updates, deletes, reclassifies, deactivates, or restores FAM/PFAM rows.
-- Run on the verified target PostgreSQL database with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ops/sql/20261117_belt_catalog_integrity_readonly.sql
-- Compare results with /api/catalog/categories and /api/catalog/menu-category/:slug.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- 1. Actual published families/SKUs; direct products counted separately.
WITH family_counts AS (
  SELECT f.category_slug,
         count(DISTINCT f.code)::integer AS families,
         count(v.code)::integer AS active_variant_skus
  FROM public.catalog_families f
  LEFT JOIN public.catalog_variants v ON v.family_code=f.code AND v.active
  WHERE f.is_active AND NOT f.is_deleted
    AND f.category_slug IN ('excel-v2-1-1','excel-v2-1-2','excel-v2-1-3','excel-v2-1-4')
  GROUP BY f.category_slug
),
direct_counts AS (
  SELECT category_slug,count(*)::integer AS active_direct_skus
  FROM public.catalog_direct_skus
  WHERE is_active AND category_slug IN ('excel-v2-1-1','excel-v2-1-2','excel-v2-1-3','excel-v2-1-4')
  GROUP BY category_slug
)
SELECT f.category_slug,f.families,f.active_variant_skus,
       coalesce(d.active_direct_skus,0) AS active_direct_skus,
       f.active_variant_skus + coalesce(d.active_direct_skus,0) AS visible_sku_total
FROM family_counts f LEFT JOIN direct_counts d USING(category_slug)
ORDER BY f.category_slug;

-- 2. Unresolved technical families are NOT assigned fictitious Excel leaves.
SELECT count(*)::integer AS active_unresolved_families,
       coalesce(sum(f.item_count),0)::integer AS cached_unresolved_skus,
       (SELECT count(*)::integer FROM public.catalog_variants v
         JOIN public.catalog_families f2 ON f2.code=v.family_code
         WHERE v.active AND f2.is_active AND NOT f2.is_deleted
           AND f2.category_slug='UNRESOLVED') AS actual_unresolved_skus
FROM public.catalog_families f
WHERE f.is_active AND NOT f.is_deleted AND f.category_slug='UNRESOLVED';

-- 3. NULL approved leaf is valid for profiles not represented by a source Excel leaf.
SELECT a.category_slug,a.submenu_name,coalesce(f.profiles,'(unknown)') AS profile,
       count(*)::integer AS parent_only_families
FROM public.catalog_family_menu_assignments a
JOIN public.catalog_families f ON f.code=a.family_code
WHERE f.is_active AND NOT f.is_deleted AND a.category_slug IN
 ('excel-v2-1-1','excel-v2-1-2','excel-v2-1-3','excel-v2-1-4')
 AND a.leaf_name IS NULL
GROUP BY a.category_slug,a.submenu_name,f.profiles
ORDER BY a.category_slug,a.submenu_name,profile;

-- 4. Archived legacy variants: direct product or quarantined, not lost.
SELECT count(*)::integer AS active_legacy_variant_rows,
       count(*) FILTER (WHERE d.is_active)::integer AS also_active_direct_sku,
       count(*) FILTER (WHERE q.sku_code IS NOT NULL)::integer AS technical_quarantine,
       count(*) FILTER (WHERE NOT coalesce(d.is_active,false)
                            AND q.sku_code IS NULL)::integer AS neither_direct_nor_quarantined
FROM public.catalog_variants v
JOIN public.catalog_families f ON f.code=v.family_code
LEFT JOIN public.catalog_direct_skus d ON d.sku_code=v.code
LEFT JOIN public.catalog_unresolved_quarantine q ON q.sku_code=v.code
WHERE v.active AND NOT f.is_active AND f.code LIKE 'FAM-%';

-- 5. Referential integrity: missing family/commercial mismatch/overlap.
SELECT
 (SELECT count(*) FROM public.catalog_variants v
    LEFT JOIN public.catalog_families f ON f.code=v.family_code
    WHERE v.active AND f.code IS NULL) AS active_orphan_variants,
 (SELECT count(*) FROM public.catalog_variants v
    JOIN public.variant_commercial_specs s ON s.variant_code=v.code
    WHERE v.family_code IS DISTINCT FROM s.family_code) AS commercial_family_mismatches,
 (SELECT count(*) FROM public.catalog_variants v
    JOIN public.catalog_families f ON f.code=v.family_code
    JOIN public.catalog_direct_skus d ON d.sku_code=v.code AND d.is_active
    WHERE v.active AND f.is_active AND NOT f.is_deleted) AS duplicate_published_skus;

-- 6. Sample engineering spot-check. Rows are evidence, not remapping orders.
SELECT v.code AS sku_code,v.name AS sku_name,v.family_code,
       CASE WHEN d.sku_code IS NOT NULL THEN 'DIRECT_SKU'
            WHEN f.is_active THEN 'ACTIVE_FAMILY'
            ELSE 'ARCHIVED_OR_QUARANTINED' END AS published_source,
       coalesce(d.category_slug,f.category_slug) AS effective_category_slug,
       CASE WHEN d.sku_code IS NOT NULL THEN d.submenu
            ELSE coalesce(a.submenu_name,'') END AS effective_submenu,
       CASE WHEN d.sku_code IS NOT NULL THEN nullif(d.subcategory,'')
            ELSE a.leaf_name END AS effective_leaf,
       v.identity_specs->>'profile' AS profile
FROM public.catalog_variants v
JOIN public.catalog_families f ON f.code=v.family_code
LEFT JOIN public.catalog_direct_skus d ON d.sku_code=v.code AND d.is_active
LEFT JOIN public.catalog_family_menu_assignments a ON a.family_code=f.code
WHERE v.code IN ('38285','38828','38920','31997','37985','38974','32245','40642')
ORDER BY v.code;

COMMIT;
