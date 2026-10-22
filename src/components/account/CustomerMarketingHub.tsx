import React, { useState } from 'react';
import {
  Share2,
  Gift,
  Copy,
  Check,
  Award,
  Users,
  Coins,
  Sparkles,
  Ticket,
  ExternalLink,
  MessageCircle,
  Send,
  ShoppingBag,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClubPoints } from '../../context/ClubPointsContext';
import { useCart } from '../../context/CartContext';
import { clubService, POINT_VALUE_TOMAN } from '../../services/clubService';
import { toPersianDigits, formatPrice } from '../../utils/formatters';
import { generateMockProducts } from '../../data/mockGenerator';

interface ActiveCoupon {
  code: string;
  title: string;
  discountPercent: number;
  maxDiscountToman: number;
  minOrderToman: number;
  expiresInDays: number;
  badge: string;
  categoryTag: string;
}

const ACTIVE_COUPONS: ActiveCoupon[] = [
  {
    code: 'OVERHAUL-1404',
    title: 'تخفیف ویژه دوره تعمیرات و اورهال خطوط تولید',
    discountPercent: 12,
    maxDiscountToman: 15000000,
    minOrderToman: 25000000,
    expiresInDays: 14,
    badge: 'ویژه فصل اورهال',
    categoryTag: 'تسمه و یاتاقان'
  },
  {
    code: 'FORZA-DIRECT',
    title: 'تخفیف سفارش مستقیم قطعات برند فورزا ایتالیا',
    discountPercent: 8,
    maxDiscountToman: 8000000,
    minOrderToman: 10000000,
    expiresInDays: 22,
    badge: 'تأمین کارخانه‌ای',
    categoryTag: 'FORZA'
  },
  {
    code: 'YAZD-CERAMIC',
    title: 'تخفیف ویژه واحدهای کاشی، سرامیک و لعاب',
    discountPercent: 10,
    maxDiscountToman: 12000000,
    minOrderToman: 20000000,
    expiresInDays: 9,
    badge: 'صنایع سرامیک',
    categoryTag: 'رولر و تسمه مدولار'
  }
];

