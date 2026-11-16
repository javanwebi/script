import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { classifyBeltSku, detectConveyorSurfaceProfile } from '../src/data/beltCatalogAudit';
import { resolveEngineeringFamilyType } from '../src/data/catalogPhase1Reconstruction';
import type { Product, ProductVariant } from '../src/types';

const page = readFileSync(new URL('../src/pages/BeltCategoryExperience.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/pages/BeltCategoryExperience.css', import.meta.url), 'utf8');
const classifyBelt = (
  variantName: string,
  material: string,
  unit = 'حلقه',
  categorySlug = 'excel-v2-1-1',
  categoryName = 'تسمه تایمینگ'
) => {
  const product = {
    code: 'TEST-BELT-FAMILY',
    name: variantName,
    brand: 'GENERIC',
    categorySlug,
    categoryName,
    subcategory: 'تسمه صنعتی',
    technicalSpecs: [{ key: 'جنس و متریال', value: material }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    inquiryOnly: true,
    images: [],
    tags: [],
    unit,
  } as unknown as Product;
  const variant = {
    code: 'TEST-BELT-SKU',
    size: 'standard',
    name: variantName,
    unit,
    technicalSpecs: [],
  } as unknown as ProductVariant;
  return classifyBeltSku(product, variant);
};

const route = readFileSync(new URL('../src/pages/CategoryPage.tsx', import.meta.url), 'utf8');
const directSkus = readFileSync(new URL('../src/components/catalog/DirectSkuProducts.tsx', import.meta.url), 'utf8');

test('direct SKU records are rendered in the same belt collection as family cards', () => {
  assert.match(route, /if \(resolveCategorySlug\(slug \|\| ''\) === canonicalBeltSlug\) \{\s*return <Navigate to=\{`\/categories\$\{location\.search\}\$\{location\.hash\}`\} replace \/>/);
  assert.doesNotMatch(route, /return <BeltCategoryExperience \/>/);
  assert.doesNotMatch(route, /DirectSkuProducts categorySlug=\{canonicalBeltSlug\}/);
  assert.match(page, /const directSkuRecords = useDirectSkus\(BELT_SLUG, 'excel-v2-1-'\)/);
  assert.match(page, /const directSkuProducts = useMemo/);
  assert.match(page, /const collectionProducts = useMemo/);
  assert.match(page, /detailPath=\{directSkuCodes\.has\(p\.code\)/);
  assert.match(directSkus, /\/api\/catalog\/direct-skus/);
  assert.match(directSkus, /DirectSkuProductCard/);
  assert.doesNotMatch(directSkus, /قطعات کم‌تعداد بدون الزام به ساخت خانواده/);
});

test('the belt page defaults to the complete live catalogue and retains real catalogue filters', () => {
  assert.match(page, /searchParams\.get\('sub'\) \|\| 'all'/);
  assert.match(page, /getProductsByCategory\(BELT_SLUG, 12000\)/);
  assert.match(page, /subscribeCatalogChanges/);
  assert.match(page, /matchesCatalogCategory/);
  assert.match(page, /matchesProductSearch/);
  assert.match(page, /deriveProfileOptions\(collectionProducts\)/);
  assert.match(page, /const isVbelt = selectedFamily === 'تسمه V-BELT'/);
  assert.doesNotMatch(page, /isClassic/);
  assert.match(page, /filters\.brands/);
  assert.match(page, /productHasDisplayBrand\(product, brand\)/);
  assert.match(page, /filters\.minimumLength/);
  assert.match(page, /filters\.maximumLength/);
  assert.match(page, /filters\.minimumPrice/);
  assert.match(page, /filters\.maximumPrice/);
  assert.match(page, /filters\.inStock/);
  assert.match(page, /filters\.inStock && !\(product\.stockKnown && product\.stock > 0\)/);
  assert.match(page, /filters\.quoteOnly/);
  assert.match(page, /sortBy === 'code'/);
  assert.match(page, /sortBy === 'price-low'/);
  assert.match(page, /sortBy === 'price-high'/);
  assert.match(page, /const pageSize = 24/);
  assert.match(page, /<MemberAccess code=\{?product\.code/);
});

test('the reference composition adds a real featured product, list rows and a working comparison flow', () => {
  assert.match(page, /function FeaturedProductCard/);
  assert.match(page, /featuredProduct && <FeaturedProductCard/);
  assert.match(page, /className="bce-products-list"/);
  assert.match(page, /className="bce-compare-dock"/);
  assert.match(page, /setCompareOpen\(true\)/);
  assert.match(page, /current\.length < 4/);
  assert.match(page, /compareProducts\.length < 2/);
  assert.match(page, /className="bce-compare-table"/);
  assert.match(page, /comparisonSpecKeys\.map/);
  assert.match(page, /aria-modal="true"/);
});

test('the redesign retains the guide, industry links, FORZA entry points and mobile filter sheet', () => {
  for (const marker of [
    'bce-selection-guide',
    'bce-industry-section',
    'bce-help-cards',
    'bce-bottom-line',
    'bce-sheet-backdrop',
    '/identify-part',
    '/ai-consult'
  ]) {
    assert.ok(page.includes(marker), 'missing retained page content or route: ' + marker);
  }
  assert.match(page, /applySheet/);
  assert.match(page, /FilterFields value=\{draft\}/);
});

test('the approved cream industrial visual system has explicit desktop, mobile and reduced-motion rules', () => {
  assert.match(css, /--bce-orange: #E56B1E/);
  assert.match(css, /--bce-bg: #fbf6ef/);
  assert.match(css, /bce-hero-picture/);
  assert.match(css, /height: clamp\(164px, 17\.5vw, 205px\) !important/);
  assert.match(css, /direction: rtl/);
  assert.match(css, /clip-path: polygon\(0 0, 100% 0, 84% 100%, 0 100%\)/);
  assert.match(css, /grid-template-columns: minmax\(210px, 25%\) minmax\(0, 1fr\) minmax\(195px, 23%\)/);
  assert.match(css, /\.bce-catalog \{[\s\S]*?direction: rtl;[\s\S]*?grid-template-columns: minmax\(210px, 25%\) minmax\(0, 1fr\) minmax\(195px, 23%\)/);
  assert.match(css, /DOM order is filters, results, featured; RTL grid flow places them right, center, left/);
  assert.match(css, /grid-template-columns: minmax\(190px, 25%\) minmax\(0, 1fr\)/);
  for (const width of ['860px', '640px', '390px', '360px']) {
    assert.ok(css.includes('max-width: ' + width), 'missing responsive breakpoint ' + width);
  }
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('belt product cards do not invent technical dimensions, material or stock claims', () => {
  assert.match(page, /const cardSpecs = \(product\.technicalSpecs \|\| \[\]\)/);
  assert.doesNotMatch(page, /'۱۵۰ استاندارد'|'۳۰ میلی‌متر'/);
  assert.match(page, /استعلام موجودی/);
});

test('direct SKU cards do not borrow inferred product imagery or placeholder manufacturer names', () => {
  assert.match(page, /disableFallbackImage=\{directSkuCodes\.has\(p\.code\)\}/);
  assert.match(page, /disableFallback=\{disableFallbackImage\s*\|\|\s*Boolean\(beltMedia\)\}/);
  assert.match(page, /تصویر تأییدشده ثبت نشده/);
  assert.doesNotMatch(page, /product\.brand \|\| 'قطعات صنعتی'/);
});

test('belt subcategory navigation counts include unique direct SKU records as well as family records', () => {
  assert.match(page, /const familyCodeSet = useMemo/);
  assert.match(page, /filter\(product => !familyCodeSet\.has/);
  assert.match(page, /const displayBrands = useMemo\([\s\S]*?brands\.filter/);
  assert.doesNotMatch(page, /const standard = \['Megadyne'/);
  assert.match(page, /products\.filter\(product => productHasDisplayBrand\(product, brand\)\)/);
  assert.match(page, /const directSkuCount = directSkuRecords\.filter/);
  assert.match(page, /counts\.set\(option\.id, matchingFamilies\.length \+ directSkuCount\)/);
});

test('PVC conveyor surface trade labels remain distinct catalogue profiles', () => {
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC سنگی').profile, 'PVC_STONE_SURFACE');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC پامرغی').profile, 'PVC_PAMARGHI_PATTERN');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC کله قندی').profile, 'PVC_CONICAL_CLEAT');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC کله قندی سوراخ دار').profile, 'PVC_CONICAL_CLEAT');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC چمنی').profile, 'PVC_GRASS_PATTERN');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC لوزی').profile, 'PVC_DIAMOND_PATTERN');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC آجدار').profile, 'PVC_ROUGH_TOP');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC ساده').profile, 'PVC_SMOOTH');

  // Match the Arabic-script spellings present in the imported production rows.
  assert.equal(detectConveyorSurfaceProfile('نوار PVC كله قندي سوراخ دار 2200 * 4200').profile, 'PVC_CONICAL_CLEAT');
  assert.equal(detectConveyorSurfaceProfile('نوار PVC پامرغي اصلي 630 * 10860').profile, 'PVC_PAMARGHI_PATTERN');
  assert.equal(detectConveyorSurfaceProfile('نوار PVC سنگي 9 * 95 * 12600').profile, 'PVC_STONE_SURFACE');
});

test('PVC surface families are invariant to SKU dimensions and keep conical perforation as a SKU detail', () => {
  const stoneShort = classifyBelt('نوار PVC سنگي 9 * 95 * 8260', 'PVC', 'حلقه', 'excel-v2-2-1', 'نوار نقاله صنعتی');
  const stoneLong = classifyBelt('نوار PVC سنگي 9 * 95 * 12600', 'PVC', 'حلقه', 'excel-v2-2-1', 'نوار نقاله صنعتی');
  const chicken = classifyBelt('نوار PVC پامرغي 650 * 8490', 'PVC', 'حلقه', 'excel-v2-2-1', 'نوار نقاله صنعتی');
  const cone = classifyBelt('نوار PVC كله قندي 2200 * 4150', 'PVC', 'حلقه', 'excel-v2-2-1', 'نوار نقاله صنعتی');
  const perforatedCone = classifyBelt('نوار PVC كله قندي سوراخ دار 2200 * 4200', 'PVC', 'حلقه', 'excel-v2-2-1', 'نوار نقاله صنعتی');

  assert.equal(stoneShort.proposedFamilyId, stoneLong.proposedFamilyId);
  assert.notEqual(stoneShort.proposedFamilyId, chicken.proposedFamilyId);
  assert.notEqual(stoneShort.proposedFamilyId, cone.proposedFamilyId);
  assert.equal(cone.proposedFamilyId, perforatedCone.proposedFamilyId);
});

test('unknown PVC surface wording and transparency are not silently classified as smooth', () => {
  for (const name of ['نوار نقاله PVC سبز', 'نوار PVC شفاف عرض 80CM', 'نوار PVC زرد 1 ميل']) {
    const result = detectConveyorSurfaceProfile(name);
    assert.equal(result.profile, 'PVC_SURFACE_UNSPECIFIED');
    assert.equal(result.requiresReview, true);
  }
});


test('belt audit keeps V-belts out of timing APL and keeps Poly-V out of special V-belt leaf', () => {
  const gripV = classifyBelt('تسمه جوشی V روکش گریپ‌دار پروفیل B', 'لاستیک کلروپرن');
  assert.equal(gripV.proposedCategorySlug, 'excel-v2-1-2');
  assert.equal(gripV.proposedSubmenu, 'کلاسیک و دنده‌دار');

  const polyV = classifyBelt('تسمه چندشیاری Poly-V پروفیل PJ', 'لاستیک', 'حلقه', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
  assert.equal(polyV.proposedCategorySlug, 'UNRESOLVED');
});

test('belt audit does not place PU trapezoidal sections under flat welded belts', () => {
  const sectionB = classifyBelt('تسمه جوشی پلی‌یورتان پروفیل B', 'TPU پلی‌یورتان', 'حلقه', 'excel-v2-1-3', 'تسمه جوشی با سایت');
  assert.equal(sectionB.proposedCategorySlug, 'UNRESOLVED');
  assert.equal(sectionB.technical.beltDivision, 'welded-pu-v-section');
  assert.equal(sectionB.proposedSubmenu, 'پروفیل جوشی فاقد برگ مصوب');
  assert.match(sectionB.taxonomyGap || '', /LEAF-MISSING/);
});

test('belt audit routes crowned CRC/TRC to hauling belts, not welded PU round belts', () => {
  const ridge = classifyBelt('تسمه ذوزنقه‌ای تاج‌دار CRC گرده‌ماهی', 'لاستیک کلروپرن ضدسایش', 'حلقه', 'excel-v2-1-3', 'تسمه جوشی با سایت');
  assert.equal(ridge.proposedCategorySlug, 'excel-v2-1-4');
  assert.equal(ridge.proposedSubmenu, 'تسمه بارکش');
  assert.equal(ridge.proposedLeaf, 'انواع تسمه بارکش صنعتی');
});

test('SWR XP wedge profiles are raw-edge cogged, not wrapped V-belts', () => {
  for (const profile of ['XPZ', 'XPA', 'XPB', 'XPC']) {
    const result = classifyBelt(`تسمه V شکل پروفیل ${profile} 1980 SWR`, 'لاستیک', 'حلقه', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
    assert.match(result.technical.bodyMaterial, /Raw-Edge Cogged/);
    assert.match(result.proposedFamilyNameFa, /دنده‌ای لبه‌خام/);
    assert.match(result.proposedFamilyNameEn, /Raw-Edge Cogged/);
    assert.doesNotMatch(result.technical.bodyMaterial, /Wrapped V-Belt/);
    if (profile === 'XPZ') {
      assert.equal(result.proposedLeaf, 'SPA , SPB , SPC و دندانه‌دار');
      assert.equal(result.taxonomyGap, null);
    }
  }
});

test('8V and 8VX are heavy-duty wedge profiles, not classical V-belt leaf members', () => {
  const wrapped = classifyBelt('تسمه V شکل پروفیل 8V 2500 SWR', 'لاستیک', 'حلقه', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
  const cogged = classifyBelt('تسمه V شکل پروفیل 8VX 2500 SWR', 'لاستیک', 'حلقه', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
  for (const result of [wrapped, cogged]) {
    assert.equal(result.proposedSubmenu, 'تسمه اسپشیال');
    assert.equal(result.proposedLeaf, null);
    assert.match(result.taxonomyGap || '', /AMERICAN-WEDGE-LEAF-MISSING/);
  }
  assert.match(cogged.technical.bodyMaterial, /Raw-Edge Cogged/);
  assert.match(cogged.proposedFamilyNameFa, /دنده‌ای لبه‌خام/);
});

test('3V, 5V and 8V are American wedge belts, separate from metric SPZ/SPA/SPB/SPC narrow wedge', () => {
  for (const profile of ['3V', '5V', '8V']) {
    const result = classifyBelt(`تسمه V شکل پروفیل ${profile} 2500 SWR`, 'لاستیک', 'حلقه', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
    assert.equal(result.technical.beltDivision, 'vbelt-wedge');
    assert.equal(result.proposedSubmenu, 'تسمه اسپشیال');
    assert.equal(result.proposedLeaf, null);
    assert.match(result.taxonomyGap || '', /AMERICAN-WEDGE-LEAF-MISSING/);
  }
  const narrow = classifyBelt('تسمه V شکل پروفیل SPB 2500 SWR', 'لاستیک', 'حلقه', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
  assert.equal(narrow.technical.beltDivision, 'vbelt-narrow-wedge');
});

test('CC is parsed as a double-sided hexagonal V-belt using its standard section dimensions', () => {
  const result = classifyBelt('تسمه V شکل پروفیل CC 1950 SWR', 'لاستیک', 'حلقه', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
  assert.equal(result.technical.profile, 'CC');
  assert.equal(result.technical.sidedness, 'double-sided');
  assert.equal(result.technical.nominalWidthMm, 22);
  assert.equal(result.technical.beltThicknessMm, 17);
  assert.equal(result.proposedSubmenu, 'پروفیل شش‌ضلعی دوطرفه');
  assert.equal(result.proposedLeaf, null);
});

test('crowned CRC and banded V-belts do not invent rubber compounds, cords or standards', () => {
  const crc = classifyBelt('تسمه گرده ماهی CRC 300 GNR', 'لاستیک', 'حلقه', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی');
  assert.equal(crc.technical.beltDivision, 'vbelt-crowned-crc');
  assert.match(crc.technical.standardReference, /تأیید نشده/);
  assert.match(crc.technical.bodyMaterial, /ترکیب دقیق نیازمند دیتاشیت/);
  assert.match(crc.technical.tensileCord, /نیازمند دیتاشیت/);
  assert.doesNotMatch(crc.technical.standardReference, /C-Belt Standard/);

  const banded = classifyBelt('تسمه SWR 4RSPC4250', 'لاستیک', 'حلقه', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
  assert.equal(banded.technical.beltDivision, 'vbelt-banded');
  assert.match(banded.technical.bodyMaterial, /ترکیب دقیق لاستیک نیازمند دیتاشیت/);
  assert.match(banded.technical.tensileCord, /نیازمند دیتاشیت/);
  assert.doesNotMatch(banded.technical.bodyMaterial, /Neoprene/);
});

test('engineering family types keep crowned CRC, welded PU round, and banded V-belts separate', () => {
  const crowned = resolveEngineeringFamilyType({
    productType: 'تسمه گرده‌ماهی تاج‌دار CRC مداربسته',
    profile: 'CRC',
    material: 'لاستیک',
    construction: 'crowned top',
    proposedCategorySlug: 'excel-v2-1-4',
    engineeringSpecifications: { beltDivision: 'vbelt-crowned-crc', sidedness: 'single-sided' },
  });
  const welded = resolveEngineeringFamilyType({
    productType: 'تسمه جوشی پلی‌یورتان ترموپلاستیک پروفیل CRC',
    profile: 'CRC',
    material: 'TPU پلی‌یورتان',
    construction: 'heat-welded',
    proposedCategorySlug: 'excel-v2-1-3',
    engineeringSpecifications: { beltDivision: 'welded-pu-round-crc', sidedness: 'symmetric-round-hex' },
  });
  const banded = resolveEngineeringFamilyType({
    productType: 'تسمه V شکل به‌پشت‌پیوسته Banded V-Belt',
    profile: '3VX-BANDED',
    material: 'لاستیک',
    construction: 'tie-band',
    proposedCategorySlug: 'excel-v2-1-2',
    engineeringSpecifications: { beltDivision: 'vbelt-banded', sidedness: 'single-sided' },
  });
  const doubleV = resolveEngineeringFamilyType({
    productType: 'تسمه V دوطرفه AA',
    profile: 'AA',
    material: 'لاستیک',
    construction: 'wrapped',
    proposedCategorySlug: 'excel-v2-1-2',
    engineeringSpecifications: { beltDivision: 'vbelt-hexagonal', sidedness: 'double-sided' },
  });
  assert.equal(crowned.familyTypeId, 'FT-BELT-CROWNED-CRC');
  assert.equal(welded.familyTypeId, 'FT-BELT-ROUND-CRC');
  assert.equal(banded.familyTypeId, 'FT-VBELT-BANDED');
  assert.equal(doubleV.familyTypeId, 'FT-VBELT-HEXAGONAL');
  const americanWedge = resolveEngineeringFamilyType({
    productType: 'تسمه V گوه‌ای آمریکایی 8V',
    profile: '8V',
    material: 'لاستیک',
    construction: 'wrapped',
    proposedCategorySlug: 'excel-v2-1-2',
    engineeringSpecifications: { beltDivision: 'vbelt-wedge', sidedness: 'single-sided' },
  });
  assert.equal(americanWedge.familyTypeId, 'FT-VBELT-WEDGE');
  assert.match(doubleV.familyTypeName, /Double V/);
});

test('belt audit does not force automotive RU or unsupported T10 into neighbouring timing leaves', () => {
  const auto = classifyBelt('تسمه تایمینگ خودرویی AUTO-RU', 'لاستیک کلروپرن');
  assert.equal(auto.proposedCategorySlug, 'UNRESOLVED');

  const t10 = classifyBelt('تسمه تایمینگ T10', 'TPU پلی‌یورتان');
  assert.equal(t10.proposedSubmenu, 'انواع گام و کدهای تایمینگ');
  assert.equal(t10.proposedLeaf, null);
  assert.match(t10.taxonomyGap || '', /GAP-TIMING-T10-LEAF-MISSING/);

  const rubber3m = classifyBelt('تسمه تایمینگ 3M', 'لاستیک کلروپرن');
  assert.equal(rubber3m.proposedSubmenu, 'لاستیکی فابریک');
  assert.equal(rubber3m.proposedLeaf, 'لاستیکی فابریک ساده و دنده‌دار');
  assert.equal(rubber3m.technical.profile, '3M');
  assert.equal(rubber3m.technical.pitchMm, 3);
  assert.equal(rubber3m.technical.beltDivision, 'timing-htd-rpp-single');
  assert.match(rubber3m.technical.bodyMaterial, /لاستیک کلروپرن/);
});

test('belt audit distinguishes V-belt meter supply from its profile menu path', () => {
  const meterZ = classifyBelt('تسمه V شکل پروفیل Z متری', 'لاستیک', 'متر', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
  assert.equal(meterZ.proposedSubmenu, 'کلاسیک و دنده‌دار');
  assert.equal(meterZ.proposedLeaf, 'Z (9.5) , M , A , B , C , D , E');
  assert.equal(meterZ.technical.profile, 'Z');
  assert.equal(meterZ.technical.supplyForm, 'open-ended-meter');

  const meterB = classifyBelt('تسمه V شکل پروفیل B متری', 'لاستیک', 'متر', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)');
  assert.equal(meterB.proposedSubmenu, 'وی‌بلت متری');
});
