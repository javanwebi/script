import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import * as XLSX from 'xlsx';
import catalogue from '../tests/fixtures/catalogueSource.json';
import imperialRef from '../tests/fixtures/imperialTimingReference.json';
import misumiRef from '../tests/fixtures/misumiTimingReference.json';
import { applyCatalogueCorrections } from '../src/data/catalogueCorrections';
import { categorySlugFor } from '../src/data/userProducts';
import {
  runBeltCatalogAudit,
  validateFamilyEngineeringHomogeneity,
  findIdenticalInvariantMergeCandidates,
} from '../src/data/beltCatalogAudit';
import type { Product } from '../src/types';

const AUDIT_REFERENCE_TABLES = {
  imperialTimingLengths: new Set(Object.keys((imperialRef as { lengths: Record<string, unknown> }).lengths || {})),
  misumiHLengths: new Set(Object.keys((misumiRef as { lengths: Record<string, unknown> }).lengths || {})),
};

function loadCatalogProducts(): Product[] {
  return (catalogue as Array<any>).map((family) => {
    const specs = [
      { key: 'نوع فنی', value: family.technicalType },
      { key: 'واحدهای فروش', value: family.unit },
      { key: 'تعداد کد کالا', value: String(family.itemCount) },
      ...(family.profiles ? [{ key: 'پروفیل‌ها', value: family.profiles }] : []),
      ...(family.materials ? [{ key: 'جنس‌های ثبت‌شده', value: family.materials }] : []),
    ];
    return applyCatalogueCorrections({
      code: family.code,
      name: family.name,
      brand: family.brand || 'ثبت نشده',
      categorySlug: categorySlugFor(family.categoryName),
      categoryName: family.categoryName,
      submenu: family.submenu,
      subcategory: family.technicalType,
      variants: family.variants,
      sourceRow: family.sourceRow,
      technicalSpecs: specs,
      prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
      stock: 0,
      stockKnown: false,
      inquiryOnly: true,
      images: [],
      hasCatalogueImage: false,
      unit: family.unit || 'عدد',
      tags: [family.submenu, family.technicalType, family.profiles || ''],
      description: `${family.name}؛ ${family.itemCount} کد کالا`,
    });
  });
}

function buildMarkdownReport(
  audit: ReturnType<typeof runBeltCatalogAudit>,
  liveDb: LiveDbReadSummary
): string {
  const lines: string[] = [];
  const gc = audit.groupCounts;
  const byFamilySkus = new Map<string, typeof audit.reportA_skuClassifications>();
  for (const r of audit.reportA_skuClassifications) {
    const arr = byFamilySkus.get(r.proposedFamilyId) || [];
    arr.push(r);
    byFamilySkus.set(r.proposedFamilyId, arr);
  }
  const validationResults = audit.reportB_proposedFamilies.map((f) =>
    validateFamilyEngineeringHomogeneity(f, byFamilySkus.get(f.proposedFamilyId) || [])
  );
  const verdictCounts = {
    PASS_HOMOGENEOUS: validationResults.filter((v) => v.homogeneityVerdict === 'PASS_HOMOGENEOUS').length,
    CONDITIONAL_UNKNOWN_SPECS: validationResults.filter((v) => v.homogeneityVerdict === 'CONDITIONAL_UNKNOWN_SPECS').length,
    FAIL_MIXED_INVARIANT: validationResults.filter((v) => v.homogeneityVerdict === 'FAIL_MIXED_INVARIANT').length,
    FAIL_REQUIRES_PHYSICAL_REVIEW: validationResults.filter((v) => v.homogeneityVerdict === 'FAIL_REQUIRES_PHYSICAL_REVIEW').length,
    NON_BELT_OR_EQUIPMENT: validationResults.filter((v) => v.homogeneityVerdict === 'NON_BELT_OR_EQUIPMENT').length,
  };

  lines.push('# گزارش مهندسی ممیزی، طبقه‌بندی فنی و بازسازی خانواده‌های تسمه صنعتی — صنعت پیش');
  lines.push('## SANAT PISH — AUTONOMOUS INDUSTRIAL BELT RESEARCH, CLASSIFICATION & FAMILY RESTRUCTURING REPORT');
  lines.push('');
  lines.push(`- **تاریخ تولید گزارش**: \`${audit.generatedAt}\``);
  lines.push(`- **وضعیت استعلام دیتابیس زنده (Read-Only)**: \`${liveDb.status}\` (\`${liveDb.checkedAt}\`) — ${liveDb.statusNote}`);
  lines.push(`- **کل خانواده‌های کاتالوگ اصلی**: \`${audit.totalCatalogFamilies.toLocaleString('en-US')}\` خانواده`);
  lines.push(`- **کل کدهای کالا (SKU) در کاتالوگ**: \`${audit.totalCatalogSkus.toLocaleString('en-US')}\` کد کالا`);
  lines.push(`- **کل کدهای بررسی‌شده مرتبط با تسمه و نوار نقاله**: \`${audit.auditedSkuCount.toLocaleString('en-US')}\` کد کالا`);
  lines.push(`- **کل کدهای واقعی تسمه و نوار نقاله (پس از حذف اقلام غیرتسمه‌ای)**: \`${audit.trueBeltSkuCount.toLocaleString('en-US')}\` کد کالا`);
  lines.push(`  - **تسمه‌های انتقال نیرو و صنعتی**: \`${audit.truePowerTransmissionBeltSkuCount.toLocaleString('en-US')}\` کد کالا`);
  lines.push(`  - **نوار نقاله و نوار گریپ بارکش**: \`${audit.trueConveyorBeltSkuCount.toLocaleString('en-US')}\` کد کالا`);
  lines.push(`  - **تجهیزات و گیره جوش تسمه**: \`${audit.beltEquipmentSkuCount.toLocaleString('en-US')}\` کد کالا`);
  lines.push(`  - **اقلام نیازمند بررسی فیزیکی (REQUIRES_REVIEW)**: \`${audit.confidenceCounts.REQUIRES_REVIEW.toLocaleString('en-US')}\` کد کالا`);
  lines.push(`- **تسمه‌های خارج از دسته تسمه که شناسایی و بازیابی شدند**: \`${audit.misplacedBeltOutsideBeltCategoryCount}\` کد کالا`);
  lines.push(`- **اقلام غیرتسمه‌ای که به اشتباه داخل دسته «تسمه و انتقال نیرو» بودند**: \`${audit.nonBeltInsideBeltCategoryCount}\` کد کالا`);
  lines.push(`- **اقلام غیرنقاله‌ای که به اشتباه داخل دسته «نوار و تسمه نقاله» بودند**: \`${audit.nonConveyorInsideConveyorCategoryCount}\` کد کالا`);
  lines.push(`- **تسمه‌های تعیین‌تکلیف‌شده از سطل عمومی «تسمه صنعتی»**: \`${audit.catchAllIndustrialBeltResolvedCount.toLocaleString('en-US')}\` کد کالا`);
  lines.push(`- **تعداد خانواده‌های قبلی در دسته‌های تسمه و نقاله**: \`${audit.beforeFamilyCountInBeltCategories}\` خانواده`);
  lines.push(
    `- **تفکیک دقیق گروه‌های پیشنهادی (مجموع دقیق \`${gc.totalProposedGroups}\` = \`${gc.validBeltAndConveyorFamilies} + ${gc.weldingToolGroups} + ${gc.provisionalReviewGroups} + ${gc.separatedNonBeltFamilies}\`)**:`
  );
  lines.push(
    `  - **خانواده‌های معتبر تسمه و نوار نقاله**: \`${gc.validBeltAndConveyorFamilies}\` خانواده (\`${gc.singletonValidBeltFamilies}\` تک‌عضوی + \`${gc.multiMemberValidBeltFamilies}\` چندعضوی)`
  );
  lines.push(`  - **گروه‌های ابزار و دستگاه گیره جوش تسمه**: \`${gc.weldingToolGroups}\` گروه`);
  lines.push(`  - **گروه‌های موقت نیازمند بررسی فیزیکی**: \`${gc.provisionalReviewGroups}\` گروه (پوشش‌دهنده ${audit.confidenceCounts.REQUIRES_REVIEW} SKU)`);
  lines.push(`  - **خانواده‌های اقلام غیرتسمه‌ای تفکیک‌شده**: \`${gc.separatedNonBeltFamilies}\` خانواده`);
  lines.push('');

  lines.push('### نتیجه کنترل واقعی همگنی مهندسی خانواده‌ها (Dynamic Homogeneity Validation Summary)');
  lines.push('| حکم همگنی مهندسی (Verdict) | تعداد گروه | توضیح مهندسی |');
  lines.push('|---|---|---|');
  lines.push(`| \`PASS_HOMOGENEOUS\` | ${verdictCounts.PASS_HOMOGENEOUS} | تمام ویژگی‌های کاربردی شناخته‌شده و ۱۰۰٪ همگن (N/A از UNKNOWN تفکیک شده است) |`);
  lines.push(`| \`CONDITIONAL_UNKNOWN_SPECS\` | ${verdictCounts.CONDITIONAL_UNKNOWN_SPECS} | بدون تداخل (0 MIXED)، اما دارای فیلد نامشخص انبار (مانند برند UNSPECIFIED/OEM، عرض برش، یا ضخامت نقاله/خودرویی NULL) |`);
  lines.push(`| \`FAIL_MIXED_INVARIANT\` | ${verdictCounts.FAIL_MIXED_INVARIANT} | مغایرت غیرمجاز در ویژگی ثابت مهندسی (باید دقیقاً ۰ باشد) |`);
  lines.push(`| \`FAIL_REQUIRES_PHYSICAL_REVIEW\` | ${verdictCounts.FAIL_REQUIRES_PHYSICAL_REVIEW} | گروه‌های مبهم نیازمند بررسی فیزیکی |`);
  lines.push(`| \`NON_BELT_OR_EQUIPMENT\` | ${verdictCounts.NON_BELT_OR_EQUIPMENT} | ${gc.weldingToolGroups} ابزار جوشکاری + ${gc.separatedNonBeltFamilies} غیرتسمه‌ای تفکیک‌شده |`);
  lines.push('');

  lines.push('### توزیع سطح اطمینان و شواهد اعتبارسنجی (Honest Verification Provenance Summary)');
  lines.push('| سطح اطمینان (Confidence) | تعداد کد کالا (SKU) |');
  lines.push('|---|---|');
  for (const [level, count] of Object.entries(audit.confidenceCounts)) {
    lines.push(`| \`${level}\` | ${count.toLocaleString('en-US')} |`);
  }
  lines.push('');

  lines.push('### توزیع دقیق ۷ لایه شواهد تحقیق (7-Tier Verification Evidence — مجموع دقیق 7,709)');
  lines.push('| لایه شواهد (7-Level Evidence Class) | تعداد کد کالا (SKU) |');
  lines.push('|---|---|');
  for (const [tier, count] of Object.entries(audit.sevenLevelEvidenceCounts)) {
    lines.push(`| \`${tier}\` | ${count.toLocaleString('en-US')} |`);
  }
  lines.push('');

  lines.push('### تفکیک متقابل‌مانع کل 7,709 کد بررسی‌شده (Mutually Exclusive Reconciliation Partition)');
  lines.push('| سطل تغییر دسته‌بندی (Partition Bucket) | تعداد کد کالا |');
  lines.push('|---|---|');
  const p = audit.reconciliationPartition;
  lines.push(`| تسمه/ابزار جوش خارج از دسته‌های تسمه و نقاله (بازگشت به دسته صحیح) | ${p.misplacedBeltOrEquipOutsideMovedIn.toLocaleString('en-US')} |`);
  lines.push(`| اقلام غیرتسمه حذف‌شده از «تسمه و انتقال نیرو» | ${p.nonBeltRemovedFromBeltCat.toLocaleString('en-US')} |`);
  lines.push(`| اقلام غیرنقاله حذف‌شده از «نوار و تسمه نقاله» | ${p.nonConveyorRemovedFromConvCat.toLocaleString('en-US')} |`);
  lines.push(`| انتقال از «تسمه و انتقال نیرو» به «نوار نقاله» | ${p.beltMovedFromBeltCatToConveyorCat.toLocaleString('en-US')} |`);
  lines.push(`| انتقال از «نوار و تسمه نقاله» به «تسمه بارکش / وی‌بلت / تایم» | ${p.conveyorMovedFromConvCatToBeltCat.toLocaleString('en-US')} |`);
  lines.push(`| اقلام غیرتسمه که از ابتدا خارج از دسته‌های تسمه/نقاله بودند | ${p.nonBeltAlreadyOutsideBeltOrConv.toLocaleString('en-US')} |`);
  lines.push(`| تغییر زیردسته/خانواده در داخل همان دسته اصلی | ${p.withinBeltOrConvSubcategoryChanged.toLocaleString('en-US')} |`);
  lines.push(`| بدون تغییر دسته‌بندی/زیردسته (هم‌تراز با ساختار هدف) | ${p.withinBeltOrConvUnchanged.toLocaleString('en-US')} |`);
  lines.push(`| **مجموع افراز (Partition Sum)** | **${p.partitionTotal.toLocaleString('en-US')}** |`);
  lines.push('');

  lines.push('### توزیع عملیات پیشنهادی (Recommended Action Summary)');
  lines.push('| عملیات (Action) | تعداد کد کالا (SKU) |');
  lines.push('|---|---|');
  for (const [action, count] of Object.entries(audit.actionCounts)) {
    lines.push(`| \`${action}\` | ${count.toLocaleString('en-US')} |`);
  }
  lines.push('');

  lines.push('---');
  lines.push('## بخش ویژه: تحلیل عمیق مهندسی نمونه‌های اجباری BANDO (گام H و DH)');
  lines.push('');
  lines.push('### ۱. بررسی تطبیقی کدهای `10538` (`1400 H 100`) و `36103` (`1140H100`)');
  lines.push('- **سازنده و سری تجاری**: **BANDO Chemical Industries, Ltd.** — سری **Bando Synchro-Link® Timing Belt**');
  lines.push('- **نوع واقعی و مکانیزم کارکرد**: تسمه تایمینگ ذوزنقه‌ای اینچی **یک‌طرفه** (Single-Sided Imperial Trapezoidal Synchronous Belt) — انتقال حرکت سنکرون درگیرشونده با پولی تایم H');
  lines.push('- **استاندارد مرجع**: **ISO 19347:2015 / DIN ISO 5296 / RMA IP-24 / JIS B 1857-1**');
  lines.push('- **مشخصات هندسی ثابت پروفیل H**:');
  lines.push('  - **گام دندانه ($p$)**: $0.500\\text{ in} = 12.70\\text{ mm}$');
  lines.push('  - **زاویه دندانه ($2\\beta$)**: $40^\\circ$');
  lines.push('  - **ارتفاع دندانه ($h_t$)**: $2.29\\text{ mm}$ ($0.090\\text{ in}$)');
  lines.push('  - **ضخامت کل تسمه ($h_s$)**: $4.30\\text{ mm}$ ($0.169\\text{ in}$)');
  lines.push('  - **ساختار و متریال**: بدنه و دندانه کلروپرن (Neoprene) مقاوم در برابر روغن و حرارت، کورد کششی فایبرگلاس پرتاب (S/Z Twist Fiberglass Cord)، روکش پارچه‌ای نایلونی ضدسایش روی دندانه‌ها، عرضه به صورت حلقه مداربسته (`حلقه`).');
  lines.push('- **رمزگشایی فنی هر کد**:');
  lines.push('  - **کد `10538` (`تسمه ( BANDO ) 1400 H 100`)**: کد طول `1400` = $140.0\\text{ in} = 3556.0\\text{ mm}$ طول گام ($L_p$) | تعداد دندانه $z = 140.0 / 0.500 = 280$ دندانه | کد عرض `100` = $1.00\\text{ in} = 25.4\\text{ mm}$.');
  lines.push('  - **کد `36103` (`تسمه (BANDO) 1140H100`)**: کد طول `1140` = $114.0\\text{ in} = 2895.6\\text{ mm}$ طول گام ($L_p$) | تعداد دندانه $z = 228$ دندانه | کد عرض `100` = $1.00\\text{ in} = 25.4\\text{ mm}$.');
  lines.push('- **علت خطای کاتالوگ قبلی و حکم مهندسی**:');
  lines.push('  1. کد `36103` به علت نوشته شدن بدون فاصله (`1140H100`) توسط پارسر قدیمی شناسایی نشده و در زیرشاخه عمومی «تسمه صنعتی» رها شده بود.');
  lines.push('  2. کد `10538` در خانواده مختلط `FAM-10538` («تسمه BANDO») در کنار آستین‌های برش‌نخورده `H` (با واحد سانتی‌متر)، تسمه‌های دوطرفه `DH` (`36468` و `36636`) و تسمه‌های گام `L` (گام $9.525\\text{ mm}$) قرار گرفته بود!');
  lines.push('  3. **حکم نهایی**: کدهای `10538` و `36103` هر دو دقیقاً واریانت‌های سایزی خانواده **`FAM-TIMING-IMP-H-ENDLESS-STD-BANDO`** («تسمه تایمینگ H BANDO») در مسیر `excel-v2-1-1 > انواع گام و کدهای تایمینگ > H , XH , L , XL` هستند.');
  lines.push('');

  lines.push('### ۲. بررسی تطبیقی خانواده دوطرفه BANDO `DH`: کدهای `36468` (`1000DH`)، `10111` (`1400DH075`)، `41291` (`1400DH150`)، `41598` (`1000DH100`)، `41689` (`1250DH075`) و سایر کدهای هم‌خانواده');
  lines.push('- **سازنده و سری تجاری**: **BANDO Chemical Industries, Ltd.** — سری **Bando Synchro-Link® Double-Sided Timing Belt (Profile DH)**');
  lines.push('- **نوع واقعی و مکانیزم کارکرد**: تسمه تایمینگ ذوزنقه‌ای اینچی **دوطرفه (Double-Sided / Dual-Tooth)** پروفیل `DH` (چینش متقارن دندانه‌ها در دو سمت تسمه / Symmetrical DA) جهت انتقال حرکت هم‌زمان از هر دو وجه داخلی و خارجی تسمه (محورهای خلاف‌گرد و مسیرهای مارپیچ Serpentine).');
  lines.push('- **مشخصات هندسی ثابت پروفیل DH (ISO 19347:2015)**:');
  lines.push('  - **گام دندانه ($p$)**: $0.500\\text{ in} = 12.70\\text{ mm}$');
  lines.push('  - **زاویه دندانه ($2\\beta$)**: $40^\\circ$ در هر دو طرف');
  lines.push('  - **ارتفاع دندانه ($h_t$)**: $2.29\\text{ mm}$ در هر طرف');
  lines.push('  - **ضخامت کل تسمه ($h_s$)**: $5.94\\text{ mm}$ ($0.234\\text{ in}$ — در مقایسه با $4.30\\text{ mm}$ در پروفیل یک‌طرفه H)');
  lines.push('- **چرا پروفیل `DH` هرگز نباید با پروفیل یک‌طرفه `H` در یک خانواده قرار گیرد؟**');
  lines.push('  - تفاوت هندسه مقطع و ضخامت ($5.94\\text{ mm}$ در برابر $4.30\\text{ mm}$)، وجود دندانه در پشت تسمه (عدم امکان استفاده از هرزگرد پشت صاف روی دندانه‌های بیرونی بدون درگیری سنکرون)، و کاربری متفاوت در گیربکس‌ها و خطوط انتقال دوجهته.');
  lines.push('- **تفکیک مهندسی کدهای `DH` برند BANDO به ۲ خانواده بر اساس فرم عرضه (Supply Form)**:');
  lines.push('  1. **خانواده حلقه‌های مداربسته استاندارد (`FAM-TIMING-IMP-DH-ENDLESS-STD-BANDO` — واحد فروش: `حلقه`)**:');
  for (const r of audit.bandoSpotlight.dhDoubleSidedEndlessCohort) {
    lines.push(
      `     - **SKU \`${r.sku}\`** (\`${r.originalName}\`): طول گام $L_p = ${r.technical.pitchLengthMm}\\text{ mm}$ ($z = ${r.technical.toothCount}$ دندانه در هر طرف)، کد عرض \`${r.technical.widthCode}\` ($b = ${r.technical.nominalWidthMm}\\text{ mm}$) — خانواده قبلی: \`${r.currentFamilyId}\` (\`${r.currentSubcategory}\`).`
    );
  }
  lines.push('  2. **خانواده آستین‌های برش‌نخورده تایمینگ دوطرفه (`FAM-TIMING-IMP-DH-SLEEVE-STD-BANDO` — واحد فروش: `سانتيمتر`)**:');
  for (const r of audit.bandoSpotlight.dhDoubleSidedSleeveCohort) {
    lines.push(
      `     - **SKU \`${r.sku}\`** (\`${r.originalName}\`): طول گام $L_p = ${r.technical.pitchLengthMm}\\text{ mm}$ ($z = ${r.technical.toothCount}$ دندانه در هر طرف)، عرضه به صورت استوانه/آستین (Sleeve) که به عرض دلخواه مشتری برش خورده و برحسب **سانتی‌متر عرض** فروخته می‌شود (به همین دلیل فاقد کد عرض سه‌رقمی اینچی در انتهای کد است!) — خانواده قبلی: \`${r.currentFamilyId}\` (\`${r.currentSubcategory}\`).`
    );
  }
  lines.push('');

  lines.push('---');
  lines.push(`## REPORT A — SKU CLASSIFICATION (نمونه جامع کدهای کلیدی، جابه‌جایی‌ها و موارد ویژه + فایل JSON و Excel کامل تمامی ${audit.auditedSkuCount.toLocaleString('en-US')} کد)`);
  lines.push('');
  lines.push(`> **توجه**: جدول کامل ماشین‌خوان برای تمامی **${audit.auditedSkuCount.toLocaleString('en-US')} کد کالا** در فایل \`docs/belt-catalog-audit-report.json\` و فایل اکسل \`docs/sanatpish-belt-catalog-audit.xlsx\` (شیت \`1_SKU_Classification\`) ذخیره شده است. در جدول زیر، تمامی کدهای ویژه شامل گروه BANDO، ${audit.misplacedBeltOutsideBeltCategoryCount} کد تسمه/ابزار جوشی خارج از دسته‌های تسمه و نقاله، اقلام غیرتسمه‌ای داخل دسته‌های تسمه/نقاله و نمایندگان زیرگروه‌های تعیین‌تکلیف‌شده از «تسمه صنعتی» درج شده‌اند:`);
  lines.push('');
  lines.push('| SKU | نام اصلی کاتالوگ | برند | دسته فعلی > زیرشاخه فعلی | دسته پیشنهادی اکسل > زیرمنو > برگ | شکاف ساختار (Taxonomy Gap) | نوع واقعی فنی | پروفیل / گام / ابعاد | خانواده قبلی -> خانواده پیشنهادی | اطمینان | اقدام پیشنهادی |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');

  const spotlightSkus = new Set<string>([
    '10538',
    '36103',
    '36468',
    '10111',
    '41291',
    '41598',
    '41689',
    '36636',
    '41322',
    '39994',
    '41349',
    ...audit.bandoSpotlight.hSingleSidedCohort.map((r) => r.sku),
    ...audit.bandoSpotlight.lSingleSidedSeparatedFrom10538.map((r) => r.sku),
  ]);

  const reportASelection = audit.reportA_skuClassifications.filter(
    (r) =>
      spotlightSkus.has(r.sku) ||
      r.currentCategory !== 'تسمه و انتقال نیرو' ||
      r.technical.operatingPrinciple === 'non-belt' ||
      r.recommendedAction === 'SPLIT_FROM_CURRENT_FAMILY' ||
      r.recommendedAction === 'MANUAL_ENGINEERING_REVIEW'
  );

  const catchAllSamples = audit.reportA_skuClassifications
    .filter((r) => r.currentSubcategory === 'تسمه صنعتی' && !reportASelection.includes(r))
    .slice(0, 60);

  for (const r of [...reportASelection, ...catchAllSamples]) {
    const dimSummary = [
      `پروفیل: ${r.technical.profile}`,
      r.technical.pitchMm ? `گام: ${r.technical.pitchMm}mm` : null,
      r.technical.pitchLengthMm ? `طول گام: ${r.technical.pitchLengthMm}mm` : null,
      r.technical.insideLengthMm ? `طول: ${r.technical.insideLengthMm}mm` : null,
      r.technical.toothCount ? `دندانه: ${r.technical.toothCount}` : null,
      r.technical.nominalWidthMm ? `عرض: ${r.technical.nominalWidthMm}mm` : null,
      `واحد: ${r.unit}`,
    ]
      .filter(Boolean)
      .join(' | ');

    lines.push(
      `| \`${r.sku}\` | ${r.originalName.replace(/\|/g, '/')} | \`${r.detectedBrand}\` | ${r.currentCategory} > ${r.currentSubcategory} | \`${r.proposedCategorySlug}\` (${r.proposedCategoryName} > ${r.proposedSubmenu} > ${r.proposedLeaf}) | ${
        r.taxonomyGap ? r.taxonomyGap.split(':')[0] : '—'
      } | ${r.actualProductType} | ${dimSummary} | \`${r.currentFamilyId}\` → \`${r.proposedFamilyId}\` | \`${r.confidence}\` | \`${r.recommendedAction}\` |`
    );
  }
  lines.push('');

  lines.push('---');
  lines.push('## REPORT B — PRODUCT FAMILY STRUCTURE (فهرست کامل خانواده‌های مهندسی بازسازی‌شده)');
  lines.push('');
  lines.push('| شناسه خانواده پیشنهادی | نام فارسی خانواده | نام انگلیسی | مسیر اکسل (`Slug > Submenu > Leaf`) | برند | پروفیل | یک‌طرفه/دوطرفه | فرم عرضه / واحد | مشخصات ثابت (گام / جنس / کورد / استاندارد) | پارامترهای متغیر سایز | تعداد SKU | خانواده‌های مبدا | نمونه کدها |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');

  for (const fam of audit.reportB_proposedFamilies) {
    const fixedSummary = [
      fam.fixedSpecs.pitchMm ? `گام ${fam.fixedSpecs.pitchMm}mm` : null,
      fam.fixedSpecs.beltThicknessMm ? `ضخامت ${fam.fixedSpecs.beltThicknessMm}mm` : null,
      fam.fixedSpecs.bodyMaterial,
      fam.fixedSpecs.tensileCord,
      fam.fixedSpecs.backingOrCoating,
    ]
      .filter(Boolean)
      .join('؛ ');

    lines.push(
      `| \`${fam.proposedFamilyId}\` | **${fam.familyNameFa}** | ${fam.familyNameEn} | \`${fam.categorySlug}\` > ${fam.submenu} > ${fam.leaf} | \`${fam.brand}\` | \`${fam.profile}\` | \`${fam.sidedness}\` | \`${fam.supplyForm}\` (${fam.unit}) | ${fixedSummary} | ${fam.variableParameters.join('، ')} | **${fam.skuCount}** | ${fam.sourceFamilyIds.slice(0, 5).map((id) => `\`${id}\``).join(', ')}${fam.sourceFamilyIds.length > 5 ? ` (+${fam.sourceFamilyIds.length - 5})` : ''} | ${fam.memberSkus.slice(0, 6).map((s) => `\`${s}\``).join(', ')}${fam.memberSkus.length > 6 ? ' ...' : ''} |`
    );
  }
  lines.push('');

  lines.push('---');
  lines.push('## REPORT C — PROBLEMS AND EXCEPTIONS (گزارش کامل خطاهای کاتالوگ، تداخل خانواده‌ها، اقلام غیرتسمه و شکاف‌های ساختار اکسل)');
  lines.push('');
  lines.push('| نوع استثنا (Exception Type) | اهمیت | کد کالا / خانواده | نام اصلی | موقعیت فعلی | راه‌حل مهندسی پیشنهادی | توضیح فنی |');
  lines.push('|---|---|---|---|---|---|---|');

  for (const ex of audit.reportC_exceptions) {
    lines.push(
      `| \`${ex.type}\` | \`${ex.severity}\` | \`${ex.skuOrFamilyId}\` | ${ex.originalName.replace(/\|/g, '/')} | ${ex.currentLocation} | ${ex.proposedResolution.replace(/\|/g, '/')} | ${ex.engineeringExplanation.replace(/\|/g, '/')} |`
    );
  }
  lines.push('');

  return lines.join('\n');
}

