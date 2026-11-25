import type {Express,Request,Response} from 'express';
import crypto from 'node:crypto';
import {database,databaseEnabled} from './db/connection';
import {CATALOG_FAMILY_IDENTITY_LATERAL_SQL} from './catalogFamilyIdentitySql';
import {invalidatePublicCatalogCache} from './db/runtimeApi';
import {getFamilyMenuAssignment,getStaticFamilyCodesForCategory} from '../src/services/catalogTaxonomyResolver';
import {validateFamilyMenuAssignment} from '../src/data/catalogMenuSemanticGuard';
import {getPortalIdentity} from '../api/portal';
import {canStaff} from './db/staffPermissions';

const clean=(value:unknown,max=150)=>typeof value==='string'?value.trim().slice(0,max):'';
const imageAllowed=(url:string)=>!url||((url.startsWith('/storage/products/')||url.startsWith('/storage/categories/'))&&!url.includes('..'))||(/^https:\/\/[^\s]+$/i.test(url)&&url.length<=2000);
const fail=(res:Response,error:unknown)=>{console.error('[Catalog navigation/direct SKU]',error instanceof Error?error.message:String(error));return res.status(503).json({success:false,message:'ارتباط با پایگاه داده برقرار نشد.'});};

async function hasPopdCatalogOverlay(){
  const tables=await database().query(`select
    to_regclass('app_private.catalog_popd_families') is not null as families,
    to_regclass('app_private.catalog_popd_family_variants') is not null as family_variants,
    to_regclass('app_private.catalog_popd_direct_skus') is not null as direct_skus`);
  const row=tables.rows[0]||{};
  if(row.families!==true||row.family_variants!==true||row.direct_skus!==true)return false;
  const ready=await database().query(`select exists(select 1 from app_private.catalog_popd_families where is_active=true) as ready`);
  return ready.rows[0]?.ready===true;
}

type MenuAssignment = {categorySlug:string;submenuName:string;leafName:string|null;method?:string};

function assignmentIsValid(row:any,assignment:MenuAssignment){
  return validateFamilyMenuAssignment({
    familyCode:row.code||row.familyCode,
    familyName:[row.familyName||row.name,row.variantNames].filter(Boolean).join(' '),
    productType:row.productType,
    material:row.material||row.familyMaterials,
    profile:row.profile,
    categorySlug:assignment.categorySlug,
    submenuName:assignment.submenuName,
    leafName:assignment.leafName,
  });
}

function resolveFamilyMenuAssignment(row:any):MenuAssignment|null{
  const databaseAssignment:MenuAssignment|null=row.assignedCategorySlug
    ? {categorySlug:row.assignedCategorySlug,submenuName:row.assignedSubmenu||'',leafName:row.assignedLeaf||null,method:row.method||row.assignmentMethod}
    : null;
  const assignmentMethod=String(row.method||row.assignmentMethod||'');
  const authoritative=Boolean(databaseAssignment&&['admin_verified','excel_source_verified','engineering_audited','taxonomy_gap'].includes(assignmentMethod));
  if(authoritative){
    return assignmentIsValid(row,databaseAssignment!).valid?databaseAssignment:null;
  }
  // A static audited mapping always wins over legacy database heuristics.
  const fallback=getFamilyMenuAssignment(row.code||row.familyCode);
  if(fallback){
    const candidate:MenuAssignment={categorySlug:fallback.categorySlug,submenuName:fallback.submenuName||'',leafName:fallback.leafName||null,method:'static_audited'};
    return assignmentIsValid(row,candidate).valid?candidate:null;
  }
  // Only when no audited mapping exists may a conservative DB candidate be
  // considered, and it must pass the same strict engineering/menu guard.
  if(databaseAssignment&&assignmentMethod==='conservative_name_rule'){
    return assignmentIsValid(row,databaseAssignment).valid?databaseAssignment:null;
  }
  return null;
}

