import { ReferenceMegaMenu } from "../catalog/ReferenceMegaMenu";
import { IndustryNavigation } from "../storefront/IndustryTools";
import {AboutNavigation} from '../../pages/DiscoveryPages';
import { ProductImage } from '../product/ProductImage';
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  User,
  Camera,
  X,
  ChevronDown,
  ChevronLeft,
  Phone,
  Layers,
  ShieldCheck,
  Building,
  Award,
  Heart,
  FileText,
  Headphones,
  ClipboardList,
  Truck,
  LayoutGrid,
  Factory,
  Tag,
  Wrench,
  Users,
  BookOpen,
  Sparkles,
  ExternalLink,
  Instagram,
  Send,
  MessageCircle,
  Package,
  Bell,
  Clock,
  Megaphone,
  ArrowUpLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { STORE_ASSETS } from '../../assets/images';
import { CATEGORIES, PRIMARY_CATALOG_CATEGORIES } from '../../data/categories';
import { CategoryNavigation } from '../catalog/CategoryNavigation';
import { BRANDS } from '../../data/brands';
import { getInstantSearchResults } from '../../data/mockGenerator';
import { toPersianDigits, formatPrice } from '../../utils/formatters';
import { Product } from '../../types';
import { AiVisualPartSearchModal } from '../search/AiVisualPartSearchModal';
import { AiConsultModal } from '../search/AiConsultModal';
import {
  portalContentService,
  PortalAnnouncementItem,
} from '../../services/portalContentService';

