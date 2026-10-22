import React, { useState } from 'react';
import {
  Wrench,
  Upload,
  CheckCircle2,
  X,
  FileText,
  Phone,
  Building2,
  Layers,
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CustomPartRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomPartRequestModal: React.FC<CustomPartRequestModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser } = useAuth();

  const [partName, setPartName] = useState('');
  const [partType, setPartType] = useState('پولی و بوش تاپیر');
  const [dimensions, setDimensions] = useState('');
  const [alloyCondition, setAlloyCondition] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [companyName, setCompanyName] = useState(currentUser?.companyName || '');
  const [contactName, setContactName] = useState(currentUser?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phone || '');
  const [notes, setNotes] = useState('');

  const [fileName, setFileName] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim() || !phoneNumber.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      // Generate a realistic Iranian engineering tracking code
      const code = `SP-MFG-${Math.floor(100000 + Math.random() * 900000)}`;
      setTrackingCode(code);
      setIsSubmitting(false);
    }, 800);
  };

  const handleCopyCode = () => {
    if (trackingCode) {
      navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setPartName('');
    setDimensions('');
    setAlloyCondition('');
    setQuantity('1');
    setNotes('');
    setFileName(null);
    setFilePreview(null);
    setTrackingCode(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Metallic Orange Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#C95210] via-[#E06518] to-orange-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-[#F8F9FA]/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-[#E06518] border border-orange-500/20 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-[#E06518]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#E06518]">
                <Sparkles className="w-3 h-3" />
                <span>کارگاه ساخت سفارشی و مهندسی معکوس</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-[#2B313A]">
                سفارش ساخت قطعه اختصاصی (قطعات ناموجود در سایت)
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={resetForm}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-7 max-h-[80vh] overflow-y-auto">
          {trackingCode ? (
            /* SUCCESS STATE */
            <div className="text-center py-6 space-y-5 animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-lg font-black text-[#2B313A]">
                  درخواست ساخت قطعه با موفقیت ثبت شد
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  مهندسان متالوژی و کارگاه ساخت صنعت‌پیش نقشه و ابعاد قطعه <span className="font-bold text-[#E06518]">«{partName}»</span> را بررسی کرده و ظرف حداکثر ۲ ساعت کاری جهت برآورد هزینه و زمان تحویل با شما تماس خواهند گرفت.
                </p>
              </div>

              {/* Tracking Code Box */}
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-slate-200 max-w-sm mx-auto space-y-2">
                <span className="text-[11px] font-bold text-slate-500">کد پیگیری سفارش ساخت:</span>
                <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-200">
                  <span className="font-mono text-base font-black text-[#E06518]" dir="ltr">
                    {trackingCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1.5 text-slate-400 hover:text-[#E06518] rounded-lg transition-colors flex items-center gap-1 text-xs"
                    title="کپی کد"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span className="text-[11px] font-bold">{copied ? 'کپی شد' : 'کپی'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-11 px-6 rounded-xl bg-[#2B313A] hover:bg-[#E06518] text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  متوجه شدم، بستن پنجره
                </button>
              </div>
            </div>
          ) : (
            /* SUBMISSION FORM */
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Informational Guidance Ribbon */}
              <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200/80 flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-[#E06518] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#E06518] font-bold">تضمین ۱۰۰٪ انطباق آلیاژ و کارکرد:</strong> هر قطعه‌ای که نمونه آن در خط تولید فرسوده شده یا به دلیل تحریم نایاب است، با آزمون سختی‌سنجی و استاندارد متالوژی صنعتی ساخته می‌شود.
                </div>
              </div>

              {/* Row 1: Part Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1">
                    <span>نام یا عنوان قطعه</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    placeholder="مثال: پولی ۶ تسمه سفارشی، رولر سیلیکونی کوره، چرخ‌دنده..."
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FA] border border-slate-200 focus:border-[#E06518] focus:bg-white text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">نوع یا رده فنی قطعه</label>
                  <select
                    value={partType}
                    onChange={(e) => setPartType(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FA] border border-slate-200 focus:border-[#E06518] focus:bg-white text-xs text-slate-800 outline-none transition-all cursor-pointer"
                  >
                    <option value="پولی و بوش تاپیر">پولی و بوش تاپیر (V-Pulley / Timing)</option>
                    <option value="رولر نسوز و آلومینایی کوره">رولر نسوز و آلومینایی کوره پخت</option>
                    <option value="چرخ‌دنده و زنجیر صنعتی">چرخ‌دنده و زنجیر صنعتی ضدسایش</option>
                    <option value="کوپلینگ و هاب انعطاف‌پذیر">کوپلینگ و هاب انعطاف‌پذیر</option>
                    <option value="شفت و بوش دقیق CNC">شفت و بوش دقیق تراشکاری CNC</option>
                    <option value="سایر قطعات مکانیکی خاص">سایر قطعات مکانیکی خاص خط تولید</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Dimensions & Alloy / Working Conditions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">ابعاد اصلی یا مشخصات ظاهری</label>
                  <input
                    type="text"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    placeholder="قطر بیرونی، سوراخ شفت، تعداد تسمه، گام..."
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FA] border border-slate-200 focus:border-[#E06518] focus:bg-white text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">آلیاژ دلخواه یا شرایط کاری</label>
                  <input
                    type="text"
                    value={alloyCondition}
                    onChange={(e) => setAlloyCondition(e.target.value)}
                    placeholder="مثال: چدن داکتیل، استیل ۳۱۶، دمای ۹۵۰ درجه، دور بالا..."
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FA] border border-slate-200 focus:border-[#E06518] focus:bg-white text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Row 3: Upload Blueprint or Photo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>فایل نقشه، مدل سه‌بعدی یا عکس قطعه فرسوده (اختیاری)</span>
                  <span className="text-[11px] text-slate-400 font-normal">CAD, PDF, JPG, PNG</span>
                </label>
                
                <label className="border-2 border-dashed border-slate-300 hover:border-[#E06518] rounded-2xl p-4 bg-slate-50/50 hover:bg-orange-50/30 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center group">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.dwg,.dxf,.step,.stp,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                  />
                  <Upload className="w-6 h-6 text-slate-400 group-hover:text-[#E06518] group-hover:-translate-y-0.5 transition-all" />
                  
                  {fileName ? (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-800 block">{fileName}</span>
                      <span className="text-[11px] text-emerald-600 font-bold">فایل انتخاب شد (برای تغییر کلیک کنید)</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-bold text-slate-700 group-hover:text-[#E06518] transition-colors block">
                        برای بارگذاری عکس یا نقشه کلیک کنید
                      </span>
                      <span className="text-[11px] text-slate-400">یا فایل را به اینجا بکشید</span>
                    </div>
                  )}

                  {filePreview && (
                    <img
                      src={filePreview}
                      alt="پیش‌نمایش قطعه"
                      className="w-20 h-20 object-cover rounded-xl border border-slate-200 mt-1 shadow-2xs"
                    />
                  )}
                </label>
              </div>

              {/* Row 4: Quantity & Company Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">تعداد / تیراژ ساخت</label>
                  <input
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="مثال: ۲ عدد یا تیراژ ۵۰"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FA] border border-slate-200 focus:border-[#E06518] focus:bg-white text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 text-center font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">نام شرکت / کارخانه</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="نام کارخانه یا کارگاه صنعتی"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FA] border border-slate-200 focus:border-[#E06518] focus:bg-white text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1">
                    <span>شماره موبایل هماهنگی</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="۰۹۱۲..."
                    dir="ltr"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FA] border border-slate-200 focus:border-[#E06518] focus:bg-white text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 text-right font-mono"
                  />
                </div>
              </div>

              {/* Row 5: Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">توضیحات تکمیلی یا الزامات خاص</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: زمان‌بندی تحویل اورژانسی است، کوره در حال تعمیرات است، یا نیاز به حضور کارشناس در محل..."
                  className="w-full p-3 rounded-xl bg-[#F8F9FA] border border-slate-200 focus:border-[#E06518] focus:bg-white text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#C95210] to-[#E06518] hover:from-[#C2410C] hover:to-[#C95210] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all cursor-pointer hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">در حال ثبت در کارگاه ساخت...</span>
                  ) : (
                    <>
                      <span>ارسال درخواست و برآورد زمان و هزینه ساخت</span>
                      <ArrowLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
};