export function registerCatalogNavigationApi(app:Express){
  // Same active Excel-approved category names and order as the PostgreSQL mega-menu.
  // A small category/group query avoids loading full product catalogue for first paint.
  app.get('/api/catalog/home-categories',async(_req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(!databaseEnabled())return res.status(503).json({success:false,categories:[]});
    try{
      const result=await database().query(
        `with ordered_categories as (
           select c.id,c.slug,c.name,c.image_url as image,c.is_active as active,
                  g.sort_order as group_sort, member.ordinality as member_sort,
                  row_number() over(partition by c.slug order by g.sort_order,member.ordinality) as row_rank
           from public.catalog_navigation_groups g
           cross join lateral unnest(g.category_slugs) with ordinality as member(slug,ordinality)
           join public.catalog_categories c on c.slug=member.slug
           where g.is_active=true
             and g.id ~ '^excel-v2-[0-9]+$'
             and c.is_active=true
             and c.slug ~ '^excel-v2-[0-9]+-[0-9]+$'
             and c.metadata->>'source'='industrial_megamenu_hierarchy_v2'
         )
         select id,slug,name,image,active
         from ordered_categories
         where row_rank=1
         order by group_sort,member_sort,name
         limit 80`);
      return res.json({success:true,categories:result.rows.map((row:any)=>({
        id:row.id,slug:row.slug,name:row.name,nameEn:'',
        icon:'Package',description:'',image:row.image||undefined,
        active:row.active===true,children:[],subcategories:[],count:0
      }))});
    }catch(error){return fail(res,error);}
  });

  // Category totals and category contents share one resolver. Database assignments
  // are authoritative only after engineering validation; taxonomy-gap paths may omit a leaf.
  // Category totals use the POPD source overlay for its 40 approved menu categories.
  // Other catalogue sections continue to use their existing database assignments.
  app.get('/api/catalog/categories',async(_req,res)=>{
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,categories:[]});
      const popdReady=await hasPopdCatalogOverlay();
      const [result,familyRows,directSkuRows,popdFamilyRows,popdDirectSkuRows]=await Promise.all([
        database().query(
          `select c.id,c.slug,c.name,c.icon,c.image_url as image,c.description,
            c.sort_order as "sortOrder",c.is_active as active,c.metadata,
            coalesce(fc.family_count,0) as "familyCount",
            coalesce(fc.sku_count,0) as "skuCount"
           from public.catalog_categories c
           left join (
             select f.category_slug,
               count(distinct f.code) filter (where f.is_active=true and f.is_deleted=false) as family_count,
               count(distinct v.code) filter (where f.is_active=true and f.is_deleted=false and v.active=true) as sku_count
             from public.catalog_families f
             left join public.catalog_variants v on v.family_code=f.code
             group by f.category_slug
           ) fc on fc.category_slug=c.slug
           where c.is_active=true
             and (coalesce(fc.family_count,0)>0 or c.metadata->>'source'='industrial_megamenu_hierarchy_v2')
           order by c.sort_order,c.name`),
        database().query(
          `select f.code,f.name as "familyName",coalesce(identity.product_type,f.name) as "productType",
             coalesce(identity.material,f.materials,'') as material,identity.profile as profile,identity.variant_names as "variantNames",
             coalesce(identity.variant_count,0) as "skuCount",
             a.category_slug as "assignedCategorySlug",a.submenu_name as "assignedSubmenu",
             a.leaf_name as "assignedLeaf",a.method
           from public.catalog_families f
           left join public.catalog_family_menu_assignments a on a.family_code=f.code
           ${CATALOG_FAMILY_IDENTITY_LATERAL_SQL}
           where f.is_active=true and f.is_deleted=false
           order by f.code limit 10000`),
        database().query(
          `select category_slug,count(*)::integer as "skuCount"
           from public.catalog_direct_skus
           where is_active=true
           group by category_slug`),
        popdReady?database().query(
          `select f.category_slug as slug,
             count(distinct f.source_family_code)::integer as "familyCount",
             count(distinct m.variant_code) filter(where v.active=true)::integer as "skuCount"
           from app_private.catalog_popd_families f
           left join app_private.catalog_popd_family_variants m on m.source_family_code=f.source_family_code
           left join public.catalog_variants v on v.code=m.variant_code
           where f.is_active=true
           group by f.category_slug`):Promise.resolve({rows:[]}),
        popdReady?database().query(
          `select d.category_slug as slug,count(*) filter(where d.is_active=true and v.active=true)::integer as "directSkuCount"
           from app_private.catalog_popd_direct_skus d
           join public.catalog_variants v on v.code=d.sku_code
           group by d.category_slug`):Promise.resolve({rows:[]})
      ]);
      const directSkuCountByCategory=new Map<string,number>(
        directSkuRows.rows.map((row:any)=>[String(row.category_slug),Number(row.skuCount)||0])
      );
      const popdStats=new Map<string,{familyCount:number;skuCount:number}>();
      for(const row of popdFamilyRows.rows)popdStats.set(String(row.slug),{
        familyCount:Number(row.familyCount)||0,skuCount:Number(row.skuCount)||0
      });
      const popdDirectCountByCategory=new Map<string,number>(
        popdDirectSkuRows.rows.map((row:any)=>[String(row.slug),Number(row.directSkuCount)||0])
      );
      const menuStats=new Map<string,{familyCount:number;skuCount:number}>();
      for(const row of familyRows.rows){
        const assignment=resolveFamilyMenuAssignment(row);
        if(!assignment)continue;
        const stats=menuStats.get(assignment.categorySlug)||{familyCount:0,skuCount:0};
        stats.familyCount+=1;
        stats.skuCount+=Number(row.skuCount)||0;
        menuStats.set(assignment.categorySlug,stats);
      }
      const categories=result.rows.map((row:any)=>{
        const metadata=row.metadata&&typeof row.metadata==='object'?row.metadata:{};
        const children=Array.isArray(metadata.children)?metadata.children:
          (Array.isArray(metadata.subcategories)?metadata.subcategories.map((name:unknown)=>({name:String(name),children:[]})):[]);
        const menuStatsForCategory=menuStats.get(row.slug);
        const isApprovedMenuCategory=metadata.source==='industrial_megamenu_hierarchy_v2';
        const hasPopdData=popdReady&&(popdStats.has(row.slug)||popdDirectCountByCategory.has(row.slug));
        const familyCount=hasPopdData
          ? Number(popdStats.get(row.slug)?.familyCount)||0
          : isApprovedMenuCategory
            ? Number(menuStatsForCategory?.familyCount)||0
            : Number(row.familyCount)||0;
        const familySkuCount=hasPopdData
          ? Number(popdStats.get(row.slug)?.skuCount)||0
          : isApprovedMenuCategory
            ? Number(menuStatsForCategory?.skuCount)||0
            : Number(row.skuCount)||0;
        // Direct SKUs are counted once and remain separate from family membership.
        const directSkuCount=hasPopdData
          ? Number(popdDirectCountByCategory.get(row.slug))||0
          : directSkuCountByCategory.get(row.slug)||0;
        const skuCount=familySkuCount+directSkuCount;
        const subcategories=Array.isArray(metadata.subcategories)?metadata.subcategories:
          children.map((node:any)=>String(node?.name||'')).filter(Boolean);
        return {
          id:row.id,slug:row.slug,name:row.name,nameEn:typeof metadata.nameEn==='string'?metadata.nameEn:'',
          icon:row.icon||metadata.icon||'Package',image:row.image||metadata.image||undefined,
          description:row.description||metadata.description||children.map((node:any)=>String(node?.name||'')).filter(Boolean).join('، '),
          active:row.active===true,sortOrder:Number(row.sortOrder)||0,count:familyCount,familyCount,skuCount,directSkuCount,
          children,subcategories,
          menuSource:typeof metadata.source==='string'?metadata.source:'',
          routeSlug:typeof metadata.routeSlug==='string'?metadata.routeSlug:row.slug,
        };
      });
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,categories});
    }catch(error){return fail(res,error);}
  });

    // Public family-to-subcategory index. POPD source families are appended as the
  // authoritative mapping; legacy families remain only when they still own uncovered SKUs.
  app.get('/api/catalog/menu-family-index',async(_req,res)=>{
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,assignments:[]});
      const popdReady=await hasPopdCatalogOverlay();
      const legacyFilter=popdReady?`
        and exists(
          select 1 from public.catalog_variants remaining
          where remaining.family_code=f.code and remaining.active=true
            and not exists(select 1 from app_private.catalog_popd_family_variants member where member.variant_code=remaining.code)
            and not exists(select 1 from app_private.catalog_popd_direct_skus direct where direct.sku_code=remaining.code)
        )`:'';
      const [result,popdResult]=await Promise.all([
        database().query(
          `select a.family_code as "familyCode",f.code as code,f.name as "familyName",
              coalesce(identity.product_type,f.name) as "productType",
              coalesce(identity.material,f.materials,'') as material,identity.profile as profile,identity.variant_names as "variantNames",
              a.category_slug as "assignedCategorySlug",a.submenu_name as "assignedSubmenu",
              a.leaf_name as "assignedLeaf",a.method
            from public.catalog_families f
            left join public.catalog_family_menu_assignments a on a.family_code=f.code
            ${CATALOG_FAMILY_IDENTITY_LATERAL_SQL}
            where f.is_active=true and f.is_deleted=false ${legacyFilter}
            order by a.category_slug,a.submenu_name,a.leaf_name,f.code
            limit 10000`),
        popdReady?database().query(
          `select source_family_code as "familyCode",category_slug as "categorySlug",
              submenu as "submenuName",leaf as "leafName"
           from app_private.catalog_popd_families
           where is_active=true
           order by category_slug,submenu,family_name,source_family_code`):Promise.resolve({rows:[]})
      ]);
      const assignments=result.rows.flatMap((row:any)=>{
        const familyCode=row.code||row.familyCode;
        const assignment=resolveFamilyMenuAssignment({...row,code:familyCode});
        if(!assignment)return [];
        return [{familyCode,categorySlug:assignment.categorySlug,
          submenuName:assignment.submenuName,leafName:assignment.leafName,method:assignment.method||row.method||'static_audited'}];
      });
      for(const row of popdResult.rows){
        assignments.push({familyCode:String(row.familyCode),categorySlug:String(row.categorySlug),
          submenuName:String(row.submenuName||''),leafName:row.leafName?String(row.leafName):null,method:'popd_source'});
      }
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,assignments});
    }catch(error){return fail(res,error);}
  });

    // POPD's four-level category/family mapping is served from the immutable source overlay.
  // The legacy resolver remains available until the overlay is imported on production.
  app.get('/api/catalog/menu-category/:slug',async(req,res)=>{
    let stage='category_lookup';
    let slug='';
    try{
      slug=clean(req.params.slug,90);
      if(!/^excel-v2-[0-9]+-[0-9]+$/.test(slug))return res.status(404).json({success:false,message:'دسته موجود نیست.'});
      if(!databaseEnabled())return res.status(503).json({success:false,message:'پایگاه داده در دسترس نیست.'});
      const category=await database().query(
        `select c.slug,c.name,c.description,c.image_url as image,c.metadata
         from public.catalog_categories c
         where c.slug=$1 and c.is_active=true and c.metadata->>'source'='industrial_megamenu_hierarchy_v2'
         limit 1`,[slug]);
      if(!category.rows.length)return res.status(404).json({success:false,message:'دسته موجود نیست.'});
      const record=category.rows[0];
      const popdReady=await hasPopdCatalogOverlay();
      if(popdReady){
        stage='popd_family_query';
        const familyRows=await database().query(
          `select f.source_family_code as code,f.family_name as name,f.family_name as "familyName",
             f.brand,f.submenu,f.leaf,f.declared_variant_count as "variantCount",
             count(distinct m.variant_code) filter(where v.active=true)::integer as "skuCount",
             f.family_image_urls[1] as "imageUrl",
             f.metadata->'sampleVariants' as "sampleVariants",
             f.metadata->>'productType' as "productType",
             f.metadata->>'material' as material,
             f.metadata->>'profile' as profile,
             f.resolution_status as "resolutionStatus"
           from app_private.catalog_popd_families f
           left join app_private.catalog_popd_family_variants m on m.source_family_code=f.source_family_code
           left join public.catalog_variants v on v.code=m.variant_code
           where f.category_slug=$1 and f.is_active=true
           group by f.source_family_code,f.family_name,f.brand,f.submenu,f.leaf,f.declared_variant_count,
             f.family_image_urls,f.metadata,f.resolution_status
           order by f.submenu,f.family_name,f.source_family_code
           limit 10000`,[slug]);
        const families=familyRows.rows.map((row:any)=>({
          code:row.code,name:row.name,familyName:row.familyName,brand:row.brand||'',
          submenu:row.submenu||'',leaf:row.leaf||null,skuCount:Number(row.skuCount)||0,
          variantCount:Number(row.variantCount)||0,imageUrl:row.imageUrl||null,
          sampleVariants:Array.isArray(row.sampleVariants)?row.sampleVariants:[],
          productType:row.productType||row.name,material:row.material||'',profile:row.profile||'',
          resolutionStatus:row.resolutionStatus||'UNRESOLVED'
        }));
        res.setHeader('Cache-Control','no-store');
        return res.json({success:true,category:{
          slug:record.slug,name:record.name,description:record.description||'',
          image:record.image||null,children:Array.isArray(record.metadata?.children)?record.metadata.children:[]
        },families});
      }
      stage='family_query';
      const staticFamilyCodes=getStaticFamilyCodesForCategory(slug);
      const familyRows=await database().query(
        `select f.code,f.name,f.name as "familyName",coalesce(f.brand,'') as brand,
           coalesce(identity.product_type,f.name) as "productType",
           coalesce(identity.material,f.materials,'') as material,identity.profile as profile,identity.variant_names as "variantNames",
           coalesce(identity.variant_count,0) as "skuCount",
           a.category_slug as "assignedCategorySlug",a.submenu_name as "assignedSubmenu",
           a.leaf_name as "assignedLeaf",a.method
          from public.catalog_families f
          left join public.catalog_family_menu_assignments a on a.family_code=f.code
          ${CATALOG_FAMILY_IDENTITY_LATERAL_SQL}
          where f.is_active=true and f.is_deleted=false
            and (a.category_slug=$1 or f.code=any($2::text[]))
          order by f.name,f.code limit 10000`,[slug,staticFamilyCodes]);
      stage='family_resolution';
      const families=familyRows.rows.flatMap((row:any)=>{
        const assignment=resolveFamilyMenuAssignment(row);
        if(!assignment||assignment.categorySlug!==slug)return [];
        return [{
          code:row.code,name:row.familyName||row.name,brand:row.brand,
          submenu:assignment.submenuName||'',leaf:assignment.leafName||null,
          skuCount:row.skuCount
        }];
      });
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,category:{
        slug:record.slug,name:record.name,description:record.description||'',
        image:record.image||null,children:Array.isArray(record.metadata?.children)?record.metadata.children:[]
      },families});
    }catch(error){
      console.error('[Catalog menu category failure]',{slug,stage});
      return fail(res,error);
    }
  });

    app.get('/api/catalog/menu-family-assignments',async(req,res)=>{
    try{
      if(!canStaff(await getPortalIdentity(req),'products'))return res.status(403).json({success:false,message:'مجوز مشاهده کاتالوگ لازم است.'});
      if(!databaseEnabled())return res.status(503).json({success:false});
      const rows=await database().query(
        `select f.code as "familyCode",f.name as "familyName",
            coalesce(identity.product_type,f.name) as "productType",
            coalesce(identity.material,f.materials,'') as material,identity.profile as profile,identity.variant_names as "variantNames",
            a.category_slug as "assignedCategorySlug",a.submenu_name as "assignedSubmenu",
            a.leaf_name as "assignedLeaf",a.method
          from public.catalog_families f
          left join public.catalog_family_menu_assignments a on a.family_code=f.code
          ${CATALOG_FAMILY_IDENTITY_LATERAL_SQL}
          where f.is_active=true and f.is_deleted=false
          order by f.code limit 10000`);
      const assignments=rows.rows.map((row:any)=>{
        const databaseAssignment:MenuAssignment|null=row.assignedCategorySlug
          ? {categorySlug:row.assignedCategorySlug,submenuName:row.assignedSubmenu||'',leafName:row.assignedLeaf||null}
          : null;
        const semantic=databaseAssignment?assignmentIsValid(row,databaseAssignment):null;
        const effective=resolveFamilyMenuAssignment(row);
        return {...row,
          semanticValid:semantic?.valid??null,
          semanticReason:semantic?.reason??null,
          reviewReason:databaseAssignment&&!semantic?.valid?'semantic_conflict':!effective?'unassigned':null};
      });
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,assignments});
    }catch(error){return fail(res,error);}
  });

  app.get('/api/catalog/menu-unassigned',async(req,res)=>{
    try{
      if(!canStaff(await getPortalIdentity(req),'products'))return res.status(403).json({success:false,message:'مجوز مشاهده کاتالوگ لازم است.'});
      if(!databaseEnabled())return res.status(503).json({success:false});
      const rows=await database().query(
        `select f.code,f.name,f.name as "familyName",f.category_slug as "oldCategory",f.submenu as "oldSubmenu",
           coalesce(identity.product_type,f.name) as "productType",
           coalesce(identity.material,f.materials,'') as material,identity.profile as profile,identity.variant_names as "variantNames",
           coalesce(identity.variant_count,0) as "skuCount",
           a.category_slug as "assignedCategorySlug",a.submenu_name as "assignedSubmenu",
           a.leaf_name as "assignedLeaf",a.method as "assignmentMethod"
          from public.catalog_families f
          left join public.catalog_family_menu_assignments a on a.family_code=f.code
          ${CATALOG_FAMILY_IDENTITY_LATERAL_SQL}
          where f.is_active=true and f.is_deleted=false
          order by f.category_slug,f.name limit 10000`);
      const families=rows.rows.flatMap((row)=>{
        const databaseAssignment:MenuAssignment|null=row.assignedCategorySlug
          ? {categorySlug:row.assignedCategorySlug,submenuName:row.assignedSubmenu||'',leafName:row.assignedLeaf||null}
          : null;
        const semantic=databaseAssignment?assignmentIsValid(row,databaseAssignment):null;
        const assignment=resolveFamilyMenuAssignment({...row,method:row.assignmentMethod});
        const reviewReason=databaseAssignment&&!semantic?.valid?'semantic_conflict'
          : !assignment?'unassigned'
          : !assignment.submenuName?'missing_submenu'
          : !assignment.leafName?'missing_leaf':null;
        if(!reviewReason)return [];
        return [{
          code:row.code,name:row.familyName||row.name,oldCategory:row.oldCategory,oldSubmenu:row.oldSubmenu,
          skuCount:row.skuCount,assignedCategorySlug:row.assignedCategorySlug||assignment?.categorySlug||null,
          assignedSubmenu:row.assignedSubmenu||assignment?.submenuName||null,
          assignedLeaf:row.assignedLeaf||assignment?.leafName||null,
          assignmentMethod:row.assignmentMethod,reviewReason,semanticReason:semantic?.reason??null
        }];
      }).slice(0,4000);
      return res.json({success:true,families});
    }catch(error){return fail(res,error);}
  });

  app.post('/api/catalog/menu-family-assignment',async(req,res)=>{
    try{
      if(!canStaff(await getPortalIdentity(req),'products','categories'))return res.status(403).json({success:false,message:'مجوز تغییر دسته‌بندی لازم است.'});
      if(!databaseEnabled())return res.status(503).json({success:false});
      const familyCode=clean(req.body?.familyCode,180),categorySlug=clean(req.body?.categorySlug,90);
      const submenu=clean(req.body?.submenu,180),leaf=clean(req.body?.leaf,250);
      if(!familyCode||!/^excel-v2-[0-9]+-[0-9]+$/.test(categorySlug))
        return res.status(400).json({success:false,message:'خانواده و دسته مقصد معتبر لازم است.'});
      const category=await database().query(
        `select c.name,c.metadata from public.catalog_categories c
         where c.slug=$1 and c.is_active=true and c.metadata->>'source'='industrial_megamenu_hierarchy_v2' limit 1`,[categorySlug]);
      const family=await database().query(
         `select f.code,f.name as "familyName",coalesce(identity.product_type,f.name) as "productType",
            coalesce(identity.material,f.materials,'') as material,identity.profile as profile,identity.variant_names as "variantNames"
          from public.catalog_families f
          ${CATALOG_FAMILY_IDENTITY_LATERAL_SQL}
          where f.code=$1 and f.is_active=true and f.is_deleted=false limit 1`,[familyCode]);
      if(!category.rows.length||!family.rows.length)return res.status(404).json({success:false,message:'خانواده یا دسته مقصد یافت نشد.'});
      const nodes=Array.isArray(category.rows[0].metadata?.children)?category.rows[0].metadata.children:[];
      const selectedNode=nodes.find((node:any)=>node.name===submenu);
      if(submenu&&!selectedNode)return res.status(400).json({success:false,message:'زیرمنو با دسته انتخابی مطابقت ندارد.'});
      if(leaf&&(!selectedNode||!Array.isArray(selectedNode.children)||!selectedNode.children.some((child:any)=>child.name===leaf)))
         return res.status(400).json({success:false,message:'ریزقلم با زیرمنو مطابقت ندارد.'});
       const semantic=validateFamilyMenuAssignment({
         familyCode,familyName:family.rows[0].familyName,productType:family.rows[0].productType,
         material:family.rows[0].material,profile:family.rows[0].profile,
         categorySlug,submenuName:submenu,leafName:leaf
       });
       if(!semantic.valid)return res.status(422).json({success:false,message:'مسیر انتخابی از نظر نوع قطعه یا جنس با هویت فنی خانواده سازگار نیست؛ خانواده را در صف بازبینی نگه دارید.',reason:semantic.reason});
       await database().query(
        `insert into public.catalog_family_menu_assignments(family_code,category_slug,submenu_name,leaf_name,method)
         values($1,$2,$3,$4,'admin_verified')
         on conflict(family_code) do update set category_slug=excluded.category_slug,
           submenu_name=excluded.submenu_name,leaf_name=excluded.leaf_name,
           method='admin_verified',updated_at=now()`,[familyCode,categorySlug,submenu||null,leaf||null]);
      // Keep the denormalized family row aligned with the canonical approved menu assignment.
      await database().query(
        `update public.catalog_families set category_slug=$2,category_name=$3,submenu=$4,subcategory=$5,updated_at=now() where code=$1`,
        [familyCode,categorySlug,clean(category.rows[0].name,250),submenu||null,leaf||'']);
      return res.json({success:true,familyCode,categorySlug});
    }catch(error){return fail(res,error);}
  });

  app.get('/api/catalog/navigation-groups',async(req,res)=>{
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,groups:[]});
      const withInactive=req.query.includeInactive==='1'&&canStaff(await getPortalIdentity(req),'products');
      const rows=await database().query(
        'select id,title,icon_key as "iconKey",image_url as "imageUrl",category_slugs as "categorySlugs",sort_order as "sortOrder",is_active as active from public.catalog_navigation_groups '+(withInactive?'':'where is_active=true ')+'order by sort_order,id');
      return res.json({success:true,groups:rows.rows});
    }catch(error){return fail(res,error);}
  });

  app.post('/api/catalog/navigation-groups',async(req,res)=>{
    try{
      if(!canStaff(await getPortalIdentity(req),'products','categories'))return res.status(403).json({success:false,message:'مجوز تغییر گروه‌بندی لازم است.'});
      if(!databaseEnabled())return res.status(503).json({success:false});
      const title=clean(req.body?.title,120), iconKey=clean(req.body?.iconKey,32)||'layers';
      const id=clean(req.body?.id,90)||crypto.randomUUID();
      const imageUrl=clean(req.body?.imageUrl,2000);
      const categorySlugs=req.body?.categorySlugs;
      const sortOrder=Number(req.body?.sortOrder);
      if(title.length<2||!Array.isArray(categorySlugs)||categorySlugs.length>150||
        categorySlugs.some((slug:unknown)=>typeof slug!=='string'||slug.length>150)||
        !imageAllowed(imageUrl)||!Number.isFinite(sortOrder)||sortOrder<0||sortOrder>10000)
        return res.status(400).json({success:false,message:'نام، تصویر یا فهرست دسته‌های گروه معتبر نیست.'});
      const unique=[...new Set(categorySlugs as string[])];
      if(unique.length){
        const match=await database().query('select slug from public.catalog_categories where slug=any($1::text[])',[unique]);
        if(match.rows.length!==unique.length)return res.status(400).json({success:false,message:'دسته انتخاب‌شده در دیتابیس وجود ندارد.'});
      }
      await database().query(`insert into public.catalog_navigation_groups(id,title,icon_key,image_url,category_slugs,sort_order,is_active,updated_at)
        values($1,$2,$3,$4,$5,$6,$7,now())
        on conflict(id) do update set title=excluded.title,icon_key=excluded.icon_key,image_url=excluded.image_url,
          category_slugs=excluded.category_slugs,sort_order=excluded.sort_order,is_active=excluded.is_active,updated_at=now()`,
        [id,title,iconKey,imageUrl||null,unique,sortOrder,req.body?.active!==false]);
      return res.json({success:true,id});
    }catch(error){return fail(res,error);}
  });

  app.get('/api/catalog/direct-skus',async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,items:[]});
      const identity=await getPortalIdentity(req);
      const withInactive=req.query.includeInactive==='1'&&canStaff(identity,'products');
      const categorySlug=clean(req.query.categorySlug,180);
      const categoryPrefix=clean(req.query.categoryPrefix,40);
      if(categoryPrefix&&!/^excel-v2-\\d+-$/.test(categoryPrefix))return res.status(400).json({success:false,items:[]});
      const popdReady=await hasPopdCatalogOverlay();
      const wantsPopd=popdReady&&(!categorySlug&&!categoryPrefix||categorySlug.startsWith('excel-v2-')||categoryPrefix.startsWith('excel-v2-'));
      const wantsLegacy=!categorySlug&&!categoryPrefix||!categorySlug&&!categoryPrefix?true:
        !(categorySlug.startsWith('excel-v2-')||categoryPrefix.startsWith('excel-v2-'));
      const buildScope=(alias:string)=>{
        const params:any[]=[];
        const scope:string[]=[];
        if(categorySlug){params.push(categorySlug);scope.push(`${alias}.category_slug=$${params.length}`);}
        if(categoryPrefix){params.push(categoryPrefix+'%');scope.push(`${alias}.category_slug like $${params.length}`);}
        return {params,scope};
      };
      const popdQuery=async()=>{
        const {params,scope}=buildScope('d');
        const conditions=[...scope.length?['('+scope.join(' or ')+')']:[]];
        if(!withInactive)conditions.push('d.is_active=true','v.active=true');
        const where=conditions.length?'where '+conditions.join(' and '):'';
        return database().query(
          `select d.sku_code as "skuCode",d.name,d.category_slug as "categorySlug",
             c.name as "categoryName",d.submenu,
             coalesce(nullif(d.metadata->>'leaf',''),nullif(d.metadata->>'subcategory',''),d.submenu,'') as subcategory,
             coalesce(nullif(trim(v.brand),''),nullif(trim(d.brand),''),'') as brand,
             verified_image.url as "imageUrl",
             coalesce(v.technical_specs,existing.technical_specs,'[]'::jsonb) as "technicalSpecs",
             coalesce(existing.price_snapshot,'{}'::jsonb) as "priceSnapshot",
             existing.source_family_code as "sourceFamilyCode",
             (d.is_active=true and v.active=true) as active
           from app_private.catalog_popd_direct_skus d
           join public.catalog_variants v on v.code=d.sku_code
           left join public.catalog_categories c on c.slug=d.category_slug
           left join public.catalog_direct_skus existing on existing.sku_code=d.sku_code
           left join lateral (
             select g.url from public.catalog_gallery_images g
             where g.variant_code=d.sku_code and g.scope='variant' and g.identity_verified=true
             order by g.sort_order,g.id limit 1
           ) verified_image on true
           ${where}
           order by d.category_slug,d.submenu,d.name,d.sku_code
           limit 5000`,params
        );
      };
      const legacyQuery=async()=>{
        const {params,scope}=buildScope('d');
        const conditions:string[]=[];
        if(scope.length)conditions.push('('+scope.join(' or ')+')');
        if(!withInactive)conditions.push('d.is_active=true');
        if(popdReady&&!categorySlug&&!categoryPrefix){
          conditions.push(`not exists(select 1 from app_private.catalog_popd_direct_skus pd where pd.sku_code=d.sku_code)`);
          conditions.push(`not exists(select 1 from app_private.catalog_popd_family_variants pfv where pfv.variant_code=d.sku_code)`);
        }
        const where=conditions.length?'where '+conditions.join(' and '):'';
        return database().query(
          `select d.sku_code as "skuCode",d.name,d.category_slug as "categorySlug",d.category_name as "categoryName",
            d.submenu,d.subcategory,coalesce(nullif(trim(v.brand),''),nullif(trim(d.brand),''),'') as brand,
            d.image_url as "imageUrl",d.technical_specs as "technicalSpecs",d.price_snapshot as "priceSnapshot",
            d.source_family_code as "sourceFamilyCode",d.is_active as active
           from public.catalog_direct_skus d
           left join public.catalog_variants v on v.code=d.sku_code and v.active=true
           ${where} order by d.updated_at desc,d.sku_code limit 5000`,
          params
        );
      };
      const [popdRows,legacyRows]=await Promise.all([
        wantsPopd?popdQuery():Promise.resolve({rows:[]}),
        wantsLegacy?legacyQuery():Promise.resolve({rows:[]})
      ]);
      const items=[...popdRows.rows,...legacyRows.rows].sort((a:any,b:any)=>
        String(a.categorySlug||'').localeCompare(String(b.categorySlug||''))||
        String(a.submenu||'').localeCompare(String(b.submenu||''))||
        String(a.name||'').localeCompare(String(b.name||''))||
        String(a.skuCode||'').localeCompare(String(b.skuCode||''))
      );
      const canReadPrices=identity.canReadCommerce || canStaff(identity,'products','prices');
      return res.json({success:true,items:canReadPrices?items:items.map((row:any)=>({...row,priceSnapshot:{}}))});
    }catch(error){return fail(res,error);}
  });

    app.post('/api/catalog/direct-skus',async(req,res)=>{
    try{
      if(!canStaff(await getPortalIdentity(req),'products','edit'))return res.status(403).json({success:false,message:'مجوز ویرایش کالا لازم است.'});
      if(!databaseEnabled())return res.status(503).json({success:false});
      const skuCode=clean(req.body?.skuCode,128),categorySlug=clean(req.body?.categorySlug,180),imageUrl=clean(req.body?.imageUrl,2000);
      const submenu=clean(req.body?.submenu,180),subcategory=clean(req.body?.subcategory,180);
      if(!skuCode||!categorySlug||!submenu||!imageAllowed(imageUrl))return res.status(400).json({success:false,message:'کد کالا، دسته، زیرمنو و تصویر معتبر لازم است.'});
      const cat=await database().query('select name from public.catalog_categories where slug=$1 and is_active=true limit 1',[categorySlug]);
      if(!cat.rows.length)return res.status(400).json({success:false,message:'دسته مقصد در دیتابیس یافت نشد.'});
      const sku=await database().query(`select v.code,v.name,v.brand,v.technical_specs,v.images,v.family_code,
        c.price,c.retail_price,c.wholesale_price,c.dealer_price,c.stock,c.stock_reserved,c.inquiry_only,c.currency
        from public.catalog_variants v left join public.variant_commercial_specs c on c.variant_code=v.code
        where v.code=$1 and v.active=true limit 1`,[skuCode]);
      const previous=await database().query('select * from public.catalog_direct_skus where sku_code=$1',[skuCode]);
      if(!sku.rows.length&&!previous.rows.length)return res.status(404).json({success:false,message:'این کد SKU در کاتالوگ واقعی وجود ندارد؛ کد جدید حدسی ثبت نمی‌شود.'});
      const original=sku.rows[0]||previous.rows[0];
      const selectedImage=imageUrl||original.image_url||((Array.isArray(original.images)&&original.images[0])||'');
      const name=original.name||skuCode,brand=original.brand||'';
      const specs=original.technical_specs||[];
      const prices=sku.rows.length?{price:original.price,retail:original.retail_price,wholesale:original.wholesale_price,dealer:original.dealer_price,stock:original.stock,stockReserved:original.stock_reserved,inquiryOnly:original.inquiry_only,currency:original.currency}:original.price_snapshot||{};
      await database().query(`insert into public.catalog_direct_skus(sku_code,name,category_slug,category_name,submenu,subcategory,brand,image_url,technical_specs,price_snapshot,source_family_code,is_active,updated_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,true,now())
        on conflict(sku_code) do update set category_slug=excluded.category_slug,category_name=excluded.category_name,
        submenu=excluded.submenu,subcategory=excluded.subcategory,image_url=excluded.image_url,
        technical_specs=excluded.technical_specs,price_snapshot=excluded.price_snapshot,is_active=true,updated_at=now()`,
        [skuCode,name,categorySlug,cat.rows[0].name,submenu,subcategory,brand,selectedImage,JSON.stringify(specs),JSON.stringify(prices),original.family_code||original.source_family_code||null]);
      invalidatePublicCatalogCache();
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,skuCode,categorySlug,imageUrl:selectedImage});
    }catch(error){return fail(res,error);}
  });
}
