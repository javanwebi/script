import React, { useState } from 'react';
import {
  UserCheck,
  Phone,
  MessageCircle,
  AlertOctagon,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Shield,
  MapPin,
  ChevronLeft
} from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';

interface DedicatedEngineerCardProps {
  onOpenTicketWithEmergency?: () => void;
}

export const DedicatedEngineerCard: React.FC<DedicatedEngineerCardProps> = ({
  onOpenTicketWithEmergency
}) => {
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [visitSubmitted, setVisitSubmitted] = useState(false);
  const [visitFormData, setVisitFormData] = useState({
    plantUnit: 'فروشگاه / خط تولید شماره ۱',
    requestedDate: 'فردا ساعت ۱۰ صبح',
    notes: 'بررسی تطبیق گام پولی و تسمه و موجودی قفسه'
  });

  const handleBookVisit = (e: React.FormEvent) => {
    e.preventDefault();
    setVisitSubmitted(true);
    setTimeout(() => {
      setVisitSubmitted(false);
      setIsVisitModalOpen(false);
    }, 2500);
  };

  return (
    <>
      {/* Soft Frosted Glassmorphism Card */}
      <div className="bg-[#161B28]/90 backdrop-blur-md rounded-3xl p-5 border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)] relative overflow-hidden text-right transition-all hover:border-orange-500/30">
        {/* Soft background ambient glow */}
        <div className="absolute top-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500/20 to-orange-600/30 border border-orange-500/30 flex items-center justify-center text-[#FB923C] shadow-sm overflow-hidden">
                <UserCheck className="w-7 h-7 text-[#FB923C]" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#161B28] rounded-full shadow-xs" title="آنلاین و پاسخگو" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-white">مهندس محمدرضا میرجلیلی</h3>
                <span className="text-[10px] bg-orange-500/20 text-[#FB923C] border border-orange-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  کارشناس مهندسی و پشتیبانی حساب شما
                </span>
                <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>تضمین اصالت قطعات</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                سرپرست تیم مهندسی انتقال قدرت و امور همکاران اطلس (شعبه مرکزی یزد)
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                <span className="flex items-center gap-1 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>پاسخگویی سریع: کمتر از ۱۰ دقیقه</span>
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 font-mono">تلفن: ۰۳۵-۳۸۲۲۰۰۰۰</span>
              </div>
            </div>
          </div>

          {/* Quick Communication Actions in Frosted Glass Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="tel:03538220000"
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-white/10 hover:border-orange-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Phone className="w-3.5 h-3.5 text-[#FB923C]" />
              <span>تماس مستقیم</span>
            </a>

            <a
              href="https://wa.me/989131512345?text=%D8%B3%D9%84%D8%A7%D9%85%D8%8C%20%D8%AF%D8%B1%D8%AE%D9%88%D8%A7%D8%B3%D8%AA%20%D8%A7%D8%B3%D8%AA%D8%B9%D9%84%D8%A7%D9%85%20%D9%82%D8%B7%D8%B9%D8%A7%D8%AA%20%D9%81%D8%B1%D9%88%D8%B4%DA%AF%D8%A7%D9%87%20%D8%AF%D8%A7%D8%B1%D9%85"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>ارتباط واتساپ</span>
            </a>

            <button
              type="button"
              onClick={() => setIsVisitModalOpen(true)}
              className="px-3.5 py-2 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>درخواست اعزام کارشناس فنی</span>
            </button>
          </div>
        </div>

        {/* Emergency Stop Line Notice */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
            <span className="font-bold">
              توقف اضطراری خط تولید یا کسری فوری قفسه مغازه؟
            </span>
            <span className="text-slate-500 text-[11px] hidden md:inline">
              ارسال فوری قطعه با پیک اختصاصی از انبار مرکزی یزد
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenTicketWithEmergency}
            className="text-rose-600 hover:text-rose-700 font-bold text-xs underline cursor-pointer self-start sm:self-auto"
          >
            اعلام کسری اضطراری به شیفت انبار
          </button>
        </div>
      </div>

      {/* Modal: Book Plant Visit */}
      {isVisitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/80 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                <Calendar className="w-4 h-4 text-[#E06518]" />
                <span>درخواست کارشناسی و عارضه‌یابی حضوری</span>
              </div>
              <button
                type="button"
                onClick={() => setIsVisitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {visitSubmitted ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs space-y-2 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold">درخواست بازدید با موفقیت ثبت شد!</p>
                <p className="text-[11px] text-slate-600">
                  مهندس میرجلیلی تا حداکثر ۱ ساعت آینده جهت هماهنگی ساعت حضور با شما تماس خواهند گرفت.
                </p>
              </div>
            ) : (
              <form onSubmit={handleBookVisit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">نام فروشگاه یا خط تولید کارخانه:</label>
                  <input
                    type="text"
                    value={visitFormData.plantUnit}
                    onChange={e => setVisitFormData({ ...visitFormData, plantUnit: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#E06518]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">زمان پیشنهادی حضور مهندس:</label>
                  <input
                    type="text"
                    value={visitFormData.requestedDate}
                    onChange={e => setVisitFormData({ ...visitFormData, requestedDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#E06518]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">شرح قطعات، سایز تسمه‌ها یا نیاز فروشگاه:</label>
                  <textarea
                    rows={3}
                    value={visitFormData.notes}
                    onChange={e => setVisitFormData({ ...visitFormData, notes: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#E06518]"
                    required
                  />
                </div>

                <div className="p-3 bg-orange-50/60 border border-orange-200/80 rounded-xl text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-[#E06518] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>سرویس ویژه استان یزد و قطب‌های صنعتی:</span>
                  </div>
                  <p>بازدید کارشناسی برای همکاران دارای کرید و اعضای باشگاه رایگان است.</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsVisitModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#E06518] hover:bg-[#C95210] text-white font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    تأیید و ارسال به مهندس
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
