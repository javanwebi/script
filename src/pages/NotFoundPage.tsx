import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Boxes, Home, Search } from "lucide-react";
import { setPageMeta } from "../utils/pageMeta";

export function NotFoundPage() {
  useEffect(() => {
    setPageMeta({ title: "صفحه پیدا نشد | صنعت پیش", description: "این نشانی در صنعت پیش پیدا نشد. از کاتالوگ قطعات یا دسته‌بندی‌های صنعتی برای ادامه استفاده کنید." });
  }, []);

  return (
    <section className="min-h-[68vh] w-full bg-[#f5f7f8] px-4 py-14 sm:py-20" dir="rtl">
      <section className="mx-auto flex min-h-[420px] max-w-5xl flex-col items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-white px-5 py-12 text-center shadow-[0_24px_70px_rgba(22,39,53,.08)] sm:px-10">
        <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#fff1e7] text-[#E56B1E]">
          <Boxes size={42} strokeWidth={1.6} />
          <span className="absolute -left-4 -top-3 rounded-full bg-[#1c2c38] px-3 py-1 text-xs font-black tracking-wider text-white">404</span>
        </div>
        <span className="text-xs font-black tracking-wide text-[#E56B1E]">مسیر موردنظر پیدا نشد</span>
        <h1 className="mt-3 max-w-2xl text-2xl font-black leading-relaxed text-[#1c2c38] sm:text-4xl">
          این مسیر به قطعه موردنظر نمی‌رسد.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-8 text-slate-500">
          ممکن است نشانی صفحه تغییر کرده باشد یا لینک قدیمی باشد. از مسیرهای زیر می‌توانید دوباره به کاتالوگ و خدمات صنعت پیش برسید.
        </p>
        <div className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/products" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E56B1E] px-5 text-sm font-bold text-white transition hover:bg-[#c95715]">
            <Search size={18} /> جستجو در کاتالوگ <ArrowLeft size={16} />
          </Link>
          <Link to="/categories" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-[#263746] transition hover:border-[#E56B1E] hover:text-[#E56B1E]">
            <Boxes size={18} /> دسته‌بندی قطعات
          </Link>
          <Link to="/" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-[#263746] transition hover:border-[#E56B1E] hover:text-[#E56B1E]">
            <Home size={18} /> صفحه اصلی
          </Link>
        </div>
      </section>
    </section>
  );
}

export default NotFoundPage;
