import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpLeft,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  LayoutGrid,
  List,
  Package,
  RotateCcw,
  Ruler,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  X,
} from 'lucide-react';
import { getAllProducts, subscribeCatalogChanges } from '../data/mockGenerator';
import { ProductCard, resolveDisplayBrand } from '../components/product/ProductCard';
import { ProductImage } from '../components/product/ProductImage';
import { DirectSkuProducts } from '../components/catalog/DirectSkuProducts';
import type { Product } from '../types';
import type { CategoryNode } from '../data/categories';
import { STORE_ASSETS } from '../assets/images';
import { toPersianDigits } from '../utils/formatters';
import { resolveSiteFallbackByText } from '../utils/siteProductImages';
import {
  buildCategoryFacetProfile,
  buildPaginationWindow,
  buildSubcategoryStripNodes,
  extractNumericDimensions,
  matchesDimensionRange,
  matchesDynamicFacetToken,
  resolveExcelCategoryArtwork,
  resolveSubcategoryThumb,
} from '../utils/excelCategoryCatalog';
import './excel-menu-category-premium.css';

type MenuFamily = {
  code: string;
  name: string;
  brand: string;
  submenu: string | null;
  leaf: string | null;
  skuCount: number;
};

type MenuCategory = {
  slug: string;
  name: string;
  description: string;
  image: string | null;
  children: CategoryNode[];
};

type MenuResponse = {
  success: boolean;
  category?: MenuCategory;
  families?: MenuFamily[];
  message?: string;
};

type CatalogueStatus = 'loading' | 'ready' | 'error';
type SortMode = 'default' | 'name' | 'code' | 'sku_desc' | 'stock_desc';
type ViewMode = 'grid' | 'list';
type PerPageOption = 12 | 24 | 48;

const DEFAULT_PAGE_SIZE: PerPageOption = 12;

const normalizeSearch = (value: string) => value
  .toLocaleLowerCase('fa-IR')
  .replace(/ي/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[\u200c\s]+/g, ' ')
  .trim();

type CategoryDomainProfile = {
  eyebrow: string;
  description: string;
  artwork: string;
  highlights: [string, string, string, string];
  quickSpecs: string[];
  specPlaceholder: string;
  defaultBrands: string[];
};

type VBeltProfileGroup = {
  id: string;
  title: string;
  standard: string;
  subtitle: string;
  profiles: { code: string; widthMm: string; heightMm: string }[];
};

const VBELT_PROFILE_GROUPS: VBeltProfileGroup[] = [
  {
    id: 'classic-wrapped',
    title: 'وی‌بلت کلاسیک ساده',
    standard: 'DIN 2215 / ISO 4184',
    subtitle: 'مقطع ذوزنقه‌ای استاندارد مناسب انتقال قدرت عمومی و کارگاهی',
    profiles: [
      { code: 'Z', widthMm: '10', heightMm: '6' },
      { code: 'A', widthMm: '13', heightMm: '8' },
      { code: 'B', widthMm: '17', heightMm: '11' },
      { code: 'C', widthMm: '22', heightMm: '14' },
      { code: 'D', widthMm: '32', heightMm: '20' },
      { code: 'E', widthMm: '38', heightMm: '23' },
    ],
  },
  {
    id: 'classic-cogged',
    title: 'کلاسیک دنده‌دار (Cogged)',
    standard: 'Raw Edge / سری X',
    subtitle: 'انعطاف‌پذیری بالا روی پولی‌های قطر کوچک و دفع حرارت بهتر',
    profiles: [
      { code: 'AX', widthMm: '13', heightMm: '8' },
      { code: 'BX', widthMm: '17', heightMm: '11' },
      { code: 'CX', widthMm: '22', heightMm: '14' },
    ],
  },
  {
    id: 'narrow-wedge',
    title: 'اسپشیال پروفیل باریک',
    standard: 'DIN 7753 / ISO 4184',
    subtitle: 'انتقال گشتاور و دور بالا با مقطع فشرده در ماشین‌آلات سنگین',
    profiles: [
      { code: 'SPZ', widthMm: '9.7', heightMm: '8' },
      { code: 'SPA', widthMm: '12.7', heightMm: '10' },
      { code: 'SPB', widthMm: '16.3', heightMm: '13' },
      { code: 'SPC', widthMm: '22', heightMm: '18' },
    ],
  },
  {
    id: 'narrow-cogged',
    title: 'اسپشیال دنده‌دار (سری XP)',
    standard: 'DIN 7753 / Raw Edge',
    subtitle: 'ترکیب پروفیل باریک اسپشیال و بدنه دنده‌دار ضد خستگی حرارتی',
    profiles: [
      { code: 'XPZ', widthMm: '9.7', heightMm: '8' },
      { code: 'XPA', widthMm: '12.7', heightMm: '10' },
      { code: 'XPB', widthMm: '16.3', heightMm: '13' },
      { code: 'XPC', widthMm: '22', heightMm: '18' },
    ],
  },
];

const VBELT_TOP_WIDTH_OPTIONS = [
  { id: '9.7', label: '۹.۷ میلی‌متر', hint: 'Z / SPZ / XPZ', matchers: ['9.7', '10', 'z', 'spz', 'xpz'] },
  { id: '12.7', label: '۱۲.۷ میلی‌متر', hint: 'A / AX / SPA / XPA', matchers: ['12.7', '13', 'a', 'ax', 'spa', 'xpa'] },
  { id: '16.3', label: '۱۶.۳ میلی‌متر', hint: 'B / BX / SPB / XPB', matchers: ['16.3', '17', 'b', 'bx', 'spb', 'xpb'] },
  { id: '22', label: '۲۲ میلی‌متر', hint: 'C / CX / SPC / XPC', matchers: ['22', 'c', 'cx', 'spc', 'xpc'] },
] as const;

const VBELT_STRUCTURE_OPTIONS = [
  { id: '', label: 'همه ساختارها' },
  { id: 'plain', label: 'ساده پوشش‌دار (Wrapped)' },
  { id: 'cogged', label: 'دنده‌دار (Cogged / X)' },
  { id: 'special', label: 'گریپ‌دار و خاص' },
] as const;

const GENERIC_SHARED_CATEGORY_IMAGES = new Set([
  '/images/belt-hero-cinematic.webp',
  '/images/scan-industrial-generated.webp',
  '/images/reverse-engineering-generated.webp',
]);

