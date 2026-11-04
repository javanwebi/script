# گزارش ممیزی تماس AI FORZA — ۱۴ آبان ۱۴۰۵ / 2026-11-04

## محدوده و مرجع
- مبنای سورس: main@2eafc2666407cd2ecdad22f3bc44e7a77af0bedd
- تغییرات فقط در شاخه fix/forza-call-live-plain-speech-20261104، PR #267؛ بدون ادغام یا استقرار.
- نسخه مستقر از طریق SSH، میکروفون/بلندگو یا مرورگر تعاملی مستقیماً آزمایش نشده؛ نمونه‌های تأخیر قبلی وضعیت قطعی فعلی نیستند.
- مسیر فعال در AiForzaCallExperience.tsx: SpeechRecognition مرورگر (fa-IR) یا استریم خروجی local recognizer در صورت آماده بودن؛ MediaRecorder -> /api/ai/forza-live transcribeOnly مسیر جایگزین *پس از پایان ضبط* است، نه STT استریم همیشگی روی سرور.
- مسیر پاسخ: /api/ai/consult-stream -> ForzaCallPlainText -> ForzaIncrementalSpeechText -> /api/ai/forza-speech -> Piper Nima -> ForzaContinuousWav.
- وجود forzaRealtimeClient.ts به معنی استفاده آن در این صفحه نیست.

## یافته‌های مستند و اصلاحات
1. مکث اول: تقسیم‌کننده فعلی نخستین عبارت را تا آستانه ۳۸ کاراکتر نگه می‌داشت. نخستین جمله کوتاه تمام‌شده اکنون بدون انتظار آستانه وارد صف می‌شود. فایل: src/utils/forzaIncrementalSpeechText.ts.
2. نشانه‌های Markdown: قطعه‌های استریم بدون پاک‌سازی وارد زیرنویس و تقسیم‌کننده می‌شدند. پروژکتور افزایشی مخصوص تماس، ستاره‌های شکسته، تیتر، لینک Markdown، URL خام و کدبلاک را حذف می‌کند؛ عنوان لینک و کدهای فنی حفظ می‌شوند. فایل‌ها: src/utils/forzaCallPlainText.ts و AiForzaCallExperience.tsx.
3. تلفظ ابعاد: نمایش «۱۰×۲۰» باقی می‌ماند و نسخه گفتاری «ده در بیست» می‌شود؛ SPA 1250، 6202ZZ، C3 و عدد اعشاری در نسخه نمایش حفظ می‌شوند.
4. قطع پاسخ: شرط رد صرفاً به‌خاطر شباهت متن گفتار کاربر با پاسخ AI از مسیر قطع حذف شد؛ شواهد VAD و STT همچنان نیاز است. حذف اکو واقعی هنوز با دستگاه و بلندگوی واقعی اثبات نشده؛ از headphones برای canary استفاده شود.
5. زمینه قطع: تمام شدن واقعی هر WAV و قطع وسط یک WAV از هم جدا شده‌اند. پیام توضیحیِ فقط در حافظه، عبارت کامل و کسر زمانی پخش عبارت ناتمام را تفکیک می‌کند. این، تخمین پخش WebAudio است، نه اندازه‌گیری صدای شنیده‌شده از گوش کاربر.
6. معیار زمان: از آخرین فریم فعال تشخیص‌داده‌شده VAD تا اولین شروع منبع WebAudio، اندازه تخمینی در console با FORZA_END_TO_AUDIO ثبت می‌شود؛ median و p95 مرورگر تا ۲۰۰ نمونه فقط در RAM حفظ می‌شود. اندازه‌های مرحله‌ای queue/inference از X-Forza-Queue-Ms و X-Forza-Inference-Ms، دانلود، decode و start موجود است.
7. پرامپت: خروجی ساده فارسی بدون Markdown و پاسخ کوتاه زمینه‌مند فقط در mode=forza در سرور Gemini / B.AI / worker تنظیم شده است؛ قالب‌بندی سایر بخش‌های سایت دست‌نخورده است.
8. صدای نیما و مدل/کلیدها تغییر نکرده‌اند. فایل scripts/forza_nima_voice_http.py همچنان هر عبارت را کامل در BytesIO می‌سازد و سپس یک WAV می‌فرستد؛ /speak-stream در موتور نیما خروجی نمونه‌به‌نمونه نیست.
9. سرویس نیما در سورس فقط یک inference هم‌زمان و مجموع دو نوبت فعال/منتظر دارد. تعداد worker بدون سنجش CPU/RAM افزایش نیافته است.

