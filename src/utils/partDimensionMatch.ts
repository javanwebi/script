import type {PartMeasurement} from './partMeasurements';
const normalize=(value:unknown)=>String(value || '').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ').toLowerCase().trim();
const aliases:Record<string,RegExp>={wireDiameter:/^(قطر مفتول|wire diameter)$/,coils:/^(تعداد حلقه|coils)$/,outerDiameter:/^(قطر (خارجی|بیرونی)|outer diameter|outside diameter|od)$/,innerDiameter:/^(قطر (داخلی|سوراخ)|قطر سوراخ مرکزی|inner diameter|bore|id)$/,thickness:/^(ضخامت|ارتفاع|thickness|height)$/,width:/^(عرض|width)$/,length:/^(طول|length)$/,pitch:/^(گام|pitch)$/,module:/^(مدول|module)$/,toothCount:/^(تعداد دندانه|teeth|tooth count)$/,lobes:/^(تعداد پره|تعداد بازو|lobes)$/,profile:/^(پروفیل|شکل مقطع|profile)$/};
export function partDimensionMatch(specs:{key:string;value:string}[],fields:PartMeasurement[],values:Record<string,string>={}){
 const matches:string[]=[],mismatches:string[]=[],unknown:string[]=[];
 for(const field of fields.filter(f=>f.id!=='partCode')){
  const desired=normalize(values[field.id]);
  const spec=specs.find(s=>aliases[field.id]?.test(normalize(s.key)));
  if(!desired || desired==='unknown' || !spec){unknown.push(field.id);continue;}
  const actual=normalize(spec.value);
  // Only explicit plain mm values are comparable; do not infer dimensions from product names or convert ambiguous units.
  const scalar=actual.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:mm|میلی متر|میلیمتر)?$/);
  const same=field.kind==='number' ? Boolean(scalar && Number(scalar[1])===Number(desired)) : actual===desired;
  if(field.kind==='number' && !scalar){unknown.push(field.id);continue;}
  (same ? matches : mismatches).push(field.label+': '+values[field.id]+(field.unit ? ' '+field.unit : ''));
 }
 const declaredCode=normalize(values.partCode);
 const registeredCodes=specs.filter(spec=>/^(کد|کد کالا|کد فنی|مدل|code|model)$/.test(normalize(spec.key))).map(spec=>normalize(spec.value));
 if(declaredCode && declaredCode!=='unknown' && !registeredCodes.includes(declaredCode))unknown.push('partCode');
 return {matches,mismatches,unknown,complete:matches.length>=2 && !mismatches.length && !unknown.length};
}