const resolveCategoryProfile = (category: MenuCategory): CategoryDomainProfile => {
  const slug = String(category.slug || '').trim().toLowerCase();
  const name = normalizeSearch(category.name);
  const customImage =
    category.image && !GENERIC_SHARED_CATEGORY_IMAGES.has(String(category.image).trim())
      ? category.image
      : undefined;
  const resolvedArtwork = resolveExcelCategoryArtwork(slug, category.name, customImage);

  if (slug === 'excel-v2-1-1' || /تایمینگ|timing/.test(name)) {
    return {
      eyebrow: 'کاتالوگ تخصصی انتقال قدرت همزمان',
      description:
        category.description ||
        'تأمین انواع تسمه تایمینگ صنعتی از برندهای معتبر، مناسب انتقال دقیق دور و گشتاور در ماشین‌آلات خطوط تولید، بسته‌بندی و کارگاهی همراه با مشاوره فنی و ارسال سریع.',
      artwork: resolvedArtwork,
      highlights: [
        'تنوع گام دندانه (8M, 5M, 14M, T10, AT10)',
        'قابلیت انتقال گشتاور بالا بدون لغزش',
        'جنس لاستیکی نئوپرن و پلی‌یورتان سیم‌فولادی',
        'مقاومت صنعتی در برابر سایش، روغن و حرارت',
      ],
      quickSpecs: ['8M', '5M', '14M', 'T10', 'AT10', 'HTD', 'XL', 'PU'],
      specPlaceholder: 'مثلاً 8M، 5M، T10، ۱۲۰۰ یا عرض 30mm',
      defaultBrands: ['Megadyne', 'BANDO', 'Continental', 'optibelt', 'PowerGrip', 'JASON'],
    };
  }

  if (slug === 'excel-v2-1-2' || /وی.?بلت|v-belt|شیاری|کلاسیک/.test(name)) {
    return {
      eyebrow: 'کاتالوگ مهندسی تسمه‌های وی‌بلت صنعتی (DIN 2215 / DIN 7753)',
      description:
        category.description ||
        'تأمین انواع تسمه وی‌بلت صنعتی از برندهای معتبر، مناسب برای انتقال قدرت در ماشین‌آلات صنعتی، خطوط تولید و تجهیزات کارگاهی همراه با مشاوره فنی، انتخاب محصول و تأمین سریع کالاها.',
      artwork: resolvedArtwork,
      highlights: [
        'پوشش کامل مقاطع کلاسیک (A تا E) و اسپشیال (SPZ تا SPC)',
        'مدل‌های دنده‌دار (Cogged X / XP) مناسب پولی‌های قطر کوچک',
        'تطابق دقیق عرض بالای پروفیل (۹.۷ تا ۳۸ میلی‌متر) و طول کد',
        'پایداری طولی، ضد الکتریسیته ساکن و مقاوم در برابر روغن و دما',
      ],
      quickSpecs: ['SPA', 'SPB', 'SPC', 'SPZ', 'A', 'B', 'C', 'D', 'AX', 'BX', 'CX', 'XPA', 'XPB', 'XPC', 'XPZ', 'Z'],
      specPlaceholder: 'مثلاً SPA، SPB، BX، ۱۲.۷ میلی‌متر یا طول 3150',
      defaultBrands: ['اپتی‌بلت', 'هانچانگ', 'باندو', 'دانگیل', 'مگادین', 'فوجی'],
    };
  }

  if (slug === 'excel-v2-1-3' || /جوشی|پلی.?یورتان|گرد|پنج.?ضلعی|crc/.test(name)) {
    return {
      eyebrow: 'تسمه‌های پلی‌یورتان جوشی و انتقال بار',
      description:
        category.description ||
        'تسمه‌های گرد (CRC)، ذوزنقه‌ای و تخت پلی‌یورتان جوشی با مقاومت سایشی بالا و قابلیت جوش حرارتی دقیق در طول دلخواه برای خطوط کاشی، سرامیک و بسته‌بندی.',
      artwork: resolvedArtwork,
      highlights: [
        'پلی‌یورتان خالص (PU) با مقاومت سایشی فوق‌العاده',
        'سطح مقطع گرد، ذوزنقه، پنج‌ضلعی (CRC) و آجدار',
        'قابلیت جوشکاری و حلقه شدن در متراژ سفارشی',
        'گزینه‌های مسلح (نخ‌دار) و ساده در سایزهای متنوع',
      ],
      quickSpecs: ['PU', 'CRC', '8mm', '10mm', '12mm', 'A', 'B', 'C'],
      specPlaceholder: 'مثلاً قطر 8mm، 10mm، CRC یا ذوزنقه B',
      defaultBrands: ['Megadyne', 'Habasit', 'Behabelt', 'Volta', 'Optibelt', 'FORZA'],
    };
  }

  if (slug === 'excel-v2-1-4' || /بارکش|برانکارد|ورق|تخت/.test(name)) {
    return {
      eyebrow: 'تسمه‌های تخت، بارکش و تجهیزات جوشی',
      description:
        category.description ||
        'تسمه‌های تخت بارکش، برزنتی و دستگاه‌های تسمه‌جوشی با تحمل کششی بالا برای بالابرها، خطوط انتقال سنگین و عملیات آماده‌سازی در محل.',
      artwork: resolvedArtwork,
      highlights: [
        'تحمل بار کششی سنگین بدون ازدیاد طول',
        'ساختار چندلایه منجیددار و روکش ضد سایش',
        'عرض‌ها و ضخامت‌های متنوع برش متری و حلقه‌ای',
        'مقاوم در برابر رطوبت، ضربه و شرایط کارگاهی',
      ],
      quickSpecs: ['2mm', '3mm', '4mm', '5mm', '50mm', '100mm', 'PU', 'PVC'],
      specPlaceholder: 'مثلاً عرض 50mm، ضخامت 3mm یا برزنتی',
      defaultBrands: ['Habasit', 'Chiorino', 'Ammeraal', 'Forbo', 'Megadyne', 'FORZA'],
    };
  }

  if (slug.startsWith('excel-v2-2-') || /نوار نقاله|کانوایر|conveyor/.test(name)) {
    return {
      eyebrow: 'تجهیزات انتقال مواد و نوار نقاله',
      description:
        category.description ||
        'تأمین تخصصی نوار نقاله‌های صنعتی PVC، PU و تجهیزات بازدید و نصب در ابعاد و ضخامت‌های گوناگون برای خطوط تولید، بسته‌بندی و کارخانجات.',
      artwork: resolvedArtwork,
      highlights: [
        'نوار نقاله PVC و PU بهداشتی (Food Grade) و صنعتی',
        'انواع سطح ساده، آجدار، گریپ و تیغه‌دار',
        'آماده‌سازی، آپارات گرم و نصب بست فلزی در سایز خط',
        'مقاوم در برابر چربی، سایش و حرارت کوره',
      ],
      quickSpecs: ['PVC', 'PU', '2mm', '3mm', '4mm', 'آجدار', 'تفلون', 'مدولار'],
      specPlaceholder: 'مثلاً PVC، 2mm، عرض 60cm یا آجدار',
      defaultBrands: ['Forbo', 'Ammeraal', 'Habasit', 'Chiorino', 'Esbelt', 'Intralox'],
    };
  }

  if (slug.startsWith('excel-v2-3-') || /رولر|غلتک|رولیک/.test(name)) {
    return {
      eyebrow: 'رولر، غلتک و قطعات هدایت خطوط انتقال',
      description:
        category.description ||
        'انواع روکش رولر و غلتک، بوش بغل و دنده رولر، فنر سر رول، پین و خار نگهدارنده با ماشین‌کاری دقیق و متریال مقاوم در برابر سایش و حرارت.',
      artwork: resolvedArtwork,
      highlights: [
        'رولرهای کوره سرامیکی و غلتک‌های صنعتی بالانس‌شده',
        'روکش‌های پلی‌یورتان و لاستیکی ضد سایش و حرارت',
        'طراحی شفت، بلبرینگ‌خور و خارگیر طبق نقشه خط',
        'کارکرد نرم و بدون لرزش در سرعت‌های پیوسته',
      ],
      quickSpecs: ['استیل', 'سرامیکی', 'PU', 'قطر 50', 'قطر 60', 'قطر 89', 'شفت', 'رولیک'],
      specPlaceholder: 'مثلاً قطر 60mm، طول 500mm یا بوش دنده',
      defaultBrands: ['Interroll', 'Rulmeca', 'FORZA', 'System Ceramics', 'Sacmi', 'SKF'],
    };
  }

  if (slug.startsWith('excel-v2-4-') || /پولی|pulley|تیپربوش/.test(name)) {
    return {
      eyebrow: 'پولی‌های تایمینگ، وی‌بلت و تیپربوش',
      description:
        category.description ||
        'انواع پولی تایمینگ پلی‌اورتان، پلاستیکی و فلزی در گام‌ها و تعداد دندانه‌های استاندارد همراه با مشاوره انتخاب پولی و تسمه متناظر.',
      artwork: resolvedArtwork,
      highlights: [
        'دقت ماشین‌کاری پروفیل دندانه مطابق استاندارد ISO',
        'پولی‌های تیپربوش‌خور (Taper Lock) آماده نصب سریع',
        'جنس چدن GG25، آلومینیوم و پلی‌آمید با بالانس دقیق',
        'تنوع تعداد دندانه، عرض تسمه‌خور و قطر شفت',
      ],
      quickSpecs: ['8M', '5M', 'T10', 'AT10', 'SPA', 'SPB', 'SPC', 'Taper'],
      specPlaceholder: 'مثلاً 8M، 24 دندانه، T10 یا قطر شفت',
      defaultBrands: ['Chiaravalli', 'Sati', 'Challenge', 'optibelt', 'SKF', 'FORZA'],
    };
  }

  if (slug.startsWith('excel-v2-5-') || /برس|فرچه|سیلندر/.test(name)) {
    return {
      eyebrow: 'برس‌های صنعتی، سیمی و خشک‌کن',
      description:
        category.description ||
        'برس‌های سیمی و خشک‌کن صنعتی مخصوص خطوط شستشو، پولیش و کاشی و سرامیک با الیاف مقاوم و امکان تولید در ابعاد اختصاصی.',
      artwork: resolvedArtwork,
      highlights: [
        'الیاف نایلونی، پلی‌پروپیلن، سیمی و ابریشمی صنعتی',
        'برس‌های تسمه‌ای و سیلندری مخصوص خطوط کاشی و سرامیک',
        'مقاومت بالا در برابر سایش، رطوبت و مواد شیمیایی',
        'تولید و کاشت الیاف بر اساس ابعاد و تراکم درخواستی',
      ],
      quickSpecs: ['سیلندری', 'تسمه‌ای', 'خطی', 'گرد', 'سیمی', 'نایلونی', 'کاشی', 'پولیش'],
      specPlaceholder: 'مثلاً قطر برس، طول یا نوع الیاف',
      defaultBrands: ['Kuller', 'Mink Bürsten', 'Osborn', 'FORZA', 'Sacmi', 'System'],
    };
  }

  if (slug === 'excel-v2-6-4' || /سنسور/.test(name)) {
    return {
      eyebrow: 'سنسورها و تجهیزات کنترلی خطوط انتقال',
      description:
        category.description ||
        'تأمین انواع سنسورهای نوری، القایی و نگهدارنده‌های تنظیم دقیق سنسور جهت پایش حرکت، شمارش و کنترل موقعیت در خطوط انتقال صنعتی.',
      artwork: resolvedArtwork,
      highlights: [
        'دقت تشخیص بالا در سرعت‌های صنعتی و خطوط بسته‌بندی',
        'بدنه مقاوم در برابر گردوغبار، رطوبت و ارتعاش (IP67)',
        'براکت‌ها و نگهدارنده‌های آلومینیومی و استیل قابل تنظیم',
        'سازگار با تابلوهای کنترل و سیستم‌های اتوماسیون خط',
      ],
      quickSpecs: ['نوری', 'القایی', 'M12', 'M18', 'M30', 'NPN', 'PNP', 'براکت'],
      specPlaceholder: 'مثلاً سنسور M18، نوری یا پایه نگهدارنده',
      defaultBrands: ['Omron', 'Sick', 'IFM', 'Pepperl+Fuchs', 'System Plast', 'FORZA'],
    };
  }

  if (slug.startsWith('excel-v2-6-') || /ریل|گاید|پروفیل هدایت|پلی.?اتیلن/.test(name)) {
    return {
      eyebrow: 'ریل، گاید و تجهیزات هدایت خطوط انتقال',
      description:
        category.description ||
        'انواع ریل راهنما، گاید تفلونی ۲ و ۳ لبه، نرده استیل، پایه کشویی و متعلقات هدایت خطوط انتقال با ضریب اصطکاک پایین و دوام صنعتی.',
      artwork: resolvedArtwork,
      highlights: [
        'پلی‌اتیلن PE1000 ضد سایش با حرکت کاملاً روان',
        'پروفیل‌های هدایت زنجیر، تسمه تایمینگ و وی‌بلت',
        'مجهز به کانال آلومینیومی و استیل نگهدارنده',
        'مقاوم در برابر ضربه، رطوبت و محیط‌های اسیدی',
      ],
      quickSpecs: ['PE1000', 'PTFE', 'PA6', 'T-Profile', 'C-Profile', 'ریل زنجیر', 'گاید', 'پروفیل'],
      specPlaceholder: 'مثلاً PE1000، عرض کانال یا تیپ پروفیل',
      defaultBrands: ['Rochling', 'System Plast', 'Regina', 'Murtfeldt', 'Habasit', 'FORZA'],
    };
  }

  if (slug.startsWith('excel-v2-7-') || /پلیمری|لاستیکی|اورینگ|پکینگ|کاسه نمد|آب.?بند/.test(name)) {
    return {
      eyebrow: 'قطعات پلیمری، آب‌بندها، اورینگ و ضربه‌گیر',
      description:
        category.description ||
        'مجموعه تخصصی قطعات لاستیکی، اورینگ، کاسه‌نمد، پکینگ، ضربه‌گیر و مکنده صنعتی با متریال NBR، وایتون، سیلیکون و پلی‌یورتان.',
      artwork: resolvedArtwork,
      highlights: [
        'متریال NBR، وایتون (FKM)، سیلیکون، EPDM و PU',
        'تحمل دمایی و مقاومت عالی در برابر روغن و هیدرولیک',
        'انواع کاسه‌نمد، پکینگ، اورینگ متری و حلقه‌ای',
        'ساخت قطعات لاستیکی و پلیمری خاص از روی نمونه',
      ],
      quickSpecs: ['NBR', 'Viton', 'Silicone', 'PU', 'PTFE', 'O-Ring', 'کاسه‌نمد', 'کوپلینگ'],
      specPlaceholder: 'مثلاً قطر داخلی، ضخامت، Viton یا NBR',
      defaultBrands: ['Freudenberg', 'SKF', 'NOK', 'Parker', 'Trelleborg', 'FORZA'],
    };
  }

  if (slug.startsWith('excel-v2-8-') || /نسوز|حرارتی|تفلون|فایبرگلاس/.test(name)) {
    return {
      eyebrow: 'تجهیزات نسوز، برزنتی و عایق حرارتی',
      description:
        category.description ||
        'انواع نوار برزنتی نسوز چندلایه، نوار نسوز چسب‌دار، نخ و عایق حرارتی مقاوم در برابر دماهای کوره و پرس خطوط صنعتی.',
      artwork: resolvedArtwork,
      highlights: [
        'تحمل حرارتی پیوسته در کوره‌ها و خطوط خشک‌کن',
        'روکش PTFE نچسب با مقاومت شیمیایی بالا',
        'نوار، طناب و پکینگ‌های عایق‌بندی درز کوره',
        'برش و دوخت در ابعاد اختصاصی دستگاه شما',
      ],
      quickSpecs: ['PTFE', 'چسب‌دار', 'بدون چسب', 'فایبرگلاس', 'سرامیکی', '0.13mm', '0.25mm', 'نسوز'],
      specPlaceholder: 'مثلاً تفلون چسب‌دار، ضخامت 0.25mm یا عرض',
      defaultBrands: ['Saint-Gobain', 'Taconic', 'Frenzelit', 'FORZA', 'Klinger', 'Garlock'],
    };
  }

  if (slug.startsWith('excel-v2-9-') || /زنجیر|چرخ.?زنجیر|کوپلینگ|یراق|چرخ|پمپ/.test(name)) {
    return {
      eyebrow: 'زنجیر و قطعات مکانیکی انتقال حرکت',
      description:
        category.description ||
        'انواع زنجیر صنعتی استاندارد BS و ANSI، چرخ‌زنجیر، یراق‌آلات مکانیکی، چرخ‌های صنعتی و قطعات پمپ با مقاومت کششی بالا.',
      artwork: resolvedArtwork,
      highlights: [
        'استانداردهای کامل 06B تا 32B و سری ANSI (40 تا 160)',
        'فولاد آلیاژی عملیات حرارتی‌شده با مقاومت کششی بالا',
        'چرخ‌زنجیرهای ساده و هاب‌دار آماده سوراخ‌کاری',
        'انواع زنجیر استیل، شاخک‌دار و پین‌دار خطوط انتقال',
      ],
      quickSpecs: ['08B', '10B', '12B', '16B', 'ANSI 40', 'ANSI 60', 'ANSI 80', 'دو ردیفه'],
      specPlaceholder: 'مثلاً 08B، 10B، گام 12.7mm یا تعداد دندانه',
      defaultBrands: ['Tsubaki', 'iwis', 'Renold', 'Regina', 'Donghua', 'Chiaravalli'],
    };
  }

  if (slug.startsWith('excel-v2-10-') || /لعاب|چاپ|اسپاتول|روتاری/.test(name)) {
    return {
      eyebrow: 'تجهیزات خطوط لعاب، چاپ و کاشی و سرامیک',
      description:
        category.description ||
        'انواع اسپاتول سیلیکونی دستگاه چاپ، انگشتی روتاری و قطعات مصرفی تخصصی خطوط لعاب و کاشی و سرامیک.',
      artwork: resolvedArtwork,
      highlights: [
        'اسپاتول و کاردک پلی‌یورتان و سیلیکونی در سختی‌های دقیق',
        'قطعات سازگار با خطوط Sacmi، System و فورته',
        'مقاومت عالی در برابر سایش لعاب و حلال‌های صنعتی',
        'تأمین سریع قطعات مصرفی خطوط کاشی و سرامیک',
      ],
      quickSpecs: ['Shore 70', 'Shore 80', 'Shore 85', 'PU', 'اسپاتول', 'کاردک', 'روتاری', 'لعاب'],
      specPlaceholder: 'مثلاً سایز اسپاتول، سختی یا مدل دستگاه',
      defaultBrands: ['Sacmi', 'System Ceramics', 'Barbieri & Tarozzi', 'BMR', 'FORZA', 'AirPower'],
    };
  }

  if (slug.startsWith('excel-v2-11-') || /توری|مش|فیلتر|سرند/.test(name)) {
    return {
      eyebrow: 'توری مش، سرند و فیلتراسیون صنعتی',
      description:
        category.description ||
        'انواع توری مش صنعتی در چشمه‌ها و ابعاد مختلف برای خطوط سرند، فیلتراسیون، چاپ و خشک‌کن صنعتی.',
      artwork: resolvedArtwork,
      highlights: [
        'مش‌بندی دقیق از مش‌های درشت تا میکرونی',
        'استیل ضدزنگ ۳۰۴ و ۳۱۶ مقاوم در برابر اسید و زنگ‌زدگی',
        'توری‌های پلی‌استر با کشش استاندارد مخصوص شابلون و سرند',
        'عرضه به‌صورت رول و برش‌خورده طبق ابعاد سرند',
      ],
      quickSpecs: ['SS304', 'SS316', 'Mesh 40', 'Mesh 60', 'Mesh 100', 'Mesh 200', 'پلی‌استر', 'سرند'],
      specPlaceholder: 'مثلاً شماره مش 100، قطر مفتول یا استیل 304',
      defaultBrands: ['Sefar', 'Saati', 'GKD', 'Haver & Boecker', 'FORZA', 'Bopp'],
    };
  }

  if (slug.startsWith('excel-v2-12-') || /سفارشی|نقشه|مهندسی معکوس/.test(name)) {
    return {
      eyebrow: 'ساخت سفارشی و مهندسی معکوس قطعات',
      description:
        category.description ||
        'طراحی، مدل‌سازی و ساخت سفارشی قطعات صنعتی فلزی، پلیمری و لاستیکی بر اساس نقشه فنی یا نمونه فیزیکی با کنترل کیفیت ابعادی.',
      artwork: resolvedArtwork,
      highlights: [
        'اسکن، اندازه‌گیری دقیق و تهیه نقشه ساخت از نمونه',
        'انتخاب متریال مهندسی متناسب با دما، فشار و سایش',
        'ماشین‌کاری CNC، قالب‌سازی پلیمری و پوشش‌دهی تخصصی',
        'تضمین انطباق تلرانس و عملکرد در خط تولید',
      ],
      quickSpecs: ['CNC', 'PU', 'PTFE', 'فولاد آلیاژی', 'استیل', 'پلی‌آمید', 'برنز', 'نمونه‌سازی'],
      specPlaceholder: 'مثلاً جنس قطعه، قطر، طول یا کد نقشه',
      defaultBrands: ['FORZA Engineering', 'Atlas Precision', 'Custom OEM'],
    };
  }

  if (slug.startsWith('excel-v2-13-') || /بلبرینگ|یاتاقان|رولبرینگ|bearing/.test(name)) {
    return {
      eyebrow: 'بلبرینگ، رولبرینگ و یاتاقان‌های صنعتی',
      description:
        category.description ||
        'انواع بلبرینگ صنعتی، یاتاقان، محافظ یاتاقان، مهره و واشر از برندهای معتبر جهانی با اصالت تضمین‌شده و انتخاب دقیق شماره فنی.',
      artwork: resolvedArtwork,
      highlights: [
        'سری‌های ۶۰۰۰، ۶۲۰۰، ۶۳۰۰، ۲۲۲۰۰ و یاتاقان‌های صنعتی',
        'آب‌بندی 2RS (کاسه‌نمددار) و ZZ (فلزی) با لقی استاندارد و C3',
        'تحمل دور و بار شعاعی و محوری سنگین',
        'تضمین اصالت برند و تطابق دقیق شماره فنی',
      ],
      quickSpecs: ['6204', '6205', '6305', 'UCP', 'UCF', 'UCFL', '2RS', 'C3'],
      specPlaceholder: 'مثلاً 6205، UCP205، قطر شفت یا 2RS',
      defaultBrands: ['SKF', 'FAG', 'NSK', 'NTN', 'TIMKEN', 'KOYO'],
    };
  }

  if (slug.startsWith('excel-v2-14-') || /ابر|اسفنج|اسکاج|فوم/.test(name)) {
    return {
      eyebrow: 'ابر، اسفنج و اسکاج تخصصی صنعتی',
      description:
        category.description ||
        'انواع ابر اسفنجی، نوار اسفنجی ساده، چسب‌دار و سیلیکونی نسوز و اسکاج صنعتی برای خطوط کاشی، سرامیک، شستشو و بسته‌بندی.',
      artwork: resolvedArtwork,
      highlights: [
        'تراکم یکنواخت و برگشت‌پذیری الاستیک بالا',
        'انواع اسفنج سیلیکونی نسوز، لاتکس و پلی‌یورتان',
        'مخصوص غلتک‌های لعاب‌گیر، تمیزکننده و آب‌گیر',
        'عرضه به‌صورت ورق، رول و استوانه آماده نصب',
      ],
      quickSpecs: ['سیلیکونی', 'متراکم', 'غلتکی', 'ورق', '10mm', '20mm', '30mm', 'نسوز'],
      specPlaceholder: 'مثلاً ضخامت 20mm، قطر غلتک یا چسب‌دار',
      defaultBrands: ['FORZA', 'Sacmi', 'System Ceramics', 'Rogers', 'Armacell'],
    };
  }

  return {
    eyebrow: 'کاتالوگ تخصصی صنعت پیش',
    description:
      category.description ||
      'کاتالوگ جامع و تخصصی انواع قطعات صنعتی با کیفیت بالا و استانداردهای جهانی، مناسب برای انواع ماشین‌آلات و خطوط تولید.',
    artwork: resolvedArtwork,
    highlights: [
      'تنوع سایز، گام و پروفیل صنعتی',
      'تضمین اصالت و تطابق استاندارد',
      'مشاوره فنی و انتخاب دقیق قطعه',
      'تأمین مستقیم خطوط تولید',
    ],
    quickSpecs: ['8M', '5M', '14M', 'T10', 'SPA', 'SPB', 'HTD', 'PU'],
    specPlaceholder: 'مثلاً 8M، SPA، ۱۲۵۰ یا 25 mm',
    defaultBrands: ['Megadyne', 'BANDO', 'Continental', 'optibelt', 'SKF', 'FORZA'],
  };
};