## اجرای تست بدون دست‌کاری سایت زنده
در GitHub Actions: workflow «FORZA Nima private voice and SSE speech tests» و «Unified Sanat Pish main integration». برای اجرای محلی روی سورس شاخه فوق:
```sh
npm ci --ignore-scripts
node --import tsx --test tests/forzaCallPlainText.test.ts tests/forzaNimaIncrementalSpeech.test.ts tests/forzaNimaBufferedSpeech.test.ts tests/forza-continuous-wav.test.ts tests/forzaBargeIn.test.ts tests/forza-smart-turn.test.ts tests/forza-speech-pipeline.test.ts
npm run lint
```
این تست‌ها کد را بررسی می‌کنند، نه سرعت واقعی تماس روی VPS یا تشخیص اکو در محیط کارخانه.

## بررسی صرفاً خواندنی VPS — بدون حذف یا overwrite
```sh
cd /opt/sanatpish
printf 'CHECKED_OUT='; git rev-parse HEAD
printf 'LOCAL_CHANGES\n'; git status --short
printf 'REMOTE_MAIN='; git ls-remote origin refs/heads/main
printf '\nCPU/RAM/DISK\n'; nproc; free -h; df -h /
printf '\nCONTAINERS\n'; docker ps --format '{{.Names}}  {{.Image}}  {{.Status}}'
printf '\nLIVE_USAGE\n'; docker stats --no-stream --format '{{.Name}} CPU={{.CPUPerc}} MEM={{.MemUsage}}'
for path in /api/health /api/ai/forza-voice-info /api/ai/forza-stt-info; do
  echo "$path"
  curl --noproxy '*' -kfsS --max-time 8 "https://127.0.0.1$path"
  echo
done
```
این دستورها هیچ سرویس یا فایل پروژه را تغییر نمی‌دهند و کلیدی نمایش نمی‌دهند.

## برنامه اعتبارسنجی عملیاتی (هنوز اجرا نشده)
- دست‌کم ۲۰ نوبت طبیعی فارسی، همراه سلام، «خیلی ضعیفه»، کدهای SPA 1250 و 6202ZZ، اصلاح «۶۲۰۲، نه، ۶۲۰۳»، مکث وسط جمله، توقف/ادامه و بارج‌این.
- ۲۰ نوبت با بلندگو، سپس با هدفون؛ بررسی محرک‌های کاذب اکو و از دست نرفتن نخستین هجا.
- دست‌کم ۱۰ نوبت شبکه ضعیف با Network throttling؛ گزارش underrun، resume AudioContext، mute و خرابی decode.
- چند نشست هم‌زمان با load محدود و واقعی؛ گزارش CPU/RAM، تعداد voice_busy و voice_queue_timeout بدون ذخیره محتوای صوتی.
- جدا کردن speech_end_estimated (آخرین PCM فعال VAD)، STT final، fetch ارسال، TTFT، TTS queued/headers/download، decode و playback_started در هر نمونه. پاسخ موفق فقط از شروع صوت پاسخِ مرتبط حساب می‌شود؛ «دارم بررسی می‌کنم» معیار موفقیت نیست.
- هدف SLO: p50 و p95 زمان end-to-first-audio و درصد درخواست‌های زیر ۲۰۰۰ ms باید پس از canary از داده واقعی گزارش شوند. فعلاً عدد جدید وجود ندارد.

