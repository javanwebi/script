import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { flattenCategoryNodes, resolveCategorySlug } from '../data/categories';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../data/approvedMenuFallback';
import type { EnhancedCategory } from '../data/categories';
import { CategoryNavigation } from '../components/catalog/CategoryNavigation';
import { USER_PRODUCTS, CATALOGUE_SKU_COUNT } from '../data/userProducts';
import { 
  Layers, 
  Cpu, 
  Grid, 
  CircleDot, 
  Shield, 
  Link as LinkIcon, 
  Scissors, 
  ShieldCheck, 
  Package, 
  Search, 
  ChevronLeft, 
  Boxes, 
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Flame,
  Award
} from 'lucide-react';
import { toPersianDigits } from '../utils/formatters';

const ICON_MAP: Record<string, React.ReactNode> = {
  Cpu: <Cpu className="w-6 h-6" />,
  Layers: <Layers className="w-6 h-6" />,
  Grid: <Grid className="w-6 h-6" />,
  CircleDot: <CircleDot className="w-6 h-6" />,
  Shield: <Shield className="w-6 h-6" />,
  Link: <LinkIcon className="w-6 h-6" />,
  Scissors: <Scissors className="w-6 h-6" />,
  ShieldCheck: <ShieldCheck className="w-6 h-6" />,
  Package: <Package className="w-6 h-6" />,
  Flame: <Flame className="w-6 h-6" />,
  Award: <Award className="w-6 h-6" />,
};

