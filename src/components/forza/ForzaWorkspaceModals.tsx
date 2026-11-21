import React, { useState } from 'react';
import { X, Settings, Trash2, Check, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';
import { DinCalculatorIcon } from './ForzaWorkspaceIcons';

export interface IndustryDomainOption {
  id: string;
  label: string;
}

interface DinCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  calcC: string;
  calcD: string;
  calcd: string;
  onChangeC: (val: string) => void;
  onChangeD: (val: string) => void;
  onChanged: (val: string) => void;
  calcResult: { length: number; ratio: number } | null;
  onApplyToChat: (length: number, ratio: number) => void;
}

export const DinCalculatorModal: React.FC<DinCalculatorModalProps> = ({
  isOpen,
  onClose,
  calcC,
  calcD,
  calcd,
  onChangeC,
  onChangeD,
  onChanged,
  calcResult,
  onApplyToChat,
}) => {
  if (!isOpen) return null;

  const numC = parseFloat(calcC);
  const numD = parseFloat(calcD);
  const numd = parseFloat(calcd);
  const hasInvalidOrder = !isNaN(numD) && !isNaN(numd) && numD > 0 && numd > 0 && numD < numd;

  // Dynamic schematic proportions calibrated to user inputs
  const safeD = !isNaN(numD) && numD > 0 ? numD : 200;
  const safed = !isNaN(numd) && numd > 0 ? numd : 100;
  const ratioVisual = Math.max(0.32, Math.min(1, safed / safeD));
  const largeR = 26;
  const smallR = Math.round(largeR * ratioVisual);
  const cy = 44;
  const x1 = 62;
  const x2 = 238;

  return (
    <div
      className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#181C22]/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="din-calc-title"
      onClick={onClose}
    >
      <div
        className="bg-[#FFFFFF] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-[#DCE1E7] space-y-4 text-right max-h-[92dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-[#CBD2D8] mx-auto -mt-1 mb-1 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-[#EEF1F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF4EC] border border-[#F8D3B8] text-[#E06518] flex items-center justify-center shrink-0">
              <DinCalculatorIcon size={21} />
            </div>
            <div>
              <h3 id="din-calc-title" className="font-extrabold text-sm text-[#181C22]">
                محاسبه‌گر طول اسمی تسمه و نسبت دور
              </h3>
              <span className="text-[11px] text-[#777A7D] font-mono">DIN 2215 · ISO 4184</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن محاسبه‌گر"
            className="min-w-[40px] min-h-[40px] rounded-xl text-[#55565A] hover:text-[#181C22] hover:bg-[#F3F5F8] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Live Calibrated Engineering Schematic */}
        <div className="rounded-xl bg-[#F7F8FA] border border-[#E2E6EC] p-3" dir="ltr">
          <svg viewBox="0 0 300 100" className="w-full h-22" aria-hidden="true">
            {/* Subtle drafting axis */}
            <line x1="20" y1={cy} x2="280" y2={cy} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="2 3" />
            {/* Center distance caliper line */}
            <line x1={x1} y1="82" x2={x2} y2="82" stroke="#94A3B8" strokeWidth="1.25" strokeDasharray="3 3" />
            <line x1={x1} y1="76" x2={x1} y2="88" stroke="#64748B" strokeWidth="1.5" />
            <line x1={x2} y1="76" x2={x2} y2="88" stroke="#64748B" strokeWidth="1.5" />
            {/* Belt tangent lines */}
            <line x1={x1} y1={cy - largeR} x2={x2} y2={cy - smallR} stroke="#E06518" strokeWidth="2.4" strokeLinecap="round" />
            <line x1={x1} y1={cy + largeR} x2={x2} y2={cy + smallR} stroke="#E06518" strokeWidth="2.4" strokeLinecap="round" />
            {/* Large Pulley D */}
            <circle cx={x1} cy={cy} r={largeR} fill="#FFFFFF" stroke="#1F242D" strokeWidth="2.1" />
            <circle cx={x1} cy={cy} r={largeR - 5} fill="none" stroke="#E2E8F0" strokeWidth="1" />
            <circle cx={x1} cy={cy} r="5.5" fill="#F7F8FA" stroke="#55565A" strokeWidth="1.4" />
            {/* Small Pulley d */}
            <circle cx={x2} cy={cy} r={smallR} fill="#FFFFFF" stroke="#1F242D" strokeWidth="2.1" />
            <circle cx={x2} cy={cy} r={Math.max(3.5, smallR * 0.25)} fill="#F7F8FA" stroke="#55565A" strokeWidth="1.4" />
            {/* Labels */}
            <text x={x1} y={cy - largeR - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1F242D">
              D = {isNaN(numD) ? '—' : numD}
            </text>
            <text x={x2} y={cy - smallR - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1F242D">
              d = {isNaN(numd) ? '—' : numd}
            </text>
            <rect x="118" y="73" width="64" height="17" rx="4" fill="#FFFFFF" stroke="#DCE1E7" />
            <text x="150" y="85" textAnchor="middle" fontSize="10" fontWeight="700" fill="#C95210">
              C = {isNaN(numC) ? '—' : numC}
            </text>
          </svg>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label htmlFor="din-calc-c" className="text-[#4B5563] font-bold block mb-1.5">
              فاصله مراکز دو شفت (C)
            </label>
            <div className="relative">
              <input
                id="din-calc-c"
                type="number"
                inputMode="decimal"
                value={calcC}
                onChange={(e) => onChangeC(e.target.value)}
                className="w-full h-11 px-12 bg-[#F7F8FA] border border-[#DCE1E7] rounded-xl font-mono tabular-nums text-center text-[#181C22] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#E06518] font-bold text-sm transition-colors"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[#777A7D] pointer-events-none">
                mm
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="din-calc-d-large" className="text-[#4B5563] font-bold block mb-1.5">
                قطر پولی بزرگ (D)
              </label>
              <div className="relative">
                <input
                  id="din-calc-d-large"
                  type="number"
                  inputMode="decimal"
                  value={calcD}
                  onChange={(e) => onChangeD(e.target.value)}
                  className="w-full h-11 px-10 bg-[#F7F8FA] border border-[#DCE1E7] rounded-xl font-mono tabular-nums text-center text-[#181C22] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#E06518] font-bold text-sm transition-colors"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[#777A7D] pointer-events-none">
                  mm
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="din-calc-d-small" className="text-[#4B5563] font-bold block mb-1.5">
                قطر پولی کوچک (d)
              </label>
              <div className="relative">
                <input
                  id="din-calc-d-small"
                  type="number"
                  inputMode="decimal"
                  value={calcd}
                  onChange={(e) => onChanged(e.target.value)}
                  className="w-full h-11 px-10 bg-[#F7F8FA] border border-[#DCE1E7] rounded-xl font-mono tabular-nums text-center text-[#181C22] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#E06518] font-bold text-sm transition-colors"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[#777A7D] pointer-events-none">
                  mm
                </span>
              </div>
            </div>
          </div>

          {hasInvalidOrder && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>قطر پولی بزرگ (D) باید بزرگتر یا مساوی پولی کوچک (d) باشد.</span>
            </div>
          )}

          {calcResult && (
            <div className="p-4 bg-[#F7F8FA] border border-[#DCE1E7] rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg p-2.5 text-center">
                  <span className="block text-[10px] font-semibold text-[#777A7D]">طول اسمی تسمه (Lp)</span>
                  <span className="mt-0.5 block font-mono tabular-nums font-black text-base text-[#E06518]">
                    {toPersianDigits(calcResult.length)} mm
                  </span>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg p-2.5 text-center">
                  <span className="block text-[10px] font-semibold text-[#777A7D]">نسبت دور (Ratio)</span>
                  <span className="mt-0.5 block font-mono tabular-nums font-black text-base text-[#181C22]">
                    ۱ : {toPersianDigits(calcResult.ratio)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onApplyToChat(calcResult.length, calcResult.ratio)}
                className="w-full min-h-[42px] py-2.5 px-4 bg-[#E06518] hover:bg-[#C95210] active:scale-[0.99] text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span>ارسال مقادیر به مشاور FORZA</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  industries: IndustryDomainOption[];
  selectedIndustry: string;
  onSelectIndustry: (id: string) => void;
  calculationStandard: 'din' | 'fast';
  onChangeCalculationStandard: (mode: 'din' | 'fast') => void;
  onClearAllHistory: () => void;
}

export const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({
  isOpen,
  onClose,
  industries,
  selectedIndustry,
  onSelectIndustry,
  calculationStandard,
  onChangeCalculationStandard,
  onClearAllHistory,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setConfirmClear(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#181C22]/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-settings-title"
      onClick={handleClose}
    >
      <div
        className="bg-[#FFFFFF] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-[#DCE1E7] space-y-4 text-right max-h-[92dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-[#CBD2D8] mx-auto -mt-1 mb-1 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-[#EEF1F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F7F8FA] border border-[#DCE1E7] text-[#E06518] flex items-center justify-center shrink-0">
              <Settings className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 id="workspace-settings-title" className="font-extrabold text-sm text-[#181C22]">
                تنظیمات میزکار FORZA
              </h3>
              <span className="text-[11px] text-[#777A7D]">شخصی‌سازی حوزه صنعتی و استاندارد تحلیل</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="بستن تنظیمات"
            className="min-w-[40px] min-h-[40px] rounded-xl text-[#55565A] hover:text-[#181C22] hover:bg-[#F3F5F8] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label htmlFor="workspace-industry-select" className="text-[#4B5563] font-bold block mb-1.5">
              حوزه تخصصی کارخانه یا واحد صنعتی
            </label>
            <select
              id="workspace-industry-select"
              value={selectedIndustry}
              onChange={(e) => onSelectIndustry(e.target.value)}
              className="w-full h-11 px-3 bg-[#F7F8FA] border border-[#DCE1E7] rounded-xl font-semibold text-[#181C22] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#E06518]"
            >
              {industries.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#777A7D] mt-1.5 leading-relaxed">
              پیشنهادها و استانداردهای مرجع بر اساس خط تولید انتخابی شما اولویت‌بندی می‌شوند.
            </p>
          </div>

          <div>
            <span className="text-[#4B5563] font-bold block mb-1.5">سطح تحلیل و محاسبات مهندسی</span>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F3F5F8] rounded-xl border border-[#E2E6EC]">
              <button
                type="button"
                onClick={() => onChangeCalculationStandard('din')}
                className={calculationStandard === 'din' ? 'min-h-[40px] px-3 py-2 rounded-lg text-center font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 whitespace-nowrap bg-[#FFFFFF] text-[#C95210] shadow-2xs border border-[#DCE1E7]' : 'min-h-[40px] px-3 py-2 rounded-lg text-center font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 whitespace-nowrap text-[#55565A] hover:text-[#181C22]'}
              >
                {calculationStandard === 'din' && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span>استاندارد DIN 2215</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeCalculationStandard('fast')}
                className={calculationStandard === 'fast' ? 'min-h-[40px] px-3 py-2 rounded-lg text-center font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 whitespace-nowrap bg-[#FFFFFF] text-[#C95210] shadow-2xs border border-[#DCE1E7]' : 'min-h-[40px] px-3 py-2 rounded-lg text-center font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 whitespace-nowrap text-[#55565A] hover:text-[#181C22]'}
              >
                {calculationStandard === 'fast' && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span>استعلام سریع کارگاهی</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-[#EEF1F5]">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="w-full min-h-[42px] py-2 px-3 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>پاک‌سازی تاریخچه گفتگوهای ذخیره‌شده</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 space-y-2.5">
                <p className="text-[11px] font-bold text-rose-800">
                  تمامی گفتگوها و فهرست قطعات انتخابی پاک خواهد شد. ادامه می‌دهید؟
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmClear(false);
                      onClearAllHistory();
                    }}
                    className="min-h-[38px] rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                  >
                    بله، پاک شود
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[38px] rounded-lg bg-white border border-[#DCE1E7] text-[#2B313A] font-bold text-xs cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-full min-h-[44px] py-2.5 bg-[#E06518] hover:bg-[#C95210] text-white font-bold rounded-xl text-center cursor-pointer transition-colors"
          >
            ذخیره و بازگشت به میزکار
          </button>
        </div>
      </div>
    </div>
  );
};