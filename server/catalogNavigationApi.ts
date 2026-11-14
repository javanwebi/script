import type {Express,Request,Response} from 'express';
import crypto from 'node:crypto';
import {database,databaseEnabled} from './db/connection';
import {getPortalIdentity} from '../api/portal';
import {canStaff} from './db/staffPermissions';

const clean=(value:unknown,max=150)=>typeof value==='string'?value.trim().slice(0,max):'';
const imageAllowed=(url:string)=>!url||((url.startsWith('/storage/products/')||url.startsWith('/storage/categories/'))&&!url.includes('..'))||(/^https:\/\/[^\s]+$/i.test(url)&&url.length<=2000);
const fail=(res:Response,error:unknown)=>{console.error('[Catalog navigation/direct SKU]',error instanceof Error?error.message:String(error));return res.status(503).json({success:false,message:'ارتباط با پایگاه داده برقرار نشد.'});};

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

  // PostgreSQL is the authoritative source for every product category shown in the mega-menu.
  app.get('/api/catalog/categories',async(_req,res)=>{
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,categories:[]});
      const result=await database().query(
        `select c.id,c.slug,c.name,c.icon,c.image_url as image,c.description,
          c.sort_order as "sortOrder",c.is_active as active,c.metadata,
          case when c.slug like 'excel-v2-%' then coalesce(mc.family_count,0) else coalesce(fc.family_count,0) end as "familyCount",
          case when c.slug like 'excel-v2-%' then coalesce(mc.sku_count,0) else coalesce(fc.sku_count,0) end as "skuCount"
        from public.catalog_categories c
        left join (
          select f.category_slug,
            count(distinct f.code) filter (where f.is_active=true and f.is_deleted=false) as family_count,
            count(distinct v.code) filter (where f.is_active=true and f.is_deleted=false and v.active=true) as sku_count
          from public.catalog_families f
          left join public.catalog_variants v on v.family_code=f.code
          group by f.category_slug
        ) fc on fc.category_slug=c.slug
        left join (
          select a.category_slug,count(distinct f.code) as family_count,
            coalesce(sum(f.item_count),0) as sku_count
          from public.catalog_family_menu_assignments a
          join public.catalog_families f on f.code=a.family_code and f.is_active=true and f.is_deleted=false
          group by a.category_slug
        ) mc on mc.category_slug=c.slug
        where c.is_active=true and (coalesce(fc.family_count,0)>0 or c.metadata->>'source'='industrial_megamenu_hierarchy_v2')
        order by c.sort_order,c.name`);
      const categories=result.rows.map((row:any)=>{
        const metadata=row.metadata&&typeof row.metadata==='object'?row.metadata:{};
        const children=Array.isArray(metadata.children)?metadata.children:
          (Array.isArray(metadata.subcategories)?metadata.subcategories.map((name:unknown)=>({name:String(name),children:[]})):[]);
        const familyCount=Number(row.familyCount)||0,skuCount=Number(row.skuCount)||0;
        const subcategories=Array.isArray(metadata.subcategories)?metadata.subcategories:
          children.map((node:any)=>String(node?.name||'')).filter(Boolean);
        return {
          id:row.id,slug:row.slug,name:row.name,nameEn:typeof metadata.nameEn==='string'?metadata.nameEn:'',
          icon:row.icon||metadata.icon||'Package',image:row.image||metadata.image||undefined,
          description:row.description||metadata.description||children.map((node:any)=>String(node?.name||'')).filter(Boolean).join('، '),
          active:row.active===true,sortOrder:Number(row.sortOrder)||0,count:familyCount,familyCount,skuCount,
          children,subcategories,
          menuSource:typeof metadata.source==='string'?metadata.source:'',
          routeSlug:typeof metadata.routeSlug==='string'?metadata.routeSlug:row.slug,
        };
      });
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,categories});
    }catch(error){return fail(res,error);}
  });


  // Public, metadata-only family-to-subcategory index for the all-products filters.
  // It exposes no prices, stock, images, customer data or private product fields.
  app.get('/api/catalog/menu-family-index',async(_req,res)=>{
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,assignments:[]});
      const result=await database().query(
        `select a.family_code as "familyCode",a.category_slug as "categorySlug",
          a.submenu_name as "submenuName",a.leaf_name as "leafName"
         from public.catalog_family_menu_assignments a
         join public.catalog_families f on f.code=a.family_code
         join public.catalog_categories c on c.slug=a.category_slug and c.is_active=true
         where f.is_active=true and f.is_deleted=false
           and c.metadata->>'source'='industrial_megamenu_hierarchy_v2'
         order by a.category_slug,a.submenu_name,a.leaf_name,a.family_code
         limit 10000`);
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,assignments:result.rows});
    }catch(error){return fail(res,error);}
  });

  // Read-only four-level menu taxonomy; original family categories remain untouched.
  app.get('/api/catalog/menu-category/:slug',async(req,res)=>{
    try{
      const slug=clean(req.params.slug,90);
      if(!/^excel-v2-[0-9]+-[0-9]+$/.test(slug))return res.status(404).json({success:false,message:'دسته موجود نیست.'});
      if(!databaseEnabled())return res.status(503).json({success:false,message:'پایگاه داده در دسترس نیست.'});
      const category=await database().query(
        `select c.slug,c.name,c.description,c.image_url as image,c.metadata
         from public.catalog_categories c
         where c.slug=$1 and c.is_active=true and c.metadata->>'source'='industrial_megamenu_hierarchy_v2'
         limit 1`,[slug]);
      if(!category.rows.length)return res.status(404).json({success:false,message:'دسته موجود نیست.'});
      const familyRows=await database().query(
        `select a.family_code as code,f.name,coalesce(f.brand,'') as brand,
          a.submenu_name as submenu,a.leaf_name as leaf,coalesce(f.item_count,0) as "skuCount"
         from public.catalog_family_menu_assignments a
         join public.catalog_families f on f.code=a.family_code
         where a.category_slug=$1 and f.is_active=true and f.is_deleted=false
         order by f.name,f.code limit 3000`,[slug]);
      const record=category.rows[0];
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,category:{
        slug:record.slug,name:record.name,description:record.description||'',
        image:record.image||null,children:Array.isArray(record.metadata?.children)?record.metadata.children:[]
      },families:familyRows.rows});
    }catch(error){return fail(res,error);}
  });


  // Admin-only taxonomy review. Product identities and legacy paths are not rewritten.

  // Shared read source for catalogue, image audit, and product editor; RLS-protected table is server-only.
  app.get('/api/catalog/menu-family-assignments',async(req,res)=>{
    try{
      if(!canStaff(await getPortalIdentity(req),'products'))return res.status(403).json({success:false,message:'مجوز مشاهده کاتالوگ لازم است.'});
      if(!databaseEnabled())return res.status(503).json({success:false});
      const rows=await database().query(
        `select a.family_code as "familyCode",a.category_slug as "categorySlug",
           a.submenu_name as "submenuName",a.leaf_name as "leafName",a.method
         from public.catalog_family_menu_assignments a
         join public.catalog_families f on f.code=a.family_code
         where f.is_active=true and f.is_deleted=false
         order by a.family_code limit 10000`);
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,assignments:rows.rows});
    }catch(error){return fail(res,error);}
  });

  app.get('/api/catalog/menu-unassigned',async(req,res)=>{
    try{
      if(!canStaff(await getPortalIdentity(req),'products'))return res.status(403).json({success:false,message:'مجوز مشاهده کاتالوگ لازم است.'});
      if(!databaseEnabled())return res.status(503).json({success:false});
      const rows=await database().query(
        `select f.code,f.name,f.category_slug as "oldCategory",f.submenu as "oldSubmenu",
          coalesce(f.item_count,0) as "skuCount"
         from public.catalog_families f
         left join public.catalog_family_menu_assignments a on a.family_code=f.code
         where f.is_active=true and f.is_deleted=false and a.family_code is null
         order by f.category_slug,f.name limit 4000`);
      return res.json({success:true,families:rows.rows});
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
        `select c.metadata from public.catalog_categories c
         where c.slug=$1 and c.is_active=true and c.metadata->>'source'='industrial_megamenu_hierarchy_v2' limit 1`,[categorySlug]);
      const family=await database().query(
        'select code from public.catalog_families where code=$1 and is_active=true and is_deleted=false limit 1',[familyCode]);
      if(!category.rows.length||!family.rows.length)return res.status(404).json({success:false,message:'خانواده یا دسته مقصد یافت نشد.'});
      const nodes=Array.isArray(category.rows[0].metadata?.children)?category.rows[0].metadata.children:[];
      const selectedNode=nodes.find((node:any)=>node.name===submenu);
      if(submenu&&!selectedNode)return res.status(400).json({success:false,message:'زیرمنو با دسته انتخابی مطابقت ندارد.'});
      if(leaf&&(!selectedNode||!Array.isArray(selectedNode.children)||!selectedNode.children.some((child:any)=>child.name===leaf)))
        return res.status(400).json({success:false,message:'ریزقلم با زیرمنو مطابقت ندارد.'});
      await database().query(
        `insert into public.catalog_family_menu_assignments(family_code,category_slug,submenu_name,leaf_name,method)
         values($1,$2,$3,$4,'admin_verified')
         on conflict(family_code) do update set category_slug=excluded.category_slug,
           submenu_name=excluded.submenu_name,leaf_name=excluded.leaf_name,
           method='admin_verified',updated_at=now()`,[familyCode,categorySlug,submenu||null,leaf||null]);
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
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,items:[]});
      const withInactive=req.query.includeInactive==='1'&&canStaff(await getPortalIdentity(req),'products');
      const categorySlug=clean(req.query.categorySlug,180);
      const categoryPrefix=clean(req.query.categoryPrefix,40);
      if(categoryPrefix&&!/^excel-v2-\d+-$/.test(categoryPrefix))return res.status(400).json({success:false,items:[]});
      const params:any[]=[];
      const scope:string[]=[];
      if(categorySlug){params.push(categorySlug);scope.push('d.category_slug=$'+params.length);}
      if(categoryPrefix){params.push(categoryPrefix+'%');scope.push('d.category_slug like $'+params.length);}
      const conditions:string[]=[];
      if(scope.length)conditions.push('('+scope.join(' or ')+')');
      if(!withInactive)conditions.push('d.is_active=true');
      const where=conditions.length?'where '+conditions.join(' and '):'';
      const rows=await database().query(
        `select d.sku_code as "skuCode",d.name,d.category_slug as "categorySlug",d.category_name as "categoryName",
          d.submenu,d.subcategory,coalesce(nullif(trim(v.brand),''),nullif(trim(d.brand),''),'') as brand,
          d.image_url as "imageUrl",d.technical_specs as "technicalSpecs",d.price_snapshot as "priceSnapshot",
          d.source_family_code as "sourceFamilyCode",d.is_active as active
         from public.catalog_direct_skus d
         left join public.catalog_variants v on v.code=d.sku_code and v.active=true
         ${where} order by d.updated_at desc,d.sku_code limit 5000`,
        params,
      );
      const identity=await getPortalIdentity(req);
      const canReadPrices=identity.canReadCommerce || canStaff(identity,'products','prices');
      return res.json({success:true,items:canReadPrices?rows.rows:rows.rows.map(row=>({...row,priceSnapshot:{}}))});
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
      return res.json({success:true,skuCode,categorySlug});
    }catch(error){return fail(res,error);}
  });
}
