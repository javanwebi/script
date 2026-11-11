import { PulleyCatalogPage } from "./PulleyCatalogPage";
import { ProductCard } from "../components/product/ProductCard";
import {
  matchesProductSearch,
  CATALOGUE_SKU_COUNT,
  categorySlugFor,
} from "../data/userProducts";
import { ProductImage } from "../components/product/ProductImage";
import { STORE_ASSETS } from "../assets/images";
import "./products-page-premium.css";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { scrollToSectionElement } from "../components/layout/ScrollToTop";
import { getAllProducts, subscribeCatalogChanges } from "../data/mockGenerator";
import {
  CATEGORIES,
  findCatalogCategory,
  matchesCatalogCategory,
  resolveCategorySlug,
} from "../data/categories";
import { CategoryNavigation } from "../components/catalog/CategoryNavigation";
import { Product } from "../types";
import { toPersianDigits } from "../utils/formatters";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import {
  Search,
  Filter,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Heart,
  ShoppingCart,
  Eye,
  Check,
  Package,
  Layers,
  Sparkles,
  Grid3X3,
  List,
  RotateCcw,
  Tag,
  Cpu,
  Grid,
  CircleDot,
  Shield,
  Link as LinkIcon,
  Scissors,
  ShieldCheck,
  ArrowUpDown,
  Image as ImageIcon,
  X,
} from "lucide-react";

const BELT_CATEGORY_SLUG = categorySlugFor("تسمه و انتقال نیرو");

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "power-transmission": <Cpu className="w-4 h-4" />,
  "industrial-belts": <Layers className="w-4 h-4" />,
  "ceramic-tiles": <Grid className="w-4 h-4" />,
  "pulleys-idlers": <CircleDot className="w-4 h-4" />,
  "bearings-bushings": <Shield className="w-4 h-4" />,
  "chains-sprockets": <LinkIcon className="w-4 h-4" />,
  "textile-machinery": <Scissors className="w-4 h-4" />,
  "swr-forza-exclusive": <ShieldCheck className="w-4 h-4" />,
};

