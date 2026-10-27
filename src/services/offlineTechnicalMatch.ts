/** Conservative technical-data checker for offline image retrieval.
 * Never invents dimensions or compares measurements with unrecognised units.
 */
export type CatalogueSpecification={key:string;value:string};
export type TechnicalCheck={compared:number;mismatches:string[];matches:string[];requestedCode?:string};
const digits=(s:string)=>s.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const normal=(s:unknown)=>digits(String(s??'')).toLowerCase().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/\s+/g,' ').trim();
const groups:Record<string,RegExp>={
  outerDiameter:/\b(outer diameter|od|outside diameter|external diameter)\b|قطر (بیرونی|خارجی)/i,
  innerDiameter:/\b(inner diameter|id|bore diameter|shaft diameter)\b|قطر (داخلی|سوراخ|شفت)/i,
  width:/\b(width|belt width|top width)\b|عرض/i,
  thickness:/\b(thickness|height|section height)\b|ضخامت|ارتفاع/i,
  length:/\b(length|pitch length|effective length|outer length|inner length)\b|طول/i,
  pitch:/\b(pitch|tooth pitch)\b|گام/i,
  toothCount:/\b(tooth count|teeth|number of teeth)\b|تعداد دندانه/i
};
const units=/\b(mm|millimetres?|millimeters?)\b|میلی.?متر|میل(?:ی)?\b/i;
export function checkOfflineTechnicalSpecs(measurements:unknown,specs:CatalogueSpecification[],code?:string):TechnicalCheck {
 const m=measurements && typeof measurements==='object' && !Array.isArray(measurements)
   ? measurements as Record<string,unknown> : {};
 const checked:TechnicalCheck={compared:0,mismatches:[],matches:[]};
 const userCode=normal(m.partCode);
 if(userCode && userCode!=='unknown' && userCode.length<=120)checked.requestedCode=userCode;
 for(const [field,re] of Object.entries(groups)){
  const raw=normal(m[field]);
  if(!raw||raw==='unknown'||!/^\d+(?:[.,]\d+)?$/.test(raw))continue;
  const requested=Number(raw.replace(',','.'));
  if(!Number.isFinite(requested)||requested<=0)continue;
  for(const spec of specs || []){
   const key=normal(spec.key),value=normal(spec.value);
   if(!re.test(key))continue;
   if(field!=='toothCount' && !units.test(key+' '+value))continue;
   // Avoid ranges, conversion assumptions, part numbers, or multi-valued specs.
   const numbers=[...value.matchAll(/\d+(?:[.,]\d+)?/g)].map(match=>Number(match[0].replace(',','.')));
   if(numbers.length!==1 || !Number.isFinite(numbers[0]))continue;
   const tolerance=field==='toothCount'?0:Math.max(0.25,numbers[0]*0.025);
   checked.compared++;
   if(Math.abs(numbers[0]-requested)>tolerance)
     checked.mismatches.push(field+': '+requested+' ≠ '+numbers[0]);
   else checked.matches.push(field+': '+numbers[0]);
   break;
  }
 }
 if(checked.requestedCode && code && normal(code)!==checked.requestedCode)
   checked.mismatches.push('partCode: کد اعلام‌شده با کد محصول متفاوت است');
 return checked;
}
