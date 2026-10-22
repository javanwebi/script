import type { Product } from "../types";
import { publicCatalog } from "./catalogPrivacy";
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[؟،,.!]/g, " ");
export function findCatalogKnowledge(
  products: Product[],
  query: string,
  limit = 8,
) {
  const terms = normalize(query)
    .split(/\s+/)
    .filter(
      (t) =>
        t.length > 1 &&
        ![
          "برای",
          "است",
          "چیست",
          "درباره",
          "مورد",
          "دارید",
          "قیمت",
          "موجودی",
          "لطفا",
          "این",
          "یک",
          "کد",
          "مشخصات",
        ].includes(t),
    );
  if (!terms.length) return [];
  return products
    .filter((p) => p.active !== false)
    .map((p) => {
      const variants = (p.variants || []).filter((v) => v.active !== false);
      const hay = normalize(
        [
          p.code,
          p.name,
          p.brand,
          p.categoryName,
          ...variants.flatMap((v) => [v.code, v.size, v.name, v.model]),
        ].join(" "),
      );
      const exact = terms.some(
        (t) =>
          normalize(p.code) === t ||
          variants.some((v) => normalize(v.code) === t),
      );
      const score =
        terms.reduce((sum, t) => sum + (hay.includes(t) ? 1 : 0), 0) +
        (exact ? 100 : 0);
      return { p, variants, exact, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p, variants }) =>
      publicCatalog({
        code: p.code,
        name: p.name,
        brand: p.brand,
        technicalSpecs: p.technicalSpecs,
        description: p.description,
        images: p.images,
        variants: variants
          .filter((v) =>
            terms.some((t) =>
              normalize([v.code, v.size, v.name, v.model].join(" ")).includes(
                t,
              ),
            ),
          )
          .slice(0, 20),
        link: "/product/" + encodeURIComponent(p.code),
      }),
    );
}
export function catalogFallback(
  matches: ReturnType<typeof findCatalogKnowledge>,
) {
  if (!matches.length)
    return "در حال حاضر پاسخ زنده هوش مصنوعی در دسترس نیست. برای بررسی کاتالوگ، کد کالا، نام قطعه یا ابعاد آن را بنویسید. شناسایی نهایی نیازمند تطبیق مشخصات است؛ قیمت و موجودی در پنل شما بررسی می‌شود.";
  return (
    "### نتیجه جستجو در کاتالوگ صنعت پیش\nاین پاسخ از داده ثبت‌شده کاتالوگ تهیه شده است؛ تحلیل زنده هوش مصنوعی در دسترس نیست.\n\n" +
    matches
      .map(
        (p) =>
          `**${p.name}** — کد خانواده: ${p.code}\n${p.variants.map((v) => `- کد ${v.code}؛ ${v.name || p.name}؛ ابعاد: ${v.size || "ثبت نشده"}`).join("\n")}\n[بررسی تصویر و مشخصات](${p.link})`,
      )
      .join("\n\n") +
    "\n\nبرای قیمت، موجودی و استعلام وارد پنل کاربری شوید. سازگاری نهایی با دستگاه باید تأیید شود."
  );
}
