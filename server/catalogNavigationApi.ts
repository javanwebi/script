import type {Express,Request,Response} from 'express';
import crypto from 'node:crypto';
import {database,databaseEnabled,transaction} from './db/connection';
import {getPortalIdentity} from '../api/portal';

const clean=(value:unknown,max=150)=>typeof value==='string'?value.trim().slice(0,max):'';
const imageAllowed=(url:string)=>!url||((url.startsWith('/storage/products/')||url.startsWith('/storage/categories/'))&&!url.includes('..'))||(/^https:\/\/[^\s]+$/i.test(url)&&url.length<=2000);
const fail=(res:Response,error:unknown)=>{console.error('[Catalog navigation/direct SKU]',error instanceof Error?error.message:String(error));return res.status(503).json({success:false,message:'ارتباط با پایگاه داده برقرار نشد.'});};

export function registerCatalogNavigationApi(app:Express){
  // PostgreSQL is the authoritative source for every product category shown in the mega-menu.
  app.get('/api/catalog/categories',async(_req,res)=>{
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,categories:[]});
      const result=await database().query(
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

  app.get('/api/catalog/navigation-groups',async(req,res)=>{
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,groups:[]});
      const withInactive=req.query.includeInactive==='1'&&(await getPortalIdentity(req)).admin;
      const rows=await database().query(
        'select id,title,icon_key as "iconKey",image_url as "imageUrl",category_slugs as "categorySlugs",sort_order as "sortOrder",is_active as active from public.catalog_navigation_groups '+(withInactive?'':'where is_active=true ')+'order by sort_order,id');
      return res.json({success:true,groups:rows.rows});
    }catch(error){return fail(res,error);}
  });

  app.post('/api/catalog/navigation-groups',async(req,res)=>{
    try{
      if(!(await getPortalIdentity(req)).admin)return res.status(403).json({success:false,message:'فقط مدیر سایت اجازه تغییر گروه‌بندی را دارد.'});
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

  // An admin category's "دسته‌ها" field is the authoritative mega-menu parent.
  // Move in one PostgreSQL transaction so a category cannot remain in two groups.
  app.post('/api/catalog/category-group',async(req,res)=>{
    try{
      if(!(await getPortalIdentity(req)).admin)
        return res.status(403).json({success:false,message:'فقط مدیر سایت مجاز به تغییر دسته اصلی است.'});
      if(!databaseEnabled())return res.status(503).json({success:false});
      const categorySlug=clean(req.body?.categorySlug,150);
      const groupId=clean(req.body?.groupId,90);
      if(!categorySlug||typeof req.body?.categorySlug!=='string'||req.body.categorySlug.length>150||
        (req.body?.groupId!==''&&(!groupId||req.body.groupId!==groupId)))
        return res.status(400).json({success:false,message:'دسته یا گروه انتخاب‌شده معتبر نیست.'});
      const changed=await transaction(async client=>{
        // Serialize group membership updates and lock the selected rows until committed.
        const category=await client.query('select slug from public.catalog_categories where slug=$1 for update',[categorySlug]);
        if(!category.rowCount)return {notFound:'category'};
        await client.query('select id from public.catalog_navigation_groups order by id for update');
        if(groupId){
          const group=await client.query('select id from public.catalog_navigation_groups where id=$1',[groupId]);
          if(!group.rowCount)return {notFound:'group'};
        }
        await client.query(`update public.catalog_navigation_groups
          set category_slugs=array_remove(category_slugs,$1), updated_at=now()
          where $1=any(category_slugs)`,[categorySlug]);
        if(groupId)await client.query(`update public.catalog_navigation_groups
          set category_slugs=array_append(category_slugs,$1),updated_at=now()
          where id=$2`,[categorySlug,groupId]);
        return {groupId};
      });
      if('notFound' in changed)
        return res.status(404).json({success:false,message:changed.notFound==='category'?'دسته‌بندی در دیتابیس پیدا نشد.':'گروه انتخاب‌شده وجود ندارد.'});
      return res.json({success:true,categorySlug,groupId:changed.groupId});
    }catch(error){return fail(res,error);}
  });

  app.get('/api/catalog/direct-skus',async(req,res)=>{
    try{
      if(!databaseEnabled())return res.status(503).json({success:false,items:[]});
      const withInactive=req.query.includeInactive==='1'&&(await getPortalIdentity(req)).admin;
      const rows=await database().query('select sku_code as "skuCode",name,category_slug as "categorySlug",category_name as "categoryName",submenu,subcategory,brand,image_url as "imageUrl",technical_specs as "technicalSpecs",price_snapshot as "priceSnapshot",source_family_code as "sourceFamilyCode",is_active as active from public.catalog_direct_skus '+(withInactive?'':'where is_active=true ')+'order by updated_at desc,sku_code limit 5000');
      return res.json({success:true,items:rows.rows});
    }catch(error){return fail(res,error);}
  });

  app.post('/api/catalog/direct-skus',async(req,res)=>{
    try{
      if(!(await getPortalIdentity(req)).admin)return res.status(403).json({success:false,message:'فقط مدیر سایت مجاز است.'});
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