const matchesSelection = (
  family: MenuFamily,
  selection: string,
  subnodes: CategoryNode[] = [],
) => {
  if (!selection) return true;
  if (family.submenu === selection || family.leaf === selection) return true;
  const matchedNode = subnodes.find(node => node.name === selection);
  if (matchedNode?.children?.some(child => family.leaf === child.name || family.submenu === child.name)) {
    return true;
  }
  if (/متری/i.test(selection) && /متری|گریپ|سوراخ|کلاف|پشت/i.test(family.name)) {
    return true;
  }
  return false;
};

const hasCatalogImage = (product?: Product) => Boolean(product && (
  product.images?.some(Boolean) ||
  product.image ||
  product.galleryImages?.some(image => Boolean(image.url)) ||
  product.variants?.some(variant => variant.images?.some(Boolean))
));

const productPreviewImage = (product?: Product) =>
  product?.images?.find(Boolean) ||
  product?.image ||
  product?.galleryImages?.find(image => image.scope === 'family')?.url ||
  product?.galleryImages?.find(image => image.url)?.url ||
  product?.variants?.find(variant => variant.images?.some(Boolean))?.images?.find(Boolean);

const normalizeSpecValue = (value: string) =>
  normalizeSearch(value).replace(/[×*]/g, 'x').replace(/\s+/g, '').replace(/,/g, '.');

const EXACT_PROFILE_CODES = new Set([
  'z', 'a', 'b', 'c', 'd', 'e',
  'ax', 'bx', 'cx',
  'spz', 'spa', 'spb', 'spc',
  'xpz', 'xpa', 'xpb', 'xpc',
  '3v', '5v', '8v', '3vx', '5vx',
  'pk', 'pj', 'pl', 'pm', 'ph',
  '8m', '5m', '14m', '3m', '20m',
  't5', 't10', 't20', 'at5', 'at10', 'at20',
  'xl', 'l', 'h', 'xh', 'xxh',
]);

