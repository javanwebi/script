import React from 'react';
import { Phone, MessageCircle, X, ShieldCheck, UserCheck, Clock, MapPin, Calendar, AlertOctagon } from 'lucide-react';

interface AccountMobileSupportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestTicket: (subject: string) => void;
}

export const AccountMobileSupportSheet: React.FC<AccountMobileSupportSheetProps> = ({
  isOpen,
  onClose,
  onRequestTicket,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#161B26]/95 backdrop-blur-2xl text-slate-200 rounded-t-3xl p-5 border-t border-white/10 shadow-2xl max-w-lg mx-auto w-full space-y-4 text-right animate-in slide-in-from-bottom duration-200">
        {/* Handle Bar */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto -mt-1 mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#E06518] to-orange-400 text-white flex items-center justify-center font-black text-sm shadow-md shadow-orange-500/20">
              ز
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-white">مهندس حمیدرضا زارع</h3>
                <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full">
                  آنلاین در انبار یزد
                </span>
              </div>
              <p className="text-[11px] text-slate-400">سرپرست امور عاملیت‌ها و پخش عمده بازرگانی اطلس</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Contact Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Direct Phone Call */}
          <a
            href="tel:09131518420"
            className="p-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all text-center"
          >
            <Phone className="w-5 h-5" />
            <span>تماس صوتی مستقیم</span>
            <span className="text-[10px] font-mono opacity-90 dir-ltr">۰۹۱۳-۱۵۱-۸۴۲۰</span>
          </a>

          {/* WhatsApp / Chat */}
          <a
            href="https://wa.me/989131518420?text=%D8%B3%D9%84%D8%A7%D9%85%D8%8C%20%D8%A7%D8%B3%D8%AA%D8%B9%D9%84%D8%A7%D9%85%20%D9%82%D8%B7%D8%B9%D9%87%20%D9%88%20%D8%B3%D9%81%D8%A7%D8%B1%D8%B4%20%DA%A9%D8%A7%D8%B1%D8%AA%D9%86%20%D9%82%D9%81%D8%B3%D9%87%20%D9%81%D8%B1%D9%88%D8%B4%DA%A9%D8%A7%D9%87%20%D8%AF%D8%A7%D8%B4%D8%AA%D9%85"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all text-center"
          >
            <MessageCircle className="w-5 h-5" />
            <span>ارسال پیام در واتساپ</span>
            <span className="text-[10px] opacity-90">پاسخگویی سریع کمتر از ۵ دقیقه</span>
          </a>
        </div>

        {/* Specialized Retail Action Triggers */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onRequestTicket('درخواست بارگیری اضطراری کارتن تسمه و بلبرینگ برای مغازه');
              onClose();
            }}
            className="w-full p-3 bg-slate-800/60 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/30 rounded-2xl text-right flex items-center justify-between text-xs font-bold text-slate-200 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-[#FB923C]" />
              <span>بارگیری اضطراری (همان‌روز با باربری وطن)</span>
            </div>
            <span className="text-[10px] bg-orange-500/20 text-[#FB923C] border border-orange-500/30 px-2 py-0.5 rounded-full">فوری</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onRequestTicket('درخواست بازدید میدانی کارشناس و تجهیز استند قفسه مغازه');
              onClose();
            }}
            className="w-full p-3 bg-slate-800/60 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/30 rounded-2xl text-right flex items-center justify-between text-xs font-bold text-slate-200 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>هماهنگی بازدید و تحویل استند فلزی رایگان</span>
            </div>
            <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">رایگان</span>
          </button>
        </div>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
