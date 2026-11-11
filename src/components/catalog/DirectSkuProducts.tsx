import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, ArrowUpLeft, Layers } from 'lucide-react';
import { ProductImage } from '../product/ProductImage';
import { toPersianDigits } from '../../utils/formatters';

export type DirectSku = {
  skuCode: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  submenu: string;
  subcategory: string;
  brand: string;
  imageUrl: string | null;
  technicalSpecs: Array<{ key: string; value: string }>;
  priceSnapshot: Record<string, unknown>;
  active: boolean;
};

type DirectSkuProductsProps = {
  /** Omit or pass "all" to include every category's standalone SKU. */
  categorySlug?: string;
  selectedSub?: string;
  searchQuery?: string;
  selectedBrand?: string;
  imageOnly?: boolean;
  inStockOnly?: boolean;
  exclusiveBrandsOnly?: boolean;
  title?: string;
  description?: string;
};

const normalizeSearch = (value: string) => value
  .toLocaleLowerCase('fa-IR')
  .replace(/ي/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[\u200c\s]+/g, ' ')
  .trim();

export function useDirectSkus() {
  const [items, setItems] = useState<DirectSku[]>([]);
  useEffect(() => {
    let alive = true;
    const refresh = () => fetch('/api/catalog/direct-skus', { cache: 'no-store', credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (alive && data?.success && Array.isArray(data.items)) {
          setItems(data.items.filter((item: DirectSku) => item && item.active !== false));
        }
      })
      .catch(() => {
        // Keep the last successful direct-SKU snapshot on transient network failures.
      });
    void refresh();
    window.addEventListener('catalog-direct-skus-updated', refresh);
    return () => {
      alive = false;
      window.removeEventListener('catalog-direct-skus-updated', refresh);
    };
  }, []);
  return items;
}

export function DirectSkuProducts({
  categorySlug,
  selectedSub = 'all',
  searchQuery = '',
  selectedBrand = 'all',
  imageOnly = false,
  inStockOnly = false,
  exclusiveBrandsOnly = false,
  title,
  description,
}: DirectSkuProductsProps) {
  const all = useDirectSkus();
  const query = normalizeSearch(searchQuery);
  const items = useMemo(() => all.filter(item => {
    if (categorySlug && categorySlug !== 'all' && item.categorySlug !== categorySlug) return false;
    if (selectedSub !== 'all' && selectedSub !== item.submenu && selectedSub !== item.subcategory) return false;
    if (selectedBrand !== 'all' && item.brand !== selectedBrand) return false;
    if (exclusiveBrandsOnly && !/SWR|FORZA/i.test(item.brand || '')) return false;
    if (imageOnly && !item.imageUrl) return false;
    // The direct-SKU endpoint does not expose an authoritative stock field.
    // Never imply that these records are in stock when the user filters by stock.
    if (inStockOnly) return false;
    if (query) {
      const searchable = normalizeSearch([
        item.skuCode,
        item.name,
        item.categoryName,
        item.submenu,
        item.subcategory,
        item.brand,
        ...(item.technicalSpecs || []).flatMap(spec => [spec.key, spec.value]),
      ].filter(Boolean).join(' '));
      if (!searchable.includes(query)) return false;
    }
    return true;
  }), [all, categorySlug, selectedSub, selectedBrand, exclusiveBrandsOnly, imageOnly, inStockOnly, query]);

  if (!items.length) return null;

  const isGlobalCatalogue = !categorySlug || categorySlug === 'all';
  const sectionTitle = title || (isGlobalCatalogue ? 'کالاهای مستقیم بدون خانواده' : 'کدهای کالای مستقیم این گروه');
  const sectionDescription = description || (isGlobalCatalogue
    ? 'قطعاتی که مستقل از خانواده‌های محصول ثبت شده‌اند؛ هر کد، صفحه مشخصات و مسیر اختصاصی خود را دارد.'
    : 'قطعات کم‌تعداد بدون الزام به ساخت خانواده؛ تصویر، کد و مشخصات هر کالا جداگانه ثبت شده‌اند.');

  return (
    <section dir="rtl" className="direct-sku-products" aria-label={sectionTitle}>
      <div className="direct-sku-products-heading">
        <div>
          <span><Layers size={14} /> کاتالوگ مستقل</span>
          <h2>{sectionTitle}</h2>
          <p>{sectionDescription}</p>
        </div>
        <strong>{toPersianDigits(items.length)} کالا</strong>
      </div>
      <div className="direct-sku-products-grid">
        {items.map(item => (
          <Link key={item.skuCode} to={'/direct-product/' + encodeURIComponent(item.skuCode)} className="direct-sku-product-card">
            <div className="direct-sku-product-image">
              {item.imageUrl
                ? <ProductImage src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" loading="lazy" decoding="async" />
                : <ImageIcon className="text-slate-300" size={34} />}
            </div>
            <div className="direct-sku-product-copy">
              <span className="direct-sku-product-code" dir="ltr">{item.skuCode}</span>
              <h3>{item.name}</h3>
              <span className="direct-sku-product-category">{item.categoryName} / {item.subcategory || item.submenu}</span>
              {item.brand && <span className="direct-sku-product-brand">{item.brand}</span>}
              {(item.technicalSpecs || []).slice(0, 2).map(spec => (
                <span className="direct-sku-product-spec" key={spec.key}>
                  <b>{spec.key}</b><strong>{spec.value}</strong>
                </span>
              ))}
              <span className="direct-sku-product-link">مشاهده مشخصات کالا <ArrowUpLeft size={15} /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
