export interface ComparisonReference { title:string;url:string;condition:string }
/** Candidate comparison references, never a certificate for the stocked part. */
export function partResearchRequirements(type:string,name:string):{checks:string[];comparisonReferences:ComparisonReference[]} {
  const checks=['کد کامل روی قطعه یا نقشهٔ سازنده','اندازه‌ها با واحد و تلرانس','نام سازنده و سری محصول'];
  const comparisonReferences:ComparisonReference[]=[];
  if(type==='اورینگ') {
    checks.push('قطر داخلی d1 و قطر مقطع d2','جنس الاستومر، سختی و شرایط سیال');
    comparisonReferences.push({title:'ISO 3601-1:2012',url:'https://www.iso.org/standard/58043.html',condition:'فقط برای مقایسه ابعاد و کدگذاری اورینگ؛ انطباق کالای موجود تأیید نشده'});
  } else if(type==='واشر صنعتی') {
    checks.push('قطر سوراخ، قطر خارجی و ضخامت','تشخیص واشر استاندارد از حلقه یا قطعهٔ پلیمری سفارشی');
    comparisonReferences.push({title:'ISO 7089:2000',url:'https://www.iso.org/standard/13666.html',condition:'فقط اگر قطعه واشر تخت فلزیِ سری عادی باشد؛ برای هر حلقه یا واشر پلیمری قابل تعمیم نیست'});
  } else if(/زنجیر/.test(type)) {
    checks.push('نوع زنجیر، سری، گام و تعداد ردیف','قطر رولر، عرض داخلی و نوع اتصال');
    comparisonReferences.push({title:'ISO 606:2015',url:'https://committee.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/06/12/61232.html',condition:'برای مقایسه زنجیر رولری یا بوشی انتقال نیرو؛ نوع و انطباق باید تأیید شود'});
  } else if(/چرخ‌دنده/.test(type)) checks.push('تعداد دندانه و مدول یا گام','زاویه فشار، زاویه مارپیچ و جهت دندانه','سوراخ، خار و شرایط بار');
  else if(/پولی/.test(type)) checks.push('پروفیل و تعداد شیار یا تعداد دندانه','قطر گام، سوراخ و خار شفت','قطر خارجی به تنهایی قطر گام نیست');
  else if(/شیلنگ|اتصال/.test(type)) checks.push('قطر داخل و خارج، نوع رزوه و گام','فشار کار، دما و سازگاری با سیال');
  else if(/بوش|شفت|پین/.test(type)) checks.push('قطرها، طول پله‌ها، تلرانس و نوع انطباق','رزوه، شیار خار و جنس');
  else if(/فنر/.test(type)) checks.push('قطر سیم و قطر متوسط فنر','طول آزاد، تعداد حلقه مؤثر و وضعیت دو سر','نرخ فنر و بار مجاز طبق دیتاشیت');
  else if(/مکنده/.test(type)) checks.push('قطر دهانه، تعداد طبقات و نوع اتصال','جنس، خلأ کار و سطح تماس');
  else if(/تسمه/.test(type)) checks.push('پروفیل دقیق و نوع ساخت','مبنای طول، عرض و شکل دندانه','کد سازنده؛ رنگ و گام به تنهایی سازگاری را ثابت نمی‌کند');
  else checks.push('نقشه یا قطعهٔ مقابل و محل نصب؛ ممکن است طراحی اختصاصی باشد');
  if(/ROTEX/i.test(name)) {
    checks.push('ROTEX یا ROTEX GS و اندازه دقیق کوپلینگ','جنس و سختی اسپایدر؛ از رنگ به تنهایی نتیجه گرفته نمی‌شود');
    comparisonReferences.push({title:'KTR — ROTEX reference',url:'https://www.ktr.com/us/en/products/rotex-torsionally-flexible-jaw-couplings/rotex-standard/',condition:'مرجع سازندهٔ ROTEX؛ درج نام در کاتالوگ به معنی اثبات سازنده یا اصالت قطعه نیست'});
  }
  if(/جوشی/.test(name) && /ولتا|VOLTA/i.test(name)) {
    checks.push('کد کامل سری Volta و نقشهٔ مقطع؛ A/B/C یا CRC به تنهایی سختی و ابعاد دقیق را تعیین نمی‌کند');
    comparisonReferences.push({title:'Volta — V & Round Profiles, March 2026',url:'https://www.voltabelting.com/wp-content/uploads/VRound-Profiles-CAT503EN00-Ver.Q.March-2026.pdf',condition:'مرجع مقاطع و سری‌های سازنده؛ مشخصات یک سری را بدون کد کامل آن به تمام تسمه‌های هم‌رنگ یا هم‌حرف تعمیم ندهید'});
  }
  return {checks,comparisonReferences};
}
