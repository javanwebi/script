import React, { useEffect, useMemo, useRef, useState } from 'react';
import './excel-menu-category-premium.css';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  Package,
  RotateCcw,
  Ruler,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Category, Product } from '../types';
import { useCatalogPanelMode } from '../hooks/useCatalogPanelMode';
import type { CategoryNode } from '../data/categories';
import { resolveCategorySlug } from '../data/categories';
import { resolveDisplayBrand, productHasDisplayBrand } from '../utils/catalogBrands';
import { toPersianDigits } from '../utils/formatters';
import { getBeltFamilyMedia } from '../utils/beltCatalogMedia';
import {
  buildCategoryFacetProfile,
  buildPaginationWindow,
  extractNumericDimensions,
  matchesDimensionRange,
  matchesDynamicFacetToken,
  normalizeCatalogText,
  type MenuFamilySummary,
} from '../utils/excelCategoryCatalog';

type MenuCategoryPayload = {
  category: {
    slug: string;
    name: string;
    description: string;
    image?: string | null;
    children: CategoryNode[];
  };
  families: MenuFamilySummary[];
  products: Product[];
};

const VBELT_SECTION_GROUPS = [
  {
    id: 'classic',
    title: 'وی‌بلت کلاسیک',
    standard: 'DIN 2215',
    subtitle: 'مقطع استاندارد Z, A, B, C, D',
    profiles: [
      { code: 'Z', size: '10×6' },
      { code: 'A', size: '13×8' },
      { code: 'B', size: '17×11' },
      { code: 'C', size: '22×14' },
      { code: 'D', size: '32×19' },
      { code: 'E', size: '38×25' },
    ],
  },
  {
    id: 'narrow',
    title: 'اسپشیال باریک (Narrow)',
    standard: 'DIN 7753',
    subtitle: 'انتقال توان بالا SPZ, SPA, SPB, SPC',
    profiles: [
      { code: 'SPZ', size: '9.7×8' },
      { code: 'SPA', size: '12.7×10' },
      { code: 'SPB', size: '16.3×13' },
      { code: 'SPC', size: '22×18' },
    ],
  },
  {
    id: 'cogged',
    title: 'دنده‌دار خام‌بر (Raw Edge)',
    standard: 'Cogged',
    subtitle: 'انعطاف‌پذیری بالا برای پولی کوچک',
    profiles: [
      { code: 'AX', size: '13×8' },
      { code: 'BX', size: '17×11' },
      { code: 'CX', size: '22×14' },
      { code: 'XPZ', size: '9.7×8' },
      { code: 'XPA', size: '12.7×10' },
      { code: 'XPB', size: '16.3×13' },
    ],
  },
];

const VBELT_STRUCTURES = [
  { id: 'wrapped', label: 'روکش‌دار (Wrapped)' },
  { id: 'cogged', label: 'دنده‌دار (Cogged)' },
  { id: 'open', label: 'متری / جوشی' },
];

function collectDescendantNames(node: CategoryNode): string[] {
  const out = [node.value || node.name, node.name];
  for (const child of node.children || []) {
    if (child.hidden !== true) {
      out.push(...collectDescendantNames(child));
    }
  }
  return Array.from(new Set(out.filter(Boolean)));
}

function matchesSelection(
  family: MenuFamilySummary,
  targetName: string,
  allTopNodes: CategoryNode[] = [],
): boolean {
  const cleanTarget = normalizeCatalogText(targetName);
  if (!cleanTarget) return true;
  const matchedTopNode = allTopNodes.find((n) => normalizeCatalogText(n.name) === cleanTarget);
  const validTargets = new Set(
    (matchedTopNode ? collectDescendantNames(matchedTopNode) : [targetName]).map(normalizeCatalogText),
  );
  const famSub = normalizeCatalogText(family.submenu || '');
  const famLeaf = normalizeCatalogText(family.leaf || '');
  return validTargets.has(famSub) || validTargets.has(famLeaf);
}

