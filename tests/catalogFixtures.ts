/** Explicit Node-test fixture initializer. NEVER import this from runtime source. */
import catalogue from '../src/data/catalogueSource.json';
import images from '../src/data/catalogueImages.json';
import review from '../docs/product-image-review.json';
import photos from '../src/data/ownerCataloguePhotos.json';
import { applyCatalogueCorrections } from '../src/data/catalogueCorrections';
import { categorySlugFor, installCatalogProducts } from '../src/data/userProducts';
import { getProductImageUrl } from '../src/assets/imagesproducts';
import { installCatalogImageMetadata } from '../src/services/catalogImageCorpus';

const mapped=Object.fromEntries(Object.entries(images as Record<string,{files:string[];familyName:string}>));
const raw=catalogue.map(family=>{
 const imageInfo=mapped[family.code];
 const urls=imageInfo?.familyName===family.name?imageInfo.files.map(getProductImageUrl):[];
 const specs=[
  {key:'نوع فنی',value:family.technicalType},
  {key:'واحدهای فروش',value:family.unit},
  {key:'تعداد کد کالا',value:String(family.itemCount)},
  ...(family.profiles?[{key:'پروفیل‌ها',value:family.profiles}]:[]),
  ...(family.materials?[{key:'جنس‌های ثبت‌شده',value:family.materials}]:[])
 ];
 return applyCatalogueCorrections({
  code:family.code,name:family.name,brand:family.brand||'ثبت نشده',
  categorySlug:categorySlugFor(family.categoryName),categoryName:family.categoryName,
  submenu:family.submenu,subcategory:family.technicalType,
  variants:family.variants,sourceRow:family.sourceRow,
  technicalSpecs:specs,prices:{base:0,retail:0,wholesale:0,dealer:0},
  stock:0,stockKnown:false,inquiryOnly:true,images:urls,
  hasCatalogueImage:urls.length>0,imageScope:urls.length?'family-example' as const:undefined,
  unit:family.unit||'عدد',tags:[family.submenu,family.technicalType,family.profiles||''],
  description:`${family.name}؛ ${family.itemCount.toLocaleString('fa-IR')} کد کالا در این خانواده ثبت شده است. سایز و کد مورد نیاز را از فهرست زیر انتخاب کنید. قیمت و موجودی پس از استعلام اعلام می‌شود.`
 });
});
installCatalogProducts(raw,{rawFixture:true});
installCatalogImageMetadata(
 review.items.map(r=>({file_name:r.file,image_url:`https://raw.githubusercontent.com/javanweb/imagesatlas/main/${r.file}`,sha256:r.sha256,observed_description:r.observed})),
 photos.items.map(p=>({file_name:p.file,catalogue_group:p.catalogueGroup}))
);
