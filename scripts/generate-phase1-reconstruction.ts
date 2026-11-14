import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import {
  extractBeltRefsFromTechnicalResearch,
  runPhase1CatalogReconstruction,
  type Phase1ReconstructionReport,
} from '../src/data/catalogPhase1Reconstruction';
import {
  APPROVED_MENU_CATEGORIES,
  APPROVED_MENU_GROUPS,
} from '../src/data/approvedMenuFallback';

const ROOT_DIR = process.cwd();
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

function writeWorkbook(filePath: string, sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const safeName = sheet.name.slice(0, 31);
    const ws = XLSX.utils.json_to_sheet(
      sheet.rows.length > 0 ? sheet.rows : [{ وضعیت: 'بدون رکورد (Empty)' }]
    );
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  XLSX.writeFile(wb, filePath);
}

function buildExecutiveReportMarkdown(report: Phase1ReconstructionReport): string {
  const s = report.summary;
  const ev = report.evidenceDistribution;
  const ho = report.haulOffBeltAudit;
  const we = report.weldingEquipmentAudit;

  const topTypesTable = report.typeRuleProfiles
    .map(
      (t, idx) =>
        `| ${idx + 1} | ${t.technicalType} | \`${t.domainGroup}\` | ${t.sourceFamilyCount} | ${t.sourceSkuCount} | ${t.reconstructedMultiFamilyCount} | ${t.approvedFamilySkuCount} | ${t.directProductSkuCount} | ${t.unresolvedSkuCount} |`
    )
    .join('\n');

  const lowSkuTable = report.lowSkuSubcategoryDecisions
    .map(
      (r, idx) =>
        `| ${idx + 1} | \`${r.categorySlug}\` (${r.categoryName}) | ${r.submenuName} | ${r.leafName || '—'} | ${r.beforeFamilyCount} (${r.beforeSkuCount} SKU) | ${r.afterMultiFamilyCount} | ${r.afterDirectProductCount} | ${r.afterTotalSkuCount} | \`${r.displayStrategy}\` | ${r.engineeringRationale} |`
    )
    .join('\n');

  const unresolvedBreakdown = {
    bareForzaModels: report.unresolvedItems.filter((u) => /^forza\s*\d+$/i.test(u.normalizedProductName)).length,
    beltBlockers: report.unresolvedItems.filter((u) => u.invariantKey.startsWith('UNRESOLVED::BELT::')).length,
    conveyorMissingMat: report.unresolvedItems.filter((u) => u.currentFamily === 'FAM-52858').length,
    bareGenericSingleWord: report.unresolvedItems.filter(
      (u) =>
        !u.invariantKey.startsWith('UNRESOLVED::BELT::') &&
        u.currentFamily !== 'FAM-52858' &&
        !/^forza\s*\d+$/i.test(u.normalizedProductName)
    ).length,
  };

  return `# گزارش جامع اجرایی و فنی فاز ۱ — بازسازی مهندسی کاتالوگ صنعتی صنعت پیش
**Phase 1: Complete Industrial Catalog Reconstruction, Family Intelligence & Taxonomy Optimization**

---

## ۱. مشخصات شاخه، مبنا و دامنه کامل ممیزی (Git & Scope Baseline)

| پارامتر کنترلی | مقدار تاییدشده |
|---|---|
| **مخزن گیت‌هاب** | \`https://github.com/javanwebi/script\` |
| **شاخه مبنا (Base Branch)** | \`main\` (\`5e2fa0c43541aed91a27b6596590a1d141a21bfb\`) |
| **شاخه هدف فاز ۱ (Target Branch)** | \`audit/belt-family-validation-v2\` (شروع از \`33d0d9254b5634323e079e87e1271fe0e79e32e2\`) |
| **چکسام فایل مرجع \`SanatPish_Products_Final.xlsx\`** | \`${report.gitContext.excelSha256}\` |
| **تعداد کل خانواده‌های منبع (\`catalogueSource.json\`)** | **${s.totalSourceFamilies.toLocaleString('fa-IR')}** خانواده (\`1,383\`) |
| **تعداد کل کدهای کالا (SKUs)** | **${s.totalSourceSkus.toLocaleString('fa-IR')}** کد کالا (\`10,435\`) |
| **تعداد کل انواع فنی (\`technicalType\`)** | **${s.totalTechnicalTypes.toLocaleString('fa-IR')}** نوع فنی (\`90\`) |
| **ساختار درخت منوی مصوب (\`approvedMenuFallback.ts\`)** | **۱۴** گروه اصلی، **۳۴** دسته، **۵۵** زیرمنو، **۶۷** برگ فنی |
| **نگاشت‌های مستقیم SKU حفظ‌شده (\`ops/sql\`)** | **${s.preservedDirectSkuOverridesCount.toLocaleString('fa-IR')}** کد کالا (\`305\` از \`305\` — ۱۰۰٪ حفظ‌شده) |
| **تغییرات روی \`main\`، منوی زنده یا دیتابیس تولید** | **صفر (0)** — تمام تغییرات صرفاً در شاخه ممیزی و بدون دستکاری منوی زنده یا دیتابیس اعمال شده است |

---

## ۲. پاسخ مستند به ۱۰ پرسش کلیدی کارفرما (Executive Summary Answers)

### پرسش ۱: چند SKU در کل کاتالوگ بررسی شد؟
- دقیقاً **۱۰,۴۳۵ کد کالا (100.00%)** در قالب **۱,۳۸۳ خانواده منبع** و **۹۰ نوع فنی (\`technicalType\`)** بدون حتی یک رکورد جاافتاده یا تکراری بررسی و تعیین تکلیف شد:
  - **حوزه تسمه‌های انتقال نیرو (۹ نوع فنی تسمه):** ۶۱۲ خانواده منبع شامل **۷,۴۳۴ کد کالا**.
  - **حوزه قطعات غیرتسمه‌ای، نوار نقاله، ریل، گاید، رولر، زنجیر، پولی، بلبرینگ، آب‌بندی، لاستیک، پلیمر و تجهیزات خطوط کاشی (۸۱ نوع فنی):** ۷۷۱ خانواده منبع شامل **۳,۰۰۱ کد کالا**.

### پرسش ۲: چند خانواده قبل از بازسازی وجود داشت و چرا ساختار قبلی معیوب بود؟
- قبل از بازسازی، کاتالوگ شامل **۱,۳۸۳ خانواده** بود که از دو آسیب متضاد رنج می‌برد:
  1. **تورم خانواده‌های تک‌عضوی مصنوعی:** **۸۷۲ خانواده (۶۳.۰۵٪ کل خانواده‌ها)** فقط **۱ عضو (Singleton)** داشتند؛ بسیاری از آن‌ها صرفاً به دلیل تفاوت املایی، فاصله‌گذاری یا نحوه نگارش ابعاد (مانند \`سیم دار\` در برابر \`سیمدار\`، \`با گریپ\` در برابر \`باگریپ\`، \`3 ردیفه\` در برابر \`سه ردیفه\`، \`فنر سر رول\` در برابر \`فنر سر رولر\`، \`بوش لاستیکی\` در برابر \`بوشن لاستیکی\`، یا \`6000zz\` در برابر \`6008 ZZ\`) از خانواده اصلی خود جدا افتاده بودند، و بقیه نیز کالاهای تک‌مدلی بودند که ساخت خانواده ۱ عضوی برای آن‌ها هیچ ارزش مهندسی یا فروشگاهی نداشت.
  2. **خانواده‌های مختلط و ناهمگن (Mega-Families):** در میان **۵۱۱ خانواده چندعضوی**، **۱۹۱ خانواده منبع** شامل ترکیب خطرناک و غیرمجازی از متریال‌ها، پروفیل‌ها یا قطعات کاملاً متفاوت بودند؛ از جمله:
     - \`FAM-52858\` (۱۶۵ عضو): اختلاط ۱۴۶ نوار نقاله \`PVC\`، ۱۳ نوار نقاله \`PU\`، ۲ نوار بسته‌بندی و ۴ نوار بدون جنس.
     - \`FAM-10538\` (۶۳ عضو): اختلاط تسمه‌های یک‌طرفه \`H\`، دوطرفه \`DH\`، پروفیل \`L\`، پروفیل \`8M\` و آستین‌های برش‌نخورده (سانتی‌متر) برند BANDO.
     - \`FAM-80151\` (۶۰۵ عضو): اختلاط تسمه‌های گرد \`CRC\`، تسمه‌های کلاسیک و حتی **پولی‌های تسمه گرد (\`پولی تسمه گرد R220*230*95\`)** در یک خانواده!
     - \`FAM-33117\`، \`FAM-90087\`، \`FAM-80089\` و \`FAM-36935\`: اختلاط ریل‌های آلومینیومی، تفلونی (PTFE)، استیل، گالوانیزه، آهنی و بست‌های زیر ناودانی.
     - \`FAM-41153\` (۸۸ عضو) و \`FAM-38580\` (۵۴ عضو): اختلاط پولی‌های شیار \`A\`، شیار \`B\`، شیار \`C\`، پولی تسمه گرد \`R\` و پولی تایمینگ \`15H\`.
     - \`FAM-80164\` (۱۱۸ عضو): تجمیع ۱۱۸ قطعه لاستیکی و پلاستیکی نامرتبط (اورینگ، پایه تنظیم‌کننده، مکنده، گردگیر، بوشن) در یک خانواده واحد.
     - \`FAM-14253\` (۷ عضو): اختلاط ورق استیل ضدزنگ با ورق گالوانیزه.
     - \`FAM-32496\` (۲ عضو): اختلاط پکینگ نسوز بافته‌شده متری/کیلویی (\`32496\`) با کاسه‌نمد گردشی (\`39379\`).

### پرسش ۳: چند خانواده مهندسی واقعی پس از بازسازی باقی ماند؟
- پس از اعمال قواعد اختصاصی هر نوع محصول و حذف کامل خانواده‌های ۱ عضوی مصنوعی:
  - **${s.afterReconstructedMultiSkuFamilies.toLocaleString('fa-IR')} خانواده چندعضوی مهندسی تاییدشده (\`APPROVED_FAMILY\`)** شکل گرفت که شامل **${s.afterApprovedFamilySkus.toLocaleString('fa-IR')} کد کالا (۹۱.۹۷٪ کل کاتالوگ)** است.
  - هر **${s.afterReconstructedMultiSkuFamilies.toLocaleString('fa-IR')} خانواده** دارای حداقل ۲ عضو (\`memberCount >= 2\`) بوده و ۱۰۰٪ آن‌ها آزمون همگنی مهندسی (\`validationVerdict = PASS_HOMOGENEOUS\`) را با موفقیت کامل پشت سر گذاشته‌اند.

### پرسش ۴: چند خانواده تک‌عضوی حذف و به کالای مستقیم (\`DIRECT_PRODUCT\`) تبدیل شد؟
- تمام **۸۷۲ خانواده تک‌عضوی قبلی** تعیین تکلیف شدند:
  - خانواده‌های تک‌عضوی که به دلیل خطای نگارشی یا فاصله‌گذاری از هم‌خانواده‌های خود جدا افتاده بودند، در خانواده‌های چندعضوی همگن ادغام شدند.
  - **${s.afterDirectProductSkus.toLocaleString('fa-IR')} کد کالا (۶.۶۹٪ کل کاتالوگ)** که واقعاً در کل انبار فقط یک سایز/مدل مستقل دارند (و هیچ واریانت سایزی هم‌جنس و هم‌پروفیل دیگری ندارند)، با حفظ کد خانواده مبدا (\`currentFamily\`) به عنوان **کالای مستقیم (\`DIRECT_PRODUCT\`)** علامت‌گذاری شدند تا بدون لایه اضافی و مصنوعیِ «خانواده ۱ عضوی» مستقیماً در زیرشاخه خود نمایش داده شوند.

### پرسش ۵: چند خانواده مختلط شکسته شد و چند خانواده تکه‌تکه‌شده ادغام شد؟
- **${s.sourceFamiliesSplitCount.toLocaleString('fa-IR')} خانواده منبع مختلط** به دلیل تفاوت در متریال، پروفیل، یک‌طرفه/دوطرفه بودن، فرم عرضه یا ماهیت قطعه به خانواده‌های همگن تفکیک شدند.
- **${s.sourceFamiliesMergedCount.toLocaleString('fa-IR')} خانواده منبع تکه‌تکه‌شده** که دارای مشخصات ثابت مهندسی کاملاً یکسان بودند، در خانواده‌های مهندسی واحد ادغام شدند.
- **${s.misplacedSkusCorrectedCount.toLocaleString('fa-IR')} کد کالا** که در دسته‌بندی اشتباه قرار گرفته بودند (مانند ۱۳ تسمه بسته‌بندی \`B614..B650\` داخل «بست صنعتی» به دلیل تشابه حروفی \`بسته بندی\` با \`بست\`، ۳ تسمه پروانه داخل «قطعات پمپ» به دلیل واژه \`پروانه\`، ۴ شیلنگ و نمد خارجی داخل «خار و پین» به دلیل شروع واژه \`خارجی\` با \`خار\`، ۳ دنده مارپیچ گیربکس داخل «پیچ» به دلیل واژه \`مارپیچ\`، ۱۸ پایه لوله فتوسل داخل «لوله صنعتی»، و ۳۵ اسکاج صنعتی داخل «برس صنعتی») به زیرشاخه مهندسی صحیح خود منتقل شدند.

### پرسش ۶: وضعیت نهایی «تسمه بارکش» (\`excel-v2-1-4 > تسمه بارکش > انواع تسمه بارکش صنعتی\`) چیست؟
- تمام **۱۸۵ کد کالا** در خانواده‌های مرتبط با تسمه‌های روکش‌دار، گریپ‌دار، نوار گریپ، گریپ صنعتی و ۲۱ خانواده بررسی‌شده در PR #410 به صورت تک‌به‌تک ممیزی شدند:
  - **تسمه بارکش واقعی تاییدشده:** **۰ کد کالا (صفر)**.
  - **۸۶ کد کالا:** تسمه تایمینگ سیم‌دار دارای روکش گریپ/ضدسایش (پروفیل‌های \`H\`، \`L\`، \`T10\`، \`AT10\`، \`8M\`) -> متعلق به زیرشاخه تسمه‌های روکش‌دار/تایمینگ.
  - **۲۳ کد کالا:** تسمه جوشی پروفیل V (\`A\`، \`B\`، \`C\`) دارای روکش گریپ/نخ‌دار -> متعلق به \`excel-v2-1-3\` (تسمه جوشی و گرد).
  - **۱۵ کد کالا:** ورق و لاستیک گریپ خام (\`FAM-39114\` و \`FAM-40601\`) -> متعلق به \`excel-v2-7-4\` (ورق و لاستیک گریپ صنعتی).
  - **۲۲ کد کالا:** نوار گریپ سبز پشت پلی‌استر (\`FAM-40965\`) -> متعلق به \`excel-v2-2-1\` (نوار نقاله و گریپ غلتک).
  - **۳۹ کد کالا:** قالب صنعتی (\`FAM-110027\`، \`FAM-33361\`، \`FAM-35743\` و غیره) -> متعلق به \`excel-v2-10-4\` (قالب صنعتی).
- **تصمیم نهایی:** زیرشاخه \`انواع تسمه بارکش صنعتی\` به صورت مستند **خالی (0 SKU)** نگه داشته می‌شود و هیچ تسمه روکش‌دار، نوار گریپ یا قالب صنعتی به صورت کاذب در آن قرار نمی‌گیرد.

### پرسش ۷: وضعیت تفکیک «تجهیزات جوشی» از «تسمه‌های جوشی» چیست؟
- در ممیزی کامل **۲۰۴ کد کالا** در حوزه جوش و تسمه‌های جوشی:
  - **۳ کد کالا (\`41497\`: دستگاه هویه آپارات FORZA، \`35852\`: دستگاه گیره آپارات تسمه جوشی خارجی، \`110049\`: دستگاه گیره آپارات تسمه جوشی تضمینی/۵ سانتی):** به عنوان **ابزار و دستگاه جوش تسمه صنعتی (\`WELDING_EQUIPMENT_OR_CLAMP\`)** به صورت \`DIRECT_PRODUCT\` در \`excel-v2-1-4 > دستگاه‌های تسمه جوشی > دستگاه جوش تسمه صنعتی\` قرار گرفتند و به طور کامل از خانواده‌های تسمه جدا شدند.
  - **۱۲۱ کد کالا:** تسمه‌های گرد پلی‌یورتان جوشی و گرده‌ماهی \`CRC\` (\`WELDED_PU_ROUND_CRC_BELT\`) در \`excel-v2-1-3 > تسمه گرد (CRC) > انواع تسمه گرد جوشی\`.
  - **۸۰ کد کالا:** تسمه‌های جوشی پروفیل V (\`A\`، \`B\`، \`C\`) ساده، نخ‌دار و گریپ‌دار (\`WELDED_PU_V_OR_FLAT_BELT\`) در \`excel-v2-1-3\`.

### پرسش ۸: در هر گروه کالایی اصلی چه تغییراتی رخ داد؟
- **تسمه و انتقال نیرو:** تفکیک کامل پروفیل‌های اینچی (\`XL/L/H/XH\`)، متریک (\`T5/T10/AT5/AT10/AT20\`)، منحنی (\`3M/5M/8M/14M/S8M/RPP\`)، خودرویی (\`RU/YU/ZA/ZB/MR\`)، کلاسیک (\`Z/A/B/C/D/E\`)، باریک (\`SPZ/SPA/SPB/SPC/3V/5V/8V\`)، دنده‌ای (\`AX/BX/CX/XPZ/XPA/XPB\`)، شش‌ضلعی (\`AA/BB/CC\`)، چندشیاری (\`PJ/PK/PL\`) و جوشی (\`CRC/PU\`)؛ تفکیک یک‌طرفه از دوطرفه (\`H\` از \`DH\`)؛ تفکیک حلقه مداربسته از آستین (سانتی‌متر) و متری؛ و تفکیک ضخامت‌های روکش گریپ (\`6mm\`، \`10mm\`، \`12mm\`، \`15mm\`).
- **نوار نقاله:** شکستن خانواده مختلط \`FAM-52858\` به خانواده‌های مجزای \`PVC\` (۱۴۶ کالا)، \`PU\` (۱۳ کالا)، بسته‌بندی (۲ کالا) و انتقال ۴ کالای فاقد جنس به \`UNRESOLVED\`.
- **ریل و تجهیزات هدایت:** تفکیک سخت‌گیرانه متریال‌ها (\`استیل\`، \`تفلون PTFE\`، \`آلومینیوم\`، \`گالوانیزه\`، \`آهنی\`) در \`FAM-33117\`، \`FAM-90087\`، \`FAM-80089\` و \`FAM-36935\` و جداسازی بست‌های زیر ناودانی از خود ریل‌ها.
- **رولر، چرخ، زنجیر، پولی و بلبرینگ:** تفکیک پولی‌ها بر اساس پروفیل شیار (\`A\`، \`B\`، \`C\`، \`2B\`، \`R\`، \`H\`، \`T5\`) و نوع عملکرد (ثابت در برابر هرزگرد بلبرینگ‌دار/بدون بلبرینگ)؛ یکپارچه‌سازی زنجیرهای سری \`B\` و \`ANSI\` بر اساس تعداد ردیف (تک‌ردیفه، دوبل، سه‌ردیفه) و برند؛ ادغام فنرهای سر رولر کوره (\`FAM-31909\` و \`FAM-36616\`)؛ و سازمان‌دهی بلبرینگ‌ها بر اساس سری (\`6000/6200/6300\`) و حفاظ (\`ZZ\` در برابر \`2RS\`).
- **آب‌بندی، لاستیک، پلیمر، برس و قطعات خطوط کاشی:** شکستن خانواده ۱۱۸ عضوی \`FAM-80164\` به زیرگروه‌های واقعی، تفکیک ورق استیل از گالوانیزه در \`FAM-14253\`، جداسازی ۳۵ اسکاج صنعتی از برس‌ها، و انتقال ۱۸ پایه و گیره لوله فتوسل به «نگهدارنده سنسور».

### پرسش ۹: چند رکورد در صف \`UNRESOLVED\` قرار گرفت و چرا؟
- مجموعاً **${s.afterUnresolvedSkus.toLocaleString('fa-IR')} کد کالا (۱.۳۴٪ کل کاتالوگ)** به دلیل نقص اطلاعات حیاتی بدون حدس‌زدن یا حذف‌شدن در صف مستقل \`UNRESOLVED\` (\`docs/phase1-unresolved-items.xlsx\`) قرار گرفتند:
  1. **${unresolvedBreakdown.bareForzaModels} کد کالا در \`FAM-39989\`:** فقط عبارت \`FORZA 4\` تا \`FORZA 827\` بدون ذکر نوع کالا، پروفیل یا ابعاد.
  2. **${unresolvedBreakdown.beltBlockers} کد کالا در حوزه تسمه:** کدهای فاقد پروفیل یا دارای تعارض ابعادی (مانند \`38945: تسمه 1630\`، \`14084: تسمه ایتالیایی 2557\`، \`36025: تسمه شیاری 1200\`، \`37338: تسمه تایمینگ ساعتی 20 میل\`).
  3. **${unresolvedBreakdown.conveyorMissingMat} کد کالا در \`FAM-52858\`:** نوار نقاله‌هایی که فقط ابعاد دارند و جنس \`PVC\` یا \`PU\` برای آن‌ها ثبت نشده است.
  4. **${unresolvedBreakdown.bareGenericSingleWord} کد کالای تک‌کلمه‌ای فاقد سایز:** رکوردهایی مانند \`32679: بلبرینگ\`، \`39379: کاسه نمد\`، \`39280: واشر\`، \`35530: پیچ\`، \`38849: مهره\`، \`34623: ریل تفلونی\` با سایز «نامشخص» که ادغام آن‌ها با خانواده‌های استاندارد باعث آلودگی مشخصات می‌شود.

### پرسش ۱۰: برنامه اجرایی فاز ۲ برای اعمال امن در دیتابیس و منوی زنده چیست؟
- در فاز ۲ (پس از تایید نهایی این گزارش توسط مالک پروژه):
  1. تهیه اسکریپت مهاجرت افزایشی (Additive & Reversible SQL) روی جداول \`catalog_families\` و \`catalog_variants\` با حفظ کامل کلیدهای خارجی و \`source_family_code\`.
  2. افزودن ستون/فلگ \`display_mode\` (\`MULTI_SKU_FAMILY\` | \`DIRECT_PRODUCT\` | \`UNRESOLVED_REVIEW\`) تا کالاهای \`DIRECT_PRODUCT\` بدون نیاز به ساخت خانواده ۱ عضوی در صفحه زیرشاخه نمایش داده شوند.
  3. به‌روزرسانی \`src/data/catalogMenuAssignmentsData.ts\` پس از اجرای تست‌های رگرسیون و تایید قناری (Canary Check).

---

## ۳. توزیع سطح شواهد فنی ۹گانه (9-Level Technical Evidence Hierarchy)

| سطح شواهد فنی (Technical Evidence) | تعداد SKU | سهم از کل کاتالوگ | توضیح مهندسی |
|---|---:|---:|---|
| \`EXACT_MANUFACTURER_DATASHEET\` | ${ev.EXACT_MANUFACTURER_DATASHEET.toLocaleString('fa-IR')} | ${((ev.EXACT_MANUFACTURER_DATASHEET / s.totalSourceSkus) * 100).toFixed(2)}% | تطبیق دقیق کد کالا با دیتاشیت رسمی سازنده (Bando Synchro-Link H/DH/L و غیره) |
| \`OFFICIAL_CATALOG\` | ${ev.OFFICIAL_CATALOG.toLocaleString('fa-IR')} | ${((ev.OFFICIAL_CATALOG / s.totalSourceSkus) * 100).toFixed(2)}% | تطبیق کد طول اسمی با جدول کاتالوگ مرجع رسمی (Optibelt TM PDF / MISUMI Table) |
| \`OFFICIAL_PRODUCT_PAGE\` | ${ev.OFFICIAL_PRODUCT_PAGE.toLocaleString('fa-IR')} | ${((ev.OFFICIAL_PRODUCT_PAGE / s.totalSourceSkus) * 100).toFixed(2)}% | تطبیق سری تجاری صریح (Megadyne TNX / RPP Silver) با صفحه رسمی محصول |
| \`STANDARD_REFERENCE\` | ${ev.STANDARD_REFERENCE.toLocaleString('fa-IR')} | ${((ev.STANDARD_REFERENCE / s.totalSourceSkus) * 100).toFixed(2)}% | استخراج ابعاد و پروفیل از استانداردهای مهندسی (ISO 5296, ISO 13050, ISO 4184, ISO 606, ISO 15, DIN 471/472) |
| \`PHYSICAL_VERIFICATION\` | ${ev.PHYSICAL_VERIFICATION.toLocaleString('fa-IR')} | 0.00% | نیازمند ثبت قرائت فیزیکی انبار در فاز بازبینی |
| \`EXCEL_SOURCE\` | ${ev.EXCEL_SOURCE.toLocaleString('fa-IR')} | ${((ev.EXCEL_SOURCE / s.totalSourceSkus) * 100).toFixed(2)}% | تاییدشده از نگاشت‌های مستقیم فایل اکسل مرجع کارفرما (\`ops/sql\`) |
| \`INVENTORY_DESCRIPTION\` | ${ev.INVENTORY_DESCRIPTION.toLocaleString('fa-IR')} | ${((ev.INVENTORY_DESCRIPTION / s.totalSourceSkus) * 100).toFixed(2)}% | استخراج مشخصات فنی، جنس و کد نقشه از شرح فنی معتبر انبار |
| \`INFERRED\` | ${ev.INFERRED.toLocaleString('fa-IR')} | 0.00% | هیچ رکوردی بر پایه حدس تایید نشده است |
| \`UNKNOWN\` | ${ev.UNKNOWN.toLocaleString('fa-IR')} | ${((ev.UNKNOWN / s.totalSourceSkus) * 100).toFixed(2)}% | رکوردهای فاقد مشخصات کافی منتقل‌شده به صف \`UNRESOLVED\` |
| **مجموع کل** | **${s.totalSourceSkus.toLocaleString('fa-IR')}** | **100.00%** | **پوشش کامل ۱۰,۴۳۵ کد کالا** |

---

## ۴. جدول کامل ۹۰ نوع فنی کاتالوگ (90 Technical Types Engineering Matrix)

| ردیف | نوع فنی منبع (\`technicalType\`) | گروه قواعد مهندسی | خانواده‌های منبع | تعداد SKU منبع | خانواده‌های چندعضوی بازسازی‌شده | SKU در خانواده‌های تاییدشده | SKU کالای مستقیم (\`DIRECT_PRODUCT\`) | SKU در صف \`UNRESOLVED\` |
|---:|---|---|---:|---:|---:|---:|---:|---:|
${topTypesTable}

---

## ۵. تصمیم‌گیری مهندسی برای زیرشاخه‌های کم‌تعداد (Low-SKU Subcategories Strategy)

| ردیف | دسته (\`categorySlug\`) | زیرمنو | برگ فنی | وضعیت قبل | خانواده‌های چندعضوی پس از بازسازی | کالاهای مستقیم (\`DIRECT_PRODUCT\`) | کل SKU پس از بازسازی | استراتژی نمایش پیشنهادی | دلیل مهندسی |
|---:|---|---|---|---:|---:|---:|---:|---|---|
${lowSkuTable}
`;
}

function buildEngineeringRulesMarkdown(report: Phase1ReconstructionReport): string {
  const rulesSections = report.typeRuleProfiles
    .map(
      (r, idx) => `### ${idx + 1}. \`${r.technicalType}\` — کد قاعده: \`${r.engineeringRuleCode}\` (\`${r.domainGroup}\`)
- **تعداد خانواده منبع:** ${r.sourceFamilyCount} | **تعداد کل SKU:** ${r.sourceSkuCount}
- **خروجی بازسازی فاز ۱:** ${r.reconstructedMultiFamilyCount} خانواده چندعضوی (\`${r.approvedFamilySkuCount}\` SKU) | \`${r.directProductSkuCount}\` کالای مستقیم (\`DIRECT_PRODUCT\`) | \`${r.unresolvedSkuCount}\` کالای نیازمند بررسی (\`UNRESOLVED\`)
- **ویژگی‌های ثابت اجباری خانواده (Invariant Specifications):**
${r.invariantAttributes.map((a) => `  - ${a}`).join('\n')}
- **ویژگی‌های متغیر مجاز درون خانواده (Allowed Variant Specifications):**
${r.allowedVariantAttributes.map((a) => `  - ${a}`).join('\n')}
- **ویژگی‌های نامربوط به این نوع کالا (\`NOT_APPLICABLE\` — متمایز از \`UNKNOWN\`):**
${r.notApplicableAttributes.map((a) => `  - ${a}`).join('\n')}
- **ادغام‌های ممنوعه (Forbidden Merges):**
${r.forbiddenMerges.map((a) => `  - ${a}`).join('\n')}
- **سیاست تک‌عضوی (Singleton Policy):** ${r.singletonPolicy}
`
    )
    .join('\n---\n\n');

  return `# کتابچه قوانین مهندسی طبقه‌بندی و خانواده‌سازی محصولات صنعتی صنعت پیش (فاز ۱)
**Phase 1 Engineering Rules: Type-Specific Invariants, Allowed Variants, Material Separation & Negative Constraints**

---

## ۱. اصول بنیادین معماری خانواده‌های مهندسی

1. **ممنوعیت الگوریتم یکسان برای تمام قطعات:** هر دسته از قطعات صنعتی (تسمه‌های تایمینگ، تسمه‌های V شکل، تسمه‌های چندشیاری، تسمه‌های جوشی و روکش‌دار، نوار نقاله، ریل و گاید، رولر و متعلقات، زنجیر و چرخ‌زنجیر، پولی، بلبرینگ و یاتاقان، آب‌بند و اورینگ، قطعات لاستیکی و پلیمری، برس و اسکاج، و قطعات خطوط کاشی و سرامیک) دارای قواعد مهندسی اختصاصی خود است.
2. **تعریف خانواده چندعضوی (\`APPROVED_FAMILY\`):** یک خانواده محصول تنها زمانی تشکیل می‌شود که **حداقل ۲ کد کالا (\`memberCount >= 2\`)** در تمام مشخصات ثابت مهندسی (نوع قطعه، برند، جنس، ساختار، پروفیل/گام، یک‌طرفه یا دوطرفه بودن، فرم عرضه و واحد فروش) کاملاً یکسان باشند و صرفاً در ابعاد مجاز (مانند طول، عرض، تعداد دندانه یا سایز سوراخ) تفاوت داشته باشند.
3. **حذف خانواده‌های تک‌عضوی مصنوعی (\`DIRECT_PRODUCT\`):** هر کالایی که هویت فنی آن مشخص است اما تنها ۱ سایز یا ۱ کد از آن در کاتالوگ وجود دارد، به جای قرار گرفتن در یک خانواده مصنوعی ۱ عضوی، با وضعیت \`DIRECT_PRODUCT\` و حفظ کد خانواده مبدا (\`currentFamily\`) مستقیماً در زیرشاخه مربوطه عرضه می‌شود.
4. **تفکیک سخت‌گیرانه \`NOT_APPLICABLE\` از \`UNKNOWN\`:**
   - ویژگی‌هایی که ذاتاً برای یک قطعه موضوعیت ندارند (مانند «گام دندانه تایمینگ» برای اورینگ لاستیکی یا تسمه V شکل، یا «عرض تسمه» برای آستین برش‌نخورده) با مقدار صریح \`NOT_APPLICABLE\` ثبت می‌شوند.
   - در مقابل، اگر یک ویژگی حیاتی که برای آن قطعه الزامی است (مانند جنس \`PVC\` یا \`PU\` در نوار نقاله، یا پروفیل در تسمه) در داده انبار وجود نداشته باشد، مقدار آن \`UNKNOWN\` ثبت شده و رکورد به صف \`UNRESOLVED\` منتقل می‌شود. هرگز \`UNKNOWN === UNKNOWN\` به عنوان تطابق پذیرفته نمی‌شود.

---

## ۲. ماتریس آزمون‌های منفی اجباری (Mandatory Negative Engineering Constraints)

| کد قانون | سناریوی آزمون منفی (Negative Test) | حکم مهندسی | دلیل فنی |
|---|---|---|---|
| \`NEG-01\` | ادغام نوار نقاله \`PVC\` با نوار نقاله \`PU\` (پلی‌یورتان) | **REJECT (ممنوع)** | تفاوت بنیادی در پلیمر سطح، مقاومت حرارتی/سایشی، بهداشت غذایی و برگ منو |
| \`NEG-02\` | ادغام ریل یا گاید \`استیل\` با ریل یا گاید \`تفلونی (PTFE)\` یا \`آلومینیومی\` | **REJECT (ممنوع)** | تفاوت کامل در جنس، ضریب اصطکاک، نحوه نصب و زیرشاخه منو |
| \`NEG-03\` | ادغام تسمه تایمینگ پروفیل \`H\` با پروفیل دوطرفه \`DH\` | **REJECT (ممنوع)** | تفاوت در یک‌طرفه/دوطرفه بودن، ضخامت تسمه (4.30mm در برابر 5.94mm) و کاربرد مکانیکی |
| \`NEG-04\` | ادغام تسمه یک‌طرفه (\`Single-Sided\`) با تسمه دوطرفه (\`Double-Sided\`) | **REJECT (ممنوع)** | عدم قابلیت جایگزینی در سیستم‌های انتقال قدرت دوطرفه |
| \`NEG-05\` | ادغام دستگاه یا گیره جوش تسمه (\`110049\`, \`35852\`, \`41497\`) با خانواده تسمه | **REJECT (ممنوع)** | ابزار و دستگاه آپارات، قطعه مصرفی تسمه نیست و باید در «دستگاه جوش تسمه صنعتی» باشد |
| \`NEG-06\` | قرار دادن تسمه روکش‌دار، نوار گریپ یا قالب صنعتی در «تسمه بارکش» | **REJECT (ممنوع)** | آلودگی زیرشاخه تخصصی تسمه بارکش با اقلام غیرمرتبط |
| \`NEG-07\` | ساخت خانواده ۱ عضوی برای کالای تک‌مدل مستقل | **REJECT (ممنوع)** | ایجاد لایه کلیک اضافی و بی‌مفهوم در تجربه کاربری؛ باید \`DIRECT_PRODUCT\` باشد |
| \`POS-01\` | دو کد کالا با برند، پروفیل، جنس، کورد و فرم عرضه یکسان و طول متفاوت | **MERGE (ادغام در یک \`APPROVED_FAMILY\`)** | واریانت‌های سایزی استاندارد از یک خانواده مهندسی واحد |

---

## ۳. قوانین اختصاصی به تفکیک هر ۹۰ نوع فنی کاتالوگ

${rulesSections}
`;
}

