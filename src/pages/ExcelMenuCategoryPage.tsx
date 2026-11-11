import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowUpLeft,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Headphones,
  Image as ImageIcon,
  Layers,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { getAllProducts, subscribeCatalogChanges } from '../data/mockGenerator';
import { ProductCard } from '../components/product/ProductCard';
import { ProductImage } from '../components/product/ProductImage';
import { DirectSkuProducts } from '../components/catalog/DirectSkuProducts';
import type { Product } from '../types';
import type { CategoryNode } from '../data/categories';
import { STORE_ASSETS } from '../assets/images';
import { toPersianDigits } from '../utils/formatters';
import './excel-menu-category-premium.css';

type MenuFamily = {
  code: string;
  name: string;
  brand: string;
  submenu: string | null;
  leaf: string | null;
  skuCount: number;
};

type MenuCategory = {
  slug: string;
  name: string;
  description: string;
  image: string | null;
  children: CategoryNode[];
};

type MenuResponse = {
  success: boolean;
  category?: MenuCategory;
  families?: MenuFamily[];
  message?: string;
};

type CatalogueStatus = 'loading' | 'ready' | 'error';
type SortMode = 'default' | 'name' | 'code' | 'sku_desc' | 'stock_desc';

const PAGE_SIZE = 24;

const normalizeSearch = (value: string) => value
  .toLocaleLowerCase('fa-IR')
  .replace(/ي/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[\u200c\s]+/g, ' ')
  .trim();

const getCategoryArtwork = (category: MenuCategory): string | undefined => {
  if (category.image) return category.image;
  const name = normalizeSearch(category.name);
  if (/تسمه|belt/.test(name)) return STORE_ASSETS.categories.belts;
  if (/نوار نقاله|نقاله|انتقال مواد/.test(name)) return STORE_ASSETS.categories.conveyor;
  if (/رولر|غلتک/.test(name)) return STORE_ASSETS.products.ceramicRoller;
  if (/پولی|pulley/.test(name)) return STORE_ASSETS.categories.pulleys;
  if (/بلبرینگ|یاتاقان|bearing/.test(name)) return STORE_ASSETS.categories.bearings;
  if (/زنجیر|چرخ زنجیر/.test(name)) return STORE_ASSETS.categories.chains;
  if (/ریل راهنما|گاید راهنما|پروفیل هدایت/.test(name)) return STORE_ASSETS.categories.conveyor;
  if (/قطعات پمپ/.test(name)) return STORE_ASSETS.products.pump;
  if (/نسوز|حرارتی|لعاب|چاپ|روتاری/.test(name)) return STORE_ASSETS.industries.ceramic;
  if (/سفارشی|نقشه فنی/.test(name)) return STORE_ASSETS.reverseEngineeringLab;
  return undefined;
};

const matchesSelection = (family: MenuFamily, selection: string) =>
  !selection || family.submenu === selection || family.leaf === selection;

const hasCatalogImage = (product?: Product) => Boolean(product && (
  product.images?.some(Boolean) ||
  product.galleryImages?.some(image => Boolean(image.url)) ||
  product.variants?.some(variant => variant.images?.some(Boolean))
));

const productPreviewImage = (product?: Product) =>
  product?.images?.find(Boolean) ||
  product?.galleryImages?.find(image => image.scope === 'family')?.url ||
  product?.galleryImages?.find(image => image.url)?.url ||
  product?.variants?.find(variant => variant.images?.some(Boolean))?.images?.find(Boolean);

