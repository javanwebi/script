import { PulleyCatalogPage } from "./PulleyCatalogPage";
import { ProductCard } from "../components/product/ProductCard";
import {
  matchesProductSearch,
  CATALOGUE_SKU_COUNT,
} from "../data/userProducts";
import { ProductImage } from "../components/product/ProductImage";
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
} from "lucide-react";

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

  const [selectedCategory, setSelectedCategory] =
    useState<string>(categoryParam);
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<string>(subParam);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>(queryParam);
  const [sortBy, setSortBy] = useState<
    "code_asc" | "name_asc" | "rating_desc" | "stock_desc"
  >("code_asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [hasCatalogueImageFilter, setHasCatalogueImageFilter] =
    useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [addedItemCode, setAddedItemCode] = useState<string | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 24;
  // A Supabase /api/runtime hydration replaces the initial catalogue snapshot.
  // Keep the listing reactive; otherwise the first JSON-derived snapshot can
  // remain visible even after fresh PostgreSQL products arrive.
  const [catalogVersion,setCatalogVersion]=useState(0);
  useEffect(()=>subscribeCatalogChanges(()=>setCatalogVersion(v=>v+1)),[]);
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
    setCurrentPage(1);
  }, [categoryParam, subParam, queryParam]);

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
      result = result.filter((p) => p.stock > 0 && !p.inquiryOnly);
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

  const handleCategorySelect = (slug: string) => {
    setSelectedCategory(slug);
    setSelectedSubcategory("all");
    searchParams.delete("sub");
    setCurrentPage(1);
    if (slug === "all") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", slug);
    }
    setSearchParams(searchParams);
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

  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSelectedSubcategory("all");
    setSelectedBrand("all");
    setSearchQuery("");
    setInStockOnly(false);
    setHasCatalogueImageFilter(false);
    setSortBy("code_asc");
    setCurrentPage(1);
    setSearchParams({});
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
    <div className="catalogue-page min-h-screen text-right" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
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

        {/* Minimal Hero Header Banner */}
        <section className="catalogue-intro">
          <div>
            <span className="store-eyebrow">قطعه مناسب، با مشخصات روشن</span>
            <h1>محصولات و قطعات صنعتی</h1>
            <p>
              خانواده محصول را پیدا کنید، کد و سایز را انتخاب کنید و تصویر،
              مشخصات و قیمت همان کد را ببینید.
            </p>
          </div>
          <span>
            {toPersianDigits(allProducts.length)} خانواده ·{" "}
            {toPersianDigits(CATALOGUE_SKU_COUNT)} کد کالا
          </span>
        </section>

        {/* Minimal Category Selector Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            <button
              onClick={() => handleCategorySelect("all")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer ${
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
              return (
                <button
                  key={cat.slug}
                  onClick={() => handleCategorySelect(cat.slug)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-orange-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <span
                    className={isSelected ? "text-white" : "text-slate-500"}
                  >
                    {icon}
                  </span>
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {toPersianDigits(cat.count)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search, Secondary Filters & View Controls Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
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
              {/* Brand Filter */}
              <div className="relative">
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setCurrentPage(1);
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
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-10 px-3 bg-slate-50 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 focus:border-orange-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
                >
                  <option value="code_asc">مرتب‌سازی: کد فنی (صعودی)</option>
                  <option value="name_asc">مرتب‌سازی: نام قطعه (الفبا)</option>
                  <option value="rating_desc">مرتب‌سازی: بیشترین امتیاز</option>

                </select>
              </div>

              {/* In Stock Toggle */}


              {/* Official Catalogue Image Toggle */}
              <label
                className={`flex items-center gap-2 h-10 px-3 rounded-xl border cursor-pointer text-xs font-bold select-none transition-all ${
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
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  دارای تصویر خانواده ({toPersianDigits(countWithImages)})
                </span>
              </label>

              {/* View Mode Toggle (Grid vs List) */}
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  onClick={() => setViewMode("grid")}
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
        </div>

        {/* Results Count & Active Status */}
        <div
          ref={resultsSectionRef}
          id="catalog-products-results"
          className="flex items-center justify-between text-xs text-slate-500 font-medium px-1 scroll-mt-24"
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
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
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
              viewMode === "grid" ? "store-product-grid" : "store-product-list"
            }
          >
            {paginatedProducts.map((product) => (
              <ProductCard key={product.code} product={product} />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
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
