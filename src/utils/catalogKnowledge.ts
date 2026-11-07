import type { Product } from "../types";
import { publicCatalog } from "./catalogPrivacy";
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[؟،,.!]/g, " ");

const compactCode = (value:string) =>
  normalize(value).replace(/[\s\-_.\/]/g,'');

function exactCodeCandidates(query:string):Set<string>{
  const text=normalize(query)
    .replace(/زد\s+زد/g,' zz ')
    .replace(/زدزد/g,' zz ')
    .replace(/[-_./]/g,' ');
  const found:string[]=[];
  const patterns=[
    /(?<![a-z0-9])\d{3,6}[a-z0-9]{0,4}(?:\s+(?:zz|2z|rs|2rs|c[234]|llu|llb|nr)){0,2}(?![a-z0-9])/gi,
    /(?<![a-z0-9])(?:spz|spa|spb|spc|xpz|xpa|xpb|xpc|htd|std|rpp\d*)\s+\d{2,5}m?(?![a-z0-9])/gi,
    /(?<![a-z0-9])[a-z]{2,5}\d{2,5}(?:zz|2z|rs|2rs|c[234])?(?![a-z0-9])/gi,
  ];
  const profileMatches=[...text.matchAll(patterns[1])];
  const profileSizes=new Set(profileMatches.map(match=>
    compactCode((match[0].match(/\d{2,5}m?$/i)||[''])[0])));
  for(let i=0;i<patterns.length;i++)for(const match of text.matchAll(patterns[i])){
    const code=compactCode(match[0]);
    if(i===0&&/^\d{3,6}$/.test(code)&&profileSizes.has(code))continue;
    found.push(code);
  }
  // If the customer corrects an identifier in the same utterance, the final
  // code is authoritative; never retrieve the code they just rejected.
  if(found.length>1&&/(?:^|\s)(?:نه|منظورم|یعنی|اصلاحش|اشتباه)(?:\s|$)/.test(text))
    return new Set([found.at(-1)!]);
  return new Set(found);
}
export function findCatalogKnowledge(
  products: Product[],
  query: string,
  limit = 8,
) {
  const codeCandidates=exactCodeCandidates(query);
  const terms = normalize(query)
    .replace(/زد\s+زد/g,"zz")
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
      const exactVariants=variants.filter(v=>codeCandidates.has(compactCode(v.code)));
      const exactFamily=codeCandidates.has(compactCode(p.code));
      const exact = exactVariants.length>0 || exactFamily;
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
        variants: (exactVariants.length?exactVariants:variants.filter((v) =>
          terms.some((t) =>
            normalize([v.code, v.size, v.name, v.model].join(" ")).includes(t),
          ),
        )).slice(0, 20),
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
