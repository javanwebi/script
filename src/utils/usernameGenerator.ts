/**
 * Deterministic Persian-to-English Transliteration and Username Generator
 * Converts Persian company/store names into clean, readable English usernames.
 * e.g.:
 * "اطلس صنعت" -> "atlas_sanat"
 * "بازرگانی پارس" -> "bazargani_pars"
 * "کارخانه فولاد شرق" -> "foolad_shargh"
 * "تأسیسات آریا" -> "tasisat_aria"
 */

// Common industrial & commercial prefixes/words mapped to standard concise English
const VOCAB_MAP: Record<string, string> = {
  'اطلس': 'atlas',
  'صنعت': 'sanat',
  'صنعتی': 'sanati',
  'بازرگانی': 'bazargani',
  'فولاد': 'foolad',
  'شرق': 'shargh',
  'غرب': 'gharb',
  'شمال': 'shomal',
  'جنوب': 'jonoob',
  'مرکز': 'markaz',
  'مرکزی': 'markazi',
  'پارس': 'pars',
  'پارسیان': 'parsian',
  'آریا': 'aria',
  'آرین': 'arian',
  'تأسیسات': 'tasisat',
  'تاسیسات': 'tasisat',
  'کارخانه': 'karkhaneh',
  'کارگاه': 'kargah',
  'شرکت': 'sherkat',
  'فروشگاه': 'store',
  'گروه': 'group',
  'تجهیز': 'tajhiz',
  'تجهیزات': 'tajhizat',
  'تسمه': 'tasmeh',
  'بلبرینگ': 'bearing',
  'پولی': 'pulley',
  'کاشی': 'kashi',
  'سرامیک': 'ceramic',
  'نساجی': 'nasaji',
  'میبد': 'meybod',
  'یزد': 'yazd',
  'تهران': 'tehran',
  'اصفهان': 'isfahan',
  'شیراز': 'shiraz',
  'مشهد': 'mashhad',
  'تبریز': 'tabriz',
  'اهواز': 'ahvaz',
  'ستاره': 'setareh',
  'کویر': 'kavir',
  'نگین': 'negin',
  'الماس': 'almas',
  'زرین': 'zarrin',
  'پتروشیمی': 'petroshimi',
  'نفت': 'naft',
  'گاز': 'gaz',
  'انرژی': 'energy',
  'پویا': 'pouya',
  'نوین': 'novin',
  'فناور': 'fanavar',
  'ابزار': 'abzar',
  'توسعه': 'toseeh',
  'پیشرو': 'pishro',
  'البرز': 'alborz',
  'زاگرس': 'zagros',
  'دماوند': 'damavand',
  'سپاهان': 'sepahan',
};

// Persian to English letter phonetic mapping
const CHAR_MAP: Record<string, string> = {
  'ا': 'a',
  'آ': 'a',
  'أ': 'a',
  'إ': 'e',
  'ب': 'b',
  'پ': 'p',
  'ت': 't',
  'ث': 's',
  'ج': 'j',
  'چ': 'ch',
  'ح': 'h',
  'خ': 'kh',
  'د': 'd',
  'ذ': 'z',
  'ر': 'r',
  'ز': 'z',
  'ژ': 'zh',
  'س': 's',
  'ش': 'sh',
  'ص': 's',
  'ض': 'z',
  'ط': 't',
  'ظ': 'z',
  'ع': 'a',
  'غ': 'gh',
  'ف': 'f',
  'ق': 'gh',
  'ک': 'k',
  'گ': 'g',
  'ل': 'l',
  'م': 'm',
  'ن': 'n',
  'و': 'v',
  'ه': 'h',
  'ی': 'y',
  'ي': 'y',
  'ئ': 'y',
  'ء': '',
  'ة': 'eh',
  'ؤ': 'o',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

// Words that can be omitted to keep username concise if there are more words
const IGNORED_WORDS = new Set(['شرکت', 'فروشگاه', 'کارخانه', 'گروه', 'بازرگانی']);

export function generateBaseUsername(companyName: string): string {
  if (!companyName || typeof companyName !== 'string') {
    return 'atlas_user';
  }

  // 1. Normalize Persian text
  let text = companyName
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width
    .replace(/[ـ\s]+/g, ' ')
    .toLowerCase();

  // 2. Split words
  const words = text.split(/[\s\-_،,.]+/).filter(Boolean);
  if (words.length === 0) return 'atlas_client';

  // If there are multiple words, prioritize the core distinctive name
  let filteredWords = words;
  if (words.length > 2) {
    const withoutCommon = words.filter(w => !IGNORED_WORDS.has(w));
    if (withoutCommon.length >= 2) {
      filteredWords = withoutCommon;
    }
  }

  // Limit to at most 3 words for concise usernames
  filteredWords = filteredWords.slice(0, 3);

  // 3. Transliterate words
  const transliteratedWords = filteredWords.map(word => {
    // Check known vocabulary map first
    if (VOCAB_MAP[word]) {
      return VOCAB_MAP[word];
    }

    // Otherwise phonetically map characters
    let out = '';
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (CHAR_MAP[char] !== undefined) {
        out += CHAR_MAP[char];
      } else if (/[a-z0-9]/.test(char)) {
        out += char;
      }
    }
    return out;
  }).filter(Boolean);

  let username = transliteratedWords.join('_');

  // 4. Clean and sanitize according to rules:
  // - English letters, numbers, underscore only
  // - No consecutive underscores
  // - Cannot start with a number
  // - Minimum length 3
  username = username
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!username) {
    username = 'atlas_co';
  }

  // Ensure it does not start with a number
  if (/^[0-9]/.test(username)) {
    username = `co_${username}`;
  }

  // Cap maximum length to 24 chars for neat readability
  if (username.length > 24) {
    username = username.slice(0, 24).replace(/_+$/, '');
  }

  return username;
}

/**
 * Normalizes phone number from +98, 0098, Persian digits, spaces to standard Iranian mobile format 09XXXXXXXXX
 */
export function normalizeIranianMobile(phone: string): { isValid: boolean; normalized: string; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, normalized: '', error: 'لطفاً شماره موبایل را وارد کنید.' };
  }

  // Convert Persian and Arabic digits to English
  let cleaned = phone
    .trim()
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[\s\-_()+.]/g, '');

  // Handle +98 or 0098 or 98
  if (cleaned.startsWith('0098')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('+98')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('98') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2);
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    cleaned = '0' + cleaned;
  }

  // Validation: Must start with 09 and be exactly 11 digits
  const iranianMobileRegex = /^09[0-9]{9}$/;
  if (!iranianMobileRegex.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      error: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود (مثلاً ۰۹۱۲۱۲۳۴۵۶۷).',
    };
  }

  return { isValid: true, normalized: cleaned };
}
