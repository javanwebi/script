import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpLeft,
  Award,
  Boxes,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  Cpu,
  Flame,
  Grid,
  Headphones,
  Layers,
  Link as LinkIcon,
  Package,
  Search,
  Scissors,
  Shield,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
  Zap,
  X,
} from 'lucide-react';
import { flattenCategoryNodes, resolveCategorySlug } from '../data/categories';
import type { EnhancedCategory } from '../data/categories';
import { CategoryNavigation } from '../components/catalog/CategoryNavigation';
import { STORE_ASSETS } from '../assets/images';
import { toPersianDigits } from '../utils/formatters';
import './all-categories-premium.css';

type MenuGroup = {
  id: string;
  title: string;
  iconKey?: string;
  sortOrder?: number;
  active?: boolean;
  categorySlugs: string[];
  familyCount?: number;
  skuCount?: number;
};

type CatalogueSource = 'loading' | 'database' | 'error';

const ICON_MAP: Record<string, React.ElementType> = {
  Cpu,
  Layers,
  Grid,
  CircleDot,
  Shield,
  Link: LinkIcon,
  Scissors,
  ShieldCheck,
  Package,
  Flame,
  Award: ShieldCheck,
  Wrench,
  Zap,
};

const GROUP_ICONS: Record<string, React.ElementType> = {
  'excel-v2-1': Layers,
  'excel-v2-2': Package,
  'excel-v2-3': CircleDot,
  'excel-v2-4': Cpu,
  'excel-v2-5': ShieldCheck,
  'excel-v2-6': Grid,
  'excel-v2-7': Shield,
  'excel-v2-8': Flame,
  'excel-v2-9': LinkIcon,
  'excel-v2-10': Sparkles,
  'excel-v2-11': Grid,
  'excel-v2-12': Cpu,
  'excel-v2-13': CircleDot,
  'excel-v2-14': Boxes,
};

const normalizeSearch = (value: string) => value
  .toLocaleLowerCase('fa-IR')
  .replace(/ي/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[\u200c\s]+/g, ' ')
  .trim();

const categoryArtwork = (category: EnhancedCategory): string | undefined => {
  if (category.image) return category.image;
  const name = normalizeSearch(category.name);
  const slug = category.slug || '';

  // Ultra-clear high-res registered industrial assets for each equipment type
  if (/تسمه|belt/.test(name) || slug.includes('belt')) return STORE_ASSETS.categories.belts;
  if (/پولی|pulley/.test(name) || slug.includes('pulley')) return STORE_ASSETS.categories.pulleys;
  if (/بلبرینگ|یاتاقان|رولبرینگ|bearing/.test(name) || slug.includes('bearing')) return STORE_ASSETS.categories.bearings;
  if (/زنجیر|چرخ زنجیر|chain/.test(name) || slug.includes('chain')) return STORE_ASSETS.categories.chains;
  if (/نوار نقاله|نقاله|انتقال مواد|کانوایر|conveyor/.test(name)) return STORE_ASSETS.categories.conveyor;
  if (/موتور|الکتروموتور|درایو|اینورتر|motor/.test(name)) return STORE_ASSETS.products.motor;
  if (/هیدرولیک|پنوماتیک|شیر|valve|hydraulic/.test(name)) return STORE_ASSETS.products.valve;
  if (/پروفیل|سازه|اتصالات|پیچ|مهره|fittings/.test(name)) return STORE_ASSETS.forzaSubFittings;
  if (/ابزار|براده|تراشکاری|فرز|مته|tools/.test(name)) return STORE_ASSETS.whySanatCadEngineering;
  if (/برق|الکترونیک|تابلو|سنسور|کنترل|sensor/.test(name)) return STORE_ASSETS.predictiveMaintenanceSensor;
  if (/روانکار|گریس|چسب|درزگیر|اورینگ|کاسه نمد/.test(name)) return STORE_ASSETS.products.ceramicParts;
  if (/رولر|غلتک/.test(name)) return STORE_ASSETS.products.ceramicRoller;
  if (/پمپ/.test(name)) return STORE_ASSETS.products.pump;
  if (/نسوز|حرارتی|لعاب|چاپ|کاشی|سرامیک/.test(name)) return STORE_ASSETS.categories.ceramic;
  if (/نساجی|بافندگی/.test(name)) return STORE_ASSETS.categories.textile;
  if (/فلنج|لوله|اتصال صنعتی/.test(name)) return STORE_ASSETS.products.flange;
  if (/گیربکس|مکعبی|چرخ دنده/.test(name)) return STORE_ASSETS.whySanatDirectFactory;
  if (/توری مش/.test(name)) return STORE_ASSETS.industries.manufacturing;
  if (/سفارشی|نقشه فنی|مهندسی معکوس/.test(name)) return STORE_ASSETS.reverseEngineeringLab;

  return STORE_ASSETS.categories.transmission;
};

