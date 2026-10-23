import {durableStorage,databaseStorageEnabled} from "../services/durableStorage";
import { Brand } from '../types';

function createBrandBadgeSvg(title: string, subtitle: string, accent: string, darkBg = '#1E293B'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${darkBg}" />
        <stop offset="100%" stop-color="#0F172A" />
      </linearGradient>
    </defs>
    <rect width="320" height="180" rx="20" fill="url(#bg)" />
    <rect x="6" y="6" width="308" height="168" rx="15" fill="none" stroke="${accent}" stroke-width="2.5" stroke-opacity="0.55" />
    <circle cx="280" cy="35" r="45" fill="${accent}" fill-opacity="0.12" />
    <rect x="24" y="24" width="48" height="6" rx="3" fill="${accent}" />
    <text x="160" y="96" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="36" fill="#FFFFFF" letter-spacing="2">${title}</text>
    <text x="160" y="130" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-weight="700" font-size="13" fill="${accent}" letter-spacing="1">${subtitle}</text>
    <rect x="95" y="146" width="130" height="3" rx="1.5" fill="${accent}" fill-opacity="0.45" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const INITIAL_BRANDS: Brand[] = [
  {
    id: 'swr',
    name: 'اس دبلیو آر (SWR)',
    nameEn: 'SWR',
    country: 'آلمان / اروپا',
    description:
      'برند تخصصی و انحصاری انواع تسمه‌های صنعتی، تایمینگ، شیاری، پلی‌یورتان و دور متغیر با استاندارد مهندسی آلمان، مقاوم در برابر سایش و حرارت کوره.',
    isExclusive: true,
    logo: createBrandBadgeSvg('SWR', 'GERMAN INDUSTRIAL BELTS', '#F59E0B', '#1E293B'),
    image: createBrandBadgeSvg('SWR', 'GERMAN INDUSTRIAL BELTS', '#F59E0B', '#1E293B'),
    bannerImage: createBrandBadgeSvg('SWR GERMANY', 'TIMING & POWER BELTS', '#F59E0B', '#0F172A'),
    specialties: ['تسمه تایمینگ صنعتی', 'تسمه پلی‌یورتان کوره', 'تسمه شیاری و HTD'],
    active: true,
  },
  {
    id: 'forza',
    name: 'فورزا (FORZA)',
    nameEn: 'FORZA',
    country: 'ایتالیا / بین‌المللی',
    description:
      'برند پیشرو و انحصاری در تولید تسمه‌های انتقال قدرت سنگین، V-Belt، قطعات پلیمری و تجهیزات خطوط تولید کاشی، سرامیک، معدن و نساجی.',
    isExclusive: true,
    logo: createBrandBadgeSvg('FORZA', 'HEAVY DUTY POWER', '#EF4444', '#1E293B'),
    image: createBrandBadgeSvg('FORZA', 'HEAVY DUTY POWER', '#EF4444', '#1E293B'),
    bannerImage: createBrandBadgeSvg('FORZA ITALY', 'HEAVY DUTY TRANSMISSION', '#EF4444', '#111827'),
    specialties: ['تسمه V-Belt سنگین', 'انتقال قدرت معدن و کاشی', 'قطعات پلیمری پرفشار'],
    active: true,
  },
  {
    id: 'optibelt',
    name: 'اپتی‌بلت',
    nameEn: 'Optibelt',
    country: 'آلمان',
    description:
      'تولیدکننده برتر جهانی در زمینه تسمه‌های انتقال قدرت و تایمینگ با دقت میکرونی برای ماشین‌آلات حساس.',
    isExclusive: false,
    logo: createBrandBadgeSvg('OPTIBELT', 'GERMANY PRECISION', '#0EA5E9', '#0F172A'),
    image: createBrandBadgeSvg('OPTIBELT', 'GERMANY PRECISION', '#0EA5E9', '#0F172A'),
    specialties: ['تسمه تایمینگ دقیق', 'تسمه صنعتی آلمان'],
    active: true,
  },
  {
    id: 'megadyne',
    name: 'مگاداین',
    nameEn: 'Megadyne',
    country: 'ایتالیا',
    description:
      'متخصص در تسمه‌های پلی‌یورتان، تسمه‌های نقاله و تایمینگ مخصوص صنایع کاشی، سرامیک و بسته‌بندی.',
    isExclusive: false,
    logo: createBrandBadgeSvg('MEGADYNE', 'ITALY CERAMIC BELTS', '#10B981', '#064E3B'),
    image: createBrandBadgeSvg('MEGADYNE', 'ITALY CERAMIC BELTS', '#10B981', '#064E3B'),
    specialties: ['تسمه کوره و سرامیک', 'تسمه پلی‌یورتان ایتالیا'],
    active: true,
  },
  {
    id: 'gates',
    name: 'گیتس',
    nameEn: 'Gates',
    country: 'آمریکا / اروپا',
    description:
      'پیشگام فناوری تسمه‌های صنعتی، هیدرولیک و انتقال قدرت سنگین در صنایع نفت، گاز، فولاد و معادن.',
    isExclusive: false,
    logo: createBrandBadgeSvg('GATES', 'INDUSTRIAL POWER', '#F43F5E', '#18181B'),
    image: createBrandBadgeSvg('GATES', 'INDUSTRIAL POWER', '#F43F5E', '#18181B'),
    specialties: ['تسمه صنایع فولاد و معدن', 'تسمه هیدرولیک و سنگین'],
    active: true,
  },
  {
    id: 'continental',
    name: 'کنتیننتال (ContiTech)',
    nameEn: 'Continental',
    country: 'آلمان',
    description:
      'تولیدکننده تسمه‌های صنعتی و نوار نقاله‌های فوق سنگین با تکنولوژی لاستیک و پلیمر پیشرفته آلمان.',
    isExclusive: false,
    logo: createBrandBadgeSvg('CONTITECH', 'CONTINENTAL GERMANY', '#F59E0B', '#1C1917'),
    image: createBrandBadgeSvg('CONTITECH', 'CONTINENTAL GERMANY', '#F59E0B', '#1C1917'),
    specialties: ['تسمه نقاله سنگین', 'تسمه پلیمر آلمان'],
    active: true,
  },
  {
    id: 'skf',
    name: 'اس کا اف (SKF)',
    nameEn: 'SKF',
    country: 'سوئد',
    description:
      'بزرگ‌ترین تولیدکننده بلبرینگ، رولبرینگ، یاتاقان، کاسه‌نمد و تجهیزات انتقال قدرت صنعتی در جهان.',
    isExclusive: false,
    logo: createBrandBadgeSvg('SKF', 'SWEDEN BEARINGS', '#3B82F6', '#0F172A'),
    image: createBrandBadgeSvg('SKF', 'SWEDEN BEARINGS', '#3B82F6', '#0F172A'),
    specialties: ['بلبرینگ و رولبرینگ', 'یاتاقان و کاسه‌نمد'],
    active: true,
  },
  {
    id: 'fag',
    name: 'اف آ گ (FAG / INA)',
    nameEn: 'FAG',
    country: 'آلمان',
    description:
      'تولیدکننده بلبرینگ‌ها و یاتاقان‌های صنعتی دقیق آلمانی ویژه دورهای بالا و بارهای محوری سنگین.',
    isExclusive: false,
    logo: createBrandBadgeSvg('FAG • INA', 'SCHAEFFLER GERMANY', '#22C55E', '#052E16'),
    image: createBrandBadgeSvg('FAG • INA', 'SCHAEFFLER GERMANY', '#22C55E', '#052E16'),
    specialties: ['بلبرینگ دور بالا', 'یاتاقان صنعتی آلمان'],
    active: true,
  },
  {
    id: 'habasit',
    name: 'هاباسیت',
    nameEn: 'Habasit',
    country: 'سوئیس',
    description:
      'تولیدکننده تخصصی تسمه‌های نقاله، تسمه‌های مدولار و تسمه‌های نساجی و چاپ با بالاترین دوام.',
    isExclusive: false,
    logo: createBrandBadgeSvg('HABASIT', 'SWISS CONVEYOR BELTS', '#EC4899', '#1E1B4B'),
    image: createBrandBadgeSvg('HABASIT', 'SWISS CONVEYOR BELTS', '#EC4899', '#1E1B4B'),
    specialties: ['تسمه نقاله و مدولار', 'تسمه ماشین‌آلات نساجی'],
    active: true,
  },
  {
    id: 'atlas-parts',
    name: 'صنعت پیش اطلس',
    nameEn: 'Atlas Industrial',
    country: 'ایران (یزد)',
    description:
      'تولید و تأمین تخصصی قطعات ماشین‌آلات کاشی و سرامیک، غلتک کوره، چرخ‌دنده، پولی و قطعات نساجی با ضمانت کیفیت.',
    isExclusive: true,
    logo: createBrandBadgeSvg('ATLAS', 'SANAT PISH YAZD', '#E06518', '#1E293B'),
    image: createBrandBadgeSvg('ATLAS', 'SANAT PISH YAZD', '#E06518', '#1E293B'),
    specialties: ['چرخ‌دنده و پولی صنعتی', 'قطعات کوره کاشی و سرامیک'],
    active: true,
  },
];

// Published brands are hydrated from PostgreSQL; the static list is Node-only test data.
export const BRANDS: Brand[] = typeof window === 'undefined' ? INITIAL_BRANDS : [];

export function getManagedBrands(): Brand[] {
  if (typeof window !== 'undefined') {
    // Do not silently display hardcoded brands if PostgreSQL hydration failed.
    if (!databaseStorageEnabled()) return [];
    try {
      const stored = durableStorage.getItem('atlas_admin_brands_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && (databaseStorageEnabled() || parsed.length > 0)) {
          return parsed.map((b: Brand) => {
            const fallback = databaseStorageEnabled()?undefined:BRANDS.find(d => d.id === b.id);
            return {
              ...fallback,
              ...b,
              image: b.image || b.logo || fallback?.image || fallback?.logo || createBrandBadgeSvg(b.nameEn || b.name, b.country || 'INDUSTRIAL', '#E06518'),
              logo: b.logo || b.image || fallback?.logo || fallback?.image || createBrandBadgeSvg(b.nameEn || b.name, b.country || 'INDUSTRIAL', '#E06518'),
              active: b.active !== undefined ? b.active : true,
            };
          });
        }
      }
    } catch {
      // ignore
    }
  }
  return typeof window === 'undefined' ? BRANDS : [];
}