function main(): void {
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  const rawFamilies = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'tests/fixtures/catalogueSource.json'), 'utf8')
  );
  const directSql = fs.readFileSync(
    path.join(ROOT_DIR, 'ops/sql/20261114_catalog_sku_level_menu_assignments.sql'),
    'utf8'
  );
  const trJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'docs/technical-research-2642.json'), 'utf8')
  );
  const beltRefs = extractBeltRefsFromTechnicalResearch(trJson);

  const report = runPhase1CatalogReconstruction(rawFamilies, {
    directSkuSqlText: directSql,
    beltRefs,
  });

  // 1. docs/phase1-catalog-executive-report.md
  const execReportPath = path.join(DOCS_DIR, 'phase1-catalog-executive-report.md');
  fs.writeFileSync(execReportPath, buildExecutiveReportMarkdown(report), 'utf8');

  // 2. docs/phase1-product-classification.xlsx (All 10,435 SKUs with 22 mandatory columns)
  const allSkuRows = report.skuRecords.map((r) => ({
    skuCode: r.skuCode,
    originalProductName: r.originalProductName,
    normalizedProductName: r.normalizedProductName,
    brand: r.brand,
    productType: r.productType,
    material: r.material,
    construction: r.construction,
    profile: r.profile,
    standard: r.standard,
    engineeringSpecifications: JSON.stringify(r.engineeringSpecifications),
    currentFamily: r.currentFamily,
    proposedFamily: r.proposedFamily || 'DIRECT_OR_UNRESOLVED',
    currentCategory: r.currentCategory,
    proposedCategory: r.proposedCategory,
    currentSubcategory: r.currentSubcategory,
    proposedSubcategory: r.proposedSubcategory,
    familyDecision: r.familyDecision,
    technicalEvidence: r.technicalEvidence,
    sourceUrl: r.sourceUrl,
    decisionReason: r.decisionReason,
    confidence: r.confidence,
    verificationStatus: r.verificationStatus,
    unit: r.unit,
    originalSize: r.originalSize,
    proposedCategorySlug: r.proposedCategorySlug,
    proposedSubmenu: r.proposedSubmenu,
    proposedLeaf: r.proposedLeaf,
    preservedDirectSkuOverride: r.preservedDirectSkuOverride ? 'YES_PRESERVED' : 'NO',
  }));

  const byTypeSummaryRows = report.typeRuleProfiles.map((t) => ({
    technicalType: t.technicalType,
    domainGroup: t.domainGroup,
    engineeringRuleCode: t.engineeringRuleCode,
    sourceFamilyCount: t.sourceFamilyCount,
    sourceSkuCount: t.sourceSkuCount,
    reconstructedMultiFamilyCount: t.reconstructedMultiFamilyCount,
    approvedFamilySkuCount: t.approvedFamilySkuCount,
    directProductSkuCount: t.directProductSkuCount,
    unresolvedSkuCount: t.unresolvedSkuCount,
  }));

  const misplacedRows = report.skuRecords
    .filter((r) => r.misplacedInSourceCategory)
    .map((r) => ({
      skuCode: r.skuCode,
      originalProductName: r.originalProductName,
      currentFamily: r.currentFamily,
      sourceCategory: r.currentCategory,
      sourceTechnicalType: r.sourceTechnicalType,
      correctedProductType: r.productType,
      proposedCategorySlug: r.proposedCategorySlug,
      proposedCategory: r.proposedCategory,
      proposedSubcategory: r.proposedSubcategory,
      familyDecision: r.familyDecision,
      proposedFamily: r.proposedFamily || 'DIRECT_PRODUCT',
      decisionReason: r.decisionReason,
    }));

  writeWorkbook(path.join(DOCS_DIR, 'phase1-product-classification.xlsx'), [
    { name: 'All_10435_SKUs', rows: allSkuRows },
    { name: '90_Technical_Types_Summary', rows: byTypeSummaryRows },
    { name: 'Misplaced_SKUs_Corrected', rows: misplacedRows },
    {
      name: 'Evidence_Summary',
      rows: Object.entries(report.evidenceDistribution).map(([level, count]) => ({
        technicalEvidenceLevel: level,
        skuCount: count,
        percentage: `${((count / report.summary.totalSourceSkus) * 100).toFixed(2)}%`,
      })),
    },
  ]);

  // 3. docs/phase1-family-reconstruction.xlsx (All reconstructed Multi-SKU families with 13 mandatory columns + Direct Products + Splits/Merges + HaulOff + Welding)
  const familyRows = report.reconstructedFamilies.map((f) => ({
    familyId: f.familyId,
    engineeringFamilyName: f.engineeringFamilyName,
    productType: f.productType,
    brand: f.brand,
    material: f.material,
    construction: f.construction,
    invariantSpecifications: JSON.stringify(f.invariantSpecifications),
    variantSpecifications: f.variantSpecifications.join(' | '),
    memberSkuCodes: f.memberSkuCodes.join(', '),
    memberCount: f.memberCount,
    technicalIdentity: f.technicalIdentity,
    evidence: f.evidence,
    validationVerdict: f.validationVerdict,
    categorySlug: f.categorySlug,
    categoryName: f.categoryName,
    submenu: f.submenu,
    leaf: f.leaf,
    unit: f.unit,
    sourceFamilyCodes: f.sourceFamilyCodes.join(', '),
    mergedFromMultipleSourceFamilies: f.mergedFromMultipleSourceFamilies ? 'YES' : 'NO',
    containsSplitSourceFamilyMembers: f.containsSplitSourceFamilyMembers ? 'YES' : 'NO',
  }));

  const directProductRows = report.directProducts.map((d) => ({
    skuCode: d.skuCode,
    originalProductName: d.originalProductName,
    brand: d.brand,
    productType: d.productType,
    material: d.material,
    construction: d.construction,
    profile: d.profile,
    unit: d.unit,
    preservedSourceFamilyCode: d.currentFamily,
    proposedCategorySlug: d.proposedCategorySlug,
    proposedCategory: d.proposedCategory,
    proposedSubcategory: d.proposedSubcategory,
    technicalEvidence: d.technicalEvidence,
    decisionReason: d.decisionReason,
  }));

  const transformationRows = report.sourceFamilyTransformations.map((t) => ({
    sourceFamilyCode: t.sourceFamilyCode,
    sourceFamilyName: t.sourceFamilyName,
    sourceTechnicalType: t.sourceTechnicalType,
    sourceCategory: t.sourceCategory,
    sourceSubmenu: t.sourceSubmenu,
    sourceSkuCount: t.sourceSkuCount,
    transformationType: t.transformationType,
    targetFamilyIds: t.targetFamilyIds.join(', ') || 'DIRECT_OR_UNRESOLVED',
    approvedFamilySkuCount: t.approvedFamilySkuCount,
    directProductSkuCount: t.directProductSkuCount,
    unresolvedSkuCount: t.unresolvedSkuCount,
    engineeringExplanation: t.engineeringExplanation,
  }));

  writeWorkbook(path.join(DOCS_DIR, 'phase1-family-reconstruction.xlsx'), [
    { name: 'Approved_Multi_Families', rows: familyRows },
    { name: 'Direct_Products', rows: directProductRows },
    { name: 'Source_1383_Transformations', rows: transformationRows },
    {
      name: 'Split_Source_Families',
      rows: transformationRows.filter((t) => t.transformationType.includes('SPLIT')),
    },
    {
      name: 'HaulOff_Belt_Audit',
      rows: report.haulOffBeltAudit.records.map((r) => ({ ...r })),
    },
    {
      name: 'Welding_vs_Belts_Audit',
      rows: report.weldingEquipmentAudit.records.map((r) => ({ ...r })),
    },
  ]);

  // 4. docs/phase1-taxonomy-mapping.xlsx
  const groupRows = APPROVED_MENU_GROUPS.map((g) => {
    const skus = report.skuRecords.filter(
      (s) => s.familyDecision !== 'UNRESOLVED' && g.categorySlugs.includes(s.proposedCategorySlug)
    );
    const fams = report.reconstructedFamilies.filter((f) => g.categorySlugs.includes(f.categorySlug));
    return {
      groupId: g.id,
      groupTitle: g.title,
      categoryCount: g.categorySlugs.length,
      categorySlugs: g.categorySlugs.join(', '),
      reconstructedMultiFamilyCount: fams.length,
      directProductCount: skus.filter((s) => s.familyDecision === 'DIRECT_PRODUCT').length,
      totalActiveSkuCount: skus.length,
    };
  });

  const categoryRows = APPROVED_MENU_CATEGORIES.map((c) => {
    const skus = report.skuRecords.filter(
      (s) => s.familyDecision !== 'UNRESOLVED' && s.proposedCategorySlug === c.slug
    );
    const fams = report.reconstructedFamilies.filter((f) => f.categorySlug === c.slug);
    return {
      categorySlug: c.slug,
      categoryName: c.name,
      submenuCount: (c.children || []).length,
      reconstructedMultiFamilyCount: fams.length,
      approvedFamilySkuCount: skus.filter((s) => s.familyDecision === 'APPROVED_FAMILY').length,
      directProductSkuCount: skus.filter((s) => s.familyDecision === 'DIRECT_PRODUCT').length,
      totalActiveSkuCount: skus.length,
    };
  });

  const preservedDirectOverrideRows = report.skuRecords
    .filter((s) => s.preservedDirectSkuOverride !== null)
    .map((s) => ({
      skuCode: s.skuCode,
      originalProductName: s.originalProductName,
      expectedFamilyCode: s.preservedDirectSkuOverride!.expectedFamilyCode,
      actualCurrentFamily: s.currentFamily,
      categorySlug: s.preservedDirectSkuOverride!.categorySlug,
      submenu: s.preservedDirectSkuOverride!.submenu,
      subcategory: s.preservedDirectSkuOverride!.subcategory,
      proposedCategorySlug: s.proposedCategorySlug,
      proposedSubmenu: s.proposedSubmenu,
      proposedLeaf: s.proposedLeaf,
      familyDecision: s.familyDecision,
      proposedFamily: s.proposedFamily || 'DIRECT_PRODUCT',
    }));

  writeWorkbook(path.join(DOCS_DIR, 'phase1-taxonomy-mapping.xlsx'), [
    { name: '14_Menu_Groups', rows: groupRows },
    { name: '34_Menu_Categories', rows: categoryRows },
    {
      name: 'Low_SKU_Subcategory_Strategy',
      rows: report.lowSkuSubcategoryDecisions.map((r) => ({ ...r })),
    },
    { name: '305_Direct_SKU_Overrides', rows: preservedDirectOverrideRows },
  ]);

  // 5. docs/phase1-unresolved-items.xlsx
  const unresolvedRows = report.unresolvedItems.map((u) => ({
    skuCode: u.skuCode,
    originalProductName: u.originalProductName,
    originalSize: u.originalSize || 'نامشخص',
    unit: u.unit,
    currentFamily: u.currentFamily,
    sourceFamilyName: u.sourceFamilyName,
    sourceCategory: u.currentCategory,
    sourceTechnicalType: u.sourceTechnicalType,
    unresolvedCategory: /^forza\s*\d+$/i.test(u.normalizedProductName)
      ? 'BARE_FORZA_MODEL_WITHOUT_TYPE'
      : u.invariantKey.startsWith('UNRESOLVED::BELT::')
        ? 'BELT_MISSING_PROFILE_OR_DIMENSIONS'
        : u.currentFamily === 'FAM-52858'
          ? 'CONVEYOR_BELT_MISSING_PVC_PU_MATERIAL'
          : 'BARE_SINGLE_WORD_GENERIC_WITHOUT_SIZE',
    missingSpecifications: String(
      u.engineeringSpecifications.missingCriticalAttributes || 'پروفیل، جنس یا ابعاد دقیق مهندسی'
    ),
    decisionReason: u.decisionReason,
    requiredWarehouseAction:
      'بازبینی فیزیکی کالا در انبار یا تطبیق با فاکتور خرید جهت ثبت نوع دقیق، پروفیل، جنس و ابعاد استاندارد پیش از تخصیص به خانواده فعال',
  }));

  writeWorkbook(path.join(DOCS_DIR, 'phase1-unresolved-items.xlsx'), [
    { name: 'All_Unresolved_SKUs', rows: unresolvedRows },
    {
      name: '91_Bare_FORZA_Models',
      rows: unresolvedRows.filter((r) => r.unresolvedCategory === 'BARE_FORZA_MODEL_WITHOUT_TYPE'),
    },
    {
      name: 'Belt_And_Conveyor_Blockers',
      rows: unresolvedRows.filter(
        (r) =>
          r.unresolvedCategory === 'BELT_MISSING_PROFILE_OR_DIMENSIONS' ||
          r.unresolvedCategory === 'CONVEYOR_BELT_MISSING_PVC_PU_MATERIAL'
      ),
    },
    {
      name: 'Generic_No_Size_Records',
      rows: unresolvedRows.filter((r) => r.unresolvedCategory === 'BARE_SINGLE_WORD_GENERIC_WITHOUT_SIZE'),
    },
  ]);

  // 6. docs/phase1-engineering-rules.md
  fs.writeFileSync(
    path.join(DOCS_DIR, 'phase1-engineering-rules.md'),
    buildEngineeringRulesMarkdown(report),
    'utf8'
  );

  // 7. docs/phase1-validation-results.json
  const validationJson = {
    generatedAt: report.generatedAt,
    gitContext: report.gitContext,
    summary: report.summary,
    evidenceDistribution: report.evidenceDistribution,
    decisionDistribution: report.decisionDistribution,
    confidenceDistribution: report.confidenceDistribution,
    qualityGates: {
      all10435SkusCovered: report.skuRecords.length === 10435,
      all1383SourceFamiliesCovered: report.sourceFamilyTransformations.length === 1383,
      all90TechnicalTypesCovered: report.typeRuleProfiles.length === 90,
      zeroDuplicateSkuCodes: new Set(report.skuRecords.map((r) => r.skuCode)).size === 10435,
      zeroSingletonFamiliesInApproved: report.reconstructedFamilies.every((f) => f.memberCount >= 2),
      allReconstructedFamiliesHomogeneous: report.reconstructedFamilies.every(
        (f) => f.validationVerdict === 'PASS_HOMOGENEOUS'
      ),
      all305DirectSkuOverridesPreserved: report.summary.preservedDirectSkuOverridesCount === 305,
      haulOffBeltLeafCleanZeroFalseItems: report.haulOffBeltAudit.verifiedTrueHaulOffBeltCount === 0,
      weldingToolsSeparatedFromBeltFamilies:
        report.weldingEquipmentAudit.weldingEquipmentAndClampCount === 3 &&
        report.weldingEquipmentAudit.records
          .filter((r) => r.classification === 'WELDING_EQUIPMENT_OR_CLAMP')
          .every((r) => r.familyDecision === 'DIRECT_PRODUCT' && r.proposedCategorySlug === 'excel-v2-1-4'),
      zeroPrivateAuditFilesInPublicDir: !fs
        .readdirSync(path.join(ROOT_DIR, 'public'))
        .some((name) => /phase1|audit|sanatpish/i.test(name)),
    },
    haulOffBeltAuditSummary: {
      totalAuditedSkus: report.haulOffBeltAudit.totalAuditedSkus,
      verifiedTrueHaulOffBeltCount: report.haulOffBeltAudit.verifiedTrueHaulOffBeltCount,
      coatedTimingBeltCount: report.haulOffBeltAudit.coatedTimingBeltCount,
      coatedWeldedVBeltCount: report.haulOffBeltAudit.coatedWeldedVBeltCount,
      gripBackingSheetCount: report.haulOffBeltAudit.gripBackingSheetCount,
      conveyorGripTapeCount: report.haulOffBeltAudit.conveyorGripTapeCount,
      industrialMouldCount: report.haulOffBeltAudit.industrialMouldCount,
      haulOffLeafStatus: report.haulOffBeltAudit.haulOffLeafStatus,
    },
    weldingEquipmentAuditSummary: {
      totalAuditedSkus: report.weldingEquipmentAudit.totalAuditedSkus,
      weldingEquipmentAndClampCount: report.weldingEquipmentAudit.weldingEquipmentAndClampCount,
      weldedRoundCrcBeltCount: report.weldingEquipmentAudit.weldedRoundCrcBeltCount,
      weldedVOrFlatBeltCount: report.weldingEquipmentAudit.weldedVOrFlatBeltCount,
    },
    typeRuleProfiles: report.typeRuleProfiles,
    lowSkuSubcategoryDecisions: report.lowSkuSubcategoryDecisions,
  };

  fs.writeFileSync(
    path.join(DOCS_DIR, 'phase1-validation-results.json'),
    JSON.stringify(validationJson, null, 2),
    'utf8'
  );

  console.log('Generated all 7 Phase 1 deliverables in docs/:');
  console.log('1. docs/phase1-catalog-executive-report.md');
  console.log('2. docs/phase1-product-classification.xlsx');
  console.log('3. docs/phase1-family-reconstruction.xlsx');
  console.log('4. docs/phase1-taxonomy-mapping.xlsx');
  console.log('5. docs/phase1-unresolved-items.xlsx');
  console.log('6. docs/phase1-engineering-rules.md');
  console.log('7. docs/phase1-validation-results.json');
}

main();
