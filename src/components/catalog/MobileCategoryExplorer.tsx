import React, { useEffect, useMemo, useState } from "react";
import "./mobile-category-explorer.css";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronLeft, Layers, Search, Factory, Cog, Package, Disc3, Wrench, ArrowLeft, X } from "lucide-react";
import { CategoryNavigation } from "./CategoryNavigation";
import type { EnhancedCategory } from "../../data/categories";
import { resolveCategorySlug } from "../../data/categories";
import { STORE_ASSETS } from "../../assets/images";
import { toPersianDigits } from "../../utils/formatters";
import { getManagedCatalogProducts, subscribeCatalogChanges } from "../../data/mockGenerator";

type GroupSection = {
  id: string;
  title: string;
  iconKey: string;
  categories: EnhancedCategory[];
};

const imageForCategory = (category: EnhancedCategory): string => {
  if (typeof category.image === "string" && category.image.trim()) return category.image;
  const name = category.name || "";
  if (/تسمه|وی.?بلت|تایمینگ|انتقال نیرو/i.test(name)) return STORE_ASSETS.categories.belts;
  if (/پولی|فولی/i.test(name)) return STORE_ASSETS.categories.pulleys;
  if (/زنجیر/i.test(name)) return STORE_ASSETS.categories.chains;
  if (/نقاله|رولر|غلتک/i.test(name)) return STORE_ASSETS.categories.conveyor;
  if (/بلبرینگ|یاتاقان/i.test(name)) return STORE_ASSETS.categories.bearings;
  return STORE_ASSETS.categories.transmission;
};

const iconForGroup = (title: string) => {
  if (/تسمه|نقاله|زنجیر/i.test(title)) return Layers;
  if (/بلبرینگ|رولر|پولی|ریل/i.test(title)) return Disc3;
  if (/نسوز|حرارتی|صنعت/i.test(title)) return Factory;
  if (/برس|سفارشی/i.test(title)) return Wrench;
  if (/مکانیکی|قطعات/i.test(title)) return Cog;
  return Package;
};

const categoryUrl = (category: EnhancedCategory) => "/category/" + resolveCategorySlug(category.slug);

/** Mobile-only, screenshot-directed two-column catalogue sheet.
 * Uses the exact approved Excel taxonomy passed by ReferenceMegaMenu.
 * No hardcoded categories, fake product counts or invented catalogue paths.
 */
