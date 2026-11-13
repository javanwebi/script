import { STORE_ASSETS } from '../assets/images';
import { getProductImageUrl } from '../assets/imagesproducts';
import type { Product } from '../types';

const BELT_GALLERY = [
  STORE_ASSETS.subcategories.timingBeltHero,
  STORE_ASSETS.products.forzaBelt,
  STORE_ASSETS.subcategories.vbeltRibbedHero,
  STORE_ASSETS.categories.belts,
  STORE_ASSETS.products.pvcBelt,
] as const;

const BEARING_GALLERY = [
  STORE_ASSETS.products.bearing,
  STORE_ASSETS.products.bearingNsk,
  STORE_ASSETS.forzaSubBearing,
  STORE_ASSETS.categories.bearings,
] as const;

const PULLEY_GALLERY = [
  STORE_ASSETS.products.aluPulley,
  STORE_ASSETS.categories.pulleys,
  STORE_ASSETS.heroPulley,
] as const;

const FLUID_GALLERY = [
  STORE_ASSETS.products.valve,
  STORE_ASSETS.products.pump,
  STORE_ASSETS.products.flange,
  STORE_ASSETS.products.pipes,
  STORE_ASSETS.swrSubValve,
  STORE_ASSETS.swrSubFlanges,
  STORE_ASSETS.swrSubElbow,
  STORE_ASSETS.swrSubPipes,
] as const;

const hashCode = (input: string): number => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
};

