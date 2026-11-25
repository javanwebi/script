# ممیزی مسیرهای صنعت پیش

مبنای بررسی شاخهٔ main در `7b9aa348f2` است. نسخهٔ عمومی هنگام بررسی `89f282ad6432` را گزارش کرد.

## مسیرهای ثبت‌شده در React Router

| مسیر |
| --- |
| `/identify-part` |
| `/ai-consult` |
| `/ai-advisor` |
| `/cognivo` |
| `/ai-forza` |
| `/face-to-face` |
| `/register` |
| `/login` |
| `/inquiry` |
| `/onboarding` |
| `/` |
| `/about` |
| `/services` |
| `/capabilities` |
| `/about-us` |
| `/history` |
| `/licenses` |
| `/awards` |
| `/contact` |
| `/contact-us` |
| `/factory-address` |
| `/address` |
| `/products` |
| `/categories` |
| `/club` |
| `/category/ceramic-tiles` |
| `/industries/ceramic` |
| `/industries/tile-ceramic` |
| `/industry/ceramic-tile` |
| `/industries` |
| `/industries/:slug` |
| `/brands` |
| `/knowledge` |
| `/knowledge/:slug` |
| `/catalog` |
| `/consumer-dashboard/product/:code` |
| `/account/product/:code` |
| `/category/textile-machinery` |
| `/category/packaging-carton` |
| `/category/food-beverage` |
| `/category/machinery-equipment` |
| `/category/rubber-plastics` |
| `/category/:slug` |
| `/direct-product/:code` |
| `/product/:code` |
| `/search` |
| `/cart` |
| `/wishlist` |
| `/favorites` |
| `/checkout` |
| `/consumer-dashboard/*` |
| `/retail-account/*` |
| `/account/*` |
| `/agency/*` |
| `/dealer/*` |
| `/admin/demo-agencies` |
| `/admin/*` |
| `/forza` |
| `*` |

مسیرهای ستاره‌دار پنل، ورودی ماژول‌ها هستند. فهرست نماهای داخلی و دسترسی هر نقش جداگانه بررسی می‌شود.

## یافته‌های اولیه

- مسیرهای قدیمی صنایع و نشانی‌های شرکتی در مسیریاب نگاشت شده‌اند. لینک‌های داخلی باید به مقصد اصلی هر صفحه ارجاع دهند.
- مسیر عمومی `/product/:code` و مسیرهای محصول پنل از یک کامپوننت استفاده می‌کنند. دو مسیر پنل محافظ نقش مستقل دارند.
- `/catalog` به دانشنامه هدایت می‌شود. کاربرد این لینک در منو و انتظاری که عنوان لینک ایجاد می‌کند باید بررسی شود.
- مسیر ناشناخته به صفحهٔ اصلی هدایت می‌شود. در نتیجه برای لینک عمومی اشتباه پیام بازیابی مشخصی نمایش داده نمی‌شود.
- قالب عمومی فروشگاه هدر، محتوا، فوتر و کنترل‌های موبایل را در بر می‌گیرد. پنل‌ها و تجربه‌های تمام‌صفحهٔ فورزا از قالب مستقل استفاده می‌کنند.

## بررسی‌های باقیمانده

پیوند هر مسیر به منبع داده و نقش مجاز، مسیرهای داخلی پنل‌ها، کیفیت بصری در پنج اندازه، SEO و رفتار مسیرهای موجود روی نسخهٔ زنده، و هم‌پوشانی تغییرات با PRهای باز.
