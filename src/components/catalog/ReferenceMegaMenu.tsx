import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpLeft, Box, ChevronLeft, Factory, Layers, Link2, Move, PackageSearch, Search, Sparkles } from "lucide-react";
import { CATEGORIES, getManagedCategories, resolveCategorySlug } from "../../data/categories";
import type { CategoryNode, EnhancedCategory } from "../../data/categories";
import { STORE_ASSETS as A } from "../../assets/images";
import { CategoryNavigation } from "./CategoryNavigation";
import { toPersianDigits } from "../../utils/formatters";

type SavedNavigationGroup = {
  id: string;
  title: string;
  iconKey: string;
  imageUrl: string | null;
  categorySlugs: string[];
  sortOrder: number;
};

const readCategories = (): EnhancedCategory[] => {
  const managed = getManagedCategories();
  const source = managed.length ? managed : CATEGORIES;
  return source.filter(category => category.active !== false && Boolean(category.name && category.slug));
};

const visibleNodes = (nodes: CategoryNode[] = []): CategoryNode[] =>
  nodes.filter(node => node.hidden !== true);

const leafNodes = (nodes: CategoryNode[] = []): CategoryNode[] =>
  visibleNodes(nodes).flatMap(node => {
    const children = visibleNodes(node.children || []);
    return children.length ? leafNodes(children) : [node];
  });

const nodeNames = (nodes: CategoryNode[] = []): string[] =>
  visibleNodes(nodes).flatMap(node => [node.name, ...nodeNames(node.children || [])]);

const categoryMatches = (category: EnhancedCategory, query: string) => {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return true;
  return [category.name, category.description, ...nodeNames(category.children || [])]
    .some(value => String(value || "").toLocaleLowerCase().includes(term));
};

const categoryArtwork = (category: EnhancedCategory): string => {
  const name = category.name || "";
  if (/تسمه|انتقال نیرو|انتقال قدرت/i.test(name)) return A.categories.belts;
  if (/پولی/i.test(name)) return A.categories.pulleys;
  if (/زنجیر/i.test(name)) return A.categories.chains;
  if (/نقاله|رولر/i.test(name)) return A.categories.conveyor;
  if (/بلبرینگ|یاتاقان/i.test(name)) return A.categories.bearings;
  if (/سرامیک|کاشی/i.test(name)) return A.categories.ceramic;
  if (/نساجی|پارچه/i.test(name)) return A.categories.textile;
  return A.categories.transmission;
};

const categoryHref = (category: EnhancedCategory) =>
  "/category/" + resolveCategorySlug(category.slug);

const selectionHref = (category: EnhancedCategory, node: CategoryNode) =>
  categoryHref(category) + "?" + new URLSearchParams({ sub: node.value || node.name }).toString();

