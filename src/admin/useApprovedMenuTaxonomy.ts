import { useCallback, useEffect, useMemo, useState } from 'react';
import { requireAdminApiJson } from '../utils/adminApiResponse';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../data/approvedMenuFallback';
import type { EnhancedCategory } from '../data/categories';

export type CatalogMenuAssignment = {
  familyCode: string; categorySlug: string;
  submenuName: string | null; leafName: string | null; method?: string;
};
export type CatalogMenuGroup = {
  id: string; title: string; categorySlugs: string[];
  sortOrder: number; active?: boolean;
};
const isApprovedCategory = (cat: EnhancedCategory) =>
  /^excel-v2-[0-9]+-[0-9]+$/.test(cat.slug) && cat.active !== false;
const isApprovedGroup = (group: CatalogMenuGroup) =>
  /^excel-v2-[0-9]+$/.test(group.id) && group.active !== false;

/** The same Supabase hierarchy powers catalogue, products and image assignments.
 *  The reviewed spreadsheet snapshot is used solely to avoid empty menus during outages. */
export function useApprovedMenuTaxonomy() {
  const [categories, setCategories] = useState<EnhancedCategory[]>(APPROVED_MENU_CATEGORIES);
  const [groups, setGroups] = useState<CatalogMenuGroup[]>(APPROVED_MENU_GROUPS);
  const [assignments, setAssignments] = useState<CatalogMenuAssignment[]>([]);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [cats, gps, links] = await Promise.all([
          fetch('/api/catalog/categories', {credentials:'same-origin',cache:'no-store'}),
          fetch('/api/catalog/navigation-groups', {credentials:'same-origin',cache:'no-store'}),
          fetch('/api/catalog/menu-family-assignments', {credentials:'same-origin',cache:'no-store'})
        ]);
        const [catResult, groupResult, assignmentResult] = await Promise.all([
          requireAdminApiJson<{categories:EnhancedCategory[]}>(cats,'دریافت دسته‌های کاتالوگ'),
          requireAdminApiJson<{groups:CatalogMenuGroup[]}>(gps,'دریافت گروه‌های کاتالوگ'),
          requireAdminApiJson<{assignments:CatalogMenuAssignment[]}>(links,'دریافت اتصال خانواده‌ها'),
        ]);
        if (!Array.isArray(catResult.categories) || !Array.isArray(groupResult.groups) ||
            !Array.isArray(assignmentResult.assignments)) throw Error('فهرست دسته‌بندی در پاسخ JSON موجود نیست.');
        const matchingCats = (catResult.categories as EnhancedCategory[]).filter(isApprovedCategory);
        const matchingGroups = (groupResult.groups as CatalogMenuGroup[]).filter(isApprovedGroup)
          .sort((a,b)=>a.sortOrder-b.sortOrder);
        if (mounted) {
          if (matchingCats.length===APPROVED_MENU_CATEGORIES.length) setCategories(matchingCats);
          if (matchingGroups.length===APPROVED_MENU_GROUPS.length) setGroups(matchingGroups);
          setAssignments(assignmentResult.assignments);
          setAssignmentsLoaded(true); setLoadError('');
        }
      } catch (err) {
        if (mounted) { setAssignmentsLoaded(false);setLoadError(err instanceof Error ? err.message : 'خطای بارگذاری دسته‌ها'); }
      }
    };
    void load();
    const handler = () => refresh();
    window.addEventListener('catalog-navigation-groups-updated',handler);
    window.addEventListener('catalog-family-menu-updated',handler);
    return () => {
      mounted = false;
      window.removeEventListener('catalog-navigation-groups-updated',handler);
      window.removeEventListener('catalog-family-menu-updated',handler);
    };
  }, [revision,refresh]);
  const byFamily = useMemo(() => new Map(assignments.map(item => [item.familyCode,item])), [assignments]);
  return {categories,groups,assignments,byFamily,assignmentsLoaded,loadError,refresh};
}

export async function saveApprovedFamilyAssignment(input: {
  familyCode: string; categorySlug: string; submenu: string; leaf?: string;
}) {
  const res = await fetch('/api/catalog/menu-family-assignment', {
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(input),
  });
  const body=await requireAdminApiJson<{success:true}>(res,'اتصال خانواده به دسته‌بندی');
  window.dispatchEvent(new Event('catalog-family-menu-updated'));
  return body;
}
