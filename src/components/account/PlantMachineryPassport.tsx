import {durableStorage} from "../../services/durableStorage";
import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Settings,
  Wrench,
  Activity,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { Product } from '../../types';
import { toPersianDigits, formatPrice } from '../../utils/formatters';
import { useCart } from '../../context/CartContext';
import { generateMockProducts, getProductByCode } from '../../data/mockGenerator';

export interface MachinePartItem {
  id: string;
  productCode: string;
  name: string;
  brand: string;
  quantityPerMachine: number;
  unit: string;
  installedDate: string;
  estimatedLifeHours: number;
  currentHours: number;
  status: 'healthy' | 'warning' | 'critical';
  notes?: string;
}

export interface PlantMachine {
  id: string;
  name: string;
  section: string; // e.g. "سالن پرس", "خط پخت کوره", "خط بسته‌بندی", "آماده‌سازی مواد"
  modelNumber: string;
  manufacturer: string;
  installedYear: string;
  operatingShift: 'single' | 'double' | 'three_shifts';
  parts: MachinePartItem[];
}

const STORAGE_KEY = 'atlas_plant_machinery_passport_v1';

const DEFAULT_MACHINES: PlantMachine[] = [
  {
    id: 'mach-1',
    name: 'خط کوره رولری پخت سریع کاشی پرسلان',
    section: 'سالن کوره شماره ۲',
    modelNumber: 'SACMI FBN-2950',
    manufacturer: 'ساکمی (ایتالیا)',
    installedYear: '۱۳۹۸',
    operatingShift: 'three_shifts',
    parts: [
      {
        id: 'p-1',
        productCode: 'SWR-SPC-3550',
        name: 'تسمه V-Belt اسپشیال ضد سایش و حرارت',
        brand: 'SWR آلمان',
        quantityPerMachine: 4,
        unit: 'حلقه',
        installedDate: '۱۴۰۳/۰۶/۱۰',
        estimatedLifeHours: 4000,
        currentHours: 3450,
        status: 'warning',
        notes: 'بررسی کشش تسمه در دوره اورهال آبان‌ماه'
      },
      {
        id: 'p-2',
        productCode: 'FORZA-TIM-8M-1200',
        name: 'تسمه تایم دندانه‌دار مداربسته FORZA',
        brand: 'FORZA ایتالیا',
        quantityPerMachine: 2,
        unit: 'حلقه',
        installedDate: '۱۴۰۳/۰۹/۰۱',
        estimatedLifeHours: 5000,
        currentHours: 1800,
        status: 'healthy',
        notes: 'کارکرد روان بدون لقی'
      },
      {
        id: 'p-3',
        productCode: 'BRG-NSK-6208-2RS',
        name: 'بلبرینگ شیارعمیق دور بالا NSK با آب‌بند ضد گردوغبار',
        brand: 'NSK ژاپن',
        quantityPerMachine: 8,
        unit: 'عدد',
        installedDate: '۱۴۰۳/۰۴/۱۵',
        estimatedLifeHours: 6000,
        currentHours: 4800,
        status: 'warning',
        notes: 'روانکاری مجدد با گریس نسوز پایه لیتیوم'
      }
    ]
  },
  {
    id: 'mach-2',
    name: 'پرس هیدرولیک قالب ۵۰۰۰ تن',
    section: 'سالن شکل‌دهی و پرس',
    modelNumber: 'PH-5000 SACMI',
    manufacturer: 'SACMI',
    installedYear: '۱۴۰۰',
    operatingShift: 'three_shifts',
    parts: [
      {
        id: 'p-4',
        productCode: 'CPL-ROTEX-48',
        name: 'کوپلینگ انعطاف‌پذیر پلی‌اورتان ضد ارتعاش',
        brand: 'FORZA',
        quantityPerMachine: 1,
        unit: 'ست',
        installedDate: '۱۴۰۳/۱۰/۰۵',
        estimatedLifeHours: 8000,
        currentHours: 1200,
        status: 'healthy',
        notes: 'اسپایدر داخلی الاستومر سالم'
      },
      {
        id: 'p-5',
        productCode: 'SWR-XPA-1400',
        name: 'تسمه شیاردار اسپشیال دینام اصلی پرس',
        brand: 'SWR آلمان',
        quantityPerMachine: 6,
        unit: 'حلقه',
        installedDate: '۱۴۰۲/۱۱/۲۰',
        estimatedLifeHours: 4500,
        currentHours: 4400,
        status: 'critical',
        notes: 'نیازمند تعویض فوری قبل از شیفت آینده!'
      }
    ]
  },
  {
    id: 'mach-3',
    name: 'نوار نقاله اصلی انتقال گرانول و بدنه',
    section: 'خط آماده‌سازی خاک و اسپری‌درایر',
    modelNumber: 'CV-1200 Heavy',
    manufacturer: 'ماشین‌سازی پارس',
    installedYear: '۱۳۹۵',
    operatingShift: 'double',
    parts: [
      {
        id: 'p-6',
        productCode: 'PUL-SPB-250-4',
        name: 'پولی چدنی استاندارد ۴ شیار دینام بالابر',
        brand: 'اطلس',
        quantityPerMachine: 2,
        unit: 'عدد',
        installedDate: '۱۴۰۲/۰۳/۱۵',
        estimatedLifeHours: 12000,
        currentHours: 7500,
        status: 'healthy',
        notes: 'شیارها بدون سایش غیرعادی'
      }
    ]
  }
];

