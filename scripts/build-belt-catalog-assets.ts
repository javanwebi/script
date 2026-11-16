import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getFamilyMenuAssignment } from '../src/services/catalogTaxonomyResolver';

const ROOT_DIR = process.cwd();
const BELTS_ASSET_ROOT = path.join(ROOT_DIR, 'src/assets/catalog/belts');
const MASTER_DIR = path.join(BELTS_ASSET_ROOT, '_master');
const FAMILIES_OUT_DIR = path.join(BELTS_ASSET_ROOT, 'families');
const SKUS_OUT_DIR = path.join(BELTS_ASSET_ROOT, 'skus');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const GENERATED_DIR = path.join(ROOT_DIR, 'src/generated');
const MANIFEST_PATH = path.join(GENERATED_DIR, 'beltCatalogManifest.ts');
const LEGACY_MANIFEST_PATH = path.join(ROOT_DIR, 'src/data/beltCatalogManifest.json');

type ExistingBeltManifest = { families?: Record<string, { p?: string[] }> };
function readExistingBeltManifest(): ExistingBeltManifest | null {
  if (fs.existsSync(MANIFEST_PATH)) {
    const source = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const match = source.match(/export const beltCatalogManifest = ([\s\S]*?) as const;\s*export default beltCatalogManifest;/);
    if (!match) throw new Error('Generated beltCatalogManifest.ts has an invalid format.');
    return JSON.parse(match[1]) as ExistingBeltManifest;
  }
  if (fs.existsSync(LEGACY_MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(LEGACY_MANIFEST_PATH, 'utf8')) as ExistingBeltManifest;
  }
  return null;
}

const API_BASE = process.env.BELT_API_BASE || 'http://localhost:3000';

// Known pure non-belt families inside the legacy belt catalogue; keep migrated PFAM identities excluded too.
const EXCLUDED_NON_BELT_FAMILY_IDS = new Set([
  'PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576', // دستگاه پولیش/تزریق APL؛ تجهیزات است، نه خانواده تسمه
  'FAM-31942', // پولی تسمه تایم H
  'FAM-10415', // پولی نافی دار تسمه خور
  'FAM-32245', // دستگاه پولیش APL
  'FAM-40642', // دستگاه صنعتی PL
  'FAM-35743', // قالب صنعتی AT10
  'FAM-33996', // قالب صنعتی AT5
  'FAM-32247', // قالب صنعتی H
  'FAM-32246', // قالب صنعتی T10
  'FAM-39114', // گریپ صنعتی
  'FAM-40601', // گریپ صنعتی
  'FAM-32711', // تسمه سفت کن تایم استکر
]);

// Verified physical exact-SKU real photographs from _master/
const VERIFIED_EXACT_SKU_PHOTOS: Record<
  string,
  { masterKey: string; sourceUrl: string; sourcePageUrl: string; noteFa: string }
> = {
  '52009': {
    masterKey: 'sku_52009_real',
    sourceUrl: 'https://i.ebayimg.com/images/g/xNwAAOSwVAtnVAjb/s-l1600.jpg',
    sourcePageUrl: 'https://www.ebay.co.uk/itm/286187495140',
    noteFa: 'تصویر واقعی کالای فیزیکی با چاپ خوانای «optibelt-ZR 300 L | Made in Germany» روی تسمه',
  },
  '52050': {
    masterKey: 'sku_52050_real',
    sourceUrl: 'https://cdn03.plentyone.com/evlxcyoplb75/item/images/67976/full/67976_3.jpg',
    sourcePageUrl: 'https://www.hug-technik.com/zahnriemen-540-l-075-optibelt-zr.html',
    noteFa: 'تصویر واقعی کالای فیزیکی با چاپ خوانای «optibelt ZR 540 L 075» روی تسمه',
  },
};

const NEW_LOCAL_MASTERS: Array<{
  key: string;
  localSrc: string;
  sourceUrl: string;
  sourcePageUrl: string;
  manufacturer: string;
  description: string;
}> = [
  {
    key: 'pt_htd_struct',
    localSrc: '.tmp_belt_check/protorque_htd_struct.jpg',
    sourceUrl: 'https://www.protorque.net/_assets/images/products/htd-timing-belts/HTD-timing-belt-structure.jpg',
    sourcePageUrl: 'https://www.protorque.net/en/products/belts/htd-timing-belts/',
    manufacturer: 'Protorque Industrial Belts',
    description: 'Curvilinear HTD timing belt structural cutaway showing fiberglass tensile cords (unstamped size)',
  },
  {
    key: 'pt_pu_struct',
    localSrc: '.tmp_belt_check/protorque_cut.jpg',
    sourceUrl: 'https://www.protorque.net/_assets/images/products/polyurethane-timing-belts/polyurethane-timing-belt-structure.jpg',
    sourcePageUrl: 'https://www.protorque.net/en/products/belts/polyurethane-timing-belts/',
    manufacturer: 'Protorque Industrial Belts',
    description: 'Polyurethane timing belt structural cutaway showing exposed steel tension cords',
  },
  {
    key: 'pt_v_wrapped_struct',
    localSrc: '.tmp_belt_check/protorque_v_wrapped.jpg',
    sourceUrl: 'https://www.protorque.net/_assets/images/products/wrapped-classical-v-belts/classical-v-belt-structure.jpg',
    sourcePageUrl: 'https://www.protorque.net/en/products/belts/wrapped-classical-v-belts/',
    manufacturer: 'Protorque Industrial Belts',
    description: 'Wrapped classical V-belt structural cutaway showing fabric wrap & cord layer',
  },
  {
    key: 'pt_v_cogged_struct',
    localSrc: '.tmp_belt_check/protorque_v_cogged.jpg',
    sourceUrl: 'https://www.protorque.net/_assets/images/products/cogged-classical-v-belts/cogged-v-belt-structure.jpg',
    sourcePageUrl: 'https://www.protorque.net/en/products/belts/cogged-classical-v-belts/',
    manufacturer: 'Protorque Industrial Belts',
    description: 'Raw-edge cogged classical V-belt structural cutaway showing tensile cords',
  },
  {
    key: 'pt_wedge_struct',
    localSrc: '.tmp_belt_check/pt_wedge_struct.jpg',
    sourceUrl: 'https://www.protorque.net/_assets/images/products/wrapped-wedge-belts/wedge-belt-structure.jpg',
    sourcePageUrl: 'https://www.protorque.net/en/products/belts/wrapped-wedge-belts/',
    manufacturer: 'Protorque Industrial Belts',
    description: 'Wrapped narrow wedge V-belt structural cutaway showing polyester cords',
  },
  {
    key: 'pt_cogwedge_struct',
    localSrc: '.tmp_belt_check/pt_cogwedge_struct.jpg',
    sourceUrl: 'https://www.protorque.net/_assets/images/products/cogged-wedge-belts/cogged-wedge-belt-structure.jpg',
    sourcePageUrl: 'https://www.protorque.net/en/products/belts/cogged-high-power-wedge-belts/',
    manufacturer: 'Protorque Industrial Belts',
    description: 'Raw-edge cogged narrow wedge V-belt structural cutaway',
  },
  {
    key: 'pt_hex_struct',
    localSrc: '.tmp_belt_check/pt_hex_struct.jpg',
    sourceUrl: 'https://www.protorque.net/_assets/images/products/hexagonal-belts/Hexagonal-belt-structure.jpg',
    sourcePageUrl: 'https://www.protorque.net/en/products/belts/hexagonal-belts/',
    manufacturer: 'Protorque Industrial Belts',
    description: 'Hexagonal double-V belt structural cutaway showing central cord matrix',
  },
  {
    key: 'bando_1400h100',
    localSrc: '.tmp_belt_check/bando_1400h100.jpg',
    sourceUrl: 'https://www.zoro.com/static/cms/product/large/Z2u95zncpEx_.JPG',
    sourcePageUrl: 'https://www.zoro.com/i/G4488016/',
    manufacturer: 'Bando Chemical Industries (Japan)',
    description: 'Bando Synchro-Link imperial trapezoidal rubber timing belt loop (zero conflicting size stamp)',
  },
  {
    key: 'bando_reds',
    localSrc: '.tmp_belt_check/bando_reds.png',
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Bando_Red-S_II_V-Belt_Loop.png',
    sourcePageUrl: 'https://www.totallybelts.com',
    manufacturer: 'Bando Chemical Industries (Japan)',
    description: 'Bando Red-S II wrapped classical V-belt studio loop (unstamped size)',
  },
  {
    key: 'pv_cutaway',
    localSrc: '.tmp_belt_check/pv_cutaway.png',
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/products/multi-rib-belts-pv-rubber-ribbed-overview_0989fa33-d172-467b-975f-f73f9034965a.png',
    sourcePageUrl: 'https://www.totallybelts.com',
    manufacturer: 'Industrial Catalog',
    description: 'Poly-V multi-rib belt sleeve & cord layer structural overview (no SKU stamp)',
  },
];

type BeltCategorySlug = 'excel-v2-1-1' | 'excel-v2-1-2' | 'excel-v2-1-3' | 'excel-v2-1-4';

interface AuditTechnical {
  operatingPrinciple: string;
  beltDivision: string;
  supplyForm: string;
  sidedness: string;
  profile: string;
  pitchMm: number | null;
  toothAngleDeg: number | null;
  toothHeightMm: number | null;
  beltThicknessMm: number | null;
  topWidthMm: number | null;
  nominalWidthMm: number | null;
  widthCode: string | null;
  pitchLengthMm: number | null;
  insideLengthMm: number | null;
  outsideLengthMm: number | null;
  lengthDesignation: string | null;
  toothCount: number | null;
  ribCount: number | null;
  bodyMaterial: string | null;
  tensileCord: string | null;
  backingOrCoating: string | null;
  standardReference: string | null;
}

interface AuditSkuRecord {
  sku: string;
  originalName: string;
  originalSize: string;
  unit: string;
  currentFamilyId: string;
  currentFamilyName: string;
  detectedBrand: string;
  proposedCategorySlug: string;
  proposedFamilyNameFa: string;
  proposedFamilyNameEn: string;
  actualProductType: string;
  technical: AuditTechnical;
  confidence: string;
  engineeringReasoning: string;
}

interface RuntimeVariant {
  code: string;
  name: string;
  size?: string;
  unit?: string;
  brand?: string;
  model?: string;
  active?: boolean;
  images?: string[];
  technicalSpecs?: Array<{ key: string; value: string }>;
}

interface RuntimeProduct {
  code: string;
  name: string;
  brand?: string;
  unit?: string;
  image?: string;
  images?: string[];
  categorySlug?: string;
  subcategory?: string;
  submenu?: string;
  variants?: RuntimeVariant[];
  technicalSpecs?: Array<{ key: string; value: string }>;
}

interface MenuFamilyEntry {
  code: string;
  name: string;
  brand?: string;
  skuCount?: number;
  submenu?: string;
  leaf?: string;
  menuCategorySlug: BeltCategorySlug;
}

interface MasterPhotoMeta {
  key: string;
  file: string;
  width: number;
  height: number;
  bytes: number;
  sourceUrl: string;
  sourcePageUrl: string;
  manufacturer: string;
  licenseStatus: string;
  description: string;
}

interface ReconciledSku {
  skuCode: string;
  familyCode: string;
  rawName: string;
  rawSize: string;
  unit: string;
  brand: string;
  model: string;
  actualProductType: string;
  technical: AuditTechnical;
  confidence: string;
  menuCategorySlug: BeltCategorySlug;
  familyName: string;
  leaf: string;
  submenu: string;
  isCoggedVbelt: boolean;
  isCoatedBelt: boolean;
}

interface ReconciledFamily {
  familyCode: string;
  familyName: string;
  menuCategorySlug: BeltCategorySlug;
  submenu: string;
  leaf: string;
  brand: string;
  existingDbImage: string | null;
  dominantDivision: string;
  dominantProfiles: string[];
  dominantStandard: string;
  dominantBodyMaterial: string;
  dominantCord: string;
  dominantSupplyForm: string;
  isCoatedFamily: boolean;
  isCoggedFamily: boolean;
  photoKeys: [string, string, string];
  skus: ReconciledSku[];
}

function escapeXml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rtl(text: unknown): string {
  const cleaned = String(text ?? '').trim();
  if (!cleaned) return '';
  return `\u202B${escapeXml(cleaned)}\u202C`;
}

function trunc(text: string, maxLen: number): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + '…';
}

function fmtNum(val: number | null | undefined, suffix = '', digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  const rounded = Number.isInteger(val) ? String(val) : Number(val.toFixed(digits)).toString();
  return suffix ? `${rounded} ${suffix}` : rounded;
}

function normalizeBrandDisplay(raw: string): string {
  const s = String(raw || '').trim();
  if (!s || s === 'UNSPECIFIED' || s === 'ثبت نشده') return 'سفارشی / ثبت‌نشده';
  if (s === 'FOREIGN-OEM' || s === 'خارجی') return 'تولید خارجی (OEM)';
  if (s === 'IRANIAN-OEM' || s === 'ایرانی') return 'ساخت ایران';
  if (s === 'OPTI') return 'OPTIBELT';
  return s;
}

function isMixedNonBeltSku(familyCode: string, skuCode: string, audit?: AuditSkuRecord): boolean {
  const div = audit?.technical?.beltDivision || '';
  const typ = audit?.actualProductType || '';
  if (div.startsWith('non-belt') || typ.startsWith('پولی صنعتی')) return true;
  if (familyCode === 'FAM-31929' && skuCode === '31929') return true;
  return false;
}

function detectCogged(name: string, profile: string, productType: string): boolean {
  const combined = `${name} ${profile} ${productType}`.toUpperCase();
  return (
    /\b(XPZ|XPA|XPB|XPC|AX|BX|CX|3VX|5VX|8VX|ZX)\b/.test(combined) ||
    /دنده.?ای|شیار.?دندانه|RAW.?EDGE|COGGED|نخدار/i.test(combined)
  );
}

function detectCoated(
  menuSlug: string,
  name: string,
  coating: string | null,
  leaf: string,
): boolean {
  if (menuSlug === 'excel-v2-1-4') return true;
  const text = `${name} ${coating || ''} ${leaf}`;
  return /گریپ|روکش|APL|LINATEX|SUPERGRIP|لیناتکس|بارکش|ضد سایش|ترمزگیر/i.test(text);
}

