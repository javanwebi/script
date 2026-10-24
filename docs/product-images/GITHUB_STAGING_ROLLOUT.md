# انتقال تصاویر محصول صنعت پیش به GitHub — مرحله آزمایشی

**مخزن تولید:** `javanwebi/script` (Railway branch `main`)

**دیتابیس واحد:** `sanatpishatlas` / `spkszfbeeufdcpcltqal`

**منبع تصاویر اصلی:** `javanweb/imagesatlas` pinned at `5bbaec971a05771939663d47803b5d5c2c624c6d`

**محل نسخهٔ قبلی:** Railway persistent Volume `/data/storage/products/catalog/`

## محافظت از داده‌های اصلی

- هیچ SKU، خانواده، مشخصات فنی، قیمت یا رکورد گالری حذف نمی‌شود.
- نسخه‌های PNG منبع بدون دستکاری وارد `public/products/catalog/` می‌شوند.
- وجود دقیقاً **۸۶۹ تصویر**، حجم **۲۴۸٬۸۶۳٬۲۱۵ بایت**، SHA-256 دیتابیس و Git blob SHA-1 بر اساس فایل `scripts/catalog-images/official-source-checksums.json` بررسی می‌شود.
- SHA-256های ۸۶۹ تصویر مرجع همگی یکتا هستند.
- GitHub Actions قبل از ساخت دارایی‌ها از تمام PNGهای اصلی یک Artifact مستقل تهیه می‌کند.
- مشکل واقعی: مسیر قدیمی `/storage/products/catalog/e(n).png` فعلاً HTTP 404 برمی‌گرداند. لاگ سرور مورخ ۲۴ اکتبر تأیید کرده که قبلاً همهٔ ۸۶۹ فایل روی Volume با Git blob SHA تطبیق داده شده‌اند. رفع Regex مسیر قبلی در همین شاخه ثبت شده، اما **آزمون عمومی Volume با ۸۶۹ پاسخ موفق هنوز کامل نیست**. معیار SHA-256 منبع با خود دیتابیس جداگانه تست می‌شود.

## فایل‌های خروجی

- `public/products/catalog/e(1).png` تا `e(869).png`: اصلی، بدون تغییر
- `public/products/catalog/optimized/e(1).<sha12>.w320.webp`: کارت/thumbnail
- `public/products/catalog/optimized/e(1).<sha12>.w960.webp`: صفحه محصول
- `public/products/catalog/manifest.json`: نگاشت هش و حجم خروجی
- `src/generated/catalogImageAssets.ts`: نگاشت URLهای WebP برای `srcset`
- `reports/catalog-images/`: شمارش، مقایسه حجم‌ها و وضعیت بررسی Volume

نام WebPها با هش محتوای PNG نسخه‌دار می‌شود؛ بنابراین می‌توان روی آنها `Cache-Control: public, max-age=31536000, immutable` گذاشت. تصاویر اصلی دارای نام ثابت `e(n).png` کش کوتاه‌تر می‌گیرند.

تبدیل روی GitHub Actions انجام می‌شود، نه هنگام Buildهای روزمره Railway. تصاویر بدون تغییر پردازش مجدد نمی‌شوند.

## آپلود مدیر و انتشار خودکار — آماده‌سازی (غیرفعال تا تأیید مالک)

آپلود جدید با همان API مدیریت، ابتدا روی Volume ذخیره و با کد واقعی خانواده/SKU به `catalog_gallery_images` ثبت می‌شود؛ URL موقت فعال می‌ماند. فایل اصلیِ بدون دستکاری و WebPهای ۳۲۰ و ۹۶۰ نیز در `/data/storage/products/publish-queue/` باقی می‌مانند.

برای فعال‌سازی انتشار GitHub در آینده باید پس از تصویب و آزمون روی DB آزمایشی:

1. اسکریپت افزایشی `docs/database/pending-approval/20261024_catalog_image_publication_outbox.sql` بررسی و اجرا شود.
2. در Railway *فقط سمت سرور* `GITHUB_MEDIA_TOKEN` با دسترسی محدود `contents/pull_requests` و `PRODUCT_GITHUB_PUBLISH_ENABLED=1` تنظیم شود. کلیدها هرگز در `VITE_*` یا Git ذخیره نشوند.
3. انتشاردهنده در بسته‌های حداکثر ۶ تصویر، هر ۱۰ دقیقه یک PR برای تصاویر جدید می‌سازد؛ منتظر موفقیت دو بررسی CI می‌ماند، سپس PR را ادغام می‌کند تا Railway نسخه جدید را بسازد.
4. پس از نمایش واقعی فایل اصلی روی URL جدید و **تطبیق SHA-256** و وجود هر دو نسخه WebP، URL گالری و رکوردهای خانواده/SKU در PostgreSQL به‌روزرسانی می‌شوند.
5. در صورت خطای GitHub، CI یا Deploy، URL موقت و فایل Volume باقی می‌مانند و امکان Retry از API مدیریت وجود دارد.

**توجه:** تا زمانی که DB و token فعال نشده‌اند، قابلیت انتشار GitHub برای آپلودهای جدید به‌صورت عملیاتی روشن نیست.

## شرط اجرای Production

فایل `docs/database/pending-approval/20261024051200_catalog_static_image_urls.sql` یک طرح تغییر URL قابل بازگشت است؛ داخل فهرست Migrationهایی که CI خودکار اجرا می‌کند نیست. فایل برگشت در `supabase/adopted/rollback/` قرار دارد.

**بدون تأیید صریح مالک اجرا نشود.** ابتدا پشتیبان مستقل PostgreSQL و Volume، سپس تأیید ۸۶۹ URL HTTP 200 در Build مستقر، سلامت API، عدم وجود تصاویر شکسته و سنجش سرعت/LCP موبایل و دسکتاپ؛ سپس تغییر آدرس‌ها در دیتابیس اصلی. Volume قبلی در زمان انتقال نباید حذف شود.

به‌دلیل بازگشت HTTP 404 از مسیر قدیمی، اندازه‌گیری معتبر LCP و مقایسهٔ قبل/بعد از انتشار هنوز نیازمند محیط تست متصل به دیتابیس است. هیچ عدد سرعت یا LCP فرضی گزارش نشود.
