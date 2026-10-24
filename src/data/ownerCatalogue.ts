export interface OwnerCatalogueEvidence {
 sourceName:string;documentSha256:string;pdfPage:number;printedPage:number;
 drawingPdfPage:number;inventoryCodeMatch:boolean;conflict?:string;
}
export interface OwnerPinRow {
 sku:string;dim_2r_outer:string;dim_w:string;dim_h:string;dim_2r_inner:string;
 pdf_page:number;printed_page:number;drawing_pdf_page:number;
 source_sha256:string;is_conflict:boolean;
}
const rows=new Map<string,OwnerPinRow>();
/** Load only confirmed reference records from public.owner_catalogue_pin_rows. */
export function installOwnerPinRows(records:OwnerPinRow[]){
 rows.clear();
 for(const row of records)rows.set(row.sku,row);
}
export function ownerPinDimensions(code:string,name:string){
 const normalized=name.replace(/ي/g,'ی').replace(/ك/g,'ک');
 const row=rows.get(code);
 if(!row||!/^پین/.test(normalized))return undefined;
 const evidence:OwnerCatalogueEvidence={
  sourceName:'کاتالوگ رسمی اطلس — فایل ارسالی صاحب کالا',
  documentSha256:row.source_sha256,pdfPage:row.pdf_page,
  printedPage:row.printed_page,drawingPdfPage:row.drawing_pdf_page,
  inventoryCodeMatch:true
 };
 if(row.is_conflict)return {evidence:{...evidence,conflict:'در جدول مرجع، ابعاد این کد متعارض است؛ تا بررسی مدیر، ابعاد تأیید نمی‌شوند.'},specifications:[]};
 return {evidence,specifications:[
  {key:'2R — طبق نقشهٔ کاتالوگ اطلس',value:`${row.dim_2r_outer} میلی‌متر`},
  {key:'W — طبق نقشهٔ کاتالوگ اطلس',value:`${row.dim_w} میلی‌متر`},
  ...(row.dim_h==='بیضی'?[{key:'شرح h در جدول اطلس',value:'بیضی؛ ارتفاع عددی مشخص نشده'}]:[{key:'h — طبق نقشهٔ کاتالوگ اطلس',value:`${row.dim_h} میلی‌متر`}]),
  {key:'2r — طبق نقشهٔ کاتالوگ اطلس',value:`${row.dim_2r_inner} میلی‌متر`}
 ]};
}
