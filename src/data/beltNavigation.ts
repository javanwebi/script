import type { Product } from "../types";
export const BELT_MENU = [
  { name: "تسمه V-BELT", children: [{ name: "اسپشیال" }, { name: "کلاسیک" }] },
  {
    name: "تسمه CRC پنج ضلعی",
    children: [{ name: "جوشی پلی یورتان" }, { name: "فابریک" }],
  },
  { name: "تسمه گرد پلی اورتان" },
  {
    name: "تسمه تایمینگ",
    children: [{ name: "فابریک لاستیکی" }, { name: "سیمار" }],
  },
  {
    name: "تسمه شیاری",
    children: [{ name: "PK" }, { name: "PY" }, { name: "PL" }],
  },
];
const clean = (s: string) =>
  s
    .toUpperCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\s\u200c_-]+/g, "");
export function matchesBeltSelection(
  p: Product,
  selection: string,
): boolean | undefined {
  const known = BELT_MENU.some(
    (n) =>
      n.name === selection || n.children?.some((c) => c.name === selection),
  );
  if (!known) return undefined;
  const source = clean(
    [
      p.name,
      p.nameEn,
      p.submenu,
      p.subcategory,
      ...(p.tags || []),
      ...(p.technicalSpecs || []).map((s) => s.value),
    ].join(" "),
  );
  const identity = clean(
    [
      p.name,
      p.nameEn,
      ...(p.variants || []).map((v) => v.code + " " + v.size),
    ].join(" "),
  );
  const timing = /تایم|تایمین|سیمدار/.test(source),
    crc = /CRC|پنجضلعی/.test(source);
  switch (selection) {
    case "تسمه V-BELT":
      return /تسمهV|VBELT|پروفیلباریک|کلاسیک/.test(source);
    case "اسپشیال":
      return (
        /پروفیلباریک|اسپشیال|SPECIAL/.test(source) ||
        /\bSP[ABCZ]\b/i.test(p.name)
      );
    case "کلاسیک":
      return /کلاسیک|CLASSIC/.test(source);
    case "تسمه CRC پنج ضلعی":
      return crc;
    case "جوشی پلی یورتان":
      return crc && /جوش|WELD/.test(source);
    case "فابریک":
      return crc && /فابریک|FABRIC/.test(source);
    case "تسمه گرد پلی اورتان":
      return (
        /گرد/.test(source) &&
        /پلی[یاآ]?ورتان|پلییورتان|POLYURETHANE/.test(source) &&
        !timing
      );
    case "تسمه تایمینگ":
      return timing;
    case "فابریک لاستیکی":
      return timing && /لاستیک|RUBBER/.test(source) && !/سیمدار/.test(source);
    case "سیمار":
      return timing && /سیمدار|سیمار|STEELCORD/.test(source);
    case "تسمه شیاری":
      return /شیاری/.test(source);
    default:
      return new RegExp("(^|[^A-Z])" + selection + "([^A-Z]|$)").test(identity);
  }
}