## موارد حل‌نشده یا وابسته به اجرا
- حذف اکو نیازمند تست acoustic double-talk؛ similarity متن دیگر معیار رد قطعی نیست، اما VAD + browser AEC تضمین حذف صدای خروجی نیست.
- STT مرورگر در همه دستگاه‌ها قابلیت یکسان ندارد؛ مسیر سروریِ جایگزین فعلاً پس از ضبط است و متن موقت سروری ارائه نمی‌دهد.
- نیما full-WAV-per-phrase است؛ توقف وسط inference تنها با تشخیص قطع پس از chunk قابل اجراست؛ بهینه‌سازی واقعی استریم موتور نیازمند تغییر خود موتور/worker پس از benchmark است.
- تعلیق/خاموشی AudioContext و mute سخت‌افزاری نمی‌تواند به طور قطعی شنیدن صدا را اثبات کند. WebAudio زمان‌بندیِ شروع منبع صوتی را اندازه می‌گیرد.
- کدها و تست‌های legacy Pocket/Amir جدا از مسیر فعال نیما هستند و باید مستقل از این PR بازبینی شوند.

## تکمیل رفع خطاهای 503 و نبود STT سروری — 2026-11-04
- لاگ‌های ارسالی کاربر از سرویس خصوصی نیما: ۲۱ نمونه‌ی صف + inference با median=1948ms و p95=3682ms؛ نمونه‌های دیگری تا queue=596ms و inference=4290ms گزارش شده‌اند. این **زمان تماس از پایان گفتار تا شروع صدا نیست** و پس از هر استقرار نیاز به اندازه‌گیری مجدد دارد.
- چند HTTP 503 ثبت شده: یکی بدون generation_error (احتمال voice_busy/voice_queue_timeout)، دو مورد با generation_error=Error؛ علت‌های دقیقِ قبلی فقط از نوع Exception قابل تعیین نیست.
- اکنون هنگام خطای داخلی، نیما فقط نوع، ماژول، خط آخر traceback به‌صورت نام فایل و شماره خط، زمان و طول متن را ثبت می‌کند. **هیچ پیام خطا، متن مشتری، کلید، مدل کامل یا WAV در لاگ ثبت نمی‌شود**. این تغییر بعد از استقرار جدید کمک می‌کند محل خطای ONNX/phonemizer مشخص شود.
- 503های دسته‌بندی‌شده voice_busy، voice_queue_timeout و voice_unavailable در پراکسی Node فقط با backoff کوتاه، قابلیت قطع و تعداد تلاش محدود بازیابی می‌شوند؛ سایر خطاهای 403/timeout یا علت‌های ناشناخته دوباره اجرا نمی‌شوند. در بار بالا ممکن است درخواست همچنان رد شود؛ این اصلاح افزایش ظرفیت CPU یا تضمین کمتر از ۲ ثانیه نیست.
- در خروجی STT سرور: serverSttConfigured=false و reason=not_configured؛ در کانتینر FORZA_STT_PROVIDER و کلیدهای اختصاصی Gemini تعریف نشده‌اند. این PR کلید خریداری نمی‌کند یا STT سروری را بدون ارائه‌دهنده فعال نمی‌کند. UI در صورت شناسایی نبود ارائه‌دهنده، درخواست fallback صوتیِ حتماً ناموفق را ارسال نمی‌کند؛ SpeechRecognition مرورگر همچنان مستقل فعال می‌ماند.
- پیش‌فرض نیما تنها یک inference و مجموع دو جایگاه فعال/منتظر باقی مانده؛ منابع VPS و ظرفیت برای ده‌ها کاربر با این تغییر افزایش نیافته است.
- کد خروج 137 در کانتینرهای قدیمی با OOMKilled=false و بدون OOM در لاگ کرنل همراه بوده است؛ توقف اجباری موقع تعویض استقرار محتمل است، نه اثبات‌شده.
- برای تست شاخه، این موارد نیز به تست‌های پیشین اضافه شده‌اند:
```sh
node --import tsx --test tests/forzaVoiceRetry.test.ts
python3 tests/test_forza_nima_private.py
```
- شرایط انتشار: ادغام با آخرین main، CI سبز روی مسیر فعال Nima، canary ایزوله، تأیید عدم حذف داده/فایل، backup rollback و اندازه‌گیری درخواست واقعی. **تا انجام این مراحل، این شاخه روی سرور مستقر نیست.**
