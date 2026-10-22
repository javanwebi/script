import type {PartMeasurement} from '../utils/partMeasurements';
import { Product } from '../types';
import { getProductByCode } from '../data/mockGenerator';
import { getProductImageUrl } from '../assets/imagesproducts';
import { apiUrl, assertBackendConfigured } from '../config/apiConfig';

// مرحله تحلیل:
// quick   = شناسایی فوری فقط از روی تصویر (مرحله اول)
// refined = تحلیل دقیق با تصویر + ابعاد + کاربرد (مراحل دوم و سوم)
export type AiAnalysisStage = 'quick' | 'refined';

export interface AiPartAnalysisRequest {
  imageBase64?: string;
  imageUrl?: string;
  mimeType?: string;
  length?: number;
  width?: number;
  pitch?: number;
  application?: string;
  features?: string;
  observationOnly?:boolean;
  measurements?:Record<string,string>;
  stage?: AiAnalysisStage;
}

export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export type VisualVerdict = 'exact_match' | 'very_similar' | 'different';

export type CatalogAvailabilityStatus =
  | 'confirmed_in_catalog'   // عیناً / انطباق قطعی در کاتالوگ موجود است (همونه)
  | 'similar_in_catalog'     // مدل مشابه / جایگزین سازگار در کاتالوگ موجود است (شبیهه)
  | 'custom_order_available'; // قطعه خاص صنعتی - امکان استعلام و ساخت سفارشی

export interface CatalogAvailability {
  status: CatalogAvailabilityStatus;
  statusFarsiTitle: string;
  statusFarsiMessage: string;
}

export interface MatchedPartItem {
  code: string;
  name: string;
  brand: string;
  type: string;
  similarityScore: number;
  matchReason: string;
  distinction?: string;
  specs: { key: string; value: string }[];
  catalogProduct?: Product;
  // How the server found this real catalog record.
  matchType?: 'visual' | 'technical' | 'combined' | 'code';
  technicalMatchScore?: number;
  technicalEvidence?: string[];
  // Direct image-to-image match against the site's catalog photos
  isVisualMatch?: boolean;
  visualDistance?: number;
  // Multi-image side-by-side AI visual verification
  visualVerdict?: VisualVerdict;
  visualVerdictFarsi?: string; // e.g. "همونه (انطباق قطعی)" | "شبیهه (مدل مشابه/جایگزین)" | "فرق داره"
  visualExplanation?: string;  // Persian side-by-side comparative inspection rationale
  verificationConfidence?: number;
  forzaCode?: string;
  cataloguePage?: number;
  image?: string;
}

export interface ImageScanProgress {stage:'preparing'|'scanning'|'verifying'|'complete';total:number;compared:number;failed:number;}
export interface CatalogPhotoMatch {imageId:string;image:string;label:string;score:number;reason:string;relation?:'very_similar'|'related';familyNames?:string[];bindings:{familyCode:string;code?:string;verified:boolean}[];}
export interface AiPartAnalysisResult {
  observationOnly?:boolean;
  requiredMeasurements?:PartMeasurement[];
  success: boolean;
  isAiGenerated: boolean;
  stage?: AiAnalysisStage;
  model?: string;
  summary: {
    whatYouSee?: string;
    readableMarkings?:string[];
    observedSpecifications?:{name:string;value:string;evidence:string;source:string}[];
    unknownParameters?:string[];
    detectedPartType: string;
    partFamilyFarsi?: string; // short part family, e.g. «چرخ‌دهنده» — used for dynamic UI titles
    detectedProfile: string;
    material?: string;
    visualAnalysis: string;
    confidence: number;
    boundingBox?: BoundingBox;
    exactVisualMatch?: boolean;
    catalogAvailability?: CatalogAvailability;
    verifiedCandidateCount?: number; // Legacy count alias; results are ranked, not independently verified by Gemini.
  };
  catalogImageMatches?: CatalogPhotoMatch[];
  retrieval?:{mode:string;total:number;indexed:number;ready:boolean;verifiedPool:number};
  scanCoverage?: {total:number;compared:number;failed:number;complete:boolean;providerAvailable:boolean;failedImageIds:string[]};
  matchedProducts: MatchedPartItem[];
  rejectedCandidates?: MatchedPartItem[]; // (legacy, kept empty) items rejected as 'different'
  similarCandidates?: MatchedPartItem[]; // server-ranked real catalog alternatives from visual and/or technical search
  technicalAdvice: string;
  fallbackNotice?: string;
  catalogSearchWarning?: string;
  customerImageUrl?: string;
  aiError?: string;
}

// Sample industrial presets for one-click testing (real catalog products)
export { INDUSTRIAL_PRESET_SAMPLES } from '../data/recognitionSamples';
export type { IndustrialPresetSample } from '../data/recognitionSamples';