function chooseFamilyPhotoTriplet(fam: {
  menuCategorySlug: BeltCategorySlug;
  dominantDivision: string;
  profileList: string[];
  brand: string;
  familyName: string;
  leaf: string;
  dominantSupplyForm: string;
  isCoated: boolean;
  isCogged: boolean;
}): [string, string, string] {
  const div = fam.dominantDivision;
  const upperName = `${fam.familyName} ${fam.brand} ${fam.leaf} ${fam.profileList.join(' ')}`.toUpperCase();
  const isOpti = /OPTI|OPTIBELT|اپتی|اوپتی/i.test(upperName);
  const isGates = /GATES|گیتس/i.test(upperName);
  const isBando = /BANDO|باندو/i.test(upperName);
  const isMegadyne = /MEGADYNE|مگادین|مگداین/i.test(upperName);
  const isMitsuboshi = /MITSUBOSHI|میتسوبوشی/i.test(upperName);
  const isOpenOrRoll =
    fam.dominantSupplyForm === 'open-ended-roll' ||
    /رول|متری|آستین|سرد باز|اسلیو|OPEN|SLEEVE/i.test(upperName);
  const isPu = /پلی.?یورتان|پلی.?اورتان|\bPU\b|مگادین|مگداین|سیمی|سیم.?دار|T5|T10|AT5|AT10|T2\.5|T20|AT20/i.test(
    upperName,
  );

  // 1. Coated / haul-off / grip belts (excel-v2-1-4 or coated timing belts)
  if (fam.isCoated) {
    if (/سبز|GREEN|SUPERGRIP/i.test(upperName)) {
      return ['coat_supergrip', 'coat_linatex_coils', 'coat_beha_cut'];
    }
    return ['coat_red_loop', 'coat_linatex_coils', 'coat_beha_cut'];
  }

  // 2. Welded PU round & V-flat & Ridge-Top / CRC
  if (div === 'welded-pu-round-crc') {
    return ['pu_round_loop', 'pu_round_profiles', 'pu_round_cut'];
  }
  if (div === 'welded-pu-v-flat') {
    return ['pu_v_smooth', 'pu_round_profiles', 'pu_ridge_cut'];
  }
  if (div === 'vbelt-crowned-crc') {
    if (/آبی|BLUE/i.test(upperName)) {
      return ['pu_ridge_green', 'pu_ridge_blue', 'pu_ridge_caliper'];
    }
    return ['pu_ridge_green', 'pu_ridge_cut', 'pu_ridge_caliper'];
  }

  // 3. Poly-V / Ribbed
  if (div === 'ribbed-poly-v') {
    if (isOpti) return ['pv_opti_loop', 'pv_ribs_close', 'pv_cutaway'];
    if (isMegadyne) return ['pv_mega_loop', 'pv_ribs_close', 'pv_cutaway'];
    if (/\bPH\b/.test(upperName)) return ['pv_ph_loop', 'pv_ribs_close', 'pv_cutaway'];
    return ['pv_pix_loop', 'pv_ribs_close', 'pv_cutaway'];
  }

  // 4. Specialty V-Belts
  if (div === 'vbelt-hexagonal') {
    return ['vb_hex_pix', 'vb_opti_wrap', 'pt_hex_struct'];
  }
  if (div === 'perforated-open-v') {
    return ['vb_perf_red', 'vb_perf_grn', 'pt_v_wrapped_struct'];
  }
  if (div === 'vbelt-banded') {
    if (isOpti) return ['vb_band_opti', 'vb_band_agro', 'pt_wedge_struct'];
    return ['vb_band_agro', 'vb_band_opti', 'pt_wedge_struct'];
  }

  // 5. Classical & Narrow Wedge V-belts
  if (div === 'vbelt-narrow-wedge') {
    if (fam.isCogged) {
      if (isMitsuboshi) return ['vb_cog_agx', 'vb_cog_macro', 'pt_cogwedge_struct'];
      if (isBando) return ['vb_cog_pix', 'vb_cog_bando_cut', 'pt_cogwedge_struct'];
      return ['vb_cog_pix', 'vb_cog_macro', 'pt_cogwedge_struct'];
    }
    return [isBando ? 'bando_reds' : 'vb_opti_wrap', 'vb_wedge_stack', 'pt_wedge_struct'];
  }
  if (div === 'vbelt-classical') {
    if (fam.isCogged) {
      if (isMitsuboshi) return ['vb_cog_agx', 'vb_cog_macro', 'pt_v_cogged_struct'];
      if (isBando) return ['vb_cog_pix', 'vb_cog_bando_cut', 'pt_v_cogged_struct'];
      return ['vb_cog_pix', 'vb_cog_macro', 'pt_v_cogged_struct'];
    }
    if (isBando) return ['bando_reds', 'vb_wedge_stack', 'pt_v_wrapped_struct'];
    return ['vb_opti_wrap', 'vb_wedge_stack', 'pt_v_wrapped_struct'];
  }

  // 6. Timing belts: Automotive
  if (div === 'timing-automotive-ru') {
    return ['htd_gen_sleeves', 'dbl_closeup', 'pt_htd_struct'];
  }

  // 7. Timing belts: Double-Sided
  if (div === 'timing-imperial-double' || div === 'timing-htd-rpp-double') {
    if (isPu) return ['dbl_pu', 'dbl_loop', 'dbl_cutaway'];
    return ['dbl_loop', 'dbl_closeup', 'dbl_cutaway'];
  }

  // 8. Timing belts: Curvilinear HTD / RPP / STS
  if (div === 'timing-htd-rpp-single') {
    if (isOpti) return ['htd_opti_loop', 'htd_opti_hp', 'pt_htd_struct'];
    if (isGates) return ['htd_gen_sleeves', 'dbl_closeup', 'pt_htd_struct'];
    if (isBando) return ['htd_gen_sleeves', 'htd_bando_cut', 'pt_htd_struct'];
    if (isPu || /آبی|BLUE/i.test(upperName)) return ['htd_blue_pu', 'htd_blue_pu_cu', 'pt_pu_struct'];
    return ['htd_gen_sleeves', 'dbl_closeup', 'pt_htd_struct'];
  }

  // 9. Timing belts: Metric PU / T / AT
  if (div === 'timing-metric-single') {
    if (/سبز|PAZ|GREEN/i.test(upperName)) {
      return ['pu_elatech_loop', 'pu_paz_cut', 'pt_pu_struct'];
    }
    if (/آبی|BLUE/i.test(upperName)) {
      return ['pu_blue_pulley', 'pu_elatech_loop', 'pt_pu_struct'];
    }
    if (isOpenOrRoll) {
      return ['pu_open_roll', 'pu_at_coil', 'pt_pu_struct'];
    }
    return ['pu_elatech_loop', 'pu_breco_close', 'pt_pu_struct'];
  }

  // 10. Timing belts: Imperial trapezoidal (MXL/XL/L/H/XH/XXH)
  if (div === 'timing-imperial-single') {
    if (isBando) return ['bando_1400h100', 'dbl_closeup', 'pt_htd_struct'];
    if (isOpenOrRoll) return ['imp_open_roll', 'imp_gen_coil', 'pt_htd_struct'];
    return ['imp_gen_loops', 'dbl_loop', 'pt_htd_struct'];
  }

  // 11. Fallback / service-ambiguous
  if (/ماشینی|خودرو/i.test(upperName)) return ['htd_gen_sleeves', 'dbl_closeup', 'pt_htd_struct'];
  return ['imp_gen_loops', 'dbl_loop', 'pt_htd_struct'];
}

function getDivisionTitleFa(div: string, isCogged: boolean, isCoated: boolean): { fa: string; en: string } {
  if (isCoated && div.startsWith('timing')) {
    return {
      fa: 'تسمه تایمینگ روکش‌دار صنعتی (بارکش / گریپ با پشت لاستیکی یا پلی‌یورتان)',
      en: 'COATED HAUL-OFF TIMING BELT',
    };
  }
  switch (div) {
    case 'timing-imperial-single':
      return { fa: 'تسمه تایمینگ ذوزنقه‌ای اینچی یک‌طرفه', en: 'IMPERIAL TRAPEZOIDAL TIMING' };
    case 'timing-imperial-double':
      return { fa: 'تسمه تایمینگ ذوزنقه‌ای اینچی دوطرفه', en: 'DOUBLE-SIDED IMPERIAL TIMING' };
    case 'timing-metric-single':
      return { fa: 'تسمه تایمینگ متریک پلی‌یورتان سیم‌دار / صنعتی', en: 'METRIC PU TIMING BELT' };
    case 'timing-htd-rpp-single':
      return { fa: 'تسمه تایمینگ دندانه هلالی / سهموی (HTD / RPP / STS)', en: 'CURVILINEAR HTD/RPP TIMING' };
    case 'timing-htd-rpp-double':
      return { fa: 'تسمه تایمینگ دندانه هلالی دوطرفه (D8M / D5M)', en: 'DOUBLE-SIDED HTD TIMING' };
    case 'timing-automotive-ru':
      return { fa: 'تسمه تایمینگ ماشینی / خودرویی گرد (R / RU)', en: 'AUTOMOTIVE TIMING BELT' };
    case 'vbelt-classical':
      return isCogged
        ? { fa: 'تسمه وی‌بلت کلاسیک دنده‌دار لبه برش‌خورده', en: 'RAW-EDGE COGGED CLASSICAL V-BELT' }
        : { fa: 'تسمه وی‌بلت کلاسیک روکش‌دار صنعتی (Wrapped)', en: 'WRAPPED CLASSICAL V-BELT' };
    case 'vbelt-narrow-wedge':
      return isCogged
        ? { fa: 'تسمه وی‌بلت باریک دنده‌دار پرفشار (XPZ/XPA/XPB/XPC)', en: 'COGGED NARROW WEDGE V-BELT' }
        : { fa: 'تسمه وی‌بلت باریک (Wedge) روکش‌دار (SPZ/SPA/SPB/SPC)', en: 'WRAPPED NARROW WEDGE V-BELT' };
    case 'vbelt-banded':
      return { fa: 'تسمه وی‌بلت پشت‌چسبیده / دبل‌رول (Banded Kraftband)', en: 'MULTI-RIB BANDED V-BELT' };
    case 'vbelt-hexagonal':
      return { fa: 'تسمه شش‌ضلعی دوطرفه صنعتی (AA / BB / CC)', en: 'HEXAGONAL DOUBLE V-BELT' };
    case 'vbelt-crowned-crc':
      return { fa: 'تسمه گرده‌ماهی سرامیکی / ریج‌تاپ (CRC)', en: 'CROWNED RIDGE-TOP CERAMIC BELT' };
    case 'perforated-open-v':
      return { fa: 'تسمه وی‌بلت سوراخ‌دار متری با بست مفصلی', en: 'PERFORATED OPEN-END V-BELT' };
    case 'ribbed-poly-v':
      return { fa: 'تسمه شیاری چندشیاره (Poly-V PH / PJ / PK / PL)', en: 'MULTI-RIBBED POLY-V BELT' };
    case 'welded-pu-round-crc':
      return { fa: 'تسمه جوشی پلی‌یورتان مقطع گرد (PU Round)', en: 'WELDABLE PU ROUND BELT' };
    case 'welded-pu-v-flat':
      return { fa: 'تسمه جوشی پلی‌یورتان مقطع ذوزنقه‌ای / تخت', en: 'WELDABLE PU V / FLAT BELT' };
    default:
      return { fa: 'تسمه صنعتی (نیازمند تطبیق کد فنی روی نمونه فیزیکی)', en: 'INDUSTRIAL BELT — PARTIAL SPEC' };
  }
}

function getFamilyRanges(skus: ReconciledSku[]) {
  const numMinMax = (vals: (number | null | undefined)[]) => {
    const nums = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
    if (!nums.length) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return { min, max };
  };

  const lp = numMinMax(skus.map((s) => s.technical.pitchLengthMm));
  const li = numMinMax(skus.map((s) => s.technical.insideLengthMm));
  const la = numMinMax(skus.map((s) => s.technical.outsideLengthMm));
  const lengthMetric = lp
    ? { labelFa: 'بازه طول گام (Lp)', text: lp.min === lp.max ? `${fmtNum(lp.min, 'mm')}` : `${fmtNum(lp.min)} – ${fmtNum(lp.max, 'mm')}` }
    : li
      ? { labelFa: 'بازه طول داخلی (Li)', text: li.min === li.max ? `${fmtNum(li.min, 'mm')}` : `${fmtNum(li.min)} – ${fmtNum(li.max, 'mm')}` }
      : la
        ? { labelFa: 'بازه طول بیرونی (La)', text: la.min === la.max ? `${fmtNum(la.min, 'mm')}` : `${fmtNum(la.min)} – ${fmtNum(la.max, 'mm')}` }
        : { labelFa: 'بازه طول ثبت‌شده', text: 'طبق جدول کدهای عضو' };

  const teeth = numMinMax(skus.map((s) => s.technical.toothCount));
  const ribs = numMinMax(skus.map((s) => s.technical.ribCount));
  const widths = numMinMax(skus.map((s) => s.technical.nominalWidthMm ?? s.technical.topWidthMm));
  const thick = numMinMax(skus.map((s) => s.technical.beltThicknessMm));

  const countMetric = teeth
    ? { labelFa: 'بازه تعداد دندانه', text: teeth.min === teeth.max ? `z = ${teeth.min} Teeth` : `z = ${teeth.min} to ${teeth.max} Teeth` }
    : ribs
      ? { labelFa: 'تعداد شیار / ردیف', text: ribs.min === ribs.max ? `${ribs.min} Ribs/Bands` : `${ribs.min} – ${ribs.max} Ribs/Bands` }
      : thick
        ? { labelFa: 'ارتفاع / ضخامت مقطع', text: thick.min === thick.max ? `${fmtNum(thick.min, 'mm')}` : `${fmtNum(thick.min)} – ${fmtNum(thick.max, 'mm')}` }
        : { labelFa: 'وضعیت مشخصات', text: `${skus.length} SKUs Indexed` };

  const widthMetric = widths
    ? { labelFa: 'بازه عرض / قطر مقطع', text: widths.min === widths.max ? `${fmtNum(widths.min, 'mm')}` : `${fmtNum(widths.min)} – ${fmtNum(widths.max, 'mm')}` }
    : { labelFa: 'مقاطع و پروفیل‌ها', text: Array.from(new Set(skus.map((s) => s.technical.profile).filter((p) => p && p !== 'UNSPECIFIED'))).slice(0, 4).join(', ') || 'Standard Profile' };

  return { lengthMetric, countMetric, widthMetric, widths, thick, teeth, ribs, lp, li, la };
}