export function ReferenceMegaMenu({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const [categories, setCategories] = useState<EnhancedCategory[]>(() => readCategories());
  const [activeSlug, setActiveSlug] = useState("تسمه-و-انتقال-نیرو");
  const [search, setSearch] = useState("");
  const [savedGroups, setSavedGroups] = useState<SavedNavigationGroup[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const syncCategories = () => {
      const next = readCategories();
      if (!mounted) return;
      setCategories(next);
      setActiveSlug(current =>
        next.some(category => category.slug === current)
          ? current
          : (next.find(category => resolveCategorySlug(category.slug) === "تسمه-و-انتقال-نیرو")?.slug || next[0]?.slug || "")
      );
    };
    const loadGroups = () => {
      fetch("/api/catalog/navigation-groups", { credentials: "same-origin" })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (mounted && data?.success && Array.isArray(data.groups)) setSavedGroups(data.groups);
        })
        .catch(() => { /* Category navigation remains usable without optional group metadata. */ });
    };
    syncCategories();
    loadGroups();
    window.addEventListener("atlas-categories-updated", syncCategories);
    window.addEventListener("atlas-catalog-updated", syncCategories);
    window.addEventListener("catalog-navigation-groups-updated", loadGroups);
    return () => {
      mounted = false;
      window.removeEventListener("atlas-categories-updated", syncCategories);
      window.removeEventListener("atlas-catalog-updated", syncCategories);
      window.removeEventListener("catalog-navigation-groups-updated", loadGroups);
    };
  }, []);

  const orderedCategories = useMemo(() => {
    const visible = categories.filter(category => category.active !== false);
    if (!savedGroups?.length) return visible;
    const order = new Map<string, number>();
    [...savedGroups].sort((a, b) => a.sortOrder - b.sortOrder).forEach((group, groupIndex) => {
      group.categorySlugs.forEach((slug, itemIndex) => {
        if (!order.has(slug)) order.set(slug, groupIndex * 1000 + itemIndex);
      });
    });
    return [...visible].sort((a, b) =>
      (order.get(a.slug) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.slug) ?? Number.MAX_SAFE_INTEGER)
    );
  }, [categories, savedGroups]);

  const filteredCategories = useMemo(
    () => orderedCategories.filter(category => categoryMatches(category, search)),
    [orderedCategories, search]
  );
  const activeCategory =
    filteredCategories.find(category => category.slug === activeSlug) ||
    filteredCategories[0] ||
    null;

  if (compact) {
    return (
      <div className="reference-catalog-mobile" dir="rtl">
        {orderedCategories.map(category => (
          <section key={category.slug}>
            <h3><Layers size={17} />{category.name}</h3>
            <Link className="reference-view-all" to={categoryHref(category)} onClick={onNavigate}>
              مشاهده همه محصولات <ArrowLeft size={14} />
            </Link>
            <CategoryNavigation nodes={category.children || []} categorySlug={category.slug} onNavigate={onNavigate} />
          </section>
        ))}
      </div>
    );
  }

  const groups = activeCategory ? visibleNodes(activeCategory.children || []) : [];

  return (
    <div className="reference-catalog-menu" dir="rtl" aria-label="مگامنو دسته‌بندی محصولات">
      <header className="reference-menu-header">
        <div className="reference-menu-header-copy">
          <span>کاتالوگ صنعتی صنعت پیش</span>
          <strong>قطعه موردنیاز خط تولید را سریع پیدا کنید</strong>
        </div>
        <label className="reference-menu-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="جستجو بین دسته‌ها و زیرگروه‌ها"
            aria-label="جستجو بین دسته‌بندی‌ها"
          />
        </label>
      </header>

      <aside className="reference-menu-rail" aria-label="دسته‌بندی‌های اصلی">
        <div className="reference-menu-rail-heading">
          <strong>دسته‌بندی‌ها</strong>
          <span>{toPersianDigits(filteredCategories.length)} گروه</span>
        </div>
        <div className="reference-menu-category-list">
          {filteredCategories.map(category => {
            const selected = activeCategory?.slug === category.slug;
            const Icon = /تسمه|انتقال نیرو|انتقال قدرت/i.test(category.name)
              ? Layers
              : /کارخانه|صنعت|سرامیک|نساجی/i.test(category.name)
                ? Factory
                : /شیلنگ|آب.?بندی|لاستیک/i.test(category.name)
                  ? Link2
                  : /پروفیل|قطعه/i.test(category.name)
                    ? Box
                    : Move;
            const count = Number(category.familyCount ?? category.count ?? 0);
            return (
              <button
                type="button"
                key={category.slug}
                className={"reference-menu-category" + (selected ? " is-active" : "")}
                aria-pressed={selected}
                onMouseEnter={() => setActiveSlug(category.slug)}
                onFocus={() => setActiveSlug(category.slug)}
                onClick={() => setActiveSlug(category.slug)}
              >
                <span className="reference-menu-category-icon"><Icon size={17} /></span>
                <span className="reference-menu-category-copy">
                  <strong>{category.name}</strong>
                  <small>{count > 0 ? toPersianDigits(count) + " خانواده کالا" : "مشاهده زیرگروه‌ها"}</small>
                </span>
                <ChevronLeft size={16} className="reference-menu-category-arrow" />
              </button>
            );
          })}
          {filteredCategories.length === 0 && (
            <div className="reference-menu-no-results">
              <PackageSearch size={22} />
              <span>دسته‌ای با این عبارت پیدا نشد.</span>
            </div>
          )}
        </div>
        <Link className="reference-menu-all-categories" to="/categories" onClick={onNavigate}>
          همه دسته‌بندی‌ها <ArrowLeft size={15} />
        </Link>
      </aside>

      <section className="reference-menu-main" aria-live="polite">
        {activeCategory ? (
          <>
            <div className="reference-menu-category-hero">
              <div className="reference-menu-category-copy-block">
                <span className="reference-menu-eyebrow">دسته‌بندی منتخب</span>
                <h2>{activeCategory.name}</h2>
                <p>{activeCategory.description || "زیرگروه‌ها را بررسی کنید یا مستقیم وارد کاتالوگ محصولات شوید."}</p>
                <Link to={categoryHref(activeCategory)} onClick={onNavigate}>
                  مشاهده محصولات این دسته <ArrowLeft size={16} />
                </Link>
              </div>
              <img src={categoryArtwork(activeCategory)} alt="" loading="lazy" decoding="async" />
            </div>

            {groups.length ? (
              <div className="reference-menu-subgrid">
                {groups.map(node => {
                  const links = leafNodes(node.children || []);
                  return (
                    <section className="reference-menu-subgroup" key={node.name}>
                      <div className="reference-menu-subgroup-heading">
                        <strong>{node.name}</strong>
                        <Link to={selectionHref(activeCategory, node)} onClick={onNavigate} aria-label={"مشاهده محصولات " + node.name}>
                          <ArrowUpLeft size={14} />
                        </Link>
                      </div>
                      {links.length ? (
                        <div className="reference-menu-sub-links">
                          {links.slice(0, 8).map(child => (
                            <Link key={child.name} to={selectionHref(activeCategory, child)} onClick={onNavigate}>
                              <span>{child.name}</span><ArrowUpLeft size={12} />
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <Link className="reference-menu-subgroup-single" to={selectionHref(activeCategory, node)} onClick={onNavigate}>
                          ورود به این گروه <ArrowLeft size={14} />
                        </Link>
                      )}
                      {links.length > 8 && (
                        <Link className="reference-menu-more" to={selectionHref(activeCategory, node)} onClick={onNavigate}>
                          مشاهده همه زیرگروه‌ها
                        </Link>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="reference-menu-empty-state">
                <PackageSearch size={28} />
                <strong>زیرگروه ثبت‌شده‌ای برای این دسته نمایش داده نمی‌شود.</strong>
                <span>برای مشاهده فهرست کالاها وارد کاتالوگ همین دسته شوید.</span>
              </div>
            )}

            <div className="reference-menu-footer">
              <div><Sparkles size={18} /><span><strong>برای انتخاب فنی مطمئن‌تر</strong><small>اگر کد یا ابعاد قطعه را نمی‌دانید، از راهنمای تخصصی کمک بگیرید.</small></span></div>
              <Link to="/ai-consult" onClick={onNavigate}>مشاوره انتخاب قطعه <ArrowLeft size={15} /></Link>
            </div>
          </>
        ) : (
          <div className="reference-menu-empty-state">
            <PackageSearch size={30} />
            <strong>دسته‌بندی‌ها در حال بارگذاری هستند.</strong>
            <span>می‌توانید همه دسته‌بندی‌ها را از صفحه کاتالوگ باز کنید.</span>
            <Link to="/categories" onClick={onNavigate}>رفتن به دسته‌بندی‌ها <ArrowLeft size={15} /></Link>
          </div>
        )}
      </section>
    </div>
  );
}
