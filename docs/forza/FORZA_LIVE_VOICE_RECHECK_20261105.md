# بررسی مجدد و اصلاح تماس صوتی FORZA — ۱۵ آبان ۱۴۰۵ / 2026-11-05

## حدود دسترسی و شواهد

- مبنای جدید و تأییدشدهٔ مخزن: `main@8cb3893fe7e996d698681f69130117572b63e843`، نه commit قدیمی `c6bdf...`. تغییرات فقط در شاخه `fix/forza-live-voice-recovery-20261105` و Draft PR #272 است.
- مرورگر کاربر در دامنه `https://www.sanatpish.com/ai-forza` وجود پاسخ متنی و اعلان «پاسخ آماده است؛ در حال تولید صدا (0 ثانیه)» را نشان داد. این **شاهد رابط** است نه تشخیص گلوگاه TTS.
- اتصال مستقیم از محیط اجرای این بررسی به `https://87.107.152.92` برقرار نشد؛ IP مذکور نیز برای گواهی دامنه مبنای صحیح تست TLS نیست. **نسخه فعال Docker و CPU/RAM فعلی قابل ادعای تأیید نیست.** مرورگر بدون دسترسی SSH شناسهٔ ایمیج یا منابع میزبان را آشکار نمی‌کند.
- شواهد تاریخی کاربر شامل «TTFT حدود 6449ms، اولین عبارت TTS حدود 6781ms، WAV اول 1590ms بعد از درخواست صوت و آماده‌شدن حدود 8.4s» و یک gap بعدی 10.09s است. این‌ها **نمونهٔ قبل از تغییر** هستند؛ میانگین تازه و تأیید پخش شنیدنی محسوب نمی‌شوند.
- صدای مردانه Piper Nima تغییر نکرده است. سرویس فعلی هر عبارت را کامل در `BytesIO` تولید می‌کند، سپس WAV را می‌فرستد؛ `/speak-stream` هنوز فقط قاب‌بندیِ WAV کامل است، نه PCM تدریجی مدل.

## یافته‌ها، کد تغییرکرده، تست و محدودیت

