import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpLeft,
  Camera,
  Check,
  ChevronLeft,
  Copy,
  FileSpreadsheet,
  Headphones,
  Image as ImageIcon,
  Layers,
  Package,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { ProductImage } from '../components/product/ProductImage';
import { useDirectSkus } from '../components/catalog/DirectSkuProducts';
import { resolveDisplayBrand } from '../utils/catalogBrands';
import { toPersianDigits } from '../utils/formatters';

export default function DirectSkuDetailPage() {
  const { code } = useParams<{ code: string }>();
  const items = useDirectSkus();
  const [copied, setCopied] = useState(false);

  const item = useMemo(
    () => items.find(row => row.skuCode === code),
    [items, code],
  );
  const brandLabel = item ? resolveDisplayBrand(item.brand, item.name) : '';

  const relatedDirectSkus = useMemo(() => {
    if (!item) return [];
    return items
      .filter(row => row.categorySlug === item.categorySlug && row.skuCode !== item.skuCode)
      .slice(0, 4);
  }, [items, item]);

  const handleCopyCode = () => {
    if (!item) return;
    navigator.clipboard?.writeText(item.skuCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (!item) {
    return (
      <main dir="rtl" className="mx-auto max-w-5xl bg-white px-4 py-14 text-right">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-xs space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-[#E06518]">
            <Package className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-800">
              کد کالا در حال بارگذاری است یا در فهرست مستقیم پیدا نشد
            </h1>
            <p className="mx-auto max-w-md text-xs leading-6 text-slate-500">
              اگر کد فنی را مستقیم وارد کرده‌اید، می‌توانید در کاتالوگ جامع جستجو کنید یا تصویر قطعه را برای شناسایی ارسال نمایید.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E06518] hover:bg-[#c85612] px-5 py-2.5 text-xs font-black text-white transition-colors"
            >
              <span>مشاهده کاتالوگ محصولات</span>
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              to={`/search${code ? `?q=${encodeURIComponent(code)}` : ''}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors"
            >
              <span>جستجوی کد در کل سایت</span>
            </Link>
            <Link
              to="/identify-part"
              className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 px-4 py-2.5 text-xs font-bold text-[#b85214] transition-colors"
            >
              <Camera className="h-4 w-4" />
              <span>شناسایی قطعه با تصویر</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const categoryBackUrl =
    '/category/' +
    encodeURIComponent(item.categorySlug) +
    (item.submenu ? '?sub=' + encodeURIComponent(item.submenu) : '');

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 bg-white px-4 py-6 sm:py-10 text-right">
      {/* Breadcrumb & Back Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="مسیر صفحه" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link to="/" className="hover:text-[#E06518] transition-colors">
            صفحه اصلی
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
          <Link to="/categories" className="hover:text-[#E06518] transition-colors">
            دسته‌بندی‌ها
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
          <Link to={categoryBackUrl} className="hover:text-[#E06518] transition-colors">
            {item.categoryName}
          </Link>
          {item.submenu && (
            <>
              <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
              <Link to={categoryBackUrl} className="hover:text-[#E06518] transition-colors">
                {item.submenu}
              </Link>
            </>
          )}
          <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
          <span dir="ltr" className="font-mono font-black text-slate-800">
            {item.skuCode}
          </span>
        </nav>

        <Link
          to={categoryBackUrl}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:border-orange-300 px-3.5 py-2 text-xs font-extrabold text-[#E06518] shadow-2xs transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          <span>بازگشت به دسته {item.categoryName}</span>
        </Link>
      </div>

      {/* Main Two-Column Industrial Datasheet Card */}
      <section className="grid gap-6 lg:gap-10 rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 lg:grid-cols-12 shadow-sm">
        {/* Right Column: Visual Media & Part Code */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="relative flex aspect-square min-h-[280px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] p-6">
            <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#23272c]/90 px-3 py-1 text-[10.5px] font-bold text-white">
                <Layers className="h-3.5 w-3.5 text-[#E06518]" />
                <span>کالای ثبت‌شده مستقیم (Direct SKU)</span>
              </span>
              {brandLabel && (
                <span className="rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[10.5px] font-extrabold text-slate-700">
                  {brandLabel}
                </span>
              )}
            </div>

            {item.imageUrl ? (
              <ProductImage
                src={item.imageUrl} disableFallback
                alt={item.name}
                className="h-full max-h-80 w-full object-contain p-4"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <ImageIcon size={58} className="text-slate-300" />
                <span className="text-xs font-bold">تصویر اختصاصی در حال تکمیل</span>
              </div>
            )}

            <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between rounded-xl bg-slate-900/80 px-3 py-2 text-[11px] text-white backdrop-blur-xs">
              <span>کد فنی قطعه:</span>
              <strong dir="ltr" className="font-mono text-orange-300">
                {item.skuCode}
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span>پارت‌نامبر اختصاصی:</span>
              <strong dir="ltr" className="font-mono text-slate-900">
                {item.skuCode}
              </strong>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:border-orange-300 px-3 py-1.5 text-[11px] font-bold text-slate-700 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">کپی شد</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>کپی کد کالا</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Left Column: Details, Specs, and Commercial Actions */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Metadata Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  کد کالا:{' '}
                  <strong dir="ltr" className="font-mono text-[#C45D15]">
                    {item.skuCode}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  گروه:{' '}
                  <strong className="text-slate-800">{item.categoryName}</strong>
                </span>
                {brandLabel && (
                  <>
                    <span>·</span>
                    <span>
                      برند: <strong className="text-slate-800">{brandLabel}</strong>
                    </span>
                  </>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                استعلام مستقیم موجودی و قیمت
              </span>
            </div>

            {/* Title & Hierarchy */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 leading-snug">
                {item.name}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                مسیر فنی: {item.categoryName} / {item.submenu}
                {item.subcategory ? ' / ' + item.subcategory : ''}
              </p>
            </div>

            {/* Direct SKU Explanation Banner */}
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 text-xs leading-7 text-slate-700">
              این قطعه مستقیماً زیر گروه فنی ثبت شده است و نیازی به خانواده کالایی ندارد. برای استعلام قیمت روز، موجودی انبار و شرایط تأمین با واحد مهندسی فروش صنعت پیش در ارتباط باشید.
            </div>

            {/* Technical Specifications Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-800">
                  <FileSpreadsheet className="h-4 w-4 text-[#E06518]" />
                  <span>مشخصات فنی و شناسنامه قطعه</span>
                </h2>
                <span dir="ltr" className="font-mono text-[11px] font-bold text-slate-500">
                  {item.skuCode}
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-white">
                  <span className="text-slate-500 font-medium">کد اختصاصی کالا (SKU)</span>
                  <span dir="ltr" className="font-mono font-black text-[#C45D15] text-right">
                    {item.skuCode}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50/50">
                  <span className="text-slate-500 font-medium">دسته‌بندی و زیرگروه</span>
                  <span className="font-bold text-slate-800">
                    {item.categoryName} › {item.subcategory || item.submenu}
                  </span>
                </div>
                {brandLabel && (
                  <div className="grid grid-cols-2 gap-3 p-3.5 bg-white">
                    <span className="text-slate-500 font-medium">برند / سازنده</span>
                    <span className="font-bold text-slate-800">{brandLabel}</span>
                  </div>
                )}
                {(item.technicalSpecs || []).map((spec, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-2 gap-3 p-3.5 ${
                      i % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'
                    }`}
                  >
                    <span className="text-slate-500 font-medium">{spec.key}</span>
                    <span className="font-bold text-slate-800">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Commercial & Technical Consultation Actions */}
          <div className="space-y-4 border-t border-slate-200/80 pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                to={`/ai-consult?productCode=${encodeURIComponent(item.skuCode)}&productName=${encodeURIComponent(item.name)}`}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#E06518] hover:bg-[#c85612] px-4 text-xs font-black text-white shadow-xs transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>استعلام و مشاوره با FORZA</span>
              </Link>
              <Link
                to="/contact"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 text-xs font-extrabold text-slate-700 transition-colors"
              >
                <PhoneCall className="h-4 w-4 text-[#E06518]" />
                <span>تماس با واحد فروش</span>
              </Link>
              <Link
                to="/identify-part"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 px-4 text-xs font-extrabold text-[#a84c14] transition-colors"
              >
                <Camera className="h-4 w-4" />
                <span>تطبیق با تصویر نمونه</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px] font-bold text-slate-600">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>ضمانت تطبیق کد فنی پیش از ارسال</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                <Truck className="h-4 w-4 text-[#E06518] shrink-0" />
                <span>ارسال سریع از انبار مرکزی یزد</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                <Headphones className="h-4 w-4 text-blue-600 shrink-0" />
                <span>پشتیبانی مهندسی خطوط تولید</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Direct SKUs in Same Category */}
      {relatedDirectSkus.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-black text-[#E06518]">سایر قطعات مستقیم</span>
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                کدهای مستقیم دیگر در دسته {item.categoryName}
              </h2>
            </div>
            <Link
              to={categoryBackUrl}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#E06518] hover:underline"
            >
              <span>مشاهده همه در این دسته</span>
              <ArrowUpLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {relatedDirectSkus.map(rel => (
              <Link
                key={rel.skuCode}
                to={'/direct-product/' + encodeURIComponent(rel.skuCode)}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-[#E06518] hover:shadow-sm"
              >
                <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-50 p-3 mb-3">
                  {rel.imageUrl ? (
                    <ProductImage src={rel.imageUrl} disableFallback alt={rel.name} className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="text-slate-300" size={32} />
                  )}
                </div>
                <div className="space-y-1">
                  <div dir="ltr" className="font-mono text-[11px] font-black text-[#C45D15]">
                    {rel.skuCode}
                  </div>
                  <h3 className="line-clamp-2 text-xs font-extrabold text-slate-800 group-hover:text-[#E06518]">
                    {rel.name}
                  </h3>
                  <p className="truncate text-[10px] text-slate-500">
                    {rel.subcategory || rel.submenu}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