const categoryDescription = (category: EnhancedCategory) => {
  if (category.description?.trim()) return category.description.trim();
  const childNames = (category.children || []).filter(node => node.hidden !== true).map(node => node.name);
  return childNames.length
    ? childNames.slice(0, 3).join('، ')
    : 'بررسی مشخصات فنی، استانداردها و زیرگروه‌های تخصصی در کاتالوگ صنعت پیش.';
};

const categoryHref = (slug: string, subcategory?: string) => {
  const path = '/category/' + encodeURIComponent(resolveCategorySlug(slug));
  if (!subcategory) return path;
  return path + '?' + new URLSearchParams({ sub: subcategory }).toString();
};

export const AllCategoriesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const [catalogueCategories, setCatalogueCategories] = useState<EnhancedCategory[]>([]);
  const [catalogueGroups, setCatalogueGroups] = useState<MenuGroup[]>([]);
  const [source, setSource] = useState<CatalogueSource>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>('all');
  const activeCatalogueCategories = catalogueCategories;

  const location = useLocation();
  const currentHash = location.hash || '#menu-group-excel-v2-1';

  useEffect(() => {
    const target = location.hash.slice(1);
    if (source !== 'database' || !/^menu-group-excel-v2-[0-9]+$/.test(target)) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [source, catalogueGroups, location.hash]);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const loadExcelHierarchy = async () => {
      try {
        const [categoriesResponse, groupsResponse] = await Promise.all([
          fetch('/api/catalog/categories', {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch('/api/catalog/navigation-groups', {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }),
        ]);
        if (!categoriesResponse.ok || !groupsResponse.ok) throw new Error('Catalogue navigation request failed');

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

        const indexed = new Map<string, EnhancedCategory>(
          (categoriesData.categories as EnhancedCategory[])
            .filter(category => category && typeof category.slug === 'string' && category.active !== false)
            .map(category => [category.slug, category]),
        );
        const groups = (groupsData.groups as MenuGroup[])
          .filter(group =>
            /^excel-v2-[0-9]+$/.test(group.id) &&
            group.active !== false &&
            Array.isArray(group.categorySlugs),
          )
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        const seen = new Set<string>();
        const ordered = groups
          .flatMap(group => group.categorySlugs.map(slug => indexed.get(slug)))
          .filter((category): category is EnhancedCategory => {
            if (!category || seen.has(category.slug)) return false;
            seen.add(category.slug);
            return true;
          });

        if (!groups.length || !ordered.length) throw new Error('No approved catalogue categories were returned');
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
    const trimmed = value.trim();
    if (trimmed) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const query = normalizeSearch(searchQuery);

  const categorySections = useMemo(() => catalogueGroups
    .map(group => {
      if (activeGroupFilter !== 'all' && group.id !== activeGroupFilter) {
        return { ...group, categories: [] };
      }
      const groupMatches = query.length > 0 && normalizeSearch(group.title).includes(query);
      const categories = activeCatalogueCategories.filter(category => {
        if (!group.categorySlugs.includes(category.slug)) return false;
        if (!query || groupMatches) return true;
        const searchable = normalizeSearch([
          category.name,
          category.nameEn || '',
          category.description || '',
          ...flattenCategoryNodes(category.children || []).map(node => node.name),
        ].join(' '));
        return searchable.includes(query);
      });
      return { ...group, categories };
    })
    .filter(group => group.categories.length > 0), [activeCatalogueCategories, catalogueGroups, query, activeGroupFilter]);

  const visibleCategoryCount = categorySections.reduce((total, section) => total + section.categories.length, 0);
  const liveCategoryCount = activeCatalogueCategories.length;
  const totalFamiliesCount = useMemo(
    () => activeCatalogueCategories.reduce((sum, cat) => sum + Number(cat.familyCount ?? cat.count ?? 0), 0),
    [activeCatalogueCategories],
  );
  const totalSkusCount = useMemo(
    () => activeCatalogueCategories.reduce((sum, cat) => sum + Number(cat.skuCount ?? 0), 0),
    [activeCatalogueCategories],
  );

  const clearSearch = () => setSearchQuery('');

  const brandLogos = ['Continental', 'SEW', 'ABB', 'SIEMENS', 'Optibelt', 'Gates', 'FAG', 'SKF'];

  const quickSearchQueries = [
    { label: 'یاتاقان UCP 206', query: 'UCP 206' },
    { label: 'تسمه 6PK 1200', query: '6PK 1200' },
    { label: 'تسمه HTD 5M', query: 'HTD 5M' },
    { label: 'تسمه SPA 1350', query: 'SPA 1350' },
    { label: 'بلبرینگ 6202 2Z', query: '6202 2Z' },
  ];

  const industriesList = [
    { name: 'کاشی و سرامیک', image: STORE_ASSETS.industries.ceramic, link: '/industry/ceramic' },
    { name: 'نساجی و پارچه', image: STORE_ASSETS.industries.textile, link: '/industry/textile' },
    { name: 'بسته‌بندی و کارتن', image: STORE_ASSETS.industries.manufacturing, link: '/products?industry=packaging' },
    { name: 'غذا و نوشیدنی', image: STORE_ASSETS.industries.food || STORE_ASSETS.industries.foodBottles, link: '/products?industry=food' },
    { name: 'ماشین‌آلات و تجهیزات', image: STORE_ASSETS.industries.robotArm, link: '/products?industry=machinery' },
    { name: 'لاستیک و پلاستیک', image: STORE_ASSETS.industries.bgPlant || STORE_ASSETS.products.ceramicRoller, link: '/products?industry=rubber-plastic' },
  ];

  return (
    <div className="all-categories-page" dir="rtl">
      <div className="all-categories-shell">
        {/* Breadcrumb Navigation */}
        <nav className="all-categories-breadcrumbs" aria-label="مسیر صفحه">
          <Link to="/">صفحه اصلی</Link>
          <ChevronLeft aria-hidden="true" />
          <span aria-current="page">دسته‌بندی قطعات صنعتی</span>
        </nav>

        {/* Hero Section styled identically to Home Page hero theme with warm orange accents */}
        <section className="all-categories-hero" aria-labelledby="all-categories-title">
          <div className="all-categories-hero-copy">
            <div className="all-categories-eyebrow">
              <span className="all-categories-eyebrow-mark">
                <Package size={14} />
              </span>
              <span>کاتالوگ جامع قطعات صنعتی</span>
            </div>

            <h1 id="all-categories-title">
              قطعه موردنیاز صنعتت را <em>دقیق</em> پیدا کن
            </h1>

            <p>
              دسترسی به هزاران قطعه صنعتی از معتبرترین برندهای جهانی، با مشخصات فنی کامل، موجودی به‌روز و مشاوره تخصصی.
            </p>

            {/* Unified Search & Part Identification Bar matching reference mockup */}
            <div className="all-categories-search-combo">
              <form
                className="all-categories-search"
                role="search"
                onSubmit={event => event.preventDefault()}
              >
                <Search aria-hidden="true" size={19} className="all-categories-search-icon" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  aria-label="جستجو در دسته‌بندی و زیرگروه‌ها"
                  placeholder="کد فنی، نام قطعه یا مشخصات را وارد کنید..."
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="پاک کردن جستجو"
                    className="all-categories-search-clear"
                  >
                    <X size={16} />
                  </button>
                )}
                <kbd>جستجو</kbd>
              </form>

              <Link to="/identify-part" className="all-categories-search-camera-btn">
                <Camera size={18} />
                <span>شناسایی قطعه با تصویر</span>
              </Link>
            </div>

            {/* Quick popular search chips */}
            <div className="all-categories-quick-chips">
              <span className="all-categories-chips-label">
                <Zap size={14} />
                جستجوی سریع و پرکاربرد:
              </span>
              <div className="all-categories-chips-list">
                {quickSearchQueries.map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setSearchQuery(item.query)}
                    className="all-categories-chip-btn"
                  >
                    {item.label}
                  </button>
                ))}
                <Link to="/products" className="all-categories-chip-more">
                  کدها و استانداردهای بیشتر ←
                </Link>
              </div>
            </div>

            {/* Hero CTAs */}
            <div className="all-categories-hero-actions">
              <Link to="/products" className="all-categories-primary-action">
                مشاهده همه محصولات کاتالوگ <ArrowLeft size={16} />
              </Link>
              <Link to="/identify-part" className="all-categories-secondary-action">
                <Sparkles size={16} />
                شناسایی با هوش مصنوعی <ArrowUpLeft size={15} />
              </Link>
            </div>

            {/* Real-time database connection status */}
            <div className="all-categories-source-status" aria-live="polite">
              <span className={source === 'database' ? 'is-live' : source === 'error' ? 'is-error' : 'is-loading'} />
              {source === 'database'
                ? `ساختار دسته‌بندی از پایگاه داده دریافت شد (${toPersianDigits(totalFamiliesCount)} خانواده · ${toPersianDigits(totalSkusCount)} کد فنی)`
                : source === 'error'
                  ? 'دریافت ساختار دسته‌بندی ناموفق بود'
                  : 'در حال دریافت ساختار دسته‌بندی…'}
            </div>
          </div>

          {/* Left Hero Visual */}
          <div className="all-categories-hero-visual" role="img" aria-label="محیط صنعتی و تجهیزات خطوط تولید">
            <img
              src={STORE_ASSETS.categoriesSleekWhiteHero}
              alt="تجهیزات صنعتی و انتقال قدرت خطوط تولید"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
            <div className="all-categories-hero-visual-shade" />
            <div className="all-categories-hero-stamp">
              <span>مرجع قطعات</span>
              <strong>صنعت پیش <i>›</i> کاتالوگ جامع</strong>
            </div>
            <div className="all-categories-hero-note">
              <CheckCircle2 size={16} />
              <span>موجودی واقعی و تضمین اصالت کالا</span>
            </div>
          </div>

          {/* Hero Bottom Stats */}
          <div className="all-categories-hero-stats" aria-label="آمار ساختار دسته‌بندی">
            <div>
              <span className="all-categories-stat-value">
                {source === 'database' ? toPersianDigits(catalogueGroups.length) : '—'}
              </span>
              <span className="all-categories-stat-label">گروه اصلی</span>
            </div>
            <div>
              <span className="all-categories-stat-value">
                {source === 'database' ? toPersianDigits(liveCategoryCount) : '—'}
              </span>
              <span className="all-categories-stat-label">دسته تخصصی</span>
            </div>
            <div className="all-categories-stat-cta">
              <span>پوشش کامل خانواده‌ها و کدهای فنی</span>
              <strong>{toPersianDigits(totalFamiliesCount)} خانواده محصول · {toPersianDigits(totalSkusCount)} کد و سایز استاندارد</strong>
            </div>
          </div>
        </section>

        {/* Quick Group Navigation Tabs Bar */}
        {categorySections.length > 0 && (
          <nav className="all-categories-group-nav" aria-label="پرش به گروه‌های دسته‌بندی">
            <span>فیلتر سریع گروه:</span>
            <div className="all-categories-group-nav-items">
              <button
                type="button"
                onClick={() => setActiveGroupFilter('all')}
                className={activeGroupFilter === 'all' ? 'is-active-group-link' : ''}
              >
                همه دسته‌ها
              </button>
              {catalogueGroups.map((section, index) => {
                const targetId = `#menu-group-${section.id}`;
                const isActive = activeGroupFilter === section.id || (activeGroupFilter === 'all' && currentHash === targetId);
                return (
                  <a
                    key={section.id}
                    href={targetId}
                    onClick={() => setActiveGroupFilter(section.id)}
                    className={isActive ? 'is-active-group-link' : ''}
                  >
                    <span>{toPersianDigits(index + 1)}</span>
                    {section.title}
                  </a>
                );
              })}
            </div>
          </nav>
        )}

        {/* Main Results / Category Cards Section */}
        <section className="all-categories-results" aria-label="گروه‌های دسته‌بندی">
          <div className="all-categories-results-heading">
            <div>
              <span className="all-categories-results-badge">فهرست راهنمای تخصصی</span>
              <h2>{query ? 'نتایج جستجو در دسته‌بندی‌ها' : 'گروه‌های تخصصی قطعات صنعتی'}</h2>
            </div>
            <div className="all-categories-results-count" aria-live="polite">
              <strong>{source === 'database' ? toPersianDigits(visibleCategoryCount) : '—'}</strong>
              <span>دسته در این نما</span>
            </div>
          </div>

          {source === 'loading' ? (
            <div className="all-categories-state" role="status" aria-live="polite">
              <span className="all-categories-state-spinner" aria-hidden="true" />
              <h3>در حال دریافت دسته‌بندی‌های صنعت پیش</h3>
              <p>ساختار گروه‌ها و زیرگروه‌ها از پایگاه داده خوانده می‌شود.</p>
            </div>
          ) : source === 'error' ? (
            <div className="all-categories-state all-categories-state-error" role="alert">
              <span><Boxes size={28} /></span>
              <h3>اتصال به ساختار دسته‌بندی برقرار نشد</h3>
              <p>برای جلوگیری از نمایش آمار یا دسته‌بندی قدیمی، اطلاعات ذخیره‌شده محلی جایگزین داده پایگاه داده نشده است.</p>
              <button
                type="button"
                onClick={() => {
                  setSource('loading');
                  setRetryCount(value => value + 1);
                }}
              >
                تلاش مجدد
              </button>
            </div>
          ) : categorySections.length === 0 ? (
            <div className="all-categories-empty">
              <span><Search size={28} /></span>
              <h3>دسته‌ای با این عبارت پیدا نشد</h3>
              <p>نام قطعه یا بخشی از عنوان زیرگروه را کوتاه‌تر وارد کنید.</p>
              <button
                type="button"
                onClick={() => {
                  clearSearch();
                  setActiveGroupFilter('all');
                }}
              >
                نمایش همه دسته‌ها
              </button>
            </div>
          ) : (
            <div className="all-categories-groups">
              {categorySections.map((section, sectionIndex) => {
                const GroupIcon = GROUP_ICONS[section.id] || Layers;
                const groupFamilyTotal = section.categories.reduce(
                  (sum, cat) => sum + Number(cat.familyCount ?? cat.count ?? 0),
                  0,
                );
                const groupSkuTotal = section.categories.reduce(
                  (sum, cat) => sum + Number(cat.skuCount ?? 0),
                  0,
                );
                const isTargetGroup = currentHash === `#menu-group-${section.id}` || (section.id === 'excel-v2-1' && (currentHash === '' || currentHash === '#menu-group-excel-v2-1'));

                return (
                  <section
                    className={`all-categories-group ${isTargetGroup ? 'is-target-group' : ''}`}
                    id={`menu-group-${section.id}`}
                    key={section.id}
                    aria-labelledby={`all-categories-group-${section.id}`}
                  >
                    <header className="all-categories-group-heading">
                      <div className="all-categories-group-index">{toPersianDigits(sectionIndex + 1)}</div>
                      <div className="all-categories-group-icon">
                        <GroupIcon size={22} />
                      </div>
                      <div className="all-categories-group-title">
                        <div className="all-categories-group-subline">
                          <span>گروه تخصصی · {toPersianDigits(groupFamilyTotal)} خانواده · {toPersianDigits(groupSkuTotal)} کد فنی</span>
                          {isTargetGroup && (
                            <span className="all-categories-target-badge">
                              <Flame size={12} /> گروه منتخب کاتالوگ
                            </span>
                          )}
                        </div>
                        <h3 id={`all-categories-group-${section.id}`}>{section.title}</h3>
                      </div>
                      <div className="all-categories-group-count">
                        <strong>{toPersianDigits(section.categories.length)}</strong>
                        <span>دسته تخصصی</span>
                      </div>
                    </header>

                    {/* Spotlight for key belt transmission group */}
                    {section.id === 'excel-v2-1' && isTargetGroup && (
                      <div className="all-categories-group-spotlight-banner">
                        <div className="all-categories-spotlight-copy">
                          <span className="all-categories-spotlight-tag">
                            <Flame size={13} /> پوشش کامل انتقال نیرو
                          </span>
                          <h4>مرجع تخصصی انواع تسمه‌های صنعتی، تایمینگ و انتقال قدرت</h4>
                          <p>
                            شامل ۲٬۶۳۸ کد فنی تسمه تایمینگ، ۴٬۶۹۹ کد وی‌بلت (V-Belt)، ۹۶ کد تسمه بارکش و ۲۳ کد تسمه جوشی با تاییدیه مهندسی صنعت پیش.
                          </p>
                          <div className="all-categories-spotlight-actions">
                            <Link to="/category/excel-v2-1-1" className="all-categories-spotlight-primary">
                              مشاهده کاتالوگ جامع تسمه تایمینگ <ArrowLeft size={14} />
                            </Link>
                            <Link to="/products?group=excel-v2-1" className="all-categories-spotlight-secondary">
                              فیلتر همه تسمه‌ها در کاتالوگ
                            </Link>
                          </div>
                        </div>
                        <div className="all-categories-spotlight-media" aria-hidden="true">
                          <img src={STORE_ASSETS.forzaSubBelt} alt="تسمه تایمینگ صنعتی" loading="eager" />
                          <span className="all-categories-spotlight-overlay" />
                        </div>
                      </div>
                    )}

                    {/* Category Cards Grid with clear images and orange accent badges */}
                    <div className="all-categories-card-grid">
                      {section.categories.map((category, categoryIndex) => {
                        const CategoryIcon = ICON_MAP[category.icon] || Package;
                        const artwork = categoryArtwork(category);
                        const childNodes = (category.children || []).filter(node => node.hidden !== true);
                        const familyCount = source === 'database' ? Number(category.familyCount ?? category.count ?? 0) : null;
                        const skuCount = source === 'database' ? Number(category.skuCount ?? 0) : null;
                        const route = categoryHref(category.slug);

                        return (
                          <article className="all-categories-card" key={category.id || category.slug}>
                            {/* Card Header with Number and Category Info */}
                            <div className="all-categories-card-top-bar">
                              <span className="all-categories-card-number">
                                {toPersianDigits(categoryIndex + 1)}
                              </span>
                              <div className="all-categories-card-top-info">
                                <span className="all-categories-card-group-tag">{section.title}</span>
                                {skuCount !== null && skuCount > 0 && (
                                  <span className="all-categories-card-sku-badge">
                                    +{toPersianDigits(skuCount)} کالا
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Crystal-Clear Industrial Product Imagery */}
                            <Link to={route} className="all-categories-card-art-link" tabIndex={-1}>
                              <div className="all-categories-card-art has-image">
                                <img
                                  src={artwork || STORE_ASSETS.categories.transmission}
                                  alt={category.name}
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                            </Link>

                            <div className="all-categories-card-content">
                              <div className="all-categories-card-title-row">
                                <span className="all-categories-card-icon">
                                  <CategoryIcon size={18} />
                                </span>
                                <div>
                                  <h4>
                                    <Link to={route}>{category.name}</Link>
                                  </h4>
                                  {category.nameEn && <span dir="ltr">{category.nameEn}</span>}
                                </div>
                              </div>

                              <p>{categoryDescription(category)}</p>

                              {/* Technical Metadata */}
                              <div className="all-categories-card-meta">
                                {source === 'database' ? (
                                  <>
                                    <span>
                                      <strong>{toPersianDigits(familyCount ?? 0)}</strong>
                                      خانواده محصول
                                    </span>
                                    <span>
                                      <strong>{toPersianDigits(skuCount ?? 0)}</strong>
                                      کد و سایز
                                    </span>
                                  </>
                                ) : (
                                  <span className="all-categories-card-meta-muted">آمار پس از اتصال به کاتالوگ</span>
                                )}
                              </div>

                              {/* Clickable Subcategories Pills */}
                              {childNodes.length > 0 && (
                                <div className="all-categories-subcategory-links" aria-label={`زیرگروه‌های ${category.name}`}>
                                  {childNodes.slice(0, 3).map(node => (
                                    <Link
                                      key={node.name}
                                      to={categoryHref(category.slug, node.value || node.name)}
                                    >
                                      {node.name}
                                    </Link>
                                  ))}
                                  {childNodes.length > 3 && (
                                    <Link
                                      to={route}
                                      className="all-categories-subcategory-more"
                                      title="مشاهده همه زیرگروه‌ها"
                                    >
                                      +{toPersianDigits(childNodes.length - 3)} زیرگروه
                                    </Link>
                                  )}
                                </div>
                              )}

                              {/* Complete Taxonomy Tree Expander */}
                              <details className="all-categories-tree">
                                <summary>
                                  <span>مشاهده ساختار کامل زیرگروه‌ها</span>
                                  <ChevronDown size={15} />
                                </summary>
                                <CategoryNavigation nodes={category.children || []} categorySlug={category.slug} />
                              </details>

                              {/* Action Buttons */}
                              <div className="all-categories-card-footer-actions">
                                <Link to={route} className="all-categories-card-action">
                                  مشاهده کاتالوگ تخصصی <ArrowLeft size={16} />
                                </Link>
                                <Link
                                  to={route}
                                  className="all-categories-card-secondary-link"
                                >
                                  مشاهده کدهای فنی
                                </Link>
                              </div>
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

        {/* Industry Application Strip ("قطعات را بر اساس کاربرد پیدا کنید") matching reference image */}
        <section className="all-categories-industries-section" aria-labelledby="all-categories-industries-title">
          <div className="all-categories-industries-header">
            <span className="all-categories-slash">//</span>
            <h2 id="all-categories-industries-title">قطعات را بر اساس کاربرد و صنایع پیدا کنید</h2>
          </div>
          <div className="all-categories-industries-grid">
            {industriesList.map(ind => (
              <Link to={ind.link} key={ind.name} className="all-categories-industry-card">
                <div className="all-categories-industry-thumb">
                  <img src={ind.image} alt={ind.name} loading="lazy" decoding="async" />
                </div>
                <div className="all-categories-industry-label">
                  <span>{ind.name}</span>
                  <ChevronLeft size={15} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* FORZA AI Smart Identification Callout matching mockup */}
        <section className="all-categories-forza-banner">
          <div className="forza-banner-content">
            <div className="forza-brand-badge">
              <Sparkles size={16} />
              <span>FORZA AI</span>
            </div>
            <h2>قطعه را نمی‌شناسی؟ تصویرش را بفرست</h2>
            <p>
              با هوش مصنوعی، قطعه را شناسایی کن و مشابه‌های موجود در کاتالوگ صنعت پیش را با مشخصات فنی دقیق مشاهده کن.
            </p>
            <div className="forza-banner-actions">
              <Link to="/identify-part" className="forza-primary-btn">
                <Camera size={18} />
                شروع شناسایی تصویری
              </Link>
              <Link to="/ai-consult" className="forza-secondary-btn">
                مشاوره هوشمند FORZA
              </Link>
            </div>
          </div>
          <div className="forza-banner-scanner" aria-hidden="true">
            <div className="forza-scanner-bracket forza-bracket-tr" />
            <div className="forza-scanner-bracket forza-bracket-tl" />
            <div className="forza-scanner-bracket forza-bracket-br" />
            <div className="forza-scanner-bracket forza-bracket-bl" />
            <div className="forza-scanner-gear">
              <img src={STORE_ASSETS.products.aluPulley} alt="" />
            </div>
            <div className="forza-scanner-laser" />
          </div>
        </section>

        {/* Brands Strip */}
        <section className="all-categories-brands-strip">
          <span className="brands-title">برندهای برتر و معتبر کاتالوگ:</span>
          <div className="brands-logos-wrap">
            {brandLogos.map(brand => (
              <span key={brand} className="brand-logo-text">{brand}</span>
            ))}
          </div>
        </section>

        {/* Bottom Feature Value Proposition Strip */}
        <section className="all-categories-bottom-features">
          <div className="feature-item">
            <div className="feature-icon-wrap"><Award size={22} /></div>
            <div className="feature-text">
              <strong>محصولات اصلی و معتبر</strong>
              <span>با ضمانت اصالت کالا</span>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrap"><Truck size={22} /></div>
            <div className="feature-text">
              <strong>ارسال سریع و سراسری</strong>
              <span>به تمام نقاط کشور</span>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrap"><Headphones size={22} /></div>
            <div className="feature-text">
              <strong>پشتیبانی فنی و مهندسی</strong>
              <span>مشاوره، انتخاب و استعلام حرفه‌ای</span>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrap"><Shield size={22} /></div>
            <div className="feature-text">
              <strong>تأمین تخصصی قطعات</strong>
              <span>متناسب با صنایع و خطوط تولید</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AllCategoriesPage;