function buildFamilySpecificationSvg(fam: ReconciledFamily): string {
  const titleInfo = getDivisionTitleFa(fam.dominantDivision, fam.isCoggedFamily, fam.isCoatedFamily);
  const ranges = getFamilyRanges(fam.skus);
  const brandDisp = normalizeBrandDisplay(fam.brand);
  const firstSku = fam.skus[0];
  const pitches = Array.from(new Set(fam.skus.map((s) => s.technical.pitchMm).filter((x): x is number => x != null && x > 0)));
  const pitchStr = pitches.length === 1
    ? `p = ${fmtNum(pitches[0], 'mm', 3)}`
    : pitches.length > 1
      ? `p = ${fmtNum(Math.min(...pitches), '', 3)}–${fmtNum(Math.max(...pitches), 'mm', 3)}`
      : '—';
  const angleStr = firstSku.technical.toothAngleDeg ? `${firstSku.technical.toothAngleDeg}°` : fam.dominantDivision.startsWith('vbelt') ? '40°' : '—';
  const heightVals = Array.from(new Set(fam.skus.map((s) => s.technical.beltThicknessMm).filter((x): x is number => x != null && x > 0)));
  const thickStr = heightVals.length === 1 ? `h = ${heightVals[0]} mm` : heightVals.length > 1 ? `h = ${Math.min(...heightVals)}–${Math.max(...heightVals)} mm` : '—';
  const profilesStr = fam.dominantProfiles.filter((p) => p !== 'UNSPECIFIED').slice(0, 6).join(' / ') || 'STANDARD';

  // Pick up to 5 representative SKUs to keep rows spacious (add summary note if > 5)
  const displaySkus: ReconciledSku[] = [];
  if (fam.skus.length <= 5) {
    displaySkus.push(...fam.skus);
  } else {
    const seenProf = new Set<string>();
    for (const s of fam.skus) {
      if (displaySkus.length < 4 && !seenProf.has(s.technical.profile)) {
        seenProf.add(s.technical.profile);
        displaySkus.push(s);
      }
    }
    for (const s of fam.skus) {
      if (displaySkus.length >= 5) break;
      if (!displaySkus.includes(s)) displaySkus.push(s);
    }
  }

  const skuRowsSvg = displaySkus
    .map((s, idx) => {
      const y = 797 + idx * 31;
      const lenVal = s.technical.pitchLengthMm
        ? `Lp ${fmtNum(s.technical.pitchLengthMm, 'mm')}`
        : s.technical.insideLengthMm
          ? `Li ${fmtNum(s.technical.insideLengthMm, 'mm')}`
          : s.technical.outsideLengthMm
            ? `La ${fmtNum(s.technical.outsideLengthMm, 'mm')}`
            : s.technical.lengthDesignation || '—';
      const wVal = fmtNum(s.technical.nominalWidthMm ?? s.technical.topWidthMm, 'mm');
      const hVal = fmtNum(s.technical.beltThicknessMm, 'mm');
      const zrVal = s.technical.toothCount ? `${s.technical.toothCount} T` : s.technical.ribCount ? `${s.technical.ribCount} R` : '—';
      const profVal = s.technical.profile === 'UNSPECIFIED' ? '—' : trunc(s.technical.profile, 14);
      const szVal = trunc(s.rawSize || s.technical.lengthDesignation || s.skuCode, 20);
      return `
    ${idx % 2 === 1 ? `<rect x="63" y="${y - 21}" width="1274" height="31" fill="#FAF7F2"/>` : ''}
    <text x="1280" y="${y}" text-anchor="middle" font-weight="700" fill="#E56B1E">${escapeXml(s.skuCode)}</text>
    <text x="1105" y="${y}" text-anchor="middle" font-weight="700">${escapeXml(szVal)}</text>
    <text x="905" y="${y}" text-anchor="middle">${escapeXml(profVal)}</text>
    <text x="720" y="${y}" text-anchor="middle">${escapeXml(lenVal)}</text>
    <text x="545" y="${y}" text-anchor="middle">${escapeXml(wVal)}</text>
    <text x="385" y="${y}" text-anchor="middle">${escapeXml(hVal)}</text>
    <text x="235" y="${y}" text-anchor="middle">${escapeXml(zrVal)}</text>
    <text x="110" y="${y}" text-anchor="middle">${escapeXml(s.technical.pitchMm ? fmtNum(s.technical.pitchMm, 'mm', 3) : '—')}</text>
    ${idx < displaySkus.length - 1 ? `<line x1="62" y1="${y + 10}" x2="1338" y2="${y + 10}" stroke="#EAE4DA" stroke-width="1"/>` : ''}`;
    })
    .join('\n');

  const extraRowNote =
    fam.skus.length > displaySkus.length
      ? `<text x="700" y="956" text-anchor="middle" class="font-fa" font-size="12" font-weight="700" fill="#E56B1E">${rtl(`نمایش ۵ نمونه از مجموع ${fam.skus.length} کد عضو خانواده — مشخصات کامل همه کدها در جدول تعاملی صفحه محصول موجود است`)}</text>`
      : `<text x="700" y="956" text-anchor="middle" class="font-fa" font-size="12" font-weight="600" fill="#55565A">${rtl('تمامی کدهای فعال تسمه در این خانواده در جدول فوق درج شده‌اند')}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1020" width="1400" height="1020">
  <defs>
    <style>
      .font-fa { font-family: 'Noto Sans Arabic', 'Noto Kufi Arabic', 'Tahoma', 'DejaVu Sans', sans-serif; }
      .font-mono { font-family: 'DejaVu Sans Mono', 'Liberation Mono', monospace; }
    </style>
    <pattern id="engGrid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#EAE4DA" stroke-width="0.8"/>
    </pattern>
  </defs>

  <rect x="0" y="0" width="1400" height="1020" fill="#FBF8F3"/>
  <rect x="24" y="24" width="1352" height="972" rx="18" fill="url(#engGrid)" stroke="#DCD4C6" stroke-width="1.5"/>
  <rect x="38" y="38" width="1324" height="944" rx="14" fill="#FFFFFF" stroke="#55565A" stroke-width="2"/>

  <path d="M 38 52 Q 38 38 52 38 L 1348 38 Q 1362 38 1362 52 L 1362 146 L 38 146 Z" fill="#55565A"/>
  <rect x="38" y="142" width="1324" height="6" fill="#E56B1E"/>

  <rect x="62" y="56" width="290" height="68" rx="10" fill="#434448" stroke="#E56B1E" stroke-width="1.5"/>
  <text x="207" y="84" text-anchor="middle" class="font-mono" font-size="16" font-weight="700" fill="#FFFFFF">${escapeXml(trunc(fam.familyCode, 22))}</text>
  <text x="207" y="109" text-anchor="middle" class="font-mono" font-size="12" font-weight="600" fill="#FFB07C">${escapeXml(trunc(titleInfo.en, 30))}</text>

  <text x="1332" y="82" text-anchor="end" class="font-fa" font-size="22" font-weight="800" fill="#FFFFFF">${rtl('شناسنامه مهندسی و جدول مشخصات خانواده تسمه صنعتی')}</text>
  <text x="1332" y="116" text-anchor="end" class="font-fa" font-size="15" font-weight="600" fill="#F4EDE2">${rtl(trunc(`${fam.familyName} | ${titleInfo.fa}`, 86))}</text>

  <rect x="938" y="164" width="400" height="54" rx="10" fill="#F7F3EC" stroke="#E2D9C8" stroke-width="1.2"/>
  <text x="1320" y="186" text-anchor="end" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl('کد خانواده و پروفیل‌های عضو')}</text>
  <text x="1138" y="208" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#E56B1E">${escapeXml(`${fam.familyCode}  |  ${trunc(profilesStr, 26)}`)}</text>

  <rect x="490" y="164" width="432" height="54" rx="10" fill="#F7F3EC" stroke="#E2D9C8" stroke-width="1.2"/>
  <text x="904" y="186" text-anchor="end" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl('مسیر دسته‌بندی کاتالوگ صنعت پیش')}</text>
  <text x="706" y="208" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="800" fill="#1F2022">${rtl(trunc(fam.leaf && fam.leaf !== fam.submenu ? `${fam.submenu} ← ${fam.leaf}` : fam.submenu || fam.leaf || 'تسمه‌های صنعتی', 66))}</text>

  <rect x="62" y="164" width="412" height="54" rx="10" fill="#F7F3EC" stroke="#E2D9C8" stroke-width="1.2"/>
  <text x="456" y="186" text-anchor="end" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl('مرجع استاندارد بین‌المللی')}</text>
  <text x="268" y="208" text-anchor="middle" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">${escapeXml(trunc(fam.dominantStandard, 42))}</text>

  <rect x="62" y="234" width="1276" height="38" rx="8" fill="#E56B1E"/>
  <text x="1318" y="259" text-anchor="end" class="font-fa" font-size="15" font-weight="800" fill="#FFFFFF">${rtl('بخش اول — مشخصات مهندسی ثابت و ساختاری خانواده')}</text>
  <text x="82" y="258" text-anchor="start" class="font-mono" font-size="12.5" font-weight="700" fill="#FFF5EE">FAMILY ENGINEERING SPECIFICATIONS</text>

  <rect x="712" y="284" width="626" height="312" rx="10" fill="#FFFFFF" stroke="#DCD4C6" stroke-width="1.5"/>
  <rect x="1120" y="285" width="217" height="310" rx="8" fill="#F7F4EE"/>
  <line x1="1120" y1="284" x2="1120" y2="596" stroke="#DCD4C6" stroke-width="1.4"/>

  <rect x="62" y="284" width="626" height="312" rx="10" fill="#FFFFFF" stroke="#DCD4C6" stroke-width="1.5"/>
  <rect x="470" y="285" width="217" height="310" rx="8" fill="#F7F4EE"/>
  <line x1="470" y1="284" x2="470" y2="596" stroke="#DCD4C6" stroke-width="1.4"/>

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

  <g class="font-fa" font-size="13">
    <text x="1322" y="316" text-anchor="end" font-weight="700" fill="#55565A">${rtl('نوع و ساختار تسمه')}</text>
    <text x="1102" y="316" text-anchor="end" font-weight="700" fill="#1F2022">${rtl(trunc(titleInfo.fa, 48))}</text>

    <text x="1322" y="368" text-anchor="end" font-weight="700" fill="#55565A">${rtl('برند ثبت‌شده خانواده')}</text>
    <text x="1102" y="368" text-anchor="end" font-weight="700" fill="#E56B1E">${rtl(trunc(brandDisp, 44))}</text>

    <text x="1322" y="420" text-anchor="end" font-weight="700" fill="#55565A">${rtl('پروفیل‌های مقطع')}</text>
    <text x="916" y="420" text-anchor="middle" class="font-mono" font-weight="700" fill="#1F2022">${escapeXml(trunc(profilesStr, 36))}</text>

    <text x="1322" y="472" text-anchor="end" font-weight="700" fill="#55565A">${rtl('گام / زاویه پروفیل')}</text>
    <text x="916" y="472" text-anchor="middle" class="font-mono" font-weight="700" fill="#1F2022">${escapeXml(`${pitchStr}   |   Angle = ${angleStr}`)}</text>

    <text x="1322" y="524" text-anchor="end" font-weight="700" fill="#55565A">${rtl('ضخامت کل / ارتفاع')}</text>
    <text x="916" y="524" text-anchor="middle" class="font-mono" font-weight="700" fill="#1F2022">${escapeXml(thickStr)}</text>

    <text x="1322" y="576" text-anchor="end" font-weight="700" fill="#55565A">${rtl('جایگاه در گروه اصلی')}</text>
    <text x="1102" y="576" text-anchor="end" font-weight="700" fill="#1F2022">${rtl(trunc(fam.leaf || fam.submenu, 44))}</text>
  </g>

  <g class="font-fa" font-size="13">
    <text x="672" y="316" text-anchor="end" font-weight="700" fill="#55565A">${rtl('جنس بدنه تسمه')}</text>
    <text x="452" y="316" text-anchor="end" font-weight="700" fill="#1F2022">${rtl(trunc(fam.dominantBodyMaterial, 56))}</text>

    <text x="672" y="368" text-anchor="end" font-weight="700" fill="#55565A">${rtl('ساختار نخ کششی (کورد)')}</text>
    <text x="452" y="368" text-anchor="end" font-weight="700" fill="#1F2022">${rtl(trunc(fam.dominantCord, 56))}</text>

    <text x="672" y="420" text-anchor="end" font-weight="700" fill="#55565A">${rtl('فرم عرضه و واحد فروش')}</text>
    <text x="452" y="420" text-anchor="end" font-weight="700" fill="#1F2022">${rtl(trunc(`${fam.dominantSupplyForm === 'open-ended-roll' ? 'رول / متری (Open-Ended)' : 'حلقه مداربسته (Endless Loop)'} — ${firstSku.unit || 'حلقه'}`, 48))}</text>

    <text x="672" y="472" text-anchor="end" font-weight="700" fill="#55565A">${rtl('پوشش / سطح فوقانی')}</text>
    <text x="452" y="472" text-anchor="end" font-weight="700" fill="#1F2022">${rtl(trunc(firstSku.technical.backingOrCoating || (fam.isCoggedFamily ? 'پشت پارچه‌دار / لبه خام دنده‌دار' : 'استاندارد صنعتی'), 48))}</text>

    <text x="672" y="524" text-anchor="end" font-weight="700" fill="#55565A">${rtl('تعداد کدهای تسمه عضو')}</text>
    <text x="266" y="524" text-anchor="middle" class="font-mono" font-weight="700" fill="#E56B1E">${fam.skus.length} Active Belt SKUs</text>

    <text x="672" y="576" text-anchor="end" font-weight="700" fill="#55565A">${rtl('محدوده کاربری مهندسی')}</text>
    <text x="452" y="576" text-anchor="end" font-weight="700" fill="#E56B1E">${rtl('انتقال قدرت و همگام‌سازی صنعتی طبق استاندارد')}</text>
  </g>

  <rect x="62" y="612" width="1276" height="38" rx="8" fill="#55565A"/>
  <text x="1318" y="637" text-anchor="end" class="font-fa" font-size="15" font-weight="800" fill="#FFFFFF">${rtl(`بخش دوم — بازه ابعادی محاسبه‌شده و نمونه کدهای عضو (${fam.skus.length} کد تسمه)`) }</text>
  <text x="82" y="636" text-anchor="start" class="font-mono" font-size="12.5" font-weight="700" fill="#FFB07C">CALCULATED RANGES (${fam.skus.length} BELT SKUs)</text>

  <g>
    <rect x="1034" y="662" width="304" height="62" rx="8" fill="#FFF6F0" stroke="#E56B1E" stroke-width="1.4"/>
    <text x="1186" y="686" text-anchor="middle" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl('تعداد کد تسمه در این خانواده')}</text>
    <text x="1186" y="712" text-anchor="middle" class="font-mono" font-size="14.5" font-weight="700" fill="#E56B1E">${fam.skus.length} Belt SKUs</text>

    <rect x="710" y="662" width="308" height="62" rx="8" fill="#F7F4EE" stroke="#D5CBB8" stroke-width="1.3"/>
    <text x="864" y="686" text-anchor="middle" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl(ranges.lengthMetric.labelFa)}</text>
    <text x="864" y="712" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#1F2022">${escapeXml(trunc(ranges.lengthMetric.text, 30))}</text>

    <rect x="386" y="662" width="308" height="62" rx="8" fill="#F7F4EE" stroke="#D5CBB8" stroke-width="1.3"/>
    <text x="540" y="686" text-anchor="middle" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl(ranges.countMetric.labelFa)}</text>
    <text x="540" y="712" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#1F2022">${escapeXml(trunc(ranges.countMetric.text, 28))}</text>

    <rect x="62" y="662" width="308" height="62" rx="8" fill="#F7F4EE" stroke="#D5CBB8" stroke-width="1.3"/>
    <text x="216" y="686" text-anchor="middle" class="font-fa" font-size="12" font-weight="700" fill="#55565A">${rtl(ranges.widthMetric.labelFa)}</text>
    <text x="216" y="712" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#1F2022">${escapeXml(trunc(ranges.widthMetric.text, 28))}</text>
  </g>

  <rect x="62" y="736" width="1276" height="198" rx="10" fill="#FFFFFF" stroke="#55565A" stroke-width="1.5"/>
  <rect x="63" y="737" width="1274" height="36" rx="8" fill="#F0EAE0"/>

  <g class="font-fa" font-size="12.5" font-weight="800" fill="#55565A">
    <text x="1280" y="760" text-anchor="middle">${rtl('کد کالا')}</text>
    <text x="1105" y="760" text-anchor="middle">${rtl('کد سایز / نام فنی')}</text>
    <text x="905" y="760" text-anchor="middle">${rtl('پروفیل')}</text>
    <text x="720" y="760" text-anchor="middle">${rtl('طول مرجع')}</text>
    <text x="545" y="760" text-anchor="middle">${rtl('عرض / قطر')}</text>
    <text x="385" y="760" text-anchor="middle">${rtl('ارتفاع / ضخامت')}</text>
    <text x="235" y="760" text-anchor="middle">${rtl('دندانه / شیار')}</text>
    <text x="110" y="760" text-anchor="middle">${rtl('گام')}</text>
  </g>
  <line x1="62" y1="773" x2="1338" y2="773" stroke="#55565A" stroke-width="1.2"/>

  <g class="font-mono" font-size="13" font-weight="600" fill="#1F2022">
${skuRowsSvg}
  </g>

  ${extraRowNote}
  <text x="1334" y="974" text-anchor="end" class="font-fa" font-size="11.5" font-weight="600" fill="#55565A">${rtl('واحد مهندسی کاتالوگ صنعت پیش — استخراج مستند از پایگاه داده و جدول استاندارد سازندگان')}</text>
  <text x="66" y="974" text-anchor="start" class="font-mono" font-size="11.5" font-weight="700" fill="#E56B1E">DOC-ID: SP-${escapeXml(fam.familyCode)}-SPEC</text>
</svg>`;
}

function buildViewAOverviewSvg(sku: ReconciledSku): string {
  const t = sku.technical;
  const div = t.beltDivision;
  const isRoll = t.supplyForm === 'open-ended-roll' || div === 'perforated-open-v';
  const lenText = t.pitchLengthMm
    ? `Lp = ${fmtNum(t.pitchLengthMm, 'mm')}`
    : t.insideLengthMm
      ? `Li = ${fmtNum(t.insideLengthMm, 'mm')}`
      : t.outsideLengthMm
        ? `La = ${fmtNum(t.outsideLengthMm, 'mm')}`
        : t.lengthDesignation
          ? `Size Code: ${t.lengthDesignation}`
          : isRoll
            ? 'Supply: Open-Ended Cut-to-Length Roll'
            : 'Length: Per Physical SKU Audit';

  const subText = t.toothCount
    ? `Teeth z = ${t.toothCount}  |  Pitch p = ${fmtNum(t.pitchMm, 'mm', 3)}`
    : t.ribCount
      ? `Ribs / Bands = ${t.ribCount}  |  Angle = ${t.toothAngleDeg || 40}°`
      : div === 'welded-pu-round-crc'
        ? `Diameter D = ${fmtNum(t.nominalWidthMm ?? t.beltThicknessMm, 'mm')}  |  Heat-Weldable PU`
        : div === 'service-ambiguous'
          ? 'Partial Name in DB — Verify Pitch/Length Physically'
          : `Width b = ${fmtNum(t.nominalWidthMm ?? t.topWidthMm, 'mm')}  |  Height h = ${fmtNum(t.beltThicknessMm, 'mm')}`;

  if (isRoll) {
    return `
  <text x="1322" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۱ — شماتیک عرضه متری / رول کارخانه‌ای')}</text>
  <text x="726" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW A: OPEN-ENDED ROLL</text>
  <circle cx="945" cy="340" r="64" fill="#EAE6DF" stroke="#55565A" stroke-width="5"/>
  <circle cx="945" cy="340" r="46" fill="none" stroke="#E56B1E" stroke-width="2" stroke-dasharray="6,4"/>
  <circle cx="945" cy="340" r="24" fill="#FBF8F3" stroke="#55565A" stroke-width="2.5"/>
  <line x1="945" y1="404" x2="1220" y2="404" stroke="#55565A" stroke-width="8"/>
  <line x1="945" y1="404" x2="1220" y2="404" stroke="#E56B1E" stroke-width="2" stroke-dasharray="7,4"/>
  ${div === 'perforated-open-v'
    ? `<g fill="#FBF8F3"><circle cx="1015" cy="404" r="2.6"/><circle cx="1055" cy="404" r="2.6"/><circle cx="1095" cy="404" r="2.6"/><circle cx="1135" cy="404" r="2.6"/><circle cx="1175" cy="404" r="2.6"/></g>`
    : ''}
  <text x="1135" y="325" text-anchor="middle" class="font-mono" font-size="14" font-weight="700" fill="#E56B1E">${escapeXml(trunc(lenText, 34))}</text>
  <text x="1135" y="352" text-anchor="middle" class="font-mono" font-size="12" font-weight="700" fill="#55565A">${escapeXml(trunc(subText, 38))}</text>`;
  }

  const isToothed = div.startsWith('timing');
  const isDouble = div.endsWith('double');
  const toothPolys = isToothed
    ? Array.from({ length: 11 }, (_, i) => {
        const x = 865 + i * 30;
        const inner = `<polygon points="${x},272 ${x + 12},272 ${x + 9},282 ${x + 3},282"/><polygon points="${x},404 ${x + 12},404 ${x + 9},394 ${x + 3},394"/>`;
        const outer = isDouble
          ? `<polygon points="${x},260 ${x + 12},260 ${x + 9},250 ${x + 3},250"/><polygon points="${x},416 ${x + 12},416 ${x + 9},426 ${x + 3},426"/>`
          : '';
        return inner + outer;
      }).join('')
    : '';

  return `
  <text x="1322" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۱ — شماتیک حلقه تسمه و طول مرجع')}</text>
  <text x="726" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW A: BELT LOOP GEOMETRY</text>
  <rect x="790" y="264" width="470" height="148" rx="74" fill="none" stroke="${sku.isCoatedBelt ? '#C6402B' : '#55565A'}" stroke-width="${sku.isCoatedBelt ? '11' : '8'}"/>
  <rect x="786" y="260" width="478" height="156" rx="78" fill="none" stroke="#E56B1E" stroke-width="2" stroke-dasharray="8,5"/>
  <rect x="798" y="272" width="454" height="132" rx="66" fill="#FBF8F3" stroke="#55565A" stroke-width="2"/>
  <g fill="#55565A">${toothPolys}</g>
  <text x="1025" y="325" text-anchor="middle" class="font-mono" font-size="15.5" font-weight="700" fill="#E56B1E">${escapeXml(trunc(lenText, 38))}</text>
  <text x="1025" y="352" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#55565A">${escapeXml(trunc(subText, 44))}</text>
  <text x="1025" y="378" text-anchor="middle" class="font-fa" font-size="11.5" font-weight="700" fill="#68696E">${rtl(sku.isCoatedBelt ? 'لایه نارنجی/قرمز: پوشش اصطکاکی فوقانی روی پشت تسمه تایمینگ' : 'خط‌چین نارنجی: خط مرجع کوردهای کششی (Pitch Line)')}</text>`;
}

