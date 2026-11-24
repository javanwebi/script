import type { IndustryPageSlug } from "./industryPageDetails";

export type IndustryExperienceLayout =
  | "thermal"
  | "woven"
  | "conveyor"
  | "hygiene"
  | "blueprint"
  | "polymer";

export type IndustryExperienceDefinition = {
  layout: IndustryExperienceLayout;
  kicker: string;
  title: string;
  description: string;
};

export const INDUSTRY_EXPERIENCE: Record<IndustryPageSlug, IndustryExperienceDefinition> = {
  ceramic: {
    layout: "thermal",
    kicker: "مسیر حرارت و پخت",
    title: "از آماده‌سازی تا کوره؛ ایستگاه‌های خط را دنبال کنید",
    description: "در هر ایستگاه، کاربرد قطعه و شرایط محیطی همان بخش را جداگانه بررسی کنید.",
  },
  textile: {
    layout: "woven",
    kicker: "مسیر الیاف و حرکت",
    title: "از ریسندگی تا تکمیل؛ پیوستگی حرکت را ببینید",
    description: "سرعت، کشش، پرز و رطوبت در هر مرحله معنای متفاوتی برای انتخاب قطعه دارند.",
  },
  packaging: {
    layout: "conveyor",
    kicker: "مسیر پیوسته بسته‌بندی",
    title: "از ورود مواد تا خروج بسته؛ توالی خط را دنبال کنید",
    description: "ایستگاه‌ها به ترتیب حرکت محصول چیده شده‌اند؛ برای دیدن جزئیات هر بخش انتخاب کنید.",
  },
  food: {
    layout: "hygiene",
    kicker: "مسیر فرآوری کنترل‌شده",
    title: "فرآوری، انتقال و پرکنی را با شرایط تماس بخوانید",
    description: "نوع محصول، چرخه شست‌وشو، دما و مواد شوینده باید در بررسی هر قطعه لحاظ شوند.",
  },
  machinery: {
    layout: "blueprint",
    kicker: "مسیر مهندسی مجموعه",
    title: "از تعریف نیاز تا راه‌اندازی؛ اجزا را در ارتباط ببینید",
    description: "نقشه، تلرانس، بار و نوع اتصال را در کنار وظیفه هر ایستگاه بررسی کنید.",
  },
  rubber: {
    layout: "polymer",
    kicker: "مسیر مواد و شکل‌دهی",
    title: "از آماده‌سازی مواد تا خنک‌کاری و برش",
    description: "دما، فشار، سایش و سازگاری شیمیایی در هر بخش باید با شرایط واقعی سنجیده شوند.",
  },
};
