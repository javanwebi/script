/** Stable Persian SEO URLs for the approved industrial catalogue categories.
 * Internal Excel IDs remain unchanged; only public storefront URLs use these slugs.
 */
export const SANAT_PISH_CANONICAL_ORIGIN = 'https://sanatpish.com';

export type ApprovedCategorySeoRoute = { categorySlug: string; routeSlug: string; title: string; description: string };

export const APPROVED_CATEGORY_SEO_ROUTES: readonly ApprovedCategorySeoRoute[] = [
  { categorySlug: 'excel-v2-1-1', routeSlug: 'تسمه-تایمینگ-صنعتی', title: 'تسمه تایمینگ صنعتی', description: 'تسمه تایمینگ صنعتی را بر اساس پروفیل، گام دندانه، عرض و طول بررسی کنید و مشخصات فنی مناسب برای سیستم انتقال نیرو را مقایسه کنید.' },
  { categorySlug: 'excel-v2-1-2', routeSlug: 'تسمه-وی-بلت-صنعتی', title: 'تسمه وی‌بلت صنعتی', description: 'تسمه وی‌بلت صنعتی را با توجه به پروفیل، عرض، طول مؤثر و شرایط کاری بررسی کنید و برای تطبیق دقیق با دستگاه، مشخصات فنی را مقایسه کنید.' },
  { categorySlug: 'excel-v2-1-3', routeSlug: 'تسمه-جوشی-صنعتی', title: 'تسمه جوشی صنعتی', description: 'تسمه‌های جوشی صنعتی را بر اساس ساختار، ابعاد، نوع اتصال و شرایط نصب بررسی کنید و برای شناسایی قطعه سازگار با خط تولید راهنمایی بگیرید.' },
  { categorySlug: 'excel-v2-1-4', routeSlug: 'تسمه-بارکش-صنعتی', title: 'تسمه بارکش صنعتی', description: 'تسمه‌ها و تجهیزات بارکش را بر اساس نوع اتصال، ابعاد، جنس و شرایط انتقال مواد بررسی کنید و قطعه متناسب با خط تولید را انتخاب کنید.' },
  { categorySlug: 'excel-v2-2-1', routeSlug: 'نوار-نقاله-صنعتی', title: 'نوار نقاله صنعتی', description: 'نوار نقاله صنعتی را بر اساس جنس، عرض، ضخامت، ساختار و شرایط حمل مواد بررسی کنید و مشخصات فنی گزینه‌های مناسب خط تولید را مقایسه کنید.' },
  { categorySlug: 'excel-v2-2-2', routeSlug: 'خدمات-نوار-نقاله', title: 'خدمات نوار نقاله', description: 'خدمات مرتبط با نوار نقاله صنعتی را برای بررسی، نگهداری و انتخاب قطعات خطوط انتقال مواد دنبال کنید و برای هماهنگی فنی با صنعت پیش تماس بگیرید.' },
  { categorySlug: 'excel-v2-3-1', routeSlug: 'روکش-رولر-و-غلتک-صنعتی', title: 'روکش رولر و غلتک صنعتی', description: 'روکش رولر و غلتک را با توجه به جنس، قطر، طول، سختی و شرایط تماس بررسی کنید تا با نیاز خط تولید و سطح کار سازگار باشد.' },
  { categorySlug: 'excel-v2-3-2', routeSlug: 'قطعات-رولر-صنعتی', title: 'قطعات رولر صنعتی', description: 'قطعات رولر صنعتی و اجزای مرتبط را بر اساس ابعاد، محل نصب و ساختار دستگاه بررسی کنید و برای تطبیق کد کالا و قطعه جایگزین مشاوره بگیرید.' },
  { categorySlug: 'excel-v2-3-3', routeSlug: 'متعلقات-نگهدارنده-رولر', title: 'متعلقات نگهدارنده رولر', description: 'متعلقات نگهدارنده رولر را با توجه به نوع رولر، ابعاد اتصال و شرایط نصب بررسی کنید تا قطعات پشتیبان با مجموعه دستگاه سازگار باشند.' },
  { categorySlug: 'excel-v2-4-1', routeSlug: 'پولی-تایمینگ-صنعتی', title: 'پولی تایمینگ صنعتی', description: 'پولی تایمینگ صنعتی را بر اساس تعداد دندانه، گام، عرض تسمه، قطر و نوع اتصال بررسی کنید و آن را با تسمه و سیستم انتقال نیرو تطبیق دهید.' },
  { categorySlug: 'excel-v2-5-1', routeSlug: 'برس-سیمی-صنعتی', title: 'برس سیمی صنعتی', description: 'برس سیمی صنعتی را با توجه به قطر، نوع سیم، تراکم، شکل برس و کاربرد تمیزکاری یا پرداخت بررسی و مشخصات مدل مناسب را مقایسه کنید.' },
  { categorySlug: 'excel-v2-5-2', routeSlug: 'برس-خشک-کن-صنعتی', title: 'برس خشک‌کن صنعتی', description: 'برس خشک‌کن صنعتی را بر اساس نوع الیاف، قطر، طول و شرایط خط بررسی کنید و ابعاد و کاربرد برس را با دستگاه خود تطبیق دهید.' },
  { categorySlug: 'excel-v2-6-1', routeSlug: 'ریل-راهنمای-صنعتی', title: 'ریل راهنمای صنعتی', description: 'ریل راهنمای صنعتی را بر اساس طول، مقطع، ظرفیت بار و نوع حرکت بررسی کنید و مشخصات فنی مناسب برای تجهیزات و ماشین‌آلات را مقایسه کنید.' },
  { categorySlug: 'excel-v2-6-2', routeSlug: 'گاید-راهنمای-صنعتی', title: 'گاید راهنمای صنعتی', description: 'گایدهای راهنمای صنعتی را با توجه به پروفیل، جنس، ابعاد و شرایط حرکت بررسی کنید تا قطعه با مجموعه مکانیکی دستگاه سازگار باشد.' },
  { categorySlug: 'excel-v2-6-3', routeSlug: 'پروفیل-و-پایه-هدایت-صنعتی', title: 'پروفیل و پایه هدایت صنعتی', description: 'پروفیل و پایه هدایت صنعتی را بر اساس ابعاد مقطع، نوع اتصال، جنس و محل نصب بررسی کنید و اجزای مناسب مسیر هدایت دستگاه را انتخاب کنید.' },
  { categorySlug: 'excel-v2-6-4', routeSlug: 'سنسور-و-نگهدارنده-صنعتی', title: 'سنسور و نگهدارنده صنعتی', description: 'سنسورها و نگهدارنده‌های صنعتی را با توجه به نوع حسگر، ابعاد، محل نصب و سازگاری اتصالات بررسی کنید و قطعه متناسب با خط را انتخاب کنید.' },
  { categorySlug: 'excel-v2-7-1', routeSlug: 'قطعات-لاستیکی-صنعتی', title: 'قطعات لاستیکی صنعتی', description: 'قطعات لاستیکی صنعتی را بر اساس نوع الاستومر، سختی، ابعاد و شرایط دما و تماس بررسی کنید و مشخصات قطعه جایگزین را با کاربرد تطبیق دهید.' },
  { categorySlug: 'excel-v2-7-2', routeSlug: 'اورینگ-و-آببند-صنعتی', title: 'اورینگ و آب‌بند صنعتی', description: 'اورینگ و آب‌بند صنعتی را بر اساس جنس، قطر داخلی، ضخامت و سیال کاری انتخاب کنید و سازگاری شیمیایی و دمای عملکرد را بررسی کنید.' },
  { categorySlug: 'excel-v2-7-3', routeSlug: 'ضربه-گیر-و-مکنده-صنعتی', title: 'ضربه‌گیر و مکنده صنعتی', description: 'ضربه‌گیر و مکنده صنعتی را بر اساس جنس، ابعاد، سختی و فشار کاری بررسی کنید و مشخصات نصب و عملکرد قطعه را با دستگاه تطبیق دهید.' },
  { categorySlug: 'excel-v2-8-1', routeSlug: 'نوار-برزنتی-نسوز-چند-لایه', title: 'نوار برزنتی نسوز چندلایه', description: 'نوار برزنتی نسوز چندلایه را با توجه به ساختار لایه‌ها، ضخامت، عرض و دمای کار بررسی کنید و مشخصات موردنیاز خط تولید را تطبیق دهید.' },
  { categorySlug: 'excel-v2-8-2', routeSlug: 'نخ-و-عایق-نسوز-صنعتی', title: 'نخ و عایق نسوز صنعتی', description: 'نخ و عایق نسوز صنعتی را بر اساس جنس، قطر، ساختار و محدوده دمایی بررسی کنید و گزینه متناسب با شرایط حرارتی دستگاه را انتخاب کنید.' },
  { categorySlug: 'excel-v2-9-1', routeSlug: 'زنجیر-صنعتی', title: 'زنجیر صنعتی', description: 'زنجیر صنعتی را با توجه به گام، عرض، نوع اتصال، بار و شرایط روانکاری بررسی کنید و مشخصات زنجیر سازگار با سیستم انتقال را مقایسه کنید.' },
  { categorySlug: 'excel-v2-9-2', routeSlug: 'قطعات-پمپ-صنعتی', title: 'قطعات پمپ صنعتی', description: 'قطعات پمپ صنعتی را بر اساس مدل پمپ، نوع سیال، ابعاد و شرایط فشار و دما بررسی کنید و کد و مشخصات قطعه جایگزین را تطبیق دهید.' },
  { categorySlug: 'excel-v2-9-3', routeSlug: 'یراق-آلات-و-قطعات-مکانیکی', title: 'یراق‌آلات و قطعات مکانیکی', description: 'یراق‌آلات و قطعات مکانیکی صنعتی را بر اساس کاربرد، ابعاد، جنس و نوع اتصال بررسی کنید و اجزای سازگار با مجموعه مکانیکی دستگاه را بیابید.' },
  { categorySlug: 'excel-v2-9-4', routeSlug: 'چرخ-صنعتی', title: 'چرخ صنعتی', description: 'چرخ صنعتی را بر اساس قطر، جنس رویه، ظرفیت بار، نوع بلبرینگ و سطح حرکت بررسی کنید تا گزینه مناسب تجهیزات و جابه‌جایی را انتخاب کنید.' },
  { categorySlug: 'excel-v2-10-1', routeSlug: 'قطعات-دستگاه-چاپ-صنعتی', title: 'قطعات دستگاه چاپ صنعتی', description: 'قطعات دستگاه چاپ صنعتی را بر اساس مدل دستگاه، محل نصب، ابعاد و کد فنی بررسی کنید و برای شناسایی و تأمین قطعه موردنیاز اقدام کنید.' },
  { categorySlug: 'excel-v2-10-2', routeSlug: 'تجهیزات-روتاری-صنعتی', title: 'تجهیزات روتاری صنعتی', description: 'تجهیزات روتاری صنعتی را بر اساس مدل دستگاه، ساختار مکانیکی، ابعاد و شرایط کار بررسی کنید و قطعات مرتبط را برای تطبیق فنی شناسایی کنید.' },
  { categorySlug: 'excel-v2-11-1', routeSlug: 'توری-مش-صنعتی', title: 'توری مش صنعتی', description: 'توری مش صنعتی را بر اساس جنس مفتول، اندازه چشمه، قطر سیم، ابعاد و شرایط کاری بررسی کنید و مشخصات مناسب فیلتراسیون یا جداسازی را انتخاب کنید.' },
  { categorySlug: 'excel-v2-12-1', routeSlug: 'ساخت-قطعات-صنعتی-سفارشی', title: 'ساخت قطعات صنعتی سفارشی', description: 'برای ساخت قطعات صنعتی سفارشی، نقشه، نمونه، ابعاد و شرایط کاری را ارائه کنید تا امکان ساخت، انتخاب مواد و مهندسی معکوس بررسی شود.' },
  { categorySlug: 'excel-v2-13-1', routeSlug: 'بلبرینگ-صنعتی', title: 'بلبرینگ صنعتی', description: 'بلبرینگ صنعتی را بر اساس کد، ابعاد، نوع بار، سرعت و آب‌بندی بررسی کنید و برای انتخاب مدل جایگزین، مشخصات و شرایط کاری را مقایسه کنید.' },
  { categorySlug: 'excel-v2-13-2', routeSlug: 'یاتاقان-و-متعلقات-صنعتی', title: 'یاتاقان و متعلقات صنعتی', description: 'یاتاقان و متعلقات صنعتی را با توجه به قطر شفت، نوع بار، ابعاد پایه و شرایط نصب بررسی کنید و مجموعه مناسب پشتیبانی محور را انتخاب کنید.' },
  { categorySlug: 'excel-v2-14-1', routeSlug: 'ابر-اسفنجی-صنعتی', title: 'ابر اسفنجی صنعتی', description: 'ابر و اسفنج صنعتی را بر اساس چگالی، ضخامت، ابعاد و انعطاف بررسی کنید و مشخصات متناسب با کاربرد ضربه‌گیری، آب‌بندی یا بسته‌بندی را بیابید.' },
  { categorySlug: 'excel-v2-14-2', routeSlug: 'نوار-اسفنجی-صنعتی', title: 'نوار اسفنجی صنعتی', description: 'نوار اسفنجی صنعتی را بر اساس جنس، عرض، ضخامت، چسب‌دار بودن و میزان فشردگی بررسی کنید و گزینه مناسب درزگیری یا آب‌بندی را انتخاب کنید.' },
  { categorySlug: 'excel-v2-14-3', routeSlug: 'اسکاج-صنعتی', title: 'اسکاج صنعتی', description: 'اسکاج صنعتی را بر اساس جنس الیاف، زبری، ابعاد و کاربرد تمیزکاری انتخاب کنید و مدل متناسب با سطح و شرایط استفاده را بررسی کنید.' },
] as const;