export const AllCategoriesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [importedCategories, setImportedCategories] = useState<EnhancedCategory[]>(APPROVED_MENU_CATEGORIES);
  const [importedGroups, setImportedGroups] = useState<Array<{
    id: string; title: string; categorySlugs: string[];
  }>>(APPROVED_MENU_GROUPS);

  useEffect(() => {
    let mounted = true;
    const loadExcelHierarchy = async () => {
      try {
        const [categoriesResponse, groupsResponse] = await Promise.all([
          fetch('/api/catalog/categories', { credentials: 'same-origin', cache: 'no-store' }),
          fetch('/api/catalog/navigation-groups', { credentials: 'same-origin', cache: 'no-store' }),
        ]);
        if (!categoriesResponse.ok || !groupsResponse.ok) return;
        const [categoriesData, groupsData] = await Promise.all([categoriesResponse.json(), groupsResponse.json()]);
        if (!categoriesData?.success || !groupsData?.success ||
          !Array.isArray(categoriesData.categories) || !Array.isArray(groupsData.groups)) return;
        const indexed = new Map<string, EnhancedCategory>(
          (categoriesData.categories as EnhancedCategory[]).map(category => [category.slug, category])
        );
        const groups = (groupsData.groups as {
          id: string; title: string; active?: boolean; sortOrder: number; categorySlugs: string[];
        }[]).filter(group => /^excel-v2-[0-9]+$/.test(group.id) && group.active !== false)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (!groups.length) return;
        const seen = new Set<string>();
        const ordered = groups.flatMap(group => (group.categorySlugs || []).map(slug => indexed.get(slug)))
          .filter((category): category is EnhancedCategory => {
            if (!category || seen.has(category.slug)) return false;
            seen.add(category.slug);
            return true;
          });
        if (mounted && ordered.length === APPROVED_MENU_CATEGORIES.length && groups.length === APPROVED_MENU_GROUPS.length) {
          setImportedCategories(ordered);
          setImportedGroups(groups);
        }
      } catch {
        // The hydrated catalogue is the fallback if the dedicated navigation API is unavailable.
      }
    };
    void loadExcelHierarchy();
    return () => { mounted = false; };
  }, []);

  const catalogueCategories = importedCategories;
  const filteredCategories = catalogueCategories.filter(cat => {
    if (cat.active === false) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      cat.name.toLowerCase().includes(q) ||
      (cat.nameEn || '').toLowerCase().includes(q) ||
      cat.description.toLowerCase().includes(q) ||
      flattenCategoryNodes(cat.children || []).some(node => node.hidden !== true && node.name.toLowerCase().includes(q))
    );
  });

  const categorySections = importedGroups.length
    ? importedGroups.map(group => ({
        id: group.id, title: group.title,
        categories: filteredCategories.filter(category => group.categorySlugs.includes(category.slug)),
      })).filter(section => section.categories.length > 0)
    : [{ id: 'all', title: '', categories: filteredCategories }];

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium">
          <Link to="/" className="hover:text-orange-600 transition-colors">
            صفحه اصلی
          </Link>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 font-bold">تمام دسته‌بندی‌های محصولات</span>
        </nav>

        {/* Page Header */}
        <div className="bg-gradient-to-l from-[#484344] to-[#3A3637] text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>کاتالوگ جامع و دسته‌بندی تخصصی قطعات اطلس</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                تمام دسته‌بندی‌های قطعات و تجهیزات صنعتی
              </h1>
              <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
                دسته‌بندی محصولات بر اساس گروه، زیرگروه و نوع فنی؛ همراه با خانواده‌های محصول، سایزها و کدهای کالا.
              </p>
            </div>

            {/* Quick Stats Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                <span className="block text-2xl font-black text-orange-400 font-mono">
                  {toPersianDigits(catalogueCategories.length)}
                </span>
                <span className="text-xs text-slate-300 font-medium">دسته‌بندی تخصصی</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                <span className="block text-2xl font-black text-white font-mono">
                  {toPersianDigits(USER_PRODUCTS.length)}
                </span>
                <span className="text-xs text-slate-300 font-medium">خانواده محصول</span>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                <span className="block text-2xl font-black text-emerald-400 font-mono">
                  {toPersianDigits(CATALOGUE_SKU_COUNT)}
                </span>
                <span className="text-xs text-slate-300 font-medium">کد کالا و سایز</span>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="mt-8 relative max-w-2xl">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در نام دسته‌بندی، زیردسته‌ها، نوع قطعه، کاربرد..."
              className="w-full bg-white/95 text-slate-900 pr-12 pl-4 py-3.5 rounded-2xl shadow-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-300"
              >
                پاک کردن
              </button>
            )}
          </div>
        </div>

        {/* Grouped exactly as the main menu hierarchy in Supabase. */}
        <div className="space-y-9">
          {categorySections.map(section => (
            <section key={section.id} className="space-y-4">
              {section.title && (
                <h2 className="border-r-4 border-[#E56B1E] pr-3 text-xl font-black text-[#484344]">
                  {section.title}
                </h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 xl:gap-6">
          {section.categories.map((category) => {
            const familyCount = category.familyCount ?? category.count;
            const skuCount = category.skuCount ?? category.count;

            return (
              <div
                key={category.id}
                className="group relative flex flex-col bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(10,23,47,0.04)] hover:shadow-[0_15px_35px_rgba(224,101,24,0.12)] hover:border-orange-300 transition-all duration-300 overflow-hidden"
              >
                {/* Image & Header Banner */}
                <div className="relative h-48 bg-slate-100 overflow-hidden">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Boxes className="w-16 h-16" />
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#484344]/80 via-transparent to-transparent" />

                  {/* Icon & Count Badges */}
                  <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                    <div className="w-10 h-10 rounded-2xl bg-white/90 backdrop-blur-md shadow-md flex items-center justify-center text-orange-600 border border-white/50">
                      {ICON_MAP[category.icon] || <Boxes className="w-5 h-5" />}
                    </div>
                  </div>

                  <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1">
                    <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-[#484344]/90 backdrop-blur-md text-orange-300 border border-orange-400/40">
                      {toPersianDigits(skuCount)} کد کالا
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-[#484344] border border-white/70 shadow-sm">
                      {toPersianDigits(familyCount)} خانواده
                    </span>
                  </div>

                  {/* Category Title overlayed at bottom of banner */}
                  <div className="absolute bottom-3 right-3 left-3 z-10 text-white">
                    <h2 className="text-lg font-black drop-shadow-sm group-hover:text-orange-400 transition-colors">
                      {category.name}
                    </h2>
                    <p className="text-[11px] text-slate-300 font-mono tracking-wider">
                      {category.nameEn}
                    </p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex-1 flex flex-col p-5 space-y-4">
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">
                    {category.description}
                  </p>

                  <CategoryNavigation nodes={category.children || []} categorySlug={category.slug} />

                  {/* Action Link Button */}
                  <div className="pt-2 mt-auto border-t border-slate-100">
                    <Link
                      to={`/category/${resolveCategorySlug(category.slug)}`}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#484344] hover:bg-[#E06518] text-white py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow-md group-hover:shadow-orange-500/20"
                    >
                      <span>مشاهده محصولات این دسته‌بندی</span>
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
              </div>
            </section>
          ))}
        </div>

        {/* Empty state if search returns nothing */}
        {filteredCategories.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-md mx-auto space-y-4">
            <Boxes className="w-16 h-16 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">دسته‌بندی مورد نظر یافت نشد</h3>
            <p className="text-sm text-slate-500">
              عبارت دیگری را جستجو کنید یا تمام دسته‌بندی‌ها را مشاهده نمایید.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors"
            >
              نمایش همه دسته‌بندی‌ها
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default AllCategoriesPage;
