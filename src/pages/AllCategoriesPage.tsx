import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpLeft,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  Cpu,
  Flame,
  Grid,
  Layers,
  Link as LinkIcon,
  Package,
  Search,
  Scissors,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { flattenCategoryNodes, resolveCategorySlug } from '../data/categories';
import type { EnhancedCategory } from '../data/categories';
import { CategoryNavigation } from '../components/catalog/CategoryNavigation';
import { STORE_ASSETS } from '../assets/images';
import { toPersianDigits } from '../utils/formatters';
import { resolveExcelCategoryArtwork } from '../utils/excelCategoryCatalog';
import './all-categories-premium.css';

type MenuGroup = {
  id: string;
  title: string;
  iconKey?: string;
  sortOrder?: number;
  active?: boolean;
  categorySlugs: string[];
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

const GROUP_VISUALS: Record<string, { image: string; subtitle: string }> = {
  'excel-v2-1': {
    image: STORE_ASSETS.subcategories.timingBeltHero,
    subtitle: 'تسمه‌های انتقال قدرت، تایمینگ، شیاری، پلی‌یورتان و تسمه‌های دور متغیر صنعتی',
  },
  'excel-v2-2': {
    image: STORE_ASSETS.categories.conveyor,
    subtitle: 'نوار نقاله‌های PVC، PU، لاستیکی، مدولار و توری‌های انتقال مواد در خطوط تولید',
  },
  'excel-v2-3': {
    image: STORE_ASSETS.subcategories.rollerConveyorHero,
    subtitle: 'رولیک‌های فلزی، پلیمری، ضربه‌گیر، غلتک‌های سرامیکی کوره و تجهیزات هدایت نوار',
  },
  'excel-v2-4': {
    image: STORE_ASSETS.categories.pulleys,
    subtitle: 'پولی‌های چدنی، آلومینیومی، تایمینگ، تیپربوش و چرخ‌دنده‌های استاندارد صنعتی',
  },
  'excel-v2-5': {
    image: STORE_ASSETS.subcategories.industrialBrushes,
    subtitle: 'برس‌های صنعتی غلطکی، نواری، دیسکی و برس‌های تخصصی شست‌وشو و پولیش خطوط تولید',
  },
  'excel-v2-6': {
    image: STORE_ASSETS.subcategories.guideRailsProfiles,
    subtitle: 'ریل‌ها، پروفیل‌های راهنما، گایدهای ضدسایش و قطعات پلی‌اتیلن هدایت خطوط انتقال',
  },
  'excel-v2-7': {
    image: STORE_ASSETS.subcategories.polymerSealsHero,
    subtitle: 'پکینگ‌ها، اورینگ‌ها، کاسه‌نمدها، قطعات پلیمری و آب‌بندهای تخصصی صنعتی',
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

const categoryArtwork = (category: EnhancedCategory): string | undefined =>
  resolveExcelCategoryArtwork(category.slug, category.name, category.image);

const categoryDescription = (category: EnhancedCategory) => {
  if (category.description?.trim()) return category.description.trim();
  const childNames = (category.children || []).filter(node => node.hidden !== true).map(node => node.name);
  return childNames.length
    ? childNames.slice(0, 4).join(' · ')
    : 'مسیرهای مرتبط و ساختار زیرگروه‌های این دسته را بررسی کنید.';
};

const categoryHref = (slug: string, subcategory?: string) => {
  const path = '/category/' + encodeURIComponent(resolveCategorySlug(slug));
  if (!subcategory) return path;
  return path + '?' + new URLSearchParams({ sub: subcategory }).toString();
};

export const AllCategoriesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const selectedGroupFilter = searchParams.get('group') || 'all';
  const [viewLayout, setViewLayout] = useState<'cards' | 'matrix'>('cards');
  const [catalogueCategories, setCatalogueCategories] = useState<EnhancedCategory[]>([]);
  const [catalogueGroups, setCatalogueGroups] = useState<MenuGroup[]>([]);
  const [source, setSource] = useState<CatalogueSource>('loading');
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

  const setGroupFilter = (groupId: string) => {
    const next = new URLSearchParams(searchParams);
    if (groupId && groupId !== 'all') next.set('group', groupId);
    else next.delete('group');
    setSearchParams(next, { replace: true });
  };

  const query = normalizeSearch(searchQuery);
  const categorySections = useMemo(() => catalogueGroups
    .filter(group => selectedGroupFilter === 'all' || group.id === selectedGroupFilter)
    .map(group => {
      const groupMatches = query.length > 0 && normalizeSearch(group.title).includes(query);
      const categories = catalogueCategories.filter(category => {
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
      const totalFamilies = categories.reduce((acc, cat) => acc + Number(cat.familyCount ?? cat.count ?? 0), 0);
      const totalSkus = categories.reduce((acc, cat) => acc + Number(cat.skuCount ?? 0), 0);
      return { ...group, categories, totalFamilies, totalSkus };
    })
    .filter(group => group.categories.length > 0), [catalogueCategories, catalogueGroups, query, selectedGroupFilter]);

  const visibleCategoryCount = categorySections.reduce((total, section) => total + section.categories.length, 0);
  const liveCategoryCount = catalogueCategories.length;
  const totalSubcategoriesCount = useMemo(
    () => catalogueCategories.reduce((sum, cat) => sum + flattenCategoryNodes(cat.children || []).length, 0),
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

        <section className="all-categories-hero" aria-labelledby="all-categories-title">
          <div className="all-categories-hero-copy">
            <span className="all-categories-eyebrow">
              <span className="all-categories-eyebrow-mark"><Layers size={14} /></span>
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
              <Link to="/identify-part" className="all-categories-secondary-action">
                شناسایی قطعه با تصویر <ArrowUpLeft size={16} />
              </Link>
              <Link to="/ai-consult" className="all-categories-secondary-action">
                مشاوره فنی FORZA <Sparkles size={15} />
              </Link>
              <Link to="/products" className="all-categories-secondary-action">
                تمام محصولات <Package size={15} />
              </Link>
            </div>
            <form className="all-categories-search" role="search" onSubmit={event => event.preventDefault()}>
              <Search aria-hidden="true" size={19} />
              <input
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
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
              <span className={source === 'database' ? 'is-live' : source === 'error' ? 'is-error' : 'is-loading'} />
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
              fetchPriority="high"
              decoding="async"
            />
            <div className="all-categories-hero-visual-shade" />
            <div className="all-categories-hero-stamp">
              <span>مسیر انتخاب مهندسی</span>
              <strong>گروه صنعتی <i>›</i> دسته تخصصی <i>›</i> زیرگروه <i>›</i> کد فنی</strong>
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
              <span>پوشش کامل زیرشاخه‌ها ({source === 'database' ? toPersianDigits(totalSubcategoriesCount) : '—'} زیرگروه)</span>
              <strong>برای انتخاب دسته به پایین صفحه بروید</strong>
            </div>
          </div>
        </section>

        {catalogueGroups.length > 0 && (
          <nav className="all-categories-group-nav" aria-label="پرش و فیلتر گروه‌های دسته‌بندی">
            <div className="all-categories-group-nav-head">
              <span>انتخاب یا پرش به گروه صنعتی:</span>
              <div className="all-categories-view-switch" role="group" aria-label="حالت نمایش دسته‌بندی‌ها">
                <button
                  type="button"
                  aria-pressed={viewLayout === 'cards'}
                  onClick={() => setViewLayout('cards')}
                >
                  نمای کارت‌های تصویری
                </button>
                <button
                  type="button"
                  aria-pressed={viewLayout === 'matrix'}
                  onClick={() => setViewLayout('matrix')}
                >
                  نمای ماتریس فنی
                </button>
              </div>
            </div>
            <div className="all-categories-group-pills">
              <button
                type="button"
                className={`all-categories-group-filter-btn ${selectedGroupFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setGroupFilter('all')}
              >
                همه گروه‌ها ({toPersianDigits(catalogueGroups.length)})
              </button>
              {catalogueGroups.map((section, index) => (
                <a
                  key={section.id}
                  href={`#menu-group-${section.id}`}
                  className={selectedGroupFilter === section.id ? 'is-active' : ''}
                  onClick={event => {
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

        <section className="all-categories-results" id="all-categories-results" aria-label="گروه‌های دسته‌بندی">
          <div className="all-categories-results-heading">
            <div>
              <span>فهرست راهنمای محصولات</span>
              <h2>{query ? 'نتایج جستجو در دسته‌بندی‌ها' : 'دسته‌بندی تخصصی قطعات و تجهیزات صنعتی'}</h2>
            </div>
            <div className="all-categories-results-count" aria-live="polite">
              {selectedGroupFilter !== 'all' && (
                <button type="button" className="all-categories-reset-group" onClick={() => setGroupFilter('all')}>
                  نمایش همه گروه‌ها
                </button>
              )}
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
              <span><Boxes size={24} /></span>
              <h3>اتصال به ساختار دسته‌بندی برقرار نشد</h3>
              <p>برای جلوگیری از نمایش آمار یا دسته‌بندی قدیمی، اطلاعات ذخیره‌شده محلی جایگزین داده پایگاه داده نشده است.</p>
              <button type="button" onClick={() => { setSource('loading'); setRetryCount(value => value + 1); }}>تلاش مجدد</button>
            </div>
          ) : categorySections.length === 0 ? (
            <div className="all-categories-empty">
              <span><Search size={25} /></span>
              <h3>دسته‌ای با این عبارت پیدا نشد</h3>
              <p>نام قطعه یا بخشی از عنوان زیرگروه را کوتاه‌تر وارد کنید.</p>
              <button type="button" onClick={clearSearch}>نمایش همه دسته‌ها</button>
            </div>
          ) : (
            <div className={`all-categories-groups ${viewLayout === 'matrix' ? 'is-matrix-view' : ''}`}>
              {categorySections.map((section, sectionIndex) => {
                const GroupIcon = GROUP_ICONS[section.id] || Layers;
                const groupMeta = GROUP_VISUALS[section.id];
                return (
                  <section
                    className="all-categories-group"
                    id={`menu-group-${section.id}`}
                    key={section.id}
                    aria-labelledby={`all-categories-group-${section.id}`}
                  >
                    <header className="all-categories-group-heading">
                      <div className="all-categories-group-index">{toPersianDigits(sectionIndex + 1)}</div>
                      {groupMeta?.image ? (
                        <div className="all-categories-group-thumb">
                          <img src={groupMeta.image} alt="" loading="lazy" decoding="async" />
                        </div>
                      ) : (
                        <div className="all-categories-group-icon"><GroupIcon size={20} /></div>
                      )}
                      <div className="all-categories-group-title">
                        <span>گروه صنعتی {toPersianDigits(sectionIndex + 1)}</span>
                        <h3 id={`all-categories-group-${section.id}`}>{section.title}</h3>
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
                          className="all-categories-group-focus-btn"
                          onClick={() => setGroupFilter(selectedGroupFilter === section.id ? 'all' : section.id)}
                        >
                          {selectedGroupFilter === section.id ? 'همه گروه‌ها' : 'فقط این گروه'}
                        </button>
                      </div>
                    </header>

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
                            <Link to={route} className={`all-categories-card-art ${artwork ? 'has-image' : 'has-placeholder'}`} tabIndex={-1} aria-hidden="true">
                              {artwork ? (
                                <img src={artwork} alt={category.name} loading="lazy" decoding="async" />
                              ) : (
                                <div className="all-categories-art-placeholder">
                                  <span className="all-categories-art-ring all-categories-art-ring-one" />
                                  <span className="all-categories-art-ring all-categories-art-ring-two" />
                                  <CategoryIcon size={34} />
                                </div>
                              )}
                              <span className="all-categories-card-number">{toPersianDigits(categoryIndex + 1)}</span>
                              <span className="all-categories-card-orange-badge">{category.name.split(' ')[0]}</span>
                              {source === 'database' && (skuCount !== null || familyCount !== null) && (
                                <span className="all-categories-card-count-badge">
                                  {toPersianDigits(skuCount || familyCount || 0)} کالا
                                </span>
                              )}
                              <span className="all-categories-card-group">{section.title}</span>
                            </Link>

                            <div className="all-categories-card-content">
                              {childNodes.length > 0 && (
                                <div className="all-categories-card-tags">
                                  {childNodes.slice(0, 3).map(node => (
                                    <span key={node.name} className="all-categories-card-tag">
                                      {node.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="all-categories-card-title-row">
                                <span className="all-categories-card-icon"><CategoryIcon size={17} /></span>
                                <div>
                                  <h4><Link to={route}>{category.name}</Link></h4>
                                  {category.nameEn && <span dir="ltr">{category.nameEn}</span>}
                                </div>
                              </div>
                              <p>{categoryDescription(category)}</p>

                              <div className="all-categories-card-meta">
                                {source === 'database' ? (
                                  <>
                                    <span>
                                      <strong>{toPersianDigits(familyCount ?? 0)}</strong>
                                      خانواده
                                    </span>
                                    <span>
                                      <strong>{toPersianDigits(skuCount ?? 0)}</strong>
                                      کد کالا
                                    </span>
                                    {childNodes.length > 0 && (
                                      <span>
                                        <strong>{toPersianDigits(childNodes.length)}</strong>
                                        زیرگروه
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="all-categories-card-meta-muted">آمار پس از اتصال به کاتالوگ</span>
                                )}
                              </div>

                              {childNodes.length > 0 && (
                                <div className="all-categories-subcategory-links" aria-label={`زیرگروه‌های ${category.name}`}>
                                  {childNodes.slice(0, 4).map(node => (
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
                                <CategoryNavigation nodes={category.children || []} categorySlug={category.slug} />
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
            <span>کد یا تصویر قطعه را در اختیار ندارید؟</span>
            <h2>از جستجوی هوشمند تصویری تا مشاوره فنی با FORZA، مسیر انتخاب قطعه را ادامه دهید.</h2>
          </div>
          <div>
            <Link to="/identify-part"><Search size={16} /> شناسایی با تصویر</Link>
            <Link to="/ai-consult"><Sparkles size={16} /> مشاوره FORZA</Link>
            <Link to="/products"><Package size={16} /> تمام محصولات</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AllCategoriesPage;
