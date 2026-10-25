import React, { useState } from 'react';
import { ChevronDown, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import type { CategoryNode } from '../data/categories';

interface Props {
  nodes: CategoryNode[];
  onChange: (nodes: CategoryNode[]) => void;
}

// Labels are editable; value retains the original family/submenu filter key.
// This ensures a renamed menu still selects the existing PostgreSQL products.
export const CategoryTreeEditor: React.FC<Props> = ({ nodes, onChange }) => {
  const [newRoot, setNewRoot] = useState('');
  const [newChildren, setNewChildren] = useState<Record<string, string>>({});

  const mutate = (
    path: number[],
    modifier: (node: CategoryNode) => CategoryNode | null,
  ) => {
    const walk = (list: CategoryNode[], depth: number): CategoryNode[] =>
      list.flatMap((node, index) => {
        if (index !== path[depth]) return [node];
        if (depth === path.length - 1) {
          const changed = modifier(node);
          return changed ? [changed] : [];
        }
        return [{ ...node, children: walk(node.children || [], depth + 1) }];
      });
    onChange(walk(nodes, 0));
  };

  const addRoot = () => {
    const name = newRoot.trim();
    if (!name || nodes.some(node => node.name === name)) return;
    onChange([...nodes, { name, value: name, children: [] }]);
    setNewRoot('');
  };

  const render = (node: CategoryNode, path: number[], depth: number): React.ReactNode => {
    const key = path.join('-');
    const pending = newChildren[key] || '';
    return (
      <div key={key} className={depth === 0 ? 'rounded-xl border border-slate-200 bg-white p-3 space-y-2' : 'rounded-lg bg-slate-50 border border-slate-100 p-2.5 space-y-2'}>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <span className="text-[10px] text-slate-400 shrink-0">{depth === 0 ? 'زیرمنو' : 'زیرگروه'}</span>
          <input
            type="text"
            dir="rtl"
            value={node.name}
            onChange={event => mutate(path, current => ({
              ...current,
              value: current.value || current.name,
              name: event.target.value,
            }))}
            aria-label="ویرایش نام زیرمنو یا زیرگروه"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
          />
          <button type="button"
            onClick={() => mutate(path, current => ({ ...current, hidden: !current.hidden }))}
            className={'flex items-center gap-1 rounded-lg px-2.5 py-2 border text-[11px] font-bold ' + (node.hidden ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-white text-slate-600 border-slate-200')}
            title={node.hidden ? 'نمایش دوباره در سایت' : 'مخفی کردن از منوی عمومی'}
          >
            {node.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            {node.hidden ? 'مخفی' : 'نمایش'}
          </button>
          <button type="button" onClick={() => mutate(path, () => null)}
            aria-label="حذف فقط از منو (کالاها حفظ می‌شوند)"
            className="p-2 rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50">
            <Trash2 size={15} />
          </button>
        </div>
        {node.hidden && <p className="text-[10px] text-amber-700">این نام در منوی عمومی و صفحه دسته‌بندی نمایش داده نمی‌شود؛ اطلاعات کالا حذف نمی‌شود.</p>}
        {depth === 0 && <>
          {(node.children || []).length > 0 && (
            <details open className="border-r-2 border-orange-100 pr-3">
              <summary className="cursor-pointer flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-2">
                <ChevronDown size={13} /> زیرگروه‌ها ({(node.children || []).length.toLocaleString('fa-IR')})
              </summary>
              <div className="space-y-2">
                {(node.children || []).map((child, index) => render(child, [...path, index], depth + 1))}
              </div>
            </details>
          )}
          <div className="flex gap-2">
            <input value={pending} onChange={event => setNewChildren(prev => ({ ...prev, [key]: event.target.value }))}
              onKeyDown={event => {
                if (event.key !== 'Enter' || !pending.trim()) return;
                event.preventDefault();
                mutate(path, current => ({ ...current, children: [...(current.children || []), { name: pending.trim(), value: pending.trim() }] }));
                setNewChildren(prev => ({ ...prev, [key]: '' }));
              }}
              placeholder="نام زیرگروه جدید"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-xs"
            />
            <button type="button" onClick={() => {
              if (!pending.trim()) return;
              mutate(path, current => ({ ...current, children: [...(current.children || []), { name: pending.trim(), value: pending.trim() }] }));
              setNewChildren(prev => ({ ...prev, [key]: '' }));
            }} className="inline-flex items-center gap-1 rounded-lg border border-orange-200 px-3 py-2 text-[11px] font-bold text-[#C55817]">
              <Plus size={14} /> زیرگروه
            </button>
          </div>
        </>}
      </div>
    );
  };

  return <div dir="rtl" className="space-y-3">
    {nodes.map((node, index) => render(node, [index], 0))}
    <div className="flex gap-2 rounded-xl bg-orange-50/50 p-3 border border-orange-100">
      <input value={newRoot} onChange={event => setNewRoot(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addRoot(); } }}
        placeholder="نام زیرمنوی جدید"
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2.5 text-xs" />
      <button type="button" onClick={addRoot} className="inline-flex items-center gap-1 rounded-lg bg-[#E06518] px-3 text-white text-xs font-bold">
        <Plus size={15} /> افزودن زیرمنو
      </button>
    </div>
  </div>;
};