function dataUrlToBlob(value: string, fallbackMime = 'image/jpeg'): Blob {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) {
    const encoded = value.replace(/^base64,/, '');
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: fallbackMime });
  }

  const mimeType = match[1] || fallbackMime;
  const payload = match[3] || '';
  if (match[2]) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }
  return new Blob([decodeURIComponent(payload)], { type: mimeType });
}

async function uploadResponseData(response: Response): Promise<{ imageUrl: string; fileName: string }> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.imageUrl) {
    throw new Error(data?.error?.message || `بارگذاری تصویر ناموفق بود (کد ${response.status}).`);
  }
  return { imageUrl: String(data.imageUrl), fileName: String(data.fileName || '') };
}

export const aiVisualSearchService = {
  async uploadCustomerImage(source: string | Blob): Promise<{ imageUrl: string; fileName: string }> {
    assertBackendConfigured();

    if (typeof source === 'string' && /^https?:\/\//i.test(source.trim())) {
      const response = await fetch(apiUrl('/api/ai/customer-images/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: source.trim() }),
      });
      return uploadResponseData(response);
    }

    let blob: Blob;
    if (typeof source === 'string') {
      blob = source.startsWith('blob:')
        ? await fetch(source).then(response => response.blob())
        : dataUrlToBlob(source);
    } else {
      blob = source;
    }

    const mimeType = (blob.type || 'image/jpeg').split(';')[0].toLowerCase();
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType)) {
      throw new Error('فقط تصاویر JPEG، PNG یا WEBP پشتیبانی می‌شوند.');
    }

    const response = await fetch(apiUrl('/api/ai/customer-images'), {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });
    return uploadResponseData(response);
  },

  async analyzePartWithAi(request: AiPartAnalysisRequest, onProgress?: (progress:ImageScanProgress)=>void): Promise<AiPartAnalysisResult> {
    assertBackendConfigured();

    let imageUrl = request.imageUrl;
    if (!imageUrl && request.imageBase64) {
      imageUrl = (await this.uploadCustomerImage(request.imageBase64)).imageUrl;
    }

    const { imageBase64: _imageBase64, mimeType: _mimeType, ...analysisFields } = request;
    const payload = imageUrl
      ? { ...analysisFields, imageUrl }
      : analysisFields;

    const response = await fetch(apiUrl('/api/ai/analyze-part'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      throw new Error(failure?.error?.message || `خطای ارتباط با سرور هوش مصنوعی: کد ${response.status}`);
    }

    let data: AiPartAnalysisResult = await response.json();
    if(response.status===202) {
      const jobId=(data as any).jobId;
      if(typeof jobId!=='string')throw new Error('شناسهٔ بررسی تصاویر دریافت نشد.');
      const deadline=Date.now()+30*60*1000;
      while(true) {
        if(Date.now()>deadline)throw new Error('مهلت بررسی کامل تصاویر تمام شد؛ دوباره تلاش کنید.');
        await new Promise(resolve=>setTimeout(resolve,1200));
        const poll=await fetch(apiUrl(`/api/ai/recognition-jobs/${encodeURIComponent(jobId)}`),{cache:'no-store'});
        const job=await poll.json();
        if(!poll.ok)throw new Error(job.error?.message || 'دریافت وضعیت بررسی تصاویر ناموفق بود.');
        if(job.progress)onProgress?.(job.progress);
        if(job.status==='failed')throw new Error(job.error || 'بررسی تصاویر کامل نشد.');
        if(job.status==='complete'){data=job.result;break;}
      }
    }

    // Enrich only by the exact product code. Never invent a catalog result
    // through a partial name match or generated fallback product.
    const mapWithCatalog = (m: MatchedPartItem): MatchedPartItem => ({
      ...m,
      catalogProduct: getProductByCode(m.code),
    });

    data.matchedProducts = (data.matchedProducts || []).map(mapWithCatalog);
    if (data.rejectedCandidates && Array.isArray(data.rejectedCandidates)) {
      data.rejectedCandidates = data.rejectedCandidates.map(mapWithCatalog);
    }
    if (data.similarCandidates && Array.isArray(data.similarCandidates)) {
      data.similarCandidates = data.similarCandidates.map(mapWithCatalog);
    }

    return data;
  },

  // Helper to convert File to base64
  fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          base64: result,
          mimeType: file.type || 'image/jpeg',
        });
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  },

  // Helper to convert an image URL (same-origin preset or remote) to base64 data-URL
  async urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('دانلود تصویر نمونه ناموفق بود؛ لطفاً تصویر را مستقیماً آپلود کنید.');
    }
    const blob = await res.blob();
    const base64: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(blob);
    });
    return { base64, mimeType: blob.type || 'image/jpeg' };
  },
};
