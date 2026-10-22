import React, { useMemo, useState } from "react";
import type { ProductVariant, ProductGalleryImage } from "../../types";
import { normalizeCatalogueText } from "../../data/userProducts";
import { toPersianDigits } from "../../utils/formatters";
import { ProductImage } from "./ProductImage";
import { Check, Image as ImageIcon } from "lucide-react";

export interface ProductVariantsProps {
  variants: ProductVariant[];
  selected: string;
  onSelect: (code: string) => void;
  showPrices?: boolean;
  galleryImages?: ProductGalleryImage[];
}

export const ProductVariants: React.FC<ProductVariantsProps> = ({
  variants,
  selected,
  onSelect,
  galleryImages = [],
  showPrices = false,
}) => {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const results = useMemo(
    () =>
      variants.filter((v) =>
        normalizeCatalogueText(
          `${v.code} ${v.size} ${v.name} ${v.model || ""} ${v.brand || ""}`,
        ).includes(normalizeCatalogueText(query)),
      ),
    [variants, query],
  );

  const totalPages = Math.max(1, Math.ceil(results.length / 20));

  const getVariantLinkedImages = (variant: ProductVariant): string[] => {
    const fromGallery = galleryImages
      .filter(
        (img) => img.scope === "variant" && img.variantCode === variant.code,
      )
      .map((img) => img.url);
    if (fromGallery.length > 0) return fromGallery;
    return variant.images || [];
  };

  return (
    <section
      className="space-y-3 rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs"
      aria-label="سایزها و کدهای کالا"
    >
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <div>
          <h2 className="font-bold text-sm text-[#37383b]">
            انتخاب نوع، سایز و کد کالا
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            با انتخاب هر کد کالا، تصویر اختصاصی، مشخصات فنی و قیمت همان کد نمایش
            داده می‌شود.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-600">
          {toPersianDigits(variants.length)} کد کالا در این خانواده
        </span>
      </div>

      {variants.length > 3 && (
        <label className="block text-xs text-slate-600">
          جستجو در سایز، کد، مدل یا شرح کالا
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-[#E06518] focus:outline-none"
            placeholder="مثلاً 34265 یا Z18 یا 5*42"
          />
        </label>
      )}

      <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="sticky top-0 bg-slate-100 text-slate-700 z-10 border-b border-slate-200">
            <tr>
              <th className="p-2.5 font-bold">کد کالا</th>
              <th className="p-2.5 font-bold">سایز / مدل</th>
              <th className="p-2.5 font-bold">شرح دقیق نوع کالا</th>
              <th className="p-2.5 font-bold">تصویر</th>
              <th className="p-2.5 font-bold">اطلاعات خرید</th>
              <th className="p-2.5 font-bold text-center">انتخاب</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.slice((page - 1) * 20, page * 20).map((v) => {
              const isSelected = selected === v.code;
              const linkedImages = getVariantLinkedImages(v);
              const unitPrice = v.price ?? v.prices?.retail ?? 0;
              const isInquiry =
                v.inquiryOnly !== undefined ? v.inquiryOnly : unitPrice <= 0;

              return (
                <tr
                  key={v.code}
                  onClick={() => onSelect(v.code)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-orange-50/90 hover:bg-orange-50"
                      : "hover:bg-slate-50/80 bg-white"
                  }`}
                >
                  <td
                    className="p-2.5 font-mono font-bold text-slate-800 whitespace-nowrap"
                    dir="ltr"
                  >
                    {v.code}
                    {v.active === false && (
                      <span className="block text-[10px] font-sans text-rose-600">
                        غیرفعال موقت
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-slate-700" dir="auto">
                    <div className="font-semibold">{v.size || "—"}</div>
                    {v.model && (
                      <div
                        className="text-[10.5px] font-mono text-slate-500 mt-0.5"
                        dir="ltr"
                      >
                        {v.model}
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 min-w-44 leading-6 text-slate-800">
                    <div className="font-medium">{v.name}</div>
                    {v.brand && (
                      <div className="text-[10.5px] text-slate-500">
                        برند: {v.brand}
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {linkedImages.length > 0 ? (
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-8 h-8 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0">
                          <ProductImage
                            src={linkedImages[0]}
                            alt={v.name}
                            className="w-full h-full object-contain p-0.5"
                          />
                        </div>
                        {linkedImages.length > 1 && (
                          <span className="text-[10.5px] text-slate-500 font-medium">
                            +{toPersianDigits(linkedImages.length - 1)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10.5px] text-slate-400 inline-flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>عمومی</span>
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {showPrices && !isInquiry && unitPrice > 0 ? (
                      <div>
                        <span className="font-mono font-bold text-emerald-800">
                          {toPersianDigits(
                            new Intl.NumberFormat("fa-IR").format(unitPrice),
                          )}
                        </span>
                        <span className="text-[10.5px] text-slate-500 mr-1">
                          تومان
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700">
                        {showPrices ? "نیازمند استعلام" : "در پنل کاربری"}
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(v.code);
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors inline-flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? "bg-[#E06518] border-[#E06518] text-white"
                          : "border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>انتخاب‌شده</span>
                        </>
                      ) : (
                        <span>انتخاب {v.code}</span>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!results.length && (
          <p className="p-4 text-sm text-slate-500 text-center">
            کد یا سایز مطابق پیدا نشد.
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="disabled:opacity-40 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            قبلی
          </button>
          <span className="text-slate-600">
            صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
          </span>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="disabled:opacity-40 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            بعدی
          </button>
        </div>
      )}
    </section>
  );
};
