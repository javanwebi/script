/**
 * FORZA Vision -> Desk handoff. Only pass text and catalogue references.
 * Customer image bytes, local vault IDs and temporary image URLs must not enter
 * consultation history, query parameters or CRM text.
 */
export type VisionConsultCandidate = {
  code: string;
  name: string;
  brand?: string;
  size?: string;
  isSimilar?: boolean;
};
export type VisionConsultSummary = {
  detectedPartType?: string;
  detectedProfile?: string;
};

const clean = (value: unknown, limit = 140) =>
  String(value || '').replace(/[\r\n\[\]{}<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);

/**
 * A photo match is a candidate, not a confirmed mechanical substitute.
 * Never request speculative price/stock, assert visual certainty, or invent SKU.
 */
export function buildVisionConsultationPrompt(
  candidate?: VisionConsultCandidate,
  summary?: VisionConsultSummary,
): string | null {
  if (candidate?.code?.trim()) {
    const code = clean(candidate.code, 110);
    if (!code) return null;
    const name = clean(candidate.name || code, 180);
    const brand = clean(candidate.brand, 80);
    const size = clean(candidate.size, 100);
    const relation = candidate.isSimilar
      ? 'این مورد فقط نامزد مشابه ظاهری است و تطابق یا قابلیت جایگزینی آن تأیید نشده است.'
      : 'این مورد از نتایج جست‌وجوی تصویری انتخاب شده اما انطباق فنی قطعی هنوز تأیید نشده است.';
    return `برای قطعه «${name}» با کد ثبت‌شده ${code}${brand ? ' و برند ' + brand : ''}${size ? ' و مشخصه ' + size : ''} مشاوره فنی می‌خواهم. ${relation} بر اساس داده‌های واقعی کاتالوگ، معیارهای تطبیق با دستگاه، مشخصات نیازمند تأیید و گام بعدی را توضیح بده. فقط یک سؤال ضروری درباره شرایط کار بپرس. قیمت، موجودی، اصالت یا سازگاری را بدون اطلاعات معتبر قطعی اعلام نکن.`;
  }
  const kind = clean(summary?.detectedPartType, 120);
  const profile = clean(summary?.detectedProfile, 120);
  if (!kind && !profile) return null;
  return `در شناسایی تصویری، نوع قطعه «${kind || 'نامشخص'}»${profile ? ' و پروفیل احتمالی «' + profile + '»' : ''} گزارش شده است. هیچ کد کالای مطابقی تأیید نشده است. برای تشخیص دقیق، یک سؤال درباره ابعاد، مارکینگ یا کاربرد بپرس و در صورت نبود تطابق، مسیر استعلام یا ساخت سفارشی را پیشنهاد بده. محصول، قیمت یا موجودی فرضی اعلام نکن.`;
}
