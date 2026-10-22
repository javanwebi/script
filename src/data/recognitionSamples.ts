import { getProductImageUrl } from '../assets/imagesproducts';

export interface IndustrialPresetSample {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  length: number;
  width: number;
  pitch?: number;
  application: string;
  features: string;
}

export const INDUSTRIAL_PRESET_SAMPLES: IndustrialPresetSample[] = [
  // Type-level visual examples only: no invented size, grade or manufacturer code.
  { id:'sample-flat-rings', title:'حلقه تخت', subtitle:'نمونهٔ ظاهری؛ کد و ابعاد تأیید نشده', imageUrl:getProductImageUrl('e(1).png'), length:0,width:0,application:'',features:'' },
  { id:'sample-handle-screw', title:'پیچ دسته‌دار', subtitle:'نمونهٔ ظاهری؛ کد و ابعاد تأیید نشده', imageUrl:getProductImageUrl('e(14).png'), length:0,width:0,application:'',features:'' },
  { id:'sample-industrial-rail', title:'ریل صنعتی', subtitle:'نمونهٔ مقطع؛ کد و ابعاد تأیید نشده', imageUrl:getProductImageUrl('e(319).png'), length:0,width:0,application:'',features:'' },
  { id:'sample-bearing', title:'بلبرینگ', subtitle:'نمونهٔ ظاهری؛ مدل و سایز تأیید نشده', imageUrl:getProductImageUrl('e(383).png'), length:0,width:0,application:'',features:'' },
];
