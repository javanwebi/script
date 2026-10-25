import type { Request, Response } from 'express';
import { adoptedSchema, database, databaseEnabled } from './connection';
import { publicCatalog } from '../../src/utils/catalogPrivacy';
import { sendCatalogJson } from './compactJson';

/**
 * Public, read-only catalog endpoints. No commercial fields, identities, private
 * namespaces or per-user pricing are ever read or emitted here.
 * Commerce/admin data continues to use its authenticated API contracts.
 */
const cacheHeaders = (res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
  res.setHeader('Vary', 'Accept-Encoding');
};
const asText = (value: unknown, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const positive = (value: unknown, fallback: number, cap: number) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, cap) : fallback;
};
const listFields = (f: Record<string, any>, variants: any[] = []) => ({
  code: f.code,
  name: f.name,
  brand: f.brand,
  categorySlug: f.category_slug,
  categoryName: f.category_name,
  submenu: f.submenu || '',
  subcategory: f.subcategory || '',
  unit: f.unit,
  description: f.description,
  images: Array.isArray(f.images) ? f.images : [],
  hasCatalogueImage: f.has_catalogue_image === true,
  technicalSpecs: Array.isArray(f.technical_specs) ? f.technical_specs : [],
  tags: Array.isArray(f.tags) ? f.tags : [],
  variants,
  active: f.is_active !== false,
});
const fail = (res: Response, error: unknown) => {
  console.error('[catalog API]', error instanceof Error ? error.name : 'unknown');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({ success: false, message: 'دریافت کاتالوگ از پایگاه داده ممکن نشد.' });
};
const ready = (res: Response) => {
  if (databaseEnabled() && adoptedSchema()) return true;
  res.status(503).json({ success: false, message: 'کاتالوگ PostgreSQL در دسترس نیست.' });
  return false;
};

export async function catalogSummaryApi(req: Request, res: Response) {
  if (!ready(res)) return;
  try {
    const db = database();
    const [counts, categories] = await Promise.all([
      db.query(`select (select count(*)::int from public.catalog_families where is_active and not is_deleted) as "familyCount",
               (select count(*)::int from public.catalog_variants v join public.catalog_families f on f.code=v.family_code
                where v.active and f.is_active and not f.is_deleted) as "skuCount"`),
      db.query(`select slug,name,description,image_url as "imageUrl",sort_order as "sortOrder"
                from public.catalog_categories where is_active order by sort_order,name`),
    ]);
    cacheHeaders(res);
    return sendCatalogJson(req, res, { success: true, ...counts.rows[0], categories: categories.rows });
  } catch (error) { return fail(res, error); }
}

export async function catalogProductsApi(req: Request, res: Response) {
  if (!ready(res)) return;
  const page = positive(req.query.page, 1, 100000);
  const limit = positive(req.query.limit, 24, 100);
  const q = asText(req.query.q);
  const category = asText(req.query.category);
  const sub = asText(req.query.sub);
  const brand = asText(req.query.brand);
  const predicates = ['f.is_active = true', 'f.is_deleted = false'];
  const params: unknown[] = [];
  const bind = (v: unknown) => { params.push(v); return '$' + params.length; };
  if (category) predicates.push('f.category_slug = ' + bind(category));
  if (sub) {
    const x = bind(sub);
    predicates.push(`(f.submenu = ${x} or f.subcategory = ${x})`);
  }
  if (brand) predicates.push('f.brand = ' + bind(brand));
  if (q) {
    const x = bind('%' + q.replace(/[\\%_]/g, '\\$&') + '%');
    predicates.push(`(f.code ilike ${x} or f.name ilike ${x} or f.brand ilike ${x}
      or exists (select 1 from public.catalog_variants v where v.family_code=f.code and v.active
                 and (v.code ilike ${x} or v.name ilike ${x} or v.size ilike ${x})))`);
  }
  const where = predicates.join(' and ');
  try {
    // Count only families, then read precisely one page; never load 10k variants.
    const listParams = [...params, limit, (page - 1) * limit];
    const limitParameter = '
    // Keep actual SKU code/size choices for product cards without transferring full technical reviews.
    const codes = families.rows.map(row => row.code);
    const variants = codes.length ? (await database().query(
      `select family_code,code,name,size,model,brand,unit,active
       from public.catalog_variants where active and family_code = any($1::text[])
       order by family_code,sort_order,code`, [codes])).rows : [];
    const byFamily = new Map<string, any[]>();
    for (const v of variants) {
      const arr = byFamily.get(v.family_code) || [];
      arr.push({ code:v.code,name:v.name,size:v.size,model:v.model,brand:v.brand,unit:v.unit,active:true });
      byFamily.set(v.family_code, arr);
    }
    cacheHeaders(res);
    const total = Number(countResult.rows[0]?.total || 0);
    return sendCatalogJson(req, res, { success: true, page, limit, total, totalPages: Math.ceil(total / limit),
      products: publicCatalog(families.rows.map(f => listFields(f, byFamily.get(f.code) || []))) });
  } catch (error) { return fail(res, error); }
}