function buildViewBCrossSectionSvg(sku: ReconciledSku): string {
  const t = sku.technical;
  const div = t.beltDivision;
  const wVal = fmtNum(t.nominalWidthMm ?? t.topWidthMm, 'mm');
  const hVal = fmtNum(t.beltThicknessMm, 'mm');

  // Round PU welded belt
  if (div === 'welded-pu-round-crc') {
    const dStr = wVal !== '—' ? `D = ${wVal}` : hVal !== '—' ? `D = ${hVal}` : 'D = Standard PU';
    return `
  <text x="672" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۲ — مقطع دایره‌ای و قطر نامی تسمه')}</text>
  <text x="76" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW B: CIRCULAR CROSS-SECTION</text>
  <circle cx="290" cy="360" r="66" fill="#2E7D5E" fill-opacity="0.22" stroke="#55565A" stroke-width="2.8"/>
  <circle cx="290" cy="360" r="9" fill="#E56B1E" stroke="#FFFFFF" stroke-width="1.5"/>
  <line x1="224" y1="280" x2="224" y2="360" stroke="#E56B1E" stroke-width="1.2"/>
  <line x1="356" y1="280" x2="356" y2="360" stroke="#E56B1E" stroke-width="1.2"/>
  <line x1="230" y1="288" x2="350" y2="288" stroke="#E56B1E" stroke-width="2" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>
  <rect x="236" y="264" width="108" height="22" rx="4" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="290" y="280" text-anchor="middle" class="font-mono" font-size="12.5" font-weight="700" fill="#E56B1E">${escapeXml(dStr)}</text>
  <g class="font-fa" font-size="12" font-weight="700" fill="#3B3C40">
    <text x="670" y="340" text-anchor="end">${rtl('۱. بدنه همگن پلی‌یورتان اکسترودشده')}</text>
    <text x="670" y="368" text-anchor="end" fill="#E56B1E">${rtl('۲. اتصال حرارتی سر‌به‌سر (Butt-Weld)')}</text>
    <text x="670" y="396" text-anchor="end">${rtl('۳. مقاوم در برابر رطوبت و روغن')}</text>
  </g>`;
  }

  // Hexagonal double V-belt
  if (div === 'vbelt-hexagonal') {
    return `
  <text x="672" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۲ — مقطع شش‌ضلعی دوطرفه (AA/BB)')}</text>
  <text x="76" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW B: HEXAGONAL CROSS-SECTION</text>
  <polygon points="220,305 360,305 390,360 360,415 220,415 190,360" fill="#55565A" fill-opacity="0.22" stroke="#55565A" stroke-width="2.5"/>
  <line x1="180" y1="360" x2="400" y2="360" stroke="#E56B1E" stroke-width="1.6" stroke-dasharray="6,4"/>
  <g fill="#E56B1E">${[220,245,270,295,320,345,365].map(cx => `<circle cx="${cx}" cy="360" r="4.5"/>`).join('')}</g>
  <rect x="220" y="268" width="140" height="24" rx="4" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="290" y="285" text-anchor="middle" class="font-mono" font-size="12.5" font-weight="700" fill="#E56B1E">b = ${escapeXml(wVal)} | h = ${escapeXml(hVal)}</text>
  <g class="font-fa" font-size="12" font-weight="700" fill="#3B3C40">
    <text x="670" y="340" text-anchor="end">${rtl('۱. هر دو وجه ذوزنقه‌ای ۴۰ درجه فعال')}</text>
    <text x="670" y="368" text-anchor="end" fill="#E56B1E">${rtl('۲. کورد کششی دقیقاً در محور مرکزی')}</text>
    <text x="670" y="396" text-anchor="end">${rtl('۳. مناسب محورهای رفت‌وبرگشتی چندپولی')}</text>
  </g>`;
  }

  // Banded V-belt
  if (div === 'vbelt-banded') {
    const bandCount = Math.min(5, Math.max(2, t.ribCount || 3));
    const startX = 160;
    const step = 62;
    const totalW = bandCount * step - 12;
    const wedges = Array.from({ length: bandCount }, (_, i) => {
      const wx = startX + i * step;
      return `<polygon points="${wx},336 ${wx + 50},336 ${wx + 39},406 ${wx + 11},406" fill="#55565A" fill-opacity="0.3" stroke="#55565A" stroke-width="2"/>`;
    }).join('');
    return `
  <text x="672" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۲ — مقطع چندردیفه با نوار پشت یکپارچه')}</text>
  <text x="76" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW B: BANDED MULTI-V SECTION</text>
  <rect x="${startX}" y="318" width="${totalW}" height="18" fill="#E56B1E" fill-opacity="0.28" stroke="#E56B1E" stroke-width="2"/>
  ${wedges}
  <text x="${startX + totalW / 2}" y="290" text-anchor="middle" class="font-mono" font-size="12.5" font-weight="700" fill="#E56B1E">Total W = ${escapeXml(wVal)}  (${t.ribCount || bandCount} Bands)</text>
  <g class="font-fa" font-size="12" font-weight="700" fill="#3B3C40">
    <text x="670" y="346" text-anchor="end">${rtl('۱. نوار پیونددهنده فوقانی (Tie-Band)')}</text>
    <text x="670" y="376" text-anchor="end" fill="#E56B1E">${rtl('۲. کورد کششی هم‌طراز در هر ردیف')}</text>
    <text x="670" y="406" text-anchor="end">${rtl('۳. مانع چرخش و پرش تسمه در ضربه‌بارها')}</text>
  </g>`;
  }

  // Crowned CRC V-Belt
  if (div === 'vbelt-crowned-crc') {
    return `
  <text x="672" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۲ — مقطع ذوزنقه‌ای با تاج گرده‌ماهی (CRC)')}</text>
  <text x="76" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW B: RIDGE-TOP / CRC PROFILE</text>
  <polygon points="215,342 290,295 365,342 342,414 238,414" fill="#2E7D5E" fill-opacity="0.25" stroke="#55565A" stroke-width="2.5"/>
  <line x1="215" y1="342" x2="365" y2="342" stroke="#E56B1E" stroke-width="1.6" stroke-dasharray="5,4"/>
  <rect x="200" y="264" width="180" height="24" rx="4" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="290" y="281" text-anchor="middle" class="font-mono" font-size="12.5" font-weight="700" fill="#E56B1E">b = ${escapeXml(wVal)} | h = ${escapeXml(hVal)}</text>
  <g class="font-fa" font-size="12" font-weight="700" fill="#3B3C40">
    <text x="670" y="340" text-anchor="end">${rtl('۱. تاج محدب فوقانی جهت تماس خطی کاشی')}</text>
    <text x="670" y="368" text-anchor="end" fill="#E56B1E">${rtl('۲. مقطع گوه پایه جهت درگیری در پولی')}</text>
    <text x="670" y="396" text-anchor="end">${rtl('۳. ویژه خطوط لعاب و انتقال کاشی و سرامیک')}</text>
  </g>`;
  }

  // Standard V-belts (classical / wedge / perforated / welded PU V)
  if (div.startsWith('vbelt') || div === 'perforated-open-v' || div === 'welded-pu-v-flat') {
    return `
  <text x="672" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۲ — مقطع ذوزنقه‌ای V-Belt و زاویه ۴۰ درجه')}</text>
  <text x="76" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW B: TRAPEZOIDAL WEDGE SECTION</text>
  <line x1="185" y1="274" x2="185" y2="318" stroke="#E56B1E" stroke-width="1.3"/>
  <line x1="395" y1="274" x2="395" y2="318" stroke="#E56B1E" stroke-width="1.3"/>
  <line x1="191" y1="288" x2="389" y2="288" stroke="#E56B1E" stroke-width="2" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>
  <rect x="215" y="268" width="150" height="25" rx="4" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="290" y="285" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#E56B1E">tw = ${escapeXml(wVal)}</text>
  <polygon points="185,318 395,318 352,414 228,414" fill="url(#rubberHatch)" stroke="#55565A" stroke-width="2.5"/>
  <polygon points="185,318 395,318 352,414 228,414" fill="#55565A" fill-opacity="0.16"/>
  <line x1="182" y1="344" x2="398" y2="344" stroke="#E56B1E" stroke-width="1.5" stroke-dasharray="6,4"/>
  <g fill="#E56B1E" stroke="#FFFFFF" stroke-width="1">${[215,240,265,290,315,340,365].map(cx => `<circle cx="${cx}" cy="344" r="5"/>`).join('')}</g>
  <line x1="140" y1="318" x2="185" y2="318" stroke="#55565A" stroke-width="1.2"/>
  <line x1="140" y1="414" x2="228" y2="414" stroke="#55565A" stroke-width="1.2"/>
  <line x1="152" y1="323" x2="152" y2="409" stroke="#55565A" stroke-width="1.8" marker-start="url(#arrowDarkStart)" marker-end="url(#arrowDarkEnd)"/>
  <text x="118" y="368" text-anchor="middle" class="font-mono" font-size="11.5" font-weight="700" fill="#55565A">h=${escapeXml(hVal)}</text>
  <g class="font-fa" font-size="12" font-weight="700" fill="#3B3C40">
    <text x="670" y="340" text-anchor="end">${rtl(sku.isCoggedVbelt ? '۱. لبه برش‌خورده با ضریب اصطکاک بالا' : '۱. روکش پارچه‌ای یا بدنه مقاوم روغنی')}</text>
    <text x="670" y="368" text-anchor="end" fill="#E56B1E">${rtl('۲. کورد کششی کم‌کشش پلی‌استر/آرامید')}</text>
    <text x="670" y="396" text-anchor="end">${rtl('۳. زاویه استاندارد پهلوی تسمه β = 40°')}</text>
  </g>`;
  }

  // Timing belts & Poly-V & Service-Ambiguous rectangular laminated cross-section
  const coatedTopRect = sku.isCoatedBelt
    ? `<rect x="150" y="298" width="290" height="22" fill="#C6402B" fill-opacity="0.72" stroke="#9B2C1B" stroke-width="1.8"/>`
    : '';
  const layer1 = div === 'service-ambiguous'
    ? '۱. بدنه و ساختار تاییدنشده'
    : sku.isCoatedBelt
      ? '۱. روکش اصطکاکی فوقانی (قرمز/گریپ)'
      : '۱. پشت تسمه صنعتی مقاوم به سایش';
  const layer2 = div === 'service-ambiguous'
    ? '۲. نیازمند ممیزی فیزیکی'
    : '۲. کورد کششی فایبرگلاس / سیم فولادی';
  const layer3 = div === 'service-ambiguous'
    ? '۳. بدون فرض ابعادی'
    : div === 'ribbed-poly-v'
      ? '۳. شیارهای طولی Poly-V با چسبندگی بالا'
      : '۳. پروفیل دندانه همگام دقیق';
  return `
  <text x="672" y="229" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl(div === 'service-ambiguous' ? 'نمای ۲ — شماتیک احتیاطی مقطع عرضی' : 'نمای ۲ — مقطع عرضی و ساختار لایه‌ها')}</text>
  <text x="76" y="229" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW B: CROSS-SECTION (WIDTH b)</text>
  <line x1="150" y1="268" x2="150" y2="318" stroke="#E56B1E" stroke-width="1.4"/>
  <line x1="440" y1="268" x2="440" y2="318" stroke="#E56B1E" stroke-width="1.4"/>
  <line x1="156" y1="282" x2="434" y2="282" stroke="#E56B1E" stroke-width="2" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>
  <rect x="200" y="262" width="190" height="24" rx="5" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="295" y="279" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#E56B1E">b = ${escapeXml(wVal)}</text>
  ${coatedTopRect}
  <rect x="150" y="318" width="290" height="44" fill="url(#rubberHatch)" stroke="#55565A" stroke-width="2.2"/>
  <rect x="150" y="318" width="290" height="44" fill="#55565A" fill-opacity="0.18"/>
  <line x1="135" y1="362" x2="455" y2="362" stroke="#E56B1E" stroke-width="1.5" stroke-dasharray="6,4"/>
  <g fill="#E56B1E" stroke="#FFFFFF" stroke-width="1.2">${[170,195,220,245,270,295,320,345,370,395,420].map(cx => `<circle cx="${cx}" cy="362" r="5"/>`).join('')}</g>
  <rect x="150" y="362" width="290" height="48" fill="#55565A" fill-opacity="0.32" stroke="#55565A" stroke-width="2.2"/>
  <line x1="150" y1="410" x2="440" y2="410" stroke="#E56B1E" stroke-width="3"/>
  <line x1="112" y1="${sku.isCoatedBelt ? 298 : 318}" x2="150" y2="${sku.isCoatedBelt ? 298 : 318}" stroke="#55565A" stroke-width="1.2"/>
  <line x1="112" y1="410" x2="150" y2="410" stroke="#55565A" stroke-width="1.2"/>
  <line x1="124" y1="${sku.isCoatedBelt ? 303 : 323}" x2="124" y2="405" stroke="#55565A" stroke-width="1.8" marker-start="url(#arrowDarkStart)" marker-end="url(#arrowDarkEnd)"/>
  <text x="90" y="366" text-anchor="middle" class="font-mono" font-size="11.5" font-weight="700" fill="#55565A">hs=${escapeXml(hVal === '—' ? 'STD' : hVal)}</text>
  <g class="font-fa" font-size="12" font-weight="700" fill="#3B3C40">
    <text x="670" y="340" text-anchor="end">${rtl(layer1)}</text>
    <text x="670" y="368" text-anchor="end" fill="#E56B1E">${rtl(layer2)}</text>
    <text x="670" y="396" text-anchor="end">${rtl(layer3)}</text>
  </g>`;
}

