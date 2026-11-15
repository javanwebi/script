import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const CANDIDATES_DIR = path.join(ROOT_DIR, 'docs/pilot-family-image-study/candidates');
const PILOT_OUT_DIR = path.join(ROOT_DIR, 'docs/pilot-family-image-study/FAM-34388');
const FAMILY_OUT_DIR = path.join(PILOT_OUT_DIR, 'family');
const SKUS_OUT_DIR = path.join(PILOT_OUT_DIR, 'skus');

interface PilotSkuSpec {
  skuCode: string;
  rawName: string;
  rawSize: string;
  unit: string;
  brand: string;
  series: string;
  mpn: string;
  designation: string;
  beltTypeFa: string;
  beltTypeEn: string;
  profile: string;
  pitchMm: number;
  pitchInchStr: string;
  pitchLengthMm: number;
  pitchLengthInch: number;
  teethCount: number;
  widthCode: string;
  widthMm: number;
  widthInch: number;
  totalThicknessMm: number;
  toothHeightMm: number;
  toothAngleDeg: number;
  innerLengthNote: string;
  outerLengthNote: string;
  bodyMaterialFa: string;
  bodyMaterialEn: string;
  cordMaterialFa: string;
  cordMaterialEn: string;
  facingMaterialFa: string;
  facingMaterialEn: string;
  standard: string;
  temperatureRange: string;
  realImageStatus:
    | 'EXACT_SKU_IMAGE_FOUND'
    | 'VERIFIED_MANUFACTURER_REFERENCE'
    | 'FAMILY_REFERENCE_ONLY'
    | 'REAL_IMAGE_NOT_FOUND';
  realImageCandidateFile: string | null;
  realImageSourceUrl: string | null;
  realImageSourcePageUrl: string | null;
  realImageVerificationNote: string;
  distributorCatalogReferenceUrl: string;
}

const PILOT_FAMILY = {
  sourceFamilyId: 'FAM-34388',
  reconstructedFamilyId: 'PFAM-تسمه-تایمینگ-ذ-OPTIBELT-L-228',
  sourceFamilyName: 'تسمه اپتی L',
  engineeredFamilyName:
    'تسمه تایمینگ ذوزنقه‌ای اینچی | برند OPTIBELT | جنس لاستیک کلروپرن (Neoprene) با نخ فایبرگلاس | پروفیل L (حلقه)',
  mainGroupId: 'MG-BELTS',
  mainGroupName: 'تسمه‌های صنعتی',
  categorySlug: 'excel-v2-1-1',
  categoryName: 'تسمه تایمینگ صنعتی',
  submenu: 'تسمه تایمینگ لاستیکی',
  leaf: 'تسمه تایم گام XL, L, H, XH',
  familyTypeId: 'FT-TIMING-BELT',
  familyTypeName: 'تسمه تایمینگ صنعتی',
  brand: 'OPTIBELT',
  manufacturer: 'Arntz Optibelt Group (Höxter, Germany)',
  series: 'optibelt ZR (Zahnriemen Imperial Trapezoidal)',
  beltTypeFa: 'تسمه تایمینگ ذوزنقه‌ای اینچی (Imperial Trapezoidal Synchronous Belt)',
  profile: 'L (Light)',
  pitchMm: 9.525,
  pitchInchStr: '3/8 in (0.375")',
  toothHeightMm: 1.91,
  totalThicknessMm: 3.6,
  toothRootWidthMm: 4.65,
  toothTipWidthMm: 3.26,
  toothAngleDeg: 40,
  bodyMaterialFa: 'لاستیک کلروپرن / نئوپرن سیاه صنعتی (Polychloroprene / Neoprene CR)',
  cordMaterialFa: 'کورد کششی فایبرگلاس با پایداری طولی بالا (Low-Stretch Fiberglass Cord)',
  facingMaterialFa: 'روکش پارچه پلی‌آمید (نایلون) ضدسایش روی دندانه (Wear-Resistant Polyamide Fabric)',
  supplyFormFa: 'حلقه مداربسته استاندارد کارخانه‌ای (Endless Loop — واحد فروش: حلقه)',
  standard: 'ISO 5296 / DIN 2215 / BS 4548 / RMA IP-24',
  temperatureRange: '-30°C تا +100°C',
  linearSpeedMax: 'تا 40 m/s',
  meterWeightPer254mm: '0.105 kg/m (در عرض ۱ اینچ = ۲۵.۴ میلی‌متر)',
};