const CATEGORY_ARTWORK: Record<string, string> = {
  "power-transmission": STORE_ASSETS.categories.transmission,
  "industrial-belts": STORE_ASSETS.categories.belts,
  "ceramic-tiles": STORE_ASSETS.categories.ceramic,
  "pulleys-idlers": STORE_ASSETS.categories.pulleys,
  "bearings-bushings": STORE_ASSETS.categories.bearings,
  "chains-sprockets": STORE_ASSETS.categories.chains,
  "textile-machinery": STORE_ASSETS.categories.textile,
};

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, openAuthModal } = useAuth();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  // URL-driven or local state
  const categoryParam = resolveCategorySlug(
    searchParams.get("category") || "all",
  );
  const subParam = searchParams.get("sub") || "all";
  const queryParam = searchParams.get("q") || "";
  const brandParam = searchParams.get("brand") || "all";
  const stockParam = searchParams.get("stock") === "1";
  const imageParam = searchParams.get("image") === "1";

  const [selectedCategory, setSelectedCategory] =
    useState<string>(categoryParam);
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<string>(subParam);
  const [selectedBrand, setSelectedBrand] = useState<string>(brandParam);
  const [searchQuery, setSearchQuery] = useState<string>(queryParam);
  const [sortBy, setSortBy] = useState<
    "code_asc" | "name_asc" | "rating_desc" | "stock_desc"
  >("code_asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [inStockOnly, setInStockOnly] = useState<boolean>(stockParam);
  const [hasCatalogueImageFilter, setHasCatalogueImageFilter] =
    useState<boolean>(imageParam);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileFilterCloseRef = useRef<HTMLButtonElement>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [addedItemCode, setAddedItemCode] = useState<string | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 24;
  // A Supabase /api/runtime hydration replaces the initial catalogue snapshot.
  // Keep the listing reactive; otherwise the first JSON-derived snapshot can
  // remain visible even after fresh PostgreSQL products arrive.
  const [catalogVersion,setCatalogVersion]=useState(0);
  useEffect(() => subscribeCatalogChanges(() => setCatalogVersion((version) => version + 1)), []);
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileFiltersOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    mobileFilterCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [mobileFiltersOpen]);
  const allProducts = useMemo(() => getAllProducts(), [catalogVersion]);

  // Total products with official uploaded catalogue images
  const countWithImages = useMemo(() => {
    return allProducts.filter((p) => p.hasCatalogueImage).length;
  }, [allProducts]);

  // Synchronize category state if URL changes
  useEffect(() => {
    setSelectedCategory(categoryParam);
    setSelectedSubcategory(subParam);
    setSearchQuery(queryParam);
    setSelectedBrand(brandParam);
    setInStockOnly(stockParam);
    setHasCatalogueImageFilter(imageParam);
    setCurrentPage(1);
  }, [categoryParam, subParam, queryParam, brandParam, stockParam, imageParam]);

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
    allProducts.forEach((p) => bSet.add(p.brand));
    return Array.from(bSet).sort();
  }, [allProducts]);

  // Active category object
  const activeCategoryObj = useMemo(() => {
    return findCatalogCategory(selectedCategory);
  }, [selectedCategory]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // Match the selected branch together with all of its descendants.
    if (selectedCategory === "swr-forza-exclusive") {
      result = result.filter(
        (p) => p.brand.includes("SWR") || p.brand.includes("FORZA"),
      );
    } else if (selectedCategory !== "all") {
      result = result.filter((p) =>
        matchesCatalogCategory(p, selectedCategory, selectedSubcategory),
      );
    } else if (selectedSubcategory !== "all") {
      result = result.filter((p) => p.subcategory === selectedSubcategory);
    }

    // 3. Brand Filter
    if (selectedBrand !== "all") {
      result = result.filter((p) => p.brand === selectedBrand);
    }

    // 4. In-Stock Filter
    if (inStockOnly) {
      result = result.filter((p) => p.stockKnown === true && p.stock > 0 && !p.inquiryOnly);
    }

    // 5. Official Catalogue Image Filter
    if (hasCatalogueImageFilter) {
      result = result.filter((p) => p.hasCatalogueImage);
    }

    // 6. Search Query
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
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q))) ||
          (p.technicalSpecs &&
            p.technicalSpecs.some(
              (s) =>
                s.key.toLowerCase().includes(q) ||
                s.value.toLowerCase().includes(q),
            )),
      );
    }

    // 7. Sorting
    result.sort((a, b) => {
      if (sortBy === "code_asc") {
        return a.code.localeCompare(b.code, undefined, { numeric: true });
      }
      if (sortBy === "name_asc") {
        return a.name.localeCompare(b.name, "fa");
      }
      if (sortBy === "rating_desc") {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === "stock_desc") {
        return b.stock - a.stock;
      }
      return 0;
    });

    return result;
  }, [
    allProducts,
    selectedCategory,
    selectedSubcategory,
    selectedBrand,
    inStockOnly,
    hasCatalogueImageFilter,
    searchQuery,
    sortBy,
  ]);

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

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.variants?.length) {
      navigate(`/product/${encodeURIComponent(product.code)}`);
      return;
    }
    if (!currentUser) {
      openAuthModal();
      return;
    }
    addToCart(product, 1);
    setAddedItemCode(product.code);
    setTimeout(() => setAddedItemCode(null), 1500);
  };

  const clearAdvancedFilters = () => {
    setSelectedBrand("all");
    setInStockOnly(false);
    setHasCatalogueImageFilter(false);
    const nextParams = new URLSearchParams(searchParams);
    ["brand", "stock", "image"].forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams, { replace: true });
  };

  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSelectedSubcategory("all");
    setSelectedBrand("all");
    setSearchQuery("");
    setInStockOnly(false);
    setHasCatalogueImageFilter(false);
    setSortBy("code_asc");
    setCurrentPage(1);
    const nextParams = new URLSearchParams(searchParams);
    ["category", "sub", "q", "brand", "stock", "image"].forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams);
  };

  const activeFiltersCount =
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
          <span className="text-slate-800 font-bold">
            محصولات و کاتالوگ صنعتی
          </span>
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
            <span className="store-eyebrow">کاتالوگ تخصصی صنعت پیش</span>
            <h1>قطعه مناسب خط تولید را دقیق‌تر پیدا کنید</h1>
            <p>
              از خانواده و برند تا کد فنی و مشخصات؛ محصولات را در کاتالوگ واقعی
              صنعت پیش جست‌وجو و مقایسه کنید.
            </p>
            <div className="catalogue-hero-actions">
              <Link to="/identify-part" className="catalogue-hero-primary">
                شناسایی تصویری قطعه
              </Link>
              <Link to="/ai-consult" className="catalogue-hero-secondary">
                مشاوره فنی فورزا
              </Link>
            </div>
            <div className="catalogue-hero-metrics" aria-label="آمار کاتالوگ">
              <span><strong>{toPersianDigits(allProducts.length)}</strong><small>خانواده محصول</small></span>
              <span><strong>{toPersianDigits(CATALOGUE_SKU_COUNT)}</strong><small>کد فنی کالا</small></span>
            </div>
          </div>
          <div className="catalogue-hero-art" aria-hidden="true">
            <img src={STORE_ASSETS.heroBanner} alt="" loading="lazy" decoding="async" />
            <span className="catalogue-hero-art-label">تأمین هوشمند قطعات صنعتی</span>
          </div>
        </section>

        {/* Minimal Category Selector Tabs */}
        <section className="catalogue-category-rail">
          <div className="catalogue-section-heading"><div><span>دسته‌بندی کاتالوگ</span><h2>از کدام گروه شروع می‌کنید؟</h2></div><small>انتخاب دسته، فهرست کالاها را محدود می‌کند</small></div>
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
              <Package className="w-4 h-4" />
              <span>همه محصولات</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                  selectedCategory === "all"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {toPersianDigits(allProducts.length)}
              </span>
            </button>

            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.slug;
              const icon = CATEGORY_ICONS[cat.slug] || (
                <Layers className="w-4 h-4" />
              );
              const artwork = cat.image || CATEGORY_ARTWORK[cat.slug];
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
                  <span className="catalogue-category-name">{cat.name}</span>
                  <span className="catalogue-category-count">
                    {toPersianDigits(cat.count)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

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
                placeholder="جستجو در کد فنی قطعه (مثلاً AT-E045)، نام قطعه، برند یا مشخصات..."
                className="w-full pr-10 pl-24 h-10 bg-slate-50 text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-orange-500 focus:bg-white focus:outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
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
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-10 px-3 bg-slate-50 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 focus:border-orange-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
                >
                  <option value="code_asc">مرتب‌سازی: کد فنی (صعودی)</option>
                  <option value="name_asc">مرتب‌سازی: نام قطعه (الفبا)</option>
                  <option value="rating_desc">مرتب‌سازی: بیشترین امتیاز</option>

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

              {/* View Mode Toggle (Grid vs List) */}
              <div className="catalogue-view-toggle flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  onClick={() => setViewMode("grid")}
                  aria-pressed={viewMode === "grid"}
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

          {activeCategoryObj && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-xs font-bold text-[#484344]">
                  زیرگروه‌های {activeCategoryObj.name}
                </span>
                <button
                  type="button"
                  className="text-xs text-[#E06518] font-bold"
                  onClick={() => {
                    searchParams.delete("sub");
                    setSearchParams(searchParams);
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
                  searchParams.set("sub", name);
                  setSearchParams(searchParams);
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
              {toPersianDigits(paginatedProducts.length)}
            </span>{" "}
            از{" "}
            <span className="font-bold text-orange-600 font-mono">
              {toPersianDigits(filteredProducts.length)}
            </span>{" "}
            کالا
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
            صفحه{" "}
            <span className="font-bold font-mono">
              {toPersianDigits(currentPage)}
            </span>{" "}
            از{" "}
            <span className="font-bold font-mono">
              {toPersianDigits(totalPages)}
            </span>
          </div>
        </div>

        {/* Products Display (Grid or List) */}
        {paginatedProducts.length === 0 ? (
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
        {totalPages > 1 && (
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
              قطعه
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