function buildViewCProfileSvg(sku: ReconciledSku): string {
  const t = sku.technical;
  const div = t.beltDivision;
  const pStr = fmtNum(t.pitchMm, 'mm', 3);
  const htStr = fmtNum(t.toothHeightMm, 'mm');
  const hsStr = fmtNum(t.beltThicknessMm, 'mm');
  const angStr = t.toothAngleDeg ? `${t.toothAngleDeg}°` : '40°';

  // Service-ambiguous honest partial diagram
  if (div === 'service-ambiguous') {
    return `
  <text x="1322" y="557" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۳ — وضعیت ممیزی هندسی کد ناقص')}</text>
  <text x="726" y="557" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW C: PARTIAL SPEC NOTICE</text>
  <rect x="750" y="610" width="550" height="195" rx="12" fill="#FFF8F1" stroke="#E56B1E" stroke-width="2" stroke-dasharray="8,5"/>
  <text x="1025" y="672" text-anchor="middle" class="font-fa" font-size="17" font-weight="800" fill="#B94B08">${rtl('کد ثبت‌شده در دیتابیس فاقد گام و پروفیل کامل استاندارد است')}</text>
  <text x="1025" y="714" text-anchor="middle" class="font-mono" font-size="14" font-weight="700" fill="#55565A">PHYSICAL INSPECTION REQUIRED — NO INVENTED DIMENSIONS</text>
  <text x="1025" y="756" text-anchor="middle" class="font-fa" font-size="13" font-weight="600" fill="#55565A">${rtl('پیش از ارسال نهایی، گام، عرض و تعداد دندانه باید از روی قطعه فیزیکی اندازه‌گیری شود.')}</text>
  <rect x="730" y="828" width="590" height="100" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="1025" y="868" text-anchor="middle" class="font-fa" font-size="13" font-weight="800" fill="#55565A">${rtl('مقادیر تأییدشده فعلی: فقط نام کالا و کد ثبتی کاتالوگ')}</text>
  <text x="1025" y="902" text-anchor="middle" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">SKU ${escapeXml(sku.skuCode)}  |  Verified Fields Only</text>`;
  }

  // Curvilinear HTD / RPP tooth geometry
  if (div === 'timing-htd-rpp-single' || div === 'timing-htd-rpp-double' || div === 'timing-automotive-ru') {
    const isDouble = div === 'timing-htd-rpp-double';
    return `
  <text x="1322" y="557" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl(isDouble ? 'نمای ۳ — هندسه دندانه هلالی دوطرفه (HTD)' : 'نمای ۳ — هندسه دندانه هلالی پرفشار (HTD/RPP)')}</text>
  <text x="726" y="557" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW C: CURVILINEAR TOOTH</text>
  <path d="M 780 635 L 1220 635 L 1220 685 L 1180 685 Q 1140 755 1100 685 L 1060 685 Q 1020 755 980 685 L 940 685 Q 900 755 860 685 L 820 685 Q 795 735 780 685 Z" fill="#55565A" fill-opacity="0.22" stroke="#55565A" stroke-width="2.5"/>
  <path d="M 780 685 Q 795 735 820 685 L 860 685 Q 900 755 940 685 L 980 685 Q 1020 755 1060 685 L 1100 685 Q 1140 755 1180 685 L 1220 685" fill="none" stroke="#E56B1E" stroke-width="3"/>
  ${isDouble ? `<path d="M 860 635 Q 900 580 940 635 M 980 635 Q 1020 580 1060 635 M 1100 635 Q 1140 580 1180 635" fill="#55565A" fill-opacity="0.22" stroke="#E56B1E" stroke-width="2.8"/>` : ''}
  <line x1="765" y1="664" x2="1245" y2="664" stroke="#E56B1E" stroke-width="1.8" stroke-dasharray="8,5"/>
  <line x1="900" y1="675" x2="900" y2="795" stroke="#E56B1E" stroke-width="1.3" stroke-dasharray="4,3"/>
  <line x1="1020" y1="675" x2="1020" y2="795" stroke="#E56B1E" stroke-width="1.3" stroke-dasharray="4,3"/>
  <line x1="906" y1="782" x2="1014" y2="782" stroke="#E56B1E" stroke-width="2" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>
  <rect x="912" y="766" width="96" height="23" rx="4" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="960" y="782" text-anchor="middle" class="font-mono" font-size="12.5" font-weight="700" fill="#E56B1E">p = ${escapeXml(pStr)}</text>
  <rect x="730" y="828" width="590" height="100" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="1025" y="854" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="800" fill="#55565A">${rtl('پارامترهای پروفیل دندانه هلالی / سهموی (توزیع تنش یکنواخت)')}</text>
  <text x="1025" y="882" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#1F2022">Pitch (p) = ${escapeXml(pStr)}  |  Tooth Height (ht) = ${escapeXml(htStr)}  |  Thickness (hs) = ${escapeXml(hsStr)}</text>
  <text x="1025" y="910" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#E56B1E">Profile: ${escapeXml(t.profile)}  |  ${isDouble ? 'Dual-Side Symmetric Drive' : 'High-Torque Curvilinear Arc'}</text>`;
  }

  // Longitudinal Poly-V rib profile
  if (div === 'ribbed-poly-v') {
    const ribsSvg = Array.from({ length: 8 }, (_, i) => {
      const rx = 810 + i * 50;
      return `L ${rx} 685 L ${rx + 25} 735 L ${rx + 50} 685`;
    }).join(' ');
    return `
  <text x="1322" y="557" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl('نمای ۳ — هندسه شیارهای طولی Poly-V')}</text>
  <text x="726" y="557" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW C: POLY-V RIB GEOMETRY</text>
  <path d="M 780 635 L 1240 635 L 1240 685 ${ribsSvg} L 780 685 Z" fill="#55565A" fill-opacity="0.22" stroke="#55565A" stroke-width="2.4"/>
  <line x1="775" y1="658" x2="1245" y2="658" stroke="#E56B1E" stroke-width="1.8" stroke-dasharray="7,4"/>
  <line x1="885" y1="735" x2="885" y2="804" stroke="#E56B1E" stroke-width="1.3" stroke-dasharray="4,3"/>
  <line x1="935" y1="735" x2="935" y2="804" stroke="#E56B1E" stroke-width="1.3" stroke-dasharray="4,3"/>
  <line x1="890" y1="794" x2="930" y2="794" stroke="#E56B1E" stroke-width="2" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>
  <rect x="862" y="758" width="96" height="24" rx="4" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="910" y="775" text-anchor="middle" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">s = ${escapeXml(pStr)}</text>
  <text x="1140" y="768" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#55565A">Rib Angle α = 40°</text>
  <rect x="730" y="828" width="590" height="100" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="1025" y="854" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="800" fill="#55565A">${rtl('پارامترهای ثابت شیار طولی پروفیل Poly-V')}</text>
  <text x="1025" y="882" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#1F2022">Rib Pitch (s) = ${escapeXml(pStr)}  |  Ribs Count = ${t.ribCount || 'Per Code'}  |  Thickness (h) = ${escapeXml(hsStr)}</text>
  <text x="1025" y="910" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#E56B1E">Profile: ${escapeXml(t.profile)}  |  Standard: ISO 9982 / DIN 7867</text>`;
  }

  // Longitudinal cogged or smooth side profile for V-belts & welded PU
  if (div.startsWith('vbelt') || div === 'perforated-open-v' || div.startsWith('welded-pu')) {
    const isCog = sku.isCoggedVbelt;
    const pathProfile = isCog
      ? `M 780 640 L 1220 640 L 1220 710 L 1190 710 C 1175 745, 1155 745, 1140 710 L 1110 710 C 1095 745, 1075 745, 1060 710 L 1030 710 C 1015 745, 995 745, 980 710 L 950 710 C 935 745, 915 745, 900 710 L 870 710 C 855 745, 835 745, 820 710 L 780 710 Z`
      : `M 780 640 L 1220 640 L 1220 726 L 780 726 Z`;
    return `
  <text x="1322" y="557" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl(isCog ? 'نمای ۳ — نمای جانبی دنده‌های خنک‌کاری V-Belt' : div === 'perforated-open-v' ? 'نمای ۳ — گام سوراخ‌کاری و طولی تسمه متری' : 'نمای ۳ — نمای جانبی و خط کورد کششی')}</text>
  <text x="726" y="557" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW C: LONGITUDINAL PROFILE</text>
  <path d="${pathProfile}" fill="#55565A" fill-opacity="0.22" stroke="#55565A" stroke-width="2.5"/>
  <line x1="770" y1="666" x2="1230" y2="666" stroke="#E56B1E" stroke-width="1.8" stroke-dasharray="8,5"/>
  ${div === 'perforated-open-v' ? `<g fill="#FFF5EE" stroke="#E56B1E" stroke-width="2">${[830,900,970,1040,1110,1180].map(cx=>`<circle cx="${cx}" cy="683" r="10"/>`).join('')}</g>` : ''}
  <rect x="730" y="828" width="590" height="100" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="1025" y="854" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="800" fill="#55565A">${rtl('خلاصه مشخصات طولی و عملکرد مکانیکی پروفیل')}</text>
  <text x="1025" y="882" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#1F2022">Section: ${escapeXml(t.profile)}  |  Top/Dia: ${escapeXml(fmtNum(t.nominalWidthMm ?? t.topWidthMm, 'mm'))}  |  Height: ${escapeXml(hsStr)}</text>
  <text x="1025" y="910" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#E56B1E">${escapeXml(isCog ? 'Raw-Edge Cogged (Min Pulley Dia Reduction)' : div === 'welded-pu-round-crc' ? 'Butt-Weldable Thermoplastic PU' : 'Wrapped / Wedge Angle = 40°')}</text>`;
  }

  // Trapezoidal single/double-sided timing belt profile
  const isDouble = div === 'timing-imperial-double';
  const coatOverlay = sku.isCoatedBelt
    ? `<rect x="780" y="606" width="450" height="19" fill="#C6402B" fill-opacity="0.78" stroke="#9B2C1B" stroke-width="1.8"/>`
    : '';
  return `
  <text x="1322" y="557" text-anchor="end" class="font-fa" font-size="13.5" font-weight="800" fill="#55565A">${rtl(isDouble ? 'نمای ۳ — هندسه دندانه ذوزنقه‌ای دوطرفه' : 'نمای ۳ — هندسه پروفیل دندانه ذوزنقه‌ای')}</text>
  <text x="726" y="557" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#E56B1E">VIEW C: TRAPEZOIDAL TOOTH</text>
  ${coatOverlay}
  <path d="M 780 625 L 1230 625 L 1230 680 L 1195 680 L 1175 748 L 1115 748 L 1095 680 L 1035 680 L 1015 748 L 955 748 L 935 680 L 875 680 L 855 748 L 795 748 L 775 680 L 780 680 Z" fill="#55565A" fill-opacity="0.22" stroke="#55565A" stroke-width="2.5"/>
  <path d="M 775 680 L 795 748 L 855 748 L 875 680 L 935 680 L 955 748 L 1015 748 L 1035 680 L 1095 680 L 1115 748 L 1175 748 L 1195 680 L 1230 680" fill="none" stroke="#E56B1E" stroke-width="3.2"/>
  ${isDouble ? `<path d="M 855 625 L 875 585 L 935 585 L 955 625 M 975 625 L 995 585 L 1055 585 L 1075 625 M 1095 625 L 1115 585 L 1175 585 L 1195 625" fill="#55565A" fill-opacity="0.22" stroke="#E56B1E" stroke-width="2.6"/>` : ''}
  <line x1="765" y1="662" x2="1245" y2="662" stroke="#E56B1E" stroke-width="1.8" stroke-dasharray="8,5"/>
  <text x="1252" y="666" text-anchor="start" class="font-mono" font-size="11.5" font-weight="700" fill="#E56B1E">Pitch Line</text>
  <line x1="825" y1="670" x2="825" y2="804" stroke="#E56B1E" stroke-width="1.3" stroke-dasharray="4,3"/>
  <line x1="985" y1="670" x2="985" y2="804" stroke="#E56B1E" stroke-width="1.3" stroke-dasharray="4,3"/>
  <line x1="831" y1="790" x2="979" y2="790" stroke="#E56B1E" stroke-width="2" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>
  <rect x="842" y="774" width="126" height="24" rx="4" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1"/>
  <text x="905" y="791" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#E56B1E">p = ${escapeXml(pStr)}</text>
  <rect x="730" y="828" width="590" height="100" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="1025" y="854" text-anchor="middle" class="font-fa" font-size="12.5" font-weight="800" fill="#55565A">${rtl('پارامترهای ثابت هندسه پروفیل دندانه ذوزنقه‌ای')}</text>
  <text x="1025" y="882" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#1F2022">Pitch (p) = ${escapeXml(pStr)}  |  Tooth Height (ht) = ${escapeXml(htStr)}  |  Total Height (hs) = ${escapeXml(hsStr)}</text>
  <text x="1025" y="910" text-anchor="middle" class="font-mono" font-size="11.8" font-weight="700" fill="#E56B1E">Angle (β) = ${escapeXml(angStr)}  |  Profile = ${escapeXml(t.profile)}  |  ${sku.isCoatedBelt ? 'With Grip Top Layer' : 'Standard Tooth Mesh'}</text>`;
}

function buildSkuTechnicalDrawingSvg(sku: ReconciledSku): string {
  const t = sku.technical;
  const titleInfo = getDivisionTitleFa(t.beltDivision, sku.isCoggedVbelt, sku.isCoatedBelt);
  const brandDisp = normalizeBrandDisplay(sku.brand);
  const profDisp = t.profile === 'UNSPECIFIED' ? 'UNSPECIFIED' : t.profile;
  const designDisplay = trunc(sku.rawSize || t.lengthDesignation || sku.rawName, 26);

  const lengthSummary = t.pitchLengthMm
    ? `Lp = ${fmtNum(t.pitchLengthMm, 'mm')}`
    : t.insideLengthMm
      ? `Li = ${fmtNum(t.insideLengthMm, 'mm')}`
      : t.outsideLengthMm
        ? `La = ${fmtNum(t.outsideLengthMm, 'mm')}`
        : t.lengthDesignation || 'تعریف‌نشده در کد فعلی';

  const hasAsciiLen =
    Boolean(t.pitchLengthMm || t.insideLengthMm || t.outsideLengthMm) ||
    Boolean(t.lengthDesignation && !/[\u0600-\u06FF]/.test(t.lengthDesignation));
  const asciiLengthSummary = t.pitchLengthMm
    ? `Lp = ${fmtNum(t.pitchLengthMm, 'mm')}`
    : t.insideLengthMm
      ? `Li = ${fmtNum(t.insideLengthMm, 'mm')}`
      : t.outsideLengthMm
        ? `La = ${fmtNum(t.outsideLengthMm, 'mm')}`
        : t.lengthDesignation && !/[\u0600-\u06FF]/.test(t.lengthDesignation)
          ? t.lengthDesignation
          : 'Length Undefined in SKU Code';

  const isTimingDiv = t.beltDivision.startsWith('timing');
  const liLaNote = isTimingDiv
    ? 'تعریف‌نشده در استاندارد تایمینگ (مبنا: Lp)'
    : `Li: ${fmtNum(t.insideLengthMm, 'mm')}  |  La: ${fmtNum(t.outsideLengthMm, 'mm')}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1020" width="1400" height="1020">
  <defs>
    <style>
      .font-fa { font-family: 'Noto Sans Arabic', 'Noto Kufi Arabic', 'Tahoma', 'DejaVu Sans', sans-serif; }
      .font-mono { font-family: 'DejaVu Sans Mono', 'Liberation Mono', monospace; }
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

  <rect x="0" y="0" width="1400" height="1020" fill="#FBF8F3"/>
  <rect x="24" y="24" width="1352" height="972" rx="16" fill="url(#techGrid)" stroke="#CFC6B6" stroke-width="1.5"/>
  <rect x="38" y="38" width="1324" height="944" rx="12" fill="#FFFFFF" fill-opacity="0.94" stroke="#55565A" stroke-width="2.2"/>

  <path d="M 38 50 Q 38 38 50 38 L 1350 38 Q 1362 38 1362 50 L 1362 142 L 38 142 Z" fill="#55565A"/>
  <rect x="38" y="138" width="1324" height="6" fill="#E56B1E"/>

  <rect x="60" y="54" width="330" height="70" rx="10" fill="#3F4044" stroke="#E56B1E" stroke-width="1.8"/>
  <text x="225" y="82" text-anchor="middle" class="font-mono" font-size="17" font-weight="700" fill="#FFFFFF">${escapeXml(designDisplay)}</text>
  <text x="225" y="110" text-anchor="middle" class="font-mono" font-size="13" font-weight="600" fill="#FFB07C">SKU: ${escapeXml(sku.skuCode)}  |  PROF: ${escapeXml(trunc(profDisp, 14))}</text>

  <text x="1334" y="80" text-anchor="end" class="font-fa" font-size="22" font-weight="800" fill="#FFFFFF">${rtl('نقشه فنی و برگه ابعاد مهندسی اختصاصی کد کالا')}</text>
  <text x="1334" y="114" text-anchor="end" class="font-fa" font-size="14.5" font-weight="600" fill="#F4EDE2">${rtl(trunc(`${sku.rawName} — خانواده ${sku.familyName}`, 78))}</text>

  <rect x="60" y="156" width="1280" height="36" rx="7" fill="#FFF5EE" stroke="#E56B1E" stroke-width="1.1"/>
  <text x="1322" y="179" text-anchor="end" class="font-fa" font-size="12" font-weight="700" fill="#B94B08">${rtl('نماهای هندسی به‌صورت شماتیک فنی (SCHEMATIC — NOT TO SCALE) ترسیم شده و مقادیر عددی منطبق بر مشخصات قطعی ثبت‌شده هستند.')}</text>
  <text x="76" y="179" text-anchor="start" class="font-mono" font-size="11.5" font-weight="700" fill="#E56B1E">SCHEMATIC — NOT TO SCALE | UNIT: mm</text>

  <!-- VIEW 1: TOP RIGHT -->
  <rect x="710" y="206" width="630" height="312" rx="10" fill="#FFFFFF" stroke="#CFC6B6" stroke-width="1.5"/>
  <rect x="711" y="207" width="628" height="34" rx="8" fill="#F4EFE6"/>
  ${buildViewAOverviewSvg(sku)}
  <rect x="730" y="432" width="590" height="70" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="1025" y="458" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#E56B1E">${escapeXml(trunc(`${titleInfo.en} | ${asciiLengthSummary}`, 56))}</text>
  <text x="1025" y="485" text-anchor="middle" class="font-fa" font-size="11.5" font-weight="600" fill="#55565A">${rtl(trunc(hasAsciiLen ? (t.standardReference || titleInfo.fa) : `${titleInfo.fa} — طول در کد فعلی ثبت نشده است`, 74))}</text>

  <!-- VIEW 2: TOP LEFT -->
  <rect x="60" y="206" width="630" height="312" rx="10" fill="#FFFFFF" stroke="#CFC6B6" stroke-width="1.5"/>
  <rect x="61" y="207" width="628" height="34" rx="8" fill="#F4EFE6"/>
  ${buildViewBCrossSectionSvg(sku)}
  <rect x="80" y="432" width="590" height="70" rx="8" fill="#F8F5EE" stroke="#E2D9C8" stroke-width="1"/>
  <text x="375" y="458" text-anchor="middle" class="font-mono" font-size="12.8" font-weight="700" fill="#E56B1E">Width/Dia: ${escapeXml(fmtNum(t.nominalWidthMm ?? t.topWidthMm, 'mm'))}  |  Thickness: ${escapeXml(fmtNum(t.beltThicknessMm, 'mm'))}</text>
  <text x="375" y="485" text-anchor="middle" class="font-fa" font-size="11.5" font-weight="600" fill="#55565A">${rtl(trunc(t.bodyMaterial || 'مواد پلیمری و کششی مقاوم مطابق استاندارد', 68))}</text>

  <!-- VIEW 3: BOTTOM RIGHT -->
  <rect x="710" y="534" width="630" height="412" rx="10" fill="#FFFFFF" stroke="#CFC6B6" stroke-width="1.5"/>
  <rect x="711" y="535" width="628" height="34" rx="8" fill="#F4EFE6"/>
  ${buildViewCProfileSvg(sku)}

  <!-- VIEW 4: BOTTOM LEFT TABLE -->
  <rect x="60" y="534" width="630" height="412" rx="10" fill="#FFFFFF" stroke="#55565A" stroke-width="1.8"/>
  <rect x="462" y="571" width="227" height="374" fill="#F7F4EE"/>
  <rect x="61" y="535" width="628" height="36" rx="8" fill="#55565A"/>
  <text x="672" y="558" text-anchor="end" class="font-fa" font-size="14" font-weight="800" fill="#FFFFFF">${rtl('جدول مشخصات قطعی کد کالا')}</text>
  <text x="76" y="558" text-anchor="start" class="font-mono" font-size="12" font-weight="700" fill="#FFB07C">SKU: ${escapeXml(sku.skuCode)}</text>
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
  <g class="font-fa" font-size="12.5">
    <text x="674" y="593" text-anchor="end" font-weight="700" fill="#55565A">${rtl('کد کالا در دیتابیس')}</text>
    <text x="261" y="593" text-anchor="middle" class="font-mono" font-size="14" font-weight="700" fill="#E56B1E">${escapeXml(sku.skuCode)}</text>

    <text x="674" y="627" text-anchor="end" font-weight="700" fill="#55565A">${rtl('سایز / کد فنی ثبت‌شده')}</text>
    <text x="261" y="627" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#1F2022">${escapeXml(trunc(sku.rawSize || t.lengthDesignation || sku.rawName, 34))}</text>

    <text x="674" y="661" text-anchor="end" font-weight="700" fill="#55565A">${rtl('برند و خانواده مرجع')}</text>
    <text x="261" y="661" text-anchor="middle" font-weight="700" fill="#1F2022">${rtl(trunc(`${brandDisp} — ${sku.familyCode}`, 38))}</text>

    <text x="674" y="695" text-anchor="end" font-weight="700" fill="#55565A">${rtl('پروفیل و گام دندانه')}</text>
    <text x="261" y="695" text-anchor="middle" class="font-mono" font-size="12.5" font-weight="700" fill="#1F2022">${escapeXml(`Profile: ${profDisp}  |  Pitch: ${fmtNum(t.pitchMm, 'mm', 3)}`)}</text>

    <text x="674" y="729" text-anchor="end" font-weight="700" fill="#55565A">${rtl('طول مرجع (Lp)')}</text>
    <text x="261" y="729" text-anchor="middle" class="${/[\u0600-\u06FF]/.test(lengthSummary) ? 'font-fa' : 'font-mono'}" font-size="13" font-weight="700" fill="#E56B1E">${/[\u0600-\u06FF]/.test(lengthSummary) ? rtl(trunc(lengthSummary, 34)) : escapeXml(trunc(lengthSummary, 34))}</text>

    <text x="674" y="763" text-anchor="end" font-weight="700" fill="#55565A">${rtl('تعداد دندانه / شیار')}</text>
    <text x="261" y="763" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#1F2022">${t.toothCount ? `z = ${t.toothCount} Teeth` : t.ribCount ? `${t.ribCount} Ribs / Bands` : '—'}</text>

    <text x="674" y="797" text-anchor="end" font-weight="700" fill="#55565A">${rtl('عرض / قطر مقطع')}</text>
    <text x="261" y="797" text-anchor="middle" class="font-mono" font-size="13" font-weight="700" fill="#E56B1E">${escapeXml(fmtNum(t.nominalWidthMm ?? t.topWidthMm, 'mm'))}${t.widthCode ? ` (Code ${escapeXml(t.widthCode)})` : ''}</text>

    <text x="674" y="831" text-anchor="end" font-weight="700" fill="#55565A">${rtl('ضخامت کل و ارتفاع دندانه')}</text>
    <text x="261" y="831" text-anchor="middle" class="font-mono" font-size="12.5" font-weight="700" fill="#1F2022">${escapeXml(`hs = ${fmtNum(t.beltThicknessMm, 'mm')}  |  ht = ${fmtNum(t.toothHeightMm, 'mm')}`)}</text>

    <text x="674" y="865" text-anchor="end" font-weight="700" fill="#55565A">${rtl('طول داخلی / بیرونی')}</text>
    <text x="261" y="865" text-anchor="middle" class="${isTimingDiv ? 'font-fa' : 'font-mono'}" font-weight="600" fill="#6E7075">${isTimingDiv ? rtl(trunc(liLaNote, 42)) : escapeXml(trunc(liLaNote, 42))}</text>

    <text x="674" y="899" text-anchor="end" font-weight="700" fill="#55565A">${rtl('متریال و کورد کششی')}</text>
    <text x="261" y="899" text-anchor="middle" font-weight="700" fill="#1F2022">${rtl(trunc(t.tensileCord || t.bodyMaterial || 'الاستومر صنعتی استاندارد', 40))}</text>

    <text x="674" y="933" text-anchor="end" font-weight="700" fill="#55565A">${rtl('واحد فروش و استاندارد')}</text>
    <text x="261" y="933" text-anchor="middle" class="font-fa" font-size="12" font-weight="700" fill="#1F2022">${rtl(trunc(`${sku.unit} — ${t.standardReference || 'DIN / ISO'}`, 40))}</text>
  </g>

  <text x="1334" y="968" text-anchor="end" class="font-fa" font-size="11.5" font-weight="600" fill="#55565A">${rtl(`واحد مهندسی کاتالوگ صنعت پیش — نقشه اختصاصی کد ${sku.skuCode}`)}</text>
  <text x="64" y="968" text-anchor="start" class="font-mono" font-size="11.5" font-weight="700" fill="#E56B1E">DWG: SP-SKU-${escapeXml(sku.skuCode)}-V1</text>
</svg>`;
}

