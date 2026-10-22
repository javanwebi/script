import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, UserCheck, Phone, Lock, Building, FileText, Send, CheckCircle2, ArrowRight, Store, KeyRound, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const B2bVerificationGate: React.FC = () => {
  const { currentUser, openAuthModal, logout, loginAs, activateDealerRole } = useAuth();
  const [companyName, setCompanyName] = useState(currentUser?.companyName || '');
  const [economicCode, setEconomicCode] = useState(currentUser?.economicCode || '');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#F8FAFD] via-[#F1F5F9] to-[#EDF2F7] text-slate-800 py-8 px-4 flex items-center justify-center relative overflow-hidden">
      {/* Background Orbs */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-orange-200/40 via-amber-100/30 to-transparent rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[700px] h-[700px] bg-gradient-to-tr from-sky-200/30 via-indigo-100/20 to-transparent rounded-full blur-[160px] pointer-events-none" />

      {/* Tactile Dot Grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(rgba(100, 116, 139, 0.25) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="max-w-2xl w-full bg-white/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-white shadow-[0_15px_50px_rgba(0,0,0,0.06)] relative z-10 text-right space-y-6">
        {/* Header Icon & Title */}
        <div className="text-center space-y-3 border-b border-slate-100 pb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#E06518] to-amber-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 bg-orange-100 text-[#E06518] border border-orange-200/80 rounded-full text-xs font-black inline-block">
              پرتال اختصاصی اعتباری B2B کارخانجات و همکاران
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight pt-1">
              این پرتال ویژه مشتریان تعریف‌شده در پنل مدیریت است
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              این داشبورد مدیریت خرید چکی و حد اعتبار برای مشتریان خاصی است که توسط واحد بازرگانی کارخانجات اطلس کریدبندی و تعریف شده‌اند.
            </p>
          </div>
        </div>

        {/* Current User Status Banner */}
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-black text-sm">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>وضعیت حساب جاری شما ({currentUser?.fullName || 'کاربر مهمان'})</span>
          </div>
          <p className="leading-relaxed opacity-90">
            شماره تماس شما در لیست مشتریان اعتباری فعال ثبت نشده است یا حساب شما هنوز توسط مدیریت B2B کریدبندی نگردیده است.
          </p>
        </div>

        {/* Quick Demo Preview Banner for Testing */}
        <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="font-bold text-blue-900 block">مشاهده دمو و ارزیابی UI/UX پرتال B2B</span>
              <span className="text-[11px] text-blue-700">جهت تست رابط کاربری جدید داشبورد، با حساب نمایندگی وارد شوید.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => activateDealerRole()}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0 text-xs flex items-center gap-1"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>ورود به عنوان B2B دمو</span>
          </button>
        </div>

        {/* Main Options / Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Action 1: Login with Admin-Defined Credentials */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-white to-orange-50/50 border border-orange-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                <span className="p-1.5 rounded-xl bg-[#E06518] text-white">
                  <KeyRound className="w-4 h-4" />
                </span>
                <span>ورود با نام کاربری تعریف‌شده B2B</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                اگر مدیر سیستم در پنل مدیریت برای شما نام کاربری و رمز عبور B2B تعریف کرده است، وارد شوید.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openAuthModal('/account', 'login')}
              className="w-full py-2.5 px-3 bg-[#E06518] hover:bg-[#C95210] active:scale-95 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>ورود با شناسه و رمز تعریف‌شده B2B</span>
            </button>
          </div>

          {/* Action 2: Contact Sales Supervisor */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                <span className="p-1.5 rounded-xl bg-emerald-600 text-white">
                  <Phone className="w-4 h-4" />
                </span>
                <span>تماس مستقیم با سرپرست B2B</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                جهت بررسی وضعیت کریدبندی، تعریف سقف چک صیادی و صدور دسترسی با مهندس زارع تماس بگیرید.
              </p>
            </div>

            <a
              href="tel:09131518420"
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 text-center"
            >
              <Phone className="w-4 h-4" />
              <span>تماس تلفنی با مهندس زارع (۰۹۱۳-۱۵۱-۸۴۲۰)</span>
            </a>
          </div>
        </div>

        {/* Verification Form for Admin Review */}
        <div className="pt-2 border-t border-slate-100">
          {submitted ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="font-black text-sm">درخواست کریدبندی B2B شما با موفقیت ثبت شد</h3>
              <p className="text-xs text-emerald-700">
                اطلاعات فروشگاه/کارخانه شما جهت بررسی و تعریف سقف اعتبار چکی به واحد مدیریت CRM ارسال شد. به محض فعال‌سازی، پیامک حاوی شناسه ورود ارسال خواهد شد.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitRequest} className="space-y-3 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-[#E06518]" />
                  <span>ثبت درخواست اعتبار B2B و تعریف حساب برای کارخانه / مغازه</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">بررسی ۲۴ ساعته</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">نام شرکت / فروشگاه:</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="مثلا کاشی ستاره میبد / ابزار پارس..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">کد اقتصادی / شناسه ملی:</label>
                  <input
                    type="text"
                    value={economicCode}
                    onChange={e => setEconomicCode(e.target.value)}
                    placeholder="کد اقتصادی ۱۰ یا ۱۲ رقمی..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">توضیحات و رده خرید متداول:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="توضیحات در خصوص حجم خرید ماهانه تسمه، بلبرینگ یا قطعات خطوط تولید..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  خروج از این حساب
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ثبت درخواست کریدبندی B2B</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="pt-2 text-center border-t border-slate-100 flex items-center justify-between text-xs">
          <Link to="/" className="font-bold text-[#E06518] hover:underline flex items-center gap-1">
            <Store className="w-4 h-4" />
            <span>بازگشت به کاتالوگ و فروشگاه اصلی</span>
          </Link>

          <span className="text-[11px] text-slate-400">بازرگانی و کارخانجات اطلس</span>
        </div>
      </div>
    </div>
  );
};
