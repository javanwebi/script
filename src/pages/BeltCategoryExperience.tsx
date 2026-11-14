import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronUp,
  CircleHelp,
  Filter,
  Grid3X3,
  Heart,
  Headphones,
  Layers3,
  List,
  PackageSearch,
  RotateCcw,
  Ruler,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import type { Product } from '../types';
import { ProductImage } from '../components/product/ProductImage';
import { resolveDisplayBrand } from '../components/product/ProductCard';
import { getProductDisplayBrands, productHasDisplayBrand } from '../utils/catalogBrands';
import { toDirectSkuProduct, useDirectSkus } from '../components/catalog/DirectSkuProducts';
import { MemberAccess } from '../components/storefront/MemberAccess';
import { useWishlist } from '../context/WishlistContext';
import { getProductsByCategory, subscribeCatalogChanges } from '../data/mockGenerator';
import { matchesCatalogCategory } from '../data/categories';
import { STORE_ASSETS } from '../assets/images';
import { matchesProductSearch } from '../data/userProducts';
import { toPersianDigits, formatPrice } from '../utils/formatters';
import { resolveSiteProductImage } from '../utils/siteProductImages';
import './BeltCategoryExperience.css';

const BELT_SLUG = 'تسمه-و-انتقال-نیرو';
const FAMILY_OPTIONS = [
  {
    id: 'تسمه تایمینگ',
    codeBadge: '8M',
    title: 'گام 8M و تایمینگ',
    subtitle: 'تسمه‌های تایمینگ صنعتی گام متریک و اینچی',
    search: /تایم/i,
  },
  {
    id: 'تسمه V-BELT',
    codeBadge: 'SPA',
    title: 'تسمه وی‌بلت (V-Belt)',
    subtitle: 'کلاسیک (A تا E)، اسپشیال (SPA تا SPC) و دنده‌دار (AX, BX, XP)',
    search: /V.?BELT|کلاسیک|اسپشیال|پروفیل باریک/i,
  },
  {
    id: 'تسمه شیاری',
    codeBadge: 'PK',
    title: 'شیاری و دوطرفه',
    subtitle: 'تسمه شیاری و دندانه در دو طرف PK / PJ / PL',
    search: /شیاری/i,
  },
  {
    id: 'تسمه گرد پلی اورتان',
    codeBadge: 'PU',
    title: 'تسمه متری PU',
    subtitle: 'تسمه پلی‌یورتان برش‌خورده با متراژ دلخواه',
    search: /گرد.*پلی|پلی.*گرد/i,
  },
  {
    id: 'تسمه CRC پنج ضلعی',
    codeBadge: 'T10',
    title: 'T10 و پنج‌ضلعی',
    subtitle: 'تسمه‌های پلی‌یورتان و CRC سری صنعتی',
    search: /CRC|پنج ضلعی/i,
  },
] as const;

const FAMILY_ARTWORK: Record<string, string> = {
  'تسمه V-BELT': STORE_ASSETS.subcategories.vbeltRibbedHero,
  'تسمه تایمینگ': STORE_ASSETS.subcategories.timingBeltHero,
  'تسمه شیاری': STORE_ASSETS.subcategories.vbeltRibbedHero,
  'تسمه گرد پلی اورتان': STORE_ASSETS.subcategories.puWeldedBeltHero,
  'تسمه CRC پنج ضلعی': STORE_ASSETS.subcategories.puWeldedBeltHero,
};

const HERO_BRAND_LOGOS = [
  { name: 'Megadyne', tone: 'brand-megadyne' },
  { name: 'BANDO', tone: 'brand-bando' },
  { name: 'Continental', tone: 'brand-continental' },
  { name: 'optibelt', tone: 'brand-optibelt' },
  { name: 'PowerGrip', tone: 'brand-powergrip' },
  { name: 'JASON', tone: 'brand-jason' },
] as const;

const PITCH_GRID_ITEMS = ['8M', '5M', '14M', '3M', 'T10', 'T5', 'XL', 'L', 'H', 'XH', 'A', 'B'] as const;

const referenceArtworkForProduct = (product: Product): string => {
  return resolveSiteProductImage(product, 'تسمه تایمینگ صنعتی');
};

const DEFAULT_PROFILES = ['SPA', 'SPB', 'SPC', 'SPZ', 'A', 'B', 'C', 'D', 'AX', 'BX', 'CX', 'XPA', 'XPB', 'XPC', 'XPZ', 'Z'] as const;
const number = (raw: string) =>
  Number(
    raw
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٬,]/g, ''),
  );
const priceOf = (p: Product): number | null => {
  const retail = p.prices?.retail;
  return typeof retail === 'number' && Number.isFinite(retail) && retail > 0 && !p.inquiryOnly
    ? retail
    : null;
};
const lengthMm = (p: Product): number | null => {
  const spec =
    p.technicalSpecs?.find(item => /طول|length/i.test(item.key)) ||
    p.variants?.[0]?.technicalSpecs?.find(item => /طول|length/i.test(item.key));
  if (!spec) return null;
  const text = String(spec.value).replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  const match = text.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(',', '.'));
  return Number.isFinite(value) ? (/اینچ|inch/i.test(text) ? value * 25.4 : value) : null;
};
const matchesProfile = (p: Product, profile: string) => {
  if (profile === 'all') return true;
  const allSpecs = [
    ...(p.technicalSpecs || []),
    ...(p.variants || []).flatMap(v => v.technicalSpecs || []),
  ];
  for (const s of allSpecs) {
    if (s.key === 'پروفیل' && s.value.trim().toUpperCase() === profile.toUpperCase()) return true;
  }
  const pattern = new RegExp('(^|[^A-Z0-9])' + profile + '([-\\s]?\\d|\\b)', 'i');
  return [p.code, p.name, p.nameEn || '', ...(p.variants || []).map(v => v.code || v.size || '')].some(code =>
    pattern.test(code),
  );
};
const deriveProfileOptions = (products: Product[]) => {
  const options = new Set<string>();
  products.forEach(product => {
    [
      ...(product.technicalSpecs || []),
      ...(product.variants || []).flatMap(v => v.technicalSpecs || []),
    ].forEach(spec => {
      if (spec.key === 'پروفیل' && spec.value) {
        options.add(spec.value.trim().toUpperCase());
      }
    });
    [
      product.code,
      product.name,
      product.nameEn || '',
      ...(product.variants || []).map(variant => variant.code),
    ].forEach(value => {
      const match = String(value)
        .toUpperCase()
        .match(/(?:^|[^A-Z0-9])(\d{1,2}M|[A-Z]{1,4})(?=[\s-]?\d)/);
      if (match?.[1]) options.add(match[1]);
    });
  });
  return Array.from(options).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
};

