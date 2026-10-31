#!/usr/bin/env python3
"""Deterministic Persian industrial text prompts for *licensed* voice recordings.

No audio generation, web calls, customer speech or private data. This is not
training data until a licensed same-speaker WAV exists for EACH exact line.
"""
import argparse
import itertools
import sys

PARTS = (
    "تسمه انتقال نیرو", "بلبرینگ صنعتی", "یاتاقان دستگاه",
    "گیربکس صنعتی", "کوپلینگ مکانیکی", "شیلنگ فشار قوی",
    "پولی تسمه", "آب بند مکانیکی", "پروفیل مهندسی",
    "نوار نقاله صنعتی",
)
SECTORS = (
    "خطوط کاشی و سرامیک", "دستگاه های نساجی",
    "ماشین آلات بسته بندی", "خطوط صنایع غذایی",
    "کارگاه های لاستیک و پلاستیک", "تجهیزات ماشین سازی",
)
TEMPLATES = (
    "برای انتخاب {part} در {sector} شماره فنی قطعه را اعلام کنید",
    "مشخصات {part} مورد استفاده در {sector} باید با نقشه فنی تطبیق داده شود",
    "اگر {part} در {sector} آسیب دیده است تصویر واضح آن را برای بررسی ارسال کنید",
    "هنگام سفارش {part} برای {sector} ابعاد و مدل دقیق دستگاه را بررسی می کنیم",
    "اگر {part} برای {sector} موجود نباشد امکان ثبت درخواست ساخت اختصاصی وجود دارد",
    "برای استعلام موجودی {part} مخصوص {sector} لطفا کد کالا را بفرمایید",
)


# Additional, varied industrial prosody.  The original 368 prompts MUST remain
# a stable prefix because previously approved pilot recordings are paired to
# their exact transcripts and cannot be silently relabelled.
EXTRA_TEMPLATES = (
    "بعد از نصب {part} در {sector} باید تراز شفت و فشار کاری بررسی شود",
    "در صورت ایجاد لرزش در {sector} سالم بودن {part} و قطعات متصل بررسی می شود",
    "برای جلوگیری از توقف {sector} پیشنهاد می کنیم {part} از نظر سایش کنترل شود",
    "بازه زمانی تعویض {part} در {sector} به میزان بار و شرایط محیط بستگی دارد",
    "هنگام مقایسه دو مدل {part} برای {sector} به ظرفیت و ابعاد دقت کنید",
    "اگر روی {part} در {sector} کد فنی ناخوانا باشد تصویر و اندازه قطعه کمک می کند",
)

SPECIAL = (
    "سلام من فورزا هستم و در صنعت پیش راهنمای شما خواهم بود",
    "تسمه اس پی آ هزار و دویست و پنجاه برای انتقال نیرو بررسی می شود",
    "قطر شفت دوازده میلی متر است و عرض تسمه سیزده میلی متر اندازه گیری شده",
    "شماره بلبرینگ شش هزار و دویست و دو زد زد را لطفا تکرار کنید",
    "اندازه طول تسمه برابر هزار و دویست و پنجاه میلی متر ثبت شده است",
    "برای جستجوی تصویری بهتر است قطعه را از چند زاویه عکاسی کنید",
    "نام برند و شماره فنی روی بدنه قطعه به تشخیص دقیق تر کمک می کند",
    "برای هماهنگی ارسال قطعه روش حمل را از پنل مشتری انتخاب کنید",
)


TOTAL_PROMPTS = len(SPECIAL) + len(PARTS) * len(SECTORS) * (len(TEMPLATES) + len(EXTRA_TEMPLATES))


def phrases():
    seen = set()
    for phrase in SPECIAL:
        if phrase not in seen:
            seen.add(phrase)
            yield phrase
    for part, sector, template in itertools.product(PARTS, SECTORS, TEMPLATES):
        value = template.format(part=part, sector=sector)
        if value not in seen:
            seen.add(value)
            yield value
    for part, sector, template in itertools.product(PARTS, SECTORS, EXTRA_TEMPLATES):
        value = template.format(part=part, sector=sector)
        if value not in seen:
            seen.add(value)
            yield value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=728)
    args = parser.parse_args()
    if args.limit < 1 or args.limit > TOTAL_PROMPTS:
        parser.error(f"limit must be 1..{TOTAL_PROMPTS}")
    count = 0
    for item in phrases():
        if count >= args.limit:
            break
        print(item)
        count += 1
    print(f"FORZA_CUSTOM_PROMPTS count={count} audio_generated=0", file=sys.stderr)


if __name__ == "__main__":
    main()
