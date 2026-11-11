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

const categoryArtwork = (category: EnhancedCategory): string | undefined => {
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
  if (/نسوز|حرارتی/.test(name)) return STORE_ASSETS.industries.ceramic;
  if (/لعاب|چاپ|روتاری/.test(name)) return STORE_ASSETS.industries.ceramic;
  if (/توری مش/.test(name)) return STORE_ASSETS.industries.manufacturing;
  if (/سفارشی|نقشه فنی/.test(name)) return STORE_ASSETS.reverseEngineeringLab;
  return undefined;
};

const categoryDescription = (category: EnhancedCategory) => {
  if (category.description?.trim()) return category.description.trim();
  const childNames = (category.children || []).filter(node => node.hidden !== true).map(node => node.name);
  return childNames.length
    ? childNames.slice(0, 3).join('، ')
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

  const query = normalizeSearch(searchQuery);
  const categorySections = useMemo(() => catalogueGroups
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
      return { ...group, categories };
    })
    .filter(group => group.categories.length > 0), [catalogueCategories, catalogueGroups, query]);

  const visibleCategoryCount = categorySections.reduce((total, section) => total + section.categories.length, 0);
  const liveCategoryCount = catalogueCategories.length;

  const clearSearch = () => setSearchQuery('');

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
              راهنمای انتخاب قطعات صنعت پیش
            </span>
            <h1 id="all-categories-title">
              قطعه موردنیاز خط تولید را
              <em> دقیق‌تر پیدا کنید.</em>
            </h1>
            <p>
              از گروه اصلی تا زیرگروه تخصصی حرکت کنید؛ مشخصات فنی را بررسی کنید و به کاتالوگ همان دسته برسید.
            </p>
            <div className="all-categories-hero-actions">
              <Link to="/products" className="all-categories-primary-action">
                مشاهده کاتالوگ محصولات <ArrowLeft size={16} />
              </Link>
              <Link to="/identify-part" className="all-categories-secondary-action">
                شناسایی قطعه با تصویر <ArrowUpLeft size={16} />
              </Link>
            </div>
            <form className="all-categories-search" role="search" onSubmit={event => event.preventDefault()}>
              <Search aria-hidden="true" size={19} />
              <input
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                aria-label="جستجو در دسته‌بندی و زیرگروه‌ها"
                placeholder="نام قطعه، دسته یا زیرگروه را جستجو کنید…"
                autoComplete="off"
              />
              {searchQuery && (
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
              <span>مسیر انتخاب</span>
              <strong>گروه <i>›</i> زیرگروه <i>›</i> کد فنی</strong>
            </div>
            <div className="all-categories-hero-note">
              <CheckCircle2 size={15} />
              <span>دسترسی مستقیم به ساختار کاتالوگ</span>
            </div>
          </div>

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
              <span>انتخاب دقیق‌تر</span>
              <strong>بدون حدس‌زدن کد کالا</strong>
            </div>
          </div>
        </section>



        {categorySections.length > 0 && (
          <nav className="all-categories-group-nav" aria-label="پرش به گروه‌های دسته‌بندی">
            <span>پرش به گروه:</span>
            <div>
              {categorySections.map((section, index) => (
                <a key={section.id} href={`#menu-group-${section.id}`}>
                  <span>{toPersianDigits(index + 1)}</span>
                  {section.title}
                </a>
              ))}
            </div>
          </nav>
        )}

        <section className="all-categories-results" aria-label="گروه‌های دسته‌بندی">
          <div className="all-categories-results-heading">
            <div>
              <span>فهرست راهنمای محصولات</span>
              <h2>{query ? 'نتایج جستجو در دسته‌بندی‌ها' : 'گروه‌های تخصصی قطعات'}</h2>
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
            <div className="all-categories-groups">
              {categorySections.map((section, sectionIndex) => {
                const GroupIcon = GROUP_ICONS[section.id] || Layers;
                return (
                  <section
                    className="all-categories-group"
                    id={`menu-group-${section.id}`}
                    key={section.id}
                    aria-labelledby={`all-categories-group-${section.id}`}
                  >
                    <header className="all-categories-group-heading">
                      <div className="all-categories-group-index">{toPersianDigits(sectionIndex + 1)}</div>
                      <div className="all-categories-group-icon"><GroupIcon size={20} /></div>
                      <div className="all-categories-group-title">
                        <span>گروه تخصصی</span>
                        <h3 id={`all-categories-group-${section.id}`}>{section.title}</h3>
                      </div>
                      <div className="all-categories-group-count">
                        <strong>{toPersianDigits(section.categories.length)}</strong>
                        <span>دسته</span>
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
                            <div className={`all-categories-card-art ${artwork ? 'has-image' : 'has-placeholder'}`}>
                              {artwork ? (
                                <img src={artwork} alt="" loading="lazy" decoding="async" />
                              ) : (
                                <div className="all-categories-art-placeholder" aria-hidden="true">
                                  <span className="all-categories-art-ring all-categories-art-ring-one" />
                                  <span className="all-categories-art-ring all-categories-art-ring-two" />
                                  <CategoryIcon size={34} />
                                </div>
                              )}
                              <span className="all-categories-card-number">{toPersianDigits(categoryIndex + 1)}</span>
                              <span className="all-categories-card-group">{section.title}</span>
                            </div>

                            <div className="all-categories-card-content">
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
                                  </>
                                ) : (
                                  <span className="all-categories-card-meta-muted">آمار پس از اتصال به کاتالوگ</span>
                                )}
                              </div>

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
                                    <span>+{toPersianDigits(childNodes.length - 3)}</span>
                                  )}
                                </div>
                              )}

                              <details className="all-categories-tree">
                                <summary>
                                  مشاهده ساختار کامل زیرگروه‌ها
                                  <ChevronDown size={15} />
                                </summary>
                                <CategoryNavigation nodes={category.children || []} categorySlug={category.slug} />
                              </details>

                              <Link to={route} className="all-categories-card-action">
                                مشاهده محصولات این دسته <ArrowLeft size={16} />
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
            <h2>از جستجوی هوشمند تا مشاوره فنی، مسیر انتخاب را ادامه دهید.</h2>
          </div>
          <div>
            <Link to="/identify-part"><Search size={16} /> شناسایی با تصویر</Link>
            <Link to="/ai-consult"><Sparkles size={16} /> مشاوره FORZA</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AllCategoriesPage;
