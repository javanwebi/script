import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { CategoryNode } from '../../data/categories';
import { resolveCategorySlug } from '../../data/categories';

interface CategoryNavigationProps {
  nodes: CategoryNode[];
  categorySlug: string;
  selected?: string;
  onSelect?: (value: string) => void;
  onNavigate?: () => void;
  expanded?: boolean;
}

export const CategoryNavigation: React.FC<CategoryNavigationProps> = ({
  nodes,
  categorySlug,
  selected,
  onSelect,
  onNavigate,
  expanded = false,
}) => {
  const selectionValue = (node: CategoryNode) => node.value || node.name;
  const canonicalSlug = resolveCategorySlug(categorySlug);

  const categoryHref = (subValue: string) =>
    `/category/${encodeURIComponent(canonicalSlug)}?${new URLSearchParams({ sub: subValue }).toString()}`;

  const containsSelected = (node: CategoryNode): boolean => {
    if (!selected) return false;
    if (selectionValue(node) === selected) return true;
    return (node.children || []).some((child) => child.hidden !== true && containsSelected(child));
  };

  const renderNode = (node: CategoryNode, depth: number) => {
    const visibleChildren = (node.children || []).filter((child) => child.hidden !== true);
    const val = selectionValue(node);
    const isActive = selected === val;
    const labelClass = `block w-full text-right rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
      isActive
        ? 'bg-orange-50 text-[#E06518] font-bold'
        : 'text-[#484344] hover:bg-slate-50 hover:text-[#E06518]'
    }`;

    const label = onSelect ? (
      <button
        type="button"
        className={`${labelClass} cursor-pointer`}
        aria-pressed={isActive}
        onClick={() => onSelect(val)}
      >
        {node.name}
      </button>
    ) : (
      <Link className={labelClass} to={categoryHref(val)} onClick={onNavigate}>
        {node.name}
      </Link>
    );

    return (
      <li key={`${depth}-${node.name}`}>
        {visibleChildren.length > 0 ? (
          <details
            open={(expanded && depth === 0) || containsSelected(node)}
            className="rounded-xl border border-slate-200/75 bg-white"
          >
            <summary className="cursor-pointer flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold leading-6 text-[#484344] hover:text-[#E06518] rounded-xl list-none">
              <span>{node.name}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            </summary>
            <div className="px-2 pb-2">
              {onSelect ? (
                <button
                  type="button"
                  className="px-2.5 py-1 text-[11px] text-[#E06518] font-bold cursor-pointer"
                  onClick={() => onSelect(val)}
                  aria-pressed={isActive}
                >
                  همهٔ {node.name}
                </button>
              ) : (
                <Link
                  className="block px-2.5 py-1 text-[11px] text-[#E06518] font-bold"
                  to={categoryHref(val)}
                  onClick={onNavigate}
                >
                  همهٔ {node.name}
                </Link>
              )}
              <ul className="space-y-1 border-r border-slate-200 mr-2 pr-2">
                {visibleChildren.map((child) => renderNode(child, depth + 1))}
              </ul>
            </div>
          </details>
        ) : (
          label
        )}
      </li>
    );
  };

  return (
    <ul dir="rtl" className="space-y-2">
      {(nodes || []).filter((node) => node.hidden !== true).map((node) => renderNode(node, 0))}
    </ul>
  );
};
