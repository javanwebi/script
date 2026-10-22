import pins from './ownerCataloguePinTable.json';
export interface OwnerCatalogueEvidence {
  sourceName:string;documentSha256:string;pdfPage:number;printedPage:number;
  drawingPdfPage:number;inventoryCodeMatch:boolean;conflict?:string;
}
const rows=new Map(pins.rows.map(row=>[row.sku,row]));
/** Exact existing SKU lookup, guarded by the actual part noun. Never creates SKUs. */
export function ownerPinDimensions(code:string,name:string) {
  const normalized=name.replace(/ي/g,'ی').replace(/ك/g,'ک');
  if(!rows.has(code)||!/^پین/.test(normalized))return undefined;
  const evidence:OwnerCatalogueEvidence={sourceName:pins.sourceName,documentSha256:pins.sha256,pdfPage:pins.pdfPage,printedPage:pins.printedPage,drawingPdfPage:pins.drawingPdfPage,inventoryCodeMatch:true};
  if(pins.conflicts.includes(code))return {evidence:{...evidence,conflict:'در جدول، کد 90155 دو بار با 2r متفاوت (13 و 14 میلی‌متر) آمده است؛ تا رفع تعارض هیچ ابعادی از این دو ردیف اعمال نمی‌شود.'},specifications:[]};
  const row=rows.get(code)!;
  return {evidence,specifications:[
    {key:'2R — طبق نقشهٔ کاتالوگ اطلس',value:`${row['2R']} میلی‌متر`},
    {key:'W — طبق نقشهٔ کاتالوگ اطلس',value:`${row.W} میلی‌متر`},
    ...(row.h==='بیضی'?[{key:'شرح h در جدول اطلس',value:'بیضی؛ ارتفاع عددی مشخص نشده'}]:[{key:'h — طبق نقشهٔ کاتالوگ اطلس',value:`${row.h} میلی‌متر`}]),
    {key:'2r — طبق نقشهٔ کاتالوگ اطلس',value:`${row['2r']} میلی‌متر`},
  ]};
}
