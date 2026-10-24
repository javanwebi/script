/** Explicit Node-test fixture initializer. NEVER import this from runtime source. */
import catalogue from '../src/data/catalogueSource.json';
import images from '../src/data/catalogueImages.json';
import review from '../docs/product-image-review.json';
import photos from '../src/data/ownerCataloguePhotos.json';
import { applyCatalogueCorrections } from '../src/data/catalogueCorrections';
import { categorySlugFor, installCatalogProducts } from '../src/data/userProducts';
import { getProductImageUrl } from '../src/assets/imagesproducts';
import { installCatalogImageMetadata } from '../src/services/catalogImageCorpus';
import pins from '../src/data/ownerCataloguePinTable.json';
import imperial from '../src/data/imperialTimingReference.json';
import misumi from '../src/data/misumiTimingReference.json';
import { installOwnerPinRows } from '../src/data/ownerCatalogue';
import { installTimingReferenceRows, type TimingReferenceRow } from '../src/data/imperialTimingReference';

installOwnerPinRows(pins.rows.map(row=>({
 sku:row.sku,dim_2r_outer:row['2R'],dim_w:row.W,dim_h:row.h,dim_2r_inner:row['2r'],
 pdf_page:pins.pdfPage,printed_page:pins.printedPage,drawing_pdf_page:pins.drawingPdfPage,
 source_sha256:pins.sha256,is_conflict:pins.conflicts.includes(row.sku)
})));
const referenceRows:TimingReferenceRow[]=[
 ...Object.entries(imperial.lengths).map(([designation,row])=>({
  designation,reference_source:'optibelt_imperial',length_mm:row.lengthMm,teeth_count:row.teeth,
  pdf_page:row.pdfPage,source_page:null,is_conflict:false,source_url:imperial.sourceUrl
 })),
 ...Object.entries(imperial.conflicts).map(([designation,row])=>({
  designation,reference_source:'optibelt_imperial',length_mm:null,teeth_count:null,
  pdf_page:row.pdfPage,source_page:null,is_conflict:true,source_url:imperial.sourceUrl
 })),
 ...Object.entries(misumi.lengths).map(([designation,row])=>({
  designation,reference_source:'misumi_imperial',length_mm:row.lengthMm,teeth_count:row.teeth,
  pdf_page:null,source_page:row.sourcePage,is_conflict:false,source_url:row.sourceUrl
 }))
];
installTimingReferenceRows(referenceRows);

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
