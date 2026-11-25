import React, { useEffect, useMemo, useState } from 'react';
import './all-categories-premium.css';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  Cpu,
  Layers,
  Link2,
  Package,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { STORE_ASSETS } from '../assets/images';
import { CategoryNavigation } from '../components/catalog/PopdCategoryNavigation';
import { resolveCategorySlug } from '../data/categories';
import type { Category } from '../types';
import type { CategoryNode } from '../data/categories';
import { toPersianDigits } from '../utils/formatters';
import {
  EXCEL_GROUP_ARTWORK,
  normalizeCatalogText,
  resolveExcelCategoryArtwork,
} from '../utils/excelCategoryCatalog';

type MenuGroup = {
  id: string;
  title: string;
  iconKey?: string;
  imageUrl?: string | null;
  categorySlugs: string[];
  sortOrder?: number;
  active?: boolean;
};

const ICON_MAP: Record<string, typeof Package> = {
  Package,
  Layers,
  CircleDot,
  Shield,
  Cpu,
  Wrench,
  Settings,
  Link2,
};

const GROUP_META: Record<string, { image: string; subtitle: string }> = {
  'excel-v2-1': {
    image: STORE_ASSETS.categories.belts,
    subtitle: 'تسمه‌های انتقال قدرت، تایمینگ، شیاری، پلی‌یورتان و تسمه‌های دور متغیر صنعتی',
  },
  'excel-v2-2': {
    image: STORE_ASSETS.categories.conveyor,
    subtitle: 'نوار نقاله‌های PVC، PU، لاستیکی، مدولار، تفلونی و خدمات بازدید و نصب خطوط',
  },
  'excel-v2-3': {
    image: STORE_ASSETS.subcategories.rollerConveyorHero,
    subtitle: 'رولیک‌های صنعتی، غلتک‌های روکش‌دار، بوش و فنرها، خارهای نگهدارنده و قطعات خطوط',
  },
  'excel-v2-4': {
    image: STORE_ASSETS.categories.pulleys,
    subtitle: 'پولی‌های چدنی، آلومینیومی و پلاستیکی، پولی تایمینگ، چرخ‌دنده‌ها و کوپلینگ‌ها',
  },
  'excel-v2-5': {
    image: STORE_ASSETS.subcategories.industrialBrushes,
    subtitle: 'برس‌های استوانه‌ای، دیسکی، خطی، شستشو و پولیش برای خطوط کاشی، نساجی و بسته‌بندی',
  },
  'excel-v2-6': {
    image: STORE_ASSETS.subcategories.guideRailsProfiles,
    subtitle: 'ریل‌های هدایت و راهنمای تسمه، پروفیل‌های پلی‌اتیلن، پایه‌های کشویی و سنسورهای خط',
  },
  'excel-v2-7': {
    image: STORE_ASSETS.subcategories.polymerSealsHero,
    subtitle: 'ضربه‌گیرها، مکنده و بادکش‌ها، اورینگ‌ها، کاسه‌نمدها، قطعات پلیمری و آب‌بندهای تخصصی صنعتی',
  },
  'excel-v2-8': {
    image: STORE_ASSETS.subcategories.refractoryPtfeCord,
    subtitle: 'تجهیزات نسوز، عایق‌های حرارتی، نمدهای نسوز و ملزومات کوره کاشی و سرامیک',
  },
  'excel-v2-9': {
    image: STORE_ASSETS.categories.chains,
    subtitle: 'زنجیرهای صنعتی، استیل، نقاله، چرخ‌زنجیرها و تجهیزات جانبی انتقال قدرت',
  },
  'excel-v2-10': {
    image: STORE_ASSETS.subcategories.ceramicGlazeRotary,
    subtitle: 'ملزومات تخصصی خطوط لعاب، چاپ، روتاری، اسکراپر و تجهیزات تکمیلی سرامیک',
  },
  'excel-v2-11': {
    image: STORE_ASSETS.subcategories.wireMeshScreens,
    subtitle: 'توری‌های مش نسوز، تفلون، فایبرگلاس و نوارهای خشک‌کن خطوط چاپ و بسته‌بندی',
  },
  'excel-v2-12': {
    image: STORE_ASSETS.reverseEngineeringLab,
    subtitle: 'مهندسی معکوس، ساخت قطعات سفارشی از روی نمونه یا نقشه فنی و خدمات کارگاهی',
  },
  'excel-v2-13': {
    image: STORE_ASSETS.categories.bearings,
    subtitle: 'بلبرینگ‌ها، رولبرینگ‌ها، یاتاقان‌های صنعتی، بلبرینگ‌های نسوز و خطی',
  },
  'excel-v2-14': {
    image: STORE_ASSETS.subcategories.spongesFoamScourers,
    subtitle: 'انواع ابر و اسفنج صنعتی، فوم‌های نسوز و ضربه‌گیرهای خطوط لعاب و بسته‌بندی',
  },
};