export function resolveSiteFallbackByText(textInput?: string | null, seedInput?: string | null): string {
  const text = String(textInput || '').toLowerCase();
  const seed = hashCode(String(seedInput || textInput || 'sanatpish'));

  if (/برس|فرچه|brush/i.test(text)) {
    return STORE_ASSETS.subcategories.industrialBrushes;
  }
  if (/سنسور|نگهدارنده سنسور|sensor/i.test(text)) {
    return STORE_ASSETS.predictiveMaintenanceSensor;
  }
  if (/ریل|گاید|پروفیل آلومینیوم|پایه کشویی|نرده استیل|guide rail/i.test(text)) {
    return STORE_ASSETS.subcategories.guideRailsProfiles;
  }
  if (/نسوز|برزنتی|تفلون|نخ نسوز|ptfe|refractory/i.test(text)) {
    return STORE_ASSETS.subcategories.refractoryPtfeCord;
  }
  if (/توری|مش|سرند|wire mesh|screen/i.test(text)) {
    return STORE_ASSETS.subcategories.wireMeshScreens;
  }
  if (/اسپاتول|روتاری|خطوط لعاب|چاپ سرامیک|squeegee/i.test(text)) {
    return STORE_ASSETS.subcategories.ceramicGlazeRotary;
  }
  if (/اسفنج|ابر|اسکاج|نوار اسفنجی|sponge|foam|scourer/i.test(text)) {
    return STORE_ASSETS.subcategories.spongesFoamScourers;
  }
  if (/تسمه بارکش|تسمه فلت|دستگاه.*جوش|flat belt|belt welder/i.test(text)) {
    return STORE_ASSETS.subcategories.flatBeltsWelder;
  }
  if (/پولی|فلکه|pulley|تیپربوش|bushing/i.test(text)) {
    return PULLEY_GALLERY[seed % PULLEY_GALLERY.length];
  }
  if (/تایم|timing|htd|gt\d|\b\d+m\b|\bt\d+\b|\bxl\b|\bxh\b/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.subcategories.timingBeltHero : STORE_ASSETS.products.forzaBelt;
  }
  if (/جوشی|پلی.?یورتان|پلی.?اورتان|\bpu\b|گرد|crc/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.subcategories.puWeldedBeltHero : STORE_ASSETS.products.pvcBelt;
  }
  if (/شیاری|ribbed|\bpk\b|\bpy\b|\bpl\b|\bpj\b/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.subcategories.vbeltRibbedHero : STORE_ASSETS.categories.belts;
  }
  if (/اسپشیال|کلاسیک|\bspa\b|\bspb\b|\bspc\b|\bspz\b|\bxpa\b|\bxpb\b|\bxpc\b|\bxpz\b|\bax\b|\bbx\b|\bcx\b|وی.?بلت|v-belt|گریپ|سوراخ.?دار/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.subcategories.vbeltRibbedHero : STORE_ASSETS.categories.belts;
  }
  if (/تسمه|belt|انتقال نیرو/i.test(text)) {
    return BELT_GALLERY[seed % BELT_GALLERY.length];
  }
  if (/بلبرینگ|رولبرینگ|یاتاقان|bearing|nsk|skf|fag|koyo/i.test(text)) {
    return BEARING_GALLERY[seed % BEARING_GALLERY.length];
  }
  if (/زنجیر|چرخ.?زنجیر|chain|sprocket|دنده/i.test(text)) {
    return STORE_ASSETS.categories.chains;
  }
  if (/کوپلینگ|coupling|اتصال محور|یراق|لولا|چرخ/i.test(text)) {
    return STORE_ASSETS.forzaSubCoupling;
  }
  if (/نقاله|conveyor|مدولار|pvc/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.categories.conveyor : STORE_ASSETS.products.pvcBelt;
  }
  if (/رولر|غلتک|رولیک|roller|بوش|فنر|پین|خار/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.subcategories.rollerConveyorHero : STORE_ASSETS.products.ceramicRoller;
  }
  if (/سرامیک|کاشی|ceramic/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.products.ceramicParts : STORE_ASSETS.categories.ceramic;
  }
  if (/نساجی|بافندگی|ریسندگی|textile/i.test(text)) {
    return STORE_ASSETS.categories.textile;
  }
  if (/شیر|والو|valve/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.products.valve : STORE_ASSETS.swrSubValve;
  }
  if (/فلنج|flange/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.products.flange : STORE_ASSETS.swrSubFlanges;
  }
  if (/لوله|زانو|اتصالات|pipe|elbow|fitting/i.test(text)) {
    return FLUID_GALLERY[seed % FLUID_GALLERY.length];
  }
  if (/پمپ|سیالات|pump/i.test(text)) {
    return STORE_ASSETS.products.pump;
  }
  if (/موتور|گیربکس|الکتروموتور|برق|اتوماسیون|motor/i.test(text)) {
    return STORE_ASSETS.products.motor;
  }
  if (/کاسه.?نمد|اورینگ|پکینگ|آب.?بند|پلیمری|لاستیکی|ضربه.?گیر|مکنده|seal/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.subcategories.polymerSealsHero : STORE_ASSETS.forzaSubFittings;
  }
  if (/مهندسی معکوس|ساخت|سفارشی/i.test(text)) {
    return STORE_ASSETS.reverseEngineeringLab;
  }
  return BELT_GALLERY[seed % BELT_GALLERY.length];
}

export function resolveSiteProductImage(product?: Partial<Product> | null, fallbackContext?: string): string {
  if (product) {
    const candidates = [
      ...(product.images || []),
      product.image,
      ...(product.galleryImages || []).map(img => img?.url),
      ...(product.variants || []).flatMap(v => v?.images || []),
    ].filter((val): val is string => Boolean(val && String(val).trim()));

    for (const raw of candidates) {
      const normalized = getProductImageUrl(raw);
      if (normalized) return normalized;
      if (/^(\/assets\/|\/src\/assets\/|\/images\/)/.test(raw.trim())) {
        return raw.trim();
      }
    }
  }

  const combinedText = [
    product?.name,
    product?.nameEn,
    product?.subcategory,
    product?.submenu,
    product?.categoryName,
    product?.brand,
    ...(product?.tags || []),
    fallbackContext,
  ]
    .filter(Boolean)
    .join(' ');

  return resolveSiteFallbackByText(combinedText, product?.code || product?.name || fallbackContext);
}
