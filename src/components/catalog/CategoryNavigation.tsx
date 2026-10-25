import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { resolveCategorySlug } from '../../data/categories';
import { categorySlugFor } from '../../data/userProducts';
import type { CategoryNode } from '../../data/categories';

type Props = {
  nodes: CategoryNode[];
  categorySlug: string;
  onNavigate?: () => void;
  onSelect?: (name: string) => void;
  selected?: string;
  expanded?: boolean;
};

/** One recursive view preserves every level of the catalogue taxonomy. */
export const CategoryNavigation: React.FC<Props> = ({ nodes, categorySlug, onNavigate, onSelect, selected, expanded = false }) => {
  const canonicalCategorySlug = resolveCategorySlug(categorySlug);
  const beltCategorySlug = categorySlugFor('تسمه و انتقال نیرو');
  const pulleyCategorySlug = categorySlugFor('پولی و انتقال نیرو');
  const isDedicatedCategory = canonicalCategorySlug === beltCategorySlug || canonicalCategorySlug === pulleyCategorySlug;
  const categoryHref = (selection: string) => isDedicatedCategory
    ? `/category/${canonicalCategorySlug}?${new URLSearchParams({ sub: selection })}`
    : `/products?${new URLSearchParams({ category: categorySlug, sub: selection })}`;
  const selectionValue = (node: CategoryNode) => node.value || node.name;
  const containsSelected = (node: CategoryNode): boolean => selectionValue(node) === selected || Boolean(node.children?.some(containsSelected));
  const renderNode = (node: CategoryNode, depth: number): React.ReactNode => {
    if (node.hidden === true) return null;
    const visibleChildren = (node.children || []).filter(child => child.hidden !== true);
    const labelClass = `block w-full text-right rounded-lg px-2.5 py-2 text-xs leading-6 transition-colors ${selected === selectionValue(node) ? 'bg-orange-50 text-[#E06518] font-bold' : 'text-[#55565A] hover:bg-orange-50 hover:text-[#E06518]'} ${depth === 0 ? 'font-bold' : ''}`;
    const label = onSelect ? (
      <button type="button" className={labelClass} aria-pressed={selected === selectionValue(node)} onClick={() => onSelect(selectionValue(node))}>{node.name}</button>
    ) : (
      <Link className={labelClass} to={categoryHref(selectionValue(node))} onClick={onNavigate}>{node.name}</Link>
    );
    return (
      <li key={node.name}>
        {visibleChildren.length ? (
          <details open={(expanded && depth === 0) || containsSelected(node)} className="rounded-xl border border-slate-200/70 bg-white">
            <summary className="cursor-pointer flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold leading-6 text-[#484344] hover:text-[#E06518] rounded-xl focus-visible:outline-2 focus-visible:outline-orange-500">
              <span>{node.name}</span><ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </summary>
            <div className="px-2 pb-2">
              {onSelect ? <button type="button" className="px-2.5 py-1 text-[11px] text-[#E06518] font-bold" onClick={() => onSelect(selectionValue(node))} aria-pressed={selected === selectionValue(node)}>همهٔ {node.name}</button> : <Link className="block px-2.5 py-1 text-[11px] text-[#E06518] font-bold" to={categoryHref(selectionValue(node))} onClick={onNavigate}>همهٔ {node.name}</Link>}
              <ul className="space-y-1 border-r border-slate-200 mr-2 pr-2">{visibleChildren.map(child => renderNode(child, depth + 1))}</ul>
            </div>
          </details>
        ) : label}
      </li>
    );
  };
  return <ul dir="rtl" className="space-y-2">{nodes.filter(node => node.hidden !== true).map(node => renderNode(node, 0))}</ul>;
};