export const ExcelMenuCategoryPage: React.FC = () => {
  const { slug: rawSlug = '' } = useParams<{ slug: string }>();
  const slug = resolveCategorySlug(decodeURIComponent(rawSlug));
  const [searchParams, setSearchParams] = useSearchParams();
  const [panelMode] = useCatalogPanelMode();

  const [payload, setPayload] = useState<MenuCategoryPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showAllFacetOptions, setShowAllFacetOptions] = useState(false);
  const [vbeltMatrixOpen, setVbeltMatrixOpen] = useState(false);
  const [beltStructure, setBeltStructure] = useState('');
  const [beltTopWidth, setBeltTopWidth] = useState('');
  const [specFilterKey, setSpecFilterKey] = useState('all');

  const resultsRef = useRef<HTMLElement>(null);

  const isBeltCategory = slug.startsWith('excel-v2-1-');
  const isVBeltCategory = slug === 'excel-v2-1-2';

  const selection = searchParams.get('sub') || '';
  const brandFilter = searchParams.get('brand') || '';
  const specValue = searchParams.get('spec') || '';
  const queryText = searchParams.get('q') || '';
  const sortMode = (searchParams.get('sort') || 'featured') as 'featured' | 'name' | 'sku_desc';
  const viewMode = (searchParams.get('view') || 'grid') as 'grid' | 'list';
  const defaultPageSize = isBeltCategory ? 12 : 24;
  const pageSize = Math.max(12, Math.min(48, Number(searchParams.get('limit')) || defaultPageSize));
  const currentPageRaw = Math.max(1, Number(searchParams.get('page')) || 1);
  const inStockOnly = searchParams.get('inStock') === '1';
  const imageOnly = searchParams.get('hasImage') === '1';
  const orderMode = searchParams.get('orderMode') || 'all';
  const lenMin = searchParams.get('lenMin') || '';
  const lenMax = searchParams.get('lenMax') || '';
  const dimMin = searchParams.get('dimMin') || '';
  const dimMax = searchParams.get('dimMax') || '';

  const updateParam = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (resetPage && key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setStatus('loading');
    setShowAllFacetOptions(false);

    const loadCategory = async () => {
      try {
        const isExcelSlug = /^excel-v2-[0-9]+-[0-9]+$/.test(slug);
        const endpoint = isExcelSlug
          ? `/api/catalog/reference/menu-category/${encodeURIComponent(slug)}`
          : `/api/catalog/reference/category/${encodeURIComponent(slug)}`;

        const catRes = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });

        if (catRes.status === 404) {
          if (mounted) setStatus('not-found');
          return;
        }
        if (!catRes.ok) throw new Error('Failed to load category');

        const catJson = await catRes.json();
        if (!mounted) return;

        if (isExcelSlug) {
          setPayload({
            category: catJson.category,
            families: catJson.families || [],
            products: catJson.products || [],
          });
        } else {
          const legacyCat = catJson.category as Category;
          const legacyProducts = (catJson.products || []) as Product[];
          setPayload({
            category: {
              slug: legacyCat.slug,
              name: legacyCat.name,
              description: legacyCat.description || '',
              image: legacyCat.image || null,
              children: legacyCat.children || [],
            },
            families: legacyProducts.map((p) => ({
              code: p.code,
              name: p.name,
              brand: resolveDisplayBrand(p.brand, p.name) || p.brand || '',
              submenu: p.resolvedAssignment?.submenuName || p.submenu || p.subcategory || null,
              leaf: p.resolvedAssignment?.leafName || null,
              skuCount: p.variants?.length || 0,
            })),
            products: legacyProducts,
          });
        }
        setStatus('ready');
      } catch (err) {
        if (!mounted || (err instanceof Error && err.name === 'AbortError')) return;
        setStatus('error');
      }
    };

    void loadCategory();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [slug]);

  const resolvedCategory = payload?.category;
  const families = payload?.families || [];
  const productMap = useMemo(
    () => new Map((payload?.products || []).map((p) => [p.code, p])),
    [payload],
  );

  const visibleSubnodes = useMemo(
    () => (resolvedCategory?.children || []).filter((n) => n.hidden !== true),
    [resolvedCategory],
  );

  const subcategoryTabs = useMemo(() => {
    const populated: Array<{ key: string; name: string; count: number }> = [];
    const seen = new Set<string>();
    const categoryNorm = normalizeCatalogText(resolvedCategory?.name || '');

    for (const node of visibleSubnodes) {
      const cleanName = (node.name || '').trim();
      const normName = normalizeCatalogText(cleanName);
      if (!cleanName || !normName || normName === categoryNorm || seen.has(normName)) continue;
      const count = families.filter((fam) => matchesSelection(fam, cleanName, visibleSubnodes)).length;
      if (count > 0) {
        seen.add(normName);
        populated.push({ key: node.value || cleanName, name: cleanName, count });
      }
    }

    if (populated.length < 2) return [];
    return populated;
  }, [visibleSubnodes, families, resolvedCategory?.name]);

  const skuTotal = useMemo(
    () => families.reduce((sum, f) => sum + Math.max(1, Number(f.skuCount || 0)), 0),
    [families],
  );

  const familyResolvedBrands = useMemo(() => {
    const map = new Map<string, string>();
    for (const fam of families) {
      const prod = productMap.get(fam.code);
      const b = resolveDisplayBrand(prod?.brand || fam.brand, prod?.name || fam.name);
      if (b) map.set(fam.code, b);
    }
    return map;
  }, [families, productMap]);

  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const fam of families) {
      const b = familyResolvedBrands.get(fam.code);
      if (!b) continue;
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [families, familyResolvedBrands]);

  const facetProfile = useMemo(
    () => buildCategoryFacetProfile(slug, resolvedCategory?.name || '', families, productMap),
    [slug, resolvedCategory?.name, families, productMap],
  );

  const specKeyOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const prod of productMap.values()) {
      for (const s of prod.technicalSpecs || []) {
        if (s.key?.trim()) keys.add(s.key.trim());
      }
    }
    return Array.from(keys).slice(0, 12);
  }, [productMap]);

  const familyArtwork = (fam: MenuFamilySummary): string => {
    const prod = productMap.get(fam.code);
    if (isBeltCategory) {
      const beltMedia = getBeltFamilyMedia(fam.code, prod?.images?.[0] || prod?.image, {
        variants: prod?.variants,
        legacyFamilyCodes: prod?.legacyFamilyCodes,
      });
      if (beltMedia?.primaryThumbnail) return beltMedia.primaryThumbnail;
    }
    if (prod?.images?.[0]) return prod.images[0];
    if (prod?.image) return prod.image;
    return '';
  };

  const stockStats = useMemo(() => {
    let inStock = 0;
    let withImage = 0;
    for (const fam of families) {
      const prod = productMap.get(fam.code);
      if (prod && prod.stockKnown !== false && prod.stock > 0) inStock += 1;
      const beltMedia = getBeltFamilyMedia(fam.code, prod?.image, {
        variants: prod?.variants,
        legacyFamilyCodes: prod?.legacyFamilyCodes,
      });
      if (prod?.images?.length || beltMedia?.hasVerifiedRealPhoto) {
        withImage += 1;
      }
    }
    return { inStock, withImage };
  }, [families, productMap]);

  const filteredFamilies = useMemo(() => {
    const qNorm = normalizeCatalogText(queryText);
    const qTokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
    const selectedBrands = brandFilter ? brandFilter.split(',').filter(Boolean) : [];

    const matched = families.filter((fam) => {
      const prod = productMap.get(fam.code);
      if (selection && !matchesSelection(fam, selection, visibleSubnodes)) return false;

      if (selectedBrands.length > 0) {
        const famBrand = familyResolvedBrands.get(fam.code) || '';
        const hasAny = selectedBrands.some(
          (b) => famBrand === b || (prod && productHasDisplayBrand(prod, b)),
        );
        if (!hasAny) return false;
      }

      if (specValue && !matchesDynamicFacetToken(fam, prod, specValue)) return false;

      if (beltStructure) {
        const text = normalizeCatalogText(`${fam.name} ${fam.leaf || ''} ${fam.submenu || ''}`);
        if (beltStructure === 'cogged' && !/دنده|cog|xp|ax|bx|cx/.test(text)) return false;
        if (beltStructure === 'wrapped' && /دنده|متری|جوشی/.test(text)) return false;
        if (beltStructure === 'open' && !/متری|جوشی|open/.test(text)) return false;
      }

      if (beltTopWidth) {
        const text = normalizeCatalogText(
          `${fam.name} ${(prod?.technicalSpecs || []).map((s) => s.value).join(' ')}`,
        );
        if (!text.includes(normalizeCatalogText(beltTopWidth))) return false;
      }

      if (inStockOnly && (!prod || !prod.stockKnown || prod.stock <= 0)) return false;

      if (imageOnly) {
        const beltMedia = getBeltFamilyMedia(fam.code, prod?.image, {
          variants: prod?.variants,
          legacyFamilyCodes: prod?.legacyFamilyCodes,
        });
        const hasImg = Boolean(prod?.images?.length || beltMedia?.hasVerifiedRealPhoto);
        if (!hasImg) return false;
      }

      if (orderMode === 'direct') {
        const hasPriced = prod && !prod.inquiryOnly && (prod.prices?.retail || 0) > 0;
        if (!hasPriced) return false;
      } else if (orderMode === 'inquiry') {
        const isInq = !prod || prod.inquiryOnly || (prod.prices?.retail || 0) <= 0;
        if (!isInq) return false;
      }

      if (lenMin || lenMax || dimMin || dimMax) {
        const dims = extractNumericDimensions(fam, prod);
        if (!matchesDimensionRange(dims, lenMin, lenMax, dimMin, dimMax)) return false;
      }

      if (qTokens.length > 0) {
        const specText =
          specFilterKey === 'all'
            ? [
                ...(prod?.technicalSpecs || []).map((s) => `${s.key} ${s.value}`),
                ...(prod?.variants || []).slice(0, 24).flatMap((v) => [
                  v.code,
                  v.size,
                  v.model || '',
                  v.name,
                ]),
              ].join(' ')
            : (prod?.technicalSpecs || [])
                .filter((s) => s.key === specFilterKey)
                .map((s) => s.value)
                .join(' ');
        const haystack = normalizeCatalogText(
          `${fam.code} ${fam.name} ${fam.brand} ${fam.submenu || ''} ${fam.leaf || ''} ${specText}`,
        );
        if (!qTokens.every((t) => haystack.includes(t))) return false;
      }

      return true;
    });

    if (sortMode === 'name') {
      return [...matched].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    }
    if (sortMode === 'sku_desc') {
      return [...matched].sort((a, b) => b.skuCount - a.skuCount);
    }
    return [...matched].sort((a, b) => {
      const prodA = productMap.get(a.code);
      const prodB = productMap.get(b.code);
      const beltA = getBeltFamilyMedia(a.code, prodA?.image, {
        variants: prodA?.variants,
        legacyFamilyCodes: prodA?.legacyFamilyCodes,
      });
      const beltB = getBeltFamilyMedia(b.code, prodB?.image, {
        variants: prodB?.variants,
        legacyFamilyCodes: prodB?.legacyFamilyCodes,
      });
      const hasA = prodA?.images?.length || beltA?.hasVerifiedRealPhoto ? 1 : 0;
      const hasB = prodB?.images?.length || beltB?.hasVerifiedRealPhoto ? 1 : 0;
      if (hasB !== hasA) return hasB - hasA;
      return b.skuCount - a.skuCount;
    });
  }, [
    families,
    productMap,
    selection,
    visibleSubnodes,
    brandFilter,
    familyResolvedBrands,
    specValue,
    beltStructure,
    beltTopWidth,
    inStockOnly,
    imageOnly,
    orderMode,
    lenMin,
    lenMax,
    dimMin,
    dimMax,
    queryText,
    specFilterKey,
    sortMode,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredFamilies.length / pageSize));
  const currentPage = Math.min(currentPageRaw, totalPages);
  const pageFamilies = filteredFamilies.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const paginationTokens = buildPaginationWindow(currentPage, totalPages);

  const toggleBrand = (brandName: string) => {
    const selected = new Set(brandFilter ? brandFilter.split(',').filter(Boolean) : []);
    if (selected.has(brandName)) selected.delete(brandName);
    else selected.add(brandName);
    updateParam('brand', Array.from(selected).join(','));
  };

  const clearFilters = () => {
    setBeltStructure('');
    setBeltTopWidth('');
    setSpecFilterKey('all');
    setSearchParams({}, { replace: true });
  };

  const activeFilterCount =
    (selection ? 1 : 0) +
    (brandFilter ? brandFilter.split(',').filter(Boolean).length : 0) +
    (specValue ? 1 : 0) +
    (queryText ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (imageOnly ? 1 : 0) +
    (orderMode !== 'all' ? 1 : 0) +
    (lenMin || lenMax || dimMin || dimMax ? 1 : 0);

  const detailHrefFor = (code: string) =>
    panelMode
      ? `/consumer-dashboard/product/${encodeURIComponent(code)}`
      : `/product/${encodeURIComponent(code)}`;

  if (status === 'loading') {
    return (
      <div className="excel-category-page" dir="rtl">
        <div className="excel-category-shell">
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3 mt-6">
            <div className="w-9 h-9 border-3 border-orange-200 border-t-[#E06518] rounded-full animate-spin mx-auto" />
            <h2 className="text-sm font-black text-[#2B313A]">در حال دریافت محصولات دسته...</h2>
            <p className="text-xs text-slate-500">اطلاعات از پایگاه داده زنده کاتالوگ بارگذاری می‌شود.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'not-found' || status === 'error' || !resolvedCategory) {
    return (
      <div className="excel-category-page" dir="rtl">
        <div className="excel-category-shell">
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4 mt-6 max-w-xl mx-auto">
            <Package className="w-10 h-10 text-[#E06518] mx-auto" />
            <h2 className="text-base font-black text-[#2B313A]">
              {status === 'not-found' ? 'دسته‌بندی مورد نظر یافت نشد' : 'خطا در دریافت اطلاعات دسته'}
            </h2>
            <p className="text-xs text-slate-500">
              می‌توانید به فهرست جامع دسته‌بندی‌های صنعتی بازگردید و دسته مورد نظر خود را انتخاب کنید.
            </p>
            <Link
              to="/categories"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E06518] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#c85612]"
            >
              <span>بازگشت به همه دسته‌بندی‌ها</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const selectedBrandsSet = new Set(brandFilter ? brandFilter.split(',').filter(Boolean) : []);
  const displayedFacetOptions = showAllFacetOptions
    ? facetProfile.primaryFacetOptions
    : facetProfile.primaryFacetOptions.slice(0, 6);

  const renderFilterSections = (isMobile = false) => (
    <div className="excel-filter-sections">
      {availableBrands.length > 0 && (
        <details open className="excel-filter-group">
          <summary>
            <span>برند</span>
            <ChevronDown size={15} className="excel-filter-chevron" />
          </summary>
          <div className="excel-filter-group-body">
            <div className="excel-filter-checkbox-list">
              {availableBrands.map((b) => {
                const checked = selectedBrandsSet.has(b.name);
                return (
                  <label key={b.name} className={`excel-filter-check-row ${checked ? 'is-checked' : ''}`}>
                    <span className="excel-filter-check-main">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBrand(b.name)}
                      />
                      <span className="excel-filter-check-title">{b.name}</span>
                    </span>
                    <em className="excel-filter-check-count">({toPersianDigits(b.count)})</em>
                  </label>
                );
              })}
            </div>
          </div>
        </details>
      )}

      {facetProfile.primaryFacetOptions.length > 0 && (
        <details open className="excel-filter-group">
          <summary>
            <span>{facetProfile.primaryFacetTitle}</span>
            <ChevronDown size={15} className="excel-filter-chevron" />
          </summary>
          <div className="excel-filter-group-body">
            <div className="excel-filter-checkbox-list">
              {displayedFacetOptions.map((opt) => {
                const checked = specValue === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`excel-filter-check-row ${checked ? 'is-checked' : ''}`}
                  >
                    <span className="excel-filter-check-main">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => updateParam('spec', checked ? '' : opt.value)}
                      />
                      <span className="excel-filter-check-title">{opt.label}</span>
                    </span>
                    <em className="excel-filter-check-count">({toPersianDigits(opt.count)})</em>
                  </label>
                );
              })}
            </div>
            {facetProfile.primaryFacetOptions.length > 6 && (
              <button
                type="button"
                className="excel-filter-show-more cursor-pointer"
                onClick={() => setShowAllFacetOptions((v) => !v)}
              >
                <span>{showAllFacetOptions ? 'نمایش کمتر' : 'نمایش بیشتر'}</span>
                <ChevronDown size={13} className={showAllFacetOptions ? 'is-rotated' : ''} />
              </button>
            )}

            <div className="excel-sidebar-spec-search">
              <span>جستجوی دقیق مشخصه یا پروفیل</span>
              <select
                value={specFilterKey}
                onChange={(e) => setSpecFilterKey(e.target.value)}
                aria-label="فیلتر بر اساس نوع مشخصه فنی"
              >
                <option value="all">همه مشخصات فنی</option>
                {specKeyOptions.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={queryText}
                onChange={(e) => updateParam('q', e.target.value)}
                placeholder={facetProfile.searchPlaceholder}
                aria-label="جستجوی کد یا مشخصه"
              />
            </div>
          </div>
        </details>
      )}

      <details open className="excel-filter-group">
        <summary>
          <span>{facetProfile.dimensionTitle}</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body space-y-2.5">
          <div className="excel-dim-range-block">
            <span className="excel-dim-range-label">{facetProfile.primaryDimLabel}</span>
            <div className="excel-dim-range-inputs">
              <input
                type="text"
                inputMode="decimal"
                placeholder="از"
                value={lenMin}
                onChange={(e) => updateParam('lenMin', e.target.value)}
                aria-label={`${facetProfile.primaryDimLabel} از`}
              />
              <span>تا</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="تا"
                value={lenMax}
                onChange={(e) => updateParam('lenMax', e.target.value)}
                aria-label={`${facetProfile.primaryDimLabel} تا`}
              />
            </div>
          </div>
          <div className="excel-dim-range-block">
            <span className="excel-dim-range-label">{facetProfile.secondaryDimLabel}</span>
            <div className="excel-dim-range-inputs">
              <input
                type="text"
                inputMode="decimal"
                placeholder="از"
                value={dimMin}
                onChange={(e) => updateParam('dimMin', e.target.value)}
                aria-label={`${facetProfile.secondaryDimLabel} از`}
              />
              <span>تا</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="تا"
                value={dimMax}
                onChange={(e) => updateParam('dimMax', e.target.value)}
                aria-label={`${facetProfile.secondaryDimLabel} تا`}
              />
            </div>
          </div>
        </div>
      </details>

      <details className="excel-filter-group">
        <summary>
          <span>نحوه سفارش و قیمت</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body">
          <div className="excel-filter-checkbox-list">
            {[
              { id: 'all', label: 'همه روش‌های تأمین' },
              { id: 'direct', label: 'دارای قیمت ثبت‌شده' },
              { id: 'inquiry', label: 'نیازمند استعلام قیمت' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`excel-filter-check-row ${orderMode === opt.id ? 'is-checked' : ''}`}
              >
                <span className="excel-filter-check-main">
                  <input
                    type="radio"
                    name={isMobile ? 'orderModeMobile' : 'orderModeDesktop'}
                    checked={orderMode === opt.id}
                    onChange={() => updateParam('orderMode', opt.id === 'all' ? '' : opt.id)}
                  />
                  <span className="excel-filter-check-title">{opt.label}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </details>

      <details open className="excel-filter-group">
        <summary>
          <span>وضعیت موجودی</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body">
          <div className="excel-filter-checkbox-list">
            <label className={`excel-filter-check-row ${inStockOnly ? 'is-checked' : ''}`}>
              <span className="excel-filter-check-main">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => updateParam('inStock', e.target.checked ? '1' : '')}
                />
                <span className="excel-filter-check-title">موجود در انبار</span>
              </span>
              <em className="excel-filter-check-count">({toPersianDigits(stockStats.inStock)})</em>
            </label>
            <label className={`excel-filter-check-row ${imageOnly ? 'is-checked' : ''}`}>
              <span className="excel-filter-check-main">
                <input
                  type="checkbox"
                  checked={imageOnly}
                  onChange={(e) => updateParam('hasImage', e.target.checked ? '1' : '')}
                />
                <span className="excel-filter-check-title">دارای تصویر ثبت‌شده</span>
              </span>
              <em className="excel-filter-check-count">({toPersianDigits(stockStats.withImage)})</em>
            </label>
          </div>
        </div>
      </details>
    </div>
  );

  const renderFamilyCards = (gridColsClass: string) => {
    if (pageFamilies.length === 0) {
      return (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <Package className="w-9 h-9 text-slate-400 mx-auto" />
          <h3 className="text-sm font-black text-[#2B313A]">محصولی با این فیلترها پیدا نشد</h3>
          <p className="text-xs text-slate-500">
            فیلترهای انتخابی را تغییر دهید یا از جستجوی جامع کل کاتالوگ استفاده کنید.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#E06518] px-4 py-2 text-xs font-bold text-white hover:bg-[#c85612] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>نمایش همه محصولات این دسته</span>
          </button>
        </div>
      );
    }

    return (
      <div
        data-testid="category-family-grid"
        className={viewMode === 'list' ? 'mt-4 flex flex-col gap-3' : `mt-4 grid ${gridColsClass} gap-5`}
      >
        {pageFamilies.map((family) => {
          const artworkSrc = familyArtwork(family);
          const detailHref = detailHrefFor(family.code);
          const countVal = Math.max(1, Number(family.skuCount || 0));

          if (viewMode === 'list') {
            return (
              <article
                key={family.code}
                data-testid="category-family-card"
                className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 flex items-center gap-4 transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
              >
                <Link
                  to={detailHref}
                  className="w-28 aspect-[4/3] rounded-xl bg-white border border-slate-100 p-2.5 flex items-center justify-center shrink-0 overflow-hidden"
                >
                  {artworkSrc ? (
                    <img
                      src={artworkSrc}
                      alt={family.name}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      role="img"
                      aria-label={`تصویر معتبر خانواده ${family.name} ثبت نشده`}
                      className="w-full h-full bg-slate-50 flex items-center justify-center px-2 text-center text-[10px] font-medium text-slate-400"
                    >
                      تصویر معتبر ثبت نشده
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0 space-y-1">
                  <Link
                    to={detailHref}
                    className="block text-[15px] font-bold text-slate-900 hover:text-[#E06518] transition-colors truncate"
                  >
                    {family.name}
                  </Link>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {toPersianDigits(countVal)} کد کالا
                  </p>
                </div>
                <Link
                  to={detailHref}
                  className="h-10 px-5 rounded-xl bg-[#E06518] hover:bg-[#c85612] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <span>مشاهده</span>
                  <ArrowLeft size={14} />
                </Link>
              </article>
            );
          }

          return (
            <article
              key={family.code}
              data-testid="category-family-card"
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <Link
                to={detailHref}
                className="aspect-[4/3] w-full bg-white border-b border-slate-100 p-5 flex items-center justify-center overflow-hidden"
              >
                {artworkSrc ? (
                    <img
                      src={artworkSrc}
                      alt={family.name}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      role="img"
                      aria-label={`تصویر معتبر خانواده ${family.name} ثبت نشده`}
                      className="w-full h-full bg-slate-50 flex items-center justify-center px-2 text-center text-[10px] font-medium text-slate-400"
                    >
                      تصویر معتبر ثبت نشده
                    </div>
                  )}
              </Link>

              <div className="flex flex-1 flex-col p-4 gap-3">
                <div className="space-y-1">
                  <Link
                    to={detailHref}
                    className="block text-[15px] font-bold text-slate-900 leading-6 line-clamp-2 min-h-[3rem] hover:text-[#E06518] transition-colors"
                  >
                    {family.name}
                  </Link>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {toPersianDigits(countVal)} کد کالا
                  </p>
                </div>

                <Link
                  to={detailHref}
                  className="mt-auto h-10 w-full rounded-xl bg-[#E06518] hover:bg-[#c85612] text-white text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <span>مشاهده</span>
                  <ArrowLeft size={14} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const renderPagination = () =>
    totalPages > 1 ? (
      <nav className="excel-category-pagination" aria-label="صفحه‌بندی محصولات">
        <button
          type="button"
          className="excel-page-arrow cursor-pointer"
          disabled={currentPage <= 1}
          aria-label="صفحه قبلی"
          onClick={() => updateParam('page', String(currentPage - 1), false)}
        >
          <ChevronRight size={15} />
        </button>
        {paginationTokens.map((token, idx) =>
          token === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="excel-page-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={token}
              type="button"
              className={`excel-page-num cursor-pointer ${token === currentPage ? 'is-active' : ''}`}
              aria-current={token === currentPage ? 'page' : undefined}
              onClick={() => updateParam('page', String(token), false)}
            >
              {toPersianDigits(token)}
            </button>
          ),
        )}
        <button
          type="button"
          className="excel-page-arrow cursor-pointer"
          disabled={currentPage >= totalPages}
          aria-label="صفحه بعدی"
          onClick={() => updateParam('page', String(currentPage + 1), false)}
        >
          <ChevronLeft size={15} />
        </button>
      </nav>
    ) : null;

  return (
    <div className="excel-category-page" dir="rtl">
      <div className="excel-category-shell">
        <nav className="excel-category-breadcrumbs" aria-label="مسیر صفحه">
          <Link to="/">صفحه اصلی</Link>
          <ChevronLeft size={13} />
          <Link to="/categories">دسته‌بندی‌ها</Link>
          <ChevronLeft size={13} />
          <span aria-current="page">{resolvedCategory.name}</span>
        </nav>

        <header
          data-testid="category-compact-header"
          className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 sm:px-6 sm:py-5 mb-4 shadow-2xs"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {resolvedCategory.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-500 tabular-nums">
                <span>{toPersianDigits(families.length)} خانواده</span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span>{toPersianDigits(skuTotal)} کد کالا</span>
                {availableBrands.length > 1 && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span>{toPersianDigits(availableBrands.length)} برند</span>
                  </>
                )}
              </div>
            </div>

            <div className="relative w-full md:w-72 lg:w-80 shrink-0">
              <Search
                size={15}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={queryText}
                onChange={(e) => updateParam('q', e.target.value)}
                placeholder={`جستجو در ${resolvedCategory.name} (نام یا کد کالا)...`}
                aria-label="جستجو در این دسته"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-10 pl-9 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#E06518] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E06518]/15 transition-colors"
              />
              {queryText && (
                <button
                  type="button"
                  onClick={() => updateParam('q', '')}
                  aria-label="پاک کردن جستجو"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {subcategoryTabs.length > 0 && (
            <nav
              aria-label="زیرگروه‌های دسته"
              data-testid="category-sub-tabs"
              className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-0.5"
            >
              <button
                type="button"
                aria-pressed={!selection}
                onClick={() => updateParam('sub', '')}
                className={`h-9 px-3.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
                  !selection
                    ? 'border-[#2B313A] bg-[#2B313A] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-[#E06518]/60 hover:text-[#E06518]'
                }`}
              >
                <span>همه</span>
                <span className={`tabular-nums text-[11px] ${!selection ? 'text-slate-300' : 'text-slate-400'}`}>
                  {toPersianDigits(families.length)}
                </span>
              </button>
              {subcategoryTabs.map((tab) => {
                const isSelected = normalizeCatalogText(selection) === normalizeCatalogText(tab.name);
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => updateParam('sub', isSelected ? '' : tab.name)}
                    className={`h-9 px-3.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'border-[#E06518] bg-[#E06518] text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#E06518]/60 hover:text-[#E06518]'
                    }`}
                  >
                    <span>{tab.name}</span>
                    <span className={`tabular-nums text-[11px] ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                      {toPersianDigits(tab.count)}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </header>

        {isVBeltCategory && (
          <section className="excel-vbelt-matrix" aria-label="انتخابگر مهندسی پروفیل و مقطع وی‌بلت">
            <div className="excel-vbelt-matrix-header">
              <div>
                <span className="excel-vbelt-matrix-eyebrow">
                  <Ruler size={13} /> جدول مهندسی مقاطع استاندارد وی‌بلت (DIN 2215 / DIN 7753)
                </span>
                <h2>انتخاب سریع بر اساس تیپ پروفیل، ساختار دندانه و عرض بالای مقطع</h2>
              </div>
              <div className="excel-vbelt-header-actions">
                {(specValue || beltStructure || beltTopWidth) && (
                  <button
                    type="button"
                    className="excel-vbelt-matrix-reset cursor-pointer"
                    onClick={() => {
                      updateParam('spec', '');
                      setBeltStructure('');
                      setBeltTopWidth('');
                    }}
                  >
                    <RotateCcw size={13} /> پاک کردن انتخاب
                  </button>
                )}
                <button
                  type="button"
                  className="excel-vbelt-matrix-toggle cursor-pointer"
                  onClick={() => setVbeltMatrixOpen((v) => !v)}
                  aria-expanded={vbeltMatrixOpen}
                >
                  <span>{vbeltMatrixOpen ? 'بستن جدول مقاطع' : 'باز کردن جدول مقاطع'}</span>
                  <ChevronDown size={15} className={vbeltMatrixOpen ? 'is-rotated' : ''} />
                </button>
              </div>
            </div>

            {vbeltMatrixOpen && (
              <>
                <div className="excel-vbelt-groups-grid">
                  {VBELT_SECTION_GROUPS.map((grp) => (
                    <div key={grp.id} className="excel-vbelt-group-card">
                      <div className="excel-vbelt-group-head">
                        <div>
                          <h3>{grp.title}</h3>
                          <p>{grp.subtitle}</p>
                        </div>
                        <span className="excel-vbelt-standard-tag">{grp.standard}</span>
                      </div>
                      <div className="excel-vbelt-profile-chips">
                        {grp.profiles.map((p) => {
                          const active = specValue === p.code;
                          return (
                            <button
                              key={p.code}
                              type="button"
                              onClick={() => updateParam('spec', active ? '' : p.code)}
                              className={`excel-vbelt-profile-btn cursor-pointer ${active ? 'is-active' : ''}`}
                            >
                              <span className="excel-vbelt-profile-top">
                                <strong>{p.code}</strong>
                              </span>
                              <small dir="ltr">{p.size} mm</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="excel-vbelt-facets-bar">
                  <div className="excel-vbelt-facet-group">
                    <span className="excel-vbelt-facet-label">ساختار:</span>
                    <div className="excel-vbelt-facet-pills">
                      {VBELT_STRUCTURES.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setBeltStructure((v) => (v === st.id ? '' : st.id))}
                          className={`cursor-pointer ${beltStructure === st.id ? 'is-active' : ''}`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {isBeltCategory ? (
          <div className="excel-category-shop">
            <aside className="excel-category-filter-panel" aria-label="فیلتر محصولات">
              <div className="excel-category-filter-heading">
                <div>
                  <SlidersHorizontal size={16} />
                  <strong>فیلتر محصولات</strong>
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  title="بازنشانی فیلترها"
                  aria-label="بازنشانی فیلترها"
                  className="cursor-pointer"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
              {renderFilterSections(false)}
            </aside>

            <section className="excel-category-results" ref={resultsRef} aria-label="فهرست خانواده‌های محصول">
              <div className="excel-category-toolbar">
                <div className="excel-toolbar-controls-right">
                  <label className="excel-toolbar-select-group">
                    <span>نمایش</span>
                    <select
                      value={pageSize}
                      onChange={(e) => updateParam('limit', e.target.value)}
                      aria-label="تعداد نمایش در صفحه"
                    >
                      <option value="12">{toPersianDigits(12)} کالا</option>
                      <option value="24">{toPersianDigits(24)} کالا</option>
                      <option value="36">{toPersianDigits(36)} کالا</option>
                      <option value="48">{toPersianDigits(48)} کالا</option>
                    </select>
                  </label>

                  <label className="excel-toolbar-select-group">
                    <span>مرتب‌سازی:</span>
                    <select
                      value={sortMode}
                      onChange={(e) => updateParam('sort', e.target.value)}
                      aria-label="مرتب‌سازی محصولات"
                    >
                      <option value="featured">پرفروش‌ترین / منتخب</option>
                      <option value="sku_desc">بیشترین تنوع کد فنی</option>
                      <option value="name">الفبایی نام</option>
                    </select>
                  </label>
                </div>

                <div className="excel-toolbar-controls-left">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="excel-category-mobile-filter cursor-pointer"
                  >
                    <SlidersHorizontal size={14} />
                    <span>فیلترها</span>
                    {activeFilterCount > 0 && <b>{toPersianDigits(activeFilterCount)}</b>}
                  </button>

                  <div className="excel-view-switcher" role="group" aria-label="حالت نمایش محصولات">
                    <button
                      type="button"
                      aria-label="نمای شبکه‌ای"
                      aria-pressed={viewMode === 'grid'}
                      className={`cursor-pointer ${viewMode === 'grid' ? 'is-active' : ''}`}
                      onClick={() => updateParam('view', 'grid', false)}
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="نمای فهرستی"
                      aria-pressed={viewMode === 'list'}
                      className={`cursor-pointer ${viewMode === 'list' ? 'is-active' : ''}`}
                      onClick={() => updateParam('view', 'list', false)}
                    >
                      <ListIcon size={15} />
                    </button>
                  </div>

                  <span className="excel-toolbar-counter tabular-nums">
                    نمایش {toPersianDigits(pageFamilies.length ? (currentPage - 1) * pageSize + 1 : 0)} تا{' '}
                    {toPersianDigits(Math.min(currentPage * pageSize, filteredFamilies.length))} از{' '}
                    {toPersianDigits(filteredFamilies.length)} خانواده
                  </span>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="excel-category-active-filters">
                  <b>فیلترهای فعال:</b>
                  {selection && (
                    <button type="button" onClick={() => updateParam('sub', '')} className="cursor-pointer">
                      زیرگروه: {selection} <X size={12} />
                    </button>
                  )}
                  {Array.from(selectedBrandsSet).map((b) => (
                    <button key={b} type="button" onClick={() => toggleBrand(b)} className="cursor-pointer">
                      برند: {b} <X size={12} />
                    </button>
                  ))}
                  {specValue && (
                    <button type="button" onClick={() => updateParam('spec', '')} className="cursor-pointer">
                      پروفیل: {specValue} <X size={12} />
                    </button>
                  )}
                  <button type="button" onClick={clearFilters} className="is-reset cursor-pointer">
                    پاک کردن همه
                  </button>
                </div>
              )}

              {renderFamilyCards('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}
              {renderPagination()}
            </section>
          </div>
        ) : (
          <section ref={resultsRef} aria-label="فهرست خانواده‌های محصول" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span>مرتب‌سازی:</span>
                  <select
                    value={sortMode}
                    onChange={(e) => updateParam('sort', e.target.value)}
                    aria-label="مرتب‌سازی خانواده‌ها"
                    className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-800 focus:border-[#E06518] focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="featured">منتخب</option>
                    <option value="sku_desc">بیشترین کد کالا</option>
                    <option value="name">الفبایی</option>
                  </select>
                </label>

                {availableBrands.length > 1 && (
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>برند:</span>
                    <select
                      value={brandFilter.split(',')[0] || ''}
                      onChange={(e) => updateParam('brand', e.target.value)}
                      aria-label="فیلتر برند"
                      className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-800 focus:border-[#E06518] focus:bg-white focus:outline-none cursor-pointer"
                    >
                      <option value="">همه برندها</option>
                      {availableBrands.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name} ({toPersianDigits(b.count)})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#E06518] hover:text-[#c85612] cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>پاک کردن فیلترها</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                  {filteredFamilies.length === families.length
                    ? `${toPersianDigits(filteredFamilies.length)} خانواده`
                    : `${toPersianDigits(filteredFamilies.length)} از ${toPersianDigits(families.length)} خانواده`}
                </span>

                <div className="excel-view-switcher" role="group" aria-label="حالت نمایش محصولات">
                  <button
                    type="button"
                    aria-label="نمای شبکه‌ای"
                    aria-pressed={viewMode === 'grid'}
                    className={`cursor-pointer ${viewMode === 'grid' ? 'is-active' : ''}`}
                    onClick={() => updateParam('view', 'grid', false)}
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="نمای فهرستی"
                    aria-pressed={viewMode === 'list'}
                    className={`cursor-pointer ${viewMode === 'list' ? 'is-active' : ''}`}
                    onClick={() => updateParam('view', 'list', false)}
                  >
                    <ListIcon size={15} />
                  </button>
                </div>
              </div>
            </div>

            {renderFamilyCards('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}
            {renderPagination()}
          </section>
        )}
      </div>

      {isBeltCategory && mobileFiltersOpen && (
        <div className="excel-category-modal-backdrop" onMouseDown={() => setMobileFiltersOpen(false)}>
          <section
            className="excel-category-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="فیلترهای دسته‌بندی"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <strong>فیلتر محصولات — {resolvedCategory.name}</strong>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="بستن فیلترها"
                className="cursor-pointer"
              >
                <X size={19} />
              </button>
            </header>
            <div className="excel-category-filter-sheet-content">{renderFilterSections(true)}</div>
            <footer>
              <button type="button" onClick={clearFilters} className="cursor-pointer">
                پاک کردن فیلترها
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="cursor-pointer"
              >
                نمایش {toPersianDigits(filteredFamilies.length)} نتیجه
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

export default ExcelMenuCategoryPage;