| مسئله | شاهد در سورس جدید | تغییر | تست / محدودیت |
|---|---|---|---|
| TTFT نامشخص | زمینهٔ کاتالوگ قبل از هدر SSE و انتخاب ارائه‌دهنده در Node؛ xKiro کش کشف مدل و ۲ تلاش را دارد | `server.ts`: start SSE پیش از زمینه، لاگ catalogMs/provider/node_first_delta؛ `forzaStreamClient.ts`: رویداد واقعی start/provider/first_delta/done/error/EOF | تست parser ساختگی؛ مدل انتخاب‌شده و منابع ۶٫۴۵ ثانیه باید از لاگ واقعی VPS سنجیده شود |
| عبارت میانی TTS معلق می‌ماند | `heldPhrase` منتظر عبارت بعدی یا done بود | `forzaIncrementalSpeechText.ts`: `flushStableIdle()`؛ `AiForzaCallExperience.tsx`: 380ms بعد از توقف دلتا فقط گروه کامل، نه کلمه ناتمام، آزاد می‌شود | تست کلمه/کد ناتمام و عدم تکرار؛ قطع طولانی مدل یا CPU کند هنوز ممکن است |
| شنیدن هنگام پاسخ ناقص | `stopListening()` در شروع هر نوبت، سپس تلاش برای restart | `AiForzaCallExperience.tsx`: میکروفون/recognizer نگه داشته می‌شوند، محتوای نوبت قبلی با cursor جدا، قطع تایپی و دکمه توقف فعال است | تست قرارداد + مرورگر GitHub؛ **اکوی بلندگوی واقعی و زمان کمتر از ۳۰۰ms هنوز تأیید نشده‌اند** |
| تکرار سؤال قدیمی در WebSpeech | نتایج Chrome تجمعی‌اند و قبلاً از ابتدا بازخوانی می‌شدند | `forzaSpeechPipeline.ts`: `extractPersianSpeechSince` و cursor هر نوبت در صفحه | تست اصلاح «6202ZZ… نه، 6203ZZ»؛ اعتماد به کد صنعتی همچنان محدود به دقت STT است |
| وضع speaking نادرست | status بر اساس صف و تایمر می‌توانست همچنان speaking/producing بماند | UI حالت‌های متن/ساخت/بافر/پخش را جدا کرده؛ `forzaContinuousWav.ts` resume معلق را محدود کرده و monitor توقف AudioContext دارد | تست واحد و browser smoke؛ WebAudio source شروع‌شده معادل صدای واقعاً شنیده‌شده نیست |
| ظرفیت/429 | ۲۴ درخواست صوت در دقیقه برای IP مشترک، هر جمله یک درخواست | `forzaTtsBudget.ts`, `server.ts`: سقف مشترک ۶۰/دقیقه + سقف ۱۲/نوبت؛ 429 دارای Retry-After؛ شناسهٔ مرورگر فقط برای گروه‌بندی است نه احراز هویت | تست NAT، bypass با شناسه جدید، reset؛ `req.ip` پشت Nginx باید در VPS تأیید شود؛ بدون سنجش ظرفیت سرور تضمینی نیست |
| ذخیرهٔ ناخواستهٔ صدا | مسیر قدیمی Gemini/Worker کش دیسکی WAV داشت | `server.ts`: خواندن/نوشتن کش دیسکی برای صوت مشتری غیرفعال؛ RAM محدود باقی است | فایل‌های تاریخی دست‌نخورده‌اند و خودکار پاک نشده‌اند؛ برای پاکسازی نیاز به تصمیم جداست |
| بار WebGL | ذرات گزارش‌شده حدود ۱۳۴ هزار و FPS پایین در شواهد قبلی | `ParticleAvatar.tsx`: نمونه‌برداری کاهش‌یافته در balanced/low و DPR مناسب؛ صفحه انتخاب خودکار low برای موبایل/CPU کم، افت کیفیت پس از FPS پایین و نمایش FPS واقعی | تست محافظت سورس؛ میزان بهبود FPS دستگاه واقعی بعد از استقرار هنوز اندازه‌گیری نشده |
| version parity | سلامت قبلی فقط status/DB داشت، SHA نسخهٔ مستقر روشن نبود | `ops/deploy-single-port-vps.sh`: قرار دادن SHA واقعی و pin‌شده در کانتینر canary و live، `server.ts`: `/api/health.revision` | بعد از deploy جدید قابل استعلام؛ روی کانتینر قدیمی ممکن است unknown برگردد |

## مراحل اندازه‌گیری قابل اتکا

- `FORZA_LATENCY phase=vad_end_detected`: پایان تخمینی صوت از آخرین PCM فعال VAD، نه لحظهٔ پرسش کاربر با دقت مطلق.
- `FORZA_STT` و `phase=browser_stt_turn_end`: نهایی‌شدن STT؛ تشخیص مرورگر و POST پس از ضبط باید تفکیک شوند.
- `FORZA_LATENCY phase=llm_request_sent`: ارسال سؤال از مرورگر.
- `FORZA_TEXT_STAGE phase=catalog_ready/provider_selected/node_first_delta`: زمان داخل Node و تا اولین قطعه واقعی متن به پاسخ SSE. سرویس xKiro یا Worker ممکن است bottleneck باشد.
- `FORZA_TEXT_STAGE phase=browser_start/provider/first_delta/done/error/incomplete`: رسیدن رویدادها به مرورگر؛ از ساعت مرورگر برای فاصله‌ها استفاده شود نه تفاضل مستقیم ساعت سرور.
- `FORZA_NIMA_LATENCY phase=first-tts-phrase-queued`: نخستین عبارت آمادهٔ گفتار.
- `FORZA_TTS_STAGE phase=server_responded` و هدرهای `X-Forza-Queue-Ms`, `X-Forza-Inference-Ms`: صف/پردازش واقعی Nima و زمان پراکسی. `phase=phrase_wav_ready` طول/حجم/انتظار سمت مرورگر را نشان می‌دهد.
- `FORZA_AUDIO_STAGE`: دریافت، decode، زمان‌بندی و شروع منبع صوت `AudioContext`؛ `FORZA_AUDIO_UNDERRUN` مدت خالی‌بودن صف را ثبت می‌کند.
- `FORZA_END_TO_AUDIO`: n، **meanMs/medianMs/p95Ms** از نمونه‌های همان نشست، فقط در RAM. دادهٔ جدید تنها پس از تماس واقعی تولید می‌شود؛ تا این زمان **هیچ مقدار تازه‌ای گزارش نشده**.
- تأیید شنیده‌شدن واقعی نیازمند آزمون شنیداری و در صورت لزوم اندازه‌گیری صوت خروجی از دستگاه است.