export const PlantMachineryPassport: React.FC = () => {
  const { addToCart } = useCart();
  const [machines, setMachines] = useState<PlantMachine[]>(() => {
    try {
      const saved = durableStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_MACHINES;
  });

  const [activeMachineId, setActiveMachineId] = useState<string>(
    machines[0]?.id || ''
  );
  const [isAddMachineModalOpen, setIsAddMachineModalOpen] = useState(false);
  const [isAddPartModalOpen, setIsAddPartModalOpen] = useState(false);
  const [reorderFeedback, setReorderFeedback] = useState<string | null>(null);

  // New Machine Form State
  const [newMachineData, setNewMachineData] = useState<Omit<PlantMachine, 'id' | 'parts'>>({
    name: '',
    section: 'سالن شماره ۱',
    modelNumber: '',
    manufacturer: '',
    installedYear: '۱۴۰۱',
    operatingShift: 'three_shifts'
  });

  // New Part Form State
  const [newPartData, setNewPartData] = useState<Omit<MachinePartItem, 'id'>>({
    productCode: 'SWR-SPB-2000',
    name: '',
    brand: 'SWR آلمان',
    quantityPerMachine: 2,
    unit: 'حلقه',
    installedDate: '۱۴۰۴/۰۱/۱۵',
    estimatedLifeHours: 4000,
    currentHours: 500,
    status: 'healthy',
    notes: ''
  });

  // Save to localStorage
  useEffect(() => {
    try {
      durableStorage.setItem(STORAGE_KEY, JSON.stringify(machines));
    } catch (e) {
      console.error(e);
    }
  }, [machines]);

  const activeMachine = machines.find(m => m.id === activeMachineId) || machines[0];

  const handleAddMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineData.name.trim()) return;

    const newMach: PlantMachine = {
      id: 'mach-' + Date.now(),
      ...newMachineData,
      parts: []
    };

    setMachines(prev => [newMach, ...prev]);
    setActiveMachineId(newMach.id);
    setIsAddMachineModalOpen(false);
    setNewMachineData({
      name: '',
      section: 'سالن شماره ۱',
      modelNumber: '',
      manufacturer: '',
      installedYear: '۱۴۰۳',
      operatingShift: 'three_shifts'
    });
  };

  const handleDeleteMachine = (id: string) => {
    if (machines.length <= 1) {
      alert('حداقل یک دستگاه باید در شناسنامه خطوط تولید کارخانه باقی بماند.');
      return;
    }
    if (confirm('آیا از حذف این دستگاه از شناسنامه خط تولید اطمینان دارید؟')) {
      const remaining = machines.filter(m => m.id !== id);
      setMachines(remaining);
      setActiveMachineId(remaining[0].id);
    }
  };

  const handleAddPartToActiveMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMachine || !newPartData.productCode.trim()) return;

    const newPart: MachinePartItem = {
      id: 'part-' + Date.now(),
      ...newPartData
    };

    setMachines(prev =>
      prev.map(m =>
        m.id === activeMachine.id
          ? { ...m, parts: [...m.parts, newPart] }
          : m
      )
    );

    setIsAddPartModalOpen(false);
    setNewPartData({
      productCode: 'SWR-SPB-2000',
      name: '',
      brand: 'SWR آلمان',
      quantityPerMachine: 2,
      unit: 'حلقه',
      installedDate: '۱۴۰۴/۰۱/۱۵',
      estimatedLifeHours: 4000,
      currentHours: 500,
      status: 'healthy',
      notes: ''
    });
  };

  const handleDeletePart = (partId: string) => {
    if (!activeMachine) return;
    setMachines(prev =>
      prev.map(m =>
        m.id === activeMachine.id
          ? { ...m, parts: m.parts.filter(p => p.id !== partId) }
          : m
      )
    );
  };

  // 1-Click Reorder for entire machine package
  const handleReorderAllParts = () => {
    if (!activeMachine || activeMachine.parts.length === 0) return;

    const mockCatalog = generateMockProducts();
    let addedCount = 0;

    activeMachine.parts.forEach(part => {
      // Find matching catalog product or create fallback
      let prod = getProductByCode(part.productCode) || mockCatalog.find(p => p.code.toLowerCase() === part.productCode.toLowerCase());
      if (!prod) {
        prod = {
          code: part.productCode,
          name: part.name || `قطعه مصرفی ${part.productCode}`,
          brand: part.brand,
          categorySlug: 'industrial-belts',
          categoryName: 'سیستم‌های انتقال قدرت',
          subcategory: 'انتقال قدرت',
          technicalSpecs: [{ key: 'دستگاه مقصد', value: activeMachine.name }],
          prices: { base: 1500000, retail: 1650000, wholesale: 1450000, dealer: 1350000 },
          stock: 45,
          inquiryOnly: false,
          images: [],
          tags: ['شناسنامه ماشین‌آلات', activeMachine.name],
          unit: part.unit
        };
      }
      addToCart(prod, part.quantityPerMachine);
      addedCount += part.quantityPerMachine;
    });

    setReorderFeedback(`تمام قطعات مصرفی «${activeMachine.name}» (مجموعاً ${toPersianDigits(addedCount)} قلم) با موفقیت به سبد خرید اضافه شدند!`);
    setTimeout(() => setReorderFeedback(null), 4000);
  };

  return (
    <div className="space-y-6 text-right">
      {/* Header and Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 font-black text-base text-[#55565A]">
            <Cpu className="w-5 h-5 text-[#E06518]" />
            <span>شناسنامه اختصاصی تجهیزات و ماشین‌آلات کارخانه (Plant Machinery Passport)</span>
          </div>
          <p className="text-xs text-[#777A7D] mt-1">
            کد قطعات مصرفی، تسمه‌ها، پولی‌ها و یاتاقان‌های خطوط تولید کارخانه خود را یکبار ثبت کنید و در زمان اورهال با یک کلیک سفارش دهید.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddMachineModalOpen(true)}
          className="px-4 py-2 bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت دستگاه جدید در خط تولید</span>
        </button>
      </div>

      {reorderFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reorderFeedback}</span>
          </div>
          <a
            href="/cart"
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shrink-0"
          >
            مشاهده سبد خرید
          </a>
        </div>
      )}

      {/* Machine Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {machines.map(mach => {
          const isActive = mach.id === activeMachine?.id;
          const criticalCount = mach.parts.filter(p => p.status === 'critical').length;
          const warningCount = mach.parts.filter(p => p.status === 'warning').length;

          return (
            <button
              key={mach.id}
              type="button"
              onClick={() => setActiveMachineId(mach.id)}
              className={`px-4 py-3 rounded-2xl text-xs font-bold shrink-0 border transition-all text-right cursor-pointer flex items-center gap-3 ${
                isActive
                  ? 'bg-[#55565A] text-white border-slate-700 shadow-md ring-2 ring-[#E06518]'
                  : 'bg-white text-[#55565A] border-slate-200 hover:border-orange-300 hover:bg-slate-50'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[190px]">{mach.name}</span>
                  {criticalCount > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" title="نیازمند تعویض فوری" />
                  )}
                  {criticalCount === 0 && warningCount > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" title="نزدیک به اتمام عمر مفید" />
                  )}
                </div>
                <div className={`text-[10px] ${isActive ? 'text-slate-300' : 'text-[#777A7D]'}`}>
                  {mach.section} | {toPersianDigits(mach.parts.length)} قطعه ثبت‌شده
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Machine Detail Card */}
      {activeMachine && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-5">
          {/* Machine Header Metadata */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-black text-sm text-[#55565A]">{activeMachine.name}</h3>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                  {activeMachine.modelNumber}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold">
                  سازنده: {activeMachine.manufacturer}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                  سال نصب: {activeMachine.installedYear}
                </span>
              </div>
              <p className="text-[11px] text-[#777A7D]">
                محل استقرار: <strong className="text-[#55565A]">{activeMachine.section}</strong> | نوبت کاری:{' '}
                <strong className="text-[#55565A]">
                  {activeMachine.operatingShift === 'three_shifts' ? '۳ شیفت مداوم ۲۴ ساعته' : activeMachine.operatingShift === 'double' ? '۲ شیفت کاری' : 'تک شیفت'}
                </strong>
              </p>
            </div>

            {/* Quick Batch Actions */}
            <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
              <button
                type="button"
                onClick={handleReorderAllParts}
                className="px-4 py-2.5 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                title="افزودن تمام قطعات مصرفی این دستگاه به سبد خرید"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>سفارش مجدد کل پکیج قطعات این خط ({toPersianDigits(activeMachine.parts.length)} قلم)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddPartModalOpen(true)}
                className="px-3.5 py-2.5 bg-white border border-slate-300 hover:border-orange-400 text-[#55565A] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 text-[#E06518]" />
                <span>افزودن قطعه جدید به دستگاه</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteMachine(activeMachine.id)}
                className="p-2.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 border border-slate-200 cursor-pointer transition-colors"
                title="حذف این دستگاه"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Parts Table / List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#55565A] font-bold px-1">
              <span className="flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#E06518]" />
                <span>لیست قطعات مصرفی، یاتاقان و تسمه‌های این ماشین:</span>
              </span>
              <span className="text-[#777A7D] text-[11px]">
                پایش کارکرد و وضعیت سایش توسط الگوریتم تخمین عمر اطلس
              </span>
            </div>

            {activeMachine.parts.length === 0 ? (
              <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-xs text-[#777A7D] space-y-2">
                <p>هنوز قطعه‌ای برای این دستگاه ثبت نشده است.</p>
                <button
                  type="button"
                  onClick={() => setIsAddPartModalOpen(true)}
                  className="text-[#E06518] font-bold underline"
                >
                  اولین قطعه مصرفی را اکنون اضافه کنید
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeMachine.parts.map(part => {
                  const percentUsed = Math.min(100, Math.round((part.currentHours / part.estimatedLifeHours) * 100));

                  return (
                    <div
                      key={part.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        {/* Status badge & brand */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-black text-[#55565A] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {part.productCode}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              part.status === 'critical'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : part.status === 'warning'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {part.status === 'critical' ? (
                              <>
                                <AlertTriangle className="w-3 h-3" />
                                <span>تعویض فوری</span>
                              </>
                            ) : part.status === 'warning' ? (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>نزدیک به اورهال</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>وضعیت سالم</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-xs text-[#55565A] line-clamp-1">{part.name}</h4>
                          <p className="text-[11px] text-[#777A7D] mt-0.5">
                            برند: <strong className="text-[#55565A]">{part.brand}</strong> | تعداد روی دستگاه:{' '}
                            <strong className="text-[#E06518] font-bold font-mono">
                              {toPersianDigits(part.quantityPerMachine)} {part.unit}
                            </strong>
                          </p>
                        </div>

                        {/* Wear Progress Bar */}
                        <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div className="flex items-center justify-between text-[10px] text-[#777A7D]">
                            <span>کارکرد: {toPersianDigits(part.currentHours)} ساعت</span>
                            <span className="font-mono font-bold text-[#55565A]">
                              {toPersianDigits(percentUsed)}٪ عمر مصرفی
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percentUsed > 85 ? 'bg-rose-500' : percentUsed > 65 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percentUsed}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-[#777A7D] text-left">
                            عمر استاندارد: {toPersianDigits(part.estimatedLifeHours)} ساعت
                          </div>
                        </div>

                        {part.notes && (
                          <p className="text-[10px] text-slate-500 bg-amber-50/50 p-2 rounded border border-amber-200/60">
                            یادداشت فنی: {part.notes}
                          </p>
                        )}
                      </div>

                      {/* Bottom Card Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const mockCatalog = generateMockProducts();
                            const prod = getProductByCode(part.productCode) || mockCatalog[0];
                            addToCart(prod, part.quantityPerMachine);
                            setReorderFeedback(`قطعه ${part.productCode} (${toPersianDigits(part.quantityPerMachine)} ${part.unit}) به سبد خرید افزوده شد.`);
                            setTimeout(() => setReorderFeedback(null), 3000);
                          }}
                          className="px-3 py-1.5 bg-[#E06518] hover:bg-[#C95210] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors flex-1 justify-center"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>خرید مجدد این قطعه</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePart(part.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          title="حذف قطعه"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Machine */}
      {isAddMachineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-[#55565A]">ثبت دستگاه یا خط تولید جدید در شناسنامه کارخانه</h3>
              <button
                type="button"
                onClick={() => setIsAddMachineModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMachine} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#55565A] mb-1">نام یا عنوان دستگاه:</label>
                <input
                  type="text"
                  value={newMachineData.name}
                  onChange={e => setNewMachineData({ ...newMachineData, name: e.target.value })}
                  placeholder="مثلاً خط بسته‌بندی کارتن شماره ۲"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[#55565A] mb-1">سالن یا واحد استقرار:</label>
                <input
                  type="text"
                  value={newMachineData.section}
                  onChange={e => setNewMachineData({ ...newMachineData, section: e.target.value })}
                  placeholder="سالن پخت / خط چاپ / انبار مواد اولیه..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#55565A] mb-1">مدل فنی یا کد دستگاه:</label>
                  <input
                    type="text"
                    value={newMachineData.modelNumber}
                    onChange={e => setNewMachineData({ ...newMachineData, modelNumber: e.target.value })}
                    placeholder="SACMI PH-3200"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#55565A] mb-1">شرکت سازنده:</label>
                  <input
                    type="text"
                    value={newMachineData.manufacturer}
                    onChange={e => setNewMachineData({ ...newMachineData, manufacturer: e.target.value })}
                    placeholder="ساکمی، برتون، سیتی، ..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#55565A] mb-1">سال راه‌اندازی:</label>
                  <input
                    type="text"
                    value={newMachineData.installedYear}
                    onChange={e => setNewMachineData({ ...newMachineData, installedYear: e.target.value })}
                    placeholder="۱۴۰۱"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#55565A] mb-1">نوبت کاری:</label>
                  <select
                    value={newMachineData.operatingShift}
                    onChange={e => setNewMachineData({ ...newMachineData, operatingShift: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="three_shifts">۳ شیفت ۲۴ ساعته</option>
                    <option value="double">۲ شیفت</option>
                    <option value="single">تک شیفت</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMachineModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E06518] hover:bg-[#C95210] text-white font-bold rounded-lg cursor-pointer transition-colors"
                >
                  ثبت دستگاه در شناسنامه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Part to Active Machine */}
      {isAddPartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-[#55565A]">
                افزودن قطعه مصرفی به «{activeMachine?.name}»
              </h3>
              <button
                type="button"
                onClick={() => setIsAddPartModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPartToActiveMachine} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#55565A] mb-1">کد فنی قطعه (کاتالوگ یا پارت نامبر):</label>
                <input
                  type="text"
                  dir="ltr"
                  value={newPartData.productCode}
                  onChange={e => setNewPartData({ ...newPartData, productCode: e.target.value })}
                  placeholder="SWR-SPB-2240 یا FORZA-8M-1400"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-left"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[#55565A] mb-1">نام قطعه و مشخصات:</label>
                <input
                  type="text"
                  value={newPartData.name}
                  onChange={e => setNewPartData({ ...newPartData, name: e.target.value })}
                  placeholder="تسمه وی‌بلت اسپشیال خط انتقال..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#55565A] mb-1">برند سازنده:</label>
                  <input
                    type="text"
                    value={newPartData.brand}
                    onChange={e => setNewPartData({ ...newPartData, brand: e.target.value })}
                    placeholder="SWR / FORZA / SKF..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#55565A] mb-1">تعداد روی دستگاه:</label>
                  <input
                    type="number"
                    min="1"
                    value={newPartData.quantityPerMachine}
                    onChange={e => setNewPartData({ ...newPartData, quantityPerMachine: Number(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#55565A] mb-1">واحد سنجش:</label>
                  <select
                    value={newPartData.unit}
                    onChange={e => setNewPartData({ ...newPartData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="حلقه">حلقه (تسمه)</option>
                    <option value="عدد">عدد (بلبرینگ / پولی)</option>
                    <option value="ست">ست (کوپلینگ)</option>
                    <option value="شاخه">شاخه</option>
                    <option value="متر">متر</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#55565A] mb-1">وضعیت سلامت کنونی:</label>
                  <select
                    value={newPartData.status}
                    onChange={e => setNewPartData({ ...newPartData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="healthy">سالم و در حال کار</option>
                    <option value="warning">هشدار (نزدیک به اورهال)</option>
                    <option value="critical">بحرانی (تعویض فوری)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#55565A] mb-1">یادداشت فنی مهندس نگهداری:</label>
                <textarea
                  rows={2}
                  value={newPartData.notes}
                  onChange={e => setNewPartData({ ...newPartData, notes: e.target.value })}
                  placeholder="مثلاً تاریخ تعویض بعدی، سایز شفت..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPartModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E06518] hover:bg-[#C95210] text-white font-bold rounded-lg cursor-pointer transition-colors"
                >
                  افزودن قطعه به دستگاه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