/** Old public category parents retained only as 301 redirect sources. */
export const LEGACY_CATEGORY_ROUTE_GROUPS: Readonly<Record<string, string | null>> = {
  'excel-v2-1': 'excel-v2-1',
  'excel-v2-2': 'excel-v2-2',
  'excel-v2-3': 'excel-v2-3',
  'excel-v2-4': 'excel-v2-4',
  'excel-v2-5': 'excel-v2-5',
  'excel-v2-6': 'excel-v2-6',
  'excel-v2-7': 'excel-v2-7',
  'excel-v2-8': 'excel-v2-8',
  'excel-v2-9': 'excel-v2-9',
  'excel-v2-10': 'excel-v2-10',
  'excel-v2-11': 'excel-v2-11',
  'excel-v2-12': 'excel-v2-12',
  'excel-v2-13': 'excel-v2-13',
  'excel-v2-14': 'excel-v2-14',
  'jjjjjjj': null,
  'آب-بندی-و-درزگیری': null,
  'آب-بندی-و-قطعات-لاستیکی': 'excel-v2-7',
  'ابزار-و-ملزومات': null,
  'اتصالات-و-نگهدارنده': null,
  'اقلام-نیازمند-شناسایی': null,
  'انتقال-قدرت-مکانیکی': null,
  'برس-و-ابزار-پرداخت': 'excel-v2-5',
  'بلبرینگ-و-یاتاقان': 'excel-v2-13',
  'پولی-و-انتقال-نیرو': 'excel-v2-4',
  'تجهیزات-تولید': null,
  'تجهیزات-خطوط-کاشی-و-سرامیک': 'excel-v2-10',
  'تجهیزات-وکیوم': null,
  'تسمه-و-انتقال-نیرو': 'excel-v2-1',
  'تسمه-و-انتقال-قدرت': 'excel-v2-1',
  'تیغه-و-ابزار-برش': null,
  'چرخ-و-رولر': null,
  'ریل-و-تجهیزات-هدایت': 'excel-v2-6',
  'زنجیر-و-چرخ-زنجیر': 'excel-v2-9',
  'سیلندر-و-قطعات-پنوماتیک': null,
  'شیلنگ-و-اتصالات': null,
  'ضربه-گیر-و-لرزه-گیر': null,
  'فیلتراسیون-و-توری': 'excel-v2-11',
  'قطعات-الکتریکی': null,
  'قطعات-پمپ-و-سیالات': 'excel-v2-9',
  'قطعات-تولید-و-قالب': 'excel-v2-12',
  'قطعات-مکانیکی': 'excel-v2-9',
  'محور-و-شفت': null,
  'مواد-و-ملزومات-صنعتی': null,
  'مواد-و-ورق-صنعتی': null,
  'نوار-و-تسمه-نقاله': 'excel-v2-2',
  'production-fittings': null,
  'industrial-valves': null,
  'pipes-flanges': null,
  'belts-power-transmission': 'excel-v2-1',
  'industrial-belts': 'excel-v2-1',
  'power-transmission': 'excel-v2-1',
  'belts-timing': 'excel-v2-1',
  'v-belts': 'excel-v2-1',
  'timing-belts': 'excel-v2-1',
  'conveyors-industrial-chains': 'excel-v2-2',
  'chains-sprockets': 'excel-v2-9',
  'mechanical-motion-parts': 'excel-v2-9',
  'bearings-bushings': 'excel-v2-13',
  'bearings': 'excel-v2-13',
  'wheels-rollers-guides': null,
  'rollers-wheels-gears': null,
  'rubber-seals-dampers': 'excel-v2-7',
  'rubber-pu-suction': 'excel-v2-7',
  'polymers-industrial-sheets': null,
  'polymer-teflon-parts': null,
  'pumps-fluids-pneumatics': 'excel-v2-9',
  'pumps-valves-mechanical': 'excel-v2-9',
  'impellers-pumps': 'excel-v2-9',
  'production-ceramic-equipment': 'excel-v2-10',
  'kiln-roller-pins': 'excel-v2-10',
  'stacker-conveyor-parts': 'excel-v2-10',
  'brushes-filtration-tools': 'excel-v2-5',
  'industrial-brushes': 'excel-v2-5',
  'glaze-brushes': 'excel-v2-5',
  'industrial-fasteners-accessories': null,
  'supports-brackets': null,
  'pulleys-idlers': 'excel-v2-4',
  'couplings-elastomers': null,
  'profiles-rails-supports': 'excel-v2-6',
  'profiles-rails': 'excel-v2-6',
  'hoses-channels': null,
  'vacuum-cleaners': null,
  'seals-foam-refractory': null,
  'آب‌بندی-و-قطعات-لاستیکی': 'excel-v2-7',
};



/** Search metadata for one approved category, keyed by its stable internal ID or public Persian slug. */
export const getCategorySeoMetadata = (categorySlugOrRouteSlug: string) => {
  const value = String(categorySlugOrRouteSlug || '').trim();
  return APPROVED_CATEGORY_SEO_ROUTES.find(route => route.categorySlug === value || route.routeSlug === value) || null;
};

const routeByCategorySlug = new Map(APPROVED_CATEGORY_SEO_ROUTES.map(route => [route.categorySlug, route.routeSlug]));
const categoryByRouteSlug = new Map(APPROVED_CATEGORY_SEO_ROUTES.map(route => [route.routeSlug, route.categorySlug]));

/** Public URL slug for a database category ID, or the original value for non-approved legacy records. */
export const getCategorySeoRouteSlug = (categorySlug: string): string =>
  routeByCategorySlug.get(String(categorySlug || '').trim()) || String(categorySlug || '').trim();

/** Resolve either a canonical Persian URL or a stable internal category ID to its database ID. */
export const getInternalCategorySlugFromRouteSlug = (routeSlug: string): string | null => {
  const value = String(routeSlug || '').trim();
  return categoryByRouteSlug.get(value) || (routeByCategorySlug.has(value) ? value : null);
};