## الزامات پذیرش عملیاتیِ اجرا‌نشده

۱. ≥۲۰ نوبت فارسی واقعی: سؤال کوتاه، مکث میان جمله، اصلاح عدد/کد فنی، «نه منظورم»، «صبر کن»، «ادامه بده»، چند نوبت پیاپی؛ ثبت درصد موفقیت، mean/median/p95 end-to-first-playback بدون ذخیره صوت یا transcript.

۲. هدفون و بلندگوی گوشی در Chrome Android و Safari iOS؛ تشخیص اکو، اولین هجا، رفتار وسط پاسخ، تأخیر قطع گفتار. داشتن AEC مرورگر *تفکیک گوینده نیست*.

۳. شبکه کند، قطع موقت SSE، پایان بدون done، TTS 429/503 و AudioContext suspended؛ وضعیت صادقانه UI و امکان ادامه گفت‌وگو.

۴. تست تدریجی ۱، ۳ و ۱۰ نشست با رضایت و محدودیت بار؛ اندازه‌گیری CPU/RAM، صف، تلفات، درخواست‌های 429/503 و فشار DB. سرور قبلاً ۳ هسته، ۵٫۸GiB، بدون GPU گزارش شده، اما *تأیید فعلی نیست*.

۵. SLO پیشنهادی ۲s شروع صوت پس از پایان سؤال و ۳۰۰ms قطع پخش پس از **تشخیص** گفتار مشتری؛ نه تضمین‌شده و نه در GitHub Actions قابل اثبات.

## اجرای ایمن ممیزی VPS (بدون deploy)

وقتی این شاخه با CI موفق آماده شد، روی میزبان ابتدا بررسی کنید که فایل‌های محلی تغییر نکرده باشند. برای نسخهٔ فعلی PR:
```bash
cd /opt/sanatpish
git status --short
git fetch origin fix/forza-live-voice-recovery-20261105
git show origin/fix/forza-live-voice-recovery-20261105:ops/forza-live-voice-audit-readonly.sh > /tmp/forza-live-voice-audit-readonly.sh
bash -n /tmp/forza-live-voice-audit-readonly.sh
sudo bash /tmp/forza-live-voice-audit-readonly.sh
```
هیچ `reset --hard`, `git clean`, `docker prune`, `rm` و تغییر DB لازم نیست. خروجی این دستور شامل SHA فعال، اطلاعات منابع، سلامت HTTPS دامنه با اعتبارسنجی گواهی و مشخصات غیرمحرمانه STT/Nima است. **اگر سلامت TLS دامنه ناموفق بود، `-k` را برای دامنه واقعی جایگزین نکنید؛ گواهی و Nginx را اصلاح کنید.**

پس از ادغام در `main` و انتشار ایمن توسط اسکریپت انتشار pin‌شده، مقایسهٔ SHA منتشرشده با `/api/health.revision` و تست صوتی اجباری است. این گزارش **ادعای استقرار ندارد**.