const PILOT_SKUS: PilotSkuSpec[] = [
  {
    skuCode: '34388',
    rawName: 'تسمه اپتي 240L 100.',
    rawSize: '240L100',
    unit: 'حلقه',
    brand: 'OPTIBELT',
    series: 'optibelt ZR',
    mpn: '240 L 100',
    designation: 'optibelt ZR 240 L 100',
    beltTypeFa: 'تسمه تایمینگ ذوزنقه‌ای اینچی یک‌طرفه',
    beltTypeEn: 'Single-Sided Imperial Timing Belt',
    profile: 'L',
    pitchMm: 9.525,
    pitchInchStr: '3/8" (0.375 in)',
    pitchLengthMm: 609.6,
    pitchLengthInch: 24.0,
    teethCount: 64,
    widthCode: '100',
    widthMm: 25.4,
    widthInch: 1.0,
    totalThicknessMm: 3.6,
    toothHeightMm: 1.91,
    toothAngleDeg: 40,
    innerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    outerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    bodyMaterialFa: 'لاستیک کلروپرن (Neoprene CR)',
    bodyMaterialEn: 'Chloroprene Rubber (Neoprene)',
    cordMaterialFa: 'نخ کششی فایبرگلاس (Fiberglass)',
    cordMaterialEn: 'Fiberglass Tension Cord',
    facingMaterialFa: 'روکش پارچه پلی‌آمید ضدسایش',
    facingMaterialEn: 'Polyamide Tooth Facing',
    standard: 'ISO 5296 / DIN 2215 / RMA IP-24',
    temperatureRange: '-30°C to +100°C',
    realImageStatus: 'REAL_IMAGE_NOT_FOUND',
    realImageCandidateFile: null,
    realImageSourceUrl: null,
    realImageSourcePageUrl: null,
    realImageVerificationNote:
      'در منابع توزیع‌کننده جهانی، صفحات فروش کد 240 L 100 از تصویر استوک عمومی خانواده optibelt ZR (با چاپ 300 L یا 270 L) استفاده کرده‌اند و عکس واقعی مستقلی که چاپ «240 L 100» روی پشت تسمه در آن دیده شود یافت نشد. طبق قانون سخت‌گیرانه عدم جعل و عدم جایگزینی تصویر عمومی به جای تصویر اختصاصی SKU، جایگاه تصویر واقعی این کد خالی (null) گذاشته شد.',
    distributorCatalogReferenceUrl:
      'https://www.optibelt.com/en/products/timing-belts/chloroprene-timing-belts/optibelt-zr/',
  },
  {
    skuCode: '52237',
    rawName: 'تسمه اپتي. 240L 075',
    rawSize: '240L075',
    unit: 'حلقه',
    brand: 'OPTIBELT',
    series: 'optibelt ZR',
    mpn: '240 L 075',
    designation: 'optibelt ZR 240 L 075',
    beltTypeFa: 'تسمه تایمینگ ذوزنقه‌ای اینچی یک‌طرفه',
    beltTypeEn: 'Single-Sided Imperial Timing Belt',
    profile: 'L',
    pitchMm: 9.525,
    pitchInchStr: '3/8" (0.375 in)',
    pitchLengthMm: 609.6,
    pitchLengthInch: 24.0,
    teethCount: 64,
    widthCode: '075',
    widthMm: 19.05,
    widthInch: 0.75,
    totalThicknessMm: 3.6,
    toothHeightMm: 1.91,
    toothAngleDeg: 40,
    innerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    outerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    bodyMaterialFa: 'لاستیک کلروپرن (Neoprene CR)',
    bodyMaterialEn: 'Chloroprene Rubber (Neoprene)',
    cordMaterialFa: 'نخ کششی فایبرگلاس (Fiberglass)',
    cordMaterialEn: 'Fiberglass Tension Cord',
    facingMaterialFa: 'روکش پارچه پلی‌آمید ضدسایش',
    facingMaterialEn: 'Polyamide Tooth Facing',
    standard: 'ISO 5296 / DIN 2215 / RMA IP-24',
    temperatureRange: '-30°C to +100°C',
    realImageStatus: 'REAL_IMAGE_NOT_FOUND',
    realImageCandidateFile: null,
    realImageSourceUrl: null,
    realImageSourcePageUrl: null,
    realImageVerificationNote:
      'در منابع توزیع‌کننده جهانی (از جمله Envmart و پورتال‌های اروپایی)، برای کد 240 L 075 تصویر استوک برش‌خورده optibelt ZR 300 L نمایش داده شده و عکس فیزیکی مستقلی با چاپ «240 L 075» یافت نشد. لذا جایگاه تصویر واقعی اختصاصی این SKU خالی (null) حفظ شد.',
    distributorCatalogReferenceUrl:
      'https://envmart.com/optibelt-l-section-rubber-timing-belt-1905-mm-width-6096-mm-length-64-teeth-fibreglass-cord-240-l-075/p/181353',
  },
  {
    skuCode: '52006',
    rawName: 'تسمه اپتي 255L 050',
    rawSize: '255L050',
    unit: 'حلقه',
    brand: 'OPTIBELT',
    series: 'optibelt ZR',
    mpn: '255 L 050',
    designation: 'optibelt ZR 255 L 050',
    beltTypeFa: 'تسمه تایمینگ ذوزنقه‌ای اینچی یک‌طرفه',
    beltTypeEn: 'Single-Sided Imperial Timing Belt',
    profile: 'L',
    pitchMm: 9.525,
    pitchInchStr: '3/8" (0.375 in)',
    pitchLengthMm: 647.7,
    pitchLengthInch: 25.5,
    teethCount: 68,
    widthCode: '050',
    widthMm: 12.7,
    widthInch: 0.5,
    totalThicknessMm: 3.6,
    toothHeightMm: 1.91,
    toothAngleDeg: 40,
    innerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    outerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    bodyMaterialFa: 'لاستیک کلروپرن (Neoprene CR)',
    bodyMaterialEn: 'Chloroprene Rubber (Neoprene)',
    cordMaterialFa: 'نخ کششی فایبرگلاس (Fiberglass)',
    cordMaterialEn: 'Fiberglass Tension Cord',
    facingMaterialFa: 'روکش پارچه پلی‌آمید ضدسایش',
    facingMaterialEn: 'Polyamide Tooth Facing',
    standard: 'ISO 5296 / DIN 2215 / RMA IP-24',
    temperatureRange: '-30°C to +100°C',
    realImageStatus: 'REAL_IMAGE_NOT_FOUND',
    realImageCandidateFile: null,
    realImageSourceUrl: null,
    realImageSourcePageUrl: null,
    realImageVerificationNote:
      'در منابع توزیع‌کننده جهانی (از جمله Envmart)، برای کد 255 L 050 تصویر رسمی کاتالوگ خانواده optibelt ZR استفاده شده و عکس فیزیکی مستقلی با چاپ «255 L 050» روی پشت تسمه یافت نشد. طبق دستورالعمل، جایگاه تصویر واقعی اختصاصی این SKU خالی (null) گذاشته شد.',
    distributorCatalogReferenceUrl:
      'https://envmart.com/optibelt-l-section-rubber-timing-belt-127-mm-width-647-mm-length-68-teeth-fibreglass-cord-255-l-050/p/181354',
  },
  {
    skuCode: '52009',
    rawName: 'تسمه اپتي 300L 050',
    rawSize: '300L050',
    unit: 'حلقه',
    brand: 'OPTIBELT',
    series: 'optibelt ZR',
    mpn: '300 L 050',
    designation: 'optibelt ZR 300 L 050',
    beltTypeFa: 'تسمه تایمینگ ذوزنقه‌ای اینچی یک‌طرفه',
    beltTypeEn: 'Single-Sided Imperial Timing Belt',
    profile: 'L',
    pitchMm: 9.525,
    pitchInchStr: '3/8" (0.375 in)',
    pitchLengthMm: 762.0,
    pitchLengthInch: 30.0,
    teethCount: 80,
    widthCode: '050',
    widthMm: 12.7,
    widthInch: 0.5,
    totalThicknessMm: 3.6,
    toothHeightMm: 1.91,
    toothAngleDeg: 40,
    innerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    outerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    bodyMaterialFa: 'لاستیک کلروپرن (Neoprene CR)',
    bodyMaterialEn: 'Chloroprene Rubber (Neoprene)',
    cordMaterialFa: 'نخ کششی فایبرگلاس (Fiberglass)',
    cordMaterialEn: 'Fiberglass Tension Cord',
    facingMaterialFa: 'روکش پارچه پلی‌آمید ضدسایش',
    facingMaterialEn: 'Polyamide Tooth Facing',
    standard: 'ISO 5296 / DIN 2215 / RMA IP-24',
    temperatureRange: '-30°C to +100°C',
    realImageStatus: 'EXACT_SKU_IMAGE_FOUND',
    realImageCandidateFile: 'optibelt_300l_ebay_hires.jpg',
    realImageSourceUrl: 'https://i.ebayimg.com/images/g/xNwAAOSwVAtnVAjb/s-l1600.jpg',
    realImageSourcePageUrl: 'https://www.ebay.co.uk/itm/286187495140',
    realImageVerificationNote:
      'تصویر واقعی کالای فیزیکی با چاپ کارخانه‌ای کاملاً خوانا «optibelt-ZR 300 L | Made in Germany» روی نوار تک‌ردیفه عرض ۰.۵۰ اینچ (۱۲.۷ میلی‌متر) و دندانه‌های ذوزنقه‌ای داخلی با روکش پارچه پلی‌آمید.',
    distributorCatalogReferenceUrl: 'https://www.ebay.co.uk/itm/286187495140',
  },
  {
    skuCode: '52050',
    rawName: 'تسمه اپتي 540L 075',
    rawSize: '540L075',
    unit: 'حلقه',
    brand: 'OPTIBELT',
    series: 'optibelt ZR',
    mpn: '540 L 075',
    designation: 'optibelt ZR 540 L 075',
    beltTypeFa: 'تسمه تایمینگ ذوزنقه‌ای اینچی یک‌طرفه',
    beltTypeEn: 'Single-Sided Imperial Timing Belt',
    profile: 'L',
    pitchMm: 9.525,
    pitchInchStr: '3/8" (0.375 in)',
    pitchLengthMm: 1371.6,
    pitchLengthInch: 54.0,
    teethCount: 144,
    widthCode: '075',
    widthMm: 19.05,
    widthInch: 0.75,
    totalThicknessMm: 3.6,
    toothHeightMm: 1.91,
    toothAngleDeg: 40,
    innerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    outerLengthNote: 'تعریف‌نشده در استاندارد ISO 5296 (مبنای استاندارد: طول گام Lp)',
    bodyMaterialFa: 'لاستیک کلروپرن (Neoprene CR)',
    bodyMaterialEn: 'Chloroprene Rubber (Neoprene)',
    cordMaterialFa: 'نخ کششی فایبرگلاس (Fiberglass)',
    cordMaterialEn: 'Fiberglass Tension Cord',
    facingMaterialFa: 'روکش پارچه پلی‌آمید ضدسایش',
    facingMaterialEn: 'Polyamide Tooth Facing',
    standard: 'ISO 5296 / DIN 2215 / RMA IP-24',
    temperatureRange: '-30°C to +100°C',
    realImageStatus: 'EXACT_SKU_IMAGE_FOUND',
    realImageCandidateFile: 'optibelt_540l_plenty_full3.jpg',
    realImageSourceUrl: 'https://cdn03.plentyone.com/evlxcyoplb75/item/images/67976/full/67976_3.jpg',
    realImageSourcePageUrl: 'https://www.hug-technik.com/zahnriemen-540-l-075-optibelt-zr.html',
    realImageVerificationNote:
      'تصویر واقعی کالای فیزیکی با چاپ کارخانه‌ای کاملاً خوانا «optibelt ZR 540 L» و کد عرض «075» و عبارت «Made in Germany» روی پشت تسمه.',
    distributorCatalogReferenceUrl: 'https://www.hug-technik.com/zahnriemen-540-l-075-optibelt-zr.html',
  },
];

/**
 * NOTE ON LIBRSVG TEXT ALIGNMENT:
 * Without `direction="rtl"` on <svg>, librsvg uses standard SVG coordinates:
 * - `text-anchor="end"` aligns the RIGHT edge of the text to `x` (text extends left from `x`).
 * - `text-anchor="start"` aligns the LEFT edge of the text to `x` (text extends right from `x`).
 * - `text-anchor="middle"` centers the text horizontally at `x`.
 * To prevent BiDi reordering between Persian and English/numbers, we keep Persian labels and
 * Latin/numeric values in separate <text> elements or separate table cells.
 */
function rtl(text: string): string {
  return `\u202B${text}\u202C`;
}

