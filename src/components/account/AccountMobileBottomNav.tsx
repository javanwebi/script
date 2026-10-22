import React from 'react';
import { Home, Search, Package, Truck, Menu, Sparkles } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';

interface AccountMobileBottomNavProps {
  currentTab: string;
  setTab: (tab: string) => void;
  ordersCount: number;
  onOpenMore: () => void;
  onOpenQuickScan?: () => void;
}

export const AccountMobileBottomNav: React.FC<AccountMobileBottomNavProps> = ({
  currentTab,
  setTab,
  ordersCount,
  onOpenMore,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'پیشخوان',
      icon: Home,
      isAction: false,
    },
    {
      id: 'countertop',
      label: 'استعلام دخل',
      icon: Search,
      badge: 'MSRP',
      isAction: false,
    },
    {
      id: 'shelf_packs',
      label: 'کارتن جور',
      icon: Package,
      badge: '۳۰٪',
      isAction: false,
    },
    {
      id: 'orders',
      label: 'بارنامه‌ها',
      icon: Truck,
      count: ordersCount,
      isAction: false,
    },
    {
      id: 'more',
      label: 'منو و ابزارها',
      icon: Menu,
      isAction: true,
    },
  ];

  return (
    <nav
      aria-label="ناوبری اختصاصی موبایل"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#131822]/92 backdrop-blur-2xl border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] px-2 py-1.5 safe-area-pb"
    >
      <div className="grid grid-cols-5 items-center justify-around gap-1 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = !item.isAction && currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.isAction) {
                  onOpenMore();
                } else {
                  setTab(item.id);
                }
              }}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer select-none active:scale-95 ${
                isActive
                  ? 'text-[#FB923C]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Active Indicator Top Bar */}
              {isActive && (
                <span className="absolute -top-1.5 w-6 h-1 rounded-full bg-gradient-to-r from-[#E06518] to-orange-400 shadow-sm shadow-orange-500/40" />
              )}

              {/* Icon Container with subtle background when active */}
              <div
                className={`relative p-1 rounded-xl transition-all ${
                  isActive
                    ? 'bg-orange-500/15 text-[#FB923C]'
                    : 'text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5 transition-transform" />

                {/* Badge if present */}
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-[#E06518] text-white text-[8px] font-bold rounded-full shadow-2xs leading-tight">
                    {item.badge}
                  </span>
                )}

                {/* Count badge if present */}
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-1 bg-emerald-500 text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center shadow-2xs leading-none">
                    {toPersianDigits(item.count)}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[10px] font-bold mt-0.5 tracking-tight truncate max-w-full ${
                  isActive ? 'font-black text-[#FB923C]' : 'text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
