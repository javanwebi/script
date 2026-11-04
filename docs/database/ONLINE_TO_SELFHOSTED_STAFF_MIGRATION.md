# انتقال کنترل‌شده مجوز کارکنان: آنلاین → VPS

## محیط‌های جداگانه
- **Cloud reference/staging:** Supabase project `sanatpishatlas`, ref `spkszfbeeufdcpcltqal`. Migration ثبت‌شده: `20261104184143_admin_staff_granular_permissions`.
- **Production:** PostgreSQL خودمیزبان که کانتینر درگاه سایت در `127.0.0.1:3008` به آن وصل است. این محیط هرگز نباید از dump دیتابیس ابری بازنویسی شود.
- **Source of truth for schema:** `supabase/adopted/migrations/20261104100000_admin_staff_granular_permissions.sql` از commit `2eafc2666407cd2ecdad22f3bc44e7a77af0bedd`.

این انتقال فقط DDL تاییدشده را اجرا می‌کند و هیچ ردیف، حساب یا داده تجاری را از ابر به سرور کپی نمی‌کند. نسخه‌های migration history آنلاین و آفلاین متفاوت‌اند ولی ساختار جدول یکسان است.

## اجرای VPS
در مسیر `/opt/sanatpish`:

```bash
git fetch origin main
git show origin/main:ops/sync-online-staff-schema-vps.sh > /root/sync-online-staff-schema-vps.sh
bash -n /root/sync-online-staff-schema-vps.sh
sudo bash /root/sync-online-staff-schema-vps.sh --check
```

در صورت تایید اینکه فقط PostgreSQL خودمیزبان کشف شده است:

```bash
sudo bash /root/sync-online-staff-schema-vps.sh --apply
```

`--apply` قبل از اجرای تراکنش جدول جدید، full custom-format PostgreSQL dump و role globals dump در `/root/sanatpish-db-backups` می‌گیرد، checksum را بررسی می‌کند، آرشیو را decode می‌کند، schema را در یک DB موقت بازیابی می‌کند و فقط اگر موفق بود همان فایل SQL را روی دیتابیس واقعی اجرا می‌کند. `dropdb` فقط پایگاه آزمایشی ساخته‌شده در همان اجرا را حذف می‌کند. برای کمبود فضای دیسک، چند کانتینر DB، اشتباه بودن اتصال و شکست restore، اجرا بدون تغییر دیتابیس اصلی متوقف می‌شود.

**محدودیت آزمون:** بازیابی آزمایشی به schema محدود است؛ صحت بازیابی تک‌تک ردیف‌های داده و نقش‌ها در یک سرور مستقل، آزمون جداگانه می‌خواهد. dump و نقش‌ها برای بررسی کامل نگهداری می‌شوند. اسکریپت هیچگز `npm run db:migrate:adopted` را اجرا نمی‌کند چون ممکن است مهاجرت‌های منتظر دیگر را نیز اعمال کند.

اگر جدول از قبل وجود داشته باشد، SQL افزایشی است؛ قبل از اجرا باید schema و مجوزهای موجود را بررسی کرد. پس از موفقیت، نسخه frontend/backend جداگانه با `sudo sanatpish-deploy-main` منتشر می‌شود و ورود، ایجاد کاربر، اعمال دسترسی و عدم دسترسی کاربران معمولی به API به‌صورت واقعی تست می‌شود.

هیچ API key، رمز عبور یا backup را در گزارش عمومی، Github یا مرورگر قرار ندهید.