function buildFamilySpecificationSvg(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1020" width="1400" height="1020">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@500;600;700&amp;display=swap');
      .font-fa { font-family: 'Vazirmatn', 'Tahoma', 'Arial', sans-serif; }
      .font-mono { font-family: 'JetBrains Mono', 'Courier New', monospace; }
    </style>
    <pattern id="engGrid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#EAE4DA" stroke-width="0.8"/>
    </pattern>
  </defs>

  <!-- Outer Background & Sheet Frame -->
  <rect x="0" y="0" width="1400" height="1020" fill="#FBF8F3"/>
  <rect x="24" y="24" width="1352" height="972" rx="18" fill="url(#engGrid)" stroke="#DCD4C6" stroke-width="1.5"/>
  <rect x="38" y="38" width="1324" height="944" rx="14" fill="#FFFFFF" stroke="#55565A" stroke-width="2"/>

  <!-- Top Industrial Header Bar -->
  <path d="M 38 52 Q 38 38 52 38 L 1348 38 Q 1362 38 1362 52 L 1362 146 L 38 146 Z" fill="#55565A"/>
  <rect x="38" y="142" width="1324" height="6" fill="#E56B1E"/>

  <!-- Brand & Document Badge (Left) -->
  <rect x="62" y="56" width="250" height="68" rx="10" fill="#434448" stroke="#E56B1E" stroke-width="1.5"/>
  <text x="187" y="84" text-anchor="middle" class="font-mono" font-size="18" font-weight="700" fill="#FFFFFF">OPTIBELT • GERMANY</text>
  <text x="187" y="110" text-anchor="middle" class="font-mono" font-size="13" font-weight="600" fill="#FFB07C">SERIES: optibelt ZR (L)</text>

  <!-- Header Title (Right-aligned at x=1332) -->
  <text x="1332" y="82" text-anchor="end" class="font-fa" font-size="24" font-weight="800" fill="#FFFFFF">${rtl('شناسنامه مهندسی و جدول مشخصات خانواده تسمه تایمینگ صنعتی')}</text>
  <text x="1332" y="116" text-anchor="end" class="font-fa" font-size="15.5" font-weight="600" fill="#F4EDE2">${rtl('خانواده: تسمه تایمینگ ذوزنقه‌ای اینچی | برند اپتی‌بلت آلمان | تیپ ال (پروفیل اینچی) | کلروپرن با نخ فایبرگلاس')}</text>

  <!-- Subheader Meta Strip (3 distinct boxes) -->
  <rect x="938" y="164" width="400" height="54" rx="10" fill="#F7F3EC" stroke="#E2D9C8" stroke-width="1.2"/>
  <text x="1320" y="186" text-anchor="end" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl('کد خانواده فعلی و بازسازی‌شده در دیتابیس')}</text>
  <text x="1138" y="208" text-anchor="middle" class="font-mono" font-size="13.5" font-weight="700" fill="#E56B1E">FAM-34388  →  PFAM-OPTIBELT-L-228</text>

  <rect x="490" y="164" width="432" height="54" rx="10" fill="#F7F3EC" stroke="#E2D9C8" stroke-width="1.2"/>
  <text x="904" y="186" text-anchor="end" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl('مسیر دسته‌بندی مصوب کاتالوگ صنعت پیش')}</text>
  <text x="706" y="208" text-anchor="middle" class="font-fa" font-size="13" font-weight="800" fill="#1F2022">${rtl('تسمه تایمینگ صنعتی ← تسمه تایمینگ لاستیکی ← گام اینچی')}</text>

  <rect x="62" y="164" width="412" height="54" rx="10" fill="#F7F3EC" stroke="#E2D9C8" stroke-width="1.2"/>
  <text x="456" y="186" text-anchor="end" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl('استاندارد بین‌المللی پروفیل و ابعاد')}</text>
  <text x="268" y="208" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#E56B1E">ISO 5296 / DIN 2215 / BS 4548 / RMA IP-24</text>

  <!-- SECTION 1: INVARIANT ENGINEERING SPECIFICATIONS OF THE FAMILY -->
  <rect x="62" y="234" width="1276" height="38" rx="8" fill="#E56B1E"/>
  <text x="1318" y="259" text-anchor="end" class="font-fa" font-size="15.5" font-weight="800" fill="#FFFFFF">${rtl('بخش اول — مشخصات مهندسی ثابت خانواده (مشترک در تمام کدهای عضو خانواده)')}</text>
  <text x="82" y="258" text-anchor="start" class="font-mono" font-size="13" font-weight="700" fill="#FFF5EE">FAMILY INVARIANT SPECIFICATIONS</text>

  <!-- Two-Column Spec Table -->
  <rect x="712" y="284" width="626" height="312" rx="10" fill="#FFFFFF" stroke="#DCD4C6" stroke-width="1.5"/>
  <rect x="1120" y="285" width="217" height="310" rx="8" fill="#F7F4EE"/>
  <line x1="1120" y1="284" x2="1120" y2="596" stroke="#DCD4C6" stroke-width="1.4"/>

  <rect x="62" y="284" width="626" height="312" rx="10" fill="#FFFFFF" stroke="#DCD4C6" stroke-width="1.5"/>
  <rect x="470" y="285" width="217" height="310" rx="8" fill="#F7F4EE"/>
  <line x1="470" y1="284" x2="470" y2="596" stroke="#DCD4C6" stroke-width="1.4"/>

  <!-- Horizontal Dividers for both tables (6 rows × 52px) -->
  <g stroke="#E6DFD3" stroke-width="1">
    <line x1="712" y1="336" x2="1338" y2="336"/>
    <line x1="712" y1="388" x2="1338" y2="388"/>
    <line x1="712" y1="440" x2="1338" y2="440"/>
    <line x1="712" y1="492" x2="1338" y2="492"/>
    <line x1="712" y1="544" x2="1338" y2="544"/>

    <line x1="62" y1="336" x2="688" y2="336"/>
    <line x1="62" y1="388" x2="688" y2="388"/>
    <line x1="62" y1="440" x2="688" y2="440"/>
    <line x1="62" y1="492" x2="688" y2="492"/>
    <line x1="62" y1="544" x2="688" y2="544"/>
  </g>

  <!-- Right Table Labels (x=1322) & Values (centered at x=916 or right-aligned at x=1102) -->
  <g class="font-fa" font-size="13.5">
    <text x="1322" y="316" text-anchor="end" font-weight="700" fill="#55565A">${rtl('نوع و ساختار تسمه')}</text>
    <text x="1102" y="316" text-anchor="end" font-weight="700" fill="#1F2022">${rtl('تسمه تایمینگ ذوزنقه‌ای اینچی یک‌طرفه')}</text>

    <text x="1322" y="368" text-anchor="end" font-weight="700" fill="#55565A">${rtl('برند و سری ساخت')}</text>
    <text x="916" y="368" text-anchor="middle" class="font-mono" font-weight="700" fill="#E56B1E">OPTIBELT — Series optibelt ZR (Germany)</text>

    <text x="1322" y="420" text-anchor="end" font-weight="700" fill="#55565A">${rtl('پروفیل و تیپ دندانه')}</text>
    <text x="916" y="420" text-anchor="middle" class="font-mono" font-weight="700" fill="#1F2022">Profile L — Light Imperial Trapezoidal</text>

    <text x="1322" y="472" text-anchor="end" font-weight="700" fill="#55565A">${rtl('گام دندانه')}</text>
    <text x="916" y="472" text-anchor="middle" class="font-mono" font-weight="700" fill="#1F2022">p = 9.525 mm  (3/8 inch = 0.375 in)</text>

    <text x="1322" y="524" text-anchor="end" font-weight="700" fill="#55565A">${rtl('ارتفاع دندانه و ضخامت کل')}</text>
    <text x="916" y="524" text-anchor="middle" class="font-mono" font-weight="700" fill="#1F2022">ht = 1.91 mm   |   hs = 3.60 mm</text>

    <text x="1322" y="576" text-anchor="end" font-weight="700" fill="#55565A">${rtl('زاویه و پهنای ریشه دندانه')}</text>
    <text x="916" y="576" text-anchor="middle" class="font-mono" font-weight="700" fill="#1F2022">Angle β = 40°   |   Root s = 4.65 mm</text>
  </g>

  <!-- Left Table Labels (x=672) & Values (x=452) -->
  <g class="font-fa" font-size="13.5">
    <text x="672" y="316" text-anchor="end" font-weight="700" fill="#55565A">${rtl('جنس بدنه تسمه')}</text>
    <text x="452" y="316" text-anchor="end" font-weight="700" fill="#1F2022">${rtl('لاستیک کلروپرن صنعتی (نئوپرن ضدسایش)')}</text>

    <text x="672" y="368" text-anchor="end" font-weight="700" fill="#55565A">${rtl('جنس نخ کششی (کورد)')}</text>
    <text x="452" y="368" text-anchor="end" font-weight="700" fill="#1F2022">${rtl('نخ کششی فایبرگلاس با پایداری طولی بالا')}</text>

    <text x="672" y="420" text-anchor="end" font-weight="700" fill="#55565A">${rtl('پوشش سطح دندانه')}</text>
    <text x="452" y="420" text-anchor="end" font-weight="700" fill="#1F2022">${rtl('روکش پارچه پلی‌آمید (نایلون) ضدسایش')}</text>

    <text x="672" y="472" text-anchor="end" font-weight="700" fill="#55565A">${rtl('فرم عرضه و واحد فروش')}</text>
    <text x="452" y="472" text-anchor="end" font-weight="700" fill="#1F2022">${rtl('حلقه مداربسته فابریک — واحد فروش: حلقه')}</text>

    <text x="672" y="524" text-anchor="end" font-weight="700" fill="#55565A">${rtl('دمای کاری و سرعت خطی')}</text>
    <text x="266" y="524" text-anchor="middle" class="font-mono" font-weight="700" fill="#1F2022">-30°C to +100°C   |   Vmax = 40 m/s</text>

    <text x="672" y="576" text-anchor="end" font-weight="700" fill="#55565A">${rtl('ویژگی‌های مقاومتی')}</text>
    <text x="452" y="576" text-anchor="end" font-weight="700" fill="#E56B1E">${rtl('مقاوم در برابر سایش، رطوبت و روغن‌های معدنی')}</text>
  </g>

  <!-- SECTION 2: CALCULATED DIMENSIONAL RANGES & SKU MATRIX -->
  <rect x="62" y="612" width="1276" height="38" rx="8" fill="#55565A"/>
  <text x="1318" y="637" text-anchor="end" class="font-fa" font-size="15.5" font-weight="800" fill="#FFFFFF">${rtl('بخش دوم — بازه ابعاد محاسبه‌شده از اعضای خانواده و جدول ۵ کد کالای عضو')}</text>
  <text x="82" y="636" text-anchor="start" class="font-mono" font-size="13" font-weight="700" fill="#FFB07C">CALCULATED SKU RANGES (5 ACTIVE SKUs)</text>

  <!-- 4 Summary KPI Range Pills -->
  <g>
    <rect x="1034" y="662" width="304" height="62" rx="8" fill="#FFF6F0" stroke="#E56B1E" stroke-width="1.4"/>
    <text x="1186" y="686" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="700" fill="#55565A">${rtl('تعداد کل کدهای کالای عضو خانواده')}</text>
    <text x="1186" y="712" text-anchor="middle" class="font-fa" font-size="15" font-weight="800" fill="#E56B1E">${rtl('۵ کد کالا در این خانواده')}</text>

    <rect x="710" y="662" width="308" height="62" rx="8" fill="#F7F4EE" stroke="#D5CBB8" stroke-width="1.3"/>
    <text x="864" y="686" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="700" fill="#55565A">${rtl('بازه طول گام در این خانواده')}</text>
    <text x="864" y="712" text-anchor="middle" class="font-mono" font-size="13.5" font-weight="700" fill="#1F2022">609.60 – 1371.60 mm (24.0" – 54.0")</text>

    <rect x="386" y="662" width="308" height="62" rx="8" fill="#F7F4EE" stroke="#D5CBB8" stroke-width="1.3"/>
    <text x="540" y="686" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="700" fill="#55565A">${rtl('بازه تعداد دندانه در این خانواده')}</text>
    <text x="540" y="712" text-anchor="middle" class="font-mono" font-size="14" font-weight="700" fill="#1F2022">z = 64  to  z = 144 Teeth</text>

    <rect x="62" y="662" width="308" height="62" rx="8" fill="#F7F4EE" stroke="#D5CBB8" stroke-width="1.3"/>
    <text x="216" y="686" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="700" fill="#55565A">${rtl('مقاطع عرض موجود در این خانواده')}</text>
    <text x="216" y="712" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#1F2022">12.70 (050) | 19.05 (075) | 25.40 (100)</text>
  </g>

  <!-- SKU Breakdown Table -->
  <rect x="62" y="736" width="1276" height="198" rx="10" fill="#FFFFFF" stroke="#55565A" stroke-width="1.5"/>
  <rect x="63" y="737" width="1274" height="36" rx="8" fill="#F0EAE0"/>

  <!-- Table Headers -->
  <g class="font-fa" font-size="13" font-weight="800" fill="#55565A">
    <text x="1280" y="760" text-anchor="middle">${rtl('کد کالا')}</text>
    <text x="1110" y="760" text-anchor="middle">${rtl('شماره فنی سازنده')}</text>
    <text x="905" y="760" text-anchor="middle">${rtl('طول گام (میلی‌متر)')}</text>
    <text x="735" y="760" text-anchor="middle">${rtl('طول گام (اینچ)')}</text>
    <text x="585" y="760" text-anchor="middle">${rtl('تعداد دندانه')}</text>
    <text x="430" y="760" text-anchor="middle">${rtl('کد عرض')}</text>
    <text x="275" y="760" text-anchor="middle">${rtl('عرض تسمه')}</text>
    <text x="130" y="760" text-anchor="middle">${rtl('ضخامت / گام')}</text>
  </g>
  <line x1="62" y1="773" x2="1338" y2="773" stroke="#55565A" stroke-width="1.2"/>

  <!-- 5 SKU Rows -->
  <g class="font-mono" font-size="13.5" font-weight="600" fill="#1F2022">
    <text x="1280" y="797" text-anchor="middle" font-weight="700" fill="#E56B1E">34388</text>
    <text x="1110" y="797" text-anchor="middle" font-weight="700">optibelt ZR 240 L 100</text>
    <text x="905" y="797" text-anchor="middle">609.60 mm</text>
    <text x="735" y="797" text-anchor="middle">24.0 in</text>
    <text x="585" y="797" text-anchor="middle">64</text>
    <text x="430" y="797" text-anchor="middle">100 (1.00")</text>
    <text x="275" y="797" text-anchor="middle">25.40 mm</text>
    <text x="130" y="797" text-anchor="middle">3.60 / 9.525</text>
    <line x1="62" y1="806" x2="1338" y2="806" stroke="#EAE4DA" stroke-width="1"/>

    <rect x="63" y="807" width="1274" height="31" fill="#FAF7F2"/>
    <text x="1280" y="828" text-anchor="middle" font-weight="700" fill="#E56B1E">52237</text>
    <text x="1110" y="828" text-anchor="middle" font-weight="700">optibelt ZR 240 L 075</text>
    <text x="905" y="828" text-anchor="middle">609.60 mm</text>
    <text x="735" y="828" text-anchor="middle">24.0 in</text>
    <text x="585" y="828" text-anchor="middle">64</text>
    <text x="430" y="828" text-anchor="middle">075 (0.75")</text>
    <text x="275" y="828" text-anchor="middle">19.05 mm</text>
    <text x="130" y="828" text-anchor="middle">3.60 / 9.525</text>
    <line x1="62" y1="838" x2="1338" y2="838" stroke="#EAE4DA" stroke-width="1"/>

    <text x="1280" y="860" text-anchor="middle" font-weight="700" fill="#E56B1E">52006</text>
    <text x="1110" y="860" text-anchor="middle" font-weight="700">optibelt ZR 255 L 050</text>
    <text x="905" y="860" text-anchor="middle">647.70 mm</text>
    <text x="735" y="860" text-anchor="middle">25.5 in</text>
    <text x="585" y="860" text-anchor="middle">68</text>
    <text x="430" y="860" text-anchor="middle">050 (0.50")</text>
    <text x="275" y="860" text-anchor="middle">12.70 mm</text>
    <text x="130" y="860" text-anchor="middle">3.60 / 9.525</text>
    <line x1="62" y1="870" x2="1338" y2="870" stroke="#EAE4DA" stroke-width="1"/>

    <rect x="63" y="871" width="1274" height="31" fill="#FAF7F2"/>
    <text x="1280" y="892" text-anchor="middle" font-weight="700" fill="#E56B1E">52009</text>
    <text x="1110" y="892" text-anchor="middle" font-weight="700">optibelt ZR 300 L 050</text>
    <text x="905" y="892" text-anchor="middle">762.00 mm</text>
    <text x="735" y="892" text-anchor="middle">30.0 in</text>
    <text x="585" y="892" text-anchor="middle">80</text>
    <text x="430" y="892" text-anchor="middle">050 (0.50")</text>
    <text x="275" y="892" text-anchor="middle">12.70 mm</text>
    <text x="130" y="892" text-anchor="middle">3.60 / 9.525</text>
    <line x1="62" y1="902" x2="1338" y2="902" stroke="#EAE4DA" stroke-width="1"/>

    <text x="1280" y="924" text-anchor="middle" font-weight="700" fill="#E56B1E">52050</text>
    <text x="1110" y="924" text-anchor="middle" font-weight="700">optibelt ZR 540 L 075</text>
    <text x="905" y="924" text-anchor="middle">1371.60 mm</text>
    <text x="735" y="924" text-anchor="middle">54.0 in</text>
    <text x="585" y="924" text-anchor="middle">144</text>
    <text x="430" y="924" text-anchor="middle">075 (0.75")</text>
    <text x="275" y="924" text-anchor="middle">19.05 mm</text>
    <text x="130" y="924" text-anchor="middle">3.60 / 9.525</text>
  </g>

  <!-- Footer Engineering Seal -->
  <text x="1334" y="962" text-anchor="end" class="font-fa" font-size="12.5" font-weight="600" fill="#55565A">${rtl('واحد مهندسی کاتالوگ صنعتی صنعت پیش — ممیزی و استخراج از دیتاشیت رسمی شرکت اپتی‌بلت آلمان')}</text>
  <text x="66" y="962" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">DOC-ID: SP-FAM-34388-SPEC-V1</text>
</svg>`;
}

function buildSkuTechnicalDrawingSvg(sku: PilotSkuSpec): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1020" width="1400" height="1020">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@500;600;700&amp;display=swap');
      .font-fa { font-family: 'Vazirmatn', 'Tahoma', 'Arial', sans-serif; }
      .font-mono { font-family: 'JetBrains Mono', 'Courier New', monospace; }
    </style>
    <pattern id="techGrid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#ECE6DC" stroke-width="0.75"/>
    </pattern>
    <pattern id="rubberHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#55565A" stroke-width="1.2" opacity="0.35"/>
    </pattern>
    <marker id="arrowStart" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 10 1 L 1 5 L 10 9 z" fill="#E56B1E"/>
    </marker>
    <marker id="arrowEnd" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#E56B1E"/>
    </marker>
    <marker id="arrowDarkStart" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 10 1 L 1 5 L 10 9 z" fill="#55565A"/>
    </marker>
    <marker id="arrowDarkEnd" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#55565A"/>
    </marker>
  </defs>

  <!-- Sheet Background & Outer Frame -->
  <rect x="0" y="0" width="1400" height="1020" fill="#FBF8F3"/>
  <rect x="24" y="24" width="1352" height="972" rx="16" fill="url(#techGrid)" stroke="#CFC6B6" stroke-width="1.5"/>
  <rect x="38" y="38" width="1324" height="944" rx="12" fill="#FFFFFF" fill-opacity="0.94" stroke="#55565A" stroke-width="2.2"/>

  <!-- Top Engineering Title Bar -->
  <path d="M 38 50 Q 38 38 50 38 L 1350 38 Q 1362 38 1362 50 L 1362 142 L 38 142 Z" fill="#55565A"/>
  <rect x="38" y="138" width="1324" height="6" fill="#E56B1E"/>

  <!-- Left SKU & MPN Callout Box -->
  <rect x="60" y="54" width="320" height="70" rx="10" fill="#3F4044" stroke="#E56B1E" stroke-width="1.8"/>
  <text x="220" y="82" text-anchor="middle" class="font-mono" font-size="20" font-weight="700" fill="#FFFFFF">${sku.designation}</text>
  <text x="220" y="110" text-anchor="middle" class="font-mono" font-size="14" font-weight="600" fill="#FFB07C">SKU CODE: ${sku.skuCode}  |  PROFILE: L</text>

  <!-- Right Main Heading (Right-aligned at x=1334) -->
  <text x="1334" y="80" text-anchor="end" class="font-fa" font-size="23" font-weight="800" fill="#FFFFFF">${rtl('نقشه فنی و برگه مشخصات مهندسی کد کالا')}</text>
  <text x="1334" y="114" text-anchor="end" class="font-fa" font-size="15" font-weight="600" fill="#F4EDE2">${rtl(`تسمه تایمینگ ذوزنقه‌ای اینچی اپتی‌بلت آلمان — تیپ ال — کد کالا در دیتابیس: ${sku.skuCode}`)}</text>

  <!-- Notice Banner: Schematic Not To Scale -->
  <rect x="60" y="156" width="1280" height="36" rx="7" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1.1"/>
  <text x="1322" y="179" text-anchor="end" class="font-fa" font-size="12" font-weight="700" fill="#B94B08">${rtl('راهنمای نقشه: نماهای هندسی به‌صورت شماتیک مهندسی ترسیم شده‌اند؛ تمامی مقادیر عددی دقیق و منطبق بر دیتاشیت رسمی سازنده هستند.')}</text>
  <text x="76" y="179" text-anchor="start" class="font-mono" font-size="11.5" font-weight="700" fill="#E56B1E">SCHEMATIC — NOT TO SCALE | UNIT: mm</text>

  <!-- ===================================================================== -->
  <!-- VIEW 1 (TOP RIGHT): ENDLESS BELT LOOP SCHEMATIC (نمای کلی حلقه تسمه) -->
  <!-- ===================================================================== -->
  <rect x="710" y="206" width="630" height="312" rx="10" fill="#FFFFFF" stroke="#CFC6B6" stroke-width="1.5"/>
  <rect x="711" y="207" width="628" height="34" rx="8" fill="#F4EFE6"/>
  <text x="1322" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۱ — شماتیک حلقه مداربسته تسمه و طول گام')}</text>
  <text x="726" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW A: ENDLESS LOOP (Lp)</text>

  <!-- Outer & Inner Belt Loop Stadium Shape -->
  <rect x="790" y="264" width="470" height="148" rx="74" fill="none" stroke="#55565A" stroke-width="8"/>
  <rect x="786" y="260" width="478" height="156" rx="78" fill="none" stroke="#E56B1E" stroke-width="2" stroke-dasharray="8,5"/>
  <rect x="798" y="272" width="454" height="132" rx="66" fill="#FBF8F3" stroke="#55565A" stroke-width="2"/>

  <g fill="#55565A">
    <polygon points="865,272 877,272 874,282 868,282"/>
    <polygon points="895,272 907,272 904,282 898,282"/>
    <polygon points="925,272 937,272 934,282 928,282"/>
    <polygon points="955,272 967,272 964,282 958,282"/>
    <polygon points="985,272 997,272 994,282 988,282"/>
    <polygon points="1015,272 1027,272 1024,282 1018,282"/>
    <polygon points="1045,272 1057,272 1054,282 1048,282"/>
    <polygon points="1075,272 1087,272 1084,282 1078,282"/>
    <polygon points="1105,272 1117,272 1114,282 1108,282"/>
    <polygon points="1135,272 1147,272 1144,282 1138,282"/>
    <polygon points="1165,272 1177,272 1174,282 1168,282"/>

    <polygon points="865,404 877,404 874,394 868,394"/>
    <polygon points="895,404 907,404 904,394 898,394"/>
    <polygon points="925,404 937,404 934,394 928,394"/>
    <polygon points="955,404 967,404 964,394 958,394"/>
    <polygon points="985,404 997,404 994,394 988,394"/>
    <polygon points="1015,404 1027,404 1024,394 1018,394"/>
    <polygon points="1045,404 1057,404 1054,394 1048,394"/>
    <polygon points="1075,404 1087,404 1084,394 1078,394"/>
    <polygon points="1105,404 1117,404 1114,394 1108,394"/>
    <polygon points="1135,404 1147,404 1144,394 1138,394"/>
    <polygon points="1165,404 1177,404 1174,394 1168,394"/>
  </g>

  <text x="1025" y="325" text-anchor="middle" class="font-mono" font-size="16" font-weight="700" fill="#E56B1E">Lp = ${sku.pitchLengthMm.toFixed(2)} mm (${sku.pitchLengthInch.toFixed(1)} in)</text>
  <text x="1025" y="352" text-anchor="middle" class="font-mono" font-size="14" font-weight="700" fill="#55565A">Teeth Count: z = ${sku.teethCount} Teeth  |  Pitch: p = 9.525 mm</text>
  <text x="1025" y="378" text-anchor="middle" class="font-fa" font-size="12" font-weight="700" fill="#68696E">${rtl('خط‌چین نارنجی: خط گام مرجع (محل قرارگیری نخ کششی فایبرگلاس)')}</text>

  <rect x="730" y="432" width="590" height="70" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="1025" y="458" text-anchor="middle" class="font-mono" font-size="13.5" font-weight="700" fill="#E56B1E">Lp = z × p = ${sku.teethCount} × 9.525 mm = ${sku.pitchLengthMm.toFixed(2)} mm (${sku.pitchLengthInch.toFixed(1)} in)</text>
  <text x="1025" y="485" text-anchor="middle" class="font-fa" font-size="11.5" font-weight="600" fill="#55565A">${rtl('در استاندارد تایمینگ، مبنای ابعادی فقط طول گام بوده و طول داخلی و خارجی تعریف نمی‌شود.')}</text>

  <!-- ===================================================================== -->
  <!-- VIEW 2 (TOP LEFT): BELT CROSS-SECTION & WIDTH (نمای مقطع عرضی تسمه)    -->
  <!-- ===================================================================== -->
  <rect x="60" y="206" width="630" height="312" rx="10" fill="#FFFFFF" stroke="#CFC6B6" stroke-width="1.5"/>
  <rect x="61" y="207" width="628" height="34" rx="8" fill="#F4EFE6"/>
  <text x="672" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۲ — مقطع عرضی تسمه و ساختار لایه‌ها')}</text>
  <text x="76" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW B: CROSS-SECTION (WIDTH b)</text>

  <line x1="150" y1="274" x2="150" y2="318" stroke="#E56B1E" stroke-width="1.4"/>
  <line x1="440" y1="274" x2="440" y2="318" stroke="#E56B1E" stroke-width="1.4"/>
  <line x1="156" y1="288" x2="434" y2="288" stroke="#E56B1E" stroke-width="2" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>
  <rect x="200" y="268" width="190" height="26" rx="5" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="295" y="286" text-anchor="middle" class="font-mono" font-size="13.5" font-weight="700" fill="#E56B1E">b = ${sku.widthMm.toFixed(2)} mm (${sku.widthInch.toFixed(2)}")</text>

  <rect x="150" y="318" width="290" height="44" fill="url(#rubberHatch)" stroke="#55565A" stroke-width="2.2"/>
  <rect x="150" y="318" width="290" height="44" fill="#55565A" fill-opacity="0.18"/>

  <line x1="135" y1="362" x2="455" y2="362" stroke="#E56B1E" stroke-width="1.5" stroke-dasharray="6,4"/>
  <g fill="#E56B1E" stroke="#FFFFFF" stroke-width="1.2">
    <circle cx="170" cy="362" r="5.5"/>
    <circle cx="195" cy="362" r="5.5"/>
    <circle cx="220" cy="362" r="5.5"/>
    <circle cx="245" cy="362" r="5.5"/>
    <circle cx="270" cy="362" r="5.5"/>
    <circle cx="295" cy="362" r="5.5"/>
    <circle cx="320" cy="362" r="5.5"/>
    <circle cx="345" cy="362" r="5.5"/>
    <circle cx="370" cy="362" r="5.5"/>
    <circle cx="395" cy="362" r="5.5"/>
    <circle cx="420" cy="362" r="5.5"/>
  </g>

  <rect x="150" y="362" width="290" height="50" fill="#55565A" fill-opacity="0.32" stroke="#55565A" stroke-width="2.2"/>
  <line x1="150" y1="412" x2="440" y2="412" stroke="#E56B1E" stroke-width="3.5"/>

  <line x1="112" y1="318" x2="150" y2="318" stroke="#55565A" stroke-width="1.2"/>
  <line x1="112" y1="412" x2="150" y2="412" stroke="#55565A" stroke-width="1.2"/>
  <line x1="124" y1="323" x2="124" y2="407" stroke="#55565A" stroke-width="1.8" marker-start="url(#arrowDarkStart)" marker-end="url(#arrowDarkEnd)"/>
  <text x="92" y="362" text-anchor="middle" class="font-mono" font-size="11.5" font-weight="700" fill="#55565A">hs=3.60</text>
  <text x="92" y="378" text-anchor="middle" class="font-mono" font-size="11" font-weight="600" fill="#55565A">(mm)</text>

  <g class="font-fa" font-size="12.5" font-weight="700" fill="#3B3C40">
    <text x="670" y="342" text-anchor="end">${rtl('۱. پشت تسمه: لاستیک کلروپرن')}</text>
    <text x="670" y="368" text-anchor="end" fill="#E56B1E">${rtl('۲. کورد کششی: نخ فایبرگلاس')}</text>
    <text x="670" y="394" text-anchor="end">${rtl('۳. روکش دندانه: پارچه پلی‌آمید')}</text>
  </g>

  <rect x="80" y="432" width="590" height="70" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="375" y="458" text-anchor="middle" class="font-mono" font-size="13.5" font-weight="700" fill="#E56B1E">Width Code ${sku.widthCode}  →  b = ${sku.widthInch.toFixed(2)} inch = ${sku.widthMm.toFixed(2)} mm</text>
  <text x="375" y="485" text-anchor="middle" class="font-fa" font-size="11.5" font-weight="600" fill="#55565A">${rtl('ساختار سه لایه صنعتی مقاوم در برابر سایش، رطوبت و روغن‌های معدنی')}</text>

  <!-- ===================================================================== -->
  <!-- VIEW 3 (BOTTOM RIGHT): TRAPEZOIDAL TOOTH PROFILE GEOMETRY (پروفیل دندانه L) -->
  <!-- ===================================================================== -->
  <rect x="710" y="534" width="630" height="412" rx="10" fill="#FFFFFF" stroke="#CFC6B6" stroke-width="1.5"/>
  <rect x="711" y="535" width="628" height="34" rx="8" fill="#F4EFE6"/>
  <text x="1322" y="557" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۳ — هندسه پروفیل دندانه ذوزنقه‌ای اینچی')}</text>
  <text x="726" y="557" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW C: PROFILE L TOOTH GEOMETRY</text>

  <path d="
    M 780 625
    L 1230 625
    L 1230 680
    L 1195 680
    L 1175 748
    L 1115 748
    L 1095 680
    L 1035 680
    L 1015 748
    L 955 748
    L 935 680
    L 875 680
    L 855 748
    L 795 748
    L 775 680
    L 780 680
    Z
  " fill="#55565A" fill-opacity="0.22" stroke="#55565A" stroke-width="2.5"/>

  <path d="
    M 775 680
    L 795 748
    L 855 748
    L 875 680
    L 935 680
    L 955 748
    L 1015 748
    L 1035 680
    L 1095 680
    L 1115 748
    L 1175 748
    L 1195 680
    L 1230 680
  " fill="none" stroke="#E56B1E" stroke-width="3.2"/>

  <line x1="765" y1="662" x2="1245" y2="662" stroke="#E56B1E" stroke-width="1.8" stroke-dasharray="8,5"/>
  <text x="1252" y="666" text-anchor="start" class="font-mono" font-size="11.5" font-weight="700" fill="#E56B1E">Pitch Line</text>

  <line x1="825" y1="670" x2="825" y2="804" stroke="#E56B1E" stroke-width="1.3" stroke-dasharray="4,3"/>
  <line x1="985" y1="670" x2="985" y2="804" stroke="#E56B1E" stroke-width="1.3" stroke-dasharray="4,3"/>
  <line x1="831" y1="790" x2="979" y2="790" stroke="#E56B1E" stroke-width="2" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>
  <rect x="842" y="774" width="126" height="24" rx="4" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="905" y="791" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#E56B1E">p = 9.525 mm</text>

  <line x1="735" y1="625" x2="780" y2="625" stroke="#55565A" stroke-width="1.2"/>
  <line x1="735" y1="748" x2="795" y2="748" stroke="#55565A" stroke-width="1.2"/>
  <line x1="748" y1="630" x2="748" y2="743" stroke="#55565A" stroke-width="1.8" marker-start="url(#arrowDarkStart)" marker-end="url(#arrowDarkEnd)"/>
  <rect x="716" y="674" width="64" height="24" rx="4" fill="#FFFFFF" stroke="#55565A" stroke-width="1"/>
  <text x="748" y="690" text-anchor="middle" class="font-mono" font-size="11.5" font-weight="700" fill="#55565A">hs=3.60</text>

  <line x1="1195" y1="680" x2="1275" y2="680" stroke="#55565A" stroke-width="1.2"/>
  <line x1="1175" y1="748" x2="1275" y2="748" stroke="#55565A" stroke-width="1.2"/>
  <line x1="1262" y1="685" x2="1262" y2="743" stroke="#55565A" stroke-width="1.8" marker-start="url(#arrowDarkStart)" marker-end="url(#arrowDarkEnd)"/>
  <rect x="1230" y="702" width="68" height="24" rx="4" fill="#FFFFFF" stroke="#55565A" stroke-width="1"/>
  <text x="1264" y="718" text-anchor="middle" class="font-mono" font-size="11.5" font-weight="700" fill="#55565A">ht=1.91</text>

  <line x1="1095" y1="680" x2="1078" y2="785" stroke="#55565A" stroke-width="1.1" stroke-dasharray="3,3"/>
  <line x1="1195" y1="680" x2="1212" y2="785" stroke="#55565A" stroke-width="1.1" stroke-dasharray="3,3"/>
  <text x="1145" y="782" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#E56B1E">β = 40°</text>
  <text x="1145" y="672" text-anchor="middle" class="font-mono" font-size="12" font-weight="700" fill="#55565A">s = 4.65 mm</text>

  <rect x="730" y="828" width="590" height="100" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="1025" y="854" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="800" fill="#55565A">${rtl('پارامترهای ثابت هندسه پروفیل دندانه در استاندارد اینچی')}</text>
  <text x="1025" y="882" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#1F2022">Pitch (p) = 9.525 mm (3/8")  |  Tooth Height (ht) = 1.91 mm  |  Total Height (hs) = 3.60 mm</text>
  <text x="1025" y="910" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#E56B1E">Tooth Angle (β) = 40°        |  Tooth Root Width (s) = 4.65 mm |  Tip Width = 3.26 mm</text>

  <!-- ===================================================================== -->
  <!-- VIEW 4 (BOTTOM LEFT): VERIFIED SKU ENGINEERING SPECIFICATION TABLE    -->
  <!-- ===================================================================== -->
  <rect x="60" y="534" width="630" height="412" rx="10" fill="#FFFFFF" stroke="#55565A" stroke-width="1.8"/>
  <rect x="462" y="571" width="227" height="374" fill="#F7F4EE"/>
  <rect x="61" y="535" width="628" height="36" rx="8" fill="#55565A"/>
  <text x="672" y="558" text-anchor="end" class="font-fa" font-size="14" font-weight="800" fill="#FFFFFF">${rtl('جدول مشخصات فنی قطعی کد کالا در کاتالوگ صنعت پیش')}</text>
  <text x="76" y="558" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#FFB07C">SKU: ${sku.skuCode} (${sku.mpn})</text>

  <line x1="462" y1="571" x2="462" y2="946" stroke="#CFC6B6" stroke-width="1.3"/>

  <g stroke="#E6DFD3" stroke-width="1">
    <line x1="60" y1="605" x2="690" y2="605"/>
    <line x1="60" y1="639" x2="690" y2="639"/>
    <line x1="60" y1="673" x2="690" y2="673"/>
    <line x1="60" y1="707" x2="690" y2="707"/>
    <line x1="60" y1="741" x2="690" y2="741"/>
    <line x1="60" y1="775" x2="690" y2="775"/>
    <line x1="60" y1="809" x2="690" y2="809"/>
    <line x1="60" y1="843" x2="690" y2="843"/>
    <line x1="60" y1="877" x2="690" y2="877"/>
    <line x1="60" y1="911" x2="690" y2="911"/>
  </g>

  <g class="font-fa" font-size="13">
    <text x="674" y="593" text-anchor="end" font-weight="700" fill="#55565A">${rtl('کد کالا در صنعت پیش')}</text>
    <text x="261" y="593" text-anchor="middle" class="font-mono" font-size="14" font-weight="700" fill="#E56B1E">${sku.skuCode}</text>

    <text x="674" y="627" text-anchor="end" font-weight="700" fill="#55565A">${rtl('شماره فنی سازنده')}</text>
    <text x="261" y="627" text-anchor="middle" class="font-mono" font-size="13.5" font-weight="700" fill="#1F2022">${sku.designation}</text>

    <text x="674" y="661" text-anchor="end" font-weight="700" fill="#55565A">${rtl('برند و کشور سازنده')}</text>
    <text x="261" y="661" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#1F2022">OPTIBELT (Arntz Optibelt Group — Germany)</text>

    <text x="674" y="695" text-anchor="end" font-weight="700" fill="#55565A">${rtl('پروفیل و گام دندانه')}</text>
    <text x="261" y="695" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#1F2022">Profile L  |  p = 9.525 mm (3/8 in)</text>

    <text x="674" y="729" text-anchor="end" font-weight="700" fill="#55565A">${rtl('طول گام تسمه')}</text>
    <text x="261" y="729" text-anchor="middle" class="font-mono" font-size="13.5" font-weight="700" fill="#E56B1E">Lp = ${sku.pitchLengthMm.toFixed(2)} mm  (${sku.pitchLengthInch.toFixed(1)} inch)</text>

    <text x="674" y="763" text-anchor="end" font-weight="700" fill="#55565A">${rtl('تعداد دندانه')}</text>
    <text x="261" y="763" text-anchor="middle" class="font-mono" font-size="13.5" font-weight="700" fill="#1F2022">z = ${sku.teethCount} Teeth</text>

    <text x="674" y="797" text-anchor="end" font-weight="700" fill="#55565A">${rtl('عرض مقطع تسمه')}</text>
    <text x="261" y="797" text-anchor="middle" class="font-mono" font-size="13.5" font-weight="700" fill="#E56B1E">b = ${sku.widthMm.toFixed(2)} mm  (${sku.widthInch.toFixed(2)} in — Code ${sku.widthCode})</text>

    <text x="674" y="831" text-anchor="end" font-weight="700" fill="#55565A">${rtl('ضخامت کل و ارتفاع دندانه')}</text>
    <text x="261" y="831" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#1F2022">hs = 3.60 mm  |  ht = 1.91 mm  |  β = 40°</text>

    <text x="674" y="865" text-anchor="end" font-weight="700" fill="#55565A">${rtl('طول داخلی و خارجی')}</text>
    <text x="261" y="865" text-anchor="middle" font-weight="600" fill="#6E7075">${rtl('تعریف‌نشده در استاندارد تایمینگ (بر مبنای طول گام)')}</text>

    <text x="674" y="899" text-anchor="end" font-weight="700" fill="#55565A">${rtl('جنس بدنه، نخ و روکش')}</text>
    <text x="261" y="899" text-anchor="middle" font-weight="700" fill="#1F2022">${rtl('لاستیک کلروپرن + نخ فایبرگلاس + روکش پلی‌آمید')}</text>

    <text x="674" y="933" text-anchor="end" font-weight="700" fill="#55565A">${rtl('استاندارد و واحد فروش')}</text>
    <text x="261" y="933" text-anchor="middle" class="font-mono" font-size="12.5" font-weight="700" fill="#1F2022">ISO 5296 / DIN 2215 — Endless Loop</text>
  </g>

  <!-- Bottom Sheet Signature -->
  <text x="1334" y="968" text-anchor="end" class="font-fa" font-size="12" font-weight="600" fill="#55565A">${rtl(`واحد مهندسی کاتالوگ صنعت پیش — نقشه فنی اختصاصی کد کالا ${sku.skuCode}`)}</text>
  <text x="64" y="968" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">DWG-NO: SP-SKU-${sku.skuCode}-L-V1  |  MPN: ${sku.designation}</text>
</svg>`;
}

async function main() {
  fs.mkdirSync(FAMILY_OUT_DIR, { recursive: true });
  fs.mkdirSync(SKUS_OUT_DIR, { recursive: true });

  // 1. Copy & convert the 3 distinct real family photographs
  const familyRealSources = [
    {
      slot: 'family_image_1',
      titleFa: 'نمای کلی حلقه تسمه تایمینگ Optibelt ZR پروفیل L',
      candidateFile: 'optibelt_540l_plenty_full1.jpg',
      ext: 'jpg',
      sourceUrl: 'https://cdn03.plentyone.com/evlxcyoplb75/item/images/67976/full/67976_1.jpg',
      sourcePageUrl: 'https://www.hug-technik.com/zahnriemen-540-l-075-optibelt-zr.html',
      description:
        'نمای کلی واقعی حلقه تسمه تایمینگ ذوزنقه‌ای اینچی Optibelt ZR پروفیل L بدون واترمارک و با پس‌زمینه سفید صنعتی',
    },
    {
      slot: 'family_image_2',
      titleFa: 'نمای نزدیک دندانه‌های ذوزنقه‌ای، بافت روکش پلی‌آمید و ساختار داخلی تسمه Optibelt ZR L',
      candidateFile: 'optibelt_totallybelts.png',
      ext: 'png',
      sourceUrl: 'http://www.totallybelts.com/cdn/shop/files/Optibelt_L_H_XH_XXH_Belts.png',
      sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-imperial-timing-belts',
      description:
        'نمای نزدیک استودیویی با وضوح بالا (1254×1254) از دندانه‌های ذوزنقه‌ای، روکش پارچه پلی‌آمید سطح دندانه و چاپ کارخانه‌ای optibelt-ZR پروفیل L',
    },
    {
      slot: 'family_image_3',
      titleFa: 'نمای جانبی و برش مقطعی رسمی Optibelt ZR (ضخامت، لبه، نخ کششی فایبرگلاس و پروفیل دندانه)',
      candidateFile: 'optibelt_255l050_envmart.jpg',
      ext: 'jpg',
      sourceUrl:
        'https://envmart.com/260262-default_xl/optibelt-l-section-rubber-timing-belt-127-mm-width-647-mm-length-68-teeth-fibreglass-cord-255-l-050.jpg',
      sourcePageUrl: 'https://www.optibelt.com/en/products/timing-belts/chloroprene-timing-belts/optibelt-zr/',
      description:
        'تصویر رسمی برش‌خورده (Cutaway) سازنده Arntz Optibelt Group از سری optibelt ZR پروفیل L که لبه جانبی، رشته‌های فایبرگلاس، بدنه کلروپرن و مقطع دندانه را نشان می‌دهد',
    },
  ];

  const familyImageManifestEntries = [];

  for (const item of familyRealSources) {
    const srcPath = path.join(CANDIDATES_DIR, item.candidateFile);
    const origOutName = `FAM-34388_${item.slot}.${item.ext}`;
    const webpOutName = `FAM-34388_${item.slot}.webp`;
    const origOutPath = path.join(FAMILY_OUT_DIR, origOutName);
    const webpOutPath = path.join(FAMILY_OUT_DIR, webpOutName);

    fs.copyFileSync(srcPath, origOutPath);
    await sharp(srcPath).webp({ quality: 92 }).toFile(webpOutPath);
    const meta = await sharp(webpOutPath).metadata();

    familyImageManifestEntries.push({
      family_id: PILOT_FAMILY.sourceFamilyId,
      reconstructed_family_id: PILOT_FAMILY.reconstructedFamilyId,
      sku_id: null,
      image_type: item.slot,
      title_fa: item.titleFa,
      original_file_name: `family/${origOutName}`,
      webp_file_name: `family/${webpOutName}`,
      dimensions: `${meta.width}x${meta.height}`,
      source_url: item.sourceUrl,
      source_page_url: item.sourcePageUrl,
      manufacturer: PILOT_FAMILY.manufacturer,
      brand: PILOT_FAMILY.brand,
      mpn: 'optibelt ZR L Series',
      match_status: 'VERIFIED_MANUFACTURER_REFERENCE',
      license_status: 'OFFICIAL_CATALOG_AND_DISTRIBUTOR_PRODUCT_PHOTO_NO_WATERMARK',
      checked_at: new Date().toISOString(),
      approval_status: 'PILOT_READY_FOR_OWNER_REVIEW',
      description: item.description,
    });
  }

  // 2. Generate Family Specification Image (SVG + WebP + PNG)
  const familySpecSvg = buildFamilySpecificationSvg();
  const famSpecSvgName = 'FAM-34388_family_specification_image.svg';
  const famSpecWebpName = 'FAM-34388_family_specification_image.webp';
  const famSpecPngName = 'FAM-34388_family_specification_image.png';

  fs.writeFileSync(path.join(FAMILY_OUT_DIR, famSpecSvgName), familySpecSvg, 'utf8');
  await sharp(Buffer.from(familySpecSvg))
    .webp({ quality: 95 })
    .toFile(path.join(FAMILY_OUT_DIR, famSpecWebpName));
  await sharp(Buffer.from(familySpecSvg))
    .png({ compressionLevel: 8 })
    .toFile(path.join(FAMILY_OUT_DIR, famSpecPngName));

  familyImageManifestEntries.push({
    family_id: PILOT_FAMILY.sourceFamilyId,
    reconstructed_family_id: PILOT_FAMILY.reconstructedFamilyId,
    sku_id: null,
    image_type: 'family_specification_image',
    title_fa: 'تصویر جدول مشخصات مهندسی خانواده و بازه ابعاد ۵ کد عضو (FAM-34388)',
    original_file_name: `family/${famSpecSvgName}`,
    png_file_name: `family/${famSpecPngName}`,
    webp_file_name: `family/${famSpecWebpName}`,
    dimensions: '1400x1020',
    source_url: 'GENERATED_FROM_DATABASE_AND_OPTIBELT_ZR_TECHNICAL_MANUAL',
    source_page_url: 'https://www.optibelt.com/en/products/timing-belts/chloroprene-timing-belts/optibelt-zr/',
    manufacturer: PILOT_FAMILY.manufacturer,
    brand: PILOT_FAMILY.brand,
    mpn: 'optibelt ZR L (240L..540L)',
    match_status: 'EXACT_ENGINEERING_SPECIFICATION_TABLE',
    license_status: 'SANAT_PISH_PROPRIETARY_ENGINEERING_ASSET',
    checked_at: new Date().toISOString(),
    approval_status: 'PILOT_READY_FOR_OWNER_REVIEW',
    description:
      'جدول گرافیکی مهندسی اختصاصی صنعت پیش شامل مشخصات ثابت خانواده (گام 9.525mm، ارتفاع دندانه 1.91mm، ضخامت کل 3.60mm، زاویه 40 درجه، جنس کلروپرن با نخ فایبرگلاس) و بازه‌های محاسبه‌شده از ۵ کد عضو خانواده.',
  });

  // 3. Process each of the 5 SKUs (real_product_image + technical_drawing_image)
  const skuManifestEntries = [];

  for (const sku of PILOT_SKUS) {
    const skuDir = path.join(SKUS_OUT_DIR, sku.skuCode);
    fs.mkdirSync(skuDir, { recursive: true });

    let realOrigRel: string | null = null;
    let realWebpRel: string | null = null;
    let realDimensions: string | null = null;

    if (sku.realImageStatus === 'EXACT_SKU_IMAGE_FOUND' && sku.realImageCandidateFile) {
      const candidatePath = path.join(CANDIDATES_DIR, sku.realImageCandidateFile);
      const ext = path.extname(sku.realImageCandidateFile).replace('.', '') || 'jpg';
      const origFileName = `SKU-${sku.skuCode}_real_product_image.${ext}`;
      const webpFileName = `SKU-${sku.skuCode}_real_product_image.webp`;
      const origDest = path.join(skuDir, origFileName);
      const webpDest = path.join(skuDir, webpFileName);

      fs.copyFileSync(candidatePath, origDest);
      await sharp(candidatePath).webp({ quality: 92 }).toFile(webpDest);
      const meta = await sharp(webpDest).metadata();

      realOrigRel = `skus/${sku.skuCode}/${origFileName}`;
      realWebpRel = `skus/${sku.skuCode}/${webpFileName}`;
      realDimensions = `${meta.width}x${meta.height}`;
    }

    // Generate precision SVG + WebP + PNG technical drawing for this SKU
    const drawingSvg = buildSkuTechnicalDrawingSvg(sku);
    const svgFileName = `SKU-${sku.skuCode}_technical_drawing_image.svg`;
    const webpFileName = `SKU-${sku.skuCode}_technical_drawing_image.webp`;
    const pngFileName = `SKU-${sku.skuCode}_technical_drawing_image.png`;

    fs.writeFileSync(path.join(skuDir, svgFileName), drawingSvg, 'utf8');
    await sharp(Buffer.from(drawingSvg))
      .webp({ quality: 95 })
      .toFile(path.join(skuDir, webpFileName));
    await sharp(Buffer.from(drawingSvg))
      .png({ compressionLevel: 8 })
      .toFile(path.join(skuDir, pngFileName));

    skuManifestEntries.push({
      sku_id: sku.skuCode,
      family_id: PILOT_FAMILY.sourceFamilyId,
      reconstructed_family_id: PILOT_FAMILY.reconstructedFamilyId,
      raw_database_name: sku.rawName,
      raw_database_size: sku.rawSize,
      unit: sku.unit,
      brand: sku.brand,
      manufacturer: PILOT_FAMILY.manufacturer,
      mpn: sku.mpn,
      full_designation: sku.designation,
      verified_engineering_specs: {
        belt_type: sku.beltTypeFa,
        profile: sku.profile,
        pitch_mm: sku.pitchMm,
        pitch_inch: sku.pitchInchStr,
        pitch_length_Lp_mm: sku.pitchLengthMm,
        pitch_length_Lp_inch: sku.pitchLengthInch,
        teeth_count_z: sku.teethCount,
        width_code: sku.widthCode,
        width_b_mm: sku.widthMm,
        width_b_inch: sku.widthInch,
        total_thickness_hs_mm: sku.totalThicknessMm,
        tooth_height_ht_mm: sku.toothHeightMm,
        tooth_angle_deg: sku.toothAngleDeg,
        inner_length_Li: sku.innerLengthNote,
        outer_length_La: sku.outerLengthNote,
        body_material: sku.bodyMaterialFa,
        cord_material: sku.cordMaterialFa,
        tooth_facing: sku.facingMaterialFa,
        standard: sku.standard,
      },
      real_product_image: {
        image_type: 'real_product_image',
        match_status: sku.realImageStatus,
        slot_populated: realWebpRel !== null,
        original_file_name: realOrigRel,
        webp_file_name: realWebpRel,
        dimensions: realDimensions,
        source_url: sku.realImageSourceUrl,
        source_page_url: sku.realImageSourcePageUrl,
        distributor_catalog_reference_url: sku.distributorCatalogReferenceUrl,
        license_status:
          realWebpRel !== null
            ? 'VERIFIED_PHYSICAL_PRODUCT_PHOTO_NO_WATERMARK'
            : 'SLOT_LEFT_EMPTY_PER_NO_FAKE_SKU_IMAGE_RULE',
        verification_note: sku.realImageVerificationNote,
        checked_at: new Date().toISOString(),
        approval_status: 'PILOT_READY_FOR_OWNER_REVIEW',
      },
      technical_drawing_image: {
        image_type: 'technical_drawing_image',
        match_status: 'EXACT_SKU_ENGINEERING_DRAWING_GENERATED',
        slot_populated: true,
        svg_file_name: `skus/${sku.skuCode}/${svgFileName}`,
        png_file_name: `skus/${sku.skuCode}/${pngFileName}`,
        webp_file_name: `skus/${sku.skuCode}/${webpFileName}`,
        dimensions: '1400x1020',
        source_url: 'GENERATED_BY_SANAT_PISH_PRECISION_SVG_CAD_ENGINE',
        license_status: 'SANAT_PISH_PROPRIETARY_ENGINEERING_DRAWING',
        checked_at: new Date().toISOString(),
        approval_status: 'PILOT_READY_FOR_OWNER_REVIEW',
      },
    });
  }

  // 4. Write JSON Manifest
  const manifest = {
    project: 'Sanat Pish Industrial Catalog — Pilot Family Real Image & Engineering Drawing Study',
    generatedAt: new Date().toISOString(),
    pilotScopeNote:
      'Isolated pilot study for 1 real timing belt family (FAM-34388 / 5 SKUs). Not published to public/ or production DB prior to owner review.',
    defaultBeltFallbacksRemoved: true,
    official869CatalogImagesUntouched: true,
    family: PILOT_FAMILY,
    calculatedFamilyRanges: {
      activeSkuCount: 5,
      pitchLengthMmMin: 609.6,
      pitchLengthMmMax: 1371.6,
      pitchLengthInchMin: 24.0,
      pitchLengthInchMax: 54.0,
      teethCountMin: 64,
      teethCountMax: 144,
      widthsMm: [12.7, 19.05, 25.4],
      widthCodes: ['050', '075', '100'],
      thicknessMm: 3.6,
      toothHeightMm: 1.91,
      pitchMm: 9.525,
    },
    familyImages: familyImageManifestEntries,
    skuImages: skuManifestEntries,
  };

  const manifestPath = path.join(PILOT_OUT_DIR, 'image-binding-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('Re-rendered all SVG/WebP/PNG technical drawings and family spec sheet.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