type Filters = {
  brands: string[];
  profile: string;
  minimumLength: string;
  maximumLength: string;
  minimumPrice: string;
  maximumPrice: string;
  inStock: boolean;
  quoteOnly: boolean;
};

const blankFilters = (): Filters => ({
  brands: [],
  profile: 'all',
  minimumLength: '',
  maximumLength: '',
  minimumPrice: '',
  maximumPrice: '',
  inStock: false,
  quoteOnly: false,
});

type FilterPanelProps = {
  value: Filters;
  onChange: (next: Filters) => void;
  brands: string[];
  products: Product[];
  profiles: string[];
  classic: boolean;
  hasPrices: boolean;
  onReset?: () => void;
  onApply?: () => void;
};

function FilterFields({
  value,
  onChange,
  brands,
  products,
  profiles,
  classic,
  hasPrices,
  onReset,
  onApply,
}: FilterPanelProps) {
  const [brandSearch, setBrandSearch] = useState('');
  const [materialChoice, setMaterialChoice] = useState<'all' | 'rubber' | 'pu' | 'steel'>('rubber');
  const change = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const pitchChoices = useMemo(() => {
    const combined = Array.from(new Set([...PITCH_GRID_ITEMS, ...profiles])).slice(0, 12);
    return combined.length ? combined : [...DEFAULT_PROFILES];
  }, [profiles]);

  const displayBrands = useMemo(() => {
    const standard = ['Megadyne', 'Bando', 'Continental', 'Optibelt'];
    const merged = Array.from(new Set([...brands, ...standard]));
    return merged.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [brands, brandSearch]);

  return (
    <div className="bce-filter-fields">
      {classic && (
        <section className="bce-filter-group">
          <div className="bce-filter-group-head">
            <h3>فیلتر گام دندانه</h3>
            <ChevronUp size={15} />
          </div>
          <div className="bce-pitch-checkbox-grid" dir="ltr">
            <button
              type="button"
              className={`bce-pitch-check-item ${value.profile === 'all' ? 'active' : ''}`}
              onClick={() => change({ profile: 'all' })}
            >
              <span className="bce-check-box">{value.profile === 'all' && <Check size={11} />}</span>
              <span className="bce-pitch-label">همه گام‌ها</span>
            </button>
            {pitchChoices.map(item => {
              const isChecked = value.profile === item;
              return (
                <button
                  type="button"
                  key={item}
                  className={`bce-pitch-check-item ${isChecked ? 'active' : ''}`}
                  onClick={() => change({ profile: isChecked ? 'all' : item })}
                >
                  <span className="bce-check-box">{isChecked && <Check size={11} />}</span>
                  <span className="bce-pitch-label">{item}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="bce-filter-group">
        <div className="bce-filter-group-head">
          <h3>جنس تسمه</h3>
          <ChevronUp size={15} />
        </div>
        <div className="bce-material-radios">
          {[
            { id: 'rubber', label: 'لاستیکی (Rubber)' },
            { id: 'pu', label: 'پلی‌یورتان (PU)' },
            { id: 'steel', label: 'پلی‌یورتان با سیم فولادی' },
          ].map(opt => (
            <label key={opt.id} className="bce-radio-row">
              <span>{opt.label}</span>
              <input
                type="radio"
                name="bce-belt-material"
                checked={materialChoice === opt.id}
                onChange={() => setMaterialChoice(opt.id as 'rubber' | 'pu' | 'steel')}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="bce-filter-group">
        <div className="bce-filter-group-head">
          <h3>
            <Layers3 size={15} /> برند سازنده
          </h3>
          <ChevronUp size={15} />
        </div>
        <div className="bce-filter-search">
          <Search size={14} />
          <input
            aria-label="جستجو در برندها"
            value={brandSearch}
            onChange={e => setBrandSearch(e.target.value)}
            placeholder="جستجوی برند..."
          />
        </div>
        <div className="bce-filter-brand-list">
          {displayBrands.slice(0, 10).map(brand => {
            const count = products.filter(p => p.brand === brand).length;
            return (
              <label key={brand}>
                <span>
                  <strong dir="ltr">{brand}</strong>
                  {count > 0 && <small>{toPersianDigits(count)}</small>}
                </span>
                <input
                  type="checkbox"
                  checked={value.brands.includes(brand)}
                  onChange={e =>
                    change({
                      brands: e.target.checked
                        ? [...value.brands, brand]
                        : value.brands.filter(v => v !== brand),
                    })
                  }
                />
              </label>
            );
          })}
        </div>
      </section>

      <section className="bce-filter-group">
        <div className="bce-filter-group-head">
          <h3>
            <Ruler size={15} /> عرض و طول تسمه (mm)
          </h3>
          <ChevronUp size={15} />
        </div>
        <div className="bce-range-scale-bar">
          <span>10mm</span>
          <div className="bce-range-track">
            <span className="bce-range-fill" />
            <i className="bce-range-thumb" />
          </div>
          <span>100mm</span>
        </div>
        <div className="bce-range-fields">
          <label>
            از (mm)
            <input
              type="number"
              min="0"
              value={value.minimumLength}
              onChange={e => change({ minimumLength: e.target.value })}
              placeholder="حداقل"
            />
          </label>
          <label>
            تا (mm)
            <input
              type="number"
              min="0"
              value={value.maximumLength}
              onChange={e => change({ maximumLength: e.target.value })}
              placeholder="حداکثر"
            />
          </label>
        </div>
      </section>

      {hasPrices && (
        <section className="bce-filter-group">
          <div className="bce-filter-group-head">
            <h3>محدوده قیمت ثبت‌شده</h3>
            <ChevronUp size={15} />
          </div>
          <div className="bce-range-fields">
            <label>
              از
              <input
                type="number"
                min="0"
                value={value.minimumPrice}
                onChange={e => change({ minimumPrice: e.target.value })}
                placeholder="حداقل"
              />
            </label>
            <label>
              تا
              <input
                type="number"
                min="0"
                value={value.maximumPrice}
                onChange={e => change({ maximumPrice: e.target.value })}
                placeholder="حداکثر"
              />
            </label>
          </div>
        </section>
      )}

      <section className="bce-filter-group bce-toggles">
        <div className="bce-filter-group-head">
          <h3>فیلتر موجودی</h3>
          <ChevronUp size={15} />
        </div>
        <label className="bce-stock-switch-row">
          <span className="bce-stock-check-label">
            <input
              type="checkbox"
              checked={value.inStock}
              onChange={e =>
                change({
                  inStock: e.target.checked,
                  quoteOnly: e.target.checked ? false : value.quoteOnly,
                })
              }
            />
            <strong>موجود در انبار</strong>
          </span>
          <span className={`bce-switch-pill ${value.inStock ? 'on' : ''}`} aria-hidden="true">
            <i />
          </span>
        </label>
        <label>
          <span>فقط نیازمند استعلام قیمت</span>
          <input
            type="checkbox"
            checked={value.quoteOnly}
            onChange={e =>
              change({
                quoteOnly: e.target.checked,
                inStock: e.target.checked ? false : value.inStock,
              })
            }
          />
        </label>
      </section>

      <div className="bce-sidebar-cta-stack">
        <button type="button" className="bce-btn-apply-filter" onClick={() => onApply?.()}>
          اعمال فیلتر
        </button>
        <button
          type="button"
          className="bce-btn-reset-filter"
          onClick={() => (onReset ? onReset() : onChange(blankFilters()))}
        >
          پاک کردن فیلترها
        </button>
      </div>
    </div>
  );
}

function CatalogCard({
  product,
  compareSelected,
  compareDisabled,
  onToggleCompare,
  detailPath,
  disableFallbackImage = false,
}: {
  product: Product;
  compareSelected: boolean;
  compareDisabled: boolean;
  onToggleCompare: (code: string) => void;
  detailPath?: string;
  disableFallbackImage?: boolean;
}) {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const href = detailPath || '/product/' + encodeURIComponent(product.code);
  const marked = isInWishlist(product.code);
  const cardSpecs = (product.technicalSpecs || [])
    .filter(spec => spec.key && spec.value)
    .slice(0, 4);

  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [product.images?.[0]]);
  const fallbackArt = disableFallbackImage ? '' : referenceArtworkForProduct(product);
  const hasSpecificImage = Boolean(product.images?.[0]) && !imageFailed;
  const retailPrice = priceOf(product);
  const brandLabel = resolveDisplayBrand(product.brand, product.name) || getProductDisplayBrands(product)[0] || '';

  return (
    <article className="bce-product-row">
      <div className="bce-card-top-badges">
        <span className="bce-badge-special">ویژه</span>
        <span className="bce-badge-code" dir="ltr">
          {product.variants && product.variants.length > 1
            ? `${toPersianDigits(product.variants.length)} SKU`
            : product.code.slice(0, 7)}
        </span>
      </div>

      <div className="bce-row-media">
        <Link to={href} aria-label={'مشاهده ' + product.name} className="bce-row-image">
          {hasSpecificImage ? (
            <ProductImage
              src={product.images?.[0]}
              fallbackSrc={fallbackArt || undefined}
              disableFallback={disableFallbackImage}
              alt={product.name}
              thumbnail
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          ) : fallbackArt ? (
            <img
              className="bce-product-reference-art"
              src={fallbackArt}
              alt={product.name}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="bce-product-reference-art bce-product-reference-art--empty" role="img" aria-label="تصویر محصول ثبت نشده">
              تصویر تأییدشده ثبت نشده
            </div>
          )}
        </Link>
        <button
          type="button"
          aria-label={marked ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}
          aria-pressed={marked}
          className="bce-heart"
          onClick={() => toggleWishlist(product.code)}
        >
          <Heart size={15} fill={marked ? '#E56B1E' : 'none'} />
        </button>
        <label className="bce-compare-select bce-card-compare-chip">
          <input
            type="checkbox"
            checked={compareSelected}
            disabled={compareDisabled && !compareSelected}
            onChange={() => onToggleCompare(product.code)}
            aria-label={'مقایسه ' + product.name}
          />
          <span>مقایسه</span>
        </label>
      </div>

      <div className="bce-row-content">
        <div className="bce-row-heading">
          <div className="bce-product-code">
            {brandLabel && <span className="bce-brand-badge" dir="ltr">{brandLabel}</span>}
            <b dir="ltr">{product.code}</b>
          </div>
        </div>

        <Link to={href} className="bce-product-name">
          {product.name}
        </Link>

        <div className="bce-mobile-spec-pill">
          <span>{cardSpecs[0] ? `${cardSpecs[0].key}: ${cardSpecs[0].value}` : 'مشخصات فنی ثبت نشده'}</span>
          {brandLabel && <span className="bce-mobile-brand-chip" dir="ltr">{brandLabel}</span>}
        </div>

        <div className="bce-product-specs">
          {cardSpecs.length ? cardSpecs.map((spec, idx) => (
            <div key={`${spec.key}-${idx}`}>
              <span>{spec.key}:</span>
              <strong>{spec.value}</strong>
            </div>
          )) : <div><span>مشخصات فنی</span><strong>در انتظار تکمیل اطلاعات</strong></div>}
        </div>

        <div className="bce-row-meta">
          <div className="bce-product-availability">
            <span className={`dot ${product.stockKnown && product.stock > 0 && !product.inquiryOnly ? 'in-stock' : ''}`} />
            {product.stockKnown && product.stock > 0 && !product.inquiryOnly ? 'موجود در انبار' : 'استعلام موجودی'}
          </div>
          <div className="bce-mobile-price-tag">
            {retailPrice ? `${formatPrice(retailPrice)} تومان` : 'استعلام قیمت'}
          </div>
        </div>

        <div className="bce-row-footer">
          <div className="bce-card-actions-stack">
            <Link className="bce-btn-details" to={href}>
              مشاهده جزئیات
            </Link>
            <Link className="bce-quote-cta" to={href}>
              <ShoppingCart size={14} />
              <span>افزودن به سبد خرید</span>
            </Link>
          </div>
          <div className="bce-member-access">
            <MemberAccess code={product.code} compact />
          </div>
        </div>
      </div>
    </article>
  );
}

function FeaturedProductCard({
  product,
  compareSelected,
  compareDisabled,
  onToggleCompare,
  detailPath,
  disableFallbackImage = false,
}: {
  product: Product;
  compareSelected: boolean;
  compareDisabled: boolean;
  onToggleCompare: (code: string) => void;
  detailPath?: string;
  disableFallbackImage?: boolean;
}) {
  const href = detailPath || '/product/' + encodeURIComponent(product.code);
  const featuredBrand = resolveDisplayBrand(product.brand, product.name) || getProductDisplayBrands(product)[0] || '';
  const specs = (product.technicalSpecs || []).filter(spec => spec.key && spec.value).slice(0, 3);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [product.images?.[0]]);
  const fallbackArt = disableFallbackImage ? '' : referenceArtworkForProduct(product);
  const hasSpecificImage = Boolean(product.images?.[0]) && !imageFailed;
  return (
    <aside className="bce-featured-card" aria-label="محصول پیشنهادی">
      <div className="bce-featured-tag">محصول پیشنهادی</div>
      <Link to={href} aria-label={'مشاهده ' + product.name} className="bce-featured-image">
        {hasSpecificImage ? (
          <ProductImage
            src={product.images?.[0]}
            fallbackSrc={fallbackArt || undefined}
            disableFallback={disableFallbackImage}
            alt={product.name}
            thumbnail
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : fallbackArt ? (
          <img
            className="bce-product-reference-art"
            src={fallbackArt}
            alt={product.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="bce-product-reference-art bce-product-reference-art--empty" role="img" aria-label="تصویر محصول ثبت نشده">
            تصویر تأییدشده ثبت نشده
          </div>
        )}
      </Link>
      <div className="bce-featured-content">
        <div className="bce-product-code">
          <b dir="ltr">{product.code}</b>
          {featuredBrand && <span dir="ltr">{featuredBrand}</span>}
        </div>
        <Link to={href} className="bce-featured-name">
          {product.name}
        </Link>
        <p className="bce-featured-family">{product.subcategory}</p>
        <div className="bce-featured-specs">
          {specs.length ? (
            specs.map(spec => (
              <div key={spec.key}>
                <span>{spec.key}</span>
                <strong>{spec.value}</strong>
              </div>
            ))
          ) : (
            <div>
              <span>گروه محصول</span>
              <strong>{product.subcategory}</strong>
            </div>
          )}
        </div>
        <div className="bce-featured-status">
          <span className={`dot ${product.stockKnown && product.stock > 0 && !product.inquiryOnly ? 'in-stock' : ''}`} />
          {product.stockKnown && product.stock > 0 && !product.inquiryOnly ? 'موجود در انبار' : 'استعلام موجودی'}
        </div>
        <div className="bce-featured-actions">
          <div className="bce-member-access">
            <MemberAccess code={product.code} compact />
          </div>
          <Link className="bce-quote-cta" to={href}>
            استعلام عمده
          </Link>
        </div>
        <label className="bce-compare-select bce-featured-compare">
          <input
            type="checkbox"
            checked={compareSelected}
            disabled={compareDisabled && !compareSelected}
            onChange={() => onToggleCompare(product.code)}
            aria-label={'مقایسه ' + product.name}
          />
          <span>افزودن به مقایسه</span>
        </label>
      </div>
    </aside>
  );
}

export const BeltCategoryExperience: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFamily = searchParams.get('sub') || 'all';
  const isVbelt = selectedFamily === 'تسمه V-BELT';
  const [revision, setRevision] = useState(0);
  const directSkuRecords = useDirectSkus();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState('default');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [draft, setDraft] = useState<Filters>(blankFilters);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [compareCodes, setCompareCodes] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const productsRef = useRef<HTMLDivElement>(null);
  const firstSheetButton = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeCatalogChanges(() => setRevision(v => v + 1)), []);
  useEffect(() => {
    setPage(1);
    setFilters(blankFilters());
  }, [selectedFamily]);

  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', close);
    firstSheetButton.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', close);
    };
  }, [sheetOpen]);

  useEffect(() => {
    if (!compareOpen) return;
    const dialog = document.querySelector<HTMLElement>('.bce-compare-dialog');
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      );
    focusable()[0]?.focus();
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCompareOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog?.focus();
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
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [compareOpen]);

  const allProducts = useMemo(() => getProductsByCategory(BELT_SLUG, 12000).products, [revision]);
  const familyProducts = useMemo(
    () => allProducts.filter(product => matchesCatalogCategory(product, BELT_SLUG, selectedFamily)),
    [allProducts, selectedFamily],
  );
  const directSkuProducts = useMemo(() => {
    const matchesFamily = (item: { name: string; submenu: string; subcategory: string }) => {
      if (selectedFamily === 'all') return true;
      const option = FAMILY_OPTIONS.find(entry => entry.id === selectedFamily);
      return Boolean(option?.search.test([item.name, item.submenu, item.subcategory].join(' ')));
    };
    return directSkuRecords
      .filter(item => item.categorySlug === BELT_SLUG || /^excel-v2-1-[0-9]+$/.test(item.categorySlug))
      .filter(matchesFamily)
      .map(toDirectSkuProduct);
  }, [directSkuRecords, selectedFamily]);
  const directSkuCodes = useMemo(
    () => new Set(directSkuProducts.map(product => product.code)),
    [directSkuProducts],
  );
  const collectionProducts = useMemo(
    () => [...familyProducts, ...directSkuProducts],
    [familyProducts, directSkuProducts],
  );
  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    FAMILY_OPTIONS.forEach(item =>
      counts.set(
        item.id,
        allProducts.filter(product => matchesCatalogCategory(product, BELT_SLUG, item.id)).length,
      ),
    );
    return counts;
  }, [allProducts]);
  const brands = useMemo(
    () => Array.from(new Set(collectionProducts.flatMap(product => getProductDisplayBrands(product))))
      .sort((a, b) => a.localeCompare(b, 'fa')),
    [collectionProducts],
  );
  const profileOptions = useMemo(() => deriveProfileOptions(collectionProducts), [collectionProducts]);
  const showProfileFilter = isVbelt || selectedFamily === 'all' || Boolean(selectedFamily);
  const hasPrices = collectionProducts.some(p => priceOf(p) !== null);

  const filtered = useMemo(() => {
    const minLength = filters.minimumLength !== '' ? number(filters.minimumLength) : null;
    const maxLength = filters.maximumLength !== '' ? number(filters.maximumLength) : null;
    const minPrice = filters.minimumPrice !== '' ? number(filters.minimumPrice) : null;
    const maxPrice = filters.maximumPrice !== '' ? number(filters.maximumPrice) : null;
    const selected = collectionProducts.filter(product => {
      if (search.trim() && !matchesProductSearch(product, search.trim())) return false;
      if (filters.brands.length && !filters.brands.some(brand => productHasDisplayBrand(product, brand))) return false;
      if (filters.profile !== 'all' && !matchesProfile(product, filters.profile)) return false;
      if (filters.inStock && !(product.stockKnown && product.stock > 0)) return false;
      if (filters.quoteOnly && !product.inquiryOnly && priceOf(product) !== null) return false;
      if (minLength !== null || maxLength !== null) {
        const length = lengthMm(product);
        if (
          length === null ||
          (minLength !== null && length < minLength) ||
          (maxLength !== null && length > maxLength)
        )
          return false;
      }
      if (minPrice !== null || maxPrice !== null) {
        const price = priceOf(product);
        if (
          price === null ||
          (minPrice !== null && price < minPrice) ||
          (maxPrice !== null && price > maxPrice)
        )
          return false;
      }
      return true;
    });
    if (sortBy === 'code') selected.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
    if (sortBy === 'price-low') selected.sort((a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity));
    if (sortBy === 'price-high') selected.sort((a, b) => (priceOf(b) ?? -Infinity) - (priceOf(a) ?? -Infinity));
    return selected;
  }, [collectionProducts, filters, search, isVbelt, sortBy]);

  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const featuredProduct = useMemo(
    () => filtered.find(product => !directSkuCodes.has(product.code) && product.images?.[0]) || filtered[0] || null,
    [filtered],
  );
  const compareProducts = useMemo(
    () =>
      compareCodes
        .map(code => collectionProducts.find(product => product.code === code))
        .filter((product): product is Product => Boolean(product)),
    [collectionProducts, compareCodes],
  );
  const comparisonSpecKeys = useMemo(
    () =>
      Array.from(
        new Set(
          compareProducts.flatMap(product =>
            (product.technicalSpecs || []).filter(spec => spec.key && spec.value).map(spec => spec.key),
          ),
        ),
      ),
    [compareProducts],
  );
  const toggleCompare = (code: string) =>
    setCompareCodes(current =>
      current.includes(code)
        ? current.filter(item => item !== code)
        : current.length < 4
          ? [...current, code]
          : current,
    );
  const activeCount =
    filters.brands.length +
    (filters.profile !== 'all' ? 1 : 0) +
    [filters.minimumLength, filters.maximumLength, filters.minimumPrice, filters.maximumPrice].filter(
      Boolean,
    ).length +
    Number(filters.inStock) +
    Number(filters.quoteOnly);

  const chooseFamily = (family: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('sub', family);
    params.delete('q');
    setSearchParams(params);
    setSearch('');
    setPage(1);
  };
  const scrollToProducts = () =>
    productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const changeFilters = (next: Filters) => {
    setFilters(next);
    setPage(1);
  };
  const openSheet = () => {
    setDraft({ ...filters, brands: [...filters.brands] });
    setSheetOpen(true);
  };
  const applySheet = () => {
    changeFilters(draft);
    setSheetOpen(false);
    scrollToProducts();
  };

  const heroSampleImage = useMemo(() => {
    const withImg = familyProducts.find(p => p.images?.[0]);
    if (withImg?.images?.[0]) return withImg.images[0];
    return FAMILY_ARTWORK[selectedFamily] || STORE_ASSETS.products.forzaBelt;
  }, [familyProducts, selectedFamily]);

  return (
    <main className="bce" dir="rtl">
      {/* Mobile Top Search & Pill Strip (matches Mobile Reference Media item 1.jpg) */}
      <div className="bce-mobile-top-header">
        <label className="bce-mobile-search-bar">
          <Search size={17} />
          <input
            type="search"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="جستجو در محصولات صنعتی..."
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="پاک کردن جستجو">
              <X size={14} />
            </button>
          )}
        </label>
        <div className="bce-mobile-title-block">
          <h2>
            {selectedFamily === 'all'
              ? 'تسمه تایمینگ صنعتی'
              : FAMILY_OPTIONS.find(item => item.id === selectedFamily)?.title || selectedFamily}
          </h2>
          <div className="bce-mobile-crumb">
            <Link to="/">خانه</Link>
            <span>›</span>
            <Link to="/categories">تسمه صنعتی</Link>
            <span>›</span>
            <strong>
              {selectedFamily === 'all'
                ? 'تسمه تایمینگ'
                : FAMILY_OPTIONS.find(item => item.id === selectedFamily)?.title || selectedFamily}
            </strong>
          </div>
          <div className="bce-mobile-sub-pills">
            <button
              type="button"
              className={selectedFamily === 'all' ? 'active' : ''}
              onClick={() => chooseFamily('all')}
            >
              گام 8M
            </button>
            {FAMILY_OPTIONS.map(item => (
              <button
                type="button"
                key={item.id}
                className={selectedFamily === item.id ? 'active' : ''}
                onClick={() => chooseFamily(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bce-breadcrumb">
        <Link to="/">خانه</Link>
        <ChevronLeft size={14} />
        <Link to="/products">محصولات</Link>
        <ChevronLeft size={14} />
        <Link to="/categories">تسمه‌های صنعتی</Link>
        <ChevronLeft size={14} />
        <strong>
          {selectedFamily === 'all'
            ? 'تسمه تایمینگ و انتقال قدرت'
            : FAMILY_OPTIONS.find(item => item.id === selectedFamily)?.title || selectedFamily}
        </strong>
      </div>

      {/* Main 2-Column Workspace: Sticky Right Engineering Filter Sidebar + Left Main Column */}
      <div className="bce-catalog" ref={productsRef}>
        <aside className="bce-sidebar" aria-label="فیلترهای محصولات">
          <div className="bce-sidebar-top">
            <h2>
              <SlidersHorizontal size={17} /> فیلتر پیشرفته مهندسی
            </h2>
            <button type="button" onClick={() => changeFilters(blankFilters())}>
              پاکسازی <RotateCcw size={13} />
            </button>
          </div>
          <div className="bce-sidebar-search">
            <Search size={16} />
            <input
              aria-label="جستجو در کاتالوگ"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="جستجوی کد، گام یا مشخصات..."
            />
          </div>
          <FilterFields
            value={filters}
            onChange={changeFilters}
            brands={brands}
            products={collectionProducts}
            profiles={profileOptions}
            classic={showProfileFilter}
            hasPrices={hasPrices}
            onReset={() => {
              setSearch('');
              changeFilters(blankFilters());
            }}
            onApply={scrollToProducts}
          />
        </aside>

        <section className="bce-results" aria-labelledby="bce-results-title">
          {/* 3-Zone Hero Banner inside Main Column (matches Desktop Reference download.jpg) */}
          <section className="bce-hero" aria-labelledby="bce-hero-title">
            <div className="bce-hero-content">
              <span className="bce-kicker">
                <Zap size={14} />{' '}
                <span title="مرجع تخصصی تسمه‌های صنعتی و انتقال قدرت">کاتالوگ مهندسی صنعت پیش</span>
              </span>
              <h1 id="bce-hero-title">
                تسمه تایمینگ و انتقال قدرت صنعتی{' '}
                <em>
                  {isVbelt
                    ? 'تسمه‌های V-BELT'
                    : selectedFamily === 'all'
                      ? 'انتقال مطمئن و پایدار نیرو'
                      : FAMILY_OPTIONS.find(item => item.id === selectedFamily)?.title || selectedFamily}
                </em>
              </h1>
              <p>
                کاتالوگ جامع و تخصصی انواع تسمه‌های تایمینگ صنعتی (گام‌دار) و انتقال نیرو با کیفیت بالا و
                استانداردهای جهانی، مناسب برای انواع ماشین‌آلات و خطوط تولید. مشاوره فنی و انتخاب دقیق گام، عرض
                و جنس مناسب کاربرد شما.
              </p>

              <div className="bce-hero-brands" aria-label="برندهای منتخب تسمه صنعتی">
                {HERO_BRAND_LOGOS.map(brand => (
                  <button
                    key={brand.name}
                    type="button"
                    className={`bce-hero-brand-chip ${brand.tone}`}
                    onClick={() =>
                      changeFilters({
                        ...filters,
                        brands: filters.brands.includes(brand.name) ? [] : [brand.name],
                      })
                    }
                  >
                    {brand.name}
                  </button>
                ))}
              </div>

              <div className="bce-hero-actions">
                <button type="button" onClick={scrollToProducts}>
                  مشاهده محصولات <ArrowLeft size={16} />
                </button>
                <Link to="/ai-consult">
                  مشاوره انتخاب تسمه <Headphones size={16} />
                </Link>
              </div>
              <div className="bce-hero-points">
                <span>
                  <ShieldCheck size={17} /> کاتالوگ کدهای واقعی
                </span>
                <span>
                  <Truck size={17} /> استعلام موجودی و تأمین
                </span>
                <span>
                  <Settings2 size={17} /> راهنمای انتخاب فنی
                </span>
              </div>
            </div>

            <div className="bce-hero-center-showcase">
              <picture className="bce-hero-picture">
                <source media="(max-width: 640px)" srcSet={STORE_ASSETS.products.forzaBelt} />
                <img
                  className="bce-hero-photo"
                  src={STORE_ASSETS.products.forzaBelt}
                  alt="نمای صنعتی پولی و تسمه انتقال نیرو در خط تولید"
                  fetchPriority="high"
                  decoding="async"
                />
              </picture>
              <div className="bce-hero-dots" aria-hidden="true">
                <span className="active" />
                <span />
                <span />
              </div>
            </div>

            <div className="bce-hero-checklist-card">
              <ul>
                <li>
                  <span className="bce-check-icon">
                    <Check size={13} />
                  </span>
                  <strong>تنوع گام دندانه (Pitch)</strong>
                </li>
                <li>
                  <span className="bce-check-icon">
                    <Check size={13} />
                  </span>
                  <strong>قابلیت انتقال گشتاور بالا</strong>
                </li>
                <li>
                  <span className="bce-check-icon">
                    <Check size={13} />
                  </span>
                  <strong>جنس لاستیکی و پلی‌یورتان</strong>
                </li>
                <li>
                  <span className="bce-check-icon">
                    <Check size={13} />
                  </span>
                  <strong>مقاومت در برابر روغن و حرارت</strong>
                </li>
              </ul>
            </div>

            <div className="bce-hero-wash" />
            <div className="bce-hero-stamp">
              <span>POWER TRANSMISSION</span>
              <b>صنعت پیش</b>
            </div>
          </section>

          {/* Horizontal 5-Card Subcategory Visual Strip (matches Desktop Reference download.jpg) */}
          <section className="bce-family-area" aria-labelledby="bce-family-title">
            <div className="bce-section-heading">
              <div>
                <span>زیرشاخه‌های تخصصی</span>
                <h2 id="bce-family-title">انتخاب سریع خانواده و گام تسمه</h2>
              </div>
              <button type="button" onClick={() => chooseFamily('all')}>
                همه خانواده‌ها ({toPersianDigits(allProducts.length)}) <ChevronLeft size={15} />
              </button>
            </div>
            <div className="bce-family-grid">
              {FAMILY_OPTIONS.map(item => {
                const sample = allProducts.find(
                  p => matchesCatalogCategory(p, BELT_SLUG, item.id) && p.images?.[0],
                );
                const count = familyCounts.get(item.id) || 0;
                const fallbackImg = FAMILY_ARTWORK[item.id] || STORE_ASSETS.products.forzaBelt;
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={selectedFamily === item.id}
                    onClick={() => chooseFamily(selectedFamily === item.id ? 'all' : item.id)}
                    className={'bce-family-tile ' + (selectedFamily === item.id ? 'selected' : '')}
                  >
                    <span className="bce-family-code-circle" dir="ltr">
                      {item.codeBadge}
                    </span>
                    <span className="bce-family-copy">
                      <span className="bce-family-name">{item.title}</span>
                      <small className="bce-family-subtitle">{item.subtitle}</small>
                      <span className="bce-family-count">{toPersianDigits(count)} کالا</span>
                    </span>
                    <span className="bce-family-image">
                      {sample?.images?.[0] ? (
                        <ProductImage
                          src={sample.images[0]}
                          fallbackSrc={fallbackImg}
                          alt={item.title}
                          thumbnail
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <img
                          className="bce-family-reference-art"
                          src={fallbackImg}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </span>
                    <span className="bce-family-chevron">
                      <ChevronLeft size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {isVbelt && (
            <section className="bce-profile-row">
              <div>
                <strong>پروفیل تسمه V-BELT</strong>
                <small>انتخاب مقطع مناسب دستگاه</small>
              </div>
              <div className="bce-profile-buttons" dir="ltr">
                {['all', ...(profileOptions.length ? profileOptions : DEFAULT_PROFILES)].map(value => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filters.profile === value}
                    onClick={() => changeFilters({ ...filters, profile: value })}
                  >
                    {value === 'all' ? 'همه' : value}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="bce-results-heading">
            <div>
              <small>کاتالوگ تخصصی صنعت پیش</small>
              <h2 id="bce-results-title">
                محصولات{' '}
                {selectedFamily === 'all'
                  ? 'تسمه و انتقال نیرو'
                  : FAMILY_OPTIONS.find(item => item.id === selectedFamily)?.title || selectedFamily}
              </h2>
            </div>
            <p>تعداد محصولات: {toPersianDigits(filtered.length)} کالا</p>
          </div>

          {/* Toolbar & Active Filters Row (matches Desktop Reference download.jpg & Mobile Reference) */}
          <div className="bce-toolbar">
            <div className="bce-toolbar-right">
              <span className="bce-total-count-label">
                تعداد محصولات: <strong>{toPersianDigits(filtered.length)} کالا</strong>
              </span>
              <div className="bce-active-filter-pills">
                <span className="bce-active-filter-title">فیلترهای فعال:</span>
                {selectedFamily !== 'all' && (
                  <button type="button" onClick={() => chooseFamily('all')}>
                    <span>
                      خانواده:{' '}
                      {FAMILY_OPTIONS.find(item => item.id === selectedFamily)?.title || selectedFamily}
                    </span>
                    <X size={12} />
                  </button>
                )}
                {filters.profile !== 'all' && (
                  <button type="button" onClick={() => changeFilters({ ...filters, profile: 'all' })}>
                    <span>گام دندانه: {filters.profile}</span>
                    <X size={12} />
                  </button>
                )}
                {filters.brands.map(brand => (
                  <button
                    type="button"
                    key={brand}
                    onClick={() =>
                      changeFilters({
                        ...filters,
                        brands: filters.brands.filter(b => b !== brand),
                      })
                    }
                  >
                    <span>برند: {brand}</span>
                    <X size={12} />
                  </button>
                ))}
                {filters.inStock && (
                  <button type="button" onClick={() => changeFilters({ ...filters, inStock: false })}>
                    <span>موجود در انبار</span>
                    <X size={12} />
                  </button>
                )}
                {selectedFamily === 'all' &&
                  filters.profile === 'all' &&
                  filters.brands.length === 0 &&
                  !filters.inStock && (
                    <span className="bce-default-pill">همه گام‌ها و برندهای صنعتی</span>
                  )}
              </div>
            </div>

            <div className="bce-sort-desktop">
              <div className="bce-view-mode-switch" role="group" aria-label="نوع نمایش">
                <button
                  type="button"
                  className={viewMode === 'grid' ? 'active' : ''}
                  onClick={() => setViewMode('grid')}
                  aria-label="نمایش شبکه‌ای"
                >
                  <Grid3X3 size={15} />
                </button>
                <button
                  type="button"
                  className={viewMode === 'list' ? 'active' : ''}
                  onClick={() => setViewMode('list')}
                  aria-label="نمایش لیستی"
                >
                  <List size={15} />
                </button>
              </div>
              <ArrowUpDown size={15} />
              <span>ترتیب بر اساس:</span>
              <button
                type="button"
                className={sortBy === 'default' ? 'current' : ''}
                onClick={() => setSortBy('default')}
              >
                جدیدترین‌ها
              </button>
              <button
                type="button"
                className={sortBy === 'code' ? 'current' : ''}
                onClick={() => setSortBy('code')}
              >
                کد کالا
              </button>
              {hasPrices && (
                <>
                  <button
                    type="button"
                    className={sortBy === 'price-low' ? 'current' : ''}
                    onClick={() => setSortBy('price-low')}
                  >
                    ارزان‌ترین
                  </button>
                  <button
                    type="button"
                    className={sortBy === 'price-high' ? 'current' : ''}
                    onClick={() => setSortBy('price-high')}
                  >
                    گران‌ترین
                  </button>
                </>
              )}
            </div>

            <div className="bce-mobile-tools">
              <button type="button" onClick={openSheet}>
                <Filter size={15} /> فیلترهای فنی{' '}
                <b>({toPersianDigits(activeCount > 0 ? activeCount : 4)})</b>
              </button>
              <label>
                <ArrowUpDown size={14} />
                <select
                  aria-label="مرتب‌سازی موبایل"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="default">مرتب‌سازی: محبوب‌ترین</option>
                  <option value="code">مرتب‌سازی: کد فنی</option>
                  {hasPrices && (
                    <>
                      <option value="price-low">ارزان‌ترین</option>
                      <option value="price-high">گران‌ترین</option>
                    </>
                  )}
                </select>
              </label>
            </div>
            <span className="bce-count">نمایش {toPersianDigits(filtered.length)} کالا</span>
          </div>

          {filtered.length === 0 ? (
            <div className="bce-empty">
              <PackageSearch size={42} />
              <h3>کالایی مطابق این فیلترها پیدا نشد</h3>
              <p>
                کد، خانواده یا فیلترها را تغییر دهید. اطلاعات ساختگی به جای محصولات واقعی نمایش داده نمی‌شود.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  changeFilters(blankFilters());
                }}
              >
                حذف فیلترها
              </button>
            </div>
          ) : (
            <>
              <div className="bce-products-list" data-view-mode={viewMode}>
                {visible.map(p => (
                  <CatalogCard
                    key={p.code}
                    product={p}
                    detailPath={directSkuCodes.has(p.code) ? '/direct-product/' + encodeURIComponent(p.code) : undefined}
                    disableFallbackImage={directSkuCodes.has(p.code)}
                    compareSelected={compareCodes.includes(p.code)}
                    compareDisabled={compareCodes.length >= 4}
                    onToggleCompare={toggleCompare}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <nav className="bce-pagination" aria-label="صفحه‌بندی محصولات">
                  <span className="bce-page-summary">
                    صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => {
                      setPage(currentPage - 1);
                      scrollToProducts();
                    }}
                  >
                    « قبلی
                  </button>
                  <div className="bce-page-numbers">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                      const pageNum = idx + 1;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          className={currentPage === pageNum ? 'active' : ''}
                          onClick={() => {
                            setPage(pageNum);
                            scrollToProducts();
                          }}
                        >
                          {toPersianDigits(pageNum)}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => {
                      setPage(currentPage + 1);
                      scrollToProducts();
                    }}
                  >
                    بعدی »
                  </button>
                </nav>
              )}
            </>
          )}
        </section>

        {featuredProduct && <FeaturedProductCard
            product={featuredProduct}
            detailPath={directSkuCodes.has(featuredProduct.code) ? '/direct-product/' + encodeURIComponent(featuredProduct.code) : undefined}
            disableFallbackImage={directSkuCodes.has(featuredProduct.code)}
            compareSelected={compareCodes.includes(featuredProduct.code)}
            compareDisabled={compareCodes.length >= 4}
            onToggleCompare={toggleCompare}
          />}
      </div>

      <section className="bce-selection-guide">
        <div className="bce-section-heading">
          <div>
            <span>راهنمای کاربردی</span>
            <h2>با اطمینان تسمه مناسب را انتخاب کنید</h2>
          </div>
          <Link to="/ai-consult">
            راهنمای تخصصی <ChevronLeft size={17} />
          </Link>
        </div>
        <div className="bce-steps">
          {[
            ['۰۱', 'نوع کاربرد', 'دستگاه، شرایط و محیط کاری را مشخص کنید.'],
            ['۰۲', 'انتخاب مقطع', 'پروفیل و خانواده انتقال قدرت را تطبیق دهید.'],
            ['۰۳', 'سایز و کد', 'طول و کد درج‌شده روی تسمه را کنترل کنید.'],
            ['۰۴', 'استعلام', 'قیمت و موجودی کد موردنظر را دریافت کنید.'],
          ].map(([n, title, desc]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bce-industry-section">
        <div className="bce-section-heading">
          <div>
            <span>از قطعه تا خط تولید</span>
            <h2>کاربرد تسمه‌ها در صنایع مختلف</h2>
          </div>
          <Link to="/industries">
            مشاهده صنایع <ChevronLeft size={16} />
          </Link>
        </div>
        <div className="bce-industries">
          {[
            {
              name: 'کاشی و سرامیک',
              image: STORE_ASSETS.industries.ceramic,
              link: '/industries/ceramic',
              desc: 'قطعات انتقال نیرو در خطوط تولید',
            },
            {
              name: 'نساجی و پارچه',
              image: STORE_ASSETS.industries.textile,
              link: '/industries/textile',
              desc: 'ماشین‌آلات ریسندگی و بافندگی',
            },
            {
              name: 'بسته‌بندی و کارتن‌سازی',
              image: STORE_ASSETS.industries.manufacturing,
              link: '/industries/packaging',
              desc: 'انتقال حرکت و تجهیزات تولید',
            },
            {
              name: 'غذایی و نوشیدنی',
              image: STORE_ASSETS.industries.foodBottles,
              link: '/industries/food',
              desc: 'تجهیزات خطوط فرآوری و بسته‌بندی',
            },
          ].map(item => (
            <Link key={item.name} to={item.link} className="bce-industry">
              <img src={item.image} alt={item.name} loading="lazy" />
              <div>
                <h3>{item.name}</h3>
                <small>{item.desc}</small>
              </div>
              <ChevronLeft size={21} />
            </Link>
          ))}
        </div>
      </section>

      <section className="bce-help-cards">
        <Link className="bce-help-visual" to="/identify-part">
          <img src={STORE_ASSETS.aiSearchMobile} alt="" loading="lazy" />
          <div>
            <span>
              <Zap size={15} /> میزکار شناسایی
            </span>
            <h2>قطعه را با تصویر پیدا کنید</h2>
            <p>تصویر قطعه یا نوشته روی تسمه را ارسال کنید تا مسیر شناسایی ساده‌تر شود.</p>
            <strong>
              شروع شناسایی <ArrowLeft size={16} />
            </strong>
          </div>
        </Link>
        <Link className="bce-help-ai" to="/ai-consult">
          <img src={STORE_ASSETS.aiConsultRobot} alt="" loading="lazy" />
          <div>
            <span>
              <Headphones size={15} /> مشاوره مهندسی
            </span>
            <h2>در انتخاب قطعه تردید دارید؟</h2>
            <p>مشخصات دستگاه و نیاز فنی را مطرح کنید و راهنمایی تخصصی دریافت کنید.</p>
            <strong>
              شروع مشاوره <ArrowLeft size={16} />
            </strong>
          </div>
        </Link>
      </section>

      <div className="bce-bottom-line">
        <CircleHelp size={17} /> سایز و سازگاری قطعه پیش از سفارش باید با مشخصات واقعی دستگاه تطبیق داده شود.
      </div>

      <div className="bce-compare-dock" aria-label="مقایسه محصولات">
        <div className="bce-compare-summary">
          <Scale size={19} />
          <div>
            <strong>مقایسه محصولات</strong>
            <small>
              {compareProducts.length
                ? toPersianDigits(compareProducts.length) + ' کالا انتخاب شده'
                : 'برای مقایسه، محصولات را انتخاب کنید'}
            </small>
          </div>
        </div>
        <div className="bce-compare-selected">
          {compareProducts.slice(0, 3).map(product => (
            <span key={product.code} dir="ltr">
              {product.code}
            </span>
          ))}
          {compareProducts.length > 3 && <span>+۱</span>}
        </div>
        <button
          type="button"
          className="bce-compare-open"
          disabled={!compareProducts.length}
          onClick={() => setCompareOpen(true)}
        >
          مشاهده مقایسه <ChevronLeft size={16} />
        </button>
        {compareProducts.length > 0 && (
          <button type="button" className="bce-compare-clear" onClick={() => setCompareCodes([])}>
            پاک کردن
          </button>
        )}
      </div>

      {compareOpen && (
        <div className="bce-compare-overlay" onMouseDown={() => setCompareOpen(false)}>
          <section
            className="bce-compare-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="مقایسه محصولات انتخاب‌شده"
            onMouseDown={event => event.stopPropagation()}
          >
            <header className="bce-compare-head">
              <div>
                <small>بررسی فنی کنار یکدیگر</small>
                <h2>مقایسه محصولات انتخاب‌شده</h2>
              </div>
              <button type="button" aria-label="بستن مقایسه" onClick={() => setCompareOpen(false)}>
                <X size={21} />
              </button>
            </header>
            {compareProducts.length < 2 ? (
              <div className="bce-compare-empty">
                <Scale size={30} />
                <strong>برای مقایسه، حداقل دو محصول انتخاب کنید.</strong>
                <p>می‌توانید تا چهار محصول را هم‌زمان بررسی کنید.</p>
              </div>
            ) : (
              <div className="bce-compare-table-wrap">
                <table className="bce-compare-table">
                  <thead>
                    <tr>
                      <th>مشخصات</th>
                      {compareProducts.map(product => (
                        <th key={product.code}>
                          <div>
                            <b dir="ltr">{product.code}</b>
                            <button
                              type="button"
                              aria-label={'حذف ' + product.code + ' از مقایسه'}
                              onClick={() => toggleCompare(product.code)}
                            >
                              ×
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>نام محصول</th>
                      {compareProducts.map(product => (
                        <td key={product.code}>{product.name}</td>
                      ))}
                    </tr>
                    <tr>
                      <th>برند</th>
                      {compareProducts.map(product => (
                        <td key={product.code} dir="ltr">
                          {product.brand || 'ثبت نشده'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>وضعیت تأمین</th>
                      {compareProducts.map(product => (
                        <td key={product.code}>
                          {product.stockKnown && product.stock > 0 ? 'موجودی ثبت‌شده' : 'نیازمند تأیید'}
                        </td>
                      ))}
                    </tr>
                    {comparisonSpecKeys.map(key => (
                      <tr key={key}>
                        <th>{key}</th>
                        {compareProducts.map(product => (
                          <td key={product.code}>
                            {product.technicalSpecs?.find(spec => spec.key === key)?.value || 'ثبت نشده'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="bce-compare-footer">
              <button type="button" onClick={() => setCompareOpen(false)}>
                بازگشت به محصولات
              </button>
              <button type="button" onClick={() => setCompareCodes([])}>
                پاک کردن انتخاب‌ها
              </button>
            </footer>
          </section>
        </div>
      )}

      {sheetOpen && (
        <div className="bce-sheet-backdrop" onMouseDown={() => setSheetOpen(false)}>
          <section
            className="bce-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="فیلتر محصولات"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="bce-sheet-grip" />
            <header>
              <strong>فیلتر محصولات</strong>
              <button
                type="button"
                ref={firstSheetButton}
                aria-label="بستن فیلترها"
                onClick={() => setSheetOpen(false)}
              >
                <X size={22} />
              </button>
            </header>
            <div className="bce-sheet-scroll">
              <FilterFields value={draft}
                onChange={setDraft}
                brands={brands}
                products={collectionProducts}
                profiles={profileOptions}
                classic={showProfileFilter}
                hasPrices={hasPrices}
                onReset={() => setDraft(blankFilters())}
                onApply={applySheet}
              />
            </div>
            <footer>
              <button type="button" onClick={() => setDraft(blankFilters())}>
                حذف فیلترها
              </button>
              <button type="button" onClick={applySheet}>
                <Check size={18} /> اعمال و نمایش محصولات
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
};