export const ExcelMenuCategoryPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<MenuResponse | null>(null);
  const [status, setStatus] = useState<CatalogueStatus>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [catalogRevision, refreshProducts] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [compareCodes, setCompareCodes] = useState<string[]>([]);
  const [compareNotice, setCompareNotice] = useState('');
  const modalRootRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  const selection = searchParams.get('sub') || '';
  const search = searchParams.get('q') || '';
  const selectedBrands = searchParams.getAll('brand');
  const inStockOnly = searchParams.get('stock') === '1';
  const imageOnly = searchParams.get('image') === '1';
  const requestedSort = searchParams.get('sort') || 'default';
  const sortBy: SortMode = ['default', 'name', 'code', 'sku_desc', 'stock_desc'].includes(requestedSort)
    ? requestedSort as SortMode
    : 'default';
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);

  useEffect(() => subscribeCatalogChanges(() => refreshProducts(value => value + 1)), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setStatus('loading');
    setData(null);
    setCompareCodes([]);
    setComparisonOpen(false);

    fetch('/api/catalog/menu-category/' + encodeURIComponent(slug), {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json() as MenuResponse;
        if (!response.ok || !body.success || !body.category || !Array.isArray(body.families)) {
          throw new Error(body.message || 'catalog unavailable');
        }
        return body;
      })
      .then(body => {
        if (active) {
          setData(body);
          setStatus('ready');
        }
      })
      .catch(error => {
        if (!active || (error instanceof Error && error.name === 'AbortError')) return;
        setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [slug, retryCount]);

  useEffect(() => {
    if (!mobileFiltersOpen && !comparisonOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = () => Array.from(
      modalRootRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [],
    ).filter(element => element.offsetParent !== null);

    const focusFrame = window.requestAnimationFrame(() => {
      (modalCloseRef.current || getFocusable()[0])?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileFiltersOpen(false);
        setComparisonOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (!items.length) {
        event.preventDefault();
        modalCloseRef.current?.focus();
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

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mobileFiltersOpen, comparisonOpen]);

  const products = useMemo(() => new Map<string, Product>(
    getAllProducts().map(product => [product.code, product]),
  ), [data, status, catalogRevision]);

  const families = data?.families || [];
  const category = data?.category;
  const skuTotal = families.reduce((total, family) => total + Math.max(0, Number(family.skuCount) || 0), 0);
  const availableBrands = useMemo(() => Array.from(new Set(
    families.map(family => family.brand).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, 'fa')), [families]);

  const updateParam = (key: string, value: string, replace = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace });
  };

  const updateBrands = (brands: string[]) => {
    const next = new URLSearchParams(searchParams);
    next.delete('brand');
    brands.forEach(brand => next.append('brand', brand));
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['q', 'brand', 'stock', 'image', 'sort', 'sub', 'page'].forEach(key => next.delete(key));
    setSearchParams(next, { replace: true });
    setMobileFiltersOpen(false);
  };

  const filteredFamilies = useMemo(() => {
    const query = normalizeSearch(search);
    const list = families.filter(family => {
      if (!matchesSelection(family, selection)) return false;
      if (selectedBrands.length && !selectedBrands.includes(family.brand)) return false;

      const product = products.get(family.code);
      if (inStockOnly && !(product?.stockKnown === true && product.stock > 0 && !product.inquiryOnly)) return false;
      if (imageOnly && !hasCatalogImage(product)) return false;

      if (!query) return true;
      const searchable = normalizeSearch([
        family.name,
        family.code,
        family.brand,
        family.submenu || '',
        family.leaf || '',
        product?.name || '',
        product?.nameEn || '',
        ...(product?.technicalSpecs || []).flatMap(spec => [spec.key, spec.value]),
        ...(product?.variants || []).flatMap(variant => [
          variant.code,
          variant.name,
          variant.size,
          ...(variant.technicalSpecs || []).flatMap(spec => [spec.key, spec.value]),
        ]),
      ].join(' '));
      return searchable.includes(query);
    });

    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    else if (sortBy === 'code') list.sort((a, b) => a.code.localeCompare(b.code));
    else if (sortBy === 'sku_desc') list.sort((a, b) => b.skuCount - a.skuCount);
    else if (sortBy === 'stock_desc') {
      list.sort((a, b) => {
        const aProduct = products.get(a.code);
        const bProduct = products.get(b.code);
        const aStock = aProduct && aProduct.stockKnown === true && !aProduct.inquiryOnly ? aProduct.stock : -1;
        const bStock = bProduct && bProduct.stockKnown === true && !bProduct.inquiryOnly ? bProduct.stock : -1;
        return bStock - aStock;
      });
    }
    return list;
  }, [families, selection, selectedBrands.join('|'), inStockOnly, imageOnly, search, products, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredFamilies.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageFamilies = filteredFamilies.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeFilterCount = selectedBrands.length + Number(inStockOnly) + Number(imageOnly) + Number(Boolean(selection));
  const featuredFamily = families.find(family => hasCatalogImage(products.get(family.code)));
  const featuredProduct = featuredFamily ? products.get(featuredFamily.code) : undefined;
  const featuredImage = productPreviewImage(featuredProduct);

  const compareFamilies = compareCodes
    .map(code => families.find(family => family.code === code))
    .filter((family): family is MenuFamily => Boolean(family));
  const comparisonSpecs = Array.from(new Set(
    compareFamilies.flatMap(family => (products.get(family.code)?.technicalSpecs || []).map(spec => spec.key)),
  )).slice(0, 10);

  const toggleCompare = (code: string) => {
    setCompareNotice('');
    if (compareCodes.includes(code)) {
      setCompareCodes(compareCodes.filter(item => item !== code));
      return;
    }
    if (compareCodes.length >= 4) {
      setCompareNotice('برای مقایسه هم‌زمان حداکثر چهار خانواده را انتخاب کنید.');
      return;
    }
    setCompareCodes([...compareCodes, code]);
  };

  const selectSubcategory = (name: string) => updateParam('sub', name, false);
  const setStockFilter = (checked: boolean) => updateParam('stock', checked ? '1' : '');
  const setImageFilter = (checked: boolean) => updateParam('image', checked ? '1' : '');
  const isSelectedForCompare = (code: string) => compareCodes.includes(code);
  if (status === 'loading') {
    return (
      <div className="excel-category-page" dir="rtl">
        <div className="excel-category-state" role="status" aria-live="polite">
          <span className="excel-category-spinner" aria-hidden="true" />
          <h1>در حال دریافت کاتالوگ این دسته</h1>
          <p>خانواده‌ها، زیرگروه‌ها و کدهای ثبت‌شده از پایگاه داده خوانده می‌شوند.</p>
        </div>
      </div>
    );
  }

  if (status === 'error' || !category) {
    return (
      <div className="excel-category-page" dir="rtl">
        <nav className="excel-category-breadcrumbs" aria-label="مسیر صفحه">
          <Link to="/">صفحه اصلی</Link><ChevronLeft size={13} /><Link to="/categories">دسته‌بندی‌ها</Link>
        </nav>
        <div className="excel-category-state excel-category-state-error" role="alert">
          <span><Boxes size={26} /></span>
          <h1>اطلاعات این دسته دریافت نشد</h1>
          <p>برای جلوگیری از نمایش اطلاعات قدیمی، فهرست محلی جایگزین داده پایگاه داده نشده است.</p>
          <button type="button" onClick={() => { setStatus('loading'); setRetryCount(value => value + 1); }}>تلاش مجدد</button>
        </div>
      </div>
    );
  }

  const resolvedCategory = category!;
  const artwork = getCategoryArtwork(resolvedCategory);

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

        <header className="excel-category-hero">
          <div className="excel-category-hero-copy">
            <span className="excel-category-eyebrow"><Layers size={14} /> کاتالوگ تخصصی صنعت پیش</span>
            <h1>{resolvedCategory.name}</h1>
            <p>{resolvedCategory.description || 'خانواده‌ها و کدهای فنی ثبت‌شده در این گروه را بر اساس زیرگروه و مشخصات بررسی کنید.'}</p>
            <div className="excel-category-hero-stats">
              <div><strong>{toPersianDigits(families.length)}</strong><span>خانواده ثبت‌شده</span></div>
              <div><strong>{toPersianDigits(skuTotal)}</strong><span>کد و سایز خانواده‌ها</span></div>
            </div>
            <div className="excel-category-hero-actions">
              <a href="#excel-category-products"><ArrowLeft size={16} /> مشاهده خانواده‌ها</a>
              <Link to="/identify-part"><ImageIcon size={16} /> شناسایی با تصویر</Link>
              <Link to="/ai-consult"><Headphones size={16} /> مشاوره فنی</Link>
            </div>
          </div>
          <div className={`excel-category-hero-visual ${artwork ? 'has-image' : 'has-placeholder'}`}>
            {artwork ? (
              <img src={artwork} alt={resolvedCategory.name} loading="eager" fetchPriority="high" decoding="async" />
            ) : (
              <div className="excel-category-hero-placeholder" aria-hidden="true">
                <span /><span /><Package size={66} />
              </div>
            )}
            <div className="excel-category-hero-visual-caption">
              <span>مسیر انتخاب</span>
              <strong>زیرگروه <i>›</i> خانواده <i>›</i> کد فنی</strong>
            </div>
          </div>
        </header>

        <section className="excel-category-subnav" aria-label="انتخاب زیرگروه">
          <div className="excel-category-subnav-heading">
            <div><span>ساختار دسته‌بندی</span><h2>از کدام زیرگروه شروع می‌کنید؟</h2></div>
            <button type="button" aria-pressed={!selection} onClick={() => selectSubcategory('')}>همه خانواده‌ها <strong>{toPersianDigits(families.length)}</strong></button>
          </div>
          <div className="excel-category-subnav-groups">
            {(resolvedCategory.children || []).filter(node => node.hidden !== true).map(node => {
              const nodeCount = families.filter(family => family.submenu === node.name || family.leaf === node.name).length;
              return (
                <div className={`excel-category-subnav-group ${selection === node.name ? 'is-selected' : ''}`} key={node.name}>
                  <button type="button" aria-pressed={selection === node.name} onClick={() => selectSubcategory(node.name)}>
                    <span>{node.name}</span><strong>{toPersianDigits(nodeCount)}</strong>
                  </button>
                  {(node.children || []).filter(child => child.hidden !== true).length > 0 && (
                    <div className="excel-category-subnav-leaves">
                      {(node.children || []).filter(child => child.hidden !== true).map(child => {
                        const childCount = families.filter(family => family.leaf === child.name).length;
                        return (
                          <button type="button" key={child.name} aria-pressed={selection === child.name}
                            onClick={() => selectSubcategory(child.name)}>
                            {child.name}<span>{toPersianDigits(childCount)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <DirectSkuProducts categorySlug={slug} selectedSub={selection || 'all'} />

        <section className="excel-category-toolbar" aria-label="جستجو و مرتب‌سازی خانواده‌ها">
          <label className="excel-category-search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={event => updateParam('q', event.target.value)}
              placeholder="نام خانواده، کد فنی، برند یا مشخصات را جستجو کنید…"
              aria-label="جستجو در خانواده‌ها و مشخصات فنی"
              autoComplete="off"
            />
            {search && <button type="button" onClick={() => updateParam('q', '')} aria-label="پاک کردن جستجو"><X size={15} /></button>}
          </label>
          <div className="excel-category-toolbar-actions">
            <span>{toPersianDigits(filteredFamilies.length)} خانواده مطابق فیلتر</span>
            <label>
              <ArrowUpDown size={15} />
              <select value={sortBy} onChange={event => updateParam('sort', event.target.value === 'default' ? '' : event.target.value)}>
                <option value="default">ترتیب کاتالوگ</option>
                <option value="name">نام خانواده</option>
                <option value="code">کد فنی</option>
                <option value="sku_desc">بیشترین کد و سایز</option>
                <option value="stock_desc">موجودی تأییدشده</option>
              </select>
            </label>
            <button type="button" className="excel-category-mobile-filter" onClick={() => setMobileFiltersOpen(true)}>
              <SlidersHorizontal size={16} /> فیلترها {activeFilterCount > 0 && <b>{toPersianDigits(activeFilterCount)}</b>}
            </button>
          </div>
        </section>

        <div className="excel-category-shop">
          <aside className="excel-category-filter-panel" aria-label="فیلترهای تخصصی">
            <div className="excel-category-filter-heading">
              <div><SlidersHorizontal size={17} /><strong>فیلترهای تخصصی</strong></div>
              <button type="button" onClick={clearFilters} aria-label="پاک کردن فیلترها"><RotateCcw size={14} /></button>
            </div>
            <fieldset>
              <legend>برند سازنده</legend>
              {availableBrands.length ? availableBrands.map(brand => (
                <label key={brand} className="excel-category-filter-choice">
                  <span>{brand}</span>
                  <input type="checkbox" checked={selectedBrands.includes(brand)}
                    onChange={event => updateBrands(event.target.checked
                      ? [...selectedBrands, brand]
                      : selectedBrands.filter(value => value !== brand))} />
                </label>
              )) : <p className="excel-category-filter-muted">برندی برای این گروه ثبت نشده است.</p>}
            </fieldset>
            <fieldset>
              <legend>وضعیت اطلاعات</legend>
              <label className="excel-category-filter-choice">
                <span>فقط دارای تصویر ثبت‌شده</span>
                <input type="checkbox" checked={imageOnly} onChange={event => setImageFilter(event.target.checked)} />
              </label>
              <label className="excel-category-filter-choice">
                <span>فقط دارای موجودی تأییدشده</span>
                <input type="checkbox" checked={inStockOnly} onChange={event => setStockFilter(event.target.checked)} />
              </label>
            </fieldset>
            <div className="excel-category-filter-footnote">
              <ShieldCheck size={15} />
              موجودی فقط زمانی فیلتر می‌شود که وضعیت آن در کاتالوگ تأیید شده باشد.
            </div>
          </aside>

          <section className="excel-category-results" id="excel-category-products" aria-label="خانواده‌های محصول">
            <div className="excel-category-results-heading">
              <div><span>کاتالوگ این دسته</span><h2>{selection || 'تمام خانواده‌ها'}</h2></div>
              <span>{toPersianDigits(filteredFamilies.length)} نتیجه</span>
            </div>

            {filteredFamilies.length === 0 ? (
              <div className="excel-category-empty">
                <span><Search size={24} /></span>
                <h3>خانواده‌ای با این مشخصات پیدا نشد</h3>
                <p>زیرگروه یا فیلترها را تغییر دهید. اگر قطعه در کاتالوگ نیست، می‌توانید برای تأمین یا ساخت آن درخواست مشاوره بفرستید.</p>
                <div><button type="button" onClick={clearFilters}>حذف فیلترها</button><Link to="/ai-consult">درخواست مشاوره <ArrowLeft size={14} /></Link></div>
              </div>
            ) : (
              <div className="excel-category-product-grid">
                {pageFamilies.map(family => {
                  const product = products.get(family.code);
                  const previewImage = productPreviewImage(product);
                  const cardProduct = product ? {
                    ...product,
                    images: product.images?.some(Boolean) ? product.images : previewImage ? [previewImage] : [],
                  } : undefined;
                  const selected = isSelectedForCompare(family.code);
                  return (
                    <div className="excel-category-product-shell" key={family.code}>
                      {cardProduct ? (
                        <ProductCard product={cardProduct} />
                      ) : (
                        <article className="excel-category-family-card">
                          <div className="excel-category-family-art"><Package size={32} /><span>خانواده کاتالوگ</span></div>
                          <div className="excel-category-family-content">
                            <span className="excel-category-family-brand">{family.brand || 'قطعه صنعتی'}</span>
                            <h3>{family.name}</h3>
                            <code dir="ltr">{family.code}</code>
                            <span className="excel-category-family-skus">{toPersianDigits(family.skuCount)} کد و سایز ثبت‌شده</span>
                            <Link to={'/product/' + encodeURIComponent(family.code)}>مشاهده خانواده و محصولات <ArrowUpLeft size={15} /></Link>
                          </div>
                        </article>
                      )}
                      <button type="button" className={`excel-category-compare-toggle ${selected ? 'is-selected' : ''}`}
                        aria-pressed={selected} onClick={() => toggleCompare(family.code)}>
                        {selected ? <Check size={14} /> : <ArrowLeftRight size={14} />}
                        {selected ? 'انتخاب شد' : 'مقایسه'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <nav className="excel-category-pagination" aria-label="صفحه‌بندی خانواده‌ها">
                <button type="button" disabled={currentPage <= 1} onClick={() => updateParam('page', String(currentPage - 1), false)}>قبلی</button>
                <span>صفحه <strong>{toPersianDigits(currentPage)}</strong> از {toPersianDigits(totalPages)}</span>
                <button type="button" disabled={currentPage >= totalPages} onClick={() => updateParam('page', String(currentPage + 1), false)}>بعدی</button>
              </nav>
            )}
          </section>

          <aside className="excel-category-featured" aria-label="نمونه خانواده از این دسته">
            {featuredFamily && featuredProduct ? (
              <>
                <span className="excel-category-featured-eyebrow"><CheckCircle2 size={14} /> نمونه از کاتالوگ این گروه</span>
                <div className="excel-category-featured-image">
                  <ProductImage src={featuredImage} alt={featuredProduct.name} loading="lazy" decoding="async" />
                </div>
                <span className="excel-category-featured-brand">{featuredFamily.brand || 'قطعه صنعتی'}</span>
                <h3>{featuredFamily.name}</h3>
                <code dir="ltr">{featuredFamily.code}</code>
                <p>{toPersianDigits(featuredFamily.skuCount)} کد و سایز در این خانواده ثبت شده است.</p>
                <Link to={'/product/' + encodeURIComponent(featuredFamily.code)}>مشاهده جزئیات خانواده <ArrowLeft size={15} /></Link>
              </>
            ) : (
              <>
                <span className="excel-category-featured-eyebrow"><Headphones size={14} /> راهنمای انتخاب</span>
                <div className="excel-category-featured-placeholder"><Sparkles size={35} /></div>
                <h3>برای انتخاب کد مناسب راهنمایی می‌خواهید؟</h3>
                <p>مشخصات خط تولید یا کد قطعه را بفرستید تا مسیر بررسی فنی و تأمین مشخص شود.</p>
                <Link to="/ai-consult">شروع مشاوره فنی <ArrowLeft size={15} /></Link>
              </>
            )}
            <div className="excel-category-featured-links">
              <Link to="/identify-part"><ImageIcon size={15} /> شناسایی با تصویر</Link>
              <Link to="/ai-consult"><Headphones size={15} /> تماس با FORZA</Link>
            </div>
          </aside>
        </div>
      </div>

      {compareCodes.length > 0 && (
        <div className="excel-category-compare-dock" role="region" aria-label="نوار مقایسه محصولات">
          <div>
            <strong>مقایسه خانواده‌ها <span>{toPersianDigits(compareCodes.length)}/۴</span></strong>
            <small>{compareFamilies.map(family => family.name).join('، ')}</small>
            {compareNotice && <small className="excel-category-compare-notice" role="status">{compareNotice}</small>}
          </div>
          <div>
            <button type="button" className="excel-category-compare-clear" onClick={() => { setCompareCodes([]); setCompareNotice(''); }}>پاک کردن</button>
            <button type="button" className="excel-category-compare-open" disabled={compareFamilies.length < 2} onClick={() => setComparisonOpen(true)}>
              مقایسه {toPersianDigits(compareFamilies.length)} مورد <ArrowLeftRight size={15} />
            </button>
          </div>
        </div>
      )}

      {mobileFiltersOpen && (
        <div className="excel-category-modal-backdrop" onMouseDown={() => setMobileFiltersOpen(false)}>
          <section className="excel-category-filter-sheet" role="dialog" aria-modal="true" aria-label="فیلترهای دسته‌بندی"
            ref={modalRootRef} onMouseDown={event => event.stopPropagation()}>
            <header><strong>فیلترهای دسته‌بندی</strong><button ref={modalCloseRef} type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="بستن فیلترها"><X size={19} /></button></header>
            <div className="excel-category-filter-sheet-content">
              <fieldset>
                <legend>برند سازنده</legend>
                {availableBrands.map(brand => (
                  <label key={brand} className="excel-category-filter-choice">
                    <span>{brand}</span>
                    <input type="checkbox" checked={selectedBrands.includes(brand)}
                      onChange={event => updateBrands(event.target.checked
                        ? [...selectedBrands, brand]
                        : selectedBrands.filter(value => value !== brand))} />
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>وضعیت اطلاعات</legend>
                <label className="excel-category-filter-choice"><span>فقط دارای تصویر ثبت‌شده</span><input type="checkbox" checked={imageOnly} onChange={event => setImageFilter(event.target.checked)} /></label>
                <label className="excel-category-filter-choice"><span>فقط دارای موجودی تأییدشده</span><input type="checkbox" checked={inStockOnly} onChange={event => setStockFilter(event.target.checked)} /></label>
              </fieldset>
            </div>
            <footer><button type="button" onClick={clearFilters}>پاک کردن فیلترها</button><button type="button" onClick={() => setMobileFiltersOpen(false)}>نمایش {toPersianDigits(filteredFamilies.length)} نتیجه</button></footer>
          </section>
        </div>
      )}

      {comparisonOpen && compareFamilies.length > 1 && (
        <div className="excel-category-modal-backdrop excel-category-compare-backdrop" onMouseDown={() => setComparisonOpen(false)}>
          <section className="excel-category-compare-dialog" role="dialog" aria-modal="true" aria-labelledby="excel-category-compare-title"
            ref={modalRootRef} onMouseDown={event => event.stopPropagation()}>
            <header>
              <div><span>مقایسه فنی</span><h2 id="excel-category-compare-title">مقایسه خانواده‌های انتخاب‌شده</h2></div>
              <button ref={modalCloseRef} type="button" onClick={() => setComparisonOpen(false)} aria-label="بستن مقایسه"><X size={19} /></button>
            </header>
            <div className="excel-category-compare-table-wrap">
              <table>
                <thead><tr><th>مشخصه</th>{compareFamilies.map(family => <th key={family.code}>{family.name}<code dir="ltr">{family.code}</code></th>)}</tr></thead>
                <tbody>
                  <tr><th>برند</th>{compareFamilies.map(family => <td key={family.code}>{family.brand || '—'}</td>)}</tr>
                  <tr><th>زیرگروه</th>{compareFamilies.map(family => <td key={family.code}>{family.leaf || family.submenu || '—'}</td>)}</tr>
                  <tr><th>تعداد کد و سایز</th>{compareFamilies.map(family => <td key={family.code}>{toPersianDigits(family.skuCount)}</td>)}</tr>
                  {comparisonSpecs.map(specKey => <tr key={specKey}><th>{specKey}</th>{compareFamilies.map(family => {
                    const value = products.get(family.code)?.technicalSpecs?.find(spec => spec.key === specKey)?.value || '—';
                    return <td key={family.code}>{value}</td>;
                  })}</tr>)}
                </tbody>
              </table>
            </div>
            <footer><span>قیمت و اطلاعات موجودی بر اساس سطح دسترسی حساب مشتری نمایش داده می‌شود.</span><button type="button" onClick={() => setComparisonOpen(false)}>بستن مقایسه</button></footer>
          </section>
        </div>
      )}
    </div>
  );
};
