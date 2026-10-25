import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpLeft, ChevronLeft, LayoutGrid, PackageSearch } from 'lucide-react';
import { CATEGORIES, resolveCategorySlug } from '../../data/categories';
import { CategoryNavigation } from './CategoryNavigation';

/**
 * All primary categories and their complete A/B/C navigation hierarchy are
 * taken from the PostgreSQL-hydrated catalogue. No hard-coded category list.
 */
export function ReferenceMegaMenu({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const categories = CATEGORIES.filter(category => category.active !== false);
  const [selectedSlug, setSelectedSlug] = useState('');
  const current = categories.find(category => category.slug === selectedSlug) || categories[0];

  if (!categories.length) {
    return <div className={compact ? 'reference-catalog-mobile' : 'reference-catalog-menu'} dir="rtl">
      <p className="reference-empty">فهرست دسته‌بندی‌ها در حال دریافت از پایگاه داده است.</p>
    </div>;
  }

  if (compact) {
    return (
      <div className="reference-catalog-mobile" dir="rtl">
        <Link to="/categories" className="reference-mobile-all" onClick={onNavigate}>
          <LayoutGrid size={17} /> مشاهده همه دسته‌بندی‌ها <ArrowLeft size={15} />
        </Link>
        {categories.map(category => (
          <details key={category.slug} className="reference-mobile-category">
            <summary>
              {category.image ? <img src={category.image} alt="" loading="lazy" /> : <LayoutGrid size={19} />}
              <span>{category.name}</span>
              <ChevronLeft size={14} />
            </summary>
            <Link to={'/category/' + resolveCategorySlug(category.slug)} onClick={onNavigate} className="reference-mobile-category-link">
              مشاهده همه محصولات {category.name}
            </Link>
            <CategoryNavigation nodes={category.children || []} categorySlug={category.slug} onNavigate={onNavigate} />
          </details>
        ))}
      </div>
    );
  }

  return (
    <div className="reference-catalog-menu" dir="rtl" role="region" aria-label="تمام دسته‌بندی‌های محصولات">
      <aside className="reference-catalog-sidebar">
        <div className="reference-catalog-heading">
          <LayoutGrid size={18} /> دسته‌بندی‌های اصلی <span>{categories.length.toLocaleString('fa-IR')}</span>
        </div>
        <div className="reference-catalog-category-list">
          {categories.map(category => (
            <button
              key={category.slug}
              type="button"
              className={'reference-catalog-category' + (current?.slug === category.slug ? ' is-selected' : '')}
              onMouseEnter={() => setSelectedSlug(category.slug)}
              onFocus={() => setSelectedSlug(category.slug)}
              onClick={() => setSelectedSlug(category.slug)}
              aria-current={current?.slug === category.slug ? 'true' : undefined}
            >
              {category.image ? <img src={category.image} alt="" loading="lazy" /> : <LayoutGrid size={17} />}
              <span>{category.name}</span><ChevronLeft size={15} />
            </button>
          ))}
        </div>
        <Link className="reference-catalog-all" to="/categories" onClick={onNavigate}>
          مشاهده صفحه تمام دسته‌بندی‌ها <ArrowLeft size={16} />
        </Link>
      </aside>
      {current && <section className="reference-catalog-content" key={current.slug}>
        <div className="reference-catalog-content-heading">
          <div>
            <span className="reference-catalog-eyebrow">صنعت پیش / کاتالوگ تخصصی</span>
            <h3>{current.name}</h3>
            <p>{current.description || 'زیرگروه‌ها و انواع قطعات صنعتی این دسته را انتخاب کنید.'}</p>
            <Link to={'/category/' + resolveCategorySlug(current.slug)} onClick={onNavigate}>
              مشاهده تمام محصولات این دسته <ArrowUpLeft size={15} />
            </Link>
          </div>
          <div className="reference-catalog-cover">
            {current.image ? <img src={current.image} alt={current.name} /> : <PackageSearch size={52} />}
          </div>
        </div>
        <div className="reference-catalog-submenus">
          {(current.children || []).length ? (
            <CategoryNavigation nodes={current.children || []} categorySlug={current.slug} onNavigate={onNavigate} expanded />
          ) : (
            <Link to={'/category/' + resolveCategorySlug(current.slug)} onClick={onNavigate}>
              مشاهده محصولات موجود در این دسته
            </Link>
          )}
        </div>
      </section>}
    </div>
  );
}