type NavMenuType = 'products' | 'industries' | 'brands' | 'services' | 'about' | 'clients' | null;

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logout, openAuthModal } = useAuth();
  const { itemCount } = useCart();
  const { wishlist } = useWishlist();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [liveResults, setLiveResults] = useState<{
    products: Product[];
    categories: typeof CATEGORIES;
    brands: typeof BRANDS;
  }>({ products: [], categories: [], brands: [] });

  // Announcements state
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const [visibleAnnouncements, setVisibleAnnouncements] = useState<PortalAnnouncementItem[]>([]);

  // Navigation states
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<NavMenuType>(null);
  const [activeMegaCategory, setActiveMegaCategory] = useState(CATEGORIES[0]?.slug || '');
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);

  // Modals
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const announcementsRef = useRef<HTMLDivElement>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const navBarRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Load & auto-sync active announcements (website + current user's retail/high_volume panel)
  useEffect(() => {
    const updateAnnouncements = () => {
      const userPortal = currentUser
        ? currentUser.approvedB2B === true
          ? 'high_volume'
          : 'consumer'
        : null;
      const list = portalContentService.getStorefrontAndUserAnnouncements({
        userId: currentUser?.id || null,
        portal: userPortal,
        tierCode: currentUser?.tier || null,
      });
      setVisibleAnnouncements(list);
    };

    updateAnnouncements();
    const unsubscribe = portalContentService.subscribe(updateAnnouncements);
    const timer = window.setInterval(updateAnnouncements, 15000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [currentUser]);

  // Live search debouncing / update
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const res = getInstantSearchResults(searchQuery);
      setLiveResults(res as any);
      setIsSearchDropdownOpen(true);
    }
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
      if (announcementsRef.current && !announcementsRef.current.contains(event.target as Node)) {
        setIsAnnouncementsOpen(false);
      }
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target as Node)) {
        setIsMegaMenuOpen(false);
      }
      if (navBarRef.current && !navBarRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleOpenSearch = () => {
      setIsSearchDropdownOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => searchInputRef.current?.focus(), 80);
    };
    const handleOpenConsult = () => navigate('/ai-consult');
    const handleOpenForza = () => navigate('/ai-consult?voice=1');

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMegaMenuOpen(false);
        setActiveDropdown(null);
        setIsSearchDropdownOpen(false);
        setIsAnnouncementsOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('open-mobile-search', handleOpenSearch);
    window.addEventListener('open-ai-consult', handleOpenConsult);
    window.addEventListener('open-forza-face-to-face', handleOpenForza);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('open-mobile-search', handleOpenSearch);
      window.removeEventListener('open-ai-consult', handleOpenConsult);
      window.removeEventListener('open-forza-face-to-face', handleOpenForza);
    };
  }, [navigate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchDropdownOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const selectedCategoryObj = CATEGORIES.find(c => c.slug === activeMegaCategory) || CATEGORIES[0];

  const formatCustomerEndTime = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    try {
      return d.toLocaleString('fa-IR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full shadow-sm">
      {/* Top subtle hairline orange accent bar matching footer */}
      <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-[#E06518] to-transparent opacity-85" />



      {/* 2. MAIN HEADER: Mobile = [Logo] + [Wide Minimal Search with Popup] + [Announcement Bell with Popup] */}
      <div className="bg-[#DEE2E5] border-b border-[#C1C8D0] shadow-xs px-2.5 sm:px-5 py-1.5 sm:py-2.5 transition-all relative z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3.5 lg:gap-5">
          {/* 1. Right: SANAT PISH Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/" className="flex items-center group shrink-0" title="صنعت پیش - پیش به صنعت">
              <div className="h-9 sm:h-11 md:h-12 lg:h-14 w-auto flex items-center justify-center shrink-0">
                <img
                  src={STORE_ASSETS.sanatPishLogo}
                  alt="لوگوی صنعت پیش"
                  className="h-9 sm:h-11 md:h-12 lg:h-14 w-auto max-w-[110px] sm:max-w-[150px] md:max-w-[180px] lg:max-w-[210px] object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-[1.03]"
                />
              </div>
            </Link>
          </div>

          {/* 2. Center: Minimal, Clear, Wide Search Bar with Instant Popup Underneath */}
          <div className="flex-1 max-w-2xl relative min-w-0" ref={searchContainerRef}>
            <form
              onSubmit={handleSearchSubmit}
              className={`relative w-full flex items-center bg-white rounded-xl border transition-all duration-150 ${
                isSearchDropdownOpen
                  ? 'border-[#E06518] ring-2 ring-[#E06518]/15 shadow-sm'
                  : 'border-[#B5BDC6] hover:border-[#949EA9] shadow-2xs'
              }`}
            >
              {/* Leading Search Icon (Right side in RTL) */}
              <button
                type="submit"
                className="pr-2.5 pl-1.5 text-[#E06518] hover:text-[#C95210] flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="جستجو"
              >
                <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
              </button>

              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onFocus={() => {
                  setIsSearchDropdownOpen(true);
                  setIsAnnouncementsOpen(false);
                }}
                placeholder="جستجوی قطعه، کد فنی، تسمه، بلبرینگ..."
                className="w-full h-9 sm:h-10.5 pl-16 sm:pl-20 pr-1 bg-transparent text-[#2B313A] text-[12px] sm:text-xs md:text-sm font-medium focus:outline-none placeholder:text-[#7B828A] placeholder:font-normal truncate"
              />

              {/* Left controls inside minimal search input */}
              <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                    aria-label="پاک کردن جستجو"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsSearchDropdownOpen(false);
                    setIsCameraModalOpen(true);
                  }}
                  title="جستجوی تصویری قطعه با دوربین"
                  className="p-1.5 rounded-lg text-[#5A6067] hover:text-[#E06518] hover:bg-orange-50 transition-colors cursor-pointer"
                  aria-label="جستجوی تصویری"
                >
                  <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </form>

            {/* Search Popup directly below the search bar */}
            {isSearchDropdownOpen && (
              <div className="absolute right-0 left-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-[#CBD2D8] overflow-hidden z-50 text-right text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                {searchQuery.trim().length < 2 ? (
                  /* Minimal Quick Search Popup when focused before typing 2+ chars */
                  <div className="p-3 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-[#6E7378]">
                      <span className="font-bold text-[#2B313A] flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-[#E06518]" />
                        <span>جستجوی سریع قطعات صنعتی</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSearchDropdownOpen(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        aria-label="بستن"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Popular Technical Queries */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-1.5">پرجستجوترین کدها و قطعات</div>
                      <div className="flex flex-wrap gap-1.5">
                        {['تسمه تایمینگ HTD', 'SWR', 'FORZA', 'بلبرینگ شیار عمیق', 'پولی صنعتی', 'زنجیر صنعتی'].map(term => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => {
                              setSearchQuery(term);
                              const res = getInstantSearchResults(term);
                              setLiveResults(res as any);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-orange-50 text-[#2B313A] hover:text-[#E06518] border border-slate-200/80 hover:border-orange-200 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Categories */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 mb-1.5">دسته‌بندی‌های اصلی</div>
                      <div className="flex flex-wrap gap-1.5">
                        {PRIMARY_CATALOG_CATEGORIES.slice(0, 5).map(cat => (
                          <Link
                            key={cat.slug}
                            to={`/category/${cat.slug}`}
                            onClick={() => setIsSearchDropdownOpen(false)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-[#E06518] border border-slate-200 text-[11px] font-bold transition-colors"
                          >
                            {cat.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Live Instant Search Results */
                  <div className="max-h-[70vh] overflow-y-auto">
                    {/* 1. Products Section */}
                    {liveResults.products.length > 0 && (
                      <div className="p-2.5 sm:p-3 border-b border-slate-100">
                        <div className="text-[11px] font-bold text-[#777A7D] mb-2 flex items-center justify-between">
                          <span>کالاهای یافت‌شده ({toPersianDigits(liveResults.products.length)})</span>
                          <button
                            type="button"
                            onClick={handleSearchSubmit as any}
                            className="text-[10px] font-bold text-[#E06518] hover:underline cursor-pointer"
                          >
                            مشاهده همه نتایج
                          </button>
                        </div>
                        <div className="space-y-1">
                          {liveResults.products.map(p => (
                            <Link
                              key={p.code}
                              to={`/product/${p.code}`}
                              onClick={() => setIsSearchDropdownOpen(false)}
                              className="flex items-center justify-between p-2 rounded-xl hover:bg-orange-50/50 transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <ProductImage
                                  src={p.images[0]}
                                  alt={p.name}
                                  className="w-8 h-8 rounded-lg border border-slate-200 object-contain p-0.5 bg-white shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-[#2B313A] group-hover:text-[#E06518] transition-colors truncate">
                                    {p.name}
                                  </div>
                                  <div className="font-mono text-[10px] text-[#777A7D] truncate">
                                    {p.code} | {p.brand}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-[#E06518] shrink-0 mr-2">مشاهده</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Categories Section */}
                    {liveResults.categories.length > 0 && (
                      <div className="p-2.5 sm:p-3 bg-slate-50/70 border-b border-slate-100">
                        <div className="text-[11px] font-bold text-[#777A7D] mb-1.5">دسته‌بندی‌های مرتبط</div>
                        <div className="flex flex-wrap gap-1.5">
                          {liveResults.categories.map(c => (
                            <Link
                              key={c.id}
                              to={`/category/${c.slug}`}
                              onClick={() => setIsSearchDropdownOpen(false)}
                              className="px-2.5 py-1 bg-white border border-[#CBD2D8] rounded-lg text-[11px] hover:border-[#E06518] hover:text-[#E06518] transition-colors"
                            >
                              {c.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. Brands Section */}
                    {liveResults.brands.length > 0 && (
                      <div className="p-2.5 sm:p-3 bg-slate-50/40">
                        <div className="text-[11px] font-bold text-[#777A7D] mb-1.5">برندهای صنعتی</div>
                        <div className="flex flex-wrap gap-2">
                          {liveResults.brands.map(b => (
                            <Link
                              key={b.id}
                              to={`/category/swr-forza-exclusive`}
                              onClick={() => setIsSearchDropdownOpen(false)}
                              className="text-xs font-bold text-[#2B313A] hover:text-[#E06518] flex items-center gap-1"
                            >
                              <Award className="w-3 h-3 text-[#E06518]" />
                              <span>{b.name}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {liveResults.products.length === 0 &&
                      liveResults.categories.length === 0 &&
                      liveResults.brands.length === 0 && (
                        <div className="p-5 text-center text-[#777A7D]">
                          موردی برای عبارت واردشده یافت نشد. دکمه Enter را برای جستجوی جامع فشار دهید.
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Left/End: Announcements Button (Mobile & Desktop) + Desktop Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* دکمه اطلاعیه‌ها (همراه با پاپ‌آپ زیر آیکون در موبایل و دسکتاپ) */}
            <div className="relative" ref={announcementsRef}>
              <button
                type="button"
                onClick={() => {
                  setIsAnnouncementsOpen(prev => !prev);
                  setIsSearchDropdownOpen(false);
                  setIsUserMenuOpen(false);
                }}
                className={`relative w-9 h-9 sm:w-10.5 sm:h-10.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95 group ${
                  isAnnouncementsOpen
                    ? 'border-[#E06518] bg-orange-50 text-[#E06518] ring-2 ring-[#E06518]/15'
                    : 'border-[#B5BDC6] bg-white hover:border-[#E06518] hover:bg-orange-50/40 text-[#2B313A] hover:text-[#E06518]'
                }`}
                title="اطلاعیه‌ها و اعلانات"
                aria-label="اطلاعیه‌ها و اعلانات"
                aria-expanded={isAnnouncementsOpen}
              >
                <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform group-hover:scale-105" />
                {visibleAnnouncements.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#E06518] text-white text-[9px] font-mono font-bold border border-white shadow-2xs">
                    {toPersianDigits(visibleAnnouncements.length)}
                  </span>
                )}
              </button>

              {/* پاپ‌آپ اطلاعیه‌ها دقیقاً زیر آیکون */}
              {isAnnouncementsOpen && (
                <div className="absolute left-0 top-full mt-2 w-[310px] sm:w-[360px] max-w-[calc(100vw-20px)] bg-white rounded-2xl shadow-2xl border border-[#CBD2D8] overflow-hidden z-50 text-right animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3.5 py-2.5 bg-[#2B313A] text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-[#E06518]" />
                      <span className="text-xs font-black">اطلاعیه‌ها و اعلانات</span>
                      {visibleAnnouncements.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#E06518] text-white text-[10px] font-mono font-bold">
                          {toPersianDigits(visibleAnnouncements.length)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAnnouncementsOpen(false)}
                      className="text-slate-300 hover:text-white p-0.5 rounded-lg transition-colors cursor-pointer"
                      aria-label="بستن اطلاعیه‌ها"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-[68vh] overflow-y-auto divide-y divide-slate-100">
                    {visibleAnnouncements.length === 0 ? (
                      <div className="p-6 text-center space-y-1.5">
                        <Bell className="w-6 h-6 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-600">اطلاعیه فعالی وجود ندارد</p>
                        <p className="text-[11px] text-slate-400">
                          جدیدترین اطلاعیه‌های فروش و تامین در این بخش قرار می‌گیرند.
                        </p>
                      </div>
                    ) : (
                      visibleAnnouncements.map(ann => {
                        const customerEndLabel =
                          ann.showEndTimeToCustomer && ann.endsAt
                            ? formatCustomerEndTime(ann.endsAt)
                            : null;
                        const portalBadge =
                          ann.portal === 'storefront'
                            ? 'عمومی وب‌سایت'
                            : ann.scope !== 'collective'
                              ? 'اختصاصی شما'
                              : ann.portal === 'high_volume'
                                ? 'پنل خرید بالا'
                                : 'پنل خرده‌فروش';

                        return (
                          <div
                            key={ann.id}
                            className="p-3.5 hover:bg-slate-50/80 transition-colors space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    ann.priority === 'urgent'
                                      ? 'bg-red-500 animate-pulse'
                                      : ann.priority === 'important'
                                        ? 'bg-amber-500'
                                        : 'bg-sky-500'
                                  }`}
                                />
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                  {ann.tag || portalBadge}
                                </span>
                                {ann.highlightValue && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                                    {ann.highlightValue}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {ann.createdAt}
                              </span>
                            </div>

                            <h4 className="text-xs font-black text-[#2B313A] leading-snug">
                              {ann.title}
                            </h4>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {ann.body}
                            </p>

                            {(customerEndLabel || (ann.actionLabel && ann.actionLink)) && (
                              <div className="pt-1.5 flex items-center justify-between gap-2 flex-wrap">
                                {customerEndLabel ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-md">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>اعتبار تا: {customerEndLabel}</span>
                                  </span>
                                ) : (
                                  <span />
                                )}

                                {ann.actionLabel && ann.actionLink && (
                                  <Link
                                    to={ann.actionLink}
                                    onClick={() => setIsAnnouncementsOpen(false)}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E06518] hover:text-[#C95210]"
                                  >
                                    <span>{ann.actionLabel}</span>
                                    <ArrowUpLeft className="w-3 h-3" />
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* علاقه‌مندی‌ها (نمایش در دسکتاپ) */}
            <Link
              to="/wishlist"
              className="hidden md:flex relative w-10.5 h-10.5 rounded-xl border border-[#B5BDC6] bg-white hover:border-[#E06518] hover:bg-orange-50/40 text-[#4A4E54] hover:text-[#E06518] items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95 group"
              title="علاقه‌مندی‌ها"
              aria-label="علاقه‌مندی‌ها"
            >
              <Heart className="w-4.5 h-4.5 text-[#4A4E54] group-hover:text-[#E06518] group-hover:scale-110 transition-all" />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#E06518] text-white text-[9px] font-mono font-bold border border-white shadow-2xs">
                  {toPersianDigits(wishlist.length)}
                </span>
              )}
            </Link>

            {/* آیکون سبد خرید (نمایش در دسکتاپ؛ در موبایل در نوار پایین صفحه قرار دارد) */}
            <Link
              to="/cart"
              className="hidden md:flex relative w-10.5 h-10.5 rounded-xl border border-[#B5BDC6] bg-white hover:border-[#E06518] hover:bg-orange-50/40 text-[#4A4E54] hover:text-[#E06518] items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95 group"
              title="سبد خرید"
              aria-label="سبد خرید"
            >
              <ShoppingCart className="w-4.5 h-4.5 text-[#4A4E54] group-hover:text-[#E06518] group-hover:scale-110 transition-all" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#E06518] text-white text-[9px] font-mono font-bold border border-white shadow-2xs">
                  {toPersianDigits(itemCount)}
                </span>
              )}
            </Link>

            {/* دکمه ورود و پروفایل (نمایش در دسکتاپ؛ در موبایل در نوار پایین صفحه قرار دارد) */}
            {currentUser ? (
              <div className="hidden md:block relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(prev => !prev)}
                  className="flex items-center gap-2 h-10.5 px-3 rounded-xl border border-[#B5BDC6] bg-white hover:border-[#E06518] hover:bg-orange-50/40 transition-all text-xs font-medium text-[#2B313A] cursor-pointer shadow-2xs group active:scale-95"
                >
                  <div className="w-6.5 h-6.5 rounded-lg bg-[#E06518]/12 text-[#E06518] font-black text-xs flex items-center justify-center shrink-0">
                    {currentUser.fullName ? currentUser.fullName.slice(0, 1) : 'ک'}
                  </div>
                  <span className="font-bold truncate max-w-[110px] text-[#2B313A] group-hover:text-[#E06518] transition-colors">
                    {currentUser.fullName.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#E06518] transition-colors" />
                </button>

                {/* User Dropdown */}
                {isUserMenuOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-white text-[#2B313A] rounded-2xl shadow-xl border border-[#CBD2D8] py-2 z-50 animate-in fade-in text-right">
                    <div className="px-4 py-3 border-b border-[#CBD2D8] bg-[#DEE2E5]/50">
                      <p className="text-xs font-bold text-[#2B313A]">مشتری گرامی: {currentUser?.fullName}</p>
                      <p className="text-[11px] text-[#777A7D] font-mono mt-0.5">{currentUser?.phone}</p>
                    </div>
                    <div className="py-1 text-xs">
                      {currentUser?.approvedB2B === true ? (
                        <Link
                          to="/account"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 hover:bg-orange-50 text-[#E06518] font-bold"
                        >
                          <Building className="w-4 h-4 text-[#E06518]" />
                          <span>پنل کاربری و سفارشات من</span>
                        </Link>
                      ) : (
                        <Link
                          to="/consumer-dashboard"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 text-[#2B313A] font-bold"
                        >
                          <User className="w-4 h-4 text-[#E06518]" />
                          <span>پنل کاربری و سفارشات من</span>
                        </Link>
                      )}

                      <Link
                        to="/agency"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="block px-4 py-2 hover:bg-slate-50 text-[#55565A]"
                      >
                        درخواست اخذ نمایندگی و عاملیت
                      </Link>

                      <button
                        onClick={() => {
                          logout();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-red-50 text-red-600 font-bold mt-1 border-t border-slate-100 cursor-pointer"
                      >
                        خروج از حساب
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal(undefined, 'login')}
                className="hidden md:flex items-center justify-center gap-2 h-10.5 px-3.5 rounded-xl border border-[#B5BDC6] bg-white hover:border-[#E06518] hover:bg-orange-50/40 text-[#2B313A] hover:text-[#E06518] transition-all text-xs font-bold cursor-pointer shadow-2xs group shrink-0 active:scale-95"
                title="ورود یا ثبت‌نام در سامانه صنعت پیش"
                aria-label="ورود یا ثبت‌نام"
              >
                <div className="w-6.5 h-6.5 rounded-lg bg-orange-50 group-hover:bg-[#E06518]/15 text-[#E06518] flex items-center justify-center transition-colors shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1 font-bold">
                  <span>ورود</span>
                  <span className="text-slate-300 font-light text-[11px]">|</span>
                  <span className="text-slate-700 group-hover:text-[#E06518] transition-colors">ثبت‌نام</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. SUBHEADER NAVIGATION ROW: Dark Industrial Nav Bar matching image.png exactly */}
      <div className="bg-[#2B313A] border-b border-slate-800 hidden lg:block text-xs text-white" ref={navBarRef}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          
          {/* Main Menus from Right to Left (matching image.png) */}
          <nav className="flex items-center gap-0.5 xl:gap-1 text-[11px] xl:text-xs font-medium text-white" dir="rtl">
            
            {/* 1. همه محصولات (Orange LayoutGrid icon + Down Chevron) */}
            <div className="relative" ref={megaMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsMegaMenuOpen(prev => !prev);
                  setActiveDropdown(null);
                }}
                onMouseEnter={() => {
                  setActiveDropdown(null);
                }}
                className={`flex items-center gap-1.5 py-3 px-2 xl:px-2.5 whitespace-nowrap rounded-lg hover:bg-white/5 transition-colors cursor-pointer group ${
                  isMegaMenuOpen ? 'text-[#E06518] bg-white/5' : 'text-white hover:text-[#E06518]'
                }`}
              >
                <LayoutGrid className="w-4 h-4 text-[#E06518] shrink-0" />
                <span className="font-bold">همه محصولات</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-[#E06518] transition-transform duration-200 ${
                    isMegaMenuOpen ? 'rotate-180 text-[#E06518]' : ''
                  }`}
                />
              </button>

              {/* Industrial MegaMenu Dropdown */}
              {isMegaMenuOpen && <ReferenceMegaMenu onNavigate={()=>setIsMegaMenuOpen(false)}/>}
            </div>



            {/* 2. صنایع و کاربردها (White Factory icon + Down Chevron) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'industries' ? null : 'industries');
                  setIsMegaMenuOpen(false);
                }}
                onMouseEnter={() => {
                  if (activeDropdown && activeDropdown !== 'industries') {
                    setActiveDropdown('industries');
                  }
                }}
                className={`flex items-center gap-1.5 py-3 px-2 xl:px-2.5 whitespace-nowrap rounded-lg hover:bg-white/5 transition-colors cursor-pointer group ${
                  activeDropdown === 'industries' ? 'text-[#E06518] bg-white/5' : 'text-white hover:text-[#E06518]'
                }`}
              >
                <Factory className="w-4 h-4 text-white group-hover:text-[#E06518] shrink-0 transition-colors" />
                <span>صنایع تحت پوشش</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-[#E06518] transition-transform duration-200 ${
                    activeDropdown === 'industries' ? 'rotate-180 text-[#E06518]' : ''
                  }`}
                />
              </button>

              {/* Industries Dropdown */}
              {activeDropdown === 'industries' && <IndustryNavigation onNavigate={()=>setActiveDropdown(null)}/> }
            </div>

            <Link to="/brands" onClick={()=>{setActiveDropdown(null);setIsMegaMenuOpen(false);}} className="flex items-center gap-1.5 py-3 px-2 xl:px-2.5 whitespace-nowrap rounded-lg hover:bg-white/5 hover:text-[#E06518] transition-colors text-white"><Tag className="w-4 h-4 text-[#E06518]"/><span>برندهای همکار</span></Link>

            {/* 4. خدمات صنعتی (White Wrench icon + Down Chevron) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'services' ? null : 'services');
                  setIsMegaMenuOpen(false);
                }}
                onMouseEnter={() => {
                  if (activeDropdown && activeDropdown !== 'services') {
                    setActiveDropdown('services');
                  }
                }}
                className={`flex items-center gap-1.5 py-3 px-2 xl:px-2.5 whitespace-nowrap rounded-lg hover:bg-white/5 transition-colors cursor-pointer group ${
                  activeDropdown === 'services' ? 'text-[#E06518] bg-white/5' : 'text-white hover:text-[#E06518]'
                }`}
              >
                <Wrench className="w-4 h-4 text-white group-hover:text-[#E06518] shrink-0 transition-colors" />
                <span>محاسبه‌گرهای فنی</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-[#E06518] transition-transform duration-200 ${
                    activeDropdown === 'services' ? 'rotate-180 text-[#E06518]' : ''
                  }`}
                />
              </button>

              {/* Services Dropdown */}
              {activeDropdown === 'services' && (
                <div className="absolute right-0 top-full w-76 bg-white text-[#55565A] rounded-b-2xl shadow-2xl border border-[#E3E5E6] p-3 z-50 animate-in fade-in duration-150 text-right">
                  <div className="text-[11px] font-bold text-[#777A7D] px-2 py-1 mb-1 border-b border-slate-100">
                    خدمات مهندسی و پشتیبانی اطلس
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        navigate('/ai-consult');
                      }}
                      className="w-full text-right p-2 rounded-lg hover:bg-orange-50 hover:text-[#E06518] text-xs transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-[#55565A] group-hover:text-[#E06518]">مشاوره تخصصی و مهندسی</div>
                        <div className="text-[10px] text-slate-500">انتخاب و محاسبه سایز تسمه و پولی</div>
                      </div>
                      <Sparkles className="w-4 h-4 text-[#E06518]" />
                    </button>

                    <Link
                      to="/inquiry"
                      onClick={() => setActiveDropdown(null)}
                      className="block p-2 rounded-lg hover:bg-orange-50 hover:text-[#E06518] text-xs transition-colors group"
                    >
                      <div className="font-bold text-[#55565A] group-hover:text-[#E06518]">استعلام قیمت و پیش‌فاکتور رسمی</div>
                      <div className="text-[10px] text-slate-500">صدور فاکتور با سامانه مودیان و ارزش افزوده</div>
                    </Link>

                    <Link
                      to="/dealer"
                      onClick={() => setActiveDropdown(null)}
                      className="block p-2 rounded-lg hover:bg-orange-50 hover:text-[#E06518] text-xs transition-colors group"
                    >
                      <div className="font-bold text-[#55565A] group-hover:text-[#E06518]">تأمین قطعات کارخانجات و صنایع</div>
                      <div className="text-[10px] text-slate-500">تأمین مستمر با قرارداد سازمانی سالیانه</div>
                    </Link>

                    <Link
                      to="/about"
                      onClick={() => setActiveDropdown(null)}
                      className="block p-2 rounded-lg hover:bg-orange-50 hover:text-[#E06518] text-xs transition-colors group"
                    >
                      <div className="font-bold text-[#55565A] group-hover:text-[#E06518]">تضمین اصالت و خدمات پس از فروش</div>
                      <div className="text-[10px] text-slate-500">گارانتی تعویض و تأییدیه فنی قطعات</div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 5. مشاوره تخصصی (Sparkles icon - direct link) */}
            <button
              type="button"
              onClick={() => navigate('/ai-consult')}
              onMouseEnter={() => setActiveDropdown(null)}
              className="flex items-center gap-1.5 py-3 px-2 xl:px-2.5 whitespace-nowrap rounded-lg hover:bg-white/5 hover:text-[#E06518] transition-colors cursor-pointer text-white group"
            >
              <Sparkles className="w-4 h-4 text-[#E06518] shrink-0" />
              <span>مشاوره تخصصی</span>
            </button>

            {/* 6. درباره اطلس (White User icon + Down Chevron) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'about' ? null : 'about');
                  setIsMegaMenuOpen(false);
                }}
                onMouseEnter={() => {
                  if (activeDropdown && activeDropdown !== 'about') {
                    setActiveDropdown('about');
                  }
                }}
                className={`flex items-center gap-1.5 py-3 px-2 xl:px-2.5 whitespace-nowrap rounded-lg hover:bg-white/5 transition-colors cursor-pointer group ${
                  activeDropdown === 'about' ? 'text-[#E06518] bg-white/5' : 'text-white hover:text-[#E06518]'
                }`}
              >
                <User className="w-4 h-4 text-white group-hover:text-[#E06518] shrink-0 transition-colors" />
                <span>درباره صنعت پیش</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-[#E06518] transition-transform duration-200 ${
                    activeDropdown === 'about' ? 'rotate-180 text-[#E06518]' : ''
                  }`}
                />
              </button>

              {/* About Dropdown */}
              {activeDropdown === 'about' && (
                <AboutNavigation onNavigate={()=>setActiveDropdown(null)}/>
              )}
            </div>



            {/* 7. دانشنامه (White BookOpen icon - NO Chevron, direct link) */}
            <Link
              to="/knowledge"
              onMouseEnter={() => setActiveDropdown(null)}
              className="flex items-center gap-1.5 py-3 px-2 xl:px-2.5 whitespace-nowrap rounded-lg hover:bg-white/5 hover:text-[#E06518] transition-colors cursor-pointer text-white"
            >
              <BookOpen className="w-4 h-4 text-white group-hover:text-[#E06518] shrink-0 transition-colors" />
              <span>دانشنامه</span>
            </Link>

          </nav>

          {/* Left: Hotline Support Badge with Pulse */}
          <div className="header-support-status flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap shrink-0" dir="rtl">
            <span className="text-slate-300 font-sans">پشتیبانی صنعتی:</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-white font-mono" dir="ltr">۰۳۵-۳۸۷۳۹۹۰۰</span>
          </div>
        </div>
      </div>

      {/* AI DYNAMIC VISUAL PART SEARCH MODAL */}

      {/* 5. AI DYNAMIC VISUAL PART SEARCH MODAL */}
      <AiVisualPartSearchModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
      />

      {/* 6. AI CONSULT MODAL */}
      <AiConsultModal
        isOpen={isConsultModalOpen}
        onClose={() => setIsConsultModalOpen(false)}
        onOpenVisualSearch={() => setIsCameraModalOpen(true)}
      />
    </header>
  );
};