const matchesExactBeltProfile = (product: Product | undefined, targetProfile: string): boolean => {
  if (!product) return false;
  const code = targetProfile.toLowerCase();
  const specs = [
    ...(product.technicalSpecs || []),
    ...(product.variants || []).flatMap(variant => variant.technicalSpecs || []),
  ];

  for (const spec of specs) {
    const k = normalizeSearch(spec.key);
    if (k === 'پروفیل' || k === 'گام' || k === 'تیپ') {
      if (normalizeSpecValue(spec.value) === code) return true;
    }
    if (k === 'پروفیل ها' || k === 'پروفیل‌ها') {
      const tokens = String(spec.value || '')
        .split(/[،,\s]+/)
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
      const tokenRegex = new RegExp('^' + code + '([0-9./\\-]|$)', 'i');
      if (tokens.some(token => tokenRegex.test(token))) return true;
    }
  }

  const boundaryRegex = new RegExp('(^|[^a-zA-Z0-9])' + code + '(\\s*[-/]\\s*\\d|\\d+|\\s|$)', 'i');
  if (boundaryRegex.test(product.name) || boundaryRegex.test(product.nameEn || '')) {
    return true;
  }
  return (product.variants || []).some(
    v => boundaryRegex.test(v.size || '') || boundaryRegex.test(v.code || ''),
  );
};

const matchesTechnicalFilter = (product: Product | undefined, specKey: string, specValue: string) => {
  const normalizedKey = normalizeSearch(specKey);
  const normalizedValue = normalizeSpecValue(specValue);
  if (!normalizedKey && !normalizedValue) return true;

  if (
    normalizedValue &&
    EXACT_PROFILE_CODES.has(normalizedValue) &&
    (!normalizedKey || normalizedKey === 'پروفیل' || normalizedKey === 'پروفیل ها' || normalizedKey === 'گام')
  ) {
    return matchesExactBeltProfile(product, normalizedValue);
  }

  const specs = [
    ...(product?.technicalSpecs || []),
    ...(product?.variants || []).flatMap(variant => variant.technicalSpecs || []),
  ];
  return specs.some(spec =>
    (!normalizedKey || normalizeSearch(spec.key).includes(normalizedKey)) &&
    (!normalizedValue || normalizeSpecValue(spec.value).includes(normalizedValue)),
  );
};

const matchesBeltStructure = (family: MenuFamily, product: Product | undefined, structure: string): boolean => {
  if (!structure) return true;
  const combinedText = [
    family.name,
    family.leaf || '',
    family.submenu || '',
    product?.name || '',
    ...(product?.technicalSpecs || []).map(s => `${s.key} ${s.value}`),
    ...(product?.variants?.slice(0, 3) || []).flatMap(v => (v.technicalSpecs || []).map(s => `${s.key} ${s.value}`)),
  ].join(' ');

  const isCogged = /دنده.?دار|دندانه.?دار|\b(AX|BX|CX|XPZ|XPA|XPB|XPC|3VX|5VX)\b/i.test(combinedText);
  const isSpecial = /گریپ|سوراخ|متری|روکش|پشت/i.test(combinedText);

  if (structure === 'cogged') return isCogged;
  if (structure === 'special') return isSpecial;
  if (structure === 'plain') return !isCogged && !isSpecial;
  return true;
};

const matchesBeltTopWidth = (product: Product | undefined, widthId: string): boolean => {
  if (!widthId) return true;
  const option = VBELT_TOP_WIDTH_OPTIONS.find(item => item.id === widthId);
  if (!option || !product) return false;

  const specs = [
    ...(product.technicalSpecs || []),
    ...(product.variants || []).flatMap(variant => variant.technicalSpecs || []),
  ];

  for (const spec of specs) {
    if (/عرض/i.test(spec.key)) {
      const val = normalizeSpecValue(spec.value);
      if (val.includes(widthId)) return true;
    }
  }

  return option.matchers.some(profile =>
    EXACT_PROFILE_CODES.has(profile) ? matchesExactBeltProfile(product, profile) : false,
  );
};