export async function catalogProductDetailApi(req: Request, res: Response) {
  if (!ready(res)) return;
  const code = asText(req.params.id, 180);
  if (!code) return res.status(400).json({ success: false, message: 'کد کالا الزامی است.' });
  try {
    const db = database();
    const families = await db.query(`select f.code,f.name,f.brand,f.category_slug,f.category_name,f.submenu,
      f.subcategory,f.unit,f.description,f.images,f.has_catalogue_image,f.technical_specs,f.tags,f.is_active
      from public.catalog_families f
      where f.is_active and not f.is_deleted and
        (f.code=$1 or exists (select 1 from public.catalog_variants v
         where v.family_code=f.code and v.code=$1 and v.active))
      order by (f.code=$1) desc limit 1`, [code]);
    if (!families.rows.length) return res.status(404).json({ success: false, message: 'محصول یافت نشد.' });
    const family = families.rows[0];
    const [variants, gallery] = await Promise.all([
      db.query(`select code,name,size,model,brand,unit,images,technical_specs,technical_review,active
        from public.catalog_variants where family_code=$1 and active order by sort_order,code`, [family.code]),
      db.query(`select id,url,file_name,scope,variant_code,identity_verified,title,sort_order
        from public.catalog_gallery_images where family_code=$1 order by sort_order,id`, [family.code]),
    ]);
    const product = listFields(family, variants.rows.map(v => ({
      code:v.code,name:v.name,size:v.size,model:v.model,brand:v.brand,unit:v.unit,
      images:v.images,technicalSpecs:v.technical_specs,technicalReview:v.technical_review,active:v.active,
    })));
    cacheHeaders(res);
    return sendCatalogJson(req, res, { success: true, product: publicCatalog({
      ...product, galleryImages: gallery.rows.map(g => ({
        id:g.id,url:g.url,fileName:g.file_name,scope:g.scope,variantCode:g.variant_code,
        identityVerified:g.identity_verified === true,title:g.title,order:g.sort_order,
      })),
    }) });
  } catch (error) { return fail(res, error); }
}
 + (params.length + 1);
    const offsetParameter = '
    // Keep actual SKU code/size choices for product cards without transferring full technical reviews.
    const codes = families.rows.map(row => row.code);
    const variants = codes.length ? (await database().query(
      `select family_code,code,name,size,model,brand,unit,active
       from public.catalog_variants where active and family_code = any($1::text[])
       order by family_code,sort_order,code`, [codes])).rows : [];
    const byFamily = new Map<string, any[]>();
    for (const v of variants) {
      const arr = byFamily.get(v.family_code) || [];
      arr.push({ code:v.code,name:v.name,size:v.size,model:v.model,brand:v.brand,unit:v.unit,active:true });
      byFamily.set(v.family_code, arr);
    }
    cacheHeaders(res);
    const total = Number(countResult.rows[0]?.total || 0);
    return res.json({ success: true, page, limit, total, totalPages: Math.ceil(total / limit),
      products: publicCatalog(families.rows.map(f => listFields(f, byFamily.get(f.code) || []))) });
  } catch (error) { return fail(res, error); }
}