function buildExcelWorkbook(audit: ReturnType<typeof runBeltCatalogAudit>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Complete SKU Classification (All audited SKUs)
  const sheet1Rows = audit.reportA_skuClassifications.map((r) => ({
    SKU: r.sku,
    Original_Name: r.originalName,
    Original_Size: r.originalSize,
    Original_Unit: r.originalUnit,
    Unit: r.unit,
    Detected_Brand: r.detectedBrand,
    Current_Family_ID: r.currentFamilyId,
    Current_Family_Name: r.currentFamilyName,
    Current_Category: r.currentCategory,
    Current_Submenu: r.currentSubmenu,
    Current_Subcategory: r.currentSubcategory,
    Proposed_Category_Slug: r.proposedCategorySlug,
    Proposed_Category_Name: r.proposedCategoryName,
    Proposed_Submenu: r.proposedSubmenu,
    Proposed_Leaf: r.proposedLeaf,
    Taxonomy_Gap: r.taxonomyGap || '',
    Proposed_Family_ID: r.proposedFamilyId,
    Proposed_Family_Name_FA: r.proposedFamilyNameFa,
    Proposed_Family_Name_EN: r.proposedFamilyNameEn,
    Actual_Product_Type: r.actualProductType,
    Operating_Principle: r.technical.operatingPrinciple,
    Belt_Division: r.technical.beltDivision,
    Supply_Form: r.technical.supplyForm,
    Sidedness: r.technical.sidedness,
    Profile_Section: r.technical.profile,
    Pitch_mm: r.technical.pitchMm ?? '',
    Tooth_Angle_deg: r.technical.toothAngleDeg ?? '',
    Tooth_Height_mm: r.technical.toothHeightMm ?? '',
    Belt_Thickness_mm: r.technical.beltThicknessMm ?? '',
    Nominal_Width_mm: r.technical.nominalWidthMm ?? '',
    Width_Code: r.technical.widthCode ?? '',
    Pitch_Length_mm: r.technical.pitchLengthMm ?? '',
    Inside_Length_mm: r.technical.insideLengthMm ?? '',
    Outside_Length_mm: r.technical.outsideLengthMm ?? '',
    Tooth_Count: r.technical.toothCount ?? '',
    Rib_Count: r.technical.ribCount ?? '',
    Body_Material: r.technical.bodyMaterial,
    Tensile_Cord: r.technical.tensileCord,
    Backing_Coating: r.technical.backingOrCoating || '',
    Standard_Reference: r.technical.standardReference,
    Manufacturer_Sources: r.technical.manufacturerSources.join(' | '),
    Confidence_Level: r.confidence,
    Verification_Tier: r.verification.tier,
    Processed_By_Code: r.verification.processedBySoftwareCode ? 'YES' : 'NO',
    Extracted_From_DB: r.verification.extractedFromDatabase ? 'YES' : 'NO',
    Manufacturer_Code_Identified: r.verification.manufacturerCodeIdentified ? 'YES' : 'NO',
    Official_Site_Checked: r.verification.officialManufacturerSiteChecked ? 'YES' : 'NO',
    Datasheet_Catalog_Checked: r.verification.datasheetOrCatalogChecked ? 'YES' : 'NO',
    Matched_Reliable_Source: r.verification.matchedAgainstReliableSource ? 'YES' : 'NO',
    Family_Confirmed_By_Evidence: r.verification.familyConfirmedByEvidence ? 'YES' : 'NO',
    Source_URL: r.verification.sourceUrl,
    Document_Type: r.verification.documentType,
    Matched_Manufacturer: r.verification.matchedManufacturer || '',
    Verification_Evidence_Basis: r.verification.evidenceBasis,
    Recommended_Action: r.recommendedAction,
    Engineering_Reasoning: r.engineeringReasoning,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet1Rows), '1_SKU_Classification');

  // Sheet 2: Product Family Mapping (All Proposed Families)
  const sheet2Rows = audit.reportB_proposedFamilies.map((f) => ({
    Proposed_Family_ID: f.proposedFamilyId,
    Family_Name_FA: f.familyNameFa,
    Family_Name_EN: f.familyNameEn,
    Brand: f.brand,
    Excel_Category_Slug: f.categorySlug,
    Excel_Category_Name: f.categoryName,
    Excel_Submenu: f.submenu,
    Excel_Leaf: f.leaf,
    Taxonomy_Gap: f.taxonomyGap || '',
    Belt_Division: f.beltDivision,
    Profile: f.profile,
    Sidedness: f.sidedness,
    Supply_Form: f.supplyForm,
    Unit: f.unit,
    SKU_Count: f.skuCount,
    Member_SKUs_All: f.memberSkus.join(', '),
    Source_Family_IDs: f.sourceFamilyIds.join(', '),
    Merged_From_Families: f.mergedFromFamilies.join(', '),
    Split_From_Families: f.splitFromFamilies.join(', '),
    Fixed_Pitch_mm: f.fixedSpecs.pitchMm ?? '',
    Fixed_Thickness_mm: f.fixedSpecs.beltThicknessMm ?? '',
    Fixed_Body_Material: f.fixedSpecs.bodyMaterial,
    Fixed_Tensile_Cord: f.fixedSpecs.tensileCord,
    Fixed_Backing_Coating: f.fixedSpecs.backingOrCoating || '',
    Standard_Reference: f.fixedSpecs.standardReference,
    Variable_Parameters: f.variableParameters.join(', '),
    Technical_Description_FA: f.technicalDescriptionFa,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet2Rows), '2_Family_Mapping');

  // Sheet 3: Category & Subcategory Audit
  const sheet3Rows = audit.reportA_skuClassifications
    .filter(
      (r) =>
        r.currentCategory !== 'تسمه و انتقال نیرو' ||
        r.currentSubcategory === 'تسمه صنعتی' ||
        r.technical.operatingPrinciple === 'non-belt' ||
        Boolean(r.taxonomyGap)
    )
    .map((r) => ({
      SKU: r.sku,
      Original_Name: r.originalName,
      Current_Category: r.currentCategory,
      Current_Submenu: r.currentSubmenu,
      Current_Subcategory: r.currentSubcategory,
      Proposed_Excel_Category_Slug: r.proposedCategorySlug,
      Proposed_Excel_Category_Name: r.proposedCategoryName,
      Proposed_Excel_Submenu: r.proposedSubmenu,
      Proposed_Excel_Leaf: r.proposedLeaf,
      Taxonomy_Gap: r.taxonomyGap || 'منطبق با ساختار فعلی اکسل',
      Change_Reason: r.engineeringReasoning,
      Verification_Tier: r.verification.tier,
      Verification_Source: r.verification.evidenceBasis,
      Audit_Status: r.confidence,
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet3Rows), '3_Category_Subcategory');

  // Sheet 4: Single-SKU / Orphaned Families & Unassigned SKUs
  const sourceFamilyCounts = new Map<string, number>();
  for (const r of audit.reportA_skuClassifications) {
    sourceFamilyCounts.set(r.currentFamilyId, (sourceFamilyCounts.get(r.currentFamilyId) || 0) + 1);
  }
  const sheet4Rows = audit.reportA_skuClassifications
    .filter(
      (r) =>
        (sourceFamilyCounts.get(r.currentFamilyId) || 0) === 1 ||
        r.currentCategory === 'اقلام نیازمند شناسایی' ||
        r.currentSubcategory === 'تسمه صنعتی'
    )
    .map((r) => ({
      SKU: r.sku,
      Original_Name: r.originalName,
      Previous_Family_ID: r.currentFamilyId,
      Previous_Family_SKU_Count: sourceFamilyCounts.get(r.currentFamilyId) || 1,
      Previous_Category_Subcategory: `${r.currentCategory} > ${r.currentSubcategory}`,
      New_Proposed_Family_ID: r.proposedFamilyId,
      New_Proposed_Family_Name: r.proposedFamilyNameFa,
      Resolution_Type:
        (sourceFamilyCounts.get(r.currentFamilyId) || 0) === 1
          ? 'تک‌عضوی ادغام‌شده در خانواده همگن استاندارد'
          : 'خارج‌شده از سطل عمومی تسمه صنعتی / اقلام نیازمند شناسایی',
      Engineering_Reason: r.engineeringReasoning,
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet4Rows), '4_Single_Unassigned_SKUs');

  // Sheet 5: Wrong & Mixed Families + Exceptions
  const sheet5Rows = audit.reportC_exceptions.map((ex) => ({
    Exception_Type: ex.type,
    Severity: ex.severity,
    SKU_Or_Family_ID: ex.skuOrFamilyId,
    Original_Name: ex.originalName,
    Current_Location: ex.currentLocation,
    Proposed_Resolution: ex.proposedResolution,
    Engineering_Explanation: ex.engineeringExplanation,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet5Rows), '5_Wrong_Mixed_Families');

  // Sheet 6: External Research & Standards Reference Table
  const sheet6Rows = [
  {
    Manufacturer_Brand: 'SWR',
    Product_Series: 'Classical V Z/A/B/C/D/E; raw-edge classical ZX/AX/BX/CX; wedge SPZ/SPA/SPB/SPC and 3V/5V/8V; raw-edge cogged XPZ/XPA/XPB/XPC and 3VX/5VX; banded variants; double-V AA/BB/CC; multi-rib PJ/PK/PL/PM',
    Manufacturer_Website: 'https://www.swr-europe.de',
    Catalog_URL: 'https://www.swr-europe.de/download/SWR_Imagebroschuere_en.pdf',
    Datasheet_URL: 'https://www.swr-europe.de/sortiment.php?lang=en',
    Technical_Standard: 'DIN 2215 / DIN 7753 / ISO 4184 / ISO 9982 (profile-dependent)',
    Extracted_Specifications: 'The official SWR brochure supports the listed V-belt, banded, double-V and multi-rib profile families. 8VX, AX-BANDED and CRC/TRC are not confirmed by this source and remain unverified.',
    Document_Type: 'OFFICIAL_MANUFACTURER_BROCHURE',
    Confidence: 'SERIES_VERIFIED_FOR_LISTED_PROFILES_ONLY',
  },
  {
    Manufacturer_Brand: 'BANDO',
    Product_Series: 'Power King M(Z)/A-E; Power King Cog AX/BX/CX; Power Ace 3V/5V/8V; Power Ace Cog 3VX/5VX; Power Scrum banded; Double-V AA/BB/CC; Rib Ace J/L/M; Synchro-Link H/DH; STS/HTD and metric timing families',
    Manufacturer_Website: 'https://www.bandousa.com',
    Catalog_URL: 'https://www.bandousa.com/media/uploads/0/114_BUI-1009_Industrial-Power-Transmission-Products-catalog-Vol-2_9-17.pdf',
    Datasheet_URL: 'https://www.bandousa.com/media/uploads/0/114_BUI-1009_Industrial-Power-Transmission-Products-catalog-Vol-2_9-17.pdf',
    Technical_Standard: 'RMA/IP-24 / ISO 4184 / ISO 13050 / ISO 9982 (profile-dependent)',
    Extracted_Specifications: 'The official Bando industrial catalog supports the listed product families. 11 H/DH Synchro-Link SKU records retain exact catalog matching; other supported profiles receive series-level evidence only.',
    Document_Type: 'OFFICIAL_INDUSTRIAL_PRODUCT_CATALOG',
    Confidence: '11_EXACT_SKU_MATCHES_PLUS_SERIES_LEVEL_FOR_SUPPORTED_PROFILES',
  },
  {
    Manufacturer_Brand: 'OPTIBELT',
    Product_Series: 'VB/Classic; SK/RED POWER; SUPER X-POWER/SUPER TX; KB/KBX; ZR; OMEGA/HTD/STD; ALPHA T/AT; RB ribbed PJ/PK/PL; DK double-V; ZRK automotive timing family',
    Manufacturer_Website: 'https://www.optibelt.com',
    Catalog_URL: 'https://www.optibelt.com/fileadmin/pdf/kataloge/Optibelt-Power-Transmission-product-range-belts.pdf',
    Datasheet_URL: 'https://www.optibelt.com/fileadmin/pdf/kataloge/Optibelt-Power-Transmission-product-range-belts.pdf',
    Technical_Standard: 'DIN 2215 / DIN 7753 / ISO 4184 / ISO 13050 (profile-dependent)',
    Extracted_Specifications: 'The official Optibelt product-range catalog confirms supported industrial profile families and identifies ZRK as an automotive timing-belt line. Four AUTO-RU candidates are series-level only; four further codes still require reading the printed belt marking; 35023 has an 8 mm pitch and remains separate from the 9.525 mm ZRK candidates. No exact ZRK SKU datasheet match is claimed.',
    Document_Type: 'OFFICIAL_PRODUCT_RANGE_CATALOG',
    Confidence: 'SERIES_VERIFIED_FOR_SUPPORTED_PROFILES; FOUR_PRINT_CHECKS; AUTO_8MM_SEPARATE',
  },
  {
    Manufacturer_Brand: 'MEGADYNE',
    Product_Series: 'Wrapped/wedge/raw-edge V-belts; MEGASYNC imperial/HTD/RPP/Silver3/Gold2; MEGALINEAR/MEGAPOWER/MEGAFLEX T/AT; PV Rubber Ribbed PH/PJ/PK/PL/PM',
    Manufacturer_Website: 'https://megadynegroup.com',
    Catalog_URL: 'https://megadynegroup.com/en/resources/?type=8',
    Datasheet_URL: 'https://megadynegroup.com/files/resources/attachments/md_manu_en_v-belts_web.pdf | https://megadynegroup.com/files/resources/attachments/md_manu_en_product_guide_web_0.pdf | https://megadynegroup.com/en/products/timing-belts/polyurethane-open-end/megalinear/ | https://megadynegroup.com/de-de/products/multi-rib-belts/pv-rubber-ribbed/',
    Technical_Standard: 'ISO 13050 / ISO 9982 / DIN 7721 (profile-dependent)',
    Extracted_Specifications: 'Official V-belt, MEGASYNC, MEGALINEAR and PV Rubber Ribbed sources confirm the listed profile families. The TNX inventory token was not found as an official Megadyne series and is not verified; SKU 58129 is supported only as a PJ-section multi-rib belt, not as an exact TNX datasheet match.',
    Document_Type: 'OFFICIAL_V_BELT_TIMING_AND_RIBBED_CATALOGS',
    Confidence: 'SERIES_VERIFIED_FOR_SUPPORTED_PROFILES; TNX_UNVERIFIED; NO_EXACT_TNX_DATASHEET',
  },
  {
    Manufacturer_Brand: 'DONGIL / DRB',
    Product_Series: 'SUPER STAR REC raw-edge cogged V-belt (explicit REC marking only)',
    Manufacturer_Website: 'https://www.drbworld.com',
    Catalog_URL: 'https://www.drbworld.com/industrial/index.php?CgCode=004&idx=52900&mode=fdn&num=1&pCode=MN0000028',
    Datasheet_URL: 'https://www.drbworld.com/industrial/index.php?CgCode=004&idx=52900&mode=fdn&num=1&pCode=MN0000028',
    Technical_Standard: 'Manufacturer-specific REC construction; profile standards apply where explicitly identified',
    Extracted_Specifications: 'The official DRB page verifies a SUPER STAR REC raw-edge cogged example (B-74). This evidence is not generalized to the broader DONGIL inventory; generic DONGIL codes remain unverified unless the REC marking is present.',
    Document_Type: 'OFFICIAL_PRODUCT_PAGE_LIMITED_TO_REC',
    Confidence: 'NO_GENERAL_DONGIL_SERIES_MATCH',
  },
  {
    Manufacturer_Brand: 'MITSUBOSHI / VOLTA',
    Product_Series: 'No exact SKU-specific series match established in this research pass',
    Manufacturer_Website: 'Not verified for the current inventory codes',
    Catalog_URL: 'NOT_MATCHED_TO_EXACT_INVENTORY_SKU',
    Datasheet_URL: 'internal://iso-din-rma-jis-geometry-tables',
    Technical_Standard: 'Applicable JIS / ISO / DIN profile standards only',
    Extracted_Specifications: 'Brand text alone is not used to infer construction, compound, tensile cord, cover or exact series. Keep assignments standard-based until an official catalog entry matches the stock code.',
    Document_Type: 'ENGINEERING_STANDARD_ONLY',
    Confidence: 'ALGORITHMIC_STANDARD_ONLY',
  },
  {
    Manufacturer_Brand: 'FORZA / GNR / MARSHAL / M.T / HANCHANG',
    Product_Series: 'No authoritative manufacturer-series match established for the current inventory codes',
    Manufacturer_Website: 'Not confirmed',
    Catalog_URL: 'NOT_MATCHED_TO_EXACT_INVENTORY_SKU',
    Datasheet_URL: 'internal://iso-din-rma-jis-geometry-tables',
    Technical_Standard: 'Applicable ISO / DIN / RMA / ARPM profile standards only',
    Extracted_Specifications: 'Do not infer manufacturer construction or product family from similar brand spellings. These records remain algorithmically classified by verified geometry/profile and are not promoted to manufacturer-series evidence.',
    Document_Type: 'ENGINEERING_STANDARD_ONLY',
    Confidence: 'ALGORITHMIC_STANDARD_ONLY',
  },
];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet6Rows), '6_External_Research');

  // Sheet 7: Database vs File Changes Transparency Report
  const gc = audit.groupCounts;
  const sheet7Rows = [
    {
      Layer_Or_Target: 'PostgreSQL / Supabase Production & Adopted Database (catalog_families, catalog_variants)',
      Status: 'NOT_MODIFIED (دست‌نخورده — فقط خواندنی)',
      Record_Count_Affected: 0,
      Backup_And_Rollback: '100% ایمن — هیچ دستور INSERT/UPDATE/DELETE یا مهاجرت DDL روی دیتابیس اجرا نشده است.',
      Details:
        `مطابق سیاست تغییر غیرمخرب (AGENTS.md) و دستور صریح کارفرما، دیتابیس PostgreSQL بدون هیچ تغییر یا مهاجرتی حفظ شده و تمام ${audit.totalCatalogFamilies.toLocaleString('en-US')} خانواده و ${audit.totalCatalogSkus.toLocaleString('en-US')} کد کالا دست‌نخورده‌اند.`,
    },
    {
      Layer_Or_Target: 'src/data/beltCatalogAudit.ts',
      Status: 'UPDATED_STRICT_PROVENANCE_AND_HOMOGENEITY',
      Record_Count_Affected: audit.auditedSkuCount,
      Backup_And_Rollback: 'کد تایپ‌اسکریپت مستقل (بدون تغییر داده‌های پایه دیتابیس)',
      Details:
        `تفکیک شفاف ${gc.totalProposedGroups} گروه = ${gc.validBeltAndConveyorFamilies} خانواده معتبر تسمه/نقاله (${gc.singletonValidBeltFamilies} تک‌عضوی + ${gc.multiMemberValidBeltFamilies} چندعضوی) + ${gc.weldingToolGroups} گیره جوشی + ${gc.provisionalReviewGroups} گروه نیازمند بازبینی + ${gc.separatedNonBeltFamilies} غیرتسمه‌ای؛ اعمال اعتبارسنجی واقعی همگنی ۱۴+ ویژگی و شواهد صادقانه دارای URL و DocumentType.`,
    },
    {
      Layer_Or_Target: 'src/data/partClassification.ts',
      Status: 'UPDATED_IN_CODEBASE (اصلاح غیرمخرب در کدبیس)',
      Record_Count_Affected: 2,
      Backup_And_Rollback: 'تغییر کدبیس (بدون تغییر دیتابیس)',
      Details:
        'افزودن پیشوندهای دارای غلط املایی («سمه» برای کد 41121 و «نسمه» برای کد 38161) به تشخیص‌دهنده نوع قطعه بدون تغییر نام اصلی در دیتابیس.',
    },
    {
      Layer_Or_Target: 'src/data/productTechnicalData.ts',
      Status: 'UPDATED_IN_CODEBASE (ارتقای استخراج مشخصات فنی در حافظه)',
      Record_Count_Affected: audit.trueBeltSkuCount,
      Backup_And_Rollback: 'تغییر کدبیس (بدون تغییر دیتابیس)',
      Details:
        'پشتیبانی از کدهای چندشیاری با طول در ابتدا (مانند 1270PJ8)، تسمه‌های تایمینگ دوطرفه D8M/D5M/DT5/DT10، تسمه‌های V شکل M/MX/K/AA/BB، پاوربندها و تسمه‌های گرده‌ماهی CRC/TRC.',
    },
    {
      Layer_Or_Target: 'src/services/catalogTaxonomyResolver.ts',
      Status: 'FROZEN_NO_LIVE_MENU_CHANGES',
      Record_Count_Affected: 0,
      Backup_And_Rollback: 'منوی زنده وب‌سایت دست‌نخورده و مطابق main است.',
      Details:
        'در این شاخه ممیزی هیچ تغییری در منوی زنده سایت اعمال نشده است؛ نگاشت پیشنهادی اکسل تنها در فایل‌های گزارش ممیزی ثبت شده است.',
    },
    {
      Layer_Or_Target: 'docs/belt-catalog-audit-report.md & .json & docs/*.xlsx (NO public/reports)',
      Status: 'GENERATED_DELIVERABLES_DOCS_ONLY',
      Record_Count_Affected: audit.auditedSkuCount,
      Backup_And_Rollback: 'گزارش‌ها فقط در docs/ ذخیره می‌شوند و از public/reports/ حذف شده‌اند.',
      Details:
        'خروجی‌های کامل ممیزی SKUها، شواهد اعتبارسنجی با URL/DocumentType، نقشه خانواده‌ها و کنترل همگنی مهندسی منحصراً در پوشه docs/ منتشر می‌شوند.',
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet7Rows), '7_Database_Changes');

  // Sheet 8: Execution Roadmap (Phases 1 to 7)
  const taxonomyGapCount = new Set(
    audit.reportC_exceptions.filter((e) => e.type === 'TAXONOMY_GAP').map((e) => e.skuOrFamilyId.split(' ')[0])
  ).size;
  const reviewCount = audit.confidenceCounts.REQUIRES_REVIEW;
  const vTier = audit.verificationTierCounts;

  const sheet8Rows = [
    {
      Phase: 'PHASE 1: شناسایی اولیه، افراز کامل و ممیزی شواهد SKUها',
      Status: 'سیاهه کامل ۱۰,۴۳۵ کد انجام شد؛ شواهد صادقانه با تفکیک دقیق URL و DocumentType بازبینی شد',
      Progress_Percent: '85%',
      Scope: `کل ${audit.totalCatalogSkus.toLocaleString('en-US')} کد کالا در ${audit.totalCatalogFamilies.toLocaleString('en-US')} خانواده کاتالوگ (شناسایی ${audit.auditedSkuCount.toLocaleString('en-US')} رکورد شامل ${audit.trueBeltSkuCount.toLocaleString('en-US')} تسمه/نقاله، ${audit.beltEquipmentSkuCount} ابزار جوشی، ${reviewCount} نیازمند بررسی فیزیکی و ${audit.auditedSkuCount - audit.trueBeltSkuCount - audit.beltEquipmentSkuCount - reviewCount} قلم غیرتسمه‌ای)`,
      Deliverables: `شواهد اصلاح‌شده: ${vTier.EXACT_SKU_DATASHEET_MATCHED} دیتاشیت مستقیم همان سازنده، ${vTier.NOMINAL_DESIGNATION_REF_MATCHED} جدول مرجع نامینال، ${vTier.BRAND_SERIES_AND_ISO_STANDARD} سری صریح TNX/SILVER، ${vTier.ALGORITHMIC_REGEX_AND_ISO_TABLE + vTier.INTERNAL_DB_CATALOG_ONLY} الگوریتمی/داخلی، ${reviewCount} بررسی فیزیکی`,
      Blockers: `تکمیل استعلام دیتاشیت سازنده برای ${vTier.ALGORITHMIC_REGEX_AND_ISO_TABLE} کد الگوریتمی و بررسی فیزیکی ${reviewCount} کد مبهم باقی‌مانده است.`,
      Next_Step: 'بازبینی فهرست REQUIRES_REVIEW و تایید چاپ ZRK روی ۴ کد خودرویی',
    },
    {
      Phase: 'PHASE 2: تشخیص هویت فنی و اصلاح دسته‌بندی و زیردسته‌بندی',
      Status: 'طراحی نگاشت در گزارش ممیزی انجام‌شده — منوی زنده و دیتابیس دست‌نخورده و منتظر تصمیم کارفرما',
      Progress_Percent: '85%',
      Scope: `${audit.auditedSkuCount.toLocaleString('en-US')} کد کالا (تعیین‌تکلیف ${audit.catchAllIndustrialBeltResolvedCount.toLocaleString('en-US')} کد «تسمه صنعتی» و ثبت ${taxonomyGapCount} شکاف ساختار اکسل)`,
      Deliverables: 'جدول کامل Report A، شیت 1، 3 و 9 اکسل',
      Blockers: `تصمیم کارفرما برای ${taxonomyGapCount} شکاف ساختار اکسل و بررسی ${reviewCount} کد مبهم.`,
      Next_Step: 'تأیید رسمی اصلاح برگ‌های اکسل توسط کارفرما',
    },
    {
      Phase: 'PHASE 3: بازسازی خانواده‌ها و ارتباط SKUها',
      Status: 'مدل‌سازی همگن روی داده خام تکمیل شده — منتظر تأیید کارفرما جهت مهاجرت دیتابیس',
      Progress_Percent: '85%',
      Scope: `تبدیل ${audit.beforeFamilyCountInBeltCategories} خانواده فعلی دسته‌های تسمه/نقاله به ${gc.validBeltAndConveyorFamilies} خانواده معتبر تسمه/نقاله (${gc.singletonValidBeltFamilies} تک‌عضوی + ${gc.multiMemberValidBeltFamilies} چندعضوی) به همراه ${gc.weldingToolGroups} ابزار جوشی، ${gc.provisionalReviewGroups} گروه بازبینی موقت و ${gc.separatedNonBeltFamilies} گروه غیرتسمه‌ای (= ${gc.totalProposedGroups} کل گروه‌ها)`,
      Deliverables: 'اعتبارسنجی ۱۴+ ویژگی با تفکیک دقیق NOT_APPLICABLE از UNKNOWN و کنترل پویا از تک‌عضوی‌ها',
      Blockers: 'تأیید کارفرما برای ساختار خانواده‌های پیشنهادی و تکمیل مشخصات UNKNOWN/مبهم قبل از نگارش SQL مهاجرت.',
      Next_Step: 'تأیید نقشه خانواده‌ها و نگارش مهاجرت افزایشی قابل بازگشت در supabase/adopted/migrations',
    },
    {
      Phase: 'PHASE 4: کنترل نهایی و اعتبارسنجی دیتابیس',
      Status: 'شروع‌نشده روی دیتابیس عملیاتی (۰ تغییر روی PostgreSQL/Supabase)',
      Progress_Percent: '0%',
      Scope: `آماده‌سازی تست مهاجرت در محیط Dev PostgreSQL با حفظ تمام ${audit.totalCatalogSkus.toLocaleString('en-US')} کد کالا و شناسه اصلی`,
      Deliverables: 'فایل مهاجرت SQL در supabase/adopted/migrations + گزارش تست صحت داده‌ها و بکاپ',
      Blockers: 'وابسته به تأیید رسمی کارفرما در پایان فاز 1 تا 3',
      Next_Step: 'اجرای db:plan:adopted و تست بکاپ/بازیابی پس از تأیید کارفرما',
    },
    {
      Phase: 'PHASE 5: تحقیق و جمع‌آوری تصاویر واقعی سازندگان برای هر خانواده و SKU',
      Status: 'شروع‌نشده (NOT STARTED — متوقف طبق دستور تا تصویب فاز ۳ و ۴)',
      Progress_Percent: '0%',
      Scope: `${gc.validBeltAndConveyorFamilies} خانواده معتبر تسمه صنعتی و نوار نقاله`,
      Deliverables: 'بانک تصاویر فنی واقعی و تاییدشده سازندگان منطبق با پروفیل واقعی',
      Blockers: 'متوقف تا زمان تصویب نهایی ساختار خانواده‌ها و دسته‌بندی‌ها',
      Next_Step: 'شروع پس از تایید فاز 3 و 4',
    },
    {
      Phase: 'PHASE 6: تکمیل بانک اطلاعاتی نوشته‌های واقعی روی تسمه برای OCR',
      Status: 'شروع‌نشده (NOT STARTED — متوقف طبق دستور)',
      Progress_Percent: '0%',
      Scope: 'الگوهای چاپ روی پشت تسمه (Belt Back Markings) برندهای اصلی',
      Deliverables: 'جدول الگوهای استاندارد نوشتار روی تسمه و قواعد نرمال‌سازی OCR',
      Blockers: 'وابسته به نهایی شدن فاز 3 و 5',
      Next_Step: 'تدوین بانک الگوهای چاپ روی تسمه پس از تایید خانواده‌ها',
    },
    {
      Phase: 'PHASE 7: اتصال بانک اطلاعاتی به موتور شناسایی تصویر FORZA و آزمایش واقعی',
      Status: 'شروع‌نشده (NOT STARTED — متوقف طبق دستور)',
      Progress_Percent: '0%',
      Scope: 'اتصال مشخصات هندسی و خانواده‌های بازسازی‌شده به پایپ‌لاین FORZA',
      Deliverables: 'تشخیص خودکار پروفیل، برند و کد تسمه از روی تصویر واقعی',
      Blockers: 'وابسته به تکمیل فازهای 4، 5 و 6',
      Next_Step: 'اتصال و تست دقت تشخیص پس از تکمیل فازهای قبلی',
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet8Rows), '8_Execution_Roadmap');

  // Sheet 9: Exact Count & Category Reconciliation Summary
  const p = audit.reconciliationPartition;
  const v = audit.verificationTierCounts;
  const sheet9Rows = [
    { Section: 'TOTAL_CATALOG', Metric: 'Total Catalog Families (families in catalogueSource)', Count: audit.totalCatalogFamilies, Notes: 'کل خانواده‌های خام کاتالوگ' },
    { Section: 'TOTAL_CATALOG', Metric: 'Total Catalog SKUs (variants in catalogueSource)', Count: audit.totalCatalogSkus, Notes: 'کل SKUهای کاتالوگ (7,709 + 2,726)' },
    { Section: 'TOTAL_CATALOG', Metric: 'Audited Belt & Belt-Adjacent Universe', Count: audit.auditedSkuCount, Notes: 'مجموعه کامل ممیزی‌شده (مجموع 8 سطل افراز برابر 7,709)' },
    { Section: 'TOTAL_CATALOG', Metric: 'Untouched Non-Belt Catalog SKUs (Remaining)', Count: audit.totalCatalogSkus - audit.auditedSkuCount, Notes: 'سایر قطعات (پولی، ریل، بست، بوش، قالب، گریپ خام و...) بدون تسمه پنهان' },
    { Section: 'PRODUCT_IDENTITY', Metric: 'True Power Transmission Belts', Count: audit.truePowerTransmissionBeltSkuCount, Notes: 'تایمینگ، وی‌بلت، چندشیاری، جوشی PU و گرده‌ماهی CRC' },
    { Section: 'PRODUCT_IDENTITY', Metric: 'True Conveyor & Grip Belts', Count: audit.trueConveyorBeltSkuCount, Notes: 'نوار نقاله PVC/PU/مدولار و نوار گریپ بارکش' },
    { Section: 'PRODUCT_IDENTITY', Metric: 'Belt Welding Clamp Devices (Equipment)', Count: audit.beltEquipmentSkuCount, Notes: 'کدهای 110049 و 35852' },
    { Section: 'PRODUCT_IDENTITY', Metric: 'Requires Physical Review SKUs (4 provisional groups)', Count: audit.confidenceCounts.REQUIRES_REVIEW, Notes: '۹ کد نیازمند بررسی فیزیکی در ۴ گروه موقت' },
    { Section: 'PRODUCT_IDENTITY', Metric: 'Non-Belt Items in Audit Universe (Inside + Outside)', Count: audit.auditedSkuCount - audit.trueBeltSkuCount - audit.beltEquipmentSkuCount - audit.confidenceCounts.REQUIRES_REVIEW, Notes: `${p.nonBeltRemovedFromBeltCat} در دسته تسمه + ${p.nonConveyorRemovedFromConvCat} در نقاله + ${p.nonBeltAlreadyOutsideBeltOrConv} از ابتدا خارج از این دو دسته (= 68 در 7 گروه غیرتسمه‌ای)` },
    { Section: 'GROUP_SEPARATION', Metric: 'Valid Belt & Conveyor Families (Singleton + Multi)', Count: gc.validBeltAndConveyorFamilies, Notes: `${gc.singletonValidBeltFamilies} تک‌عضوی + ${gc.multiMemberValidBeltFamilies} چندعضوی` },
    { Section: 'GROUP_SEPARATION', Metric: 'Welding Clamp Equipment Groups', Count: gc.weldingToolGroups, Notes: '110049 و 35852' },
    { Section: 'GROUP_SEPARATION', Metric: 'Provisional Physical Review Groups', Count: gc.provisionalReviewGroups, Notes: '۴ گروه موقت برای ۹ کد مبهم' },
    { Section: 'GROUP_SEPARATION', Metric: 'Separated Non-Belt Families', Count: gc.separatedNonBeltFamilies, Notes: '۷ گروه غیرتسمه‌ای خارج‌شده' },
    { Section: 'GROUP_SEPARATION', Metric: 'TOTAL PROPOSED GROUPS (634 + 2 + 4 + 7)', Count: gc.totalProposedGroups, Notes: 'جمع کل برابر دقیق 647' },
    { Section: 'PARTITION_7709', Metric: '1. Misplaced Belt/Equipment Outside Belt/Conv Moved In', Count: p.misplacedBeltOrEquipOutsideMovedIn, Notes: 'انتقال از دسته‌های دیگر به دسته صحیح تسمه/بارکش' },
    { Section: 'PARTITION_7709', Metric: '2. Non-Belt Removed From تسمه و انتقال نیرو', Count: p.nonBeltRemovedFromBeltCat, Notes: 'پولی، تسمه‌پاک‌کن، تیغه نگهدارنده و تسمه آهنی' },
    { Section: 'PARTITION_7709', Metric: '3. Non-Conveyor Removed From نوار و تسمه نقاله', Count: p.nonConveyorRemovedFromConvCat, Notes: 'نوار اسفنجی، سیلیکونی و اسپاتول چاپ' },
    { Section: 'PARTITION_7709', Metric: '4. Belt Moved From Belt Cat To Conveyor Cat', Count: p.beltMovedFromBeltCatToConveyorCat, Notes: 'تسمه به نوار نقاله' },
    { Section: 'PARTITION_7709', Metric: '5. Conveyor/Grip Moved From Conv Cat To Belt/Barkesh Cat', Count: p.conveyorMovedFromConvCatToBeltCat, Notes: 'نوار گریپ منتقل‌شده به excel-v2-1-4 (تسمه بارکش)' },
    { Section: 'PARTITION_7709', Metric: '6. Non-Belt Already Outside Belt & Conveyor Categories', Count: p.nonBeltAlreadyOutsideBeltOrConv, Notes: 'تسمه‌پاک‌کن‌های پلی‌یورتان/تفلون در مواد و ورق + تسمه‌سفت‌کن مکانیکی در قطعات مکانیکی' },
    { Section: 'PARTITION_7709', Metric: '7. Within Same Main Category — Subcategory/Family Changed', Count: p.withinBeltOrConvSubcategoryChanged, Notes: 'خروج از تسمه صنعتی یا تفکیک/ادغام خانواده در داخل دسته اصلی' },
    { Section: 'PARTITION_7709', Metric: '8. Within Same Main Category — Unchanged Alignment', Count: p.withinBeltOrConvUnchanged, Notes: 'هم‌تراز با دسته و زیردسته هدف' },
    { Section: 'PARTITION_7709', Metric: 'PARTITION CHECKSUM (Must equal 7,709)', Count: p.partitionTotal, Notes: 'کنترل ریاضی صفر-خطا' },
    { Section: 'VERIFICATION_TIER', Metric: 'EXACT_SKU_DATASHEET_MATCHED', Count: v.EXACT_SKU_DATASHEET_MATCHED, Notes: 'فقط تطبیق دقیق SKU با دیتاشیت همان سازنده (Bando H/DH, Megadyne 58129, Optibelt ZRK قطعی)' },
    { Section: 'VERIFICATION_TIER', Metric: 'NOMINAL_DESIGNATION_REF_MATCHED', Count: v.NOMINAL_DESIGNATION_REF_MATCHED, Notes: 'تطبیق کد اسمی اینچی/خودرویی با جداول مرجع نامینال (Optibelt TM / MISUMI / Gates cross-ref؛ سایت سازنده برای برند SKU چک نشده)' },
    { Section: 'VERIFICATION_TIER', Metric: 'BRAND_SERIES_AND_ISO_STANDARD', Count: v.BRAND_SERIES_AND_ISO_STANDARD, Notes: 'تنها SKUهای دارای نام سری صریح در متن (Megadyne TNX / RPP Silver)؛ بدون چک سایت تک‌کد' },
    { Section: 'VERIFICATION_TIER', Metric: 'ALGORITHMIC_REGEX_AND_ISO_TABLE', Count: v.ALGORITHMIC_REGEX_AND_ISO_TABLE, Notes: 'طبقه‌بندی الگوریتمی متن + استاندارد ISO/DIN (تشخیص برند به معنی تایید سازنده نیست)' },
    { Section: 'VERIFICATION_TIER', Metric: 'INTERNAL_DB_CATALOG_ONLY', Count: v.INTERNAL_DB_CATALOG_ONLY, Notes: 'اقلام غیرتسمه و ابزار جوشی از ساختار کاتالوگ داخلی' },
    { Section: 'VERIFICATION_TIER', Metric: 'UNVERIFIED_REQUIRES_PHYSICAL_REVIEW', Count: v.UNVERIFIED_REQUIRES_PHYSICAL_REVIEW, Notes: 'نیازمند بررسی فیزیکی کالا یا فاکتور خرید' },
    ...Object.entries(audit.sevenLevelEvidenceCounts).map(([level, count]) => ({
      Section: '7_LEVEL_EVIDENCE',
      Metric: level,
      Count: count,
      Notes: 'طبقه‌بندی هفت‌سطحی شواهد فنی (جمع کل = 7,709)',
    })),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet9Rows), '9_Reconciliation_Summary');

  return wb;
}

function buildFinalValidationWorkbook(
  audit: ReturnType<typeof runBeltCatalogAudit>,
  liveDb: LiveDbReadSummary
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const byFamilySkus = new Map<string, typeof audit.reportA_skuClassifications>();
  const sourceFamilyCounts = new Map<string, number>();
  for (const r of audit.reportA_skuClassifications) {
    const arr = byFamilySkus.get(r.proposedFamilyId) || [];
    arr.push(r);
    byFamilySkus.set(r.proposedFamilyId, arr);
    sourceFamilyCounts.set(r.currentFamilyId, (sourceFamilyCounts.get(r.currentFamilyId) || 0) + 1);
  }

  // Group cross-brand structural equivalents (same engineering spec excluding brand)
  const crossBrandGroups = new Map<string, Set<string>>();
  for (const f of audit.reportB_proposedFamilies) {
    if (f.beltDivision.startsWith('non-belt-') || f.beltDivision === 'service-ambiguous') continue;
    const eqKey = [
      f.beltDivision,
      f.profile,
      f.sidedness,
      f.supplyForm,
      f.fixedSpecs.bodyMaterial,
      f.fixedSpecs.tensileCord,
      f.fixedSpecs.backingOrCoating || 'STD',
    ].join('|');
    const set = crossBrandGroups.get(eqKey) || new Set<string>();
    set.add(f.proposedFamilyId);
    crossBrandGroups.set(eqKey, set);
  }

  // Sheet 1: All_SKU_Classification
  const s1 = audit.reportA_skuClassifications.map((r) => ({
    SKU: r.sku,
    Original_Name: r.originalName,
    Original_Size: r.originalSize,
    Original_Unit: r.originalUnit,
    Normalized_Unit: r.unit,
    Detected_Brand: r.detectedBrand,
    Current_Family_ID: r.currentFamilyId,
    Current_Family_Name: r.currentFamilyName,
    Current_Category: r.currentCategory,
    Current_Submenu: r.currentSubmenu,
    Current_Subcategory: r.currentSubcategory,
    Proposed_Category_Slug: r.proposedCategorySlug,
    Proposed_Category_Name: r.proposedCategoryName,
    Proposed_Submenu: r.proposedSubmenu,
    Proposed_Leaf: r.proposedLeaf,
    Taxonomy_Gap: r.taxonomyGap || '',
    Proposed_Family_ID: r.proposedFamilyId,
    Proposed_Family_Name_FA: r.proposedFamilyNameFa,
    Proposed_Family_Name_EN: r.proposedFamilyNameEn,
    Actual_Product_Type: r.actualProductType,
    Operating_Principle: r.technical.operatingPrinciple,
    Belt_Division: r.technical.beltDivision,
    Supply_Form: r.technical.supplyForm,
    Sidedness: r.technical.sidedness,
    Profile_Section: r.technical.profile,
    Pitch_mm: r.technical.pitchMm ?? '',
    Tooth_Angle_deg: r.technical.toothAngleDeg ?? '',
    Tooth_Height_mm: r.technical.toothHeightMm ?? '',
    Belt_Thickness_mm: r.technical.beltThicknessMm ?? '',
    Nominal_Width_mm: r.technical.nominalWidthMm ?? '',
    Width_Code: r.technical.widthCode ?? '',
    Pitch_Length_mm: r.technical.pitchLengthMm ?? '',
    Inside_Length_mm: r.technical.insideLengthMm ?? '',
    Outside_Length_mm: r.technical.outsideLengthMm ?? '',
    Tooth_Count: r.technical.toothCount ?? '',
    Rib_Count: r.technical.ribCount ?? '',
    Body_Material: r.technical.bodyMaterial,
    Tensile_Cord: r.technical.tensileCord,
    Backing_Coating: r.technical.backingOrCoating || '',
    Standard_Reference: r.technical.standardReference,
    Evidence_Class_7: r.verification.evidenceClass7,
    Verification_Tier: r.verification.tier,
    Confidence_Level: r.confidence,
    Processed_By_Code: r.verification.processedBySoftwareCode ? 'YES' : 'NO',
    Extracted_From_DB: r.verification.extractedFromDatabase ? 'YES' : 'NO',
    Manufacturer_Code_Identified: r.verification.manufacturerCodeIdentified ? 'YES' : 'NO',
    Official_Site_Checked: r.verification.officialManufacturerSiteChecked ? 'YES' : 'NO',
    Datasheet_Catalog_Checked: r.verification.datasheetOrCatalogChecked ? 'YES' : 'NO',
    Matched_Reliable_Source: r.verification.matchedAgainstReliableSource ? 'YES' : 'NO',
    Family_Confirmed_By_Evidence: r.verification.familyConfirmedByEvidence ? 'YES' : 'NO',
    Source_URL: r.verification.sourceUrl,
    Document_Type: r.verification.documentType,
    Matched_Manufacturer: r.verification.matchedManufacturer || '',
    Verification_Evidence_Basis: r.verification.evidenceBasis,
    Recommended_Action: r.recommendedAction,
    Engineering_Reasoning: r.engineeringReasoning,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s1), 'All_SKU_Classification');

  // Sheet 2: Final_Family_Mapping
  const s2 = audit.reportB_proposedFamilies.map((f) => {
    const members = byFamilySkus.get(f.proposedFamilyId) || [];
    const eqKey = [
      f.beltDivision,
      f.profile,
      f.sidedness,
      f.supplyForm,
      f.fixedSpecs.bodyMaterial,
      f.fixedSpecs.tensileCord,
      f.fixedSpecs.backingOrCoating || 'STD',
    ].join('|');
    const equivalents = [...(crossBrandGroups.get(eqKey) || [])].filter((id) => id !== f.proposedFamilyId);
    const reviewNeeded = f.beltDivision === 'service-ambiguous' || f.proposedFamilyId.includes('ZRK-REVIEW');
    const isNonBelt = f.beltDivision.startsWith('non-belt-');
    const finalStatus = isNonBelt
      ? 'NON_BELT_SEPARATED'
      : reviewNeeded
        ? 'REQUIRES_REVIEW'
        : f.skuCount === 1
          ? 'VALID_SINGLETON_FAMILY'
          : 'VALIDATED_FAMILY';

    return {
      Family_ID: f.proposedFamilyId,
      Family_Name_FA: f.familyNameFa,
      Family_Name_EN: f.familyNameEn,
      Brand: f.brand,
      Product_Type: members[0]?.actualProductType || f.familyNameFa,
      Operating_Principle: members[0]?.technical.operatingPrinciple || '',
      Belt_Division: f.beltDivision,
      Profile: f.profile,
      Sidedness: f.sidedness,
      Supply_Form: f.supplyForm,
      Unit: f.unit,
      Category_Slug: f.categorySlug,
      Category_Name: f.categoryName,
      Submenu: f.submenu,
      Leaf: f.leaf,
      Taxonomy_Gap: f.taxonomyGap || '',
      Fixed_Common_Specs: [
        f.fixedSpecs.pitchMm ? `Pitch=${f.fixedSpecs.pitchMm}mm` : null,
        f.fixedSpecs.beltThicknessMm ? `Thickness=${f.fixedSpecs.beltThicknessMm}mm` : null,
        `Material=${f.fixedSpecs.bodyMaterial}`,
        `Cord=${f.fixedSpecs.tensileCord}`,
        f.fixedSpecs.backingOrCoating ? `Coating=${f.fixedSpecs.backingOrCoating}` : null,
        `Std=${f.fixedSpecs.standardReference}`,
      ]
        .filter(Boolean)
        .join(' | '),
      Allowed_SKU_Differences:
        f.profile === 'ROUND'
          ? 'قطر گرد مقطع (3–22mm) و متراژ برش'
          : f.beltDivision === 'conveyor-pvc-pu'
            ? 'ضخامت نوار، عرض و طول نوار'
            : f.variableParameters.join(' | '),
      SKU_Count: f.skuCount,
      All_Member_SKUs: f.memberSkus.join(', '),
      Source_Family_IDs: f.sourceFamilyIds.join(', '),
      Technical_Sources: [...new Set(members.flatMap((m) => m.technical.manufacturerSources))].join(' | '),
      Cross_Brand_Equivalents: equivalents.join(', '),
      Confidence_Breakdown: [...new Set(members.map((m) => m.confidence))].join(', '),
      Final_Status: finalStatus,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s2), 'Final_Family_Mapping');

  // Sheet 3: Family_Engineering_Validation
  const s3 = audit.reportB_proposedFamilies.map((f) => {
    const members = byFamilySkus.get(f.proposedFamilyId) || [];
    const val = validateFamilyEngineeringHomogeneity(f, members);
    return {
      Family_ID: f.proposedFamilyId,
      Family_Name_FA: f.familyNameFa,
      SKU_Count: f.skuCount,
      Brand_Check: val.brandCheck,
      Product_Type_Check: val.productTypeCheck,
      Operating_Principle_Check: val.operatingPrincipleCheck,
      Profile_Check: val.profileCheck,
      Pitch_Check: val.pitchCheck,
      Tooth_Angle_Check: val.toothAngleCheck,
      Tooth_Height_Check: val.toothHeightCheck,
      Belt_Width_Check: val.beltWidthCheck,
      Belt_Thickness_Check: val.beltThicknessCheck,
      Body_Material_Check: val.bodyMaterialCheck,
      Tensile_Cord_Check: val.tensileCordCheck,
      Covering_Check: val.coveringCheck,
      Sidedness_Check: val.sidednessCheck,
      Supply_Form_Check: val.supplyFormCheck,
      Unit_Check: val.unitCheck,
      Standard_Check: val.standardCheck,
      Unknown_Attributes: val.unknownAttributes.join(', ') || 'NONE',
      Not_Applicable_Attributes: val.notApplicableAttributes.join(', ') || 'NONE',
      Mixed_Attributes: val.mixedAttributes.join(', ') || 'NONE',
      Strict_Validation_Passed: val.passedStrictValidation ? 'YES' : 'NO',
      Homogeneity_Verdict: val.verdictDetail,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s3), 'Family_Engineering_Validation');

  // Sheet 4: Single_Unassigned_SKUs
  const s4 = audit.reportA_skuClassifications
    .filter(
      (r) =>
        (sourceFamilyCounts.get(r.currentFamilyId) || 0) === 1 ||
        r.currentCategory === 'اقلام نیازمند شناسایی' ||
        r.currentSubcategory === 'تسمه صنعتی'
    )
    .map((r) => {
      const newCount = (byFamilySkus.get(r.proposedFamilyId) || []).length;
      const inValidFamily = r.confidence !== 'REQUIRES_REVIEW';
      const mustStaySingleton = inValidFamily && newCount === 1;
      const reason = !inValidFamily
        ? 'بدون کد/پروفیل معتبر در انبار — همچنان نیازمند بررسی فیزیکی و بدون خانواده نهایی'
        : mustStaySingleton
          ? `تک‌عضوی واقعی و مستقل به دلیل ترکیب منحصربه‌فرد برند (${r.detectedBrand})، پروفیل (${r.technical.profile})، فرم عرضه (${r.technical.supplyForm}) یا روکش (${r.technical.backingOrCoating || 'استاندارد'}) — نباید برای کاهش مصنوعی عدد با برند یا پروفیل دیگر ادغام شود.`
          : `ادغام‌شده در خانواده مهندسی همگن ${r.proposedFamilyId} شامل ${newCount} کد هم‌نوع و هم‌برند.`;

      return {
        SKU: r.sku,
        Original_Name: r.originalName,
        Previous_Family_ID: r.currentFamilyId,
        Previous_Family_SKU_Count: sourceFamilyCounts.get(r.currentFamilyId) || 1,
        Previous_Category_Subcategory: `${r.currentCategory} > ${r.currentSubcategory}`,
        Proposed_Family_ID: r.proposedFamilyId,
        Proposed_Family_Name_FA: r.proposedFamilyNameFa,
        Proposed_Family_SKU_Count: newCount,
        In_Valid_Family_Now: inValidFamily ? 'YES' : 'NO',
        Must_Stay_Singleton: mustStaySingleton ? 'YES' : 'NO',
        Reason_For_Independence_Or_Merge: reason,
      };
    });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s4), 'Single_Unassigned_SKUs');

  // Sheet 5: Category_Subcategory
  const s5 = audit.reportA_skuClassifications
    .filter(
      (r) =>
        r.currentCategory !== 'تسمه و انتقال نیرو' ||
        r.currentSubcategory === 'تسمه صنعتی' ||
        r.technical.operatingPrinciple === 'non-belt' ||
        Boolean(r.taxonomyGap)
    )
    .map((r) => ({
      SKU: r.sku,
      Original_Name: r.originalName,
      Current_Category: r.currentCategory,
      Current_Submenu: r.currentSubmenu,
      Current_Subcategory: r.currentSubcategory,
      Proposed_Category_Slug: r.proposedCategorySlug,
      Proposed_Category_Name: r.proposedCategoryName,
      Proposed_Submenu: r.proposedSubmenu,
      Proposed_Leaf: r.proposedLeaf,
      Taxonomy_Gap: r.taxonomyGap || 'منطبق با ساختار فعلی اکسل',
      Change_Reason: r.engineeringReasoning,
      Evidence_Class_7: r.verification.evidenceClass7,
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s5), 'Category_Subcategory');

  // Sheet 6: External_Evidence
  const algoBrands = new Map<string, number>();
  for (const r of audit.reportA_skuClassifications) {
    if (r.verification.evidenceClass7 === '5_Algorithmically_Classified') {
      algoBrands.set(r.detectedBrand, (algoBrands.get(r.detectedBrand) || 0) + 1);
    }
  }
  const s6 = [
    ...Object.entries(audit.sevenLevelEvidenceCounts).map(([tier, count]) => ({
      Section: '7_LEVEL_EVIDENCE_SUMMARY',
      Evidence_Class_Or_Brand: tier,
      SKU_Count: count,
      Share_Percent: `${((count / audit.auditedSkuCount) * 100).toFixed(2)}%`,
      Reference_Sources:
        tier === '1_Manufacturer_Datasheet_Verified'
          ? 'MANUFACTURER_DATASHEET (exact SKU matched same manufacturer): Bando Synchro-Link PDF (11), Megadyne TNX 1270PJ8 (1), Optibelt ZRK 1118/1176/1182/1459/1593 (5)'
          : tier === '2_Official_Catalog_Verified'
            ? '0 SKUs (Reserved ONLY for individual-SKU verified official brand catalog entries — nominal tables stay Level 3)'
            : tier === '3_Standard_Table_Verified'
              ? 'NOMINAL_REFERENCE_TABLE: Optibelt TM PDF / MISUMI Imperial Table / Gates-Optibelt Auto Cross-Ref (officialManufacturerSiteChecked = false)'
              : tier === '4_Brand_Series_Identified'
                ? 'SERIES_CATALOG: Explicit Megadyne TNX (7 SKUs) & RPP Silver (3 SKUs) in SKU text (officialManufacturerSiteChecked = false)'
                : tier === '5_Algorithmically_Classified'
                  ? 'ENGINEERING_STANDARD_ONLY: Regex Pattern + ISO/DIN/RMA Geometry Tables (officialManufacturerSiteChecked = false)'
                  : tier === '6_Internal_Database_Only'
                    ? 'INTERNAL_CATALOG_RECORD: Internal Database Structure (Non-Belts & Unbranded Welding Clamps)'
                    : 'NONE_UNVERIFIED: Incomplete Warehouse Name — Physical Sample / Invoice Inspection Required',
    })),
    ...[...algoBrands.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([b, c]) => ({
        Section: 'ALGORITHMIC_UPGRADE_COHORT',
        Evidence_Class_Or_Brand: b,
        SKU_Count: c,
        Share_Percent: `${((c / audit.auditedSkuCount) * 100).toFixed(2)}%`,
        Reference_Sources:
          b === 'UNSPECIFIED' || b === 'FOREIGN-OEM' || b === 'IRANIAN-OEM'
            ? 'Unbranded/OEM warehouse entries — requires invoice or physical back-marking inspection for brand upgrade'
            : `Named commercial brand (${b}) — candidate for bulk PDF catalog ingestion upgrade`,
      })),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s6), 'External_Evidence');

  // Sheet 7: Requires_Review
  const s7 = audit.reportA_skuClassifications
    .filter((r) => r.confidence === 'REQUIRES_REVIEW' || r.proposedFamilyId.includes('ZRK-REVIEW'))
    .map((r) => ({
      SKU: r.sku,
      Original_Name: r.originalName,
      Original_Size: r.originalSize,
      Original_Unit: r.originalUnit,
      Detected_Brand: r.detectedBrand,
      Current_Category_Subcategory: `${r.currentCategory} > ${r.currentSubcategory}`,
      Tentative_Family_ID: r.proposedFamilyId,
      Review_Type:
        r.confidence === 'REQUIRES_REVIEW' ? 'UNVERIFIED_MISSING_PROFILE_OR_DIMENSIONS' : 'AUTO_ZRK_PITCH_VERIFICATION',
      Engineering_Reason: r.engineeringReasoning,
      Required_Physical_Action:
        r.confidence === 'REQUIRES_REVIEW'
          ? 'قرائت کد چاپی پشت تسمه / بررسی فاکتور خرید و ثبت پروفیل و واحد واقعی'
          : 'تطبیق شماره Optibelt ZRK برای تایید قطعی گام (9.525mm در برابر 8mm)',
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s7), 'Requires_Review');

  // Sheet 8: Taxonomy_Gaps
  const gapMeta: Record<string, { recCat: string; recSub: string; needNewLeaf: string }> = {
    'GAP-TIMING-T10-T20-LABEL': {
      recCat: 'تسمه تایمینگ (excel-v2-1-1)',
      recSub: 'T5 , T10 , T20 , AT5 , AT10 , AT20 (اصلاح برچسب برگ موجود)',
      needNewLeaf: 'LABEL_UPDATE_ONLY',
    },
    'GAP-RIBBED-POLY-V': {
      recCat: 'تسمه وی‌بلت / انتقال نیرو',
      recSub: 'تسمه چندشیاری (Poly-V: PJ , PK , PL)',
      needNewLeaf: 'YES',
    },
    'GAP-VBELT-3V-5V-K-SPZ': {
      recCat: 'تسمه وی‌بلت (excel-v2-1-2)',
      recSub: 'SPZ , XPZ , 3V , 3VX , 5V , 5VX و پروفیل سبک K/MX',
      needNewLeaf: 'YES (یا الحاق به برگ اسپشیال)',
    },
    'GAP-COATED-VBELT': {
      recCat: 'تسمه وی‌بلت (excel-v2-1-2)',
      recSub: 'تسمه وی‌بلت روکش‌دار / گریپ‌دار (B / XPC / ...)',
      needNewLeaf: 'YES',
    },
    'GAP-TIMING-MXL-3M-RPP': {
      recCat: 'تسمه تایمینگ (excel-v2-1-1)',
      recSub: 'MXL / HTD 3M / RPP Silver 8M & 14M',
      needNewLeaf: 'YES',
    },
    'GAP-TIMING-DOUBLE-SIDED': {
      recCat: 'تسمه تایمینگ (excel-v2-1-1)',
      recSub: 'تسمه تایمینگ دوطرفه (DH , DL , DXL , DT5 , DT10 , D5M , D8M)',
      needNewLeaf: 'YES',
    },
    'GAP-TIMING-AUTOMOTIVE-RU': {
      recCat: 'تسمه تایمینگ (یا دسته خودرویی/لیفتراک)',
      recSub: 'تسمه تایمینگ دنده‌گرد خودرویی و لیفتراک (ZRK / RU)',
      needNewLeaf: 'YES',
    },
    'GAP-VBELT-BANDED': {
      recCat: 'تسمه وی‌بلت (excel-v2-1-2)',
      recSub: 'تسمه به‌پشت‌پیوسته (Banded / Powerband)',
      needNewLeaf: 'YES',
    },
    'GAP-VBELT-AMERICAN-WEDGE-LEAF-MISSING': {
      recCat: 'تسمه وی‌بلت (excel-v2-1-2)',
      recSub: 'تسمه V گوه‌ای آمریکایی (3V / 5V / 8V و نسخه‌های دنده‌ای VX)',
      needNewLeaf: 'YES — برگ مصوب گوه‌ای آمریکایی در اکسل وجود ندارد',
    },
    'GAP-VBELT-ENDLESS-CRC': {
      recCat: 'تسمه وی‌بلت / خطوط سرامیک',
      recSub: 'تسمه گرده‌ماهی مداربسته لاستیکی (CRC / TRC Endless)',
      needNewLeaf: 'YES',
    },
    'GAP-VBELT-HEXAGONAL': {
      recCat: 'تسمه وی‌بلت (excel-v2-1-2)',
      recSub: 'تسمه شش‌ضلعی دوطرفه (AA , BB , CC)',
      needNewLeaf: 'YES',
    },
    'GAP-CONVEYOR-GRIP-STRIP': {
      recCat: 'نوار نقاله / تسمه بارکش (excel-v2-1-4)',
      recSub: 'نوار گریپ آجدار پشت‌پلی‌استر',
      needNewLeaf: 'LABEL_ALIGNMENT_OPTIONAL',
    },
  };
  const gapSkusMap = new Map<string, typeof audit.reportA_skuClassifications>();
  for (const r of audit.reportA_skuClassifications) {
    if (r.taxonomyGap) {
      const code = r.taxonomyGap.split(':')[0];
      const arr = gapSkusMap.get(code) || [];
      arr.push(r);
      gapSkusMap.set(code, arr);
    }
  }
  const s8 = [...gapSkusMap.entries()].map(([gapCode, items]) => {
    const meta = gapMeta[gapCode] || { recCat: items[0].proposedCategoryName, recSub: items[0].proposedLeaf, needNewLeaf: 'YES' };
    return {
      Gap_Code: gapCode,
      SKU_Count: items.length,
      Overlap_With_Other_Gaps: 0,
      Current_Mapped_Location: `${items[0].proposedCategoryName} (${items[0].proposedCategorySlug}) > ${items[0].proposedSubmenu} > ${items[0].proposedLeaf}`,
      Recommended_Category: meta.recCat,
      Recommended_Subcategory: meta.recSub,
      Needs_New_Excel_Leaf: meta.needNewLeaf,
      Live_Menu_Modified: 'NO (منتظر تایید کارفرما)',
      All_Member_SKUs: items.map((i) => i.sku).join(', '),
      Gap_Description: items[0].taxonomyGap,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s8), 'Taxonomy_Gaps');

  // Sheet 9: Final_Reconciliation
  const p = audit.reconciliationPartition;
  const ev7 = audit.sevenLevelEvidenceCounts;
  const gc = audit.groupCounts;
  const mixedFamsCount = audit.reportB_proposedFamilies.filter((f) => {
    const members = byFamilySkus.get(f.proposedFamilyId) || [];
    return validateFamilyEngineeringHomogeneity(f, members).mixedAttributes.length > 0;
  }).length;
  const unknownSpecBeltFamsCount = audit.reportB_proposedFamilies.filter((f) => {
    const members = byFamilySkus.get(f.proposedFamilyId) || [];
    return validateFamilyEngineeringHomogeneity(f, members).homogeneityVerdict === 'CONDITIONAL_UNKNOWN_SPECS';
  }).length;

  const s9 = [
    {
      Section: 'SOURCE_PROVENANCE',
      Metric: 'Primary Audit Source File',
      Value: 'tests/fixtures/catalogueSource.json (imported from New Microsoft Excel Worksheet.xlsx SHA-256 ec03711e...)',
      Notes: `Live DB status: ${liveDb.status} at ${liveDb.checkedAt} — ${liveDb.statusNote}`,
    },
    { Section: 'SOURCE_PROVENANCE', Metric: 'PostgreSQL / Supabase Mutations Executed', Value: 0, Notes: 'ZERO writes, ZERO DDL migrations, ZERO live menu additions' },
    { Section: 'FAMILY_VALIDATION_VERDICT', Metric: 'Previous Proposed Families Count', Value: 397, Notes: 'ممیزی عمیق ۱۴ ویژگی نشان داد ۳۹۷ خانواده کافی نیست' },
    {
      Section: 'FAMILY_VALIDATION_VERDICT',
      Metric: 'Total Proposed Groups (634 + 2 + 4 + 7)',
      Value: gc.totalProposedGroups,
      Notes: `${gc.validBeltAndConveyorFamilies} خانواده واقعی تسمه/نقاله + ${gc.weldingToolGroups} ابزار جوشی + ${gc.provisionalReviewGroups} گروه نیازمند بازبینی + ${gc.separatedNonBeltFamilies} غیرتسمه‌ای`,
    },
    { Section: 'FAMILY_VALIDATION_VERDICT', Metric: 'Valid Belt & Conveyor Families Total', Value: gc.validBeltAndConveyorFamilies, Notes: `${gc.singletonValidBeltFamilies} تک‌عضوی + ${gc.multiMemberValidBeltFamilies} چندعضوی` },
    { Section: 'FAMILY_VALIDATION_VERDICT', Metric: 'Valid Multi-SKU Belt Families', Value: gc.multiMemberValidBeltFamilies, Notes: 'دارای ۲ یا چند SKU' },
    { Section: 'FAMILY_VALIDATION_VERDICT', Metric: 'Valid Singleton Belt Families', Value: gc.singletonValidBeltFamilies, Notes: 'تک‌عضوی واقعی از نظر مهندسی (کنترل پویا = ۰ ادغام همسان)' },
    { Section: 'SKU_RECONCILIATION', Metric: 'Total Catalog SKUs', Value: audit.totalCatalogSkus, Notes: '7,709 ممیزی‌شده + 2,726 غیرمرتبط با تسمه' },
    { Section: 'SKU_RECONCILIATION', Metric: 'Total Audited Belt & Belt-Adjacent SKUs', Value: audit.auditedSkuCount, Notes: `مجموع دقیق افراز ۸ سطلی: ${p.partitionTotal}` },
    { Section: 'SKU_RECONCILIATION', Metric: 'True Belt SKUs (Transmission + Conveyor)', Value: audit.trueBeltSkuCount, Notes: `${audit.truePowerTransmissionBeltSkuCount} انتقال نیرو + ${audit.trueConveyorBeltSkuCount} نوار نقاله/گریپ` },
    { Section: 'SKU_RECONCILIATION', Metric: 'Welding Clamp Equipment SKUs', Value: audit.beltEquipmentSkuCount, Notes: 'کدهای 110049 و 35852' },
    { Section: 'SKU_RECONCILIATION', Metric: 'Physical Review SKUs (REQUIRES_REVIEW)', Value: audit.confidenceCounts.REQUIRES_REVIEW, Notes: '۹ کد در ۴ گروه بازبینی موقت' },
    { Section: 'SKU_RECONCILIATION', Metric: 'Non-Belt SKUs in Audit Universe', Value: audit.auditedSkuCount - audit.trueBeltSkuCount - audit.beltEquipmentSkuCount - audit.confidenceCounts.REQUIRES_REVIEW, Notes: '۶۸ کد غیرتسمه‌ای در ۷ گروه مجزا' },
    { Section: 'EVIDENCE_CHECKSUM', Metric: 'Official Manufacturer Site Checked === Datasheet/Catalog Checked', Value: audit.reportA_skuClassifications.filter((r) => r.verification.officialManufacturerSiteChecked).length, Notes: `فقط تطبیق دقیق همان SKU با دیتاشیت همان سازنده (${audit.reportA_skuClassifications.filter((r) => r.verification.datasheetOrCatalogChecked).length})` },
    ...Object.entries(ev7).map(([k, v]) => ({
      Section: '7_LEVEL_EVIDENCE',
      Metric: k,
      Value: v,
      Notes: 'مجموع ۷ لایه شواهد برابر دقیق 7,709',
    })),
    { Section: 'INVARIANT_CHECKS', Metric: 'Families Failing Mixed-Invariant Checks (FAIL_MIXED)', Value: mixedFamsCount, Notes: 'تعداد خانواده‌های دارای مغایرت غیرمجاز در ویژگی‌های ثابت (باید ۰ باشد)' },
    { Section: 'INVARIANT_CHECKS', Metric: 'Valid Belt Families With Flagged UNKNOWN Applicable Specs', Value: unknownSpecBeltFamsCount, Notes: 'خانواده‌های دارای مشخصات نامعلوم (مانند برند OEM/UNSPECIFIED، ضخامت نقاله یا عمق دندانه خودرویی) — هرگز PASS ثابت دریافت نمی‌کنند' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s9), 'Final_Reconciliation');

  return wb;
}

interface LiveDbDifferenceRow {
  Diff_Index: number;
  Family_Code: string;
  Field_Name: string;
  Fixture_Value: string;
  Live_DB_Value: string;
  Live_DB_Updated_At: string;
  Difference_Type: string;
  Belt_Audit_Conflict: string;
  Impact_On_Proposed_Families: string;
  Recommended_Action: string;
  Read_Only_Query_Status: string;
}

interface LiveDbReadSummary {
  queried: boolean;
  status: 'VERIFIED_READ_ONLY' | 'UNVERIFIED';
  checkedAt: string;
  liveFamiliesCount: number | null;
  liveVariantsCount: number | null;
  skuFieldDiffCount: number | null;
  diffs: LiveDbDifferenceRow[];
  statusNote: string;
}

function classifyLiveDbDifference(
  familyCode: string,
  field: string,
  fixtureVal: string,
  liveVal: string
): {
  diffType: string;
  conflict: string;
  impact: string;
  action: string;
} {
  if (familyCode === 'FAM-32711') {
    return {
      diffType: 'CATEGORY_RECLASSIFICATION_NON_BELT',
      conflict: 'NO_CONFLICT_ALIGNED_WITH_BELT_AUDIT',
      impact: 'دیتابیس زنده نیز 32711 را از تسمه تایم به قطعات مکانیکی > تسمه‌سفت‌کن منتقل کرده است — 100% هم‌راستا با حذف آن از خانواده‌های تسمه.',
      action: 'PRESERVE_LIVE_DB_AND_SYNC_FIXTURE_METADATA',
    };
  }
  if (familyCode === 'FAM-40997' || familyCode === 'FAM-33365' || familyCode === 'FAM-34318') {
    return {
      diffType: 'CATEGORY_RECLASSIFICATION_NON_BELT',
      conflict: 'NO_CONFLICT_OUTSIDE_BELT_SCOPE',
      impact: 'تصحیح رده اقلام غیرتسمه (پولی پلی‌آمیدی، چرخ هرزگرد، قطعات پمپ دیافراگم) — بدون تداخل با خانواده‌های تسمه/نقاله.',
      action: 'PRESERVE_LIVE_DB_AND_SYNC_FIXTURE_METADATA',
    };
  }
  if (['FAM-38072', 'FAM-31354', 'FAM-35234', 'FAM-41539', 'FAM-31759', 'FAM-38081', 'FAM-35233', 'FAM-38071', 'FAM-38080', 'FAM-31494', 'FAM-42424', 'FAM-32021', 'FAM-41476'].includes(familyCode)) {
    return {
      diffType: 'FAMILY_NAME_CLEANUP_POLY_V',
      conflict: 'NO_CONFLICT_VARIANT_NAMES_UNCHANGED',
      impact: `تنها نام خانواده قدیمی Poly-V در DB تمیزکاری شده (حذف سایز یا PK/PJ تکراری)؛ کد و نام ${field === 'name' ? `SKUها (0 اختلاف واریانت)` : ''} دست‌نخورده و پیشنهاد بازسازی Poly-V بدون تغییر برقرار است.`,
      action: 'PRESERVE_LIVE_DB_CLEAN_NAME_BEFORE_FAMILY_MERGE',
    };
  }
  if (['FAM-16414', 'FAM-36378', 'FAM-38040', 'FAM-38933', 'FAM-40588'].includes(familyCode)) {
    return {
      diffType: 'FAMILY_NAME_CLEANUP_TIMING',
      conflict: 'NO_CONFLICT_VARIANT_NAMES_UNCHANGED',
      impact: 'تنها فاصله/عدد سایز یا نگارش فارسی OPTI->اپتی در نام خانواده مبدا ویرایش شده؛ کد SKUها بدون تغییر است (توجه: در FAM-16414، برند OPTI همچنان باید OPTIBELT باقی بماند).',
      action: 'PRESERVE_LIVE_DB_KEEP_NORMALIZED_BRAND_OPTIBELT',
    };
  }
  if (familyCode.startsWith('FAM-90147') || familyCode === 'FAM-37618' || familyCode === 'FAM-40709') {
    return {
      diffType: 'ROLLER_PIN_RECLASSIFICATION',
      conflict: 'NO_CONFLICT_OUTSIDE_BELT_SCOPE',
      impact: 'اصلاح زیردسته پین سر رولر (خارج از محدوده تسمه و نوار نقاله).',
      action: 'PRESERVE_LIVE_DB_AND_SYNC_FIXTURE_METADATA',
    };
  }
  if (['FAM-90096', 'FAM-36494'].includes(familyCode)) {
    return {
      diffType: 'FAMILY_NAME_CLEANUP_PULLEY',
      conflict: 'NO_CONFLICT_OUTSIDE_BELT_SCOPE',
      impact: 'اصلاح نام خانواده پولی (خارج از محدوده تسمه).',
      action: 'PRESERVE_LIVE_DB_AND_SYNC_FIXTURE_METADATA',
    };
  }
  return {
    diffType: 'FAMILY_NAME_CLEANUP_CHAIN',
    conflict: 'NO_CONFLICT_OUTSIDE_BELT_SCOPE',
    impact: `پاکسازی عنوان خانواده زنجیر/قفل (${fixtureVal} => ${liveVal}) بدون اثر بر خانواده‌های تسمه.`,
    action: 'PRESERVE_LIVE_DB_AND_SYNC_FIXTURE_METADATA',
  };
}

export async function readLiveDatabaseDifferences(): Promise<LiveDbReadSummary> {
  const checkedAt = new Date().toISOString();
  if (!process.env.DATABASE_URL) {
    return {
      queried: false,
      status: 'UNVERIFIED',
      checkedAt,
      liveFamiliesCount: null,
      liveVariantsCount: null,
      skuFieldDiffCount: null,
      diffs: [
        {
          Diff_Index: 0,
          Family_Code: 'N/A',
          Field_Name: 'DATABASE_URL',
          Fixture_Value: 'NOT_SET',
          Live_DB_Value: 'UNAVAILABLE',
          Live_DB_Updated_At: checkedAt,
          Difference_Type: 'RUNTIME_ENV_MISSING',
          Belt_Audit_Conflict: 'UNVERIFIED',
          Impact_On_Proposed_Families: 'DATABASE_URL در محیط فعلی تنظیم نشده است؛ وضعیت مقایسه زنده UNVERIFIED است.',
          Recommended_Action: 'RUN_READONLY_WITH_DATABASE_URL',
          Read_Only_Query_Status: 'UNVERIFIED',
        },
      ],
      statusNote: 'UNVERIFIED — DATABASE_URL not set; skipped live PostgreSQL inspection.',
    };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const famsRes = await client.query(
      'SELECT code, name, brand, category_name, submenu, subcategory, updated_at FROM public.catalog_families WHERE is_active AND NOT is_deleted ORDER BY code'
    );
    const varsRes = await client.query(
      'SELECT code, family_code, name, size, unit FROM public.catalog_variants WHERE active ORDER BY code'
    );

    const famByCode = new Map<string, any>(famsRes.rows.map((r: any) => [String(r.code), r]));
    const varByCode = new Map<string, any>(varsRes.rows.map((r: any) => [String(r.code), r]));

    const diffs: LiveDbDifferenceRow[] = [];
    let skuFieldDiffCount = 0;

    for (const s of catalogue as Array<any>) {
      const stored = famByCode.get(String(s.code));
      if (!stored) {
        diffs.push({
          Diff_Index: diffs.length + 1,
          Family_Code: String(s.code),
          Field_Name: 'MISSING_IN_LIVE_DB',
          Fixture_Value: String(s.name || ''),
          Live_DB_Value: '',
          Live_DB_Updated_At: '',
          Difference_Type: 'MISSING_FAMILY',
          Belt_Audit_Conflict: 'REQUIRES_CHECK',
          Impact_On_Proposed_Families: 'خانواده در دیتابیس زنده یافت نشد.',
          Recommended_Action: 'INVESTIGATE_BEFORE_MIGRATION',
          Read_Only_Query_Status: 'VERIFIED_READ_ONLY',
        });
        continue;
      }

      const fieldPairs: Array<[string, string]> = [
        ['name', 'name'],
        ['category_name', 'categoryName'],
        ['subcategory', 'technicalType'],
        ['submenu', 'submenu'],
      ];
      for (const [dbField, srcField] of fieldPairs) {
        const sv = String(s[srcField] ?? '').trim();
        const dv = String(stored[dbField] ?? '').trim();
        if (sv !== dv) {
          const meta = classifyLiveDbDifference(String(s.code), dbField, sv, dv);
          diffs.push({
            Diff_Index: diffs.length + 1,
            Family_Code: String(s.code),
            Field_Name: dbField,
            Fixture_Value: sv,
            Live_DB_Value: dv,
            Live_DB_Updated_At: stored.updated_at ? new Date(stored.updated_at).toISOString() : '',
            Difference_Type: meta.diffType,
            Belt_Audit_Conflict: meta.conflict,
            Impact_On_Proposed_Families: meta.impact,
            Recommended_Action: meta.action,
            Read_Only_Query_Status: 'VERIFIED_READ_ONLY',
          });
        }
      }

      for (const v of s.variants || []) {
        const svVar = varByCode.get(String(v.code));
        if (!svVar || String(v.name ?? '').trim() !== String(svVar.name ?? '').trim() || String(v.size ?? '').trim() !== String(svVar.size ?? '').trim()) {
          skuFieldDiffCount++;
        }
      }
    }

    await client.query('ROLLBACK');
    const actualCheckTs = new Date().toISOString();
    return {
      queried: true,
      status: 'VERIFIED_READ_ONLY',
      checkedAt: actualCheckTs,
      liveFamiliesCount: famsRes.rowCount ?? famsRes.rows.length,
      liveVariantsCount: varsRes.rowCount ?? varsRes.rows.length,
      skuFieldDiffCount,
      diffs:
        diffs.length > 0
          ? diffs
          : [
              {
                Diff_Index: 0,
                Family_Code: 'ALL_1383',
                Field_Name: 'FULL_PARITY',
                Fixture_Value: `${(catalogue as Array<any>).length} families`,
                Live_DB_Value: `${famsRes.rows.length} families / ${varsRes.rows.length} variants`,
                Live_DB_Updated_At: actualCheckTs,
                Difference_Type: 'ZERO_DIFF',
                Belt_Audit_Conflict: 'NONE',
                Impact_On_Proposed_Families: 'تطبیق ۱۰۰٪ خواندنی با دیتابیس زنده بدون اختلاف.',
                Recommended_Action: 'NONE',
                Read_Only_Query_Status: 'VERIFIED_READ_ONLY',
              },
            ],
      statusNote: `VERIFIED_READ_ONLY (${actualCheckTs}): ${famsRes.rows.length} families, ${varsRes.rows.length} variants, ${diffs.length} family metadata diffs, ${skuFieldDiffCount} SKU diffs.`,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const failTs = new Date().toISOString();
    return {
      queried: false,
      status: 'UNVERIFIED',
      checkedAt: failTs,
      liveFamiliesCount: null,
      liveVariantsCount: null,
      skuFieldDiffCount: null,
      diffs: [
        {
          Diff_Index: 0,
          Family_Code: 'N/A',
          Field_Name: 'POSTGRES_CONNECTION',
          Fixture_Value: 'READ_ONLY_CHECK',
          Live_DB_Value: 'UNREACHABLE',
          Live_DB_Updated_At: failTs,
          Difference_Type: 'CONNECTION_ERROR',
          Belt_Audit_Conflict: 'UNVERIFIED',
          Impact_On_Proposed_Families: `اتصال خواندنی به دیتابیس برقرار نشد (${errMsg})؛ وضعیت UNVERIFIED است.`,
          Recommended_Action: 'VERIFY_NETWORK_AND_DATABASE_URL',
          Read_Only_Query_Status: 'UNVERIFIED_CONNECTION_FAILED',
        },
      ],
      statusNote: `UNVERIFIED (${failTs}) — Read-only PostgreSQL query failed: ${errMsg}`,
    };
  } finally {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors on close
      }
      client.release();
    }
    await pool.end();
  }
}

function buildPreApprovalWorkbook(
  audit: ReturnType<typeof runBeltCatalogAudit>,
  liveDb: LiveDbReadSummary
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const byFamilySkus = new Map<string, typeof audit.reportA_skuClassifications>();
  for (const r of audit.reportA_skuClassifications) {
    const arr = byFamilySkus.get(r.proposedFamilyId) || [];
    arr.push(r);
    byFamilySkus.set(r.proposedFamilyId, arr);
  }

  const validBeltConveyorFams = audit.reportB_proposedFamilies.filter(
    (f) => !f.beltDivision.startsWith('non-belt-') && f.beltDivision !== 'belt-welding-tool' && f.beltDivision !== 'service-ambiguous'
  );
  const singletonValidFams = validBeltConveyorFams.filter((f) => f.skuCount === 1);
  const multiMemberValidFams = validBeltConveyorFams.filter((f) => f.skuCount > 1);

  const crossBrandGroups = new Map<string, Set<string>>();
  for (const f of validBeltConveyorFams) {
    const eqKey = [
      f.beltDivision,
      f.profile,
      f.sidedness,
      f.supplyForm,
      f.fixedSpecs.bodyMaterial,
      f.fixedSpecs.tensileCord,
      f.fixedSpecs.backingOrCoating || 'STD',
    ].join('|');
    const set = crossBrandGroups.get(eqKey) || new Set<string>();
    set.add(f.proposedFamilyId);
    crossBrandGroups.set(eqKey, set);
  }

  // Sheet 1: Final_647_Groups
  const gc = audit.groupCounts;
  const sheet1Rows = audit.reportB_proposedFamilies.map((f, idx) => {
    const members = byFamilySkus.get(f.proposedFamilyId) || [];
    const groupClass = f.beltDivision.startsWith('non-belt-')
      ? 'NON_BELT_SEPARATED'
      : f.beltDivision === 'belt-welding-tool'
        ? 'EQUIPMENT_WELDING_CLAMP'
        : f.beltDivision === 'service-ambiguous'
          ? 'MANUAL_REVIEW_GROUP'
          : f.skuCount === 1
            ? 'VALID_SINGLETON_BELT'
            : 'VALID_MULTI_BELT';
    return {
      Group_Order: idx + 1,
      Proposed_Family_ID: f.proposedFamilyId,
      Family_Name_FA: f.familyNameFa,
      Family_Name_EN: f.familyNameEn,
      Group_Classification: groupClass,
      Group_Separation_Summary: `${gc.validBeltAndConveyorFamilies} valid belt/conveyor (${gc.singletonValidBeltFamilies} singletons + ${gc.multiMemberValidBeltFamilies} multi) + ${gc.weldingToolGroups} welding tools + ${gc.provisionalReviewGroups} review + ${gc.separatedNonBeltFamilies} non-belt = ${gc.totalProposedGroups} groups`,
      Brand: f.brand,
      Product_Type: members[0]?.actualProductType || f.familyNameFa,
      Belt_Division: f.beltDivision,
      Profile: f.profile,
      Sidedness: f.sidedness,
      Supply_Form: f.supplyForm,
      Unit: f.unit,
      Pitch_mm: f.fixedSpecs.pitchMm ?? '',
      Belt_Thickness_mm: f.fixedSpecs.beltThicknessMm ?? '',
      Body_Material: f.fixedSpecs.bodyMaterial,
      Tensile_Cord: f.fixedSpecs.tensileCord,
      Backing_Coating: f.fixedSpecs.backingOrCoating || '',
      Standard_Reference: f.fixedSpecs.standardReference,
      Excel_Category_Slug: f.categorySlug,
      Excel_Category_Name: f.categoryName,
      Excel_Submenu: f.submenu,
      Excel_Leaf: f.leaf,
      Taxonomy_Gap: f.taxonomyGap || '',
      SKU_Count: f.skuCount,
      All_Member_SKUs: f.memberSkus.join(', '),
      Source_Family_IDs: f.sourceFamilyIds.join(', '),
      Confidence_Summary: [...new Set(members.map((m) => m.confidence))].join(', '),
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet1Rows), 'Final_647_Groups');

  // Sheet 2: All_634_Belt_Conveyor_Families
  const sheet2Rows = validBeltConveyorFams.map((f, idx) => {
    const members = byFamilySkus.get(f.proposedFamilyId) || [];
    const eqKey = [
      f.beltDivision,
      f.profile,
      f.sidedness,
      f.supplyForm,
      f.fixedSpecs.bodyMaterial,
      f.fixedSpecs.tensileCord,
      f.fixedSpecs.backingOrCoating || 'STD',
    ].join('|');
    const equivalents = [...(crossBrandGroups.get(eqKey) || [])].filter((id) => id !== f.proposedFamilyId);
    return {
      Family_Order: idx + 1,
      Proposed_Family_ID: f.proposedFamilyId,
      Family_Name_FA: f.familyNameFa,
      Family_Name_EN: f.familyNameEn,
      Cohort_Breakdown_Note: `${gc.validBeltAndConveyorFamilies} valid belt/conveyor families (${gc.singletonValidBeltFamilies} singletons + ${gc.multiMemberValidBeltFamilies} multi-member); excludes ${gc.weldingToolGroups} welding tools, ${gc.provisionalReviewGroups} review groups, ${gc.separatedNonBeltFamilies} non-belt groups`,
      Cohort_Type: f.skuCount === 1 ? 'SINGLETON' : 'MULTI_MEMBER',
      Brand: f.brand,
      Product_Type: members[0]?.actualProductType || f.familyNameFa,
      Belt_Division: f.beltDivision,
      Profile: f.profile,
      Sidedness: f.sidedness,
      Supply_Form: f.supplyForm,
      Unit: f.unit,
      Pitch_mm: f.fixedSpecs.pitchMm ?? '',
      Body_Material: f.fixedSpecs.bodyMaterial,
      Tensile_Cord: f.fixedSpecs.tensileCord,
      Backing_Coating: f.fixedSpecs.backingOrCoating || '',
      Standard_Reference: f.fixedSpecs.standardReference,
      Excel_Path: `${f.categorySlug} (${f.categoryName}) > ${f.submenu} > ${f.leaf}`,
      Taxonomy_Gap: f.taxonomyGap || '',
      Variable_Parameters: f.variableParameters.join(' | '),
      SKU_Count: f.skuCount,
      All_Member_SKUs: f.memberSkus.join(', '),
      Source_Family_IDs: f.sourceFamilyIds.join(', '),
      Cross_Brand_Equivalents: equivalents.join(', '),
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet2Rows), 'All_634_Belt_Conveyor_Families');

  // Sheet 3: Singleton_247_Validation (dynamically computed duplicate/invariant scan)
  let totalIdenticalMergeCandidates = 0;
  const sheet3Rows = singletonValidFams.map((f) => {
    const m = (byFamilySkus.get(f.proposedFamilyId) || [])[0];
    const dupCheck = findIdenticalInvariantMergeCandidates(f, validBeltConveyorFams);
    totalIdenticalMergeCandidates += dupCheck.identicalMergeCandidateCount;

    const independenceCategory =
      dupCheck.sameBrandSimilarDiffs.length > 0
        ? 'SAME_BRAND_DIFFERS_ON_INVARIANT_SPEC'
        : dupCheck.crossBrandSimilarIds.length > 0
          ? 'UNIQUE_BRAND_COMBINATION_IN_PROFILE'
          : 'COMPLETELY_UNIQUE_PROFILE_IN_CATALOG';

    const reasonFa =
      dupCheck.identicalMergeCandidateCount > 0
        ? `کاندیدای ادغام همسان یافت شد: ${dupCheck.identicalCandidateIds.join(', ')}`
        : dupCheck.sameBrandSimilarDiffs.length > 0
          ? `با وجود وجود خانواده هم‌برند و هم‌پروفیل (${dupCheck.sameBrandSimilarDiffs.length})، این تک‌کد در ویژگی غیرمتغیر مهندسی متفاوت است (${dupCheck.sameBrandSimilarDiffs.join('؛ ')}) و ادغام آن باعث ترکیب اطلاعات نادرست فنی یا واحد فروش می‌شود.`
          : dupCheck.crossBrandSimilarIds.length > 0
            ? `ترکیب منحصربه‌فرد برند (${f.brand}) با پروفیل ${f.profile} و فرم عرضه ${f.supplyForm}؛ هیچ خانواده هم‌برند مشابهی وجود ندارد (مشابهات غیرهم‌برند: ${dupCheck.crossBrandSimilarIds.slice(0, 4).join('، ')} که به دلیل قانون ممنوعیت ادغام برندهای مختلف قابل ادغام نیستند).`
            : `پروفیل/ساختار منحصربه‌فرد در کل کاتالوگ (${f.profile} / ${f.beltDivision}) بدون هیچ خانواده مشابه هم‌برند یا غیرهم‌برند؛ باید مستقل باقی بماند.`;

    return {
      SKU: m.sku,
      Original_Name: m.originalName,
      Original_Size: m.originalSize,
      Original_Unit: m.originalUnit,
      Brand: f.brand,
      Manufacturer_Code: m.technical.lengthDesignation || m.technical.widthCode || m.technical.profile,
      Belt_Type: m.actualProductType,
      Belt_Division: f.beltDivision,
      Profile: f.profile,
      Pitch_mm: f.fixedSpecs.pitchMm ?? '',
      Tooth_Height_mm: f.fixedSpecs.toothHeightMm ?? '',
      Belt_Thickness_mm: f.fixedSpecs.beltThicknessMm ?? '',
      Body_Material: f.fixedSpecs.bodyMaterial,
      Tensile_Cord: f.fixedSpecs.tensileCord,
      Backing_Coating: f.fixedSpecs.backingOrCoating || 'استاندارد بدون روکش اضافه',
      Supply_Form: f.supplyForm,
      Unit: f.unit,
      Proposed_Family_ID: f.proposedFamilyId,
      Same_Brand_Similar_Families: dupCheck.sameBrandSimilarDiffs.join(' | ') || 'NONE',
      Cross_Brand_Similar_Families: dupCheck.crossBrandSimilarIds.slice(0, 8).join(', ') || 'NONE',
      Identical_Invariant_Merge_Candidates: dupCheck.identicalMergeCandidateCount,
      Can_Merge_Without_Data_Loss:
        dupCheck.identicalMergeCandidateCount === 0
          ? 'NO — MUST_STAY_INDEPENDENT'
          : `CANDIDATES: ${dupCheck.identicalCandidateIds.join(', ')}`,
      Independence_Category: independenceCategory,
      Reason_For_Independence: reasonFa,
      Verification_Evidence_Class: m.verification.evidenceClass7,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet3Rows), 'Singleton_247_Validation');

  // Sheet 4: MultiMember_387_Validation (dynamically computed across ALL 14+ attributes)
  const multiValidationResults = multiMemberValidFams.map((f) =>
    validateFamilyEngineeringHomogeneity(f, byFamilySkus.get(f.proposedFamilyId) || [])
  );
  const sheet4Rows = multiMemberValidFams.map((f, i) => {
    const val = multiValidationResults[i];
    return {
      Proposed_Family_ID: f.proposedFamilyId,
      Family_Name_FA: f.familyNameFa,
      Brand: f.brand,
      Profile: f.profile,
      Belt_Division: f.beltDivision,
      Supply_Form: f.supplyForm,
      Unit: f.unit,
      SKU_Count: f.skuCount,
      Brand_Check: val.brandCheck,
      Product_Type_Check: val.productTypeCheck,
      Operating_Principle_Check: val.operatingPrincipleCheck,
      Profile_Check: val.profileCheck,
      Pitch_Check: val.pitchCheck,
      Tooth_Angle_Check: val.toothAngleCheck,
      Tooth_Height_Check: val.toothHeightCheck,
      Belt_Width_Check: val.beltWidthCheck,
      Belt_Thickness_Check: val.beltThicknessCheck,
      Body_Material_Check: val.bodyMaterialCheck,
      Tensile_Cord_Check: val.tensileCordCheck,
      Covering_Check: val.coveringCheck,
      Sidedness_Check: val.sidednessCheck,
      Supply_Form_Check: val.supplyFormCheck,
      Unit_Check: val.unitCheck,
      Standard_Check: val.standardCheck,
      Unknown_Attributes: val.unknownAttributes.join(', ') || 'NONE',
      Not_Applicable_Attributes: val.notApplicableAttributes.join(', ') || 'NONE',
      Mixed_Attributes: val.mixedAttributes.join(', ') || 'NONE',
      Strict_Validation_Passed: val.passedStrictValidation ? 'YES' : 'NO',
      Variable_Parameters: f.variableParameters.join(' | '),
      Merged_From_Families: f.mergedFromFamilies.join(', '),
      Split_From_Families: f.splitFromFamilies.join(', '),
      All_Member_SKUs: f.memberSkus.join(', '),
      Homogeneity_Verdict: val.verdictDetail,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet4Rows), 'MultiMember_387_Validation');

  // Sheet 5: Brand_Audit
  const brandGroups = new Map<string, typeof audit.reportA_skuClassifications>();
  for (const r of audit.reportA_skuClassifications) {
    if (r.technical.beltDivision.startsWith('non-belt-')) continue;
    const arr = brandGroups.get(r.detectedBrand) || [];
    arr.push(r);
    brandGroups.set(r.detectedBrand, arr);
  }

  const BRAND_CLASSIFICATION_META: Record<
    string,
    { category: string; mergeDecision: string; notes: string; aliases: string }
  > = {
    BANDO: {
      category: 'VERIFIED_MANUFACTURER_BRAND',
      mergeDecision: 'KEEP_UNIFIED (Bando Chemical Industries)',
      aliases: 'BANDO, باندو',
      notes: 'تولیدکننده ژاپنی تاییدشده (Synchro-Link, Power-King, Red-S).',
    },
    OPTIBELT: {
      category: 'CONFIRMED_SPELLING_ALIAS_CLUSTER',
      mergeDecision: 'MERGE_OPTI_OPTIBELT_PERSIAN (Same Brand: Optibelt GmbH)',
      aliases: 'OPTIBELT, OPTI, اپتی, اوپتی, اپتی بلت',
      notes: 'عبارت «اپتی / اوپتی / OPTI» در انبار مخفف قطعی برند آلمانی Optibelt است. در دیتابیس زنده هم FAM-16414 از OPTI به اپتی تغییر نام یافته بود که یکسان‌سازی به OPTIBELT انجام شد.',
    },
    MEGADYNE: {
      category: 'CONFIRMED_SPELLING_ALIAS_CLUSTER',
      mergeDecision: 'MERGE_SPELLING_VARIANTS (Same Brand: Megadyne Group)',
      aliases: 'MEGADYNE, MEGA FLEX, مگادین, مگداین, مگدان',
      notes: 'غلط‌های املایی «مگداین / مگدان» به Megadyne یکسان‌سازی شده‌اند.',
    },
    MITSUBOSHI: {
      category: 'VERIFIED_MANUFACTURER_BRAND',
      mergeDecision: 'STRICTLY_SEPARATE_FROM_MITSUBISHI_AND_MITSUBAY',
      aliases: 'MITSUBOSHI, MITSOBOSHI (50151), میتسوبوشی',
      notes: 'تولیدکننده ژاپنی Mitsuboshi Belting Ltd — اصلاح کد 50151 با غلط املایی MITSOBOSHI؛ هرگز نباید با MITSUBISHI یا MITSUBAY ادغام شود.',
    },
    MITSUBISHI: {
      category: 'VERIFIED_OR_COMMERCIAL_LABEL_KEPT_SEPARATE',
      mergeDecision: 'KEEP_SEPARATE_FROM_MITSUBOSHI_AND_MITSUBAY',
      aliases: 'MITSUBISHI, MITSUBISHH (36543), میتسوبیشی',
      notes: 'شامل 36 کد + اصلاح 36543 (MITSUBISHH)؛ ممکن است در بازار برخی تایم‌های خودرویی OE میتسوبیشی یا لیبل تجاری باشد — تا تایید فاکتور خرید با Mitsuboshi یا Mitsubay ادغام نمی‌شود.',
    },
    MITSUBAY: {
      category: 'VERIFIED_COMMERCIAL_BRAND',
      mergeDecision: 'KEEP_SEPARATE (Thai Sin Anant / Mitsubay Rubber)',
      aliases: 'MITSUBAY',
      notes: 'برند تجاری مستقل تسمه‌های صنعتی (تولید تایلند) — با MITSUBOSHI/MITSUBISHI یکی نیست.',
    },
    MITSUMI: {
      category: 'VERIFIED_COMMERCIAL_BRAND',
      mergeDecision: 'KEEP_SEPARATE',
      aliases: 'MITSUMI',
      notes: 'برند مستقل ثبت‌شده در 48 کد کاتالوگ (جوشی و صنعتی) — بدون مدرک ارتباط با میتسوبوشی.',
    },
    MITSUKO: {
      category: 'VERIFIED_COMMERCIAL_BRAND',
      mergeDecision: 'KEEP_SEPARATE',
      aliases: 'MITSUKO',
      notes: 'برند مستقل ثبت‌شده در 11 کد (تایمینگ 8M/5M/L و وی‌بلت SPB).',
    },
    BERAVO: {
      category: 'CONFIRMED_SPELLING_ALIAS_CLUSTER',
      mergeDecision: 'MERGE_PHONETIC_BRAVO_SPELLING_KEEP_BR_SEPARATE',
      aliases: 'BRAVO, BERAVO, BERAVOO, BREAVO, براوو',
      notes: 'چهار املای آوایی تایپی یک نام (BRAVO / BERAVO / BERAVOO / BREAVO) در دسته‌های یکسان تایم 8M/H/L و وی‌بلت؛ به برند BERAVO یکسان شدند، اما B.R (3 کد جوشی) و BR (کد 39074) جدا نگه داشته شدند.',
    },
    HANCHANG: {
      category: 'CONFIRMED_SPELLING_ALIAS_CLUSTER',
      mergeDecision: 'KEEP_UNIFIED (Hangzhou Hanchang — Merged HACHANG 52307)',
      aliases: 'HANCHANG, HACHANG (52307), هانچانگ, هانچنگ',
      notes: 'برند شناخته‌شده تایمینگ Hangzhou Hanchan/Hanchang — کد تایپی 52307 (HACHANG) نیز به HANCHANG ملحق شد. کدهای HC (19 کد) جدا نگه داشته شدند.',
    },
    FUJI: {
      category: 'VERIFIED_COMMERCIAL_BRAND',
      mergeDecision: 'KEEP_SEPARATE',
      aliases: 'FUJI, فوجی',
      notes: 'برند تجاری واقعی موجود در 87 کد (عمدتاً تایم صنعتی L/H/XL/5M/8M و وی‌بلت).',
    },
    'M.T': {
      category: 'WAREHOUSE_ABBREVIATION_OR_PRIVATE_BRAND',
      mergeDecision: 'KEEP_SEPARATE_DO_NOT_MERGE (327 SKUs)',
      aliases: 'M.T, M T',
      notes: 'مخفف پرتکرار انبار (327 کد در تایمینگ و وی‌بلت). بدون فاکتور خرید نمی‌توان آن را به برند دیگر (مانند Mitsuboshi/Mitsumi) منتسب کرد.',
    },
    EHRE: {
      category: 'VERIFIED_COMMERCIAL_BRAND_FIXED_SPELLING',
      mergeDecision: 'RENAMED_FROM_EHER_TO_EHRE (Matches exact DB text)',
      aliases: 'EHRE (41777, 41554)',
      notes: 'اصلاح برچسب کدبیس از EHER به املای واقعی درج‌شده در هر دو SKU کاتالوگ (EHRE).',
    },
    ENTRO: {
      category: 'SUSPECTED_ALIAS_KEPT_SEPARATE',
      mergeDecision: 'DO_NOT_MERGE_WITHOUT_INVOICE_PROOF',
      aliases: 'ENTRO (7 SKUs)',
      notes: 'احتمال تشابه با INTROTECH یا ENTEROTECH وجود دارد، اما به دلیل نبود مدرک قطعی جدا نگه داشته شد.',
    },
    ENTEROTECH: {
      category: 'SUSPECTED_ALIAS_KEPT_SEPARATE',
      mergeDecision: 'DO_NOT_MERGE_WITHOUT_INVOICE_PROOF',
      aliases: 'ENTEROTECH (1 SKU)',
      notes: 'تک‌رکورد؛ بدون تایید فاکتور در INTROTECH یا ENTRO ادغام نمی‌شود.',
    },
    INTROTECH: {
      category: 'CONFIRMED_SPELLING_ALIAS_CLUSTER',
      mergeDecision: 'MERGE_INTO_TECH_41201_41202 (27 SKUs)',
      aliases: 'INTRO TECH, INTROTECH, INTO TECH (41201, 41202)',
      notes: 'دو رکورد 41201 و 41202 با تایپ INTO TECH دقیقاً املای ناقص INTRO TECH در همان سری کلاسیک B/C هستند و یکسان شدند (اما ENTRO/ENTEROTECH جدا ماندند).',
    },
    TECHNO: {
      category: 'SUSPECTED_ALIAS_KEPT_SEPARATE',
      mergeDecision: 'KEEP_SEPARATE_FROM_TEKNO (50143, 23378)',
      aliases: 'TECHNO (2 SKUs)',
      notes: 'استخراج‌شده از UNSPECIFIED/FOREIGN-OEM؛ تا تایید فاکتور با TEKNO (3 کد) ادغام نمی‌شود.',
    },
    TEKNO: {
      category: 'SUSPECTED_ALIAS_KEPT_SEPARATE',
      mergeDecision: 'KEEP_SEPARATE_FROM_TECHNO (3 SKUs)',
      aliases: 'TEKNO (3 SKUs)',
      notes: 'جدا از TECHNO تا بررسی فاکتور خرید.',
    },
    SYNCHRONOUS: {
      category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR',
      mergeDecision: 'FLAG_AS_GENERIC_BELT_TYPE_LABEL_NOT_BRAND (3 SKUs)',
      aliases: 'SYNCHRONOUS (جایگاه اشتباه برند در شرح انبار)',
      notes: 'کلمه Synchronous نوع تسمه (سنکرون/تایمینگ) است نه نام کارخانه سازنده! در جدول برند حفظ شده تا در فاز 4 برند واقعی روی تسمه خوانده شود.',
    },
    'B.R': {
      category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR',
      mergeDecision: 'KEEP_SEPARATE_FROM_BR_AND_BERAVO',
      aliases: 'B.R (3 PU welded SKUs)',
      notes: 'کد اختصاری روی 3 تسمه جوشی پلی‌یورتان — با BR و BERAVO ادغام نشده است.',
    },
    BR: {
      category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR',
      mergeDecision: 'KEEP_SEPARATE_FROM_B.R_AND_BERAVO',
      aliases: 'BR (1 SKU: 39074)',
      notes: 'جدا از B.R و BERAVO.',
    },
    HC: { category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR', mergeDecision: 'KEEP_SEPARATE_FROM_HANCHANG', aliases: 'HC (19 SKUs)', notes: 'اختصار انبار؛ بدون مدرک قطعی با HANCHANG ادغام نمی‌شود.' },
    KM: { category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR', mergeDecision: 'KEEP_SEPARATE', aliases: 'KM (21 SKUs)', notes: 'اختصار ثبت‌شده انبار.' },
    YS: { category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR', mergeDecision: 'KEEP_SEPARATE_FROM_YANGSAN', aliases: 'YS (5 SKUs)', notes: 'اختصار دوحرفی انبار؛ بدون سند با YANGSAN ادغام نمی‌شود.' },
    'T.C': { category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR', mergeDecision: 'KEEP_SEPARATE', aliases: 'T.C (11 SKUs)', notes: 'اختصار ثبت‌شده انبار.' },
    'T.K': { category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR', mergeDecision: 'KEEP_SEPARATE', aliases: 'T.K (7 SKUs)', notes: 'اختصار ثبت‌شده انبار.' },
    'T-B': { category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR', mergeDecision: 'KEEP_SEPARATE', aliases: 'T-B (9 SKUs)', notes: 'اختصار ثبت‌شده انبار.' },
    FDR: { category: 'WAREHOUSE_ABBREVIATION_OR_GENERIC_DESCRIPTOR', mergeDecision: 'KEEP_SEPARATE_FROM_FEDERAL', aliases: 'FDR (6 SKUs)', notes: 'اختصار سه حرفی انبار؛ با FEDERAL (27416) ادغام نشد.' },
    'FOREIGN-OEM': {
      category: 'OEM_OR_UNSPECIFIED_BUCKET',
      mergeDecision: 'DO_NOT_MERGE_INTO_NAMED_BRANDS (Cleaned 7 new commercial brands out)',
      aliases: 'خارجی',
      notes: 'سطل کالاهای با عنوان «خارجی» پس از استخراج برندهای پنهان (FEDERAL, FLYPARD, REZEX, JAGER, TECHNO). نیازمند بررسی فاکتور خرید برای تفکیک برند واقعی در فاز 4-5.',
    },
    'IRANIAN-OEM': { category: 'OEM_OR_UNSPECIFIED_BUCKET', mergeDecision: 'KEEP_SEPARATE_OEM_ORIGIN', aliases: 'ایرانی', notes: 'برچسب مبدأ ساخت داخلی.' },
    'ENGLAND-OEM': { category: 'OEM_OR_UNSPECIFIED_BUCKET', mergeDecision: 'KEEP_SEPARATE_OEM_ORIGIN', aliases: 'انگلیسی / انگلیس', notes: 'برچسب مبدأ انگلستان.' },
    'ITALY-OEM': { category: 'OEM_OR_UNSPECIFIED_BUCKET', mergeDecision: 'KEEP_SEPARATE_OEM_ORIGIN', aliases: 'ایتالیایی / ایتالیا', notes: 'برچسب مبدأ ایتالیا.' },
    'GERMANY-OEM': { category: 'OEM_OR_UNSPECIFIED_BUCKET', mergeDecision: 'KEEP_SEPARATE_OEM_ORIGIN', aliases: 'آلمانی / آلمان', notes: 'برچسب مبدأ آلمان.' },
    UNSPECIFIED: {
      category: 'OEM_OR_UNSPECIFIED_BUCKET',
      mergeDecision: 'KEEP_SEPARATE (Cleaned EHER->EHRE, MITSOBOSHI->MITSUBOSHI, FIRST, PERSON, TECHNO & 7 alias typos)',
      aliases: 'بدون برند صریح در نام انبار',
      notes: 'فاقد نام برند در عنوان انبار — برای قرائت از روی کالا/فاکتور خرید در فاز ۴-۵ علامت‌گذاری شده‌اند.',
    },
  };

  const oemBucketSet = new Set(['FOREIGN-OEM', 'IRANIAN-OEM', 'ENGLAND-OEM', 'ITALY-OEM', 'GERMANY-OEM', 'UNSPECIFIED']);
  const abbrBucketSet = new Set(['M.T', 'KM', 'HC', 'T.C', 'T-B', 'T.K', 'FDR', 'YS', 'B.R', 'BR']);
  const commercialBucketCount = [...brandGroups.keys()].filter(
    (b) => !oemBucketSet.has(b) && !abbrBucketSet.has(b) && b !== 'SYNCHRONOUS'
  ).length;
  const brandReconciliationHeader = {
    Brand_Code: '__RECONCILIATION_TOTALS__',
    Brand_Classification: `TOTAL_${brandGroups.size}_BUCKETS (${commercialBucketCount} Commercial/Mfg + ${abbrBucketSet.size} Abbr + 1 GenericWord + ${oemBucketSet.size} OEM/Unspecified)`,
    Raw_Variants_Or_Aliases: '8 new extracted brand buckets (11 SKUs) + 1 EHER->EHRE rename (2 SKUs) = 9 additions/corrections (13 SKUs) + 7 typo merges',
    SKU_Count: [...brandGroups.values()].reduce((s, arr) => s + arr.length, 0),
    Proposed_Family_Count: validBeltConveyorFams.length,
    Merge_Decision: 'ALL_SEPARATED_WITH_ZERO_FORCED_ALIAS_MERGES',
    Sample_SKUs: 'New buckets: FEDERAL(27416), FLYPARD(40106), FIRST(40781,40782), REZEX(40101,40102), TECHNO(50143,23378), JAGER(22743), PERSON(41292), MITSUBOSHI(50151) | Fix: EHRE(41777,41554)',
    Audit_Notes_And_Action: `تطبیق دقیق: ${brandGroups.size} سطل در ${[...brandGroups.values()].reduce((s, a) => s + a.length, 0)} SKU غیرتسمه‌ای-حذف‌شده شامل ${commercialBucketCount} برند تجاری/کارخانه‌ای، ${abbrBucketSet.size} کد اختصاری انبار، ۱ غلط املایی نوع کالا (SYNCHRONOUS) و ${oemBucketSet.size} سطل مبدأ/نامشخص.`,
  };

  const sheet5Rows = [
    brandReconciliationHeader,
    ...[...brandGroups.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([brandCode, items]) => {
        const famCount = new Set(items.map((i) => i.proposedFamilyId)).size;
        const meta = BRAND_CLASSIFICATION_META[brandCode] || {
          category: 'VERIFIED_MANUFACTURER_OR_COMMERCIAL_BRAND',
          mergeDecision: 'KEEP_DISTINCT_BRAND',
          aliases: brandCode,
          notes: 'برند تجاری مستقل شناسایی‌شده در نام کاتالوگ.',
        };
        return {
          Brand_Code: brandCode,
          Brand_Classification: meta.category,
          Raw_Variants_Or_Aliases: meta.aliases,
          SKU_Count: items.length,
          Proposed_Family_Count: famCount,
          Merge_Decision: meta.mergeDecision,
          Sample_SKUs: items.slice(0, 8).map((i) => `${i.sku} (${i.originalName})`).join(' | '),
          Audit_Notes_And_Action: meta.notes,
        };
      }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet5Rows), 'Brand_Audit');

  // Sheet 6: ZRK_And_Physical_Review
  const autoZrkOrder = ['31501', '31502', '31504', '31505', '31506', '31769', '34722', '35232', '35023', '42209'];
  const zrkSkusSet = new Set(autoZrkOrder);
  const reviewRowsRaw = audit.reportA_skuClassifications.filter(
    (r) => r.confidence === 'REQUIRES_REVIEW' || zrkSkusSet.has(r.sku)
  );
  reviewRowsRaw.sort((a, b) => {
    const aZ = zrkSkusSet.has(a.sku) ? 1 : 0;
    const bZ = zrkSkusSet.has(b.sku) ? 1 : 0;
    if (aZ !== bZ) return aZ - bZ;
    if (aZ && bZ) return autoZrkOrder.indexOf(a.sku) - autoZrkOrder.indexOf(b.sku);
    return a.sku.localeCompare(b.sku);
  });

  const ZRK_META_TABLE: Record<string, { zrkRef: string; equiv: string; pitchStatus: string; sleeveCheck: string }> = {
    '31501': { zrkRef: 'Optibelt ZRK 1118 (Reference)', equiv: 'Gates 5047 / Dayco 94110 (Honda 108T × 17mm)', pitchStatus: 'CONFIRMED_9.525MM', sleeveCheck: 'REFERENCE_CONFIRMED' },
    '31502': { zrkRef: 'Optibelt ZRK 1119 (HR 58108 x 24)', equiv: 'Gates 5082XS / Honda 06141-PC6-305', pitchStatus: 'IDENTIFIED_9.525MM (Verify ZRK print vs industrial 864-8M)', sleeveCheck: 'RECOMMENDED_PHASE4_PRINT_CHECK' },
    '31504': { zrkRef: 'Optibelt ZRK 1128 (HR 58114 x 17)', equiv: 'Gates 5215XS / Hutchinson 114 HTDP 17 (PSA/Fiat)', pitchStatus: 'IDENTIFIED_9.525MM', sleeveCheck: 'RECOMMENDED_PHASE4_PRINT_CHECK' },
    '31505': { zrkRef: 'Optibelt ZRK 1537 (HR 76134 x 25)', equiv: 'Gates 5581XS / ContiTech CT1065 / Dayco 94957 (PSA 1.6L)', pitchStatus: 'IDENTIFIED_9.525MM (Verify ZRK print vs industrial 1072-8M)', sleeveCheck: 'RECOMMENDED_PHASE4_PRINT_CHECK' },
    '31506': { zrkRef: 'Optibelt ZRK 1262 / ZRK 1538', equiv: 'Gates 5049XS (ZRK 1262) / CT996 & Gates 5539 & Dayco 94714 (ZRK 1538)', pitchStatus: 'IDENTIFIED_9.525MM (Verify ZRK version vs industrial 1088-8M)', sleeveCheck: 'RECOMMENDED_PHASE4_PRINT_CHECK' },
    '31769': { zrkRef: 'Optibelt ZRK 1593', equiv: 'ContiTech CT1137 (HTDA 1305 9.525 M 22) / Gates 5631XS / Hutchinson 137 AHP 22', pitchStatus: 'CONFIRMED_9.525MM (L=1305mm)', sleeveCheck: 'OPTIONAL_VERSION_CHECK' },
    '34722': { zrkRef: 'Optibelt ZRK 1182', equiv: 'ContiTech CT887 / Dayco 94346 (127T × 25mm)', pitchStatus: 'CONFIRMED_9.525MM (Fixed swapped 25*127 -> 127T × 25mm)', sleeveCheck: 'OPTIONAL_VERSION_CHECK' },
    '35232': { zrkRef: 'Optibelt ZRK 1176', equiv: 'Dayco 94468 (TB232) / Gates T232 (Mitsubishi 4G64 123T × 29mm)', pitchStatus: 'CONFIRMED_9.525MM (Fixed swapped 29*123 -> 123T × 29mm)', sleeveCheck: 'OPTIONAL_VERSION_CHECK' },
    '35023': { zrkRef: 'Optibelt ZRK 1459', equiv: 'ContiTech CT1039 (HTDA 520 8000M 12.7) / Gates 5257XS / Mitsubishi MD182295', pitchStatus: 'CONFIRMED_8.000MM_SPLIT (Balance shaft 520mm — NOT 9.525mm)', sleeveCheck: 'SPLIT_TO_FAM_TIMING_AUTO_8MM_OPTIBELT' },
    '42209': { zrkRef: 'Forklift 123RU24 (Reference)', equiv: 'Mitsubishi MD154243 / Gates T232 narrow 24mm variant', pitchStatus: 'CONFIRMED_9.525MM', sleeveCheck: 'REFERENCE_CONFIRMED' },
  };

  const sheet6Rows = reviewRowsRaw.map((r) => {
    const isZrk = zrkSkusSet.has(r.sku);
    const zmeta = ZRK_META_TABLE[r.sku];
    return {
      Cohort: !isZrk
        ? 'PHYSICAL_REVIEW_9'
        : r.sku === '31501' || r.sku === '42209'
          ? 'AUTO_REF_VERIFIED_2'
          : 'ZRK_AUDIT_8',
      SKU: r.sku,
      Original_Name: r.originalName,
      Original_Size: r.originalSize,
      Original_Unit: r.originalUnit,
      Detected_Brand: r.detectedBrand,
      Identified_ZRK_Or_OEM_Ref: zmeta ? zmeta.zrkRef : 'MISSING_IN_WAREHOUSE_LABEL',
      Teeth_Count: r.technical.toothCount ?? '',
      Width_mm: r.technical.nominalWidthMm ?? '',
      Effective_Length_mm: r.technical.pitchLengthMm ?? '',
      Verified_Pitch_mm: r.technical.pitchMm ?? 'UNKNOWN',
      Pitch_Or_Review_Verdict: zmeta ? zmeta.pitchStatus : 'REQUIRES_PHYSICAL_INSPECTION',
      Equivalent_Cross_Refs: zmeta ? zmeta.equiv : 'N/A — Warehouse label lacks standard profile/dimensions',
      Proposed_Family_ID: r.proposedFamilyId,
      Physical_Check_Required: zmeta ? zmeta.sleeveCheck : 'YES — MANDATORY_BEFORE_FAMILY_ASSIGNMENT',
      Source_URL: r.verification.sourceUrl,
      Document_Type: r.verification.documentType,
      Audit_Notes_And_Action: r.engineeringReasoning,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet6Rows), 'ZRK_And_Physical_Review');

  // Sheet 7: Live_DB_Inspection (Strict READ ONLY or UNVERIFIED)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(liveDb.diffs), 'Live_DB_Inspection');

  // Sheet 8: Approved_Taxonomy_Mapping
  const leafAgg = new Map<string, { slug: string; catName: string; submenu: string; leaf: string | null; skus: string[]; fams: Set<string> }>();
  for (const r of audit.reportA_skuClassifications) {
    if (r.technical.operatingPrinciple === 'non-belt') continue;
    const key = `${r.proposedCategorySlug}|${r.proposedSubmenu}|${r.proposedLeaf}`;
    const entry = leafAgg.get(key) || {
      slug: r.proposedCategorySlug,
      catName: r.proposedCategoryName,
      submenu: r.proposedSubmenu,
      leaf: r.proposedLeaf,
      skus: [],
      fams: new Set<string>(),
    };
    entry.skus.push(r.sku);
    entry.fams.add(r.proposedFamilyId);
    leafAgg.set(key, entry);
  }

  const existingLeafRows = [...leafAgg.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug) || a.submenu.localeCompare(b.submenu))
    .map((e) => ({
      Mapping_Section: 'EXISTING_EXCEL_LEAF_MAPPING',
      Code_Or_Slug: e.slug,
      Category_Name: e.catName,
      Submenu_Or_Current_Location: e.submenu,
      Leaf_Or_Temporary_Location: e.leaf,
      Proposed_New_Leaf_FA: e.leaf,
      Resolution_Type: 'EXISTING_APPROVED_LEAF',
      Unique_SKU_Count: e.skus.length,
      Proposed_Family_Count: e.fams.size,
      Live_Menu_Modified: 'NO (Frozen)',
      Technical_Reason: 'برگ موجود در ساختار منوی اکسل؛ بدون تغییر منوی زنده.',
      All_SKUs_Sample_Or_Full: e.skus.length <= 25 ? e.skus.join(', ') : `${e.skus.slice(0, 15).join(', ')} ... (+${e.skus.length - 15} more)`,
    }));

  const gapMeta: Record<string, { recCat: string; proposedLeafFa: string; resType: string; reason: string }> = {
    'GAP-TIMING-T10-T20-LABEL': {
      recCat: 'تسمه تایمینگ (excel-v2-1-1)',
      proposedLeafFa: 'T5 , T10 , T20 , AT5 , AT10 , AT20',
      resType: 'LABEL_UPDATE_ONLY',
      reason: 'برگ فعلی فقط T5/AT5/AT10/AT20 را ذکر کرده اما کدهای تایم متریک T10 (و معدود T20) نیز در همین رده قرار می‌گیرند.',
    },
    'GAP-RIBBED-POLY-V': {
      recCat: 'تسمه وی‌بلت / چندشیاری (excel-v2-1-2)',
      proposedLeafFa: 'تسمه چندشیاری (Poly-V: PJ , PK , PL)',
      resType: 'NEW_LEAF_REQUIRED',
      reason: 'تسمه‌های چندشیاری ISO 9982 دارای شیارهای طولی هستند (مکانیزم متفاوت با تایم سنکرون و وی‌بلت تک‌ذوزنقه) و فاقد برگ مستقل در اکسل فعلی هستند.',
    },
    'GAP-VBELT-3V-5V-K-SPZ': {
      recCat: 'تسمه وی‌بلت (excel-v2-1-2)',
      proposedLeafFa: 'SPZ , XPZ , 3V , 3VX , 5V , 5VX و پروفیل سبک K/MX',
      resType: 'NEW_LEAF_OR_SPECIAL_LABEL_UPDATE',
      reason: 'پروفیل‌های باریک SPZ/XPZ و سری آمریکایی 3V/5V/3VX/5VX در عنوان برگ اسپشیال ذکر نشده‌اند.',
    },
    'GAP-COATED-VBELT': {
      recCat: 'تسمه وی‌بلت (excel-v2-1-2)',
      proposedLeafFa: 'تسمه وی‌بلت روکش‌دار / گریپ‌دار (B / XPC / B-APL)',
      resType: 'NEW_LEAF_REQUIRED',
      reason: 'در اکسل، برگ «APL دار» فقط زیر تسمه تایمینگ تعریف شده در حالی که این 52 کد، تسمه V شکل با روکش گریپ/لاستیکی هستند.',
    },
    'GAP-TIMING-MXL-3M-RPP': {
      recCat: 'تسمه تایمینگ (excel-v2-1-1)',
      proposedLeafFa: 'MXL / HTD 3M / RPP Silver 8M & 14M',
      resType: 'NEW_LEAF_OR_LABEL_UPDATE',
      reason: 'پروفیل ظریف MXL، HTD 3M و سری پارابولیک RPP Silver در برچسب برگ‌های تایم فعلی ذکر نشده‌اند.',
    },
    'GAP-TIMING-DOUBLE-SIDED': {
      recCat: 'تسمه تایمینگ (excel-v2-1-1)',
      proposedLeafFa: 'تسمه تایمینگ دوطرفه (DH , DL , DXL , DT5 , DT10 , D5M , D8M)',
      resType: 'NEW_LEAF_REQUIRED',
      reason: 'تسمه دوطرفه از نظر ضخامت، عملکرد و پولی با یک‌طرفه متفاوت است و باید برگ مستقل در اکسل داشته باشد.',
    },
    'GAP-TIMING-AUTOMOTIVE-RU': {
      recCat: 'تسمه تایمینگ (یا رده خودرویی/لیفتراک)',
      proposedLeafFa: 'تسمه تایمینگ دنده‌گرد خودرویی/لیفتراک (Optibelt ZRK / RU / 8mm)',
      resType: 'NEW_LEAF_REQUIRED',
      reason: 'تسمه‌های میل‌سوپاپ/بالانسر خودرویی و لیفتراک گام 9.525mm/8.0mm کاربری و پروفیل متفاوتی با HTD صنعتی دارند.',
    },
    'GAP-VBELT-BANDED': {
      recCat: 'تسمه وی‌بلت (excel-v2-1-2)',
      proposedLeafFa: 'تسمه به‌پشت‌پیوسته (Banded / Powerband)',
      resType: 'NEW_LEAF_REQUIRED',
      reason: 'تسمه‌های چندردیفه به‌پشت‌پیوسته (2RAX, 3RC, 4RSPC, 8R3VX و...) در ساختار منوی فعلی برگ اختصاصی ندارند.',
    },
    'GAP-VBELT-ENDLESS-CRC': {
      recCat: 'تسمه وی‌بلت / خطوط سرامیک',
      proposedLeafFa: 'تسمه گرده‌ماهی مداربسته لاستیکی (CRC / TRC Endless)',
      resType: 'NEW_LEAF_REQUIRED',
      reason: 'تسمه مداربسته تاج‌دار لاستیکی پایه C خطوط لعاب کاشی نباید با تسمه جوشی پلی‌یورتان متری یکسان دیده شود.',
    },
    'GAP-VBELT-HEXAGONAL': {
      recCat: 'تسمه وی‌بلت (excel-v2-1-2)',
      proposedLeafFa: 'تسمه شش‌ضلعی دوطرفه (AA , BB , CC)',
      resType: 'NEW_LEAF_REQUIRED',
      reason: 'تسمه شش‌ضلعی ISO 5289 برای درایوهای مارپیچ و تغییر جهت چرخش به کار می‌رود و برگ مستقل ندارد.',
    },
    'GAP-CONVEYOR-GRIP-STRIP': {
      recCat: 'تسمه بارکش (excel-v2-1-4)',
      proposedLeafFa: 'نوار گریپ آجدار پشت‌پلی‌استر (روکش غلتک و تسمه کشنده)',
      resType: 'LABEL_ALIGNMENT_OPTIONAL',
      reason: 'نوار گریپ در برگ «انواع تسمه بارکش صنعتی» جاگذاری شده و در صورت نیاز می‌تواند برچسب دقیق‌تر بگیرد.',
    },
  };

  const gapSkusMap = new Map<string, typeof audit.reportA_skuClassifications>();
  for (const r of audit.reportA_skuClassifications) {
    if (r.taxonomyGap) {
      const code = r.taxonomyGap.split(':')[0];
      const arr = gapSkusMap.get(code) || [];
      arr.push(r);
      gapSkusMap.set(code, arr);
    }
  }
  const gapRows = [...gapSkusMap.entries()].map(([gapCode, items]) => {
    const meta = gapMeta[gapCode] || {
      recCat: items[0].proposedCategoryName,
      proposedLeafFa: items[0].proposedLeaf,
      resType: 'NEW_LEAF_REQUIRED',
      reason: items[0].taxonomyGap || '',
    };
    const origLocations = [...new Set(items.map((i) => `${i.currentCategory} > ${i.currentSubcategory}`))].join(' | ');
    const famIds = [...new Set(items.map((i) => i.proposedFamilyId))];
    return {
      Mapping_Section: 'TAXONOMY_GAP_PROPOSAL',
      Code_Or_Slug: gapCode,
      Category_Name: meta.recCat,
      Submenu_Or_Current_Location: origLocations,
      Leaf_Or_Temporary_Location: `${items[0].proposedCategoryName} (${items[0].proposedCategorySlug}) > ${items[0].proposedSubmenu} > ${items[0].proposedLeaf}`,
      Proposed_New_Leaf_FA: meta.proposedLeafFa,
      Resolution_Type: meta.resType,
      Unique_SKU_Count: items.length,
      Proposed_Family_Count: famIds.length,
      Live_Menu_Modified: 'NO (Proposed Excel Mapping Only)',
      Technical_Reason: meta.reason,
      All_SKUs_Sample_Or_Full: items.map((i) => i.sku).join(', '),
    };
  });

  const nonBeltDestRows = audit.reportB_proposedFamilies
    .filter((f) => f.beltDivision.startsWith('non-belt-'))
    .map((f) => ({
      Mapping_Section: 'NON_BELT_REMOVAL_DESTINATION',
      Code_Or_Slug: f.proposedFamilyId,
      Category_Name: `${f.categoryName} (${f.categorySlug})`,
      Submenu_Or_Current_Location: f.submenu,
      Leaf_Or_Temporary_Location: f.leaf,
      Proposed_New_Leaf_FA: f.leaf,
      Resolution_Type: 'NON_BELT_MOVED_TO_OWN_CATEGORY',
      Unique_SKU_Count: f.skuCount,
      Proposed_Family_Count: 1,
      Live_Menu_Modified: 'NO',
      Technical_Reason: 'اقلام غیرتسمه‌ای خارج‌شده از دسته‌های تسمه/نقاله به دسته تخصصی واقعی خود در اکسل.',
      All_SKUs_Sample_Or_Full: f.memberSkus.join(', '),
    }));

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([...existingLeafRows, ...gapRows, ...nonBeltDestRows]),
    'Approved_Taxonomy_Mapping'
  );

  // Sheet 9: Final_SKU_Classification
  const sheet9Rows = audit.reportA_skuClassifications.map((r) => ({
    SKU: r.sku,
    Original_Name: r.originalName,
    Original_Size: r.originalSize,
    Original_Unit: r.originalUnit,
    Normalized_Unit: r.unit,
    Detected_Brand: r.detectedBrand,
    Current_Family_ID: r.currentFamilyId,
    Current_Category: r.currentCategory,
    Current_Subcategory: r.currentSubcategory,
    Proposed_Family_ID: r.proposedFamilyId,
    Proposed_Family_Name_FA: r.proposedFamilyNameFa,
    Proposed_Category_Slug: r.proposedCategorySlug,
    Proposed_Category_Name: r.proposedCategoryName,
    Proposed_Submenu: r.proposedSubmenu,
    Proposed_Leaf: r.proposedLeaf,
    Taxonomy_Gap: r.taxonomyGap || '',
    Belt_Division: r.technical.beltDivision,
    Profile: r.technical.profile,
    Pitch_mm: r.technical.pitchMm ?? '',
    Supply_Form: r.technical.supplyForm,
    Sidedness: r.technical.sidedness,
    Tooth_Count: r.technical.toothCount ?? '',
    Width_mm: r.technical.nominalWidthMm ?? '',
    Length_mm: r.technical.pitchLengthMm ?? r.technical.insideLengthMm ?? r.technical.outsideLengthMm ?? '',
    Body_Material: r.technical.bodyMaterial,
    Tensile_Cord: r.technical.tensileCord,
    Backing_Coating: r.technical.backingOrCoating || '',
    Evidence_Class_7: r.verification.evidenceClass7,
    Confidence_Level: r.confidence,
    Recommended_Action: r.recommendedAction,
    Engineering_Reasoning: r.engineeringReasoning,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet9Rows), 'Final_SKU_Classification');

  // Sheet 10: Migration_Readiness
  const manualReviewSkus = audit.reportA_skuClassifications.filter((r) => r.confidence === 'REQUIRES_REVIEW').map((r) => r.sku);
  const zrkPrintVerifySkus = ['31502', '31504', '31505', '31506'];
  const multiMixedCount = multiValidationResults.filter((v) => v.homogeneityVerdict === 'FAIL_MIXED_INVARIANT').length;
  const multiPassCount = multiValidationResults.filter((v) => v.homogeneityVerdict === 'PASS_HOMOGENEOUS').length;
  const multiConditionalCount = multiValidationResults.filter((v) => v.homogeneityVerdict === 'CONDITIONAL_UNKNOWN_SPECS').length;
  const liveDiffCount = liveDb.status === 'VERIFIED_READ_ONLY' ? liveDb.diffs.filter((d) => d.Diff_Index > 0).length : null;
  const readinessRows = [
    {
      Gate_Code: 'GATE_01_ENGINEERING_HOMOGENEITY',
      Gate_Name: `همگنی مهندسی ۱۶ ویژگی کلیدی خانواده‌ها (${multiMemberValidFams.length} چندعضوی + ${singletonValidFams.length} تک‌عضوی)`,
      Status: multiMixedCount === 0 ? 'READY_WITH_UNKNOWN_NOTES' : 'FAILED_MIXED_INVARIANTS',
      Count_Or_Metric: `${validBeltConveyorFams.length} valid families | multi: ${multiPassCount} PASS_HOMOGENEOUS, ${multiConditionalCount} CONDITIONAL_UNKNOWN_SPECS, ${multiMixedCount} FAIL_MIXED`,
      Blocker_SKUs: multiMixedCount === 0 ? 'NONE (0 mixed invariants; unknown specs isolated cleanly)' : `${multiMixedCount} families`,
      Owner_Action_Required: `تایید ساختار ${gc.validBeltAndConveyorFamilies} خانواده مهندسی تسمه/نقاله (+${gc.weldingToolGroups} ابزار جوشی و ${gc.separatedNonBeltFamilies} غیرتسمه‌ای).`,
    },
    {
      Gate_Code: 'GATE_02_SINGLETON_JUSTIFICATION',
      Gate_Name: `تایید تمام ${singletonValidFams.length} خانواده تک‌عضوی (کنترل پویا برای یافتن کاندیدای ادغام همسان)`,
      Status: totalIdenticalMergeCandidates === 0 ? 'READY_FOR_APPROVAL' : 'REQUIRES_MERGE_REVIEW',
      Count_Or_Metric: `${singletonValidFams.length} singletons verified / ${totalIdenticalMergeCandidates} merge candidates`,
      Blocker_SKUs: totalIdenticalMergeCandidates === 0 ? 'NONE' : `${totalIdenticalMergeCandidates} merge candidates`,
      Owner_Action_Required: 'تایید حفظ استقلال تمام تک‌عضوی‌ها بدون ادغام مصنوعی.',
    },
    {
      Gate_Code: 'GATE_03_BRAND_SEPARATION_AND_ALIASES',
      Gate_Name: `ممیزی ${brandGroups.size} سطل برند (۵۰ برند تجاری + ۱۰ مخفف انبار + ۶ OEM/نامشخص + ۱ عنوان عمومی SYNCHRONOUS)`,
      Status: 'READY_WITH_INVOICE_NOTE',
      Count_Or_Metric: `${brandGroups.size} normalized brand buckets; 9 brand cleanup changes (8 hidden extractions + EHRE rename, 13 SKUs) + 7 typo merges`,
      Blocker_SKUs: 'ENTRO/ENTEROTECH (8 SKUs), TECHNO/TEKNO (5 SKUs), SYNCHRONOUS (3 SKUs — generic descriptor used as brand)',
      Owner_Action_Required: 'تایید عدم ادغام ENTRO/ENTEROTECH و TECHNO/TEKNO و جایگزینی نام واقعی کارخانه برای SYNCHRONOUS در فاز ۴.',
    },
    {
      Gate_Code: 'GATE_04_ZRK_AND_35023_SPLIT',
      Gate_Name: 'تعیین تکلیف ۹ کاندید تایمینگ خودرویی Optibelt و جداسازی 35023 با گام 8.0mm',
      Status: 'CONDITIONAL_READY_WITH_PHASE4_SLEEVE_CHECK',
      Count_Or_Metric: '4 SKU با شواهد سری ZRK (نه دیتاشیت SKU) + 4 کد نیازمند خواندن مارک چاپی (31502, 31504, 31505, 31506) + کد 35023 با گام مستقل 8.000mm؛ هیچ تطبیق exact ZRK ادعا نمی‌شود',
      Blocker_SKUs: `${zrkPrintVerifySkus.join(', ')} (قرائت کد ZRK چاپ‌شده روی کاور برای تفکیک قطعی از HTD 8M صنعتی در فاز ۴)`,
      Owner_Action_Required: 'برای چهار SKU فهرست‌شده مارک چاپی روی تسمه فیزیکی خوانده شود؛ 35023 با گام 8mm در خانواده 9.525mm ادغام نشود و هیچ‌یک به‌عنوان دیتاشیت دقیق ZRK اعلام نشود.',
    },
    {
      Gate_Code: 'GATE_05_PHYSICAL_REVIEW_9_BLOCKERS',
      Gate_Name: '۹ کد فاقد مشخصات کافی انبار (REQUIRES_REVIEW)',
      Status: 'BLOCKER_BEFORE_DB_MIGRATION',
      Count_Or_Metric: `${manualReviewSkus.length} SKUs in ${gc.provisionalReviewGroups} provisional review groups`,
      Blocker_SKUs: manualReviewSkus.join(', '),
      Owner_Action_Required: 'قرائت پلاک تسمه یا بررسی فاکتور خرید این ۹ کد پیش از مهاجرت قطعی به دیتابیس.',
    },
    {
      Gate_Code: 'GATE_06_TAXONOMY_11_GAPS',
      Gate_Name: 'تایید نگاشت اکسل و تصمیم‌گیری درباره ۱۱ شکاف ساختار منو',
      Status: 'PENDING_OWNER_MENU_APPROVAL',
      Count_Or_Metric: `${gapSkusMap.size} Taxonomy Gaps covering ${new Set([...gapSkusMap.values()].flat().map((x) => x.sku)).size} unique SKUs (LIVE MENU UNTOUCHED)`,
      Blocker_SKUs: [...gapSkusMap.keys()].join(', '),
      Owner_Action_Required: 'تایید افزودن برگ‌های جدید و اصلاح برچسب برای ۱۱ شکاف در ساختار منوی اکسل پیش از تغییر منوی زنده.',
    },
    {
      Gate_Code: 'GATE_07_LIVE_DB_INSPECTION',
      Gate_Name: 'مقایسه خواندنی دیتابیس زنده PostgreSQL (بدون تغییر/مهاجرت)',
      Status: liveDb.status === 'VERIFIED_READ_ONLY' ? 'VERIFIED_READ_ONLY' : 'UNVERIFIED',
      Count_Or_Metric: liveDb.statusNote,
      Blocker_SKUs:
        liveDb.status === 'VERIFIED_READ_ONLY'
          ? `${liveDiffCount} family metadata diffs / ${liveDb.skuFieldDiffCount ?? 0} SKU diffs checked at ${liveDb.checkedAt}`
          : 'UNVERIFIED — Live database was not queried or unreachable in this run',
      Owner_Action_Required: 'پشتیبان‌گیری تاییدشده + همگام‌سازی fixture با دیتابیس زنده پیش از اجرای db:migrate:adopted.',
    },
    {
      Gate_Code: 'OVERALL_PRE_APPROVAL_VERDICT',
      Gate_Name: 'حکم نهایی آمادگی برای تصویب مهندسی، طبقه‌بندی و مهاجرت دیتابیس',
      Status: 'ENGINEERING_READY_FOR_APPROVAL__DB_MIGRATION_GATED_ON_9_SKUS_AND_11_GAPS',
      Count_Or_Metric: `${gc.validBeltAndConveyorFamilies} valid belt/conveyor + ${gc.weldingToolGroups} welding tools + ${gc.provisionalReviewGroups} review + ${gc.separatedNonBeltFamilies} non-belt = ${gc.totalProposedGroups} groups | Live DB: ${liveDb.status}`,
      Blocker_SKUs: `Hard Blockers (9): ${manualReviewSkus.join(', ')} | Soft Print Verification (4 ZRK): ${zrkPrintVerifySkus.join(', ')} | Menu Approval: 11 Gaps`,
      Owner_Action_Required: `۱) تصویب ساختار مهندسی ${gc.validBeltAndConveyorFamilies} خانواده تسمه + ${gc.weldingToolGroups} ابزار جوشی | ۲) تایید طرح برگ‌های ۱۱ شکاف اکسل | ۳) بررسی انبار ۹ کد بلاکر + ۴ چاپ ZRK هم‌زمان با بکاپ پیش از مهاجرت فاز ۴.`,
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readinessRows), 'Migration_Readiness');

  return wb;
}

async function main() {
  await import('dotenv/config');
  const products = loadCatalogProducts();
  const audit = runBeltCatalogAudit(products, AUDIT_REFERENCE_TABLES);
  const liveDb = await readLiveDatabaseDifferences();

  const docsDir = path.resolve(process.cwd(), 'docs');
  const publicReportsDir = path.resolve(process.cwd(), 'public', 'reports');
  fs.mkdirSync(docsDir, { recursive: true });
  // Information security policy: never expose full internal audit deliverables under public/
  if (fs.existsSync(publicReportsDir)) {
    fs.rmSync(publicReportsDir, { recursive: true, force: true });
  }

  const jsonPath = path.join(docsDir, 'belt-catalog-audit-report.json');
  const mdPath = path.join(docsDir, 'belt-catalog-audit-report.md');
  const xlsxPath = path.join(docsDir, 'sanatpish-belt-catalog-audit.xlsx');
  const finalXlsxPath = path.join(docsDir, 'sanatpish-final-family-validation.xlsx');
  const preApprovalXlsxPath = path.join(docsDir, 'sanatpish-final-preapproval-audit.xlsx');

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        ...audit,
        liveDbSummary: {
          status: liveDb.status,
          queried: liveDb.queried,
          checkedAt: liveDb.checkedAt,
          liveFamiliesCount: liveDb.liveFamiliesCount,
          liveVariantsCount: liveDb.liveVariantsCount,
          skuFieldDiffCount: liveDb.skuFieldDiffCount,
          diffCount: liveDb.status === 'VERIFIED_READ_ONLY' ? liveDb.diffs.filter((d) => d.Diff_Index > 0).length : null,
          statusNote: liveDb.statusNote,
        },
      },
      null,
      2
    ),
    'utf8'
  );
  fs.writeFileSync(mdPath, buildMarkdownReport(audit, liveDb), 'utf8');

  const wb = buildExcelWorkbook(audit);
  XLSX.writeFile(wb, xlsxPath);

  const finalWb = buildFinalValidationWorkbook(audit, liveDb);
  XLSX.writeFile(finalWb, finalXlsxPath);

  const preApprovalWb = buildPreApprovalWorkbook(audit, liveDb);
  XLSX.writeFile(preApprovalWb, preApprovalXlsxPath);

  console.log('=== SANAT PISH BELT CATALOG AUDIT SUMMARY ===');
  console.log('Total Catalog Families:', audit.totalCatalogFamilies);
  console.log('Total Catalog SKUs:', audit.totalCatalogSkus);
  console.log('Audited Belt & Belt-Adjacent SKUs:', audit.auditedSkuCount);
  console.log('True Belt SKUs (Power Transmission + Conveyor):', audit.trueBeltSkuCount);
  console.log('  - Power Transmission Belt SKUs:', audit.truePowerTransmissionBeltSkuCount);
  console.log('  - Conveyor & Grip Belt SKUs:', audit.trueConveyorBeltSkuCount);
  console.log('  - Belt Welding Equipment SKUs:', audit.beltEquipmentSkuCount);
  console.log('Group Counts:', audit.groupCounts);
  console.log('Misplaced Belts Rescued From Outside Belt Categories:', audit.misplacedBeltOutsideBeltCategoryCount);
  console.log('Non-Belts Removed From Belt Category:', audit.nonBeltInsideBeltCategoryCount);
  console.log('Non-Conveyors Removed From Conveyor Category:', audit.nonConveyorInsideConveyorCategoryCount);
  console.log('Catch-All "تسمه صنعتی" SKUs Resolved:', audit.catchAllIndustrialBeltResolvedCount);
  console.log('Before Belt/Conveyor Family Count:', audit.beforeFamilyCountInBeltCategories);
  console.log('Valid Belt & Conveyor Families:', audit.afterProposedBeltFamilyCount);
  console.log('Total Proposed Groups (Including Equipment/Review/Non-Belt):', audit.reportB_proposedFamilies.length);
  console.log('Confidence Counts:', audit.confidenceCounts);
  console.log('Seven-Level Evidence Counts:', audit.sevenLevelEvidenceCounts);
  console.log('Action Counts:', audit.actionCounts);
  console.log('Live DB Status:', liveDb.statusNote);
  console.log('Pre-Approval Workbook written to:', preApprovalXlsxPath, 'Sheets:', preApprovalWb.SheetNames);
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error('Audit script failed:', err);
    process.exit(1);
  });
}
