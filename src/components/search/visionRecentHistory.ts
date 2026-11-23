import { getProductImageUrl } from '../../assets/imagesproducts';

export interface VisionRecentSearchItem {
  id: string;
  title: string;
  subtitle: string;
  timeLabel: string;
  imageUrl: string;
  code?: string;
  partHint?: string;
}

const STORAGE_KEY = 'sanatpish_forza_vision_recent_v1';

export const DEFAULT_RECENT_SEARCHES: VisionRecentSearchItem[] = [
  {
    id: 'recent-bearing',
    title: 'بلبرینگ شیار عمیق',
    subtitle: 'کد مرجع AT-E383 · سری ۶۲۰۰',
    timeLabel: 'امروز ۱۰:۴۴',
    imageUrl: getProductImageUrl('e(383).png'),
    code: 'AT-E383',
    partHint: 'بلبرینگ شیار عمیق صنعتی 6206',
  },
  {
    id: 'recent-belt',
    title: 'تسمه دندانه‌ای HTD',
    subtitle: 'کد مرجع AT-E010 · انتقال قدرت',
    timeLabel: 'دیروز ۱۶:۲۲',
    imageUrl: getProductImageUrl('e(10).png'),
    code: 'AT-E010',
    partHint: 'تسمه تایمینگ HTD 8M',
  },
  {
    id: 'recent-knob',
    title: 'پیچ دسته‌دار ستاره‌ای',
    subtitle: 'کد مرجع AT-E014 · فیکسچر خط',
    timeLabel: '۳ روز پیش',
    imageUrl: getProductImageUrl('e(14).png'),
    code: 'AT-E014',
    partHint: 'پیچ دسته‌دار صنعتی M8',
  },
  {
    id: 'recent-rail',
    title: 'ریل راهنمای خط انتقال',
    subtitle: 'کد مرجع AT-E319 · پروفیل ضدسایش',
    timeLabel: 'هفته گذشته',
    imageUrl: getProductImageUrl('e(319).png'),
    code: 'AT-E319',
    partHint: 'ریل راهنمای صنعتی نقاله',
  },
];

export function loadVisionRecentSearches(): VisionRecentSearchItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RECENT_SEARCHES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_RECENT_SEARCHES;
    return parsed.slice(0, 8);
  } catch {
    return DEFAULT_RECENT_SEARCHES;
  }
}

export function recordVisionRecentSearch(entry: {
  title: string;
  subtitle: string;
  imageUrl: string;
  code?: string;
  partHint?: string;
}): VisionRecentSearchItem[] {
  const existing = loadVisionRecentSearches();
  const safeImage = entry.imageUrl.startsWith('data:') && entry.imageUrl.length > 180000
    ? getProductImageUrl('e(383).png')
    : entry.imageUrl;
  const now = new Date();
  const timeLabel = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const nextItem: VisionRecentSearchItem = {
    id: 'recent-' + Date.now(),
    title: entry.title || 'قطعه صنعتی شناسایی‌شده',
    subtitle: entry.subtitle || (entry.code ? `کد مرجع ${entry.code}` : 'تحلیل تصویری کاتالوگ'),
    timeLabel: `امروز ${timeLabel}`,
    imageUrl: safeImage,
    code: entry.code,
    partHint: entry.partHint,
  };
  const deduped = existing.filter(
    (item) => item.title !== nextItem.title || item.code !== nextItem.code,
  );
  const updated = [nextItem, ...deduped].slice(0, 8);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors cleanly
  }
  return updated;
}