/** Stable Persian SEO URLs for the approved industrial catalogue categories.
 * Internal Excel IDs remain unchanged; only public storefront URLs use these slugs.
 */
export type ApprovedCategorySeoRoute = { categorySlug: string; routeSlug: string; title: string };

export const APPROVED_CATEGORY_SEO_ROUTES: readonly ApprovedCategorySeoRoute[] = [
  { categorySlug: 'excel-v2-1-1', routeSlug: 'تسمه-تایمینگ-صنعتی', title: 'تسمه تایمینگ صنعتی' },
  { categorySlug: 'excel-v2-1-2', routeSlug: 'تسمه-وی-بلت-صنعتی', title: 'تسمه وی‌بلت صنعتی' },
  { categorySlug: 'excel-v2-1-3', routeSlug: 'تسمه-جوشی-صنعتی', title: 'تسمه جوشی صنعتی' },
  { categorySlug: 'excel-v2-1-4', routeSlug: 'تسمه-بارکش-صنعتی', title: 'تسمه بارکش صنعتی' },
  { categorySlug: 'excel-v2-2-1', routeSlug: 'نوار-نقاله-صنعتی', title: 'نوار نقاله صنعتی' },
  { categorySlug: 'excel-v2-2-2', routeSlug: 'خدمات-نوار-نقاله', title: 'خدمات نوار نقاله' },
  { categorySlug: 'excel-v2-3-1', routeSlug: 'روکش-رولر-و-غلتک-صنعتی', title: 'روکش رولر و غلتک صنعتی' },
  { categorySlug: 'excel-v2-3-2', routeSlug: 'قطعات-رولر-صنعتی', title: 'قطعات رولر صنعتی' },
  { categorySlug: 'excel-v2-3-3', routeSlug: 'متعلقات-نگهدارنده-رولر', title: 'متعلقات نگهدارنده رولر' },
  { categorySlug: 'excel-v2-4-1', routeSlug: 'پولی-تایمینگ-صنعتی', title: 'پولی تایمینگ صنعتی' },
  { categorySlug: 'excel-v2-5-1', routeSlug: 'برس-سیمی-صنعتی', title: 'برس سیمی صنعتی' },
  { categorySlug: 'excel-v2-5-2', routeSlug: 'برس-خشک-کن-صنعتی', title: 'برس خشک‌کن صنعتی' },
  { categorySlug: 'excel-v2-6-1', routeSlug: 'ریل-راهنمای-صنعتی', title: 'ریل راهنمای صنعتی' },
  { categorySlug: 'excel-v2-6-2', routeSlug: 'گاید-راهنمای-صنعتی', title: 'گاید راهنمای صنعتی' },
  { categorySlug: 'excel-v2-6-3', routeSlug: 'پروفیل-و-پایه-هدایت-صنعتی', title: 'پروفیل و پایه هدایت صنعتی' },
  { categorySlug: 'excel-v2-6-4', routeSlug: 'سنسور-و-نگهدارنده-صنعتی', title: 'سنسور و نگهدارنده صنعتی' },
  { categorySlug: 'excel-v2-7-1', routeSlug: 'قطعات-لاستیکی-صنعتی', title: 'قطعات لاستیکی صنعتی' },
  { categorySlug: 'excel-v2-7-2', routeSlug: 'اورینگ-و-آببند-صنعتی', title: 'اورینگ و آب‌بند صنعتی' },
  { categorySlug: 'excel-v2-7-3', routeSlug: 'ضربه-گیر-و-مکنده-صنعتی', title: 'ضربه‌گیر و مکنده صنعتی' },
  { categorySlug: 'excel-v2-8-1', routeSlug: 'نوار-برزنتی-نسوز-چند-لایه', title: 'نوار برزنتی نسوز چندلایه' },
  { categorySlug: 'excel-v2-8-2', routeSlug: 'نخ-و-عایق-نسوز-صنعتی', title: 'نخ و عایق نسوز صنعتی' },
  { categorySlug: 'excel-v2-9-1', routeSlug: 'زنجیر-صنعتی', title: 'زنجیر صنعتی' },
  { categorySlug: 'excel-v2-9-2', routeSlug: 'قطعات-پمپ-صنعتی', title: 'قطعات پمپ صنعتی' },
  { categorySlug: 'excel-v2-9-3', routeSlug: 'یراق-آلات-و-قطعات-مکانیکی', title: 'یراق‌آلات و قطعات مکانیکی' },
  { categorySlug: 'excel-v2-9-4', routeSlug: 'چرخ-صنعتی', title: 'چرخ صنعتی' },
  { categorySlug: 'excel-v2-10-1', routeSlug: 'قطعات-دستگاه-چاپ-صنعتی', title: 'قطعات دستگاه چاپ صنعتی' },
  { categorySlug: 'excel-v2-10-2', routeSlug: 'تجهیزات-روتاری-صنعتی', title: 'تجهیزات روتاری صنعتی' },
  { categorySlug: 'excel-v2-11-1', routeSlug: 'توری-مش-صنعتی', title: 'توری مش صنعتی' },
  { categorySlug: 'excel-v2-12-1', routeSlug: 'ساخت-قطعات-صنعتی-سفارشی', title: 'ساخت قطعات صنعتی سفارشی' },
  { categorySlug: 'excel-v2-13-1', routeSlug: 'بلبرینگ-صنعتی', title: 'بلبرینگ صنعتی' },
  { categorySlug: 'excel-v2-13-2', routeSlug: 'یاتاقان-و-متعلقات-صنعتی', title: 'یاتاقان و متعلقات صنعتی' },
  { categorySlug: 'excel-v2-14-1', routeSlug: 'ابر-اسفنجی-صنعتی', title: 'ابر اسفنجی صنعتی' },
  { categorySlug: 'excel-v2-14-2', routeSlug: 'نوار-اسفنجی-صنعتی', title: 'نوار اسفنجی صنعتی' },
  { categorySlug: 'excel-v2-14-3', routeSlug: 'اسکاج-صنعتی', title: 'اسکاج صنعتی' },
] as const;

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
