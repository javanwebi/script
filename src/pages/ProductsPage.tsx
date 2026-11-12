import { PulleyCatalogPage } from "./PulleyCatalogPage";
import { ProductCard } from "../components/product/ProductCard";
import {
  matchesProductSearch,
  CATALOGUE_SKU_COUNT,
  categorySlugFor,
} from "../data/userProducts";
import { STORE_ASSETS } from "../assets/images";
import { isDatabaseCatalogHydrated } from "../services/durableStorage";
import {
  ensureCatalogFamiliesLoaded,
  getFamilyMenuAssignment,
  resolveNavigationCategoriesAndGroups,
} from "../services/catalogTaxonomyResolver";
import "./products-page-premium.css";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { scrollToSectionElement } from "../components/layout/ScrollToTop";
import { getAllProducts, subscribeCatalogChanges } from "../data/mockGenerator";
import {
  getManagedCategories,
  findCatalogCategory,
  matchesCatalogCategory,
  resolveCategorySlug,
} from "../data/categories";
import { CategoryNavigation } from "../components/catalog/CategoryNavigation";
import { Product } from "../types";
import { toPersianDigits } from "../utils/formatters";
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Package,
  Layers,
  Sparkles,
  Grid3X3,
  List,
  RotateCcw,
  Cpu,
  Grid,
  CircleDot,
  Shield,
  Link as LinkIcon,
  Scissors,
  Image as ImageIcon,
  ArrowUpLeft,
  ArrowLeft,
  Boxes,
  X,
} from "lucide-react";

const BELT_CATEGORY_SLUG = categorySlugFor("تسمه و انتقال نیرو");

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "تسمه و انتقال نیرو": <Layers className="w-4 h-4" />,
  "پولی و انتقال نیرو": <CircleDot className="w-4 h-4" />,
  "بلبرینگ و یاتاقان": <Shield className="w-4 h-4" />,
  "زنجیر و چرخ‌زنجیر": <LinkIcon className="w-4 h-4" />,
  "تجهیزات خطوط کاشی و سرامیک": <Grid className="w-4 h-4" />,
  "نوار و تسمه نقاله": <Layers className="w-4 h-4" />,
  "قطعات پمپ و سیالات": <Cpu className="w-4 h-4" />,
  "نساجی": <Scissors className="w-4 h-4" />,
  "تجهیزات نساجی": <Scissors className="w-4 h-4" />,
};

