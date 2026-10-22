import React, { useState } from 'react';
import {
  FileText,
  Download,
  FileCheck,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Search,
  BookOpen,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';

interface TechnicalDocument {
  id: string;
  title: string;
  category: 'catalogue' | 'cad' | 'cert' | 'manual';
  format: 'PDF' | 'DWG' | 'STEP' | 'ZIP';
  fileSize: string;
  publishedDate: string;
  downloadsCount: number;
  description: string;
  brand: string;
}

const DOCUMENTS: TechnicalDocument[] = [
  {
    id: 'doc-1',
    title: 'کاتالوگ جامع فنی و مهندسی تسمه‌های صنعتی SWR آلمان ۱۴۰۴',
    category: 'catalogue',
    format: 'PDF',
    fileSize: '۲۴.۵ مگابایت',
    publishedDate: '۱۴۰۳/۱۱/۰۱',
    downloadsCount: 1420,
    description: 'شامل جداول محاسبات فنی گام، توان انتقالی به کیلووات، فواصل مرکز تا مرکز پولی‌ها و راهنمای انتخاب تسمه‌های V-Belt و Timing.',
    brand: 'SWR'
  },
  {
    id: 'doc-2',
    title: 'دفترچه راهنمای انتخاب و تلرانس شفت یاتاقان‌ها و بلبرینگ‌های دور بالا',
    category: 'manual',
    format: 'PDF',
    fileSize: '۸.۲ مگابایت',
    publishedDate: '۱۴۰۳/۱۰/۱۵',
    downloadsCount: 890,
    description: 'جدول استانداردهای ISO برای انطباق شفت و سوراخ هوزینگ، میزان لقی شعاعی (C3, C4) و راهنمای گریس‌کاری در شرایط دمای بالا.',
    brand: 'FORZA & NSK'
  },
  {
    id: 'doc-3',
    title: 'پکیج نقشه‌های CAD و ابعادی سه‌بعدی پولی‌های چدنی SPB و SPC (اطلس)',
    category: 'cad',
    format: 'STEP',
    fileSize: '۴۵ مگابایت',
    publishedDate: '۱۴۰۳/۰۹/۲۰',
    downloadsCount: 650,
    description: 'فایل‌های سه‌بعدی سالیدورکس و STEP پولی‌های گوه بوش‌دار (Taper Bush Pulleys) جهت جاگذاری مستقیم در نقشه‌های خطوط تولید کارخانجات.',
    brand: 'بازرگانی اطلس'
  },
  {
    id: 'doc-4',
    title: 'گواهی‌نامه آزمون متالوژی، کشش و گواهی اصالت استاندارد DIN 2215 و ISO 4184',
    category: 'cert',
    format: 'PDF',
    fileSize: '۳.۱ مگابایت',
    publishedDate: '۱۴۰۳/۱۲/۰۵',
    downloadsCount: 310,
    description: 'تاییدیه‌های آزمایشگاه متالوژی رازی و موسسه استاندارد آلمان برای تسمه‌های آنتی‌استاتیک و ضد روغن و مقاومت در برابر سایش در محیط‌های اسیدی و غبارآلود.',
    brand: 'SWR Germany'
  },
  {
    id: 'doc-5',
    title: 'کاتالوگ رولرهای نسوز سرامیکی و قطعات یدکی کوره کاشی و پرسلان',
    category: 'catalogue',
    format: 'PDF',
    fileSize: '۱۴ مگابایت',
    publishedDate: '۱۴۰۳/۰۸/۱۰',
    downloadsCount: 1100,
    description: 'مشخصات فنی و شوک‌پذیری حرارتی رولرهای سرامیکی تا دمای ۱۲۸۰ درجه سانتی‌گراد ویژه کوره‌های پخت سریع میبد و یزد.',
    brand: 'CER-ATLAS'
  }
];

export const TechnicalDocsVault: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadSuccessFeedback, setDownloadSuccessFeedback] = useState<string | null>(null);

  const filteredDocs = DOCUMENTS.filter(doc => {
    if (filterCategory !== 'all' && doc.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return doc.title.toLowerCase().includes(q) || doc.description.toLowerCase().includes(q) || doc.brand.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSimulateDownload = (doc: TechnicalDocument) => {
    setDownloadSuccessFeedback(`فایل «${doc.title}» (${doc.format}) در حال دانلود می‌باشد...`);
    setTimeout(() => {
      setDownloadSuccessFeedback(null);
    }, 3500);
  };

  return (
    <div className="space-y-6 text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 font-black text-base text-[#55565A]">
            <BookOpen className="w-5 h-5 text-[#E06518]" />
            <span>آرشیو مدارک فنی، نقشه‌های CAD و گواهی‌نامه‌های کیفیت (Engineering Vault)</span>
          </div>
          <p className="text-xs text-[#777A7D] mt-1">
            دسترسی مستقیم مهندسان کارخانه به نقشه‌های اتوکد، کاتالوگ‌های قطعات SWR و FORZA و گواهی‌نامه‌های تست متالوژی.
          </p>
        </div>
      </div>

      {downloadSuccessFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{downloadSuccessFeedback}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { id: 'all', label: 'همه اسناد فنی' },
            { id: 'catalogue', label: 'کاتالوگ‌های رسمی' },
            { id: 'cad', label: 'نقشه‌ها و فایل‌های CAD' },
            { id: 'cert', label: 'گواهینامه‌های کیفیت QC' },
            { id: 'manual', label: 'هندبوک‌های محاسبات' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterCategory(f.id)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                filterCategory === f.id
                  ? 'bg-[#E06518] text-white shadow-xs'
                  : 'bg-slate-100 text-[#55565A] hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="جستجوی عنوان مدرک، برند یا استاندارد..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#E06518]"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDocs.map(doc => (
          <div
            key={doc.id}
            className="bg-white rounded-xl border border-slate-200 hover:border-orange-300 p-4 space-y-3 shadow-xs transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-800 text-white">
                  {doc.format}
                </span>
                <span className="text-[11px] font-bold text-[#E06518] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                  {doc.brand}
                </span>
              </div>

              <h4 className="font-black text-xs text-[#55565A] leading-relaxed">{doc.title}</h4>
              <p className="text-[11px] text-[#777A7D] leading-relaxed line-clamp-2">{doc.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#777A7D]">
              <div className="flex items-center gap-3">
                <span>حجم: {doc.fileSize}</span>
                <span>دانلود: {toPersianDigits(doc.downloadsCount)} بار</span>
              </div>

              <button
                type="button"
                onClick={() => handleSimulateDownload(doc)}
                className="px-3 py-1.5 bg-[#55565A] hover:bg-[#E06518] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود سند</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
