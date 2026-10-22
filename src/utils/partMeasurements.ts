export interface PartMeasurement {id:string;label:string;unit?:string;hint:string;kind:'number'|'text';}
const field=(id:string,label:string,hint:string,unit='میلی‌متر',kind:'number'|'text'='number'):PartMeasurement=>({id,label,hint,unit,kind});
const outer=field('outerDiameter','قطر بیرونی','قطر بیرونی قطعه را اندازه بگیرید.');
const inner=field('innerDiameter','قطر داخلی / سوراخ مرکزی','قطر سوراخ یا محل عبور شفت، در صورت وجود.');
const thickness=field('thickness','ضخامت / ارتفاع','ضخامت خود قطعه، بدون احتساب پس‌زمینه.');
const code=field('partCode','کد یا مدل روی قطعه','فقط نوشته واقعی روی قطعه؛ واترمارک عکس کد کالا نیست.','','text');
export function partMeasurements(observation:any):PartMeasurement[]{
 const type=[observation?.detected_part_type,observation?.part_family_farsi,observation?.visual_shape].join(' ').toLowerCase();
 if(/spring|فنر/.test(type))return [outer,field('wireDiameter','قطر مفتول','قطر سیم فنر را اندازه بگیرید.'),field('length','طول آزاد فنر','طول بدون بار و فشار.'),field('coils','تعداد حلقه‌ها','تعداد حلقه‌های فنر.','عدد'),code];
 if(/coupling|spider|کوپلینگ|خورشیدی/.test(type))return [outer,inner,thickness,field('lobes','تعداد پره‌ها / بازوها','فقط تعداد پره‌های قطعه.','عدد'),code];
 if(/gear|sprocket|چرخ.?دنده|پینیون|زنجیرچرخ/.test(type))return [outer,inner,thickness,field('toothCount','تعداد دندانه','تعداد دندانه سالم؛ اگر قابل شمارش نیست، مشخص نیست را انتخاب کنید.','عدد'),field('module','مدول / گام','مدول یا گام درج‌شده در نقشه؛ از عکس حدس نزنید.'),code];
 if(/belt|تسمه/.test(type))return [field('length','طول تسمه','طول داخلی، خارجی یا مؤثر را در توضیحات مشخص کنید.'),field('width','عرض تسمه','پهنای پشت تسمه یا مقطع.'),thickness,field('pitch','گام دندانه','برای تسمه دندانه‌دار؛ در سایر مدل‌ها مشخص نیست را انتخاب کنید.'),field('profile','پروفیل تسمه','مانند SPA، SPB، A، 8M یا PK.','','text'),code];
 if(/seal|ring|washer|gasket|واشر|حلقه|آب.?بند|اورینگ/.test(type))return [outer,inner,thickness,field('profile','شکل مقطع','گرد، تخت، چهارگوش یا فرم دیگر.','','text'),code];
 return [outer,inner,thickness,field('length','طول کلی','در صورت کاربرد؛ مقدار نامعلوم را حدس نزنید.'),code];
}
export function measurementError(fields:PartMeasurement[],values:Record<string,string>={}):string|undefined{
 for(const f of fields){const value=String(values[f.id] || '').trim();if(!value)return `«${f.label}» را وارد کنید یا «مشخص نیست» را انتخاب کنید.`;
 if(value==='unknown')continue;
 if(f.kind==='number' && (!Number.isFinite(Number(value)) || Number(value)<=0 || (f.unit==='عدد' && !Number.isInteger(Number(value)))))return `مقدار «${f.label}» باید عدد مثبت${f.unit==='عدد' ? ' صحیح' : ''} باشد.`;
 if(value.length>120)return `مقدار «${f.label}» بیش از حد طولانی است.`;
 }
}
export function measurementText(fields:PartMeasurement[],values:Record<string,string>={}){
 return fields.filter(f=>values[f.id] && values[f.id]!=='unknown').map(f=>`${f.label}: ${values[f.id]} ${f.unit || ''}`).join('؛ ');
}
const persian=(value:unknown)=>typeof value==='string' && /[\u0600-\u06ff]/.test(value);
export function persianPartAnalysis(raw:any):string{
 const type=String(raw?.detected_part_type || '').toLowerCase();
 const family=persian(raw?.part_family_farsi) ? raw.part_family_farsi : /coupling|spider/.test(type) ? 'واسط الاستومری کوپلینگ' : /gear/.test(type) ? 'چرخ‌دنده' : /belt/.test(type) ? 'تسمه' : /seal|ring|washer|gasket/.test(type) ? 'حلقه یا قطعه آب‌بندی' : 'قطعه صنعتی';
 const features=(raw?.visual_features || []).filter(persian);
 const unknown=(raw?.unknown_parameters || []).filter(persian);
 return `شناسایی اولیه: ${family}. ${features.length ? 'ویژگی‌های قابل مشاهده: '+[...new Set(features)].join('، ')+'. ' : 'جزئیات شکل برای تأیید نوع قطعه کافی نیست. '} ${unknown.length ? 'موارد نامشخص: '+unknown.join('، ')+'. ' : 'ابعاد، جنس دقیق و کد کالا از ظاهر تأیید نشده‌اند. '}برای انتخاب کد، اندازه‌های مرحله بعد را با مشخصات ثبت‌شده مقایسه می‌کنیم؛ ظاهر مشابه به‌تنهایی تطبیق دقیق نیست.`;
}