const CATEGORY_ARTWORK: Record<string, string> = {
  "تسمه و انتقال نیرو": STORE_ASSETS.categories.belts,
  "پولی و انتقال نیرو": STORE_ASSETS.categories.pulleys,
  "بلبرینگ و یاتاقان": STORE_ASSETS.categories.bearings,
  "زنجیر و چرخ‌زنجیر": STORE_ASSETS.categories.chains,
  "نوار و تسمه نقاله": STORE_ASSETS.categories.conveyor,
  "تجهیزات خطوط کاشی و سرامیک": STORE_ASSETS.categories.ceramic,
  "نساجی": STORE_ASSETS.categories.textile,
};

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven or local state
  const rawCategoryParam = searchParams.get("category") || "all";
  const categoryParam = /^excel-v2-/.test(rawCategoryParam)
    ? rawCategoryParam
    : resolveCategorySlug(rawCategoryParam);
  const groupParam = searchParams.get("group") || "all";
  const subParam = searchParams.get("sub") || "all";
  const queryParam = searchParams.get("q") || "";
  const brandParam = searchParams.get("brand") || "all";
  const stockParam = searchParams.get("stock") === "1";
  const imageParam = searchParams.get("image") === "1";

  const [selectedGroup, setSelectedGroup] = useState<string>(groupParam);
  const [selectedCategory, setSelectedCategory] =
    useState<string>(categoryParam);
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<string>(subParam);
  const [selectedBrand, setSelectedBrand] = useState<string>(brandParam);
  const [searchQuery, setSearchQuery] = useState<string>(queryParam);
  const [sortBy, setSortBy] = useState<
    "code_asc" | "name_asc" | "sku_desc" | "rating_desc" | "stock_desc"
  >("code_asc");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "grouped">("grid");
  const [inStockOnly, setInStockOnly] = useState<boolean>(stockParam);
  const [hasCatalogueImageFilter, setHasCatalogueImageFilter] =
    useState<boolean>(imageParam);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileFilterCloseRef = useRef<HTMLButtonElement>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 24;
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [catalogReady, setCatalogReady] = useState(() => {
    ensureCatalogFamiliesLoaded();
    return isDatabaseCatalogHydrated() || getAllProducts().length > 0;
  });

  useEffect(() => subscribeCatalogChanges(() => {
    setCatalogVersion((version) => version + 1);
    setCatalogReady(isDatabaseCatalogHydrated() || getAllProducts().length > 0);
  }), []);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const focusableElements = () => Array.from(document.querySelectorAll<HTMLElement>(
      ".catalogue-filter-sheet a[href], .catalogue-filter-sheet button:not([disabled]), .catalogue-filter-sheet input:not([disabled]), .catalogue-filter-sheet select:not([disabled]), .catalogue-filter-sheet [tabindex]:not([tabindex='-1'])"
    ));
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableElements();
      if (!items.length) {
        event.preventDefault();
        mobileFilterCloseRef.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    mobileFilterCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [mobileFiltersOpen]);

  const allProducts = useMemo(() => {
    ensureCatalogFamiliesLoaded();
    return getAllProducts();
  }, [catalogVersion]);

  const taxonomyData = useMemo(
    () => resolveNavigationCategoriesAndGroups(),
    [catalogVersion],
  );

  const managedCategories = useMemo(() => {
    const stored = getManagedCategories().filter((category) => category.active !== false);
    if (stored.some((c) => /^excel-v2-/.test(c.slug))) {
      return stored;
    }
    return taxonomyData.categories;
  }, [catalogVersion, taxonomyData.categories]);

  const hasExcelTaxonomy = useMemo(
    () => managedCategories.some((c) => /^excel-v2-/.test(c.slug)),
    [managedCategories],
  );

  const visibleManagedCategories = useMemo(() => {
    if (!hasExcelTaxonomy || selectedGroup === "all") return managedCategories;
    const groupObj = taxonomyData.groups.find((g) => g.id === selectedGroup);
    if (!groupObj) return managedCategories;
    return managedCategories.filter((c) => groupObj.categorySlugs.includes(c.slug));
  }, [managedCategories, hasExcelTaxonomy, selectedGroup, taxonomyData.groups]);

  // Total products with official uploaded catalogue images
  const countWithImages = useMemo(() => {
    return allProducts.filter((p) => p.hasCatalogueImage).length;
  }, [allProducts]);

  // Synchronize category state if URL changes
  useEffect(() => {
    setSelectedGroup(groupParam);
    setSelectedCategory(categoryParam);
    setSelectedSubcategory(subParam);
    setSearchQuery(queryParam);
    setSelectedBrand(brandParam);
    setInStockOnly(stockParam);
    setHasCatalogueImageFilter(imageParam);
    setCurrentPage(1);
  }, [groupParam, categoryParam, subParam, queryParam, brandParam, stockParam, imageParam]);

  // Legacy category-query URLs for belts should land on the dedicated, canonical belt page.
  useEffect(() => {
    if (categoryParam !== BELT_CATEGORY_SLUG) return;
    const destinationParams = new URLSearchParams();
    if (searchParams.has("sub")) destinationParams.set("sub", subParam);
    if (queryParam.trim()) destinationParams.set("q", queryParam);
    const query = destinationParams.toString();
    navigate(`/category/${BELT_CATEGORY_SLUG}${query ? `?${query}` : ""}`, { replace: true });
  }, [categoryParam, subParam, queryParam, searchParams, navigate]);

  // Available brands in the entire catalog
  const allBrands = useMemo(() => {
    const bSet = new Set<string>();
    allProducts.forEach((p) => {
      if (p.brand) bSet.add(p.brand);
    });
    return Array.from(bSet).sort((a, b) => a.localeCompare(b, "fa"));
  }, [allProducts]);

  // Active category object
  const activeCategoryObj = useMemo(() => {
    if (selectedCategory === "all") return undefined;
    return (
      managedCategories.find((c) => c.slug === selectedCategory) ||
      taxonomyData.categories.find((c) => c.slug === selectedCategory) ||
      findCatalogCategory(selectedCategory)
    );
  }, [selectedCategory, managedCategories, taxonomyData.categories]);

  const activeGroupObj = useMemo(() => {
    if (selectedGroup !== "all") {
      return taxonomyData.groups.find((g) => g.id === selectedGroup);
    }
    if (activeCategoryObj && /^excel-v2-/.test(activeCategoryObj.slug)) {
      return taxonomyData.groups.find((g) =>
        g.categorySlugs.includes(activeCategoryObj.slug),
      );
    }
    return undefined;
  }, [selectedGroup, activeCategoryObj, taxonomyData.groups]);

  // Helper to match product against Excel taxonomy or legacy category
  const productMatchesTaxonomy = (
    p: Product,
    catSlug: string,
    subName: string,
    grpId: string,
  ) => {
    const assignment = getFamilyMenuAssignment(p.code, p);
    if (grpId !== "all") {
      if (assignment.groupId !== grpId) return false;
    }
    if (catSlug === "all") {
      if (subName !== "all") {
        return (
          assignment.submenu === subName ||
          assignment.leaf === subName ||
          p.subcategory === subName
        );
      }
      return true;
    }
    if (catSlug === "swr-forza-exclusive") {
      return p.brand.includes("SWR") || p.brand.includes("FORZA");
    }
    if (/^excel-v2-\d+$/.test(catSlug)) {
      if (assignment.groupId !== catSlug) return false;
      if (subName !== "all") {
        return assignment.submenu === subName || assignment.leaf === subName;
      }
      return true;
    }
    if (/^excel-v2-\d+-\d+$/.test(catSlug)) {
      if (assignment.categorySlug !== catSlug) return false;
      if (subName !== "all") {
        return assignment.submenu === subName || assignment.leaf === subName;
      }
      return true;
    }
    return matchesCatalogCategory(p, catSlug, subName);
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    let result = allProducts.filter((p) =>
      productMatchesTaxonomy(p, selectedCategory, selectedSubcategory, selectedGroup),
    );

    // Brand Filter
    if (selectedBrand !== "all") {
      result = result.filter((p) => p.brand === selectedBrand);
    }

    // In-Stock Filter
    if (inStockOnly) {
      result = result.filter((p) => p.stockKnown === true && p.stock > 0 && !p.inquiryOnly);
    }

    // Official Catalogue Image Filter
    if (hasCatalogueImageFilter) {
      result = result.filter((p) => p.hasCatalogueImage);
    }

    // Search Query (including family codes, names, specs, and variant SKU codes)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          matchesProductSearch(p, q) ||
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
          p.brand.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          (p.variants &&
            p.variants.some(
              (v) =>
                v.code.toLowerCase().includes(q) ||
                v.name.toLowerCase().includes(q) ||
                (v.size && v.size.toLowerCase().includes(q)),
            )) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q))) ||
          (p.technicalSpecs &&
            p.technicalSpecs.some(
              (s) =>
                s.key.toLowerCase().includes(q) ||
                s.value.toLowerCase().includes(q),
            )),
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "code_asc") {
        const aImg = a.hasCatalogueImage || (a.images && a.images.length > 0) ? 1 : 0;
        const bImg = b.hasCatalogueImage || (b.images && b.images.length > 0) ? 1 : 0;
        if (bImg !== aImg) return bImg - aImg;
        return a.code.localeCompare(b.code, undefined, { numeric: true });
      }
      if (sortBy === "name_asc") {
        return a.name.localeCompare(b.name, "fa");
      }
      if (sortBy === "sku_desc") {
        const aSkus = a.variants?.length || 1;
        const bSkus = b.variants?.length || 1;
        return bSkus - aSkus;
      }
      if (sortBy === "rating_desc") {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === "stock_desc") {
        const aStock = a.stockKnown === true && !a.inquiryOnly ? a.stock : -1;
        const bStock = b.stockKnown === true && !b.inquiryOnly ? b.stock : -1;
        return bStock - aStock;
      }
      return 0;
    });

    return result;
  }, [
    allProducts,
    selectedGroup,
    selectedCategory,
    selectedSubcategory,
    selectedBrand,
    inStockOnly,
    hasCatalogueImageFilter,
    searchQuery,
    sortBy,
  ]);

  // Total SKU count in filtered results
  const filteredSkuCount = useMemo(() => {
    return filteredProducts.reduce(
      (sum, p) => sum + Math.max(1, p.variants?.length || 1),
      0,
    );
  }, [filteredProducts]);

  // Grouped sections when viewMode === 'grouped'
  const groupedCategorySections = useMemo(() => {
    if (viewMode !== "grouped") return [];
    const byCategory = new Map<string, Product[]>();
    filteredProducts.forEach((product) => {
      const assignment = getFamilyMenuAssignment(product.code, product);
      const bucket = byCategory.get(assignment.categorySlug) || [];
      bucket.push(product);
      byCategory.set(assignment.categorySlug, bucket);
    });

    return taxonomyData.categories
      .map((cat) => {
        const items = byCategory.get(cat.slug) || [];
        const totalSkus = items.reduce(
          (sum, item) => sum + Math.max(1, item.variants?.length || 1),
          0,
        );
        const grp = taxonomyData.groups.find((g) =>
          g.categorySlugs.includes(cat.slug),
        );
        return {
          category: cat,
          groupTitle: grp?.title || "گروه تخصصی",
          items,
          totalSkus,
        };
      })
      .filter((section) => section.items.length > 0);
  }, [viewMode, filteredProducts, taxonomyData]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  const updateSearchParam = (key: string, value: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set(key, value);
    else nextParams.delete(key);
    setSearchParams(nextParams, { replace: true });
  };

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroup(groupId);
    setSelectedCategory("all");
    setSelectedSubcategory("all");
    setCurrentPage(1);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("category");
    nextParams.delete("sub");
    if (groupId === "all") nextParams.delete("group");
    else nextParams.set("group", groupId);
    setSearchParams(nextParams);
  };

  const handleCategorySelect = (slug: string) => {
    setSelectedCategory(slug);
    setSelectedSubcategory("all");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("sub");
    setCurrentPage(1);
    if (slug === "all") nextParams.delete("category");
    else nextParams.set("category", slug);
    setSearchParams(nextParams);
    window.requestAnimationFrame(() => {
      scrollToSectionElement(resultsSectionRef.current, { behavior: "smooth" });
    });
  };

  const clearAdvancedFilters = () => {
    setSelectedBrand("all");
    setInStockOnly(false);
    setHasCatalogueImageFilter(false);
    setCurrentPage(1);
    const nextParams = new URLSearchParams(searchParams);
    ["brand", "stock", "image"].forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams, { replace: true });
  };

  const handleResetFilters = () => {
    setSelectedGroup("all");
    setSelectedCategory("all");
    setSelectedSubcategory("all");
    setSelectedBrand("all");
    setSearchQuery("");
    setInStockOnly(false);
    setHasCatalogueImageFilter(false);
    setSortBy("code_asc");
    setCurrentPage(1);
    const nextParams = new URLSearchParams(searchParams);
    ["group", "category", "sub", "q", "brand", "stock", "image"].forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams);
  };

  const activeFiltersCount =
    (selectedGroup !== "all" ? 1 : 0) +
    (selectedCategory !== "all" ? 1 : 0) +
    (selectedSubcategory !== "all" ? 1 : 0) +
    (selectedBrand !== "all" ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (hasCatalogueImageFilter ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  if (selectedCategory === "پولی-و-انتقال-نیرو") {
    return <PulleyCatalogPage products={allProducts.filter(p => matchesCatalogCategory(p, selectedCategory))} />;
  }

  return (
    <div className="catalogue-page catalogue-premium-page min-h-screen text-right" dir="rtl">
      <div className="catalogue-container max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="catalogue-breadcrumbs flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Link to="/" className="hover:text-orange-600 transition-colors">
            صفحه اصلی
          </Link>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
          <Link to="/categories" className="hover:text-orange-600 transition-colors">
            همه دسته‌بندی‌ها
          </Link>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 font-bold">
            همه محصولات و خانواده‌های کاتالوگ
          </span>
          {activeGroupObj && (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-700 font-bold">
                {activeGroupObj.title}
              </span>
            </>
          )}
          {activeCategoryObj && (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-orange-600 font-bold">
                {activeCategoryObj.name}
              </span>
            </>
          )}
        </nav>

        {/* Industrial catalogue hero */}
        <section className="catalogue-intro catalogue-hero">
          <div className="catalogue-hero-copy">
            <span className="store-eyebrow">مرجع مهندسی و تأمین قطعات صنعتی صنعت پیش</span>
            <h1>بانک جامع خانواده‌ها و کدهای فنی همه محصولات</h1>
            <p>
              تمامی خانواده‌های محصول و کدهای فنی (SKU) در ۱۴ گروه اصلی و ۳۴ دسته‌بندی تخصصی سازمان‌دهی شده‌اند. از طریق دسته‌بندی‌ها، زیرگروه‌ها یا جستجوی مستقیم کد فنی، قطعه موردنیاز خط تولید را انتخاب کنید.
            </p>
            <div className="catalogue-hero-actions">
              <Link to="/categories" className="catalogue-hero-primary">
                <Layers className="w-4 h-4 ml-1.5" />
                نقشه کامل دسته‌بندی‌ها (۳۴ دسته)
              </Link>
              <Link to="/identify-part" className="catalogue-hero-secondary">
                شناسایی تصویری قطعه
              </Link>
              <Link to="/ai-consult" className="catalogue-hero-secondary">
                مشاوره فنی فورزا
              </Link>
            </div>
            <div className="catalogue-hero-metrics" aria-label="آمار کاتالوگ">
              <span><strong>{catalogReady ? toPersianDigits(allProducts.length) : "—"}</strong><small>خانواده محصول</small></span>
              <span><strong>{catalogReady ? toPersianDigits(CATALOGUE_SKU_COUNT) : "—"}</strong><small>کد فنی کالا (SKU)</small></span>
              <span><strong>{toPersianDigits(taxonomyData.groups.length)}</strong><small>گروه تخصصی</small></span>
              <span><strong>{toPersianDigits(taxonomyData.categories.length)}</strong><small>دسته‌بندی مهندسی</small></span>
            </div>
          </div>
          <div className="catalogue-hero-art" aria-hidden="true">
            <img src={STORE_ASSETS.productsSleekWhiteHero} alt="" loading="eager" fetchPriority="high" decoding="async" />
            <span className="catalogue-hero-art-label">ساختار یکپارچه: گروه <i>›</i> دسته <i>›</i> خانواده <i>›</i> کد فنی</span>
          </div>
        </section>

        {/* Tier 1: 14 Main Groups Explorer (shown when full taxonomy is active) */}
        {hasExcelTaxonomy && (
          <section className="catalogue-groups-explorer" aria-label="گروه‌های اصلی همه محصولات">
            <div className="catalogue-groups-header">
              <div>
                <span>ساختار سطح اول منوی همه محصولات</span>
                <h2>انتخاب گروه اصلی تخصصی ({toPersianDigits(taxonomyData.groups.length)} گروه)</h2>
              </div>
              <div className="catalogue-groups-mode-switch" role="group" aria-label="نحوه نمایش دسته‌بندی محصولات">
                <button
                  type="button"
                  className={viewMode === "grid" ? "is-active" : ""}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  نمای شبکه‌ای خانواده‌ها
                </button>
                <button
                  type="button"
                  className={viewMode === "grouped" ? "is-active" : ""}
                  onClick={() => setViewMode("grouped")}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  نمای تفکیکی دسته‌بندی‌ها
                </button>
              </div>
            </div>
            <div className="catalogue-groups-pills">
              <button
                type="button"
                onClick={() => handleGroupSelect("all")}
                aria-pressed={selectedGroup === "all"}
                className={`catalogue-group-pill ${selectedGroup === "all" ? "is-selected" : ""}`}
              >
                <span>همه ۱۴ گروه تخصصی</span>
                <b>{toPersianDigits(allProducts.length)} خانواده</b>
              </button>
              {taxonomyData.groups.map((grp, idx) => {
                const isSelected = selectedGroup === grp.id;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => handleGroupSelect(grp.id)}
                    aria-pressed={isSelected}
                    className={`catalogue-group-pill ${isSelected ? "is-selected" : ""}`}
                  >
                    <small>{toPersianDigits(idx + 1)}</small>
                    <span>{grp.title}</span>
                    <b>{toPersianDigits(grp.familyCount)}</b>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Tier 2: Category Selector Rail */}
        <section className="catalogue-category-rail">
          <div className="catalogue-section-heading">
            <div>
              <span>دسته‌بندی کاتالوگ</span>
              <h2>
                {activeGroupObj
                  ? `دسته‌های تخصصی در «${activeGroupObj.title}»`
                  : "از کدام دسته تخصصی شروع می‌کنید؟"}
              </h2>
            </div>
            <small>انتخاب هر دسته، خانواده‌ها و کدهای فنی همان بخش را نمایش می‌دهد</small>
          </div>
          <div
            className="catalogue-category-track flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            <button
              onClick={() => handleCategorySelect("all")}
              aria-pressed={selectedCategory === "all"}
              className={`catalogue-category-tile catalogue-category-tile--all flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-[#55565A] text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span className="catalogue-category-art"><Package className="w-5 h-5" /></span>
              <span className="catalogue-category-name">همه محصولات</span>
              <span className="catalogue-category-count">
                {catalogReady ? toPersianDigits(allProducts.length) : "—"}
              </span>
            </button>

            {visibleManagedCategories.map((cat) => {
              const isSelected = selectedCategory === cat.slug;
              const icon = CATEGORY_ICONS[cat.name] || (
                <Layers className="w-4 h-4" />
              );
              const artwork = cat.image || CATEGORY_ARTWORK[cat.name];
              const famCount = Number(cat.familyCount ?? cat.count ?? 0);
              const skuCount = Number(cat.skuCount ?? 0);
              return (
                <button
                  key={cat.slug}
                  onClick={() => handleCategorySelect(cat.slug)}
                  aria-pressed={isSelected}
                  className={`catalogue-category-tile flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-orange-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <span className="catalogue-category-art">
                    {artwork ? <img src={artwork} alt="" loading="lazy" decoding="async" /> : icon}
                  </span>
                  <span className="catalogue-category-name">
                    {cat.name}
                    {skuCount > 0 && (
                      <small className="catalogue-category-sku-sub">
                        {toPersianDigits(skuCount)} کد فنی
                      </small>
                    )}
                  </span>
                  <span className="catalogue-category-count">
                    {toPersianDigits(famCount)}
                  </span>
                </button>
              );
            })}
            {managedCategories.length === 0 && !catalogReady && (
              <span className="catalogue-category-placeholder" role="status">در حال دریافت دسته‌بندی‌ها…</span>
            )}
          </div>
        </section>

        {/* Active Category Spotlight Banner with direct link to dedicated Category Page */}
        {activeCategoryObj && (
          <section className="catalogue-active-category-banner" aria-label={`مشخصات دسته ${activeCategoryObj.name}`}>
            <div className="catalogue-active-category-info">
              <div className="catalogue-active-category-badges">
                <span className="catalogue-active-badge-primary">دسته انتخاب‌شده</span>
                {activeGroupObj && (
                  <span className="catalogue-active-badge-secondary">{activeGroupObj.title}</span>
                )}
              </div>
              <h3>{activeCategoryObj.name}</h3>
              {activeCategoryObj.description && <p>{activeCategoryObj.description}</p>}
            </div>
            <div className="catalogue-active-category-actions">
              <div className="catalogue-active-category-stats">
                <div>
                  <strong>{toPersianDigits(filteredProducts.length)}</strong>
                  <span>خانواده فعال</span>
                </div>
                <div>
                  <strong>{toPersianDigits(filteredSkuCount)}</strong>
                  <span>کد فنی (SKU)</span>
                </div>
              </div>
              <Link
                to={`/category/${encodeURIComponent(activeCategoryObj.slug)}`}
                className="catalogue-active-category-cta"
              >
                <span>ورود به صفحه تخصصی و مقایسه فنی این دسته</span>
                <ArrowUpLeft className="w-4 h-4" />
              </Link>
            </div>
          </section>
        )}

        {/* Search, Secondary Filters & View Controls Bar */}
        <section className="catalogue-toolbar bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="catalogue-search-field relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="جست‌وجو بر اساس نام، کد فنی، برند یا مشخصات"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  const nextParams = new URLSearchParams(searchParams);
                  if (e.target.value.trim()) nextParams.set("q", e.target.value);
                  else nextParams.delete("q");
                  setSearchParams(nextParams, { replace: true });
                }}
                placeholder="جستجو در کد خانواده (FAM-10005)، کد فنی کالا (SKU)، نام قطعه، برند یا ابعاد..."
                className="w-full pr-10 pl-24 h-10 bg-slate-50 text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-orange-500 focus:bg-white focus:outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                    updateSearchParam("q", null);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 bg-slate-200 hover:bg-slate-300 px-2 py-0.5 rounded cursor-pointer"
                >
                  پاک کردن
                </button>
              )}
            </div>

            {/* Filter Dropdowns & Sorting */}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="catalogue-mobile-filter-trigger" onClick={() => setMobileFiltersOpen(true)} aria-haspopup="dialog" aria-expanded={mobileFiltersOpen}>
                <SlidersHorizontal className="w-4 h-4" /> فیلترها {activeFiltersCount > 0 && <span>{toPersianDigits(activeFiltersCount)}</span>}
              </button>

              {/* Brand Filter */}
              <div className="catalogue-filter-control catalogue-filter-brand relative">
                <select
                  value={selectedBrand}
                  aria-label="فیلتر برند سازنده"
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setCurrentPage(1);
                    updateSearchParam("brand", e.target.value === "all" ? null : e.target.value);
                  }}
                  className="h-10 px-3 bg-slate-50 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 focus:border-orange-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
                >
                  <option value="all">
                    همه برندها ({toPersianDigits(allBrands.length)})
                  </option>
                  {allBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="catalogue-filter-control catalogue-filter-sort relative">
                <select
                  aria-label="مرتب‌سازی محصولات"
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value as any); setCurrentPage(1); }}
                  className="h-10 px-3 bg-slate-50 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 focus:border-orange-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
                >
                  <option value="code_asc">مرتب‌سازی: کد خانواده (صعودی)</option>
                  <option value="sku_desc">مرتب‌سازی: بیشترین تعداد کد فنی (SKU)</option>
                  <option value="name_asc">مرتب‌سازی: نام قطعه (الفبا)</option>
                  <option value="rating_desc">مرتب‌سازی: بیشترین امتیاز</option>
                  <option value="stock_desc">مرتب‌سازی: بیشترین موجودی ثبت‌شده</option>
                </select>
              </div>

              <label className={`catalogue-desktop-stock-filter flex items-center gap-2 h-10 px-3 rounded-xl border cursor-pointer text-xs font-bold select-none transition-all ${inStockOnly ? "is-active" : ""}`}>
                <input type="checkbox" checked={inStockOnly} onChange={(e) => { setInStockOnly(e.target.checked); setCurrentPage(1); updateSearchParam("stock", e.target.checked ? "1" : null); }} />
                <span>فقط موجودی تأییدشده</span>
              </label>

              {/* Official Catalogue Image Toggle */}
              <label
                className={`catalogue-desktop-image-filter flex items-center gap-2 h-10 px-3 rounded-xl border cursor-pointer text-xs font-bold select-none transition-all ${
                  hasCatalogueImageFilter
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={hasCatalogueImageFilter}
                  onChange={(e) => {
                    setHasCatalogueImageFilter(e.target.checked);
                    setCurrentPage(1);
                    updateSearchParam("image", e.target.checked ? "1" : null);
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  دارای تصویر خانواده ({toPersianDigits(countWithImages)})
                </span>
              </label>

              {/* View Mode Toggle (Grid vs List vs Grouped) */}
              <div className="catalogue-view-toggle flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  onClick={() => setViewMode("grid")}
                  aria-pressed={viewMode === "grid"}
                  aria-label="نمایش شبکه‌ای"
                  title="نمایش شبکه‌ای"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-white text-orange-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                  aria-label="نمایش لیستی"
                  title="نمایش لیستی"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === "list"
                      ? "bg-white text-orange-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Reset Filters */}
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  title="بازنشانی فیلترها"
                  className="flex items-center gap-1 h-10 px-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>پاکسازی فیلترها</span>
                </button>
              )}
            </div>
          </div>

          {activeCategoryObj && (activeCategoryObj.children || []).length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-xs font-bold text-[#484344]">
                  زیرگروه‌های تخصصی {activeCategoryObj.name}
                </span>
                <button
                  type="button"
                  className="text-xs text-[#E06518] font-bold"
                  onClick={() => {
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete("sub");
                    setSearchParams(nextParams);
                    window.requestAnimationFrame(() => {
                      scrollToSectionElement(resultsSectionRef.current, {
                        behavior: "smooth",
                      });
                    });
                  }}
                >
                  همه زیرگروه‌ها
                </button>
              </div>
              <CategoryNavigation
                key={activeCategoryObj.slug}
                nodes={activeCategoryObj.children}
                categorySlug={activeCategoryObj.slug}
                selected={selectedSubcategory}
                onSelect={(name) => {
                  const nextParams = new URLSearchParams(searchParams);
                  if (name === "all") nextParams.delete("sub");
                  else nextParams.set("sub", name);
                  setSearchParams(nextParams);
                  window.requestAnimationFrame(() => {
                    scrollToSectionElement(resultsSectionRef.current, {
                      behavior: "smooth",
                    });
                  });
                }}
              />
            </div>
          )}
        </section>

        {mobileFiltersOpen && (
          <div className="catalogue-filter-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileFiltersOpen(false); }}>
            <aside className="catalogue-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="catalogue-filter-title">
              <header>
                <div><span>تنظیم نتایج</span><h2 id="catalogue-filter-title">فیلترهای محصولات</h2></div>
                <button ref={mobileFilterCloseRef} type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="بستن فیلترها"><X size={20}/></button>
              </header>
              <div className="catalogue-filter-sheet-body">
                <label className="catalogue-sheet-select">برند سازنده
                  <select value={selectedBrand} onChange={(event) => { setSelectedBrand(event.target.value); setCurrentPage(1); updateSearchParam("brand", event.target.value === "all" ? null : event.target.value); }}>
                    <option value="all">همه برندها</option>
                    {allBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                  </select>
                </label>
                <label className="catalogue-sheet-check"><span><strong>موجودی تأییدشده</strong><small>فقط کالاهایی که موجودی آن‌ها ثبت شده است</small></span><input type="checkbox" checked={inStockOnly} onChange={(event) => { setInStockOnly(event.target.checked); setCurrentPage(1); updateSearchParam("stock", event.target.checked ? "1" : null); }}/></label>
                <label className="catalogue-sheet-check"><span><strong>دارای تصویر کاتالوگ</strong><small>{toPersianDigits(countWithImages)} خانواده دارای تصویر ثبت‌شده</small></span><input type="checkbox" checked={hasCatalogueImageFilter} onChange={(event) => { setHasCatalogueImageFilter(event.target.checked); setCurrentPage(1); updateSearchParam("image", event.target.checked ? "1" : null); }}/></label>
              </div>
              <footer>
                <button type="button" className="catalogue-sheet-clear" onClick={clearAdvancedFilters}>پاک کردن فیلترها</button>
                <button type="button" className="catalogue-sheet-apply" onClick={() => setMobileFiltersOpen(false)}>نمایش {toPersianDigits(filteredProducts.length)} نتیجه</button>
              </footer>
            </aside>
          </div>
        )}

        {/* Results Count & Active Status */}
        <div
          ref={resultsSectionRef}
          id="catalog-products-results"
          className="catalogue-results-count flex items-center justify-between text-xs text-slate-500 font-medium px-1 scroll-mt-24"
        >
          <div>
            نمایش{" "}
            <span className="font-bold text-slate-800 font-mono">
              {toPersianDigits(viewMode === "grouped" ? filteredProducts.length : paginatedProducts.length)}
            </span>{" "}
            از{" "}
            <span className="font-bold text-orange-600 font-mono">
              {toPersianDigits(filteredProducts.length)}
            </span>{" "}
            خانواده محصول (شامل{" "}
            <span className="font-bold text-slate-800 font-mono">
              {toPersianDigits(filteredSkuCount)}
            </span>{" "}
            کد فنی)
            {selectedCategory !== "all" && (
              <span>
                {" "}
                در دسته{" "}
                <span className="font-bold text-slate-800">
                  {activeCategoryObj?.name || selectedCategory}
                </span>
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            {viewMode === "grouped" ? (
              <span>
                تفکیک‌شده در{" "}
                <strong className="font-mono text-slate-700">
                  {toPersianDigits(groupedCategorySections.length)}
                </strong>{" "}
                دسته تخصصی
              </span>
            ) : (
              <>
                صفحه{" "}
                <span className="font-bold font-mono">
                  {toPersianDigits(currentPage)}
                </span>{" "}
                از{" "}
                <span className="font-bold font-mono">
                  {toPersianDigits(totalPages)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Products Display (Grid, List, or Grouped by Category) */}
        {!catalogReady && paginatedProducts.length === 0 ? (
          <div className="catalogue-loading" role="status" aria-live="polite">
            <span className="catalogue-loading-spinner" aria-hidden="true" />
            <h3>در حال دریافت کاتالوگ واقعی صنعت پیش</h3>
            <p>اطلاعات محصولات و مشخصات از پایگاه داده بارگذاری می‌شود.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="catalogue-empty bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-500 mx-auto flex items-center justify-center">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-800">
              هیچ محصولی با معیارهای انتخابی شما یافت نشد
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              لطفاً فیلترها را تغییر داده یا واژه جستجوی دیگری را وارد کنید.
              برای مشاهده همه محصولات دکمه زیر را لمس نمایید.
            </p>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>مشاهده تمام محصولات</span>
            </button>
          </div>
        ) : viewMode === "grouped" ? (
          <div className="catalogue-grouped-sections">
            {groupedCategorySections.map((section) => (
              <section
                key={section.category.slug}
                className="catalogue-grouped-block"
                aria-labelledby={`grouped-cat-${section.category.slug}`}
              >
                <header className="catalogue-grouped-header">
                  <div className="catalogue-grouped-header-main">
                    <span className="catalogue-grouped-eyebrow">
                      {section.groupTitle}
                    </span>
                    <h3 id={`grouped-cat-${section.category.slug}`}>
                      <Link to={`/category/${encodeURIComponent(section.category.slug)}`}>
                        {section.category.name}
                      </Link>
                    </h3>
                  </div>
                  <div className="catalogue-grouped-header-actions">
                    <span className="catalogue-grouped-stat">
                      <strong>{toPersianDigits(section.items.length)}</strong> خانواده ·{" "}
                      <strong>{toPersianDigits(section.totalSkus)}</strong> کد فنی
                    </span>
                    <button
                      type="button"
                      className="catalogue-grouped-filter-btn"
                      onClick={() => {
                        setViewMode("grid");
                        handleCategorySelect(section.category.slug);
                      }}
                    >
                      نمایش همه در این صفحه
                    </button>
                    <Link
                      to={`/category/${encodeURIComponent(section.category.slug)}`}
                      className="catalogue-grouped-page-link"
                    >
                      صفحه تخصصی دسته <ArrowLeft className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </header>
                <div className="store-product-grid catalogue-products-grid">
                  {section.items.slice(0, 8).map((product) => (
                    <ProductCard key={product.code} product={product} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div
            className={
              viewMode === "grid" ? "store-product-grid catalogue-products-grid" : "store-product-list catalogue-products-list"
            }
          >
            {paginatedProducts.map((product) => (
              <ProductCard key={product.code} product={product} />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {viewMode !== "grouped" && totalPages > 1 && (
          <div className="catalogue-pagination bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              نمایش ردیف{" "}
              <span className="font-mono font-bold">
                {toPersianDigits((currentPage - 1) * PAGE_SIZE + 1)}
              </span>{" "}
              تا{" "}
              <span className="font-mono font-bold">
                {toPersianDigits(
                  Math.min(currentPage * PAGE_SIZE, filteredProducts.length),
                )}
              </span>{" "}
              از{" "}
              <span className="font-mono font-bold text-orange-600">
                {toPersianDigits(filteredProducts.length)}
              </span>{" "}
              خانواده قطعه
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setCurrentPage((prev) => Math.max(prev - 1, 1));
                  window.scrollTo({ top: 400, behavior: "smooth" });
                }}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title="صفحه قبلی"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 2,
                )
                .map((p, idx, arr) => {
                  const prevVal = arr[idx - 1];
                  const showEllipsis = prevVal && p - prevVal > 1;

                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && (
                        <span className="px-2 text-slate-400 text-xs">...</span>
                      )}
                      <button
                        onClick={() => {
                          setCurrentPage(p);
                          window.scrollTo({ top: 400, behavior: "smooth" });
                        }}
                        className={`min-w-[36px] h-9 px-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                          currentPage === p
                            ? "bg-orange-500 text-white shadow-sm"
                            : "border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {toPersianDigits(p)}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                onClick={() => {
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                  window.scrollTo({ top: 400, behavior: "smooth" });
                }}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title="صفحه بعدی"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