export function MobileCategoryExplorer({
  sections,
  search,
  onSearch,
  onNavigate,
}: {
  sections: GroupSection[];
  search: string;
  onSearch: (value: string) => void;
  onNavigate?: () => void;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  useEffect(() => subscribeCatalogChanges(() => setCatalogRevision(revision => revision + 1)), []);
  const productImageByCategory = useMemo(() => {
    const images = new Map<string, string>();
    for (const product of getManagedCatalogProducts()) {
      if (product.active === false || !product.categorySlug || !product.images?.[0]) continue;
      const slug = resolveCategorySlug(product.categorySlug);
      if (!images.has(slug)) images.set(slug, product.images[0]);
    }
    return images;
  }, [catalogRevision]);
  const actualCategoryImage = (category: EnhancedCategory) =>
    (typeof category.image === "string" && category.image.trim()) ||
    productImageByCategory.get(resolveCategorySlug(category.slug)) || imageForCategory(category);
  const activeGroup = sections.find(group => group.id === selectedGroupId) || sections[0] || null;
  const featured = activeGroup?.categories[0];
  const count = sections.reduce((sum, group) => sum + group.categories.length, 0);

  return (
    <div className="sanat-mobile-category-explorer" dir="rtl" data-testid="mobile-category-explorer">
      <label className="sanat-mobile-category-search">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">جستجو در دسته‌ها و زیرگروه‌ها</span>
        <input
          type="search"
          value={search}
          onChange={event => onSearch(event.target.value)}
          placeholder="جستجو در دسته‌ها..."
          autoComplete="off"
        />
        {search && (
          <button type="button" onClick={() => onSearch("")} aria-label="پاک کردن جستجو">
            <X size={17} />
          </button>
        )}
      </label>

      <div className="sanat-mobile-category-meta">
        <span><Layers size={16} /> گروه‌های محصولات</span>
        <small>{toPersianDigits(sections.length)} گروه · {toPersianDigits(count)} دسته</small>
      </div>

      <div className="sanat-mobile-category-columns">
        <aside className="sanat-mobile-category-rail" aria-label="گروه‌های اصلی محصولات">
          {sections.map(group => {
            const Icon = iconForGroup(group.title);
            const active = activeGroup?.id === group.id;
            return (
              <button
                key={group.id}
                type="button"
                className={"sanat-mobile-category-group" + (active ? " is-selected" : "")}
                aria-pressed={active}
                onClick={() => setSelectedGroupId(group.id)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{group.title}</span>
                <ChevronLeft size={14} className="sanat-mobile-category-group-chevron" aria-hidden="true" />
              </button>
            );
          })}
          {sections.length === 0 && (
            <p className="sanat-mobile-category-no-match">گروهی با این عبارت یافت نشد.</p>
          )}
        </aside>

        <section className="sanat-mobile-category-results" aria-live="polite" aria-label="زیرگروه‌ها و دسته‌های انتخاب‌شده" key={activeGroup?.id || "empty"}>
          {activeGroup && featured ? (
            <>
              <article className="sanat-mobile-category-feature">
                <img src={actualCategoryImage(featured)} alt="" loading="lazy" decoding="async" />
                <div>
                  <small>گروه انتخاب‌شده</small>
                  <h3>{activeGroup.title}</h3>
                  <span>{toPersianDigits(activeGroup.categories.length)} دسته تخصصی</span>
                  <Link to={categoryUrl(featured)} onClick={onNavigate}>
                    مشاهده محصولات <ChevronLeft size={14} />
                  </Link>
                </div>
              </article>
              <div className="sanat-mobile-category-sublist">
                {activeGroup.categories.map(category => {
                  const subNodes = (category.children || []).filter(node => node.hidden !== true);
                  return (
                    <article key={category.slug} className="sanat-mobile-category-item">
                      <Link to={categoryUrl(category)} onClick={onNavigate} className="sanat-mobile-category-item-link">
                        <img src={actualCategoryImage(category)} alt="" loading="lazy" decoding="async" />
                        <span>{category.name}</span>
                        <ChevronLeft size={16} aria-hidden="true" />
                      </Link>
                      {subNodes.length > 0 && (
                        <details className="sanat-mobile-category-subdetails">
                          <summary>
                            <span>{toPersianDigits(subNodes.length)} زیرگروه و مشخصات فنی</span>
                            <ChevronDown size={15} aria-hidden="true" />
                          </summary>
                          <CategoryNavigation nodes={subNodes} categorySlug={category.slug} onNavigate={onNavigate} />
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="sanat-mobile-category-actions">
                <Link className="sanat-mobile-category-products" to="/products" onClick={onNavigate}>
                  کاتالوگ همه محصولات <ArrowLeft size={15} />
                </Link>
                <Link className="sanat-mobile-category-browse" to="/categories" onClick={onNavigate}>
                  همه دسته‌بندی‌ها <ArrowLeft size={15} />
                </Link>
              </div>
            </>
          ) : (
            <div className="sanat-mobile-category-empty">
              <Search size={28} />
              <strong>دسته‌ای با این عبارت پیدا نشد.</strong>
              <p>عبارت دیگری را وارد کنید یا جستجو را پاک کنید.</p>
              {search && <button type="button" onClick={() => onSearch("")}>نمایش همه دسته‌ها</button>}
              <Link to="/categories" onClick={onNavigate}>مشاهده صفحه دسته‌بندی‌ها</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