function flattenCategoryNodes(nodes: CategoryNode[] = []): CategoryNode[] {
  return nodes
    .filter((node) => node.hidden !== true)
    .flatMap((node) => [node, ...flattenCategoryNodes(node.children || [])]);
}

const categoryArtwork = (category: Category): string =>
  resolveExcelCategoryArtwork(category.slug, category.name, category.image);

const categoryDescription = (category: Category): string => {
  if (category.description?.trim()) return category.description.trim();
  const childNames = (category.children || [])
    .filter((node) => node.hidden !== true)
    .map((node) => node.name);
  return childNames.length
    ? childNames.slice(0, 4).join(' · ')
    : 'مسیرهای مرتبط و ساختار زیرگروه‌های این دسته را بررسی کنید.';
};

const categoryHref = (slug: string, subcategory?: string) => {
  const path = '/category/' + encodeURIComponent(resolveCategorySlug(slug));
  if (!subcategory) return path;
  return `${path}?${new URLSearchParams({ sub: subcategory }).toString()}`;
};

export const AllCategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const selectedGroupFilter = searchParams.get('group') || 'all';
  const [viewLayout, setViewLayout] = useState<'cards' | 'matrix'>('cards');
  const [catalogueCategories, setCatalogueCategories] = useState<Category[]>([]);
  const [catalogueGroups, setCatalogueGroups] = useState<MenuGroup[]>([]);
  const [source, setSource] = useState<'loading' | 'database' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (source !== 'database' || !/^menu-group-excel-v2-[0-9]+$/.test(target)) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [source, catalogueGroups]);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    const loadExcelHierarchy = async () => {
      try {
        const [categoriesResponse, groupsResponse] = await Promise.all([
          fetch('/api/catalog/reference/categories', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/catalog/reference/navigation-groups', { cache: 'no-store', signal: controller.signal }),
        ]);
        if (!categoriesResponse.ok || !groupsResponse.ok) {
          throw new Error('Catalogue navigation request failed');
        }
        const [categoriesData, groupsData] = await Promise.all([
          categoriesResponse.json(),
          groupsResponse.json(),
        ]);
        if (
          !categoriesData?.success ||
          !groupsData?.success ||
          !Array.isArray(categoriesData.categories) ||
          !Array.isArray(groupsData.groups)
        ) {
          throw new Error('Catalogue navigation response is incomplete');
        }

        const indexed = new Map<string, Category>(
          (categoriesData.categories as Category[])
            .filter((category) => category && typeof category.slug === 'string' && category.active !== false)
            .map((category) => [category.slug, category]),
        );

        const groups = (groupsData.groups as MenuGroup[])
          .filter(
            (group) =>
              /^excel-v2-[0-9]+$/.test(group.id) &&
              group.active !== false &&
              Array.isArray(group.categorySlugs),
          )
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        const seen = new Set<string>();
        const ordered = groups
          .flatMap((group) => group.categorySlugs.map((slug) => indexed.get(slug)))
          .filter((category): category is Category => {
            if (!category || seen.has(category.slug)) return false;
            seen.add(category.slug);
            return true;
          });

        if (!groups.length || !ordered.length) {
          throw new Error('No approved catalogue categories were returned');
        }
        if (!mounted) return;
        setCatalogueCategories(ordered);
        setCatalogueGroups(groups);
        setSource('database');
      } catch (error) {
        if (!mounted || (error instanceof Error && error.name === 'AbortError')) return;
        setSource('error');
      }
    };

    void loadExcelHierarchy();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [retryCount]);

  const setSearchQuery = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const setGroupFilter = (groupId: string) => {
    const next = new URLSearchParams(searchParams);
    if (groupId && groupId !== 'all') next.set('group', groupId);
    else next.delete('group');
    setSearchParams(next, { replace: true });
  };

  const query = normalizeCatalogText(searchQuery);

  const categorySections = useMemo(
    () =>
      catalogueGroups
        .filter((group) => selectedGroupFilter === 'all' || group.id === selectedGroupFilter)
        .map((group) => {
          const groupMatches = query.length > 0 && normalizeCatalogText(group.title).includes(query);
          const categories = catalogueCategories.filter((category) => {
            if (!group.categorySlugs.includes(category.slug)) return false;
            if (!query || groupMatches) return true;
            const searchable = normalizeCatalogText(
              [
                category.name,
                category.nameEn || '',
                category.description || '',
                ...flattenCategoryNodes(category.children || []).map((node) => node.name),
              ].join(' '),
            );
            return searchable.includes(query);
          });
          const totalFamilies = categories.reduce(
            (acc, cat) => acc + Number(cat.familyCount ?? cat.count ?? 0),
            0,
          );
          const totalSkus = categories.reduce((acc, cat) => acc + Number(cat.skuCount ?? 0), 0);
          return { ...group, categories, totalFamilies, totalSkus };
        })
        .filter((group) => group.categories.length > 0),
    [catalogueCategories, catalogueGroups, query, selectedGroupFilter],
  );

  const visibleCategoryCount = categorySections.reduce(
    (total, section) => total + section.categories.length,
    0,
  );
  const liveCategoryCount = catalogueCategories.length;
  const totalSubcategoriesCount = useMemo(
    () =>
      catalogueCategories.reduce(
        (sum, cat) => sum + flattenCategoryNodes(cat.children || []).length,
        0,
      ),
    [catalogueCategories],
  );

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    next.delete('group');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="all-categories-page" dir="rtl">
      <div className="all-categories-shell">
        <nav className="all-categories-breadcrumbs" aria-label="مسیر صفحه">
          <Link to="/">صفحه اصلی</Link>
          <ChevronLeft aria-hidden="true" />
          <span aria-current="page">دسته‌بندی قطعات صنعتی</span>
        </nav>

        {/* Hero Section matching Screenshots 1 */}
        <section className="all-categories-hero" aria-labelledby="all-categories-title">
          <div className="all-categories-hero-copy">
            <span className="all-categories-eyebrow">
              <span className="all-categories-eyebrow-mark">
                <Layers size={14} />
              </span>
              کاتالوگ و دسته‌بندی‌های تخصصی صنعت پیش
            </span>
            <h1 id="all-categories-title">
              دسته‌بندی و کاتالوگ جامع
              <em>قطعات و تجهیزات صنعتی صنعت پیش</em>
            </h1>
            <p>
              به مرجع تخصصی تأمین قطعات صنعتی خوش آمدید. مجموعه کامل ۱۴ گروه اصلی شامل تسمه‌های انتقال نیرو و تایمینگ، پولی و چرخ‌دنده، بلبرینگ و رولبرینگ، زنجیرهای صنعتی، تجهیزات اتوماسیون، خطوط تولید کاشی و سرامیک و قطعات سفارشی را با کدهای کاتالوگ و مشخصات دقیق بررسی کنید.
            </p>
            <div className="all-categories-hero-actions">
              <a href="#all-categories-results" className="all-categories-primary-action">
                مشاهده و انتخاب دسته‌بندی‌ها <ChevronDown size={16} />
              </a>
              <Link to="/products" className="all-categories-secondary-action">
                شناسایی و جستجوی کد فنی <ArrowUpLeft size={16} />
              </Link>
              <button
                type="button"
                onClick={() =>
                  navigate('/ai-consult?source=catalog')
                }
                className="all-categories-secondary-action cursor-pointer"
              >
                مشاوره فنی FORZA <Sparkles size={15} />
              </button>
              <Link to="/products" className="all-categories-secondary-action">
                تمام محصولات <Package size={15} />
              </Link>
            </div>

            <form className="all-categories-search" role="search" onSubmit={(e) => e.preventDefault()}>
              <Search aria-hidden="true" size={19} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="جستجو در دسته‌بندی و زیرگروه‌ها"
                placeholder="نام قطعه، دسته یا زیرگروه را جستجو کنید (مثلاً تسمه تایمینگ، رولیک، بلبرینگ)…"
                autoComplete="off"
              />
              {(searchQuery || selectedGroupFilter !== 'all') && (
                <button type="button" onClick={clearSearch} aria-label="پاک کردن جستجو">
                  <X size={16} />
                </button>
              )}
              <kbd>جستجو</kbd>
            </form>

            <div className="all-categories-source-status" aria-live="polite">
              <span
                className={
                  source === 'database'
                    ? 'is-live'
                    : source === 'error'
                      ? 'is-error'
                      : 'is-loading'
                }
              />
              {source === 'database'
                ? 'ساختار دسته‌بندی از پایگاه داده دریافت شد'
                : source === 'error'
                  ? 'دریافت ساختار دسته‌بندی ناموفق بود'
                  : 'در حال دریافت ساختار دسته‌بندی…'}
            </div>
          </div>

          <div className="all-categories-hero-visual" role="img" aria-label="محیط صنعتی و تجهیزات خطوط تولید">
            <img
              src={STORE_ASSETS.industries.manufacturing}
              alt="محیط صنعتی و تجهیزات خطوط تولید"
              loading="eager"
              decoding="async"
            />
            <div className="all-categories-hero-visual-shade" />
            <div className="all-categories-hero-stamp">
              <span>مسیر انتخاب مهندسی</span>
              <strong>
                گروه صنعتی <i>›</i> دسته تخصصی <i>›</i> زیرگروه <i>›</i> کد فنی
              </strong>
            </div>
            <div className="all-categories-hero-note">
              <CheckCircle2 size={15} />
              <span>دسترسی مستقیم به کاتالوگ قطعات</span>
            </div>
          </div>

          <div className="all-categories-hero-stats" aria-label="آمار ساختار دسته‌بندی">
            <div>
              <span className="all-categories-stat-value">
                {source === 'database' ? toPersianDigits(catalogueGroups.length) : '—'}
              </span>
              <span className="all-categories-stat-label">گروه اصلی صنعتی</span>
            </div>
            <div>
              <span className="all-categories-stat-value">
                {source === 'database' ? toPersianDigits(liveCategoryCount) : '—'}
              </span>
              <span className="all-categories-stat-label">دسته تخصصی فعال</span>
            </div>
            <div className="all-categories-stat-cta">
              <span>
                پوشش کامل زیرشاخه‌ها ({source === 'database' ? toPersianDigits(totalSubcategoriesCount) : '—'} زیرگروه)
              </span>
              <strong>برای انتخاب دسته به پایین صفحه بروید</strong>
            </div>
          </div>
        </section>

        {/* Horizontal 14-Group Nav Bar + View Mode Switcher (Screenshot 2) */}
        {catalogueGroups.length > 0 && (
          <nav className="all-categories-group-nav" aria-label="پرش و فیلتر گروه‌های دسته‌بندی">
            <div className="all-categories-group-nav-head">
              <span>انتخاب یا پرش به گروه صنعتی:</span>
              <div className="all-categories-view-switch" role="group" aria-label="حالت نمایش دسته‌بندی‌ها">
                <button
                  type="button"
                  aria-pressed={viewLayout === 'cards'}
                  onClick={() => setViewLayout('cards')}
                  className="cursor-pointer"
                >
                  نمای کارت‌های تصویری
                </button>
                <button
                  type="button"
                  aria-pressed={viewLayout === 'matrix'}
                  onClick={() => setViewLayout('matrix')}
                  className="cursor-pointer"
                >
                  نمای ماتریس فنی
                </button>
              </div>
            </div>

            <div className="all-categories-group-pills">
              <button
                type="button"
                className={`all-categories-group-filter-btn cursor-pointer ${
                  selectedGroupFilter === 'all' ? 'is-active' : ''
                }`}
                onClick={() => setGroupFilter('all')}
              >
                همه گروه‌ها ({toPersianDigits(catalogueGroups.length)})
              </button>
              {catalogueGroups.map((section, index) => (
                <a
                  key={section.id}
                  href={`#menu-group-${section.id}`}
                  className={selectedGroupFilter === section.id ? 'is-active' : ''}
                  onClick={(event) => {
                    if (selectedGroupFilter !== 'all' && selectedGroupFilter !== section.id) {
                      event.preventDefault();
                      setGroupFilter(section.id);
                    }
                  }}
                >
                  <span>{toPersianDigits(index + 1)}</span>
                  {section.title}
                </a>
              ))}
            </div>
          </nav>
        )}

        {/* Categories Directory Section (Screenshot 2) */}
        <section className="all-categories-results" id="all-categories-results" aria-label="گروه‌های دسته‌بندی">
          <div className="all-categories-results-heading">
            <div>
              <span>فهرست راهنمای محصولات</span>
              <h2>{query ? 'نتایج جستجو در دسته‌بندی‌ها' : 'دسته‌بندی تخصصی قطعات و تجهیزات صنعتی'}</h2>
            </div>
            <div className="all-categories-results-count" aria-live="polite">
              {selectedGroupFilter !== 'all' && (
                <button
                  type="button"
                  className="all-categories-reset-group cursor-pointer"
                  onClick={() => setGroupFilter('all')}
                >
                  نمایش همه گروه‌ها
                </button>
              )}
              <strong>{source === 'database' ? toPersianDigits(visibleCategoryCount) : '—'}</strong>
              <span>دسته در این نما</span>
            </div>
          </div>

          {source === 'loading' ? (
            <div className="all-categories-state" role="status">
              <span className="all-categories-state-spinner" aria-hidden="true" />
              <h3>در حال دریافت ساختار دسته‌بندی‌ها از پایگاه داده</h3>
              <p>مسیر گروه‌های صنعتی، دسته‌ها و زیرگروه‌های مصوب در حال بارگذاری است.</p>
            </div>
          ) : source === 'error' ? (
            <div className="all-categories-state all-categories-state-error" role="alert">
              <span>
                <RefreshCw size={20} />
              </span>
              <h3>دریافت دسته‌بندی‌ها از سرور با مشکل مواجه شد</h3>
              <p>برای اطمینان از همگام بودن با پایگاه داده، دوباره تلاش کنید.</p>
              <button
                type="button"
                onClick={() => {
                  setSource('loading');
                  setRetryCount((c) => c + 1);
                }}
                className="cursor-pointer"
              >
                تلاش مجدد
              </button>
            </div>
          ) : categorySections.length === 0 ? (
            <div className="all-categories-state">
              <span>
                <Search size={20} />
              </span>
              <h3>دسته‌ای مطابق «{searchQuery}» پیدا نشد</h3>
              <p>عبارت ساده‌تری مانند تسمه، رولیک، پولی، بلبرینگ یا نسوز را وارد کنید.</p>
              <button type="button" onClick={clearSearch} className="cursor-pointer">
                نمایش همه دسته‌بندی‌ها
              </button>
            </div>
          ) : (
            <div className={`all-categories-groups ${viewLayout === 'matrix' ? 'is-matrix-view' : ''}`}>
              {categorySections.map((section, groupIndex) => {
                const groupMeta = GROUP_META[section.id];
                const groupImage =
                  section.imageUrl || groupMeta?.image || EXCEL_GROUP_ARTWORK[section.id];
                return (
                  <section
                    className="all-categories-group"
                    id={`menu-group-${section.id}`}
                    key={section.id}
                  >
                    <header className="all-categories-group-heading">
                      <span className="all-categories-group-index">{toPersianDigits(groupIndex + 1)}</span>
                      {groupImage ? (
                        <div className="all-categories-group-thumb">
                          <img src={groupImage} alt="" loading="lazy" decoding="async" />
                        </div>
                      ) : (
                        <span className="all-categories-group-icon">
                          <Layers size={19} />
                        </span>
                      )}
                      <div className="all-categories-group-title">
                        <span>گروه صنعتی {toPersianDigits(groupIndex + 1)}</span>
                        <h3>{section.title}</h3>
                        {groupMeta?.subtitle && <p>{groupMeta.subtitle}</p>}
                      </div>
                      <div className="all-categories-group-metrics">
                        <div className="all-categories-group-count">
                          <strong>{toPersianDigits(section.categories.length)}</strong>
                          <span>دسته</span>
                        </div>
                        {section.totalFamilies > 0 && (
                          <div className="all-categories-group-count is-secondary">
                            <strong>{toPersianDigits(section.totalFamilies)}</strong>
                            <span>خانواده</span>
                          </div>
                        )}
                        <button
                          type="button"
                          className="all-categories-group-focus-btn cursor-pointer"
                          onClick={() =>
                            setGroupFilter(selectedGroupFilter === section.id ? 'all' : section.id)
                          }
                        >
                          {selectedGroupFilter === section.id ? 'همه گروه‌ها' : 'فقط این گروه'}
                        </button>
                      </div>
                    </header>

                    <div className="all-categories-card-grid">
                      {section.categories.map((category, categoryIndex) => {
                        const CategoryIcon = ICON_MAP[category.icon] || Package;
                        const artwork = categoryArtwork(category);
                        const childNodes = (category.children || []).filter(
                          (node) => node.hidden !== true,
                        );
                        const familyCount = Number(category.familyCount ?? category.count ?? 0);
                        const skuCount = Number(category.skuCount ?? 0);
                        const route = categoryHref(category.slug);

                        return (
                          <article className="all-categories-card" key={category.id || category.slug}>
                            <Link
                              to={route}
                              className={`all-categories-card-art ${artwork ? 'has-image' : 'has-placeholder'}`}
                              tabIndex={-1}
                              aria-hidden="true"
                            >
                              {artwork ? (
                                <img src={artwork} alt={category.name} loading="lazy" decoding="async" />
                              ) : (
                                <div className="all-categories-art-placeholder">
                                  <span className="all-categories-art-ring all-categories-art-ring-one" />
                                  <span className="all-categories-art-ring all-categories-art-ring-two" />
                                  <CategoryIcon size={34} />
                                </div>
                              )}
                              <span className="all-categories-card-number">
                                {toPersianDigits(categoryIndex + 1)}
                              </span>
                              <span className="all-categories-card-orange-badge">
                                {category.name.split(' ')[0]}
                              </span>
                              <span className="all-categories-card-count-badge">
                                {toPersianDigits(skuCount)} کالا
                              </span>
                              <span className="all-categories-card-group">{section.title}</span>
                            </Link>

                            <div className="all-categories-card-content">
                              {childNodes.length > 0 && (
                                <div className="all-categories-card-tags">
                                  {childNodes.slice(0, 3).map((node) => (
                                    <span key={node.name} className="all-categories-card-tag">
                                      {node.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="all-categories-card-title-row">
                                <span className="all-categories-card-icon">
                                  <CategoryIcon size={17} />
                                </span>
                                <div>
                                  <h4>
                                    <Link to={route}>{category.name}</Link>
                                  </h4>
                                  {category.nameEn && <span dir="ltr">{category.nameEn}</span>}
                                </div>
                              </div>

                              <p>{categoryDescription(category)}</p>

                              <div className="all-categories-card-meta">
                                <span>
                                  <strong>{toPersianDigits(familyCount)}</strong>
                                  خانواده
                                </span>
                                <span>
                                  <strong>{toPersianDigits(skuCount)}</strong>
                                  کد کالا
                                </span>
                                {childNodes.length > 0 && (
                                  <span>
                                    <strong>{toPersianDigits(childNodes.length)}</strong>
                                    زیرگروه
                                  </span>
                                )}
                              </div>

                              {childNodes.length > 0 && (
                                <div
                                  className="all-categories-subcategory-links"
                                  aria-label={`زیرگروه‌های ${category.name}`}
                                >
                                  {childNodes.slice(0, 4).map((node) => (
                                    <Link
                                      key={node.name}
                                      to={categoryHref(category.slug, node.value || node.name)}
                                    >
                                      {node.name}
                                    </Link>
                                  ))}
                                  {childNodes.length > 4 && (
                                    <span>+{toPersianDigits(childNodes.length - 4)} زیرگروه دیگر</span>
                                  )}
                                </div>
                              )}

                              <details className="all-categories-tree">
                                <summary>
                                  مشاهده ساختار کامل زیرگروه‌ها ({toPersianDigits(childNodes.length)})
                                  <ChevronDown size={15} />
                                </summary>
                                <CategoryNavigation
                                  nodes={category.children || []}
                                  categorySlug={category.slug}
                                />
                              </details>

                              <Link to={route} className="all-categories-card-action">
                                ورود به کاتالوگ این دسته <ArrowLeft size={16} />
                              </Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <section className="all-categories-bottom-cta">
          <div>
            <span>کد یا مشخصات دقیق قطعه را در اختیار ندارید؟</span>
            <h2>از جستجوی کاتالوگ تا مشاوره تخصصی FORZA، مسیر انتخاب قطعه را ادامه دهید.</h2>
          </div>
          <div>
            <Link to="/products">
              <Search size={16} /> جستجوی کد فنی
            </Link>
            <button
              type="button"
              onClick={() =>
                navigate('/ai-consult?source=catalog')
              }
              className="cursor-pointer"
            >
              <Sparkles size={16} /> مشاوره FORZA
            </button>
            <Link to="/products">
              <Package size={16} /> تمام محصولات
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AllCategoriesPage;
