-- =============================================================================
-- MASTER SUPABASE SQL SCHEMA FOR SANAT PISH (صنعت پیش)
-- Complete, single-file executable PostgreSQL / Supabase migration schema
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- SECTION 1: EXTENSIONS & ENUM TYPES
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role_type') THEN
        CREATE TYPE public.app_role_type AS ENUM (
            'guest',
            'client',
            'club',
            'agency',
            'warehouse_operator',
            'sales_manager',
            'super_admin'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status_type') THEN
        CREATE TYPE public.account_status_type AS ENUM (
            'pending',
            'active',
            'suspended',
            'rejected'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_grade_code') THEN
        CREATE TYPE public.customer_grade_code AS ENUM (
            'bronze',
            'silver',
            'gold',
            'platinum',
            'diamond',
            'vip_partner'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'image_scope_type') THEN
        CREATE TYPE public.image_scope_type AS ENUM (
            'family',
            'family-example',
            'variant',
            'unassigned'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'technical_review_status_type') THEN
        CREATE TYPE public.technical_review_status_type AS ENUM (
            'reference-enriched',
            'catalog-extracted',
            'needs-identification'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquiry_status_type') THEN
        CREATE TYPE public.inquiry_status_type AS ENUM (
            'pending',
            'reviewing',
            'quoted',
            'approved',
            'rejected',
            'expired',
            'converted_to_order'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_type') THEN
        CREATE TYPE public.order_status_type AS ENUM (
            'pending',
            'confirmed',
            'packing',
            'shipped',
            'delivered',
            'cancelled'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
        CREATE TYPE public.payment_method_type AS ENUM (
            'online',
            'receipt',
            'credit',
            'check',
            'wallet'
        );
    END IF;
END$$;

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- SECTION 2: AUTH USERS INTEGRATION, PROFILES, CRM & AGENCIES
-- -----------------------------------------------------------------------------

-- 1. تنظیمات گرید مشتریان (atlas_customer_grades_v2)
CREATE TABLE IF NOT EXISTS public.customer_grade_configs (
    grade_code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    credit_limit NUMERIC(18, 2) NOT NULL DEFAULT 0,
    settlement_days INTEGER NOT NULL DEFAULT 0,
    min_points INTEGER NOT NULL DEFAULT 0,
    min_purchase_volume NUMERIC(18, 2) NOT NULL DEFAULT 0,
    can_view_prices BOOLEAN NOT NULL DEFAULT TRUE,
    can_view_stock BOOLEAN NOT NULL DEFAULT TRUE,
    can_buy_on_credit BOOLEAN NOT NULL DEFAULT FALSE,
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. پروفایل کاربران متصل به Supabase Auth (بدون ذخیره رمز عبور موازی)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    legacy_user_id TEXT UNIQUE,
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    company_name TEXT,
    national_id TEXT,
    economic_code TEXT,
    registration_number TEXT,
    role public.app_role_type NOT NULL DEFAULT 'client',
    status public.account_status_type NOT NULL DEFAULT 'active',
    grade_code TEXT REFERENCES public.customer_grade_configs(grade_code) ON DELETE SET NULL,
    approved_b2b BOOLEAN NOT NULL DEFAULT FALSE,
    can_view_prices BOOLEAN NOT NULL DEFAULT FALSE,
    can_view_stock BOOLEAN NOT NULL DEFAULT FALSE,
    province TEXT,
    city TEXT,
    address TEXT,
    postal_code TEXT,
    wallet_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
    credit_limit NUMERIC(18, 2) NOT NULL DEFAULT 0,
    credit_used NUMERIC(18, 2) NOT NULL DEFAULT 0,
    current_debt NUMERIC(18, 2) NOT NULL DEFAULT 0,
    custom_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    club_points INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,
    viewed_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON public.user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_approved_b2b ON public.user_profiles(approved_b2b);

-- 3. جدول مشتریان CRM و مشتریان قدیمی (atlas_admin_customers_v1, atlas_legacy_customers_v1)
CREATE TABLE IF NOT EXISTS public.crm_customers (
    id TEXT PRIMARY KEY,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    national_id TEXT,
    economic_code TEXT,
    province TEXT,
    city TEXT,
    address TEXT,
    postal_code TEXT,
    grade_code TEXT REFERENCES public.customer_grade_configs(grade_code) ON DELETE SET NULL,
    approved_b2b BOOLEAN NOT NULL DEFAULT FALSE,
    approval_status TEXT NOT NULL DEFAULT 'pending',
    credit_limit NUMERIC(18, 2) NOT NULL DEFAULT 0,
    used_credit NUMERIC(18, 2) NOT NULL DEFAULT 0,
    wallet_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_spent NUMERIC(18, 2) NOT NULL DEFAULT 0,
    assigned_price_list_id TEXT,
    price_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    credit_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    portal_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_phone ON public.crm_customers(phone);
CREATE INDEX IF NOT EXISTS idx_crm_customers_auth_user ON public.crm_customers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_approved_b2b ON public.crm_customers(approved_b2b);

-- تریگر همگام‌سازی خودکار auth.users با user_profiles و crm_customers
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    matched_crm public.crm_customers%ROWTYPE;
    normalized_phone TEXT;
BEGIN
    normalized_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone', NEW.raw_user_meta_data ->> 'mobile');

    SELECT * INTO matched_crm
    FROM public.crm_customers
    WHERE (normalized_phone IS NOT NULL AND phone = normalized_phone)
       OR (NEW.email IS NOT NULL AND LOWER(email) = LOWER(NEW.email))
    ORDER BY is_legacy ASC, updated_at DESC
    LIMIT 1;

    INSERT INTO public.user_profiles (
        id,
        legacy_user_id,
        phone,
        email,
        full_name,
        company_name,
        role,
        status,
        grade_code,
        approved_b2b,
        can_view_prices,
        can_view_stock,
        credit_limit,
        credit_used,
        wallet_balance,
        club_points
    )
    VALUES (
        NEW.id,
        matched_crm.id,
        normalized_phone,
        NEW.email,
        COALESCE(matched_crm.name, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
        COALESCE(matched_crm.company, NEW.raw_user_meta_data ->> 'company'),
        COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role_type, 'client'),
        'active',
        matched_crm.grade_code,
        COALESCE(matched_crm.approved_b2b, FALSE),
        COALESCE(matched_crm.approved_b2b, FALSE),
        COALESCE(matched_crm.approved_b2b, FALSE),
        COALESCE(matched_crm.credit_limit, 0),
        COALESCE(matched_crm.used_credit, 0),
        COALESCE(matched_crm.wallet_balance, 0),
        COALESCE(matched_crm.points, 0)
    )
    ON CONFLICT (id) DO UPDATE
    SET phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
        email = COALESCE(EXCLUDED.email, public.user_profiles.email),
        updated_at = NOW();

    IF matched_crm.id IS NOT NULL THEN
        UPDATE public.crm_customers
        SET auth_user_id = NEW.id,
            updated_at = NOW()
        WHERE id = matched_crm.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_sync ON auth.users;
CREATE TRIGGER on_auth_user_created_sync
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_sync();

-- 4. درخواست‌های اخذ نمایندگی (hyper_sanat_agency_applications_v1)
CREATE TABLE IF NOT EXISTS public.agency_applications (
    id TEXT PRIMARY KEY,
    applicant_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    store_area_sqm INTEGER,
    ownership_type TEXT,
    experience_years INTEGER,
    active_brands TEXT,
    requested_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. نمایندگان فعال و تاییدشده (atlas_admin_active_agencies_v1)
CREATE TABLE IF NOT EXISTS public.agencies (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT NOT NULL,
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    credit_limit NUMERIC(18, 2) NOT NULL DEFAULT 0,
    current_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
    next_check_date TEXT,
    contract_status TEXT NOT NULL DEFAULT 'valid',
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 15,
    sub_users JSONB NOT NULL DEFAULT '[]'::jsonb,
    territories JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_public_representative BOOLEAN NOT NULL DEFAULT TRUE,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agencies_code ON public.agencies(code);
CREATE INDEX IF NOT EXISTS idx_agencies_province_city ON public.agencies(province, city);

-- 6. فیش‌های واریزی نمایندگان (hyper_sanat_deposit_receipts_v1)
CREATE TABLE IF NOT EXISTS public.agency_deposit_receipts (
    id TEXT PRIMARY KEY,
    agency_id TEXT REFERENCES public.agencies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    dealer_name TEXT NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    tracking_code TEXT NOT NULL,
    deposit_date TEXT,
    bank_name TEXT,
    receipt_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. درخواست‌های تامین قطعه نمایندگان (hyper_sanat_supply_requests_v1)
CREATE TABLE IF NOT EXISTS public.agency_supply_requests (
    id TEXT PRIMARY KEY,
    agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
    agency_name TEXT NOT NULL,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    urgency TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. پیام‌های پنل نمایندگان (hyper_sanat_dealer_messages_v1)
CREATE TABLE IF NOT EXISTS public.agency_messages (
    id TEXT PRIMARY KEY,
    agency_id TEXT REFERENCES public.agencies(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- SECTION 3: CATALOG FAMILIES, VARIANTS, REFERENCES & COMMERCIAL ISOLATION
-- -----------------------------------------------------------------------------

-- 1. برندها (atlas_admin_brands_v1)
CREATE TABLE IF NOT EXISTS public.catalog_brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    country TEXT,
    description TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. دسته‌بندی‌ها (atlas_admin_categories_v1)
CREATE TABLE IF NOT EXISTS public.catalog_categories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
    submenu TEXT,
    technical_type TEXT,
    icon TEXT,
    image_url TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. مانیفست ایمپورت کاتالوگ مرجع
CREATE TABLE IF NOT EXISTS public.catalog_import_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file TEXT NOT NULL,
    source_sha256 TEXT NOT NULL UNIQUE,
    sheet_name TEXT NOT NULL,
    families_count INTEGER NOT NULL,
    skus_count INTEGER NOT NULL,
    categories_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    submenus_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_types_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. خانواده‌های محصولات کاتالوگ (۱۳۸۳ خانواده در catalogueSource.json - کاملاً غیرتجاری)
CREATE TABLE IF NOT EXISTS public.catalog_families (
    code TEXT PRIMARY KEY,
    canonical_family_code TEXT,
    source_row INTEGER,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'ثبت نشده',
    category_slug TEXT NOT NULL,
    category_name TEXT NOT NULL,
    submenu TEXT,
    subcategory TEXT,
    profiles TEXT,
    sizes_summary TEXT,
    unit TEXT NOT NULL DEFAULT 'عدد',
    item_count INTEGER NOT NULL DEFAULT 0,
    materials TEXT,
    filters_hint TEXT,
    source_status TEXT,
    description TEXT,
    has_catalogue_image BOOLEAN NOT NULL DEFAULT FALSE,
    image_scope public.image_scope_type,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_specs JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    correction_pages TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    override_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_families_category_slug ON public.catalog_families(category_slug);
CREATE INDEX IF NOT EXISTS idx_catalog_families_canonical ON public.catalog_families(canonical_family_code);
CREATE INDEX IF NOT EXISTS idx_catalog_families_name_trgm ON public.catalog_families USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_catalog_families_specs_gin ON public.catalog_families USING gin (technical_specs);

-- 5. کدهای کالا / واریانت‌های انبار (۲۶۴۲+ کد کالا در variants - کاملاً غیرتجاری)
CREATE TABLE IF NOT EXISTS public.catalog_variants (
    code TEXT PRIMARY KEY,
    family_code TEXT NOT NULL REFERENCES public.catalog_families(code) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size TEXT,
    model TEXT,
    brand TEXT,
    unit TEXT NOT NULL DEFAULT 'عدد',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_specs JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_review JSONB NOT NULL DEFAULT '{}'::jsonb,
    in_research_cohort BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_variants_family_code ON public.catalog_variants(family_code);
CREATE INDEX IF NOT EXISTS idx_catalog_variants_name_trgm ON public.catalog_variants USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_catalog_variants_size_trgm ON public.catalog_variants USING gin (size gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_catalog_variants_specs_gin ON public.catalog_variants USING gin (technical_specs);

-- 6. جدول محافظت‌شده اطلاعات تجاری، قیمت و موجودی (حریم خصوصی کامل)
CREATE TABLE IF NOT EXISTS public.variant_commercial_specs (
    variant_code TEXT PRIMARY KEY REFERENCES public.catalog_variants(code) ON DELETE CASCADE,
    family_code TEXT NOT NULL REFERENCES public.catalog_families(code) ON DELETE CASCADE,
    price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    base_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    retail_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    wholesale_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    dealer_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    stock_known BOOLEAN NOT NULL DEFAULT FALSE,
    inquiry_only BOOLEAN NOT NULL DEFAULT TRUE,
    currency TEXT NOT NULL DEFAULT 'IRR',
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variant_commercial_family ON public.variant_commercial_specs(family_code);

-- 7. جدول خلاصه کاتالوگ (۸۶۴ رکورد در catalogSummary.json)
CREATE TABLE IF NOT EXISTS public.catalog_summary_entries (
    code TEXT PRIMARY KEY,
    forza_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category_slug TEXT NOT NULL,
    category_name TEXT NOT NULL,
    subcategory TEXT,
    page INTEGER,
    image_url TEXT,
    specs JSONB NOT NULL DEFAULT '[]'::jsonb,
    linked_family_code TEXT REFERENCES public.catalog_families(code) ON DELETE SET NULL,
    linked_variant_code TEXT REFERENCES public.catalog_variants(code) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_summary_forza_code ON public.catalog_summary_entries(forza_code);

-- 8. ابعاد پین سر رولر کاتالوگ صاحب کالا (ownerCataloguePinTable.json)
CREATE TABLE IF NOT EXISTS public.owner_catalogue_pin_rows (
    sku TEXT PRIMARY KEY,
    dim_2r_outer TEXT,
    dim_w TEXT,
    dim_h TEXT,
    dim_2r_inner TEXT,
    units TEXT NOT NULL DEFAULT 'mm',
    pdf_page INTEGER NOT NULL DEFAULT 106,
    printed_page INTEGER NOT NULL DEFAULT 88,
    drawing_pdf_page INTEGER NOT NULL DEFAULT 105,
    is_conflict BOOLEAN NOT NULL DEFAULT FALSE,
    conflict_details JSONB,
    not_in_inventory BOOLEAN NOT NULL DEFAULT FALSE,
    source_sha256 TEXT NOT NULL
);

-- 9. مراجع طول استاندارد تسمه‌های تایمینگ (imperialTimingReference.json)
CREATE TABLE IF NOT EXISTS public.timing_belt_reference_lengths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_source TEXT NOT NULL,
    designation TEXT NOT NULL,
    profile_code TEXT,
    length_mm NUMERIC(12, 3),
    teeth_count INTEGER,
    pdf_page INTEGER,
    source_page INTEGER,
    is_conflict BOOLEAN NOT NULL DEFAULT FALSE,
    conflict_note TEXT,
    source_url TEXT,
    source_sha256 TEXT,
    checked_on DATE,
    raw_entry JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (reference_source, designation)
);

-- 10. نتایج بررسی فنی ۲۶۴۲ کد کالا (docs/technical-research-2642.json)
CREATE TABLE IF NOT EXISTS public.technical_research_records (
    sku TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    original_size TEXT,
    original_identity_preserved BOOLEAN NOT NULL DEFAULT TRUE,
    part_type TEXT,
    model TEXT,
    catalog_marking TEXT,
    reference_length_check JSONB,
    owner_catalogue JSONB,
    outcome TEXT NOT NULL,
    reference_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    checked_on DATE
);

-- -----------------------------------------------------------------------------
-- SECTION 4: GALLERY IMAGES, AUDITS, DUAL HASHES & 1024-DIM EMBEDDINGS
-- -----------------------------------------------------------------------------

-- 1. تصاویر گالری کاتالوگ
CREATE TABLE IF NOT EXISTS public.catalog_gallery_images (
    id TEXT PRIMARY KEY,
    family_code TEXT NOT NULL REFERENCES public.catalog_families(code) ON DELETE CASCADE,
    variant_code TEXT REFERENCES public.catalog_variants(code) ON DELETE SET NULL,
    file_name TEXT,
    url TEXT NOT NULL,
    scope public.image_scope_type NOT NULL DEFAULT 'family',
    title TEXT,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_images_family ON public.catalog_gallery_images(family_code, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_images_variant ON public.catalog_gallery_images(variant_code);
CREATE INDEX IF NOT EXISTS idx_gallery_images_file_name ON public.catalog_gallery_images(file_name);

-- 2. تصاویر استخراج‌شده از کاتالوگ ۱۰۷ صفحه‌ای صاحب کالا
CREATE TABLE IF NOT EXISTS public.owner_catalogue_photos (
    file_name TEXT PRIMARY KEY,
    pdf_page INTEGER NOT NULL,
    printed_page INTEGER,
    inliers INTEGER,
    match_ratio DOUBLE PRECISION,
    bbox JSONB NOT NULL DEFAULT '[]'::jsonb,
    catalogue_group TEXT,
    review_status TEXT,
    exact_warehouse_sku TEXT,
    scope TEXT,
    image_sha256 TEXT,
    document_sha256 TEXT NOT NULL,
    reviewed_on DATE
);

-- 3. ممیزی و بررسی بصری تصاویر مخزن (docs/product-image-review.json)
CREATE TABLE IF NOT EXISTS public.catalog_image_audits (
    file_name TEXT PRIMARY KEY,
    normalized_file_key TEXT UNIQUE,
    image_url TEXT NOT NULL,
    sha256 TEXT,
    review_status TEXT NOT NULL,
    family_code TEXT REFERENCES public.catalog_families(code) ON DELETE SET NULL,
    family_name TEXT,
    source_row INTEGER,
    observed_description TEXT,
    reason TEXT,
    sku_verified BOOLEAN NOT NULL DEFAULT FALSE,
    visual_type TEXT,
    visible_features JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
    identity_status TEXT,
    standard_status TEXT,
    exact_sku TEXT,
    review_date DATE
);

CREATE INDEX IF NOT EXISTS idx_image_audits_family_code ON public.catalog_image_audits(family_code);
CREATE INDEX IF NOT EXISTS idx_image_audits_status ON public.catalog_image_audits(review_status);

-- 4. هش‌های ادراکی دوگانه (raw/clean) و بردارهای ۱۰۲۴ بُعدی (imageHashes + imageEmbeddings)
CREATE TABLE IF NOT EXISTS public.catalog_image_features (
    file_name TEXT PRIMARY KEY,
    padded_file_key TEXT UNIQUE,
    image_url TEXT NOT NULL UNIQUE,
    family_code TEXT REFERENCES public.catalog_families(code) ON DELETE SET NULL,
    variant_code TEXT REFERENCES public.catalog_variants(code) ON DELETE SET NULL,
    raw_dh TEXT,
    raw_ph TEXT,
    raw_ah TEXT,
    raw_eh TEXT,
    raw_aspect DOUBLE PRECISION,
    raw_col JSONB,
    raw_radial JSONB,
    raw_hog JSONB,
    raw_hu JSONB,
    raw_grid JSONB,
    clean_dh TEXT,
    clean_ph TEXT,
    clean_ah TEXT,
    clean_eh TEXT,
    clean_aspect DOUBLE PRECISION,
    clean_col JSONB,
    clean_radial JSONB,
    clean_hog JSONB,
    clean_hu JSONB,
    clean_grid JSONB,
    embedding_model TEXT NOT NULL DEFAULT 'jina-embeddings-v5-omni-small',
    embedding vector(1024),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_features_family_code ON public.catalog_image_features(family_code);
CREATE INDEX IF NOT EXISTS idx_image_features_variant_code ON public.catalog_image_features(variant_code);
CREATE INDEX IF NOT EXISTS idx_image_features_clean_ah ON public.catalog_image_features(clean_ah);
CREATE INDEX IF NOT EXISTS idx_image_features_raw_ah ON public.catalog_image_features(raw_ah);
CREATE INDEX IF NOT EXISTS idx_image_features_embedding_hnsw
    ON public.catalog_image_features
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 5. تابع جست‌وجوی تصویری برداری محدود به خانواده (Family-First Search)
CREATE OR REPLACE FUNCTION public.match_catalog_images_by_family(
    query_embedding vector(1024),
    target_family_code TEXT DEFAULT NULL,
    match_threshold DOUBLE PRECISION DEFAULT 0.60,
    match_count INTEGER DEFAULT 24
)
RETURNS TABLE (
    file_name TEXT,
    image_url TEXT,
    family_code TEXT,
    variant_code TEXT,
    clean_ah TEXT,
    clean_dh TEXT,
    clean_ph TEXT,
    similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        cif.file_name,
        cif.image_url,
        cif.family_code,
        cif.variant_code,
        cif.clean_ah,
        cif.clean_dh,
        cif.clean_ph,
        1 - (cif.embedding <=> query_embedding) AS similarity
    FROM public.catalog_image_features cif
    WHERE cif.embedding IS NOT NULL
      AND (target_family_code IS NULL OR cif.family_code = target_family_code)
      AND (1 - (cif.embedding <=> query_embedding)) >= match_threshold
    ORDER BY cif.embedding <=> query_embedding ASC
    LIMIT match_count;
$$;

-- -----------------------------------------------------------------------------
-- SECTION 5: PRICE LISTS, ORDERS, INQUIRIES, INVOICES & PLANT PASSPORTS
-- -----------------------------------------------------------------------------

-- 1. لیست‌های قیمت (atlas_price_lists_v2)
CREATE TABLE IF NOT EXISTS public.price_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    currency TEXT NOT NULL DEFAULT 'IRR',
    target_grades JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    items JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. تاریخچه تغییرات قیمت (atlas_price_list_history_v2)
CREATE TABLE IF NOT EXISTS public.price_change_history (
    id TEXT PRIMARY KEY,
    price_list_id TEXT REFERENCES public.price_lists(id) ON DELETE SET NULL,
    product_code TEXT NOT NULL,
    product_name TEXT,
    old_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    new_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    changed_by TEXT NOT NULL,
    reason TEXT,
    date_label TEXT,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_code ON public.price_change_history(product_code, created_at DESC);

-- 3. استعلام‌های قیمت (atlas_admin_inquiries_v1)
CREATE TABLE IF NOT EXISTS public.price_inquiries (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    crm_customer_id TEXT REFERENCES public.crm_customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT NOT NULL,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'عدد',
    urgency TEXT DEFAULT 'normal',
    status public.inquiry_status_type NOT NULL DEFAULT 'pending',
    quoted_unit_price NUMERIC(18, 2),
    quoted_total_price NUMERIC(18, 2),
    validity_date TEXT,
    customer_note TEXT,
    admin_reply TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_inquiries_user ON public.price_inquiries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_price_inquiries_phone ON public.price_inquiries(phone);

-- 4. کدهای تخفیف (atlas_admin_discounts_v1)
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    max_discount_amount NUMERIC(18, 2),
    min_order_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    usage_limit INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    valid_until TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    target_tier TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. سفارش‌ها (atlas_admin_orders_v1)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    crm_customer_id TEXT REFERENCES public.crm_customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    company TEXT,
    phone TEXT NOT NULL,
    total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    payment_method public.payment_method_type NOT NULL DEFAULT 'online',
    status public.order_status_type NOT NULL DEFAULT 'pending',
    receipt_verified BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_image_url TEXT,
    receipt_tracking_code TEXT,
    carrier TEXT,
    tracking_number TEXT,
    shipping_address TEXT,
    items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 6. اقلام سفارش
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- 7. فاکتورهای رسمی مالیاتی (atlas_admin_official_invoices_v1)
CREATE TABLE IF NOT EXISTS public.official_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    buyer_name TEXT NOT NULL,
    buyer_economic_code TEXT,
    buyer_national_id TEXT,
    buyer_postal_code TEXT,
    buyer_address TEXT,
    buyer_phone TEXT,
    seller_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total_payable NUMERIC(18, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'issued',
    issued_date TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. مجموعه‌های ذخیره‌شده کاربر (سبد خرید، ذخیره‌شده‌ها، علاقه‌مندی‌ها)
CREATE TABLE IF NOT EXISTS public.user_saved_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    collection_type TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, collection_type)
);

-- 9. شناسنامه ماشین‌آلات و خطوط تولید کارخانه مشتری (atlas_plant_machinery_passport_v1)
CREATE TABLE IF NOT EXISTS public.plant_machinery_passports (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    crm_customer_id TEXT REFERENCES public.crm_customers(id) ON DELETE SET NULL,
    machine_name TEXT NOT NULL,
    line_name TEXT,
    manufacturer TEXT,
    model_year TEXT,
    serial_number TEXT,
    criticality_level TEXT DEFAULT 'high',
    installed_parts JSONB NOT NULL DEFAULT '[]'::jsonb,
    maintenance_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machinery_passports_user ON public.plant_machinery_passports(user_id);

-- -----------------------------------------------------------------------------
-- SECTION 6: LOYALTY CLUB, CRM, LIVE CHAT & PORTAL CMS
-- -----------------------------------------------------------------------------

-- 1. تنظیمات باشگاه مشتریان (atlas_admin_club_config_v1)
CREATE TABLE IF NOT EXISTS public.club_configs (
    id TEXT PRIMARY KEY DEFAULT 'default',
    points_per_100k_tomans INTEGER NOT NULL DEFAULT 1,
    toman_per_point_redeem NUMERIC(18, 2) NOT NULL DEFAULT 5000,
    bronze_threshold INTEGER NOT NULL DEFAULT 0,
    silver_threshold INTEGER NOT NULL DEFAULT 500,
    gold_threshold INTEGER NOT NULL DEFAULT 1200,
    welcome_gift_points INTEGER NOT NULL DEFAULT 50,
    extra_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. پله‌های باشگاه مشتریان (atlas_portal_club_milestones_v1)
CREATE TABLE IF NOT EXISTS public.club_milestones (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    target_points INTEGER NOT NULL,
    reward_title TEXT NOT NULL,
    reward_type TEXT NOT NULL DEFAULT 'discount',
    reward_value TEXT,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. جوایز باشگاه مشتریان (atlas_club_rewards_v2)
CREATE TABLE IF NOT EXISTS public.club_rewards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    points_cost INTEGER NOT NULL CHECK (points_cost >= 0),
    reward_type TEXT NOT NULL DEFAULT 'discount_code',
    discount_percent NUMERIC(5, 2),
    max_amount NUMERIC(18, 2),
    min_grade TEXT DEFAULT 'bronze',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    image_url TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. تخصیص جوایز به مشتریان (atlas_customer_reward_assignments_v1)
CREATE TABLE IF NOT EXISTS public.customer_reward_assignments (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reward_id TEXT REFERENCES public.club_rewards(id) ON DELETE SET NULL,
    reward_title TEXT NOT NULL,
    code TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    assigned_by TEXT,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. کمپین‌های بازاریابی (atlas_admin_campaigns_v1)
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    multiplier NUMERIC(5, 2) DEFAULT 1.0,
    reward_type TEXT,
    reward_value TEXT,
    target_tier TEXT DEFAULT 'all',
    start_date TEXT,
    end_date TEXT,
    valid_until TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    participants_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. تیکت‌های پشتیبانی (atlas_admin_tickets_v1)
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. چت آنلاین صنعتی (forza_industrial_chat_sessions_v2)
CREATE TABLE IF NOT EXISTS public.industrial_chat_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    department TEXT DEFAULT 'technical_sales',
    status TEXT NOT NULL DEFAULT 'active',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. بنرهای ویترین و پرتال (atlas_portal_content_banners_v1)
CREATE TABLE IF NOT EXISTS public.portal_banners (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL DEFAULT 'storefront',
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    cta_text TEXT,
    position TEXT NOT NULL DEFAULT 'hero_slider',
    target_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_until TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. اطلاعیه‌های پرتال (atlas_portal_content_announcements_v1)
CREATE TABLE IF NOT EXISTS public.portal_announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    target_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_grades JSONB NOT NULL DEFAULT '[]'::jsonb,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. تنظیمات چیدمان پرتال (atlas_portal_layout_configs_v1)
CREATE TABLE IF NOT EXISTS public.portal_layout_configs (
    portal_key TEXT PRIMARY KEY,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. لوگوهای مشتریان ویترین (atlas_clients_logos_v3_moshtari)
CREATE TABLE IF NOT EXISTS public.client_logos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    industry TEXT,
    city TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. وبلاگ فنی (atlas_admin_blog_v1)
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    author TEXT,
    excerpt TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    published BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TEXT,
    views INTEGER NOT NULL DEFAULT 0,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. صفحات ثابت (atlas_admin_pages_v1)
CREATE TABLE IF NOT EXISTS public.static_pages (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    last_updated TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. قالب‌ها و لاگ‌های پیامک (atlas_admin_sms_templates_v1, atlas_admin_sms_logs_v1)
CREATE TABLE IF NOT EXISTS public.sms_templates (
    id TEXT PRIMARY KEY,
    event_key TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_logs (
    id TEXT PRIMARY KEY,
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT,
    event_key TEXT,
    message_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    sent_at TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. تنظیمات سراسری سیستم (atlas_admin_settings_v1)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    payment_gateway JSONB NOT NULL DEFAULT '{}'::jsonb,
    sms_provider JSONB NOT NULL DEFAULT '{}'::jsonb,
    shipping_methods JSONB NOT NULL DEFAULT '{}'::jsonb,
    currency TEXT NOT NULL DEFAULT 'toman',
    seo JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. لاگ ممیزی عملیات مدیران (atlas_admin_audit_logs_v1)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    target TEXT,
    details TEXT,
    extra_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp_label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. کلید/مقدار پرتال (سازگاری کامل با api/portal.ts و portalRepository.ts)
CREATE TABLE IF NOT EXISTS public.portal_kv_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- SECTION 7: TRIGGERS & SECURITY HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'customer_grade_configs',
        'user_profiles',
        'crm_customers',
        'agency_applications',
        'agencies',
        'agency_deposit_receipts',
        'agency_supply_requests',
        'catalog_brands',
        'catalog_categories',
        'catalog_families',
        'catalog_variants',
        'variant_commercial_specs',
        'catalog_gallery_images',
        'catalog_image_features',
        'price_lists',
        'price_inquiries',
        'discount_codes',
        'orders',
        'official_invoices',
        'user_saved_collections',
        'plant_machinery_passports',
        'club_configs',
        'club_milestones',
        'club_rewards',
        'marketing_campaigns',
        'support_tickets',
        'portal_banners',
        'portal_announcements',
        'portal_layout_configs',
        'blog_posts',
        'static_pages',
        'sms_templates',
        'system_settings',
        'portal_kv_store'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();',
            tbl, tbl
        );
    END LOOP;
END$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = auth.uid()
          AND status = 'active'
          AND role IN ('super_admin', 'sales_manager', 'warehouse_operator')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_current_user_view_commercial()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.status = 'active'
          AND (
              up.role IN ('super_admin', 'sales_manager', 'warehouse_operator', 'agency')
              OR up.approved_b2b = TRUE
              OR up.can_view_prices = TRUE
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.get_family_variants_for_current_user(target_family_code TEXT)
RETURNS TABLE (
    code TEXT,
    family_code TEXT,
    name TEXT,
    size TEXT,
    model TEXT,
    brand TEXT,
    unit TEXT,
    active BOOLEAN,
    images JSONB,
    technical_specs JSONB,
    technical_review JSONB,
    price NUMERIC(18, 2),
    retail_price NUMERIC(18, 2),
    wholesale_price NUMERIC(18, 2),
    dealer_price NUMERIC(18, 2),
    stock INTEGER,
    stock_known BOOLEAN,
    inquiry_only BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        v.code,
        v.family_code,
        v.name,
        v.size,
        v.model,
        v.brand,
        v.unit,
        v.active,
        v.images,
        v.technical_specs,
        v.technical_review,
        CASE WHEN public.can_current_user_view_commercial() THEN c.price ELSE NULL END,
        CASE WHEN public.can_current_user_view_commercial() THEN c.retail_price ELSE NULL END,
        CASE WHEN public.can_current_user_view_commercial() THEN c.wholesale_price ELSE NULL END,
        CASE WHEN public.is_admin_user() OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'agency') THEN c.dealer_price ELSE NULL END,
        CASE WHEN public.can_current_user_view_commercial() THEN c.stock ELSE NULL END,
        CASE WHEN public.can_current_user_view_commercial() THEN c.stock_known ELSE FALSE END,
        CASE WHEN public.can_current_user_view_commercial() THEN c.inquiry_only ELSE TRUE END
    FROM public.catalog_variants v
    LEFT JOIN public.variant_commercial_specs c ON c.variant_code = v.code
    WHERE v.family_code = target_family_code
      AND (v.active = TRUE OR public.is_admin_user())
    ORDER BY v.sort_order ASC, v.code ASC;
$$;

-- -----------------------------------------------------------------------------
-- SECTION 8: ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'customer_grade_configs',
        'user_profiles',
        'crm_customers',
        'agency_applications',
        'agencies',
        'agency_deposit_receipts',
        'agency_supply_requests',
        'agency_messages',
        'catalog_brands',
        'catalog_categories',
        'catalog_import_manifests',
        'catalog_families',
        'catalog_variants',
        'variant_commercial_specs',
        'catalog_summary_entries',
        'owner_catalogue_pin_rows',
        'timing_belt_reference_lengths',
        'technical_research_records',
        'catalog_gallery_images',
        'owner_catalogue_photos',
        'catalog_image_audits',
        'catalog_image_features',
        'price_lists',
        'price_change_history',
        'price_inquiries',
        'discount_codes',
        'orders',
        'order_items',
        'official_invoices',
        'user_saved_collections',
        'plant_machinery_passports',
        'club_configs',
        'club_milestones',
        'club_rewards',
        'customer_reward_assignments',
        'marketing_campaigns',
        'support_tickets',
        'industrial_chat_sessions',
        'portal_banners',
        'portal_announcements',
        'portal_layout_configs',
        'client_logos',
        'blog_posts',
        'static_pages',
        'sms_templates',
        'sms_logs',
        'system_settings',
        'audit_logs',
        'portal_kv_store'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    END LOOP;
END$$;

-- A. دسترسی عمومی (مهمانان) فقط به اطلاعات غیرتجاری
CREATE POLICY "Public read catalog_brands" ON public.catalog_brands FOR SELECT USING (true);
CREATE POLICY "Public read catalog_categories" ON public.catalog_categories FOR SELECT USING (is_active = true OR public.is_admin_user());
CREATE POLICY "Public read catalog_families" ON public.catalog_families FOR SELECT USING ((is_active = true AND is_deleted = false) OR public.is_admin_user());
CREATE POLICY "Public read catalog_variants" ON public.catalog_variants FOR SELECT USING (active = true OR public.is_admin_user());
CREATE POLICY "Public read catalog_summary_entries" ON public.catalog_summary_entries FOR SELECT USING (true);
CREATE POLICY "Public read owner_catalogue_pin_rows" ON public.owner_catalogue_pin_rows FOR SELECT USING (true);
CREATE POLICY "Public read timing_belt_reference_lengths" ON public.timing_belt_reference_lengths FOR SELECT USING (true);
CREATE POLICY "Public read catalog_gallery_images" ON public.catalog_gallery_images FOR SELECT USING (true);
CREATE POLICY "Public read catalog_image_features" ON public.catalog_image_features FOR SELECT USING (true);
CREATE POLICY "Public read active banners" ON public.portal_banners FOR SELECT USING (active = true OR public.is_admin_user());
CREATE POLICY "Public read active announcements" ON public.portal_announcements FOR SELECT USING (active = true OR public.is_admin_user());
CREATE POLICY "Public read client_logos" ON public.client_logos FOR SELECT USING (active = true OR public.is_admin_user());
CREATE POLICY "Public read published blog_posts" ON public.blog_posts FOR SELECT USING (published = true OR public.is_admin_user());
CREATE POLICY "Public read static_pages" ON public.static_pages FOR SELECT USING (true);
CREATE POLICY "Public read club_configs" ON public.club_configs FOR SELECT USING (true);
CREATE POLICY "Public read club_milestones" ON public.club_milestones FOR SELECT USING (active = true OR public.is_admin_user());
CREATE POLICY "Public read club_rewards" ON public.club_rewards FOR SELECT USING (active = true OR public.is_admin_user());
CREATE POLICY "Public read active campaigns" ON public.marketing_campaigns FOR SELECT USING (active = true OR public.is_admin_user());
CREATE POLICY "Public read public agencies" ON public.agencies FOR SELECT USING (is_public_representative = true OR auth_user_id = auth.uid() OR public.is_admin_user());

-- B. قفل محکم قیمت و موجودی فقط برای کاربران مجاز B2B، نمایندگان و مدیران
CREATE POLICY "Authorized users only read variant_commercial_specs"
    ON public.variant_commercial_specs
    FOR SELECT
    TO authenticated
    USING (public.can_current_user_view_commercial());

CREATE POLICY "Admins manage variant_commercial_specs"
    ON public.variant_commercial_specs
    FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "Authorized users read price_lists"
    ON public.price_lists
    FOR SELECT
    TO authenticated
    USING (public.can_current_user_view_commercial());

CREATE POLICY "Admins manage price_lists"
    ON public.price_lists
    FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins only read price_change_history"
    ON public.price_change_history
    FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- C. دسترسی کاربران احراز هویت‌شده به داده‌های خود
CREATE POLICY "Users read own profile or admin"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Users update own profile or admin"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.is_admin_user())
    WITH CHECK (id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Users read own crm_customer record or admin"
    ON public.crm_customers
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Users manage own saved collections"
    ON public.user_saved_collections
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_user())
    WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Users manage own machinery passports"
    ON public.plant_machinery_passports
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_user())
    WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Users read & create own orders"
    ON public.orders
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Users insert own orders"
    ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Users read own order_items"
    ON public.order_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND (o.user_id = auth.uid() OR public.is_admin_user())
        )
    );

CREATE POLICY "Users read & create own inquiries"
    ON public.price_inquiries
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Anyone can submit price inquiry"
    ON public.price_inquiries
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can submit agency application"
    ON public.agency_applications
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users read own official_invoices"
    ON public.official_invoices
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Users read own reward assignments"
    ON public.customer_reward_assignments
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Users access own support_tickets"
    ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_user())
    WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

-- D. اختیارات کامل مدیران روی جداول مدیریتی
DO $$
DECLARE
    admin_tbl TEXT;
BEGIN
    FOREACH admin_tbl IN ARRAY ARRAY[
        'customer_grade_configs',
        'crm_customers',
        'agency_applications',
        'agencies',
        'agency_deposit_receipts',
        'agency_supply_requests',
        'agency_messages',
        'catalog_brands',
        'catalog_categories',
        'catalog_import_manifests',
        'catalog_families',
        'catalog_variants',
        'catalog_summary_entries',
        'owner_catalogue_pin_rows',
        'timing_belt_reference_lengths',
        'technical_research_records',
        'catalog_gallery_images',
        'owner_catalogue_photos',
        'catalog_image_audits',
        'catalog_image_features',
        'price_inquiries',
        'discount_codes',
        'orders',
        'order_items',
        'official_invoices',
        'club_configs',
        'club_milestones',
        'club_rewards',
        'customer_reward_assignments',
        'marketing_campaigns',
        'industrial_chat_sessions',
        'portal_banners',
        'portal_announcements',
        'portal_layout_configs',
        'client_logos',
        'blog_posts',
        'static_pages',
        'sms_templates',
        'sms_logs',
        'system_settings',
        'audit_logs',
        'portal_kv_store'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins full access on %I" ON public.%I;', admin_tbl, admin_tbl);
        EXECUTE format(
            'CREATE POLICY "Admins full access on %I" ON public.%I FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());',
            admin_tbl, admin_tbl
        );
    END LOOP;
END$$;

COMMIT;