export const ExcelMenuCategoryPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<MenuResponse | null>(null);
  const [status, setStatus] = useState<CatalogueStatus>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [catalogRevision, refreshProducts] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [compareCodes, setCompareCodes] = useState<string[]>([]);
  const [compareNotice, setCompareNotice] = useState('');
  const [brandQuery, setBrandQuery] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllFacets, setShowAllFacets] = useState(false);
  const [matrixExpanded, setMatrixExpanded] = useState(false);
  const modalRootRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  const selection = searchParams.get('sub') || '';
  const search = searchParams.get('q') || '';
  const selectedBrands = searchParams.getAll('brand');
  const inStockOnly = searchParams.get('stock') === '1';
  const imageOnly = searchParams.get('image') === '1';
  const specKey = searchParams.get('spec') || '';
  const specValue = searchParams.get('specValue') || '';
  const facetToken = searchParams.get('facet') || '';
  const beltStructure = searchParams.get('structure') || '';
  const beltTopWidth = searchParams.get('width') || '';
  const lenMin = searchParams.get('lenMin') || '';
  const lenMax = searchParams.get('lenMax') || '';
  const dimMin = searchParams.get('dimMin') || '';
  const dimMax = searchParams.get('dimMax') || '';
  const orderMode = searchParams.get('orderMode') || 'all';
  const requestedSort = searchParams.get('sort') || 'default';
  const sortBy: SortMode = ['default', 'name', 'code', 'sku_desc', 'stock_desc'].includes(requestedSort)
    ? requestedSort as SortMode
    : 'default';
  const requestedPerPage = Number(searchParams.get('perPage'));
  const perPage: PerPageOption = ([12, 24, 48] as const).includes(requestedPerPage as PerPageOption)
    ? (requestedPerPage as PerPageOption)
    : DEFAULT_PAGE_SIZE;
  const viewMode: ViewMode = searchParams.get('view') === 'list' ? 'list' : 'grid';
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);

  useEffect(() => subscribeCatalogChanges(() => refreshProducts(value => value + 1)), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setStatus('loading');
    setData(null);
    setCompareCodes([]);
    setComparisonOpen(false);
    setBrandQuery('');
    setShowAllBrands(false);
    setShowAllFacets(false);
    setMatrixExpanded(false);

    fetch('/api/catalog/menu-category/' + encodeURIComponent(slug), {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json() as MenuResponse;
        if (!response.ok || !body.success || !body.category || !Array.isArray(body.families)) {
          throw new Error(body.message || 'catalog unavailable');
        }
        return body;
      })
      .then(body => {
        if (active) {
          setData(body);
          setStatus('ready');
        }
      })
      .catch(error => {
        if (!active || (error instanceof Error && error.name === 'AbortError')) return;
        setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [slug, retryCount]);

  useEffect(() => {
    if (!mobileFiltersOpen && !comparisonOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = () => Array.from(
      modalRootRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [],
    ).filter(element => element.offsetParent !== null);

    const focusFrame = window.requestAnimationFrame(() => {
      (modalCloseRef.current || getFocusable()[0])?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileFiltersOpen(false);
        setComparisonOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (!items.length) {
        event.preventDefault();
        modalCloseRef.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mobileFiltersOpen, comparisonOpen]);

  const products = useMemo(() => {
    const map = new Map<string, Product>(
      getAllProducts().map(product => [product.code, product]),
    );
    map.forEach(product => {
      (product.variants || []).forEach(variant => {
        if (!variant.code) return;
        if (!map.has(variant.code)) map.set(variant.code, product);
        const famKey = `FAM-${variant.code}`;
        if (!map.has(famKey)) map.set(famKey, product);
      });
    });
    return map;
  }, [data, status, catalogRevision]);

  const families = data?.families || [];
  const category = data?.category;
  const isVBeltCategory = slug === 'excel-v2-1-2' || Boolean(category && /وی.?بلت|v-belt/i.test(category.name));
  const skuTotal = families.reduce((total, family) => total + Math.max(0, Number(family.skuCount) || 0), 0);

  const familyResolvedBrands = useMemo(() => {
    const map = new Map<string, string>();
    families.forEach(family => {
      const product = products.get(family.code);
      const resolved = resolveDisplayBrand(family.brand || product?.brand, family.name || product?.name);
      map.set(family.code, resolved);
    });
    return map;
  }, [families, products]);

  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>();
    families.forEach(family => {
      const resolved = familyResolvedBrands.get(family.code) || family.brand;
      if (!resolved || resolved === 'ثبت نشده' || resolved === 'صنعت پیش' || resolved === 'وارداتی صنعتی') return;
      counts.set(resolved, (counts.get(resolved) || 0) + 1);
    });
    return counts;
  }, [families, familyResolvedBrands]);

  const availableBrands = useMemo(() => Array.from(brandCounts.keys()).sort((a, b) => {
    const countDiff = (brandCounts.get(b) || 0) - (brandCounts.get(a) || 0);
    return countDiff !== 0 ? countDiff : a.localeCompare(b, 'fa');
  }), [brandCounts]);

  const visibleBrandList = useMemo(() => {
    const q = normalizeSearch(brandQuery);
    const matching = q
      ? availableBrands.filter(b => normalizeSearch(b).includes(q))
      : availableBrands;
    return showAllBrands || q ? matching : matching.slice(0, 5);
  }, [availableBrands, brandQuery, showAllBrands]);

  const facetProfile = useMemo(
    () => buildCategoryFacetProfile(slug, category?.name || '', families, products),
    [slug, category?.name, families, products],
  );

  const visibleFacetOptions = useMemo(
    () => (showAllFacets ? facetProfile.primaryFacetOptions : facetProfile.primaryFacetOptions.slice(0, 6)),
    [facetProfile.primaryFacetOptions, showAllFacets],
  );

  const vbeltProfileCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!isVBeltCategory) return counts;
    VBELT_PROFILE_GROUPS.forEach(group => {
      group.profiles.forEach(prof => {
        const count = families.filter(f => matchesExactBeltProfile(products.get(f.code), prof.code)).length;
        counts.set(prof.code, count);
      });
    });
    return counts;
  }, [families, products, isVBeltCategory]);

  const vbeltWidthCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!isVBeltCategory) return counts;
    VBELT_TOP_WIDTH_OPTIONS.forEach(opt => {
      const count = families.filter(f => matchesBeltTopWidth(products.get(f.code), opt.id)).length;
      counts.set(opt.id, count);
    });
    return counts;
  }, [families, products, isVBeltCategory]);

  const availableSpecKeys = useMemo(() => {
    const keys = new Set<string>();
    const dimensionKey = /پروفیل|قطر|عرض|طول|گام|ضخامت|سایز|ابعاد|pitch|width|length|profile|diameter|thickness/i;
    families.forEach(family => {
      const product = products.get(family.code);
      [
        ...(product?.technicalSpecs || []),
        ...(product?.variants || []).flatMap(variant => variant.technicalSpecs || []),
      ].forEach(spec => {
        if (dimensionKey.test(spec.key)) keys.add(spec.key);
      });
    });
    return Array.from(keys).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [families, products]);

  const stockStats = useMemo(() => {
    let inStock = 0;
    let withImage = 0;
    families.forEach(family => {
      const product = products.get(family.code);
      if (product?.stockKnown === true && product.stock > 0 && !product.inquiryOnly) inStock += 1;
      if (hasCatalogImage(product)) withImage += 1;
    });
    return { inStock, withImage, supply: Math.max(0, families.length - inStock) };
  }, [families, products]);

  const familyDimensions = useMemo(() => {
    const map = new Map<string, ReturnType<typeof extractNumericDimensions>>();
    families.forEach(family => {
      map.set(family.code, extractNumericDimensions(family, products.get(family.code)));
    });
    return map;
  }, [families, products]);

  const updateParam = (key: string, value: string, replace = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace });
  };

  const updateBrands = (brands: string[]) => {
    const next = new URLSearchParams(searchParams);
    next.delete('brand');
    brands.forEach(brand => next.append('brand', brand));
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    [
      'q', 'brand', 'stock', 'image', 'spec', 'specValue', 'facet',
      'structure', 'width', 'lenMin', 'lenMax', 'dimMin', 'dimMax',
      'orderMode', 'sort', 'sub', 'page',
    ].forEach(key => next.delete(key));
    setSearchParams(next, { replace: true });
    setBrandQuery('');
    setMobileFiltersOpen(false);
  };

  const filteredFamilies = useMemo(() => {
    const query = normalizeSearch(search);
    const visibleNodes = (category?.children || []).filter(node => node.hidden !== true);
    const list = families.filter(family => {
      if (!matchesSelection(family, selection, visibleNodes)) return false;
      const resolvedBrand = familyResolvedBrands.get(family.code) || family.brand;
      if (
        selectedBrands.length &&
        !selectedBrands.includes(family.brand) &&
        !selectedBrands.includes(resolvedBrand)
      ) {
        return false;
      }

      const product = products.get(family.code);
      if (inStockOnly && !(product?.stockKnown === true && product.stock > 0 && !product.inquiryOnly)) return false;
      if (imageOnly && !hasCatalogImage(product)) return false;
      if (!matchesTechnicalFilter(product, specKey, specValue)) return false;
      if (facetToken && !matchesDynamicFacetToken(family, product, facetToken)) return false;
      if (beltStructure && !matchesBeltStructure(family, product, beltStructure)) return false;
      if (beltTopWidth && !matchesBeltTopWidth(product, beltTopWidth)) return false;

      if (lenMin || lenMax || dimMin || dimMax) {
        const dims = familyDimensions.get(family.code) || { primaryValues: [], secondaryValues: [] };
        if (!matchesDimensionRange(dims, lenMin, lenMax, dimMin, dimMax)) return false;
      }

      if (orderMode === 'multi_sku' && family.skuCount <= 1) return false;
      if (orderMode === 'single_sku' && family.skuCount > 1) return false;

      if (!query) return true;
      const searchable = normalizeSearch([
        family.name,
        family.code,
        family.brand,
        resolvedBrand,
        family.submenu || '',
        family.leaf || '',
        product?.name || '',
        product?.nameEn || '',
        ...(product?.technicalSpecs || []).flatMap(spec => [spec.key, spec.value]),
        ...(product?.variants || []).flatMap(variant => [
          variant.code,
          variant.name,
          variant.size,
          ...(variant.technicalSpecs || []).flatMap(spec => [spec.key, spec.value]),
        ]),
      ].join(' '));
      return searchable.includes(query);
    });

    if (sortBy === 'default') {
      list.sort((a, b) => {
        const aIsPulley = /پولی|چرخ|فلکه/i.test(a.name) ? 1 : 0;
        const bIsPulley = /پولی|چرخ|فلکه/i.test(b.name) ? 1 : 0;
        if (aIsPulley !== bIsPulley) return aIsPulley - bIsPulley;
        const aIsGeneric = /عمومی/i.test(a.name) ? 1 : 0;
        const bIsGeneric = /عمومی/i.test(b.name) ? 1 : 0;
        if (aIsGeneric !== bIsGeneric) return aIsGeneric - bIsGeneric;
        const aProd = products.get(a.code);
        const bProd = products.get(b.code);
        const aHasProfile = (aProd?.technicalSpecs || []).some(s => /پروفیل|عرض/i.test(s.key)) ? 1 : 0;
        const bHasProfile = (bProd?.technicalSpecs || []).some(s => /پروفیل|عرض/i.test(s.key)) ? 1 : 0;
        if (aHasProfile !== bHasProfile) return bHasProfile - aHasProfile;
        const aBrand = familyResolvedBrands.get(a.code) || '';
        const bBrand = familyResolvedBrands.get(b.code) || '';
        const aNamedBrand = aBrand && aBrand !== 'وارداتی صنعتی' && aBrand !== 'صنعت پیش' && aBrand !== 'ثبت نشده' ? 1 : 0;
        const bNamedBrand = bBrand && bBrand !== 'وارداتی صنعتی' && bBrand !== 'صنعت پیش' && bBrand !== 'ثبت نشده' ? 1 : 0;
        if (aNamedBrand !== bNamedBrand) return bNamedBrand - aNamedBrand;
        const aMulti = a.skuCount > 1 ? 1 : 0;
        const bMulti = b.skuCount > 1 ? 1 : 0;
        if (aMulti !== bMulti) return bMulti - aMulti;
        return b.skuCount - a.skuCount;
      });
    } else if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    else if (sortBy === 'code') list.sort((a, b) => a.code.localeCompare(b.code));
    else if (sortBy === 'sku_desc') list.sort((a, b) => b.skuCount - a.skuCount);
    else if (sortBy === 'stock_desc') {
      list.sort((a, b) => {
        const aProduct = products.get(a.code);
        const bProduct = products.get(b.code);
        const aStock = aProduct && aProduct.stockKnown === true && !aProduct.inquiryOnly ? aProduct.stock : -1;
        const bStock = bProduct && bProduct.stockKnown === true && !bProduct.inquiryOnly ? bProduct.stock : -1;
        return bStock - aStock;
      });
    }
    return list;
  }, [
    families, category?.children, familyResolvedBrands, familyDimensions, selection,
    selectedBrands.join('|'), inStockOnly, imageOnly, specKey, specValue,
    facetToken, beltStructure, beltTopWidth, lenMin, lenMax, dimMin, dimMax,
    orderMode, search, products, sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredFamilies.length / perPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const pageFamilies = filteredFamilies.slice(startIndex, startIndex + perPage);
  const rangeStart = filteredFamilies.length ? startIndex + 1 : 0;
  const rangeEnd = Math.min(filteredFamilies.length, startIndex + pageFamilies.length);
  const paginationTokens = useMemo(
    () => buildPaginationWindow(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const activeFilterCount =
    selectedBrands.length +
    Number(inStockOnly) +
    Number(imageOnly) +
    Number(Boolean(selection)) +
    Number(Boolean(specKey || specValue)) +
    Number(Boolean(facetToken)) +
    Number(Boolean(beltStructure)) +
    Number(Boolean(beltTopWidth)) +
    Number(Boolean(lenMin || lenMax || dimMin || dimMax)) +
    Number(orderMode !== 'all') +
    Number(Boolean(search.trim()));

  const compareFamilies = compareCodes
    .map(code => families.find(family => family.code === code))
    .filter((family): family is MenuFamily => Boolean(family));
  const comparisonSpecs = Array.from(new Set(
    compareFamilies.flatMap(family => {
      const product = products.get(family.code);
      return [
        ...(product?.technicalSpecs || []),
        ...(product?.variants || []).flatMap(variant => variant.technicalSpecs || []),
      ].map(spec => spec.key);
    }),
  )).slice(0, 10);

  const toggleCompare = (code: string) => {
    setCompareNotice('');
    if (compareCodes.includes(code)) {
      setCompareCodes(compareCodes.filter(item => item !== code));
      return;
    }
    if (compareCodes.length >= 4) {
      setCompareNotice('برای مقایسه هم‌زمان حداکثر چهار خانواده را انتخاب کنید.');
      return;
    }
    setCompareCodes([...compareCodes, code]);
  };

  const selectSubcategory = (name: string) => updateParam('sub', name, false);
  const setStockFilter = (checked: boolean) => updateParam('stock', checked ? '1' : '');
  const setImageFilter = (checked: boolean) => updateParam('image', checked ? '1' : '');
  const isSelectedForCompare = (code: string) => compareCodes.includes(code);

  const selectQuickProfile = (profileCode: string) => {
    const active = normalizeSpecValue(specValue) === normalizeSpecValue(profileCode);
    const next = new URLSearchParams(searchParams);
    if (active) {
      next.delete('specValue');
      if (next.get('spec') === 'پروفیل') next.delete('spec');
    } else {
      next.set('specValue', profileCode);
    }
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  if (status === 'loading') {
    return (
      <div className="excel-category-page" dir="rtl">
        <div className="excel-category-state" role="status" aria-live="polite">
          <span className="excel-category-spinner" aria-hidden="true" />
          <h1>در حال دریافت کاتالوگ این دسته</h1>
          <p>خانواده‌ها، زیرگروه‌ها و کدهای ثبت‌شده از پایگاه داده خوانده می‌شوند.</p>
        </div>
      </div>
    );
  }

  if (status === 'error' || !category) {
    return (
      <div className="excel-category-page" dir="rtl">
        <div className="excel-category-shell">
          <nav className="excel-category-breadcrumbs" aria-label="مسیر صفحه">
            <Link to="/">صفحه اصلی</Link><ChevronLeft size={13} /><Link to="/categories">دسته‌بندی‌ها</Link>
          </nav>
          <div className="excel-category-state excel-category-state-error" role="alert">
            <span><Boxes size={26} /></span>
            <h1>اطلاعات این دسته دریافت نشد</h1>
            <p>برای جلوگیری از نمایش اطلاعات قدیمی، فهرست محلی جایگزین داده پایگاه داده نشده است.</p>
            <button type="button" onClick={() => { setStatus('loading'); setRetryCount(value => value + 1); }}>تلاش مجدد</button>
          </div>
        </div>
      </div>
    );
  }

  const resolvedCategory = category!;
  const profile = resolveCategoryProfile(resolvedCategory);
  const artwork = profile.artwork;
  const visibleSubnodes = (resolvedCategory.children || []).filter(node => node.hidden !== true);
  const stripNodes = buildSubcategoryStripNodes(visibleSubnodes, resolvedCategory.name);
  const activeParentNode = visibleSubnodes.find(
    n => n.name === selection || (n.children || []).some(c => c.name === selection),
  );
  const leafFilterNodes = (activeParentNode?.children || visibleSubnodes.flatMap(n => n.children || [])).filter(
    child => child.hidden !== true && families.some(family => matchesSelection(family, child.name, visibleSubnodes)),
  );

  const renderFilterSections = (isSheet = false) => (
    <>
      {availableBrands.length > 0 && (
        <details open className="excel-filter-group">
          <summary>
            <span>برند</span>
            <ChevronDown size={15} className="excel-filter-chevron" />
          </summary>
          <div className="excel-filter-group-body">
            {availableBrands.length > 5 && (
              <div className="excel-filter-inline-search">
                <Search size={14} />
                <input
                  type="search"
                  value={brandQuery}
                  onChange={e => setBrandQuery(e.target.value)}
                  placeholder="جستجوی برند..."
                  aria-label="جستجوی برند"
                  autoComplete="off"
                />
              </div>
            )}

            <div className="excel-filter-checkbox-list">
              {visibleBrandList.length ? visibleBrandList.map(brand => {
                const count = brandCounts.get(brand) || 0;
                const checked = selectedBrands.includes(brand);
                return (
                  <label key={brand} className={`excel-filter-check-row ${checked ? 'is-checked' : ''}`}>
                    <span className="excel-filter-check-main">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={event => updateBrands(
                          event.target.checked
                            ? [...selectedBrands, brand]
                            : selectedBrands.filter(value => value !== brand),
                        )}
                      />
                      <span className="excel-filter-check-title">{brand}</span>
                    </span>
                    {count > 0 && <em className="excel-filter-check-count">({toPersianDigits(count)})</em>}
                  </label>
                );
              }) : (
                <p className="excel-category-filter-muted">برندی با این جستجو ثبت نشده است.</p>
              )}
            </div>

            {availableBrands.length > 5 && !brandQuery && (
              <button
                type="button"
                className="excel-filter-show-more"
                onClick={() => setShowAllBrands(prev => !prev)}
              >
                <span>{showAllBrands ? 'نمایش کمتر' : `نمایش بیشتر (${toPersianDigits(availableBrands.length - 5)})`}</span>
                <ChevronDown size={13} className={showAllBrands ? 'is-rotated' : ''} />
              </button>
            )}
          </div>
        </details>
      )}

      <details open className="excel-filter-group">
        <summary>
          <span>{facetProfile.primaryFacetTitle}</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body">
          {visibleFacetOptions.length > 0 && (
            <>
              <div className="excel-filter-checkbox-list">
                {visibleFacetOptions.map(opt => {
                  const checked = normalizeSpecValue(facetToken) === normalizeSpecValue(opt.value);
                  return (
                    <label key={opt.value} className={`excel-filter-check-row ${checked ? 'is-checked' : ''}`}>
                      <span className="excel-filter-check-main">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => updateParam('facet', checked ? '' : opt.value)}
                        />
                        <span className="excel-filter-check-title">{opt.label}</span>
                      </span>
                      <em className="excel-filter-check-count">({toPersianDigits(opt.count)})</em>
                    </label>
                  );
                })}
              </div>
              {facetProfile.primaryFacetOptions.length > 6 && (
                <button
                  type="button"
                  className="excel-filter-show-more"
                  onClick={() => setShowAllFacets(prev => !prev)}
                >
                  <span>{showAllFacets ? 'نمایش کمتر' : 'نمایش بیشتر'}</span>
                  <ChevronDown size={13} className={showAllFacets ? 'is-rotated' : ''} />
                </button>
              )}
            </>
          )}

          <fieldset className="excel-category-spec-filter">
            <legend>جستجوی دقیق مشخصه یا پروفیل</legend>
            <select aria-label="نوع مشخصه فنی" value={specKey} onChange={event => updateParam('spec', event.target.value)}>
              <option value="">همه مشخصات فنی</option>
              {availableSpecKeys.map(key => <option value={key} key={key}>{key}</option>)}
            </select>
            <input
              type="search"
              aria-label="مقدار پروفیل یا ابعاد"
              value={specValue}
              onChange={event => updateParam('specValue', event.target.value)}
              placeholder={facetProfile.searchPlaceholder}
              autoComplete="off"
            />
          </fieldset>
        </div>
      </details>

      {isVBeltCategory && (
        <details className="excel-filter-group" open={Boolean(beltStructure || beltTopWidth)}>
          <summary>
            <span>ساختار بدنه و عرض مقطع</span>
            <ChevronDown size={15} className="excel-filter-chevron" />
          </summary>
          <div className="excel-filter-group-body">
            <div className="excel-sidebar-chip-stack">
              {VBELT_STRUCTURE_OPTIONS.map(opt => {
                const active = beltStructure === opt.id;
                return (
                  <button
                    key={opt.id || 'all'}
                    type="button"
                    className={`excel-sidebar-chip-btn ${active ? 'is-active' : ''}`}
                    onClick={() => updateParam('structure', active && opt.id ? '' : opt.id)}
                  >
                    <span>{opt.label}</span>
                    {active && <Check size={13} />}
                  </button>
                );
              })}
            </div>
            <div className="excel-sidebar-chip-stack" style={{ marginTop: 8 }}>
              {VBELT_TOP_WIDTH_OPTIONS.map(opt => {
                const active = beltTopWidth === opt.id;
                const count = vbeltWidthCounts.get(opt.id) || 0;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`excel-sidebar-chip-btn ${active ? 'is-active' : ''}`}
                    onClick={() => updateParam('width', active ? '' : opt.id)}
                  >
                    <div>
                      <strong>{opt.label}</strong>
                      <small dir="ltr">{opt.hint}</small>
                    </div>
                    <b className="excel-filter-count-badge">{toPersianDigits(count)}</b>
                  </button>
                );
              })}
            </div>
          </div>
        </details>
      )}

      <details open className="excel-filter-group">
        <summary>
          <span>{facetProfile.dimensionTitle}</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body">
          <div className="excel-dim-range-block">
            <span className="excel-dim-range-label">{facetProfile.primaryDimLabel}</span>
            <div className="excel-dim-range-inputs">
              <input
                type="text"
                inputMode="decimal"
                value={lenMin}
                onChange={e => updateParam('lenMin', e.target.value)}
                placeholder="از"
                aria-label={`حداقل ${facetProfile.primaryDimLabel}`}
              />
              <span>تا</span>
              <input
                type="text"
                inputMode="decimal"
                value={lenMax}
                onChange={e => updateParam('lenMax', e.target.value)}
                placeholder="تا"
                aria-label={`حداکثر ${facetProfile.primaryDimLabel}`}
              />
            </div>
          </div>

          <div className="excel-dim-range-block">
            <span className="excel-dim-range-label">{facetProfile.secondaryDimLabel}</span>
            <div className="excel-dim-range-inputs">
              <input
                type="text"
                inputMode="decimal"
                value={dimMin}
                onChange={e => updateParam('dimMin', e.target.value)}
                placeholder="از"
                aria-label={`حداقل ${facetProfile.secondaryDimLabel}`}
              />
              <span>تا</span>
              <input
                type="text"
                inputMode="decimal"
                value={dimMax}
                onChange={e => updateParam('dimMax', e.target.value)}
                placeholder="تا"
                aria-label={`حداکثر ${facetProfile.secondaryDimLabel}`}
              />
            </div>
          </div>
        </div>
      </details>

      <details open className="excel-filter-group">
        <summary>
          <span>قیمت و تنوع کد</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body">
          <div className="excel-filter-checkbox-list">
            {[
              { id: 'all', label: 'همه محصولات' },
              { id: 'multi_sku', label: 'دارای جدول سایزهای متعدد' },
              { id: 'single_sku', label: 'تک‌کد مستقیم و استاندارد' },
            ].map(opt => (
              <label key={opt.id} className={`excel-filter-check-row ${orderMode === opt.id ? 'is-checked' : ''}`}>
                <span className="excel-filter-check-main">
                  <input
                    type="radio"
                    name={isSheet ? 'orderModeSheet' : 'orderModeDesktop'}
                    checked={orderMode === opt.id}
                    onChange={() => updateParam('orderMode', opt.id === 'all' ? '' : opt.id)}
                  />
                  <span className="excel-filter-check-title">{opt.label}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </details>

      <details open className="excel-filter-group">
        <summary>
          <span>وضعیت موجودی</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body">
          <div className="excel-filter-checkbox-list">
            <label className={`excel-filter-check-row ${inStockOnly ? 'is-checked' : ''}`}>
              <span className="excel-filter-check-main">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={event => setStockFilter(event.target.checked)}
                />
                <span className="excel-filter-check-title">موجود در انبار</span>
              </span>
              <em className="excel-filter-check-count">({toPersianDigits(stockStats.inStock)})</em>
            </label>
            <label className={`excel-filter-check-row ${imageOnly ? 'is-checked' : ''}`}>
              <span className="excel-filter-check-main">
                <input
                  type="checkbox"
                  checked={imageOnly}
                  onChange={event => setImageFilter(event.target.checked)}
                />
                <span className="excel-filter-check-title">دارای تصویر ثبت‌شده</span>
              </span>
              <em className="excel-filter-check-count">({toPersianDigits(stockStats.withImage)})</em>
            </label>
          </div>
        </div>
      </details>
    </>
  );

  return (
    <div className="excel-category-page" dir="rtl">
      <div className="excel-category-shell">
        <nav className="excel-category-breadcrumbs" aria-label="مسیر صفحه">
          <Link to="/">صفحه اصلی</Link>
          <ChevronLeft size={13} />
          <Link to="/categories">دسته‌بندی‌ها</Link>
          <ChevronLeft size={13} />
          <span aria-current="page">{resolvedCategory.name}</span>
        </nav>

        {/* Hero Banner — Clean split right-copy / left-blended photography */}
        <header className="excel-category-hero">
          <div className="excel-category-hero-copy">
            <h1>{resolvedCategory.name}</h1>
            <span className="excel-category-hero-accent-rule" aria-hidden="true" />
            <p>{profile.description}</p>

            <div className="excel-category-hero-features">
              <Link to="/services" className="excel-category-hero-feature-card">
                <span className="excel-feature-icon"><Truck size={18} /></span>
                <span>ارسال سریع و مطمئن</span>
              </Link>
              <Link to="/ai-consult" className="excel-category-hero-feature-card">
                <span className="excel-feature-icon"><Headphones size={18} /></span>
                <span>مشاوره فنی تخصصی</span>
              </Link>
              <Link to="/identify-part" className="excel-category-hero-feature-card excel-feature-identify">
                <span className="excel-feature-icon"><Search size={17} /></span>
                <span>شناسایی قطعه با تصویر</span>
              </Link>
            </div>

            <div className="excel-category-hero-meta-line">
              <span>{toPersianDigits(families.length)} خانواده ثبت‌شده</span>
              <i aria-hidden="true">·</i>
              <span>{toPersianDigits(skuTotal)} کد فنی و سایز</span>
              {availableBrands.length > 0 && (
                <>
                  <i aria-hidden="true">·</i>
                  <span>{toPersianDigits(availableBrands.length)} برند صنعتی</span>
                </>
              )}
            </div>
          </div>

          <div className="excel-category-hero-visual">
            {artwork ? (
              <img src={artwork} alt={resolvedCategory.name} loading="eager" fetchPriority="high" decoding="async" />
            ) : (
              <div className="excel-category-hero-placeholder" aria-hidden="true">
                <Package size={58} />
              </div>
            )}
          </div>
        </header>

        {/* Horizontal 4-Card Subcategory Strip */}
        {stripNodes.length > 0 && (
          <section className="excel-category-subnav" aria-label="انتخاب زیرگروه">
            <div className={`excel-category-subgrid count-${Math.min(4, stripNodes.length)}`}>
              {stripNodes.map(node => {
                const isSelected = node.isAllOption ? !selection : selection === node.name;
                const nodeFamilies = node.isAllOption
                  ? families
                  : families.filter(family => matchesSelection(family, node.name, visibleSubnodes));
                const thumbSrc = node.isAllOption
                  ? artwork
                  : resolveSubcategoryThumb(node.name, resolvedCategory.name, resolvedCategory.slug);

                return (
                  <button
                    key={node.key}
                    type="button"
                    aria-pressed={isSelected}
                    className={`excel-subcard ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => selectSubcategory(node.isAllOption || isSelected ? '' : node.name)}
                  >
                    <div className="excel-subcard-media">
                      <img src={thumbSrc} alt={node.name} loading="lazy" decoding="async" />
                    </div>
                    <div className="excel-subcard-footer">
                      <div className="excel-subcard-titles">
                        <strong>{node.name}</strong>
                        <small>{toPersianDigits(nodeFamilies.length)} خانواده</small>
                      </div>
                      <ChevronLeft size={17} className="excel-subcard-arrow" />
                    </div>
                  </button>
                );
              })}
            </div>

            {leafFilterNodes.length > 0 && (
              <div className="excel-subleaf-strip" aria-label="زیرشاخه‌های دقیق">
                <span>زیرشاخه‌های تخصصی:</span>
                <div className="excel-subleaf-list">
                  {leafFilterNodes.map(child => {
                    const active = selection === child.name;
                    const count = families.filter(family => matchesSelection(family, child.name)).length;
                    return (
                      <button
                        key={child.name}
                        type="button"
                        aria-pressed={active}
                        className={active ? 'is-active' : ''}
                        onClick={() => selectSubcategory(active ? '' : child.name)}
                      >
                        <b>{child.name}</b>
                        <span>{toPersianDigits(count)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Dedicated V-Belt Interactive Cross-Section & Profile Matrix (Collapsible so grid stays front and center) */}
        {isVBeltCategory && (
          <section className="excel-vbelt-matrix" aria-label="انتخابگر مهندسی پروفیل و مقطع وی‌بلت">
            <div className="excel-vbelt-matrix-header">
              <div>
                <span className="excel-vbelt-matrix-eyebrow">
                  <Ruler size={13} /> جدول مهندسی مقاطع استاندارد وی‌بلت (DIN 2215 / DIN 7753)
                </span>
                <h2>انتخاب سریع بر اساس تیپ پروفیل، ساختار دندانه و عرض بالای مقطع</h2>
              </div>
              <div className="excel-vbelt-header-actions">
                {(specValue || beltStructure || beltTopWidth) && (
                  <button
                    type="button"
                    className="excel-vbelt-matrix-reset"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      ['spec', 'specValue', 'structure', 'width', 'page'].forEach(k => next.delete(k));
                      setSearchParams(next, { replace: true });
                    }}
                  >
                    <RotateCcw size={13} /> نمایش همه مقاطع
                  </button>
                )}
                <button
                  type="button"
                  className="excel-vbelt-matrix-toggle"
                  aria-expanded={matrixExpanded}
                  onClick={() => setMatrixExpanded(prev => !prev)}
                >
                  <span>{matrixExpanded ? 'بستن جدول مقاطع' : 'باز کردن جدول مهندسی مقاطع'}</span>
                  <ChevronDown size={14} className={matrixExpanded ? 'is-rotated' : ''} />
                </button>
              </div>
            </div>

            {matrixExpanded && (
              <>
                <div className="excel-vbelt-groups-grid">
                  {VBELT_PROFILE_GROUPS.map(group => (
                    <div key={group.id} className="excel-vbelt-group-card">
                      <div className="excel-vbelt-group-head">
                        <div>
                          <h3>{group.title}</h3>
                          <p>{group.subtitle}</p>
                        </div>
                        <span className="excel-vbelt-standard-tag" dir="ltr">{group.standard}</span>
                      </div>
                      <div className="excel-vbelt-profile-chips" dir="ltr">
                        {group.profiles.map(prof => {
                          const active = normalizeSpecValue(specValue) === normalizeSpecValue(prof.code);
                          const count = vbeltProfileCounts.get(prof.code) || 0;
                          return (
                            <button
                              key={prof.code}
                              type="button"
                              className={`excel-vbelt-profile-btn ${active ? 'is-active' : ''}`}
                              aria-pressed={active}
                              onClick={() => selectQuickProfile(prof.code)}
                            >
                              <div className="excel-vbelt-profile-top">
                                <strong>{prof.code}</strong>
                                {count > 0 && <em>{toPersianDigits(count)}</em>}
                              </div>
                              <small>{prof.widthMm}×{prof.heightMm} mm</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="excel-vbelt-facets-bar">
                  <div className="excel-vbelt-facet-group">
                    <span className="excel-vbelt-facet-label">ساختار بدنه:</span>
                    <div className="excel-vbelt-facet-pills">
                      {VBELT_STRUCTURE_OPTIONS.map(opt => {
                        const active = beltStructure === opt.id;
                        return (
                          <button
                            key={opt.id || 'all'}
                            type="button"
                            className={active ? 'is-active' : ''}
                            aria-pressed={active}
                            onClick={() => updateParam('structure', active && opt.id ? '' : opt.id)}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="excel-vbelt-facet-group">
                    <span className="excel-vbelt-facet-label">عرض بالای مقطع (Top Width):</span>
                    <div className="excel-vbelt-facet-pills">
                      {VBELT_TOP_WIDTH_OPTIONS.map(opt => {
                        const active = beltTopWidth === opt.id;
                        const count = vbeltWidthCounts.get(opt.id) || 0;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={active ? 'is-active' : ''}
                            aria-pressed={active}
                            onClick={() => updateParam('width', active ? '' : opt.id)}
                          >
                            <span>{opt.label}</span>
                            <small dir="ltr">({opt.hint})</small>
                            {count > 0 && <b>{toPersianDigits(count)}</b>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* 2-Column Catalog Workspace: Right Sticky Filter Sidebar + Left Toolbar & 4-Col Grid */}
        <div className="excel-category-shop">
          <aside className="excel-category-filter-panel" aria-label="فیلتر محصولات">
            <div className="excel-category-filter-heading">
              <div><SlidersHorizontal size={17} /><strong>فیلتر محصولات</strong></div>
              <button type="button" onClick={clearFilters} aria-label="پاک کردن فیلترها" title="پاک کردن فیلترها">
                <RotateCcw size={14} />
              </button>
            </div>

            <div className="excel-filter-sections">
              {renderFilterSections(false)}
            </div>

            <div className="excel-category-filter-actions">
              <a href="#excel-category-products" className="is-apply-link">
                اعمال فیلترها ({toPersianDigits(filteredFamilies.length)})
              </a>
              <button type="button" className="is-clear" onClick={clearFilters}>
                پاک کردن همه فیلترها
              </button>
            </div>

            <div className="excel-category-filter-footnote">
              <ShieldCheck size={14} />
              <span>موجودی و مشخصات مستقیماً از کاتالوگ واقعی پایگاه داده خوانده می‌شود.</span>
            </div>
          </aside>

          <section className="excel-category-results" id="excel-category-products" aria-label="فهرست محصولات و خانواده‌ها">
            {/* Top Toolbar Matching Mockup */}
            <div className="excel-category-toolbar">
              <div className="excel-toolbar-controls-right">
                <label className="excel-toolbar-select-group">
                  <span>نمایش</span>
                  <select
                    aria-label="تعداد نمایش در هر صفحه"
                    value={String(perPage)}
                    onChange={event => updateParam('perPage', event.target.value === String(DEFAULT_PAGE_SIZE) ? '' : event.target.value)}
                  >
                    <option value="12">۱۲ کالا</option>
                    <option value="24">۲۴ کالا</option>
                    <option value="48">۴۸ کالا</option>
                  </select>
                </label>

                <label className="excel-toolbar-select-group">
                  <span>مرتب‌سازی:</span>
                  <select
                    aria-label="مرتب‌سازی محصولات"
                    value={sortBy}
                    onChange={event => updateParam('sort', event.target.value === 'default' ? '' : event.target.value)}
                  >
                    <option value="default">پرفروش‌ترین / منتخب</option>
                    <option value="sku_desc">بیشترین تنوع سایز و کد</option>
                    <option value="name">نام خانواده (الفبا)</option>
                    <option value="code">کد فنی</option>
                    <option value="stock_desc">موجودی تأییدشده</option>
                  </select>
                </label>

                <label className="excel-toolbar-search">
                  <Search size={15} />
                  <input
                    type="search"
                    value={search}
                    onChange={event => updateParam('q', event.target.value)}
                    placeholder={facetProfile.searchPlaceholder}
                    aria-label="جستجو در محصولات این دسته"
                    autoComplete="off"
                  />
                  {search && (
                    <button type="button" onClick={() => updateParam('q', '')} aria-label="پاک کردن جستجو">
                      <X size={13} />
                    </button>
                  )}
                </label>
              </div>

              <div className="excel-toolbar-controls-left">
                <button type="button" className="excel-category-mobile-filter" onClick={() => setMobileFiltersOpen(true)}>
                  <SlidersHorizontal size={15} />
                  <span>فیلتر محصولات</span>
                  {activeFilterCount > 0 && <b>{toPersianDigits(activeFilterCount)}</b>}
                </button>

                <div className="excel-view-switcher" role="group" aria-label="حالت نمایش">
                  <button
                    type="button"
                    className={viewMode === 'list' ? 'is-active' : ''}
                    aria-pressed={viewMode === 'list'}
                    aria-label="نمایش لیستی"
                    onClick={() => updateParam('view', 'list')}
                  >
                    <List size={16} />
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'grid' ? 'is-active' : ''}
                    aria-pressed={viewMode === 'grid'}
                    aria-label="نمایش شبکه‌ای"
                    onClick={() => updateParam('view', '')}
                  >
                    <LayoutGrid size={16} />
                  </button>
                </div>

                <span className="excel-toolbar-counter">
                  نمایش {toPersianDigits(rangeStart)} تا {toPersianDigits(rangeEnd)} از {toPersianDigits(filteredFamilies.length)} محصول
                </span>
              </div>
            </div>

            <DirectSkuProducts categorySlug={slug} selectedSub={selection || 'all'} />

            {activeFilterCount > 0 && (
              <div className="excel-category-active-filters" aria-label="فیلترهای فعال">
                <b>فیلترهای فعال:</b>
                {selection && (
                  <button type="button" onClick={() => selectSubcategory('')}>
                    زیرگروه: {selection} <X size={12} />
                  </button>
                )}
                {selectedBrands.map(brand => (
                  <button
                    type="button"
                    key={brand}
                    onClick={() => updateBrands(selectedBrands.filter(b => b !== brand))}
                  >
                    برند: {brand} <X size={12} />
                  </button>
                ))}
                {facetToken && (
                  <button type="button" onClick={() => updateParam('facet', '')}>
                    {facetProfile.primaryFacetTitle}: {facetToken} <X size={12} />
                  </button>
                )}
                {(specKey || specValue) && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.delete('spec');
                      next.delete('specValue');
                      next.delete('page');
                      setSearchParams(next, { replace: true });
                    }}
                  >
                    مشخصه: {specKey || ''} {specValue} <X size={12} />
                  </button>
                )}
                {(lenMin || lenMax || dimMin || dimMax) && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      ['lenMin', 'lenMax', 'dimMin', 'dimMax', 'page'].forEach(k => next.delete(k));
                      setSearchParams(next, { replace: true });
                    }}
                  >
                    محدوده ابعاد <X size={12} />
                  </button>
                )}
                {beltStructure && (
                  <button type="button" onClick={() => updateParam('structure', '')}>
                    ساختار: {VBELT_STRUCTURE_OPTIONS.find(o => o.id === beltStructure)?.label || beltStructure} <X size={12} />
                  </button>
                )}
                {beltTopWidth && (
                  <button type="button" onClick={() => updateParam('width', '')}>
                    عرض مقطع: {beltTopWidth} میلی‌متر <X size={12} />
                  </button>
                )}
                {orderMode !== 'all' && (
                  <button type="button" onClick={() => updateParam('orderMode', '')}>
                    تنوع کد: {orderMode === 'multi_sku' ? 'چند کد' : 'تک کد'} <X size={12} />
                  </button>
                )}
                {imageOnly && (
                  <button type="button" onClick={() => setImageFilter(false)}>
                    دارای تصویر <X size={12} />
                  </button>
                )}
                {inStockOnly && (
                  <button type="button" onClick={() => setStockFilter(false)}>
                    موجودی تأییدشده <X size={12} />
                  </button>
                )}
                {search && (
                  <button type="button" onClick={() => updateParam('q', '')}>
                    جستجو: {search} <X size={12} />
                  </button>
                )}
                <button type="button" className="is-reset" onClick={clearFilters}>
                  حذف همه فیلترها
                </button>
              </div>
            )}

            {filteredFamilies.length === 0 ? (
              <div className="excel-category-empty">
                <span><Search size={24} /></span>
                <h3>محصولی با این مشخصات پیدا نشد</h3>
                <p>زیرگروه یا فیلترهای کناری را تغییر دهید. اگر قطعه در کاتالوگ نیست، می‌توانید برای تأمین یا ساخت آن درخواست مشاوره بفرستید.</p>
                <div>
                  <button type="button" onClick={clearFilters}>پاک کردن فیلترها</button>
                  <Link to="/ai-consult">درخواست مشاوره تخصصی <ArrowLeft size={14} /></Link>
                </div>
              </div>
            ) : (
              <div className={`excel-category-product-grid ${viewMode === 'list' ? 'is-list' : ''}`}>
                {pageFamilies.map(family => {
                  const product = products.get(family.code);
                  const previewImage = productPreviewImage(product);
                  const resolvedBrand = familyResolvedBrands.get(family.code) || resolveDisplayBrand(family.brand, family.name);
                  const fallbackSiteImage = resolveSiteFallbackByText([
                    family.name,
                    family.submenu || '',
                    family.leaf || '',
                    resolvedCategory.name,
                  ].join(' '), family.code) || artwork;

                  const cardProduct = product ? {
                    ...product,
                    code: family.code,
                    name: family.name || product.name,
                    brand: resolvedBrand,
                    submenu: family.submenu || product.submenu,
                    subcategory: family.leaf || resolvedCategory.name || product.subcategory,
                    image: product.image || previewImage || fallbackSiteImage,
                    images: product.images?.some(Boolean) ? product.images : previewImage ? [previewImage] : [],
                  } : undefined;

                  const selected = isSelectedForCompare(family.code);
                  const compareControl = (
                    <label className={`excel-card-compare-check ${selected ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCompare(family.code)}
                        aria-label={`مقایسه ${family.name}`}
                      />
                      <span>مقایسه</span>
                    </label>
                  );

                  return (
                    <div className="excel-category-product-shell" key={family.code}>
                      {cardProduct ? (
                        <ProductCard product={cardProduct}
                          variant={viewMode === 'list' ? 'excel-list' : 'excel-grid'}
                          compareControl={compareControl}
                        />
                      ) : (
                        <article className={`excel-card ${viewMode === 'list' ? 'is-list' : ''}`}>
                          <div className="excel-card-media">
                            <Link to={'/product/' + encodeURIComponent(family.code)} aria-label={family.name}>
                              <ProductImage
                                src={fallbackSiteImage}
                                alt={family.name}
                                loading="lazy"
                                decoding="async"
                              />
                            </Link>
                          </div>
                          <div className="excel-card-body">
                            <Link to={'/product/' + encodeURIComponent(family.code)} className="excel-card-title">
                              {family.name}
                            </Link>
                            <div className="excel-card-specs">
                              <span className="excel-card-spec-item">
                                <em>برند:</em> <b>{resolvedBrand}</b>
                              </span>
                              <span className="excel-card-spec-sep" aria-hidden="true">|</span>
                              <span className="excel-card-spec-item">
                                <em>تنوع:</em> <b>{toPersianDigits(family.skuCount)} کد فنی</b>
                              </span>
                            </div>
                            <div className="excel-card-status-block">
                              <span className="excel-card-stock is-supply">
                                <i aria-hidden="true" />
                                آماده تأمین
                              </span>
                              <span className="excel-card-price">استعلام قیمت</span>
                            </div>
                            <Link to={'/product/' + encodeURIComponent(family.code)} className="excel-card-cta">
                              <ShoppingCart size={15} />
                              <span>مشاهده و سفارش</span>
                            </Link>
                            <div className="excel-card-footer">
                              <span className="excel-card-meta-brand" dir="ltr">
                                {resolvedBrand} · {family.code}
                              </span>
                              {compareControl}
                            </div>
                          </div>
                        </article>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <nav className="excel-category-pagination" aria-label="صفحه‌بندی محصولات">
                <button
                  type="button"
                  className="excel-page-arrow"
                  disabled={currentPage <= 1}
                  aria-label="صفحه قبلی"
                  onClick={() => updateParam('page', String(currentPage - 1), false)}
                >
                  <ChevronRight size={15} />
                </button>

                {paginationTokens.map((token, idx) => (
                  token === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="excel-page-ellipsis" aria-hidden="true">…</span>
                  ) : (
                    <button
                      key={token}
                      type="button"
                      className={`excel-page-num ${token === currentPage ? 'is-active' : ''}`}
                      aria-current={token === currentPage ? 'page' : undefined}
                      onClick={() => updateParam('page', String(token), false)}
                    >
                      {toPersianDigits(token)}
                    </button>
                  )
                ))}

                <button
                  type="button"
                  className="excel-page-arrow"
                  disabled={currentPage >= totalPages}
                  aria-label="صفحه بعدی"
                  onClick={() => updateParam('page', String(currentPage + 1), false)}
                >
                  <ChevronLeft size={15} />
                </button>
              </nav>
            )}
          </section>
        </div>
      </div>

      {compareCodes.length > 0 && (
        <div className="excel-category-compare-dock" role="region" aria-label="نوار مقایسه محصولات">
          <div>
            <strong>مقایسه خانواده‌ها <span>{toPersianDigits(compareCodes.length)}/۴</span></strong>
            <small>{compareFamilies.map(family => family.name).join('، ')}</small>
            {compareNotice && <small className="excel-category-compare-notice" role="status">{compareNotice}</small>}
          </div>
          <div>
            <button type="button" className="excel-category-compare-clear" onClick={() => { setCompareCodes([]); setCompareNotice(''); }}>پاک کردن</button>
            <button type="button" className="excel-category-compare-open" disabled={compareFamilies.length < 2} onClick={() => setComparisonOpen(true)}>
              مقایسه {toPersianDigits(compareFamilies.length)} مورد <ArrowLeftRight size={15} />
            </button>
          </div>
        </div>
      )}

      {mobileFiltersOpen && (
        <div className="excel-category-modal-backdrop" onMouseDown={() => setMobileFiltersOpen(false)}>
          <section className="excel-category-filter-sheet" role="dialog" aria-modal="true" aria-label="فیلترهای دسته‌بندی"
            ref={modalRootRef} onMouseDown={event => event.stopPropagation()}>
            <header>
              <strong>فیلتر محصولات — {resolvedCategory.name}</strong>
              <button ref={modalCloseRef} type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="بستن فیلترها"><X size={19} /></button>
            </header>
            <div className="excel-category-filter-sheet-content">
              {renderFilterSections(true)}
            </div>
            <footer>
              <button type="button" onClick={clearFilters}>پاک کردن فیلترها</button>
              <button type="button" onClick={() => setMobileFiltersOpen(false)}>
                نمایش {toPersianDigits(filteredFamilies.length)} نتیجه
              </button>
            </footer>
          </section>
        </div>
      )}

      {comparisonOpen && compareFamilies.length > 1 && (
        <div className="excel-category-modal-backdrop excel-category-compare-backdrop" onMouseDown={() => setComparisonOpen(false)}>
          <section className="excel-category-compare-dialog" role="dialog" aria-modal="true" aria-labelledby="excel-category-compare-title"
            ref={modalRootRef} onMouseDown={event => event.stopPropagation()}>
            <header>
              <div><span>مقایسه فنی</span><h2 id="excel-category-compare-title">مقایسه خانواده‌های انتخاب‌شده</h2></div>
              <button ref={modalCloseRef} type="button" onClick={() => setComparisonOpen(false)} aria-label="بستن مقایسه"><X size={19} /></button>
            </header>
            <div className="excel-category-compare-table-wrap">
              <table>
                <thead><tr><th>مشخصه</th>{compareFamilies.map(family => <th key={family.code}>{family.name}<code dir="ltr">{family.code}</code></th>)}</tr></thead>
                <tbody>
                  <tr><th>برند</th>{compareFamilies.map(family => <td key={family.code}>{familyResolvedBrands.get(family.code) || family.brand || '—'}</td>)}</tr>
                  <tr><th>زیرگروه</th>{compareFamilies.map(family => <td key={family.code}>{family.leaf || family.submenu || '—'}</td>)}</tr>
                  <tr><th>تعداد کد و سایز</th>{compareFamilies.map(family => <td key={family.code}>{toPersianDigits(family.skuCount)}</td>)}</tr>
                  {comparisonSpecs.map(specKey => <tr key={specKey}><th>{specKey}</th>{compareFamilies.map(family => {
                    const product = products.get(family.code);
                    const values = [
                      ...(product?.technicalSpecs || []),
                      ...(product?.variants || []).flatMap(variant => variant.technicalSpecs || []),
                    ].filter(spec => spec.key === specKey).map(spec => spec.value).filter(Boolean);
                    const value = Array.from(new Set(values)).join('، ') || '—';
                    return <td key={family.code}>{value}</td>;
                  })}</tr>)}
                </tbody>
              </table>
            </div>
            <footer><span>قیمت و اطلاعات موجودی بر اساس سطح دسترسی حساب مشتری نمایش داده می‌شود.</span><button type="button" onClick={() => setComparisonOpen(false)}>بستن مقایسه</button></footer>
          </section>
        </div>
      )}
    </div>
  );
};