export async function catalogProductDetailApi(req: Request, res: Response) {
  if (!ready(res)) return;
  const code = asText(req.params.id, 180);
  if (!code) return res.status(400).json({ success: false, message: 'کد کالا الزامی است.' });
  try {
    const db = database();
    const families = await db.query(`select f.code,f.name,f.brand,f.category_slug,f.category_name,f.submenu,
      f.subcategory,f.unit,f.description,f.images,f.has_catalogue_image,f.technical_specs,f.tags,f.is_active
      from public.catalog_families f
      where f.is_active and not f.is_deleted and
        (f.code=$1 or exists (select 1 from public.catalog_variants v
         where v.family_code=f.code and v.code=$1 and v.active))
      order by (f.code=$1) desc limit 1`, [code]);
    if (!families.rows.length) return res.status(404).json({ success: false, message: 'محصول یافت نشد.' });
    const family = families.rows[0];
    const [variants, gallery] = await Promise.all([
      db.query(`select code,name,size,model,brand,unit,images,technical_specs,technical_review,active
        from public.catalog_variants where family_code=$1 and active order by sort_order,code`, [family.code]),
      db.query(`select id,url,file_name,scope,variant_code,identity_verified,title,sort_order
        from public.catalog_gallery_images where family_code=$1 order by sort_order,id`, [family.code]),
    ]);
    const product = listFields(family, variants.rows.map(v => ({
      code:v.code,name:v.name,size:v.size,model:v.model,brand:v.brand,unit:v.unit,
      images:v.images,technicalSpecs:v.technical_specs,technicalReview:v.technical_review,active:v.active,
    })));
    cacheHeaders(res);
    return res.json({ success: true, product: publicCatalog({
      ...product, galleryImages: gallery.rows.map(g => ({
        id:g.id,url:g.url,fileName:g.file_name,scope:g.scope,variantCode:g.variant_code,
        identityVerified:g.identity_verified === true,title:g.title,order:g.sort_order,
      })),
    }) });
  } catch (error) { return fail(res, error); }
}
 + (params.length + 2);
    const [countResult, families] = await Promise.all([
      database().query(`select count(*)::int as total from public.catalog_families f where ${where}`, params),
      database().query(`select f.code,f.name,f.brand,f.category_slug,f.category_name,f.submenu,f.subcategory,
        f.unit,f.description,f.images,f.has_catalogue_image,f.technical_specs,f.tags,f.is_active
        from public.catalog_families f where ${where}
        order by f.code limit ${limitParameter} offset ${offsetParameter}`, listParams),
    ]);
    // Keep actual SKU code/size choices for product cards without transferring full technical reviews.
    const codes = families.rows.map(row => row.code);
    const variants = codes.length ? (await database().query(
      `select family_code,code,name,size,model,brand,unit,active
       from public.catalog_variants where active and family_code = any($1::text[])
       order by family_code,sort_order,code`, [codes])).rows : [];
    const byFamily = new Map<string, any[]>();
    for (const v of variants) {
      const arr = byFamily.get(v.family_code) || [];
      arr.push({ code:v.code,name:v.name,size:v.size,model:v.model,brand:v.brand,unit:v.unit,active:true });
      byFamily.set(v.family_code, arr);
    }
    cacheHeaders(res);
    const total = Number(countResult.rows[0]?.total || 0);
    return res.json({ success: true, page, limit, total, totalPages: Math.ceil(total / limit),
      products: publicCatalog(families.rows.map(f => listFields(f, byFamily.get(f.code) || []))) });
  } catch (error) { return fail(res, error); }
}

export async function catalogProductDetailApi(req: Request, res: Response) {
  if (!ready(res)) return;
  const code = asText(req.params.id, 180);
  if (!code) return res.status(400).json({ success: false, message: 'کد کالا الزامی است.' });
  try {
    const db = database();
    const families = await db.query(`select f.code,f.name,f.brand,f.category_slug,f.category_name,f.submenu,
      f.subcategory,f.unit,f.description,f.images,f.has_catalogue_image,f.technical_specs,f.tags,f.is_active
      from public.catalog_families f
      where f.is_active and not f.is_deleted and
        (f.code=$1 or exists (select 1 from public.catalog_variants v
         where v.family_code=f.code and v.code=$1 and v.active))
      order by (f.code=$1) desc limit 1`, [code]);
    if (!families.rows.length) return res.status(404).json({ success: false, message: 'محصول یافت نشد.' });
    const family = families.rows[0];
    const [variants, gallery] = await Promise.all([
      db.query(`select code,name,size,model,brand,unit,images,technical_specs,technical_review,active
        from public.catalog_variants where family_code=$1 and active order by sort_order,code`, [family.code]),
      db.query(`select id,url,file_name,scope,variant_code,identity_verified,title,sort_order
        from public.catalog_gallery_images where family_code=$1 order by sort_order,id`, [family.code]),
    ]);
    const product = listFields(family, variants.rows.map(v => ({
      code:v.code,name:v.name,size:v.size,model:v.model,brand:v.brand,unit:v.unit,
      images:v.images,technicalSpecs:v.technical_specs,technicalReview:v.technical_review,active:v.active,
    })));
    cacheHeaders(res);
    return res.json({ success: true, product: publicCatalog({
      ...product, galleryImages: gallery.rows.map(g => ({
        id:g.id,url:g.url,fileName:g.file_name,scope:g.scope,variantCode:g.variant_code,
        identityVerified:g.identity_verified === true,title:g.title,order:g.sort_order,
      })),
    }) });
  } catch (error) { return fail(res, error); }
}