export const CustomerMarketingHub: React.FC = () => {
  const { currentUser } = useAuth();
  const { points, tier, redeemPoints } = useClubPoints();
  const { addToCart } = useCart();

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [pointsRedeemedFeedback, setPointsRedeemedFeedback] = useState<string | null>(null);

  // Generate Referral Credentials
  const referralCode = currentUser?.phone
    ? 'ATLAS-' + currentUser.phone.slice(-4) + Math.floor(10 + Math.random() * 89)
    : 'ATLAS-VIP-8842';

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2500);
  };

  // Redeem Points to Cash Wallet
  const handleConvertPointsToCash = () => {
    if (points < 100) {
      alert('حداقل امتیاز برای تبدیل به اعتبار ریالی، ۱۰۰ امتیاز می‌باشد.');
      return;
    }
    const amount = points * POINT_VALUE_TOMAN;
    redeemPoints(points, `تبدیل ${points} امتیاز به اعتبار نقدی خرید`);
    setPointsRedeemedFeedback(`مبلغ ${formatPrice(amount)} به کیف پول اعتباری خرید شما اضافه شد!`);
    setTimeout(() => setPointsRedeemedFeedback(null), 4000);
  };

  // Mock list of referred peers
  const referredPeers = [
    {
      id: 'ref-1',
      company: 'صنایع لعاب مشهد (مهندس فراهانی)',
      joinedDate: '۱۴۰۳/۱۰/۰۲',
      status: 'خریدار فعال',
      totalPurchasesToman: 42000000,
      rewardEarnedToman: 840000
    },
    {
      id: 'ref-2',
      company: 'کاشی نیلوفر یزد (مهندس باقری)',
      joinedDate: '۱۴۰۳/۱۱/۱۴',
      status: 'خریدار فعال',
      totalPurchasesToman: 78000000,
      rewardEarnedToman: 1560000
    },
    {
      id: 'ref-3',
      company: 'ریسندگی و بافندگی یزدباف',
      joinedDate: '۱۴۰۳/۱۲/۲۰',
      status: 'عضو جدید',
      totalPurchasesToman: 15000000,
      rewardEarnedToman: 300000
    }
  ];

  const totalRewardEarned = referredPeers.reduce((sum, p) => sum + p.rewardEarnedToman, 0);

  // Targeted Deals based on factory category
  const mockCatalog = generateMockProducts();
  const targetedDeals = mockCatalog.slice(0, 3);

  return (
    <div className="space-y-6 text-right">
      {/* Hero Marketing Header */}
      <div className="bg-gradient-to-r from-[#2B313A] via-[#3A4350] to-[#2B313A] rounded-2xl p-6 text-white border border-slate-700 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#E06518]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#E06518] flex items-center justify-center text-white">
                <Gift className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-white">
                مرکز رشد، بازاریابی و پاداش‌های مشتریان صنعت پیش
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              با معرفی همکاران صنعتی و مدیران خرید دیگر کارخانجات، ۵۰۰٬۰۰۰ تومان اعتبار خرید بلاعوض و ۲٪ پاداش مادام‌العمر از تمامی سفارش‌های آنان دریافت نمایید. همچنین از تخفیف‌های اختصاصی رسته صنعتی خود بهره‌مند شوید.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/15 shrink-0">
            <Coins className="w-8 h-8 text-[#E06518]" />
            <div>
              <div className="text-[11px] text-slate-300">مجموع پاداش معرف شما:</div>
              <div className="text-lg font-black text-white font-mono">
                {formatPrice(totalRewardEarned)}
              </div>
              <span className="text-[10px] text-emerald-400 font-bold block">
                واریز شده به حساب اعتباری
              </span>
            </div>
          </div>
        </div>
      </div>

      {pointsRedeemedFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{pointsRedeemedFeedback}</span>
        </div>
      )}

      {/* Grid: 1. Referral Network + 2. Club Cash Points */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Referral System (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#CBD2D8] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-[#55565A]">
              <Share2 className="w-4 h-4 text-[#E06518]" />
              <span>سیستم معرفی همکاران صنعتی و کسب درآمد پایدار</span>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              ۲٪ پاداش نقدی سفارش‌ها
            </span>
          </div>

          <p className="text-xs text-[#777A7D] leading-relaxed">
            لینک یا کد معرف زیر را برای مدیران خرید، مسئولین فنی و کارخانجات همکار ارسال فرمایید. پس از اولین ثبت سفارش توسط آن‌ها، پاداش مستقیماً در فاکتورهای شما کسر یا نقداً تسویه می‌گردد:
          </p>

          {/* Referral Code & Link Box */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            {/* Direct Link */}
            <div>
              <label className="block text-[11px] font-bold text-[#55565A] mb-1">لینک اختصاصی دعوت:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  dir="ltr"
                  readOnly
                  value={referralLink}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-xs text-left select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-[#E06518] hover:bg-[#C95210] text-white font-bold rounded-lg flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'کپی شد' : 'کپی لینک'}</span>
                </button>
              </div>
            </div>

            {/* Referral Code */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#55565A]">کد معرف شما:</span>
                <span className="font-mono font-black text-sm text-[#E06518] bg-white px-3 py-1 rounded-lg border border-orange-200">
                  {referralCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded bg-white border border-slate-200 cursor-pointer"
                  title="کپی کد معرف"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Social Share Buttons */}
              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `سلام همکار گرامی، با استفاده از لینک زیر در سامانه صنعت پیش (بازرگانی اطلس) ثبت‌نام کنید و از تخفیف‌های ویژه خطوط تولید و ۵۰۰ هزار تومان اعتبار خرید اولیه بهره‌مند شوید:\n${referralLink}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>اشتراک در واتساپ</span>
                </a>

                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
                    `ثبت‌نام در سامانه تأمین قطعات صنعتی بازرگانی اطلس با ۵۰۰ هزار تومان اعتبار هدیه`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تلگرام</span>
                </a>
              </div>
            </div>
          </div>

          {/* Referred Peers List */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#55565A]">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#E06518]" />
                <span>همکاران دعوت‌شده توسط شما ({toPersianDigits(referredPeers.length)} کارخانه):</span>
              </span>
              <span className="text-[11px] text-[#777A7D]">تسویه خودکار در پایان هر ماه</span>
            </div>

            <div className="space-y-2">
              {referredPeers.map(peer => (
                <div
                  key={peer.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-[#55565A]">{peer.company}</div>
                    <div className="text-[10px] text-[#777A7D]">
                      عضویت: {peer.joinedDate} | وضعیت: <span className="text-emerald-700 font-bold">{peer.status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-left">
                    <div>
                      <div className="text-[10px] text-[#777A7D]">خرید کل: {formatPrice(peer.totalPurchasesToman)}</div>
                      <div className="font-mono font-black text-[#E06518] text-xs">
                        +{formatPrice(peer.rewardEarnedToman)} پاداش
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Club Points & Cash Conversion (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#CBD2D8] p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-[#55565A]">
                <Award className="w-4 h-4 text-[#E06518]" />
                <span>باشگاه مشتریان و تبدیل امتیاز به اعتبار</span>
              </div>
              <span className="text-xs font-bold text-[#E06518]">
                سطح {tier === 'gold' ? 'طلایی' : tier === 'silver' ? 'نقره‌ای' : 'برنزی'}
              </span>
            </div>

            {/* Current Balance Box */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200 text-right space-y-2">
              <span className="text-[11px] text-[#777A7D] font-bold">موجودی امتیاز باشگاه اطلس:</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#E06518] font-mono">{toPersianDigits(points)}</span>
                <span className="text-xs text-[#55565A] font-bold">امتیاز وفاداری</span>
              </div>
              <div className="text-xs text-slate-600">
                معادل نقدی: <strong className="text-emerald-700 font-mono">{formatPrice(points * POINT_VALUE_TOMAN)}</strong> در فاکتور رسمی
              </div>
            </div>

            <p className="text-[11px] text-[#777A7D] leading-relaxed">
              هر ۱ امتیاز معادل ۱٬۰۰۰ تومان است. شما می‌توانید در هر لحظه امتیازهای خود را به اعتبار نقدی کیف پول حساب کاربری انتقال داده و در خرید قطعات خرج نمایید.
            </p>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleConvertPointsToCash}
              className="w-full py-2.5 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
            >
              <Coins className="w-4 h-4" />
              <span>تبدیل آنی تمام امتیازها به اعتبار خرید</span>
            </button>

            <a
              href="/club"
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-[#55565A] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>مشاهده جزئیات کامل و قوانین باشگاه</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Active Exclusive Coupons Section */}
      <div className="bg-white rounded-2xl border border-[#CBD2D8] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-[#55565A]">
            <Ticket className="w-4 h-4 text-[#E06518]" />
            <span>کوپن‌ها و کدهای تخفیف فعال حساب شما (Industrial Promo Codes)</span>
          </div>
          <span className="text-xs text-[#777A7D]">اعمال در مرحله پیش‌فاکتور و تسویه حساب</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ACTIVE_COUPONS.map(coupon => {
            const isCopied = copiedCoupon === coupon.code;

            return (
              <div
                key={coupon.code}
                className="border-2 border-dashed border-orange-200 bg-orange-50/20 hover:bg-orange-50/50 p-4 rounded-xl space-y-3 text-xs transition-colors flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-[#E06518] text-white text-[10px] font-bold">
                      {coupon.badge}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-amber-700 font-bold">
                      <Clock className="w-3 h-3" />
                      <span>{toPersianDigits(coupon.expiresInDays)} روز مانده</span>
                    </span>
                  </div>

                  <h4 className="font-black text-[#55565A] text-xs pt-1">{coupon.title}</h4>
                  <div className="text-sm font-black text-[#E06518] font-mono">
                    {toPersianDigits(coupon.discountPercent)}٪ تخفیف فاکتور
                  </div>
                  <p className="text-[10px] text-[#777A7D]">
                    حداکثر تخفیف: {formatPrice(coupon.maxDiscountToman)} | حداقل سفارش: {formatPrice(coupon.minOrderToman)}
                  </p>
                </div>

                <div className="pt-2 border-t border-orange-100 flex items-center justify-between gap-2">
                  <span className="font-mono font-black text-xs text-[#55565A] bg-white px-2 py-1 rounded border border-slate-200">
                    {coupon.code}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCopyCoupon(coupon.code)}
                    className="px-3 py-1 bg-[#55565A] hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'کپی شد' : 'کپی کد'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
