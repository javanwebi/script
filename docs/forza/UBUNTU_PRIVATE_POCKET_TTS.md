# FORZA: Pocket TTS فارسی v2 روی Ubuntu، بدون دانلود مدل برای مشتری

## معماری نهایی
- **مرورگر:** میکروفون، متن خروجی SSE، پخش WAV؛ هیچ موتور TTS محلی، voice مرورگر یا دانلود ONNX TTS ندارد.
- **Node/Express:** `POST /api/ai/forza-speech` فقط متن کوتاه را به `FORZA_VOICE_INTERNAL_URL/speak` می‌فرستد و WAV را پس می‌دهد؛ توکن فقط روی سرور است.
- **Ubuntu / Docker:** کانتینر موجود `forza-voice` مدل Pocket Farsi v2 و صدای مرجع را در RAM بارگذاری می‌کند. کانتینر اپ `sanatpish-new` به آن از طریق **شبکه خصوصی Docker** متصل می‌شود. آدرس خصوصی استاندارد `http://forza-voice:8080` است.
- **خوشامدگویی:** `/forza-greeting-bootstrap.wav`؛ بازیابی از فایل آماده در صورت موجود بودن، بدون انتظار برای تولید تازه.
- **پاسخ‌ها:** اولین عبارت کامل Gemini بر اساس SSE برای ساخت WAV ارسال می‌شود، متن کامل منتظر نمی‌ماند. متن بعدی می‌تواند هنگام پخش عبارت قبلی تولید صوت شود. این طرح زمان قطعی «صفر» یا زیر یک ثانیه تضمین نمی‌کند؛ با CPU واقعی Ubuntu باید TTFA اندازه‌گیری شود.

## پیش‌نیاز
در سرور فعلی از قبل `/opt/sanatpish` و کانتینرهای `sanatpish-new` و `forza-voice` وجود دارند. **در مسیر موجود دوباره git clone نکنید؛ اطلاعات، .env و تنظیمات را پاک نکنید.** `/etc/sanatpish/forza-voice.env` باید کلید خصوصی ۶۴ کاراکتری موجود را نگه دارد. هیچ کلیدی نباید در GitHub ثبت شود.

### مرحله صفر: بررسی فقط خواندنی
```bash
ssh root@87.107.152.92
cd /opt/sanatpish
git rev-parse HEAD
git status --short
docker ps --format 'table {{.Names}}\t{{.Status}}'
test -s /etc/sanatpish/forza-voice.env && echo "VOICE_SECRET_PRESENT"
docker exec sanatpish-new node -e 'fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(4000)}).then(async r=>{console.log(r.status,await r.text());if(!r.ok)process.exit(1)}).catch(e=>{console.error(e.message);process.exit(1)})'
```

### مرحله ۱: اگر نسخه تازه GitHub را می‌خواهید «کلون» کنید
برای بررسی بدون لمس پروژه روشن:
```bash
git clone --branch main https://github.com/javanwebi/script.git /opt/sanatpish-next
git -C /opt/sanatpish-next rev-parse HEAD
```
اگر پروژه نصب‌شده در `/opt/sanatpish` را می‌خواهید به‌روزرسانی کنید، نسخه جدید را **همان‌جا** دریافت کنید و ابتدا از کامیت قبلی یادداشت بردارید:
```bash
cd /opt/sanatpish
git status --short
git rev-parse HEAD | tee /root/sanatpish-before-pocket.txt
git remote set-url origin https://github.com/javanwebi/script.git
git fetch origin main
git merge-base --is-ancestor HEAD origin/main && git pull --ff-only origin main
```
**دستور آخر اگر تاریخچه قابل fast-forward نباشد اجرا نمی‌شود. در آن صورت force/reset نکنید.** اسکریپت مخصوص استقرار موجود ممکن است نیز خود از `main` جدید fetch کند؛ قبل از اجرای آن از تنظیمات پروژه بکاپ بگیرید.

### مرحله ۲: اتصال کانتینر صوتی موجود
کانتینر Pocket از قبل وجود دارد؛ مجدداً ایمیج ۵۰۰ مگابایتی را برای مشتری دانلود یا روی اپ اصلی نصب نمی‌کنیم. بعد از تأیید سلامت و وجود فایل توکن:
```bash
cd /opt/sanatpish
bash ops/forza-voice-connect-vps.sh
```
این اسکریپت آدرس `FORZA_VOICE_INTERNAL_URL=http://forza-voice:8080` و توکن خصوصی را در `.env.forza-voice` تنظیم می‌کند؛ سپس با `/usr/local/sbin/sanatpish-deploy` برنامه را به‌روزرسانی و در صورت شکست تست صوت، اتصال را به حالت قبلی برمی‌گرداند. **Supabase و کانتینر صدای موجود را بازسازی نمی‌کند.**

### مرحله ۳: تست صدای واقعی از Express
```bash
curl -fsS --max-time 15 http://127.0.0.1:3001/api/health
curl -sS --max-time 45 -D /tmp/forza-headers.txt -o /tmp/forza-smoke.wav \
  -H 'Content-Type: application/json' \
  --data '{"text":"سلام، صدای فورزا اکنون از سرور اوبونتو پخش می‌شود."}' \
  http://127.0.0.1:3001/api/ai/forza-speech
grep -i '^X-Forza-Voice-Backend:' /tmp/forza-headers.txt
file /tmp/forza-smoke.wav
docker logs --tail 50 forza-voice
```
خروجی موفق باید `200`، هدر `X-Forza-Voice-Backend: private-service` و WAV با چهار بایت `RIFF` باشد. فقط سپس مرورگر را در `https://87.107.152.92/ai-forza` بررسی کنید. در صورت خطای 403، کلید دو کانتینر همخوان نیست؛ توکن را در چت یا لاگ عمومی ارسال نکنید.

## خطاها و محدودیت‌ها
- `503 private_voice_not_configured`: فایل `.env.forza-voice` در کانتینر Node خوانده نشده؛ این طرح عمداً روی CPU اپ اصلی Pocket اجرا نمی‌کند.
- `503 voice_busy`: موتور اختصاصی تک‌درخواستی است؛ بک‌اند برای مدت محدود تلاش مجدد می‌کند، اما در ترافیک بالا باید صف و مقیاس منابع تنظیم شود.
- `403`: مشکل کلید محرمانه / دسترسی به سرویس خصوصی.
- صدای خوشامدگویی در مرورگر ممکن است به دلیل سیاست autoplay نیازمند یک بار کلیک کاربر باشد.
- **Railway** با این راه‌اندازی به مدل روی Ubuntu دسترسی خودکار ندارد. آدرس `forza-voice:8080` فقط برای کانتینرهای هم‌شبکه Ubuntu است؛ تا اتصال امن خصوصی بین Railway و Ubuntu جداگانه پیکربندی نشود، روی Railway TTS خصوصی کار نمی‌کند. **پورت 8080 را برای رفع این مشکل به اینترنت عمومی باز نکنید.**

## بازگشت اضطراری
تنظیم اتصال با اجرای `ops/forza-voice-connect-vps.sh` در صورت شکست تست خودکار Rollback می‌شود. اگر از قبل سرویس مستقلی در حال کار است، `ops/forza-voice-promote-vps.sh` را اجرا نکنید مگر برای تغییر آگاهانه خود کانتینر صدا. برای بازگشت کد اپ به کامیت قبلی، ابتدا کامیت موجود در `/root/sanatpish-before-pocket.txt` را بررسی و روش انتشار متناظر را انتخاب کنید؛ بدون `git reset --hard` یا حذف داده‌های پروژه.