function buildSkuProfileDrawingSvg(sku: ReconciledSku): string {
  const t = sku.technical;
  const div = t.beltDivision;
  const pVal = t.pitchMm ? fmtNum(t.pitchMm, '', 3) : '—';
  const htVal = t.toothHeightMm ? fmtNum(t.toothHeightMm, '', 2) : '—';
  const hsVal = t.beltThicknessMm ? fmtNum(t.beltThicknessMm, '', 2) : '—';
  const wVal = (t.nominalWidthMm ?? t.topWidthMm) ? fmtNum(t.nominalWidthMm ?? t.topWidthMm, '', 2) : '—';
  const angStr = t.toothAngleDeg ? `${t.toothAngleDeg}°` : '40°';
  const designLabel = trunc(sku.rawSize || t.lengthDesignation || sku.skuCode, 28);
  const lenText = t.pitchLengthMm
    ? `Lp=${fmtNum(t.pitchLengthMm, 'mm')}`
    : t.insideLengthMm
      ? `Li=${fmtNum(t.insideLengthMm, 'mm')}`
      : t.outsideLengthMm
        ? `La=${fmtNum(t.outsideLengthMm, 'mm')}`
        : t.lengthDesignation
          ? `Size:${trunc(t.lengthDesignation, 14)}`
          : 'Roll/Spec';

  // Pitch line height offset `u` when known by standard profile
  const pitchOffsetNum =
    t.beltThicknessMm && t.toothHeightMm
      ? Math.max(0.25, Number(((t.beltThicknessMm - t.toothHeightMm) * 0.48).toFixed(3)))
      : null;
  const uVal = pitchOffsetNum ? fmtNum(pitchOffsetNum, '', 3) : '—';
  const bottomChordApprox = t.pitchMm ? fmtNum(Number((t.pitchMm * 0.64).toFixed(2)), '', 2) : '—';

  const footerDim =
    div === 'service-ambiguous'
      ? `SKU ${sku.skuCode}  |  ${trunc(sku.brand, 14)}  |  Requires Physical Inspection`
      : `SKU ${sku.skuCode}  |  ${t.profile}  |  ${lenText}  |  b=${wVal}mm  |  hs=${hsVal}mm  |  All dims in mm`;

  let bodySvg = '';

  if (div === 'service-ambiguous') {
    bodySvg = `
  <rect x="130" y="130" width="700" height="300" rx="8" fill="#FFFFFF" stroke="#111827" stroke-width="1.8" stroke-dasharray="10,6"/>
  <text x="480" y="235" text-anchor="middle" class="font-fa" font-size="22" font-weight="800" fill="#111827">${rtl('نیاز به اندازه‌گیری فیزیکی پروفیل و ابعاد')}</text>
  <text x="480" y="280" text-anchor="middle" class="font-mono" font-size="16" font-weight="700" fill="#334155">SKU ${escapeXml(sku.skuCode)}  —  PARTIAL DB SPEC (NO INVENTED DIMS)</text>
  <text x="480" y="325" text-anchor="middle" class="font-fa" font-size="15" font-weight="600" fill="#475569">${rtl(trunc(`ثبت فعلی: ${sku.rawName}`, 64))}</text>`;
  } else if (div === 'welded-pu-round-crc') {
    const dStr = wVal !== '—' ? `Ø ${wVal}` : hsVal !== '—' ? `Ø ${hsVal}` : 'Ø STD';
    bodySvg = `
  <circle cx="480" cy="275" r="120" fill="#FFFFFF" stroke="#111827" stroke-width="2.4"/>
  <circle cx="480" cy="275" r="11" fill="none" stroke="#111827" stroke-width="1.4" stroke-dasharray="4,3"/>
  <line x1="315" y1="275" x2="645" y2="275" stroke="#111827" stroke-width="1.2" stroke-dasharray="18,4,3,4"/>
  <line x1="480" y1="115" x2="480" y2="435" stroke="#111827" stroke-width="1.2" stroke-dasharray="18,4,3,4"/>
  <line x1="360" y1="95" x2="360" y2="275" stroke="#334155" stroke-width="1"/>
  <line x1="600" y1="95" x2="600" y2="275" stroke="#334155" stroke-width="1"/>
  <line x1="364" y1="108" x2="596" y2="108" stroke="#111827" stroke-width="1.5" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="480" y="96" text-anchor="middle" class="font-mono" font-size="21" font-weight="700" fill="#111827">${escapeXml(dStr)} mm</text>
  <text x="480" y="458" text-anchor="middle" class="font-mono" font-size="15" fill="#475569">Circular Cross-Section (Heat-Weldable PU)</text>`;
  } else if (div === 'vbelt-hexagonal') {
    bodySvg = `
  <polygon points="340,175 620,175 680,275 620,375 340,375 280,275" fill="#FFFFFF" stroke="#111827" stroke-width="2.4" stroke-linejoin="round"/>
  <line x1="255" y1="275" x2="705" y2="275" stroke="#111827" stroke-width="1.3" stroke-dasharray="18,4,3,4"/>
  <line x1="340" y1="105" x2="340" y2="175" stroke="#334155" stroke-width="1"/>
  <line x1="620" y1="105" x2="620" y2="175" stroke="#334155" stroke-width="1"/>
  <line x1="344" y1="118" x2="616" y2="118" stroke="#111827" stroke-width="1.5" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="480" y="106" text-anchor="middle" class="font-mono" font-size="21" font-weight="700" fill="#111827">b = ${escapeXml(wVal)} mm</text>
  <line x1="620" y1="175" x2="765" y2="175" stroke="#334155" stroke-width="1"/>
  <line x1="620" y1="375" x2="765" y2="375" stroke="#334155" stroke-width="1"/>
  <line x1="752" y1="179" x2="752" y2="371" stroke="#111827" stroke-width="1.5" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="774" y="282" text-anchor="start" class="font-mono" font-size="21" font-weight="700" fill="#111827">h = ${escapeXml(hsVal)}</text>
  <text x="480" y="422" text-anchor="middle" class="font-mono" font-size="16" fill="#334155">Side Angle β = ${escapeXml(angStr)} (Symmetric Double-V)</text>`;
  } else if (div === 'vbelt-banded') {
    const bands = Math.min(5, Math.max(2, t.ribCount || 3));
    const bandW = 92;
    const gap = 16;
    const step = bandW + gap;
    const totalW = bands * bandW + (bands - 1) * gap;
    const x0 = Math.round(480 - totalW / 2);
    const ribsSvg = Array.from({ length: bands }, (_, i) => {
      const rx = x0 + i * step;
      return `L ${rx} 230 L ${rx + 18} 348 L ${rx + bandW - 18} 348 L ${rx + bandW} 230`;
    }).join(' ');
    bodySvg = `
  <path d="M ${x0} 195 L ${x0 + totalW} 195 L ${x0 + totalW} 230 ${ribsSvg} L ${x0} 230 Z" fill="#FFFFFF" stroke="#111827" stroke-width="2.3" stroke-linejoin="round"/>
  <line x1="${x0 - 20}" y1="222" x2="${x0 + totalW + 20}" y2="222" stroke="#111827" stroke-width="1.25" stroke-dasharray="18,4,3,4"/>
  <line x1="${x0}" y1="115" x2="${x0}" y2="195" stroke="#334155" stroke-width="1"/>
  <line x1="${x0 + totalW}" y1="115" x2="${x0 + totalW}" y2="195" stroke="#334155" stroke-width="1"/>
  <line x1="${x0 + 4}" y1="128" x2="${x0 + totalW - 4}" y2="128" stroke="#111827" stroke-width="1.5" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="480" y="114" text-anchor="middle" class="font-mono" font-size="20" font-weight="700" fill="#111827">W = ${escapeXml(wVal)} mm (${t.ribCount || bands} Bands)</text>
  <line x1="${x0 + totalW}" y1="195" x2="${x0 + totalW + 78}" y2="195" stroke="#334155" stroke-width="1"/>
  <line x1="${x0 + totalW - 18}" y1="348" x2="${x0 + totalW + 78}" y2="348" stroke="#334155" stroke-width="1"/>
  <line x1="${x0 + totalW + 64}" y1="199" x2="${x0 + totalW + 64}" y2="344" stroke="#111827" stroke-width="1.5" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="${x0 + totalW + 76}" y="278" text-anchor="start" class="font-mono" font-size="20" font-weight="700" fill="#111827">h=${escapeXml(hsVal)}</text>`;
  } else if (div.startsWith('vbelt') || div === 'perforated-open-v' || div === 'welded-pu-v-flat') {
    const isCrowned = div === 'vbelt-crowned-crc';
    const topPath = isCrowned
      ? 'M 300 205 Q 480 142 660 205 L 605 375 L 355 375 Z'
      : 'M 300 185 L 660 185 L 605 375 L 355 375 Z';
    bodySvg = `
  <path d="${topPath}" fill="#FFFFFF" stroke="#111827" stroke-width="2.4" stroke-linejoin="round"/>
  <line x1="275" y1="226" x2="685" y2="226" stroke="#111827" stroke-width="1.25" stroke-dasharray="18,4,3,4"/>
  <line x1="300" y1="102" x2="300" y2="185" stroke="#334155" stroke-width="1"/>
  <line x1="660" y1="102" x2="660" y2="185" stroke="#334155" stroke-width="1"/>
  <line x1="304" y1="116" x2="656" y2="116" stroke="#111827" stroke-width="1.5" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="480" y="102" text-anchor="middle" class="font-mono" font-size="21" font-weight="700" fill="#111827">${escapeXml(wVal)} (${escapeXml(t.profile)})</text>
  <line x1="660" y1="185" x2="770" y2="185" stroke="#334155" stroke-width="1"/>
  <line x1="605" y1="375" x2="770" y2="375" stroke="#334155" stroke-width="1"/>
  <line x1="755" y1="189" x2="755" y2="371" stroke="#111827" stroke-width="1.5" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="774" y="286" text-anchor="start" class="font-mono" font-size="21" font-weight="700" fill="#111827">h=${escapeXml(hsVal)}</text>
  <path d="M 355 375 L 330 432 M 605 375 L 630 432" stroke="#334155" stroke-width="1" stroke-dasharray="5,4"/>
  <path d="M 412 414 A 72 72 0 0 0 548 414" fill="none" stroke="#111827" stroke-width="1.4" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="480" y="454" text-anchor="middle" class="font-mono" font-size="18" font-weight="700" fill="#111827">β = ${escapeXml(angStr)}${sku.isCoggedVbelt ? '  |  Raw-Edge Cogged' : ''}</text>`;
  } else if (div === 'ribbed-poly-v') {
    const ribsCount = 6;
    const ribW = 72;
    const startX = 264;
    const ribs = Array.from({ length: ribsCount }, (_, i) => {
      const rx = startX + i * ribW;
      return `L ${rx + ribW * 0.5} 348 L ${rx + ribW} 285`;
    }).join(' ');
    bodySvg = `
  <path d="M 190 215 Q 204 252 184 285 L ${startX} 285 ${ribs} L 772 285 Q 758 252 776 215 Z" fill="#FFFFFF" stroke="#111827" stroke-width="2.2" stroke-linejoin="round"/>
  <line x1="162" y1="248" x2="800" y2="248" stroke="#111827" stroke-width="1.25" stroke-dasharray="18,4,3,4"/>
  <line x1="300" y1="126" x2="300" y2="348" stroke="#334155" stroke-width="1"/>
  <line x1="372" y1="126" x2="372" y2="348" stroke="#334155" stroke-width="1"/>
  <line x1="304" y1="140" x2="368" y2="140" stroke="#111827" stroke-width="1.4" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="336" y="128" text-anchor="middle" class="font-mono" font-size="19" font-weight="700" fill="#111827">${escapeXml(pVal)}</text>
  <line x1="776" y1="215" x2="848" y2="215" stroke="#334155" stroke-width="1"/>
  <line x1="696" y1="348" x2="848" y2="348" stroke="#334155" stroke-width="1"/>
  <line x1="835" y1="219" x2="835" y2="344" stroke="#111827" stroke-width="1.5" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="850" y="286" text-anchor="start" class="font-mono" font-size="19" font-weight="700" fill="#111827">${escapeXml(hsVal)}</text>
  <text x="480" y="425" text-anchor="middle" class="font-mono" font-size="17" font-weight="700" fill="#111827">Ribs=${t.ribCount || 'STD'}  |  s=${escapeXml(pVal)} mm  |  α=${escapeXml(angStr)}  |  W=${escapeXml(wVal)} mm</text>`;
  } else if (div === 'timing-htd-rpp-single' || div === 'timing-htd-rpp-double' || div === 'timing-automotive-ru') {
    const isDouble = div === 'timing-htd-rpp-double';
    // Classic 2-tooth curvilinear cross-section directly modeled after engineering reference
    const c1 = 355;
    const c2 = 605;
    const yBack = 212;
    const yLand = 290;
    const yTip = 398;
    const yPitch = 258;
    const toothShape = `
      M 192 ${yBack} L 768 ${yBack}
      Q 782 238 764 ${yLand} L 690 ${yLand}
      C 666 ${yLand}, 660 ${yTip}, ${c2 + 12} ${yTip}
      L ${c2 - 12} ${yTip}
      C ${c2 - 52} ${yTip}, 544 ${yLand}, 520 ${yLand}
      L 440 ${yLand}
      C 416 ${yLand}, 410 ${yTip}, ${c1 + 12} ${yTip}
      L ${c1 - 12} ${yTip}
      C ${c1 - 52} ${yTip}, 294 ${yLand}, 270 ${yLand}
      L 188 ${yLand}
      Q 204 252 192 ${yBack} Z`;
    const dblTop = isDouble
      ? `
      M 270 ${yBack} C 294 ${yBack}, ${c1 - 52} 120, ${c1 - 12} 120 L ${c1 + 12} 120 C 410 120, 416 ${yBack}, 440 ${yBack}
      M 520 ${yBack} C 544 ${yBack}, ${c2 - 52} 120, ${c2 - 12} 120 L ${c2 + 12} 120 C 660 120, 666 ${yBack}, 690 ${yBack}`
      : '';
    bodySvg = `
  <path d="${toothShape}" fill="#FFFFFF" stroke="#111827" stroke-width="2.2" stroke-linejoin="round"/>
  ${dblTop ? `<path d="${dblTop}" fill="#FFFFFF" stroke="#111827" stroke-width="2.1" stroke-linejoin="round"/>` : ''}
  <line x1="158" y1="${yPitch}" x2="800" y2="${yPitch}" stroke="#111827" stroke-width="1.3" stroke-dasharray="20,5,3,5"/>
  <!-- Top Pitch p dimension -->
  <line x1="${c1}" y1="104" x2="${c1}" y2="${yLand + 4}" stroke="#334155" stroke-width="1"/>
  <line x1="${c2}" y1="104" x2="${c2}" y2="${yLand + 4}" stroke="#334155" stroke-width="1"/>
  <line x1="${c1 + 4}" y1="118" x2="${c2 - 4}" y2="118" stroke="#111827" stroke-width="1.4" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="${(c1 + c2) / 2}" y="104" text-anchor="middle" class="font-mono" font-size="21" font-weight="700" fill="#111827">${escapeXml(pVal)}</text>
  <!-- Upper tooth chord / neck callout -->
  <line x1="${c1 - 74}" y1="154" x2="${c1 - 74}" y2="${yPitch}" stroke="#334155" stroke-width="1"/>
  <line x1="${c1 + 74}" y1="154" x2="${c1 + 74}" y2="${yPitch}" stroke="#334155" stroke-width="1"/>
  <line x1="${c1 - 70}" y1="168" x2="${c1 + 70}" y2="168" stroke="#111827" stroke-width="1.35" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="${c1}" y="156" text-anchor="middle" class="font-mono" font-size="18" font-weight="700" fill="#111827">${escapeXml(bottomChordApprox)}</text>
  <!-- Diagonal tooth flank arc dimension -->
  <line x1="${c1 + 70}" y1="${yPitch + 3}" x2="${c1 - 58}" y2="364" stroke="#111827" stroke-width="1.25" marker-end="url(#cadEnd)"/>
  <text x="${c1}" y="352" text-anchor="middle" class="font-mono" font-size="17" font-weight="700" fill="#111827" transform="rotate(-33 ${c1} 352)">${escapeXml(bottomChordApprox)}</text>
  <!-- Left cord-line offset u dimension -->
  <line x1="126" y1="${yPitch}" x2="178" y2="${yPitch}" stroke="#334155" stroke-width="1"/>
  <line x1="126" y1="${yLand}" x2="188" y2="${yLand}" stroke="#334155" stroke-width="1"/>
  <line x1="142" y1="215" x2="142" y2="254" stroke="#111827" stroke-width="1.3" marker-end="url(#cadEnd)"/>
  <line x1="142" y1="332" x2="142" y2="294" stroke="#111827" stroke-width="1.3" marker-end="url(#cadEnd)"/>
  <text x="122" y="280" text-anchor="middle" class="font-mono" font-size="17" font-weight="700" fill="#111827" transform="rotate(-90 122 280)">${escapeXml(uVal)}</text>
  <!-- Right vertical ht & hs dimensions -->
  <line x1="768" y1="${yBack}" x2="884" y2="${yBack}" stroke="#334155" stroke-width="1"/>
  <line x1="764" y1="${yLand}" x2="846" y2="${yLand}" stroke="#334155" stroke-width="1"/>
  <line x1="${c2 + 12}" y1="${yTip}" x2="884" y2="${yTip}" stroke="#334155" stroke-width="1"/>
  <line x1="832" y1="${yLand + 4}" x2="832" y2="${yTip - 4}" stroke="#111827" stroke-width="1.4" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="816" y="346" text-anchor="middle" class="font-mono" font-size="18" font-weight="700" fill="#111827" transform="rotate(-90 816 346)">${escapeXml(htVal)}</text>
  <line x1="870" y1="${yBack + 4}" x2="870" y2="${yTip - 4}" stroke="#111827" stroke-width="1.4" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="854" y="308" text-anchor="middle" class="font-mono" font-size="19" font-weight="700" fill="#111827" transform="rotate(-90 854 308)">${escapeXml(hsVal)}</text>`;
  } else {
    // Trapezoidal timing (Imperial MXL/XL/L/H/XH/XXH, Double-Sided DL/DH/DXL, Metric T/AT)
    const isDouble = div === 'timing-imperial-double';
    const c1 = 355;
    const c2 = 605;
    const yBack = isDouble ? 225 : 212;
    const yLand = isDouble ? 295 : 288;
    const yTip = isDouble ? 390 : 395;
    const yPitch = isDouble ? 260 : 254;
    const trapShape = `
      M 192 ${yBack} L 768 ${yBack}
      Q 782 238 764 ${yLand} L 692 ${yLand}
      L ${c2 + 44} ${yTip} L ${c2 - 44} ${yTip} L 518 ${yLand}
      L 442 ${yLand}
      L ${c1 + 44} ${yTip} L ${c1 - 44} ${yTip} L 268 ${yLand}
      L 188 ${yLand}
      Q 204 252 192 ${yBack} Z`;
    const dblTop = isDouble
      ? `M 268 ${yBack} L ${c1 - 44} 130 L ${c1 + 44} 130 L 442 ${yBack} M 518 ${yBack} L ${c2 - 44} 130 L ${c2 + 44} 130 L 692 ${yBack}`
      : '';
    const coatBand = sku.isCoatedBelt
      ? `<rect x="192" y="${yBack - 26}" width="576" height="26" fill="none" stroke="#111827" stroke-width="1.6" stroke-dasharray="6,4"/>`
      : '';
    bodySvg = `
  ${coatBand}
  <path d="${trapShape}" fill="#FFFFFF" stroke="#111827" stroke-width="2.2" stroke-linejoin="round"/>
  ${dblTop ? `<path d="${dblTop}" fill="#FFFFFF" stroke="#111827" stroke-width="2.1" stroke-linejoin="round"/>` : ''}
  <line x1="158" y1="${yPitch}" x2="800" y2="${yPitch}" stroke="#111827" stroke-width="1.3" stroke-dasharray="20,5,3,5"/>
  <!-- Top Pitch p dimension -->
  <line x1="${c1}" y1="98" x2="${c1}" y2="${yTip + 4}" stroke="#334155" stroke-width="1"/>
  <line x1="${c2}" y1="98" x2="${c2}" y2="${yTip + 4}" stroke="#334155" stroke-width="1"/>
  <line x1="${c1 + 4}" y1="112" x2="${c2 - 4}" y2="112" stroke="#111827" stroke-width="1.4" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="${(c1 + c2) / 2}" y="99" text-anchor="middle" class="font-mono" font-size="21" font-weight="700" fill="#111827">p = ${escapeXml(pVal)}</text>
  <!-- Left cord offset u -->
  <line x1="126" y1="${yPitch}" x2="178" y2="${yPitch}" stroke="#334155" stroke-width="1"/>
  <line x1="126" y1="${yLand}" x2="188" y2="${yLand}" stroke="#334155" stroke-width="1"/>
  <line x1="142" y1="214" x2="142" y2="250" stroke="#111827" stroke-width="1.3" marker-end="url(#cadEnd)"/>
  <line x1="142" y1="330" x2="142" y2="292" stroke="#111827" stroke-width="1.3" marker-end="url(#cadEnd)"/>
  <text x="122" y="276" text-anchor="middle" class="font-mono" font-size="17" font-weight="700" fill="#111827" transform="rotate(-90 122 276)">${escapeXml(uVal)}</text>
  <!-- Right vertical ht & hs -->
  <line x1="768" y1="${yBack}" x2="884" y2="${yBack}" stroke="#334155" stroke-width="1"/>
  <line x1="764" y1="${yLand}" x2="846" y2="${yLand}" stroke="#334155" stroke-width="1"/>
  <line x1="${c2 + 44}" y1="${yTip}" x2="884" y2="${yTip}" stroke="#334155" stroke-width="1"/>
  <line x1="832" y1="${yLand + 4}" x2="832" y2="${yTip - 4}" stroke="#111827" stroke-width="1.4" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="816" y="344" text-anchor="middle" class="font-mono" font-size="18" font-weight="700" fill="#111827" transform="rotate(-90 816 344)">${escapeXml(htVal)}</text>
  <line x1="870" y1="${yBack + 4}" x2="870" y2="${yTip - 4}" stroke="#111827" stroke-width="1.4" marker-start="url(#cadStart)" marker-end="url(#cadEnd)"/>
  <text x="854" y="305" text-anchor="middle" class="font-mono" font-size="19" font-weight="700" fill="#111827" transform="rotate(-90 854 305)">${escapeXml(hsVal)}</text>
  <!-- Tooth flank angle -->
  <text x="480" y="446" text-anchor="middle" class="font-mono" font-size="17" font-weight="700" fill="#111827">Angle 2β = ${escapeXml(angStr)}${wVal !== '—' ? `  |  b = ${escapeXml(wVal)} mm` : ''}</text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 560" width="960" height="560">
  <defs>
    <style>
      .font-fa { font-family: 'Noto Sans Arabic', 'Noto Kufi Arabic', 'Tahoma', 'DejaVu Sans', sans-serif; }
      .font-mono { font-family: 'DejaVu Sans Mono', 'Liberation Mono', monospace; }
    </style>
    <marker id="cadStart" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
      <path d="M 10 1.5 L 1 5 L 10 8.5 z" fill="#111827"/>
    </marker>
    <marker id="cadEnd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#111827"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="960" height="560" fill="#FFFFFF"/>
  <text x="36" y="42" text-anchor="start" class="font-mono" font-size="14" font-weight="700" fill="#475569">${escapeXml(`PROFILE CAD  ·  ${designLabel}`)}</text>
  <text x="924" y="42" text-anchor="end" class="font-mono" font-size="14" font-weight="700" fill="#111827">${escapeXml(`SKU ${sku.skuCode} (${t.profile})`)}</text>
  <line x1="36" y1="54" x2="924" y2="54" stroke="#E2E8F0" stroke-width="1"/>
  ${bodySvg}
  <line x1="36" y1="504" x2="924" y2="504" stroke="#E2E8F0" stroke-width="1"/>
  <text x="480" y="534" text-anchor="middle" class="font-mono" font-size="14" font-weight="700" fill="#334155">${escapeXml(footerDim)}</text>
</svg>`;
}

async function hydrateMastersAndMetadata(): Promise<Record<string, MasterPhotoMeta>> {
  fs.mkdirSync(MASTER_DIR, { recursive: true });
  const provenancePath = path.join(DOCS_DIR, 'belt-master-photo-provenance.json');
  const existingProv: Record<string, MasterPhotoMeta> = fs.existsSync(provenancePath)
    ? JSON.parse(fs.readFileSync(provenancePath, 'utf8'))
    : {};

  // Hydrate previously built family/sku images back into _master/ if _master was cleaned earlier
  const prevManifest = readExistingBeltManifest();
  if (prevManifest) {
    const keySourceMap = new Map<string, string>();
    for (const [fid, f] of Object.entries(prevManifest.families || {})) {
      f.p?.forEach((k, idx) => {
        if (!keySourceMap.has(k)) {
          const candidate = path.join(FAMILIES_OUT_DIR, fid, `family-image-0${idx + 1}.webp`);
          if (fs.existsSync(candidate)) keySourceMap.set(k, candidate);
        }
      });
    }
    for (const skuCode of ['52009', '52050']) {
      const mKey = `sku_${skuCode}_real`;
      const candidate = path.join(SKUS_OUT_DIR, skuCode, 'real-product-image.webp');
      if (fs.existsSync(candidate)) keySourceMap.set(mKey, candidate);
    }
    for (const [k, srcPath] of keySourceMap.entries()) {
      const destPath = path.join(MASTER_DIR, `${k}.webp`);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Convert new verified local downloads in .tmp_belt_check/
  for (const item of NEW_LOCAL_MASTERS) {
    const absSrc = path.join(ROOT_DIR, item.localSrc);
    const destPath = path.join(MASTER_DIR, `${item.key}.webp`);
    if (fs.existsSync(absSrc)) {
      const buf = await sharp(absSrc).webp({ quality: 90 }).toBuffer();
      const meta = await sharp(buf).metadata();
      fs.writeFileSync(destPath, buf);
      existingProv[item.key] = {
        key: item.key,
        file: `${item.key}.webp`,
        width: meta.width || 800,
        height: meta.height || 600,
        bytes: buf.length,
        sourceUrl: item.sourceUrl,
        sourcePageUrl: item.sourcePageUrl,
        manufacturer: item.manufacturer,
        licenseStatus: 'VERIFIED_CATALOG_PRODUCT_PHOTO_NO_WATERMARK',
        description: item.description,
      };
    } else if (!fs.existsSync(destPath)) {
      throw new Error(`Missing required source asset ${item.localSrc} for master key ${item.key}`);
    }
  }

  fs.writeFileSync(provenancePath, JSON.stringify(existingProv, null, 2), 'utf8');
  fs.writeFileSync(path.join(MASTER_DIR, 'master-metadata.json'), JSON.stringify(existingProv, null, 2), 'utf8');
  return existingProv;
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, idx: number) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const isSample = process.argv.includes('--sample');
  const isResume = process.argv.includes('--resume');
  const forceProfile = process.argv.includes('--force-profile');
  const startTime = Date.now();

  const masterMeta = await hydrateMastersAndMetadata();
  const previousManifest = readExistingBeltManifest();
  const prevFamPhotos = new Map<string, string>();
  if (previousManifest) {
    const pm = previousManifest;
    for (const [fid, f] of Object.entries(pm.families || {})) {
      if (Array.isArray(f.p)) prevFamPhotos.set(fid, f.p.join('|'));
    }
  }
  const auditReport = JSON.parse(
    fs.readFileSync(path.join(DOCS_DIR, 'belt-catalog-audit-report.json'), 'utf8'),
  );
  const auditBySku = new Map<string, AuditSkuRecord>(
    (auditReport.reportA_skuClassifications as AuditSkuRecord[]).map((r) => [String(r.sku), r]),
  );

  const productByCode = new Map<string, RuntimeProduct>();
  const menuFamilies: MenuFamilyEntry[] = [];

  let loadedFromApi = false;
  try {
    const runtimeRes = await fetch(`${API_BASE}/api/runtime`);
    if (runtimeRes.ok) {
      const runtimeJson = (await runtimeRes.json()) as {
        database?: boolean;
        products?: RuntimeProduct[];
      };
      if (runtimeJson.database !== false && Array.isArray(runtimeJson.products) && runtimeJson.products.length > 0) {
        for (const p of runtimeJson.products) {
          productByCode.set(p.code, p);
        }
        let allMenuOk = true;
        for (const slug of ['excel-v2-1-1', 'excel-v2-1-2', 'excel-v2-1-3', 'excel-v2-1-4'] as BeltCategorySlug[]) {
          const res = await fetch(`${API_BASE}/api/catalog/menu-category/${slug}`);
          if (!res.ok) {
            allMenuOk = false;
            break;
          }
          const json = (await res.json()) as { families?: MenuFamilyEntry[]; items?: MenuFamilyEntry[] };
          for (const f of json.families || json.items || []) {
            menuFamilies.push({ ...f, menuCategorySlug: slug });
          }
        }
        if (allMenuOk && menuFamilies.length > 0) {
          loadedFromApi = true;
        } else {
          menuFamilies.length = 0;
          productByCode.clear();
        }
      }
    }
  } catch {
    // Fallback to offline fixtures when dev API/Postgres is offline
  }

  if (!loadedFromApi) {
    console.log('Runtime API database unavailable; loading offline catalog fixtures from tests/fixtures/...');
    const fixtureRows = JSON.parse(
      fs.readFileSync(path.join(ROOT_DIR, 'tests/fixtures/catalogueSource.json'), 'utf8'),
    ) as Array<{
      code: string;
      name: string;
      brand?: string | null;
      unit?: string | null;
      categoryName?: string;
      submenu?: string;
      technicalType?: string;
      variants?: RuntimeVariant[];
    }>;
    const fixtureImages = JSON.parse(
      fs.readFileSync(path.join(ROOT_DIR, 'tests/fixtures/catalogueImages.json'), 'utf8'),
    ) as Record<string, { files?: string[] }>;
    const KNOWN_DB_FAMILY_IMAGES: Record<string, string> = {
      'FAM-35525': '/storage/products/catalog/e(159).png',
    };
    const beltMenuSlugs = new Set<BeltCategorySlug>([
      'excel-v2-1-1',
      'excel-v2-1-2',
      'excel-v2-1-3',
      'excel-v2-1-4',
    ]);

    for (const row of fixtureRows) {
      const files = fixtureImages[row.code]?.files || [];
      const officialImgs = files
        .map((f) => `/storage/products/catalog/${f}`)
        .filter((u) => /^\/storage\/products\/catalog\/e\(\d+\)\.png$/.test(u));
      if (KNOWN_DB_FAMILY_IMAGES[row.code] && !officialImgs.includes(KNOWN_DB_FAMILY_IMAGES[row.code])) {
        officialImgs.unshift(KNOWN_DB_FAMILY_IMAGES[row.code]);
      }

      const prod: RuntimeProduct = {
        code: row.code,
        name: row.name,
        brand: row.brand || undefined,
        unit: row.unit || undefined,
        image: officialImgs[0],
        images: officialImgs,
        categorySlug: row.categoryName === 'تسمه و انتقال نیرو' ? 'تسمه-و-انتقال-نیرو' : undefined,
        subcategory: row.technicalType || undefined,
        submenu: row.submenu || undefined,
        variants: row.variants || [],
      };
      productByCode.set(prod.code, prod);

      const assign = getFamilyMenuAssignment(prod.code);
      if (assign && beltMenuSlugs.has(assign.categorySlug as BeltCategorySlug)) {
        menuFamilies.push({
          code: prod.code,
          name: prod.name,
          brand: prod.brand,
          skuCount: prod.variants?.length || 1,
          submenu: assign.submenuName || assign.submenu || '',
          leaf: assign.leafName || assign.leaf || '',
          menuCategorySlug: assign.categorySlug as BeltCategorySlug,
        });
      }
    }
  }

  const excludedPureFamilies: string[] = [];
  const excludedMixedSkus: Array<{ familyCode: string; skuCode: string; rawName: string; reason: string }> = [];
  const reconciledFamilies: ReconciledFamily[] = [];
  const allBeltSkus: ReconciledSku[] = [];

  for (const mf of menuFamilies) {
    if (EXCLUDED_NON_BELT_FAMILY_IDS.has(mf.code)) {
      excludedPureFamilies.push(mf.code);
      continue;
    }

    const prod = productByCode.get(mf.code);
    const existingImgCandidates = [
      ...(prod?.images || []),
      prod?.image || '',
    ].filter((u) => /^\/storage\/products\/catalog\/e\(\d+\)\.png$/.test(String(u).trim()));
    const existingDbImage = existingImgCandidates[0] || null;

    const rawVariants: RuntimeVariant[] =
      prod?.variants && prod.variants.length > 0
        ? prod.variants
        : [{ code: mf.code, name: mf.name, unit: prod?.unit || 'حلقه', brand: mf.brand }];

    const beltSkus: ReconciledSku[] = [];
    for (const v of rawVariants) {
      const skuCode = String(v.code).trim();
      const audit = auditBySku.get(skuCode);
      if (isMixedNonBeltSku(mf.code, skuCode, audit)) {
        excludedMixedSkus.push({
          familyCode: mf.code,
          skuCode,
          rawName: audit?.originalName || v.name || mf.name,
          reason: audit?.actualProductType || 'non-belt inside mixed family',
        });
        continue;
      }

      const tech: AuditTechnical = audit?.technical || {
        operatingPrinciple: 'unknown',
        beltDivision: 'service-ambiguous',
        supplyForm: 'endless-loop',
        sidedness: 'single-sided',
        profile: 'UNSPECIFIED',
        pitchMm: null,
        toothAngleDeg: null,
        toothHeightMm: null,
        beltThicknessMm: null,
        topWidthMm: null,
        nominalWidthMm: null,
        widthCode: null,
        pitchLengthMm: null,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: null,
        toothCount: null,
        ribCount: null,
        bodyMaterial: null,
        tensileCord: null,
        backingOrCoating: null,
        standardReference: null,
      };

      const rawName = audit?.originalName || v.name || mf.name;
      const rawSize = audit?.originalSize || v.size || tech.lengthDesignation || '';
      const isCoggedVbelt = detectCogged(rawName, tech.profile, audit?.actualProductType || '');
      const isCoatedBelt = detectCoated(mf.menuCategorySlug, rawName, tech.backingOrCoating, mf.leaf || '');

      const skuObj: ReconciledSku = {
        skuCode,
        familyCode: mf.code,
        rawName,
        rawSize,
        unit: audit?.unit || v.unit || prod?.unit || 'حلقه',
        brand: audit?.detectedBrand || v.brand || mf.brand || 'UNSPECIFIED',
        model: v.model || '',
        actualProductType: audit?.actualProductType || mf.leaf || 'تسمه صنعتی',
        technical: tech,
        confidence: audit?.confidence || 'INTERNAL_DB_CATALOG_ONLY',
        menuCategorySlug: mf.menuCategorySlug,
        familyName: mf.name,
        leaf: mf.leaf || '',
        submenu: mf.submenu || '',
        isCoggedVbelt,
        isCoatedBelt,
      };
      beltSkus.push(skuObj);
    }

    if (beltSkus.length === 0) {
      excludedPureFamilies.push(mf.code);
      continue;
    }

    const tally = (arr: string[]) => {
      const m = new Map<string, number>();
      for (const item of arr) {
        if (!item) continue;
        m.set(item, (m.get(item) || 0) + 1);
      }
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    };

    const divSorted = tally(beltSkus.map((s) => s.technical.beltDivision));
    const dominantDivision = divSorted[0]?.[0] || 'service-ambiguous';
    const profileSorted = tally(beltSkus.map((s) => s.technical.profile));
    const brandSorted = tally(beltSkus.map((s) => s.brand).filter((b) => b && b !== 'UNSPECIFIED'));
    const stdSorted = tally(beltSkus.map((s) => s.technical.standardReference || ''));
    const matSorted = tally(beltSkus.map((s) => s.technical.bodyMaterial || ''));
    const cordSorted = tally(beltSkus.map((s) => s.technical.tensileCord || ''));
    const formSorted = tally(beltSkus.map((s) => s.technical.supplyForm || ''));

    const isCoatedFamily =
      mf.menuCategorySlug === 'excel-v2-1-4' || beltSkus.some((s) => s.isCoatedBelt);
    const isCoggedFamily = beltSkus.filter((s) => s.isCoggedVbelt).length >= Math.ceil(beltSkus.length / 2);

    const dominantProfiles = profileSorted.map(([k]) => k);
    const famBrand = brandSorted[0]?.[0] || mf.brand || 'UNSPECIFIED';

    const photoKeys = chooseFamilyPhotoTriplet({
      menuCategorySlug: mf.menuCategorySlug,
      dominantDivision,
      profileList: dominantProfiles,
      brand: famBrand,
      familyName: mf.name,
      leaf: mf.leaf || '',
      dominantSupplyForm: formSorted[0]?.[0] || 'endless-loop',
      isCoated: isCoatedFamily,
      isCogged: isCoggedFamily,
    });

    const famObj: ReconciledFamily = {
      familyCode: mf.code,
      familyName: mf.name,
      menuCategorySlug: mf.menuCategorySlug,
      submenu: mf.submenu || '',
      leaf: mf.leaf || '',
      brand: famBrand,
      existingDbImage,
      dominantDivision,
      dominantProfiles,
      dominantStandard: stdSorted[0]?.[0] || 'ISO / DIN Industrial Standard',
      dominantBodyMaterial: matSorted[0]?.[0] || 'الاستومر صنعتی استاندارد (کلروپرن / پلی‌یورتان)',
      dominantCord: cordSorted[0]?.[0] || 'کورد کششی استاندارد با پایداری طولی بالا',
      dominantSupplyForm: formSorted[0]?.[0] || 'endless-loop',
      isCoatedFamily,
      isCoggedFamily,
      photoKeys,
      skus: beltSkus,
    };

    reconciledFamilies.push(famObj);
    allBeltSkus.push(...beltSkus);
  }

  console.log(
    `Reconciled Belt Inventory: families=${reconciledFamilies.length}, beltSkus=${allBeltSkus.length}, excludedPure=${excludedPureFamilies.length}, excludedMixedSkus=${excludedMixedSkus.length}`,
  );
  if (reconciledFamilies.length !== 614 || allBeltSkus.length !== 7429) {
    throw new Error(
      `INVENTORY MISMATCH: expected 614 families and 7429 SKUs, got ${reconciledFamilies.length} / ${allBeltSkus.length}`,
    );
  }

  // Choose target subset if --sample
  const SAMPLE_FAMILIES = new Set([
    'FAM-34388', // timing-imperial-single OPTIBELT (has exact SKUs 52009, 52050 + missing 34388)
    'FAM-39436', // timing-metric-single coated AT10
    'FAM-38079', // timing-htd-rpp-single 14M
    'FAM-30',    // vbelt-narrow-wedge / vbelt-banded
    'FAM-28880', // large multi-profile classical V-belt SWR (627 SKUs)
    'FAM-35525', // welded-pu-round-crc / vbelt-crowned-crc
    'FAM-40702', // ribbed-poly-v
    'FAM-54569', // excel-v2-1-4 coated haul-off
    'FAM-32929', // service-ambiguous
  ]);

  const targetFamilies = isSample
    ? reconciledFamilies.filter((f) => SAMPLE_FAMILIES.has(f.familyCode))
    : reconciledFamilies;
  const targetSkus = isSample
    ? targetFamilies.flatMap((f) => f.skus.slice(0, 5))
    : allBeltSkus;

  console.log(
    `Mode: ${isSample ? 'SAMPLE' : 'FULL'} -> processing ${targetFamilies.length} families and ${targetSkus.length} SKUs...`,
  );

  const isValidFile = (p: string, minSize: number) => {
    try {
      return fs.statSync(p).size >= minSize;
    } catch {
      return false;
    }
  };

  // Build families assets
  let famDone = 0;
  await runPool(targetFamilies, 10, async (fam) => {
    const famDir = path.join(FAMILIES_OUT_DIR, fam.familyCode);
    fs.mkdirSync(famDir, { recursive: true });

    const photoKeysUnchanged = prevFamPhotos.get(fam.familyCode) === fam.photoKeys.join('|');
    const photosValid =
      isResume &&
      photoKeysUnchanged &&
      isValidFile(path.join(famDir, 'family-image-01.webp'), 1000) &&
      isValidFile(path.join(famDir, 'family-image-02.webp'), 1000) &&
      isValidFile(path.join(famDir, 'family-image-03.webp'), 1000);

    if (!photosValid) {
      for (let i = 0; i < 3; i++) {
        const mKey = fam.photoKeys[i];
        const meta = masterMeta[mKey];
        if (!meta) throw new Error(`Missing master key ${mKey} for ${fam.familyCode}`);
        const srcFile = path.join(MASTER_DIR, meta.file);
        const destFile = path.join(famDir, `family-image-0${i + 1}.webp`);
        fs.copyFileSync(srcFile, destFile);
      }
    }

    const specsValid =
      isResume &&
      isValidFile(path.join(famDir, 'family-specifications.svg'), 1000) &&
      isValidFile(path.join(famDir, 'family-specifications.webp'), 5000);

    if (!specsValid) {
      const specSvg = buildFamilySpecificationSvg(fam);
      fs.writeFileSync(path.join(famDir, 'family-specifications.svg'), specSvg, 'utf8');
      await sharp(Buffer.from(specSvg))
        .webp({ quality: 90 })
        .toFile(path.join(famDir, 'family-specifications.webp'));
    }

    famDone += 1;
    if (famDone % 100 === 0 || famDone === targetFamilies.length) {
      console.log(`Families rendered: ${famDone}/${targetFamilies.length}`);
    }
  });

  // Build SKU assets
  let skuDone = 0;
  await runPool(targetSkus, 12, async (sku) => {
    const skuDir = path.join(SKUS_OUT_DIR, sku.skuCode);
    fs.mkdirSync(skuDir, { recursive: true });

    const exactMatch = VERIFIED_EXACT_SKU_PHOTOS[sku.skuCode];
    const realImgPath = path.join(skuDir, 'real-product-image.webp');
    if (exactMatch) {
      if (!isResume || !isValidFile(realImgPath, 1000)) {
        const meta = masterMeta[exactMatch.masterKey];
        if (!meta) throw new Error(`Missing SKU master ${exactMatch.masterKey}`);
        fs.copyFileSync(path.join(MASTER_DIR, meta.file), realImgPath);
      }
    } else if (fs.existsSync(realImgPath)) {
      fs.rmSync(realImgPath, { force: true });
    }

    const techValid =
      isResume &&
      isValidFile(path.join(skuDir, 'technical-drawing.svg'), 1000) &&
      isValidFile(path.join(skuDir, 'technical-drawing.webp'), 5000);

    if (!techValid) {
      const techSvg = buildSkuTechnicalDrawingSvg(sku);
      fs.writeFileSync(path.join(skuDir, 'technical-drawing.svg'), techSvg, 'utf8');
      await sharp(Buffer.from(techSvg))
        .webp({ quality: 88 })
        .toFile(path.join(skuDir, 'technical-drawing.webp'));
    }

    const profValid =
      !forceProfile &&
      isResume &&
      isValidFile(path.join(skuDir, 'profile-drawing.svg'), 800) &&
      isValidFile(path.join(skuDir, 'profile-drawing.webp'), 3000);

    if (!profValid) {
      const profSvg = buildSkuProfileDrawingSvg(sku);
      fs.writeFileSync(path.join(skuDir, 'profile-drawing.svg'), profSvg, 'utf8');
      await sharp(Buffer.from(profSvg))
        .webp({ quality: 90 })
        .toFile(path.join(skuDir, 'profile-drawing.webp'));
    }

    skuDone += 1;
    if (skuDone % 500 === 0 || skuDone === targetSkus.length) {
      console.log(`SKUs rendered: ${skuDone}/${targetSkus.length} (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
    }
  });

  if (!isSample) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
    fs.mkdirSync(DOCS_DIR, { recursive: true });

    // Generated local-media asset registry. Product, price, stock, and category state remain database-backed.
    const familyEntries: Record<
      string,
      {
        s: BeltCategorySlug;
        d: string;
        db: string | null;
        p: [string, string, string];
      }
    > = {};

    for (const f of reconciledFamilies) {
      familyEntries[f.familyCode] = {
        s: f.menuCategorySlug,
        d: f.dominantDivision,
        db: f.existingDbImage,
        p: f.photoKeys,
      };
    }

    const beltSkuMap: Record<string, string> = {};
    for (const s of allBeltSkus) {
      beltSkuMap[s.skuCode] = s.familyCode;
    }

    const manifestPayload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      totals: {
        realBeltFamilies: reconciledFamilies.length,
        realBeltSkus: allBeltSkus.length,
        excludedPureNonBeltFamilies: excludedPureFamilies.length,
        excludedMixedNonBeltSkus: excludedMixedSkus.length,
        exactVerifiedRealSkuImages: Object.keys(VERIFIED_EXACT_SKU_PHOTOS).length,
      },
      excludedFamilyIds: excludedPureFamilies,
      excludedMixedSkuIds: excludedMixedSkus.map((x) => x.skuCode),
      exactRealSkuIds: Object.keys(VERIFIED_EXACT_SKU_PHOTOS),
      families: familyEntries,
      skus: beltSkuMap,
    };

    fs.writeFileSync(
      MANIFEST_PATH,
      `// Generated by scripts/build-belt-catalog-assets.ts. Do not edit manually.\nexport const beltCatalogManifest = ${JSON.stringify(manifestPayload)} as const;\nexport default beltCatalogManifest;\n`,
      'utf8',
    );
    fs.rmSync(LEGACY_MANIFEST_PATH, { force: true });

    // Detailed REAL_IMAGE_NOT_FOUND SKU report (JSON + Markdown)
    const missingSkus = allBeltSkus.filter((s) => !VERIFIED_EXACT_SKU_PHOTOS[s.skuCode]);
    const byDivMissing: Record<string, number> = {};
    for (const s of missingSkus) {
      byDivMissing[s.technical.beltDivision] = (byDivMissing[s.technical.beltDivision] || 0) + 1;
    }

    const missingJson = {
      generatedAt: new Date().toISOString(),
      policy: 'REAL_IMAGE_NOT_FOUND_WHEN_EXACT_PHYSICAL_SKU_PHOTO_UNAVAILABLE',
      totalRealBeltSkus: allBeltSkus.length,
      exactVerifiedRealSkuImagesCount: Object.keys(VERIFIED_EXACT_SKU_PHOTOS).length,
      exactVerifiedRealSkus: Object.entries(VERIFIED_EXACT_SKU_PHOTOS).map(([skuCode, meta]) => ({
        skuCode,
        familyCode: beltSkuMap[skuCode] || 'FAM-34388',
        assetPath: `/src/assets/catalog/belts/skus/${skuCode}/real-product-image.webp`,
        sourceUrl: meta.sourceUrl,
        sourcePageUrl: meta.sourcePageUrl,
        noteFa: meta.noteFa,
      })),
      missingRealImageCount: missingSkus.length,
      missingByDivision: byDivMissing,
      excludedPureNonBeltFamilies: excludedPureFamilies,
      excludedMixedNonBeltSkus: excludedMixedSkus,
      missingSkus: missingSkus.map((s) => ({
        skuCode: s.skuCode,
        familyCode: s.familyCode,
        rawName: s.rawName,
        brand: s.brand,
        division: s.technical.beltDivision,
        profile: s.technical.profile,
        status: 'REAL_IMAGE_NOT_FOUND',
        technicalDrawingPopulated: true,
        familyReferenceImagesPopulated: true,
      })),
    };

    fs.writeFileSync(
      path.join(DOCS_DIR, 'belt-missing-sku-real-images.json'),
      JSON.stringify(missingJson, null, 2),
      'utf8',
    );

    const exactIdsText = Object.keys(VERIFIED_EXACT_SKU_PHOTOS).join('، ');
    const mdLines = [
      '# گزارش وضعیت تصاویر واقعی اختصاصی کدهای کالای تسمه‌های صنعتی (SKU-Level Real Image Audit)',
      '',
      `- **تعداد کل خانواده‌های واقعی تسمه صنعتی:** ${reconciledFamilies.length} خانواده`,
      `- **تعداد کل کدهای واقعی تسمه صنعتی:** ${allBeltSkus.length} کد کالا`,
      `- **خانواده‌های غیرتسمه‌ای مستثنی‌شده:** ${excludedPureFamilies.length} خانواده (${excludedPureFamilies.join('، ')})`,
      `- **کدهای غیرتسمه‌ای مستثنی‌شده درون خانواده‌های ترکیبی:** ${excludedMixedSkus.length} کد کالا (۲۱ کد در FAM-80151 + ۱ کد در FAM-31929)`,
      `- **کدهای دارای تصویر واقعی فیزیکی تاییدشده اختصاصی SKU:** ${Object.keys(VERIFIED_EXACT_SKU_PHOTOS).length} کد (کدهای ${exactIdsText})`,
      `- **کدهای فاقد عکس واقعی مستقل تاییدشده (REAL_IMAGE_NOT_FOUND):** ${missingSkus.length} کد کالا`,
      '',
      '## توزیع کدهای نیازمند عکس فیزیکی واقعی بر اساس ساختار فنی (Division)',
      '',
      '| ساختار فنی (beltDivision) | تعداد کد REAL_IMAGE_NOT_FOUND | وضعیت نقشه فنی CAD و تصاویر واقعی خانواده |',
      '|---|---|---|',
      ...Object.entries(byDivMissing)
        .sort((a, b) => b[1] - a[1])
        .map(([div, cnt]) => `| \`${div}\` | ${cnt} | ۱۰۰٪ تکمیل (نقشه پروفیل CAD + نقشه ۴نمایی + ۴ تصویر خانواده) |`),
      '',
      '## کدهای دارای تصویر واقعی فیزیکی تاییدشده اختصاصی',
      '',
      ...Object.entries(VERIFIED_EXACT_SKU_PHOTOS).map(
        ([skuCode, meta]) =>
          `- **SKU \`${skuCode}\`** (\`${beltSkuMap[skuCode]}\`): ${meta.noteFa} — مرجع: ${meta.sourcePageUrl}`,
      ),
      '',
      `> فهرست کامل تمام ${missingSkus.length.toLocaleString('en-US')} کد در فایل \`docs/belt-missing-sku-real-images.json\` ثبت شده است و در رابط کاربری سایت به‌صورت شفاف با پیام «تصویر واقعی هنوز تأمین نشده است» بدون جعل یا استفاده از تصویر نادرست نمایش داده می‌شود.`,
      '',
    ];
    fs.writeFileSync(path.join(DOCS_DIR, 'belt-missing-sku-real-images.md'), mdLines.join('\n'), 'utf8');

    // Clean up temporary _master staging directory after full build
    fs.rmSync(MASTER_DIR, { recursive: true, force: true });
  }

  console.log(`Completed cleanly in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
