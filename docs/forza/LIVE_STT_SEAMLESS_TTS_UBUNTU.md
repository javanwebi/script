# FORZA — زنده‌نویسی گفتار و پخش پیوسته Pocket روی Ubuntu

این تغییر فقط تجربه مکالمهٔ FORZA را اصلاح می‌کند. شکل، رنگ، کیفیت ذرات، کاتالوگ و پایگاه داده تغییر نمی‌کنند.

## معماری

- هنگام حرف‌زدن کاربر، Chrome SpeechRecognition با `interimResults=true` متن موقت فارسی را همان لحظه در حباب «شما» نمایش می‌دهد و هنگام اصلاح تشخیص، همان متن را به‌روز می‌کند. پس از مکث واقعی کاربر، متن نهایی خودکار به Gemini فرستاده می‌شود.
- اگر SpeechRecognition از کار بیفتد، تشخیص محلی Diba/Vosk در صورت **بارگذاری و آماده‌بودن** فعال می‌شود؛ اگر هیچ تشخیص‌گر بلادرنگ آماده نباشد، راهکار ضبط و تشخیص پس از پایان جمله حفظ می‌شود. این حالت آخر **واقعاً STT بلادرنگ نیست** و نباید متن تخمینی نمایش دهد. هیچ پیام «در حال دریافت صدای شما و ارسال به سرور» جایگزین گفتار زنده نمی‌شود.
- Gemini روی `/api/ai/consult-stream` متن را جریانی می‌فرستد. عبارت اول کوتاه و کامل است؛ عبارت‌های بعدی بلندتر و نزدیک به جمله طبیعی‌اند.
- Ubuntu: مدل Pocket TTS فارسی v2 از قبل در کانتینر اختصاصی `forza-voice` است. API محرمانه `/api/ai/forza-speech` به آن متصل می‌ماند.
- مرورگر: WAVهای آماده از Ubuntu را با `AudioContext` واحد decode می‌کند و قطعات را با زمان‌بندی نمونه‌ای `AudioBufferSourceNode.start(when)` پشت سر هم پخش می‌کند. عبارت بعدی هنگام پخش قبلی ساخته می‌شود. دکمهٔ بی‌صداکردن و قطع تماس، پخش پیوسته را هم کنترل می‌کنند.
- اگر سرعت تولید Pocket در Ubuntu کمتر از سرعت پخش باشد، `[FORZA_AUDIO_UNDERRUN]` گزارش می‌شود. **هیچ الگوریتم بافری نمی‌تواند کسری ظرفیت CPU را بدون مکث تضمین کند.** فایل خوشامدگویی مستقل و از پیش آماده باقی می‌ماند.

## دستورهای ایمن استقرار در سرور فعلی

در سرور شما `/opt/sanatpish`، کانتینرهای `sanatpish-new` و `forza-voice` و اتصال `.env.forza-voice` از قبل کار می‌کنند؛ **دوباره clone داخل همین مسیر، docker rm و بازسازی Supabase لازم نیست**.

```bash
ssh root@87.107.152.92
cd /opt/sanatpish
git status --short
git branch --show-current
git rev-parse HEAD | tee /root/sanatpish-before-live-voice.txt
docker ps --format 'table {{.Names}}\t{{.Status}}'
docker exec sanatpish-new node -e 'fetch("http://forza-voice:8080/health").then(r=>{console.log("VOICE_HEALTH",r.status);if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'
```

اگر شاخهٔ فعلی `main` است، فایل‌های محلی تغییر نکرده‌اند و بررسی صحت صدا موفق است:

```bash
cd /opt/sanatpish
git fetch origin main
git pull --ff-only origin main
sudo /usr/local/sbin/sanatpish-deploy
```

از `git reset --hard`، `docker system prune --volumes` یا پاک‌کردن پروژه استفاده نکنید. اگر `git pull --ff-only` یا deploy خطا داد، **ادامه ندهید** و خروجی بدون اطلاعات محرمانه را بررسی کنید. اگر اسکریپت deploy به‌طور خودکار جدیدترین کامیت را می‌گیرد، `git pull` فقط تغییر منبع را مشخص می‌کند و اجرای اسکریپت همان مسیر استقرار رسمی موجود است.

## تست پس از استقرار

```bash
curl -fsS --max-time 15 http://127.0.0.1:3001/api/health
curl -sS --max-time 45 -D /tmp/forza-head.txt -o /tmp/forza-test.wav \
  -w 'FORZA HTTP=%{http_code} TTOTAL=%{time_total}s BYTES=%{size_download}\n' \
  -H 'Content-Type: application/json' \
  --data '{"text":"سلام، مشخصات قطعات مورد نیاز شما را بررسی می‌کنم."}' \
  http://127.0.0.1:3001/api/ai/forza-speech
grep -i '^x-forza-voice-backend:' /tmp/forza-head.txt
file /tmp/forza-test.wav
docker logs --tail 25 forza-voice
```

پاسخ درست: HTTP 200، هدر `private-service` و PCM WAV با فرکانس ۲۴۰۰۰ هرتز. سپس در صفحهٔ Ubuntu `/ai-forza` با Chrome و مجوز میکروفون یک جملهٔ فارسی بگویید؛ کلمات باید **قبل از اتمام جمله** در حباب «شما» ظاهر شوند. یک سؤال طولانی بپرسید و در Console دنبال `FORZA_AUDIO_UNDERRUN` بگردید؛ صفر بودن آن در یک نمونه، عملکرد همهٔ کاربران را تضمین نمی‌کند. سرعت اولین صدا و طول مکث‌ها را روی CPU واقعی خودتان بسنجید.

## برگشت

کامیت قبلی در `/root/sanatpish-before-live-voice.txt` ذخیره شده است. ابتدا `git status` و آن کامیت را بررسی کنید؛ بدون اطلاع از تغییرات محلی، `reset --hard` نزنید. این اصلاح به کانتینر `forza-voice`، دیتابیس یا اسرار سرور دست نمی‌زند و بازگشت فقط به کد اپ وب مربوط است.
