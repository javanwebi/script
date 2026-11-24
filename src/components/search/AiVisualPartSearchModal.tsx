import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  Image as GalleryImage,
  SwitchCamera,
  UploadCloud,
  ArrowRight,
  AlertCircle,
  ChevronLeft,
  ChevronDown,
  X,
  Zap,
  RotateCcw,
  Wrench,
  Phone,
  MessageCircle,
  History,
  HelpCircle,
  Sun,
  Focus,
  ZoomIn,
  Search,
  Sparkles,
  ArrowUpLeft,
  Activity,
} from 'lucide-react';
import {
  VisualScannerIcon,
  BeltIcon,
  PulleyIcon,
  BearingIcon,
  ChainCouplingIcon,
} from '../forza/ForzaWorkspaceIcons';
import { apiUrl } from '../../config/apiConfig';
import { goBackOrFallback } from '../../utils/navigateBackOrFallback';
import {
  aiVisualSearchService,
  type AiAnalysisStage,
  type AiPartAnalysisResult,
} from '../../services/aiVisualSearchService';
import {
  adoptCustomerDeviceImage,
  customerImageBlobToDataUrl,
  getCustomerDeviceImage,
  getCustomerDeviceImageMetadata,
  saveCustomerDeviceImage,
} from '../../services/customerImageVault';
import {
  completeCustomerImageIdentification,
  createCustomerImageIdentification,
  selectCustomerImageProduct,
} from '../../services/customerIntelligenceService';
import { pricingCreditService } from '../../services/pricingCreditService';
import { useAuth } from '../../context/AuthContext';
import { formatPrice, toPersianDigits } from '../../utils/formatters';
import {
  prepareFastVisionDetectionUrl,
  renderSegmentedVisionCutout,
  type SegmentedVisionCutout,
} from '../../utils/cropVisionImage';
import type { ImageRegion } from '../../utils/imageRegion';
import { buildVisionConsultationPrompt } from '../../utils/visionConsultationPrompt';
import {
  analyzeImageAutoContour,
  fuseDetectionCandidates,
  isPointInsidePolygon,
  refineAutoContoursWithAiMask,
  refineContourInsideRegion,
  segmentPartAtTapPoint,
  type AlphaMaskData,
  type ContourPoint,
  type DetectedPartContour,
} from '../../utils/smartPartContour';
import { preloadClientAiSegmentation } from '../../utils/clientAiSegmentation';
import { useOnnxPartSegmentation } from './PartIdentificationProvider';
import { memberPath } from '../storefront/MemberAccess';
import { CatalogResultImage } from './CatalogResultImage';
import { LocalModelResults } from './LocalModelResults';
import { VisionAnalysisProgress } from './VisionAnalysisProgress';
import {
  formatVisionRecentTime,
  loadVisionRecentSearches,
  recordVisionRecentSearch,
  type VisionRecentSearchItem,
} from './visionRecentHistory';
import './industrial-scan.css';

const CAMERA_TIPS_SEEN_KEY = 'forza_camera_tips_seen_v1';

const LazyCustomPartRequestModal = lazy(() =>
  import('../home/CustomPartRequestModal').then((module) => ({
    default: module.CustomPartRequestModal,
  })),
);

const VISION_ANALYSIS_PHASES = [
  { title: 'آماده‌سازی تصویر', tag: 'آماده‌سازی', detail: 'نسخه فشرده تصویر از حافظه محلی دستگاه آماده شده است.' },
  { title: 'تحلیل ناحیه قطعه', tag: 'تحلیل ناحیه', detail: 'مرزها و ویژگی‌های قابل مشاهده قطعه بررسی می‌شوند.' },
  { title: 'تطبیق با کاتالوگ', tag: 'تطبیق کاتالوگ', detail: 'نتایج واقعی کاتالوگ صنعت پیش در حال بررسی هستند.' },
];

const MAX_MANUFACTURING_IMAGE_BYTES = 8 * 1024 * 1024;

async function createManufacturingImageFile(blob: Blob, originalName: string): Promise<File> {
  if (!blob.size || !blob.type.startsWith('image/')) {
    throw new Error('تصویر قطعه برای پیوست درخواست ساخت معتبر نیست.');
  }
  const safeBase =
    (originalName || 'forza-part-image')
      .split(/[\\/]/)
      .pop()!
      .replace(/[.][^.]+$/, '')
      .slice(0, 100) || 'forza-part-image';
  const mime = blob.type.split(';')[0].toLowerCase();
  const extension = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
  if (
    blob.size <= MAX_MANUFACTURING_IMAGE_BYTES &&
    ['image/jpeg', 'image/png', 'image/webp'].includes(mime)
  ) {
    return new File([blob], safeBase + extension, { type: mime, lastModified: Date.now() });
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const encode = async (maxDimension: number, quality: number): Promise<Blob> => {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('آماده‌سازی تصویر برای پیوست انجام نشد.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return new Promise((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('فشرده‌سازی تصویر ناموفق بود.'))),
          'image/webp',
          quality,
        ),
      );
    };
    let compressed = await encode(2400, 0.86);
    if (compressed.size > MAX_MANUFACTURING_IMAGE_BYTES) compressed = await encode(1800, 0.72);
    if (compressed.size > MAX_MANUFACTURING_IMAGE_BYTES) {
      throw new Error('حجم تصویر برای ثبت درخواست ساخت زیاد است.');
    }
    return new File([compressed], safeBase + '.webp', {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

export interface AiVisualPartSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullScreen?: boolean;
  initialCamera?: boolean;
  standalone?: boolean;
  onAnalysisResult?: (result: AiPartAnalysisResult, image: string) => void;
}

type StudioScreen = 'entry' | 'camera' | 'review' | 'results';

type ManufacturingRequestDraft = {
  file: File;
  partName: string;
  partType: string;
  dimensions: string;
  alloyCondition: string;
  notes: string;
};

const CAMERA_ZOOM_PRESETS = [1, 1.5, 2, 3];

type CameraScanMode = 'deep' | 'quick';

interface QuickMotionDetection {
  label: string;
  motionPercent: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export const AiVisualPartSearchModal: React.FC<AiVisualPartSearchModalProps> = ({
  isOpen,
  onClose,
  initialCamera = false,
  standalone = false,
  fullScreen = false,
  onAnalysisResult,
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { segmentPart: segmentWithOnnx } = useOnnxPartSegmentation();

  const [screen, setScreen] = useState<StudioScreen>(initialCamera ? 'camera' : 'entry');

  // Image & automatic cutout state (zero manual corner dragging)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedSampleHint, setSelectedSampleHint] = useState('');
  const [selectedOriginalName, setSelectedOriginalName] = useState('');
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [queryRegion, setQueryRegion] = useState<ImageRegion>({
    x: 0.16,
    y: 0.16,
    width: 0.68,
    height: 0.68,
  });
  const [activePolygon, setActivePolygon] = useState<ContourPoint[] | null>(null);
  const [detectedCandidates, setDetectedCandidates] = useState<DetectedPartContour[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string>('auto-1');
  const [isDetectingParts, setIsDetectingParts] = useState(false);
  const [isAiSegmenting, setIsAiSegmenting] = useState(false);
  const [isTracingContour, setIsTracingContour] = useState(false);
  const [edgeLockFlash, setEdgeLockFlash] = useState<number | null>(null);
  const [tapRipple, setTapRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [regionDetectionId, setRegionDetectionId] = useState<string | null>(null);

  // Vault / upload state
  const [localImageId, setLocalImageId] = useState<string | null>(null);
  const [imageEventId, setImageEventId] = useState<string | null>(null);
  const [temporaryImageDataUrl, setTemporaryImageDataUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');

  // Live catalog match state
  const [isMatching, setIsMatching] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiPartAnalysisResult | null>(null);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);

  // Recent searches (localStorage)
  const [recentSearches, setRecentSearches] = useState<VisionRecentSearchItem[]>(() =>
    loadVisionRecentSearches(),
  );
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Camera state + Pinch Zoom + Quick Scan + First-Time Guide
  const [showVisionSplash, setShowVisionSplash] = useState(() => !initialCamera);
  const [scanMode, setScanMode] = useState<CameraScanMode>('deep');
  const [quickDetection, setQuickDetection] = useState<QuickMotionDetection | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [canUseTorch, setCanUseTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraNotice, setCameraNotice] = useState('');
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraGuideOpen, setCameraGuideOpen] = useState(false);
  const [cameraReviewImage, setCameraReviewImage] = useState<string | null>(null);
  const [cameraReviewHint, setCameraReviewHint] = useState('');

  // Custom manufacturing request & general errors
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [customRequestDraft, setCustomRequestDraft] = useState<ManufacturingRequestDraft | null>(null);
  const [customRequestOpen, setCustomRequestOpen] = useState(false);
  const [isPreparingCustomRequest, setIsPreparingCustomRequest] = useState(false);

  // Refs for cancellation & streams & pinch zoom
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraGalleryRef = useRef<HTMLInputElement | null>(null);
  const cameraStageRef = useRef<HTMLDivElement | null>(null);
  const lensBoxRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraZoomRef = useRef(1);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const hwZoomRangeRef = useRef<{ min: number; max: number } | null>(null);

  const cameraRequestRef = useRef(0);
  const pipelineSequenceRef = useRef(0);
  const customRequestSequenceRef = useRef(0);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const detectAbortRef = useRef<AbortController | null>(null);
  const userInteractedRef = useRef(false);
  const aiAlphaDataRef = useRef<AlphaMaskData | null>(null);
  const aiContoursRef = useRef<DetectedPartContour[]>([]);
  const geminiPartsRef = useRef<DetectedPartContour[]>([]);
  const latestRegionRef = useRef<ImageRegion>({ x: 0.16, y: 0.16, width: 0.68, height: 0.68 });
  const latestPolygonRef = useRef<ContourPoint[] | null>(null);
  const latestImageUrlRef = useRef<string | null>(null);
  const mobileResultsAnchorRef = useRef<HTMLDivElement | null>(null);
  const edgeLockTimerRef = useRef<number | null>(null);
  const motionPrevLumaRef = useRef<Uint8Array | null>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!showVisionSplash) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setShowVisionSplash(false), prefersReduced ? 120 : 900);
    return () => window.clearTimeout(timer);
  }, [showVisionSplash]);

  // Quick Scan highlights only motion measured from a real camera frame; it never invents a part category.
  useEffect(() => {
    if (!isOpen || screen !== 'camera' || scanMode !== 'quick') {
      motionPrevLumaRef.current = null;
      setQuickDetection(null);
      return;
    }

    const W = 120;
    const H = 90;
    if (!motionCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      motionCanvasRef.current = canvas;
    }

    const tick = () => {
      const canvas = motionCanvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      const video = videoRef.current;
      if (!canvas || !ctx || !isCameraReady || !video || !video.videoWidth || !video.videoHeight) {
        motionPrevLumaRef.current = null;
        setQuickDetection(null);
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const zoom = hwZoomRangeRef.current ? 1 : cameraZoomRef.current;
      const cropW = Math.max(1, vw / zoom);
      const cropH = Math.max(1, vh / zoom);
      ctx.drawImage(video, (vw - cropW) / 2, (vh - cropH) / 2, cropW, cropH, 0, 0, W, H);

      const pixels = ctx.getImageData(0, 0, W, H).data;
      const luma = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const offset = i * 4;
        luma[i] = Math.round(pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114);
      }

      const previous = motionPrevLumaRef.current;
      motionPrevLumaRef.current = luma;
      if (!previous) {
        setQuickDetection(null);
        return;
      }

      let motionPixels = 0;
      let minX = W;
      let maxX = -1;
      let minY = H;
      let maxY = -1;
      for (let y = 2; y < H - 2; y++) {
        for (let x = 2; x < W - 2; x++) {
          const index = y * W + x;
          if (Math.abs(luma[index] - previous[index]) <= 20) continue;
          motionPixels++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }

      const significant = motionPixels > 18 && maxX > minX + 6 && maxY > minY + 6;
      if (!significant) {
        setQuickDetection(null);
        return;
      }

      const x = Math.max(0, minX / W - 0.04);
      const y = Math.max(0, minY / H - 0.04);
      const width = Math.min(1 - x, Math.max(0.12, (maxX - minX) / W + 0.08));
      const height = Math.min(1 - y, Math.max(0.12, (maxY - minY) / H + 0.08));
      setQuickDetection({
        label: 'ناحیه دارای حرکت',
        motionPercent: Math.min(100, Math.round((motionPixels / (W * H)) * 420)),
        bbox: { x, y, w: width, h: height },
      });
    };

    tick();
    const id = window.setInterval(tick, 220);
    return () => window.clearInterval(id);
  }, [isOpen, screen, scanMode, isCameraReady]);

  const triggerEdgeLockAnimation = () => {
    const key = Date.now();
    setEdgeLockFlash(key);
    if (edgeLockTimerRef.current) {
      window.clearTimeout(edgeLockTimerRef.current);
    }
    edgeLockTimerRef.current = window.setTimeout(() => {
      setEdgeLockFlash((cur) => (cur === key ? null : cur));
    }, 1100);
  };

  useEffect(() => {
    latestImageUrlRef.current = selectedImage;
  }, [selectedImage]);

  useEffect(() => () => {
    const latest = latestImageUrlRef.current;
    if (latest?.startsWith('blob:')) URL.revokeObjectURL(latest);
  }, []);

  useEffect(() => {
    latestRegionRef.current = queryRegion;
  }, [queryRegion]);

  useEffect(() => {
    latestPolygonRef.current = activePolygon;
  }, [activePolygon]);

  useEffect(() => {
    cameraZoomRef.current = cameraZoom;
  }, [cameraZoom]);

  // Body scroll lock & Escape handler when in overlay mode
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('sanat-visual-search-open');
    const prevOverflow = !standalone ? document.body.style.overflow : '';
    if (!standalone) document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !standalone && !customRequestOpen) {
        stopCameraStream();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.classList.remove('sanat-visual-search-open');
      if (!standalone) document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, standalone, customRequestOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      cameraRequestRef.current++;
      stopCameraStream();
      pipelineSequenceRef.current++;
      customRequestSequenceRef.current++;
      analyzeAbortRef.current?.abort();
      analyzeAbortRef.current = null;
      detectAbortRef.current?.abort();
      detectAbortRef.current = null;
      setCustomRequestOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    void preloadClientAiSegmentation();
    const ctrl = new AbortController();
    fetch(apiUrl('/api/ai/local-vision-status'), { signal: ctrl.signal, cache: 'no-store' }).catch(
      () => undefined,
    );
    return () => ctrl.abort();
  }, [isOpen]);

  useEffect(() => {
    return () => {
      pipelineSequenceRef.current++;
      customRequestSequenceRef.current++;
      analyzeAbortRef.current?.abort();
      detectAbortRef.current?.abort();
      if (edgeLockTimerRef.current) {
        window.clearTimeout(edgeLockTimerRef.current);
      }
      stopCameraStream();
      if (latestImageUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(latestImageUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !initialCamera) return;
    void startCamera();
  }, [isOpen, initialCamera]);

  // Dedicated Pinch-to-Zoom ONLY on the camera viewfinder stage (stops browser page zoom!)
  const applyCameraZoom = (nextZoomRaw: number) => {
    const clamped = Math.max(1, Math.min(4, Number(nextZoomRaw.toFixed(2))));
    cameraZoomRef.current = clamped;
    setCameraZoom(clamped);

    const track = cameraStreamRef.current?.getVideoTracks()[0];
    const range = hwZoomRangeRef.current;
    if (track && range && range.max > range.min) {
      const targetHw = Math.max(
        range.min,
        Math.min(range.max, range.min + (clamped - 1) * ((range.max - range.min) / 3)),
      );
      void track
        .applyConstraints({
          advanced: [{ zoom: targetHw } as MediaTrackConstraintSet & { zoom: number }],
        })
        .catch(() => undefined);
    }
  };

  useEffect(() => {
    if (!isOpen || screen !== 'camera') return;
    const el = cameraStageRef.current;
    if (!el) return;

    const getTouchDistance = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchStartDistRef.current = getTouchDistance(e.touches);
        pinchStartZoomRef.current = cameraZoomRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDistRef.current) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches);
        const ratio = dist / Math.max(10, pinchStartDistRef.current);
        applyCameraZoom(pinchStartZoomRef.current * ratio);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDistRef.current = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.004;
      applyCameraZoom(cameraZoomRef.current + delta);
    };

    const blockBrowserGesture = (e: Event) => {
      e.preventDefault();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('gesturestart', blockBrowserGesture, { passive: false });
    document.addEventListener('gesturechange', blockBrowserGesture, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
      document.removeEventListener('gesturestart', blockBrowserGesture);
      document.removeEventListener('gesturechange', blockBrowserGesture);
    };
  }, [isOpen, screen]);

  if (!isOpen) return null;

  function stopCameraStream() {
    cameraRequestRef.current++;
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    hwZoomRangeRef.current = null;
    if (videoRef.current?.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
    setCanUseTorch(false);
    setTorchEnabled(false);
    setCameraZoom(1);
    cameraZoomRef.current = 1;
  }

  const dismissCameraGuide = () => {
    setCameraGuideOpen(false);
    try {
      window.localStorage.setItem(CAMERA_TIPS_SEEN_KEY, '1');
    } catch {
      // ignore storage error
    }
  };

  /**
   * Fetches catalog matches for a specific tight cutout region + updates cropped thumbnail & history.
   */
  const runRegionVisualMatch = async (opts: {
    imageSrc: string;
    region: ImageRegion;
    polygon?: ContourPoint[];
    alphaData?: AlphaMaskData | null;
    seq: number;
    displayUrl: string;
    sampleHint?: string;
    originalName?: string;
    mime?: string;
    stage?: AiAnalysisStage;
    savedLocalImageId?: string | null;
    imageEventId?: string | null;
    detectionId?: string | null;
    fullImage?: boolean;
  }) => {
    analyzeAbortRef.current?.abort();
    const analyzeController = new AbortController();
    analyzeAbortRef.current = analyzeController;

    setIsMatching(true);
    setErrorMessage('');

    try {
      const effectiveLocalImageId = opts.savedLocalImageId || localImageId;
      if (!effectiveLocalImageId) {
        throw new Error('تصویر در حافظه داخلی دستگاه ثبت نشده است؛ لطفاً تصویر را دوباره انتخاب کنید.');
      }
      const localRecord = await getCustomerDeviceImage(effectiveLocalImageId);
      if (analyzeController.signal.aborted || opts.seq !== pipelineSequenceRef.current) return;
      if (!localRecord) {
        throw new Error('تصویر اصلی در حافظه داخلی دستگاه پیدا نشد؛ لطفاً تصویر را دوباره انتخاب کنید.');
      }
      if (currentUser) await adoptCustomerDeviceImage(effectiveLocalImageId, currentUser.id);
      if (analyzeController.signal.aborted || opts.seq !== pipelineSequenceRef.current) return;

      const effectiveAlpha = opts.alphaData !== undefined ? opts.alphaData : null;
      let previewCutoutUrl: string | undefined;
      if (!opts.fullImage) {
        const cutout = await renderSegmentedVisionCutout(
          opts.imageSrc,
          opts.region,
          0,
          opts.polygon,
          effectiveAlpha,
        ).catch((): SegmentedVisionCutout => ({}));
        previewCutoutUrl = cutout.previewUrl || cutout.modelInputUrl;
      }

      if (analyzeController.signal.aborted || opts.seq !== pipelineSequenceRef.current) return;
      if (previewCutoutUrl) setCroppedPreviewUrl(previewCutoutUrl);

      let activeImageEventId: string | null =
        opts.imageEventId !== undefined ? opts.imageEventId : imageEventId;
      if (currentUser && !activeImageEventId) {
        try {
          const meta = await getCustomerDeviceImageMetadata(effectiveLocalImageId);
          if (meta) {
            const ev = await createCustomerImageIdentification({
              deviceImageId: meta.id,
              sha256: meta.sha256,
              mimeType: meta.mimeType,
              sizeBytes: meta.sizeBytes,
              originalName: meta.originalName,
            });
            activeImageEventId = ev.id;
            setImageEventId(ev.id);
          }
        } catch {
          // optional event logging in UI-only mode
        }
      }

      if (analyzeController.signal.aborted || opts.seq !== pipelineSequenceRef.current) return;
      // Keep the original Blob in IndexedDB; send the request-scoped compressed full image and let the production API crop by normalized region.
      const payloadImage = temporaryImageDataUrl || await customerImageBlobToDataUrl(localRecord.blob);
      const resolvedPayloadMime =
        payloadImage.match(/^data:([^;]+);base64,/i)?.[1] || localRecord.mimeType || opts.mime || mimeType;
      const croppedDataUrl = opts.fullImage ? payloadImage : previewCutoutUrl || opts.imageSrc;

      const result = await aiVisualSearchService.analyzePartWithAi(
        {
          imageBase64: payloadImage.startsWith('data:') ? payloadImage : undefined,
          imageUrl: payloadImage.startsWith('data:') ? undefined : payloadImage,
          mimeType: resolvedPayloadMime,
          stage: opts.stage || 'quick',
          observationOnly: false,
          region: opts.fullImage ? undefined : opts.region,
          detectionId: opts.fullImage ? undefined : opts.detectionId || regionDetectionId || undefined,
          fullImage: opts.fullImage === true,
          includeNearest: false,
        },
        undefined,
        analyzeController.signal,
      );

      if (analyzeController.signal.aborted || opts.seq !== pipelineSequenceRef.current) return;

      if (activeImageEventId) {
        void completeCustomerImageIdentification(activeImageEventId, {
          status: result.matchedProducts?.length || result.similarCandidates?.length ? 'completed' : 'unmatched',
          detectedPartType: result.summary?.detectedPartType,
          summary: result.summary?.whatYouSee || result.summary?.visualAnalysis,
          technicalAdvice: result.technicalAdvice,
          matchedProductCodes: (result.matchedProducts || []).map((m) => m.code),
          similarProductCodes: (result.similarCandidates || []).map((s) => s.code),
          confidence: result.summary?.confidence,
        }).catch(() => undefined);
      }

      const firstMatch = result.matchedProducts?.[0] || result.similarCandidates?.[0];
      const photo = result.catalogImageMatches?.find((item) =>
        firstMatch?.code && item.bindings?.some((binding) => binding.code === firstMatch.code)
      ) || result.catalogImageMatches?.[0];
      const historyCode = firstMatch?.code || photo?.bindings?.find((binding) => binding.verified && binding.code)?.code;
      const historyTitle = firstMatch?.name || photo?.label;
      if (historyCode && historyTitle) {
        setRecentSearches(recordVisionRecentSearch({
          code: historyCode,
          title: historyTitle,
          subtitle: firstMatch?.brand || '',
          imageUrl: firstMatch?.image || photo?.image,
          partHint: result.summary?.detectedPartType,
        }));
      }

      setAnalysisResult(result);
      if (result.matchedProducts?.length || result.similarCandidates?.length) {
        onAnalysisResult?.(result, croppedDataUrl || payloadImage);
      }
    } catch (err: any) {
      if (
        err?.name === 'AbortError' ||
        analyzeController.signal.aborted ||
        opts.seq !== pipelineSequenceRef.current
      ) {
        return;
      }
      setErrorMessage(err?.message || 'تطبیق تصویر کامل نشد؛ لطفاً دوباره تلاش کنید.');
    } finally {
      if (analyzeAbortRef.current === analyzeController) {
        analyzeAbortRef.current = null;
      }
      if (opts.seq === pipelineSequenceRef.current) {
        setIsMatching(false);
      }
    }
  };

  const runFullImageVisualMatch = () => {
    if (!selectedImage || !localImageId) return;
    const seq = ++pipelineSequenceRef.current;
    userInteractedRef.current = true;
    analyzeAbortRef.current?.abort();
    detectAbortRef.current?.abort();
    setIsDetectingParts(false);
    setIsAiSegmenting(false);
    setIsTracingContour(false);
    setErrorMessage('');
    setDetectedCandidates([]);
    setActiveCandidateId('');
    setActivePolygon([]);
    setCroppedPreviewUrl('');
    setMobileSheetExpanded(false);
    const fullRegion: ImageRegion = { x: 0, y: 0, width: 1, height: 1 };
    setQueryRegion(fullRegion);
    void runRegionVisualMatch({
      imageSrc: temporaryImageDataUrl || selectedImage,
      region: fullRegion,
      polygon: [],
      seq,
      displayUrl: selectedImage,
      sampleHint: '',
      originalName: selectedOriginalName || '',
      mime: mimeType,
      savedLocalImageId: localImageId,
      imageEventId,
      fullImage: true,
    });
  };

  /**
   * Instant-First Multi-Part Detection + Background Gemini Refinement:
   * Immediately isolates parts using local browser CV (~40ms), then runs
   * Gemini Vision in background to enrich part family labels & catch subtle parts.
   */
  const enrichWithGeminiInBackground = async (
    detectSrc: string,
    fullSrc: string,
    seq: number,
    localCandidates: DetectedPartContour[],
    displayUrl: string,
  ) => {
    detectAbortRef.current?.abort();
    const detectController = new AbortController();
    detectAbortRef.current = detectController;

    try {
      const serverDetection = await aiVisualSearchService
        .detectImageRegions(detectSrc, detectController.signal)
        .catch(() => null);
      if (detectController.signal.aborted || seq !== pipelineSequenceRef.current) return;
      const serverParts = serverDetection?.detectedParts || [];
      if (serverDetection?.detectionId) {
        setRegionDetectionId(serverDetection.detectionId);
      }
      if (serverParts.length === 0) return;

      const refinedServerParts = await Promise.all(
        serverParts.map((part) =>
          refineContourInsideRegion(fullSrc, part.region, part.center, 0, {
            id: part.id,
            label: part.label,
            partFamily: part.partFamily,
          }),
        ),
      );
      if (detectController.signal.aborted || seq !== pipelineSequenceRef.current) return;

      geminiPartsRef.current = refinedServerParts;
      const merged = fuseDetectionCandidates(
        aiContoursRef.current,
        refinedServerParts,
        localCandidates,
      );
      if (merged.length === 0) return;

      setDetectedCandidates(merged);
      // Keep the searched region stable. The user can select a newly refined candidate.

    } catch {
      // keep instant / client-AI contours silently
    } finally {
      if (detectAbortRef.current === detectController) {
        detectAbortRef.current = null;
      }
    }
  };

  /**
   * Direct Entry into Lens + Similar Products ('results'):
   * Runs lightweight client-side AI segmentation (`@imgly/background-removal` isnet_quint8)
   * alongside instant local CV & Gemini Vision detection so part boundaries lock accurately
   * and the background becomes uniformly pure white (#FFFFFF).
   */
  const launchDirectVisualResults = async (
    displayUrl: string,
    source: string | Blob,
    opts?: {
      originalName?: string;
      sampleHint?: string;
      mime?: string;
    },
  ) => {
    const seq = ++pipelineSequenceRef.current;
    userInteractedRef.current = false;
    aiAlphaDataRef.current = null;
    aiContoursRef.current = [];
    geminiPartsRef.current = [];
    analyzeAbortRef.current?.abort();
    detectAbortRef.current?.abort();

    if (selectedImage?.startsWith('blob:') && selectedImage !== displayUrl) {
      URL.revokeObjectURL(selectedImage);
    }
    stopCameraStream();

    setErrorMessage('');
    latestImageUrlRef.current = displayUrl;
    setSelectedImage(displayUrl);
    setCroppedPreviewUrl(null);
    setDetectedCandidates([]);
    setActivePolygon(null);
    setActiveCandidateId('auto-1');
    setTapRipple(null);
    setMobileSheetExpanded(false);
    setLocalImageId(null);
    setImageEventId(null);
    setSelectedOriginalName(opts?.originalName || 'customer-image');
    setSelectedSampleHint(opts?.sampleHint || '');
    setMimeType(opts?.mime || 'image/jpeg');
    setIsDetectingParts(true);
    setIsAiSegmenting(true);
    setIsTracingContour(false);
    setEdgeLockFlash(null);
    setIsMatching(true);
    setScreen('results');

    try {
      let resolvedUrl =
        typeof source === 'string' && source.startsWith('data:') ? source : displayUrl;
      let savedId: string | null = null;

      try {
        const blob =
          typeof source === 'string'
            ? await fetch(source, { credentials: 'same-origin', cache: 'no-store' }).then((r) => {
                if (!r.ok) throw new Error('خواندن تصویر انجام نشد.');
                return r.blob();
              })
            : source;
        const saved = await saveCustomerDeviceImage(
          blob,
          currentUser?.id || 'guest',
          opts?.originalName || 'customer-image',
        );
        if (seq !== pipelineSequenceRef.current) return;
        savedId = saved.id;
        setLocalImageId(saved.id);
        setMimeType(saved.mimeType || blob.type || 'image/jpeg');
        const localRecord = await getCustomerDeviceImage(saved.id);
        if (seq !== pipelineSequenceRef.current) return;
        if (!localRecord) throw new Error('تصویر پس از ذخیره‌سازی محلی قابل بازیابی نیست.');
        resolvedUrl = await customerImageBlobToDataUrl(localRecord.blob);
        if (seq !== pipelineSequenceRef.current) return;
      } catch (error) {
        if (seq !== pipelineSequenceRef.current) return;
        setErrorMessage(error instanceof Error ? error.message : 'ذخیره امن تصویر روی دستگاه انجام نشد.');
        throw error;
      }

      if (seq !== pipelineSequenceRef.current) return;
      const fastDetectUrl = await prepareFastVisionDetectionUrl(resolvedUrl, 860);
      if (seq !== pipelineSequenceRef.current) return;
      setTemporaryImageDataUrl(fastDetectUrl);

      // Phase 1: Instant client-side preview contour (~10ms) + kick off local onnxruntime-web segmentation
      const instantCvPromise = analyzeImageAutoContour(fastDetectUrl, 0);
      const aiSegPromise = segmentWithOnnx(fastDetectUrl);

      const instantCv = await instantCvPromise;
      if (seq !== pipelineSequenceRef.current) return;

      setIsDetectingParts(false);
      setIsTracingContour(false);
      setDetectedCandidates(instantCv.candidates);
      setActiveCandidateId(instantCv.primary.id);
      setQueryRegion(instantCv.primary.region);
      setActivePolygon(instantCv.primary.polygon);
      if (instantCv.primary.edgeLocked) {
        triggerEdgeLockAnimation();
      }

      // Phase 2: Run semantic Gemini detection & initial catalog matching in parallel with IS-Net
      void enrichWithGeminiInBackground(
        fastDetectUrl,
        fastDetectUrl,
        seq,
        instantCv.candidates,
        displayUrl,
      );

      // Phase 2b: Run IS-Net in background, then fuse safely via refineAutoContoursWithAiMask
      // so arms/hands/glare NEVER overwrite a compact held industrial part.
      void aiSegPromise
        .then(async (aiSeg) => {
          if (seq !== pipelineSequenceRef.current) return;
          setIsAiSegmenting(false);
          if (!aiSeg) return;

          const alphaData: AlphaMaskData = {
            width: aiSeg.width,
            height: aiSeg.height,
            alphaMask: aiSeg.alphaMask,
          };
          aiAlphaDataRef.current = alphaData;

          const refined = await refineAutoContoursWithAiMask(fastDetectUrl, alphaData, 0);
          if (seq !== pipelineSequenceRef.current) return;

          if (refined.candidates.length === 0) return;
          aiContoursRef.current = refined.candidates;

          const fused = fuseDetectionCandidates(
            refined.candidates,
            geminiPartsRef.current,
            instantCv.candidates,
          );
          if (fused.length === 0) return;

          if (!userInteractedRef.current) setDetectedCandidates(fused);

        })
        .catch(() => {
          if (seq === pipelineSequenceRef.current) setIsAiSegmenting(false);
        });

      await runRegionVisualMatch({
        imageSrc: fastDetectUrl,
        region: instantCv.primary.region,
        polygon: instantCv.primary.polygon,
        alphaData: null,
        seq,
        displayUrl,
        sampleHint: instantCv.primary.label || opts?.sampleHint,
        originalName: opts?.originalName,
        mime: opts?.mime,
        savedLocalImageId: savedId,
        imageEventId: null,
      });
    } catch {
      if (seq !== pipelineSequenceRef.current) return;
      setIsDetectingParts(false);
      setIsAiSegmenting(false);
      setIsMatching(false);
    }
  };

  /**
   * Computer-Vision Click-to-Trace Selection Handler:
   * - Clicking any pixel on a physical part traces/selects the ENTIRE object via cached CV scene.
   * - Clicking on empty background (no part present) leaves the current/default cutout untouched!
   */
  const handleImagePointSelect = async (normX: number, normY: number, dotCandidate?: DetectedPartContour) => {
    const activeSrc = temporaryImageDataUrl || selectedImage;
    const cutoutBaseSrc = temporaryImageDataUrl || selectedImage || activeSrc;
    if (!activeSrc || !cutoutBaseSrc) return;

    let nextContour: DetectedPartContour;
    let seq: number;

    if (dotCandidate) {
      userInteractedRef.current = true;
      seq = ++pipelineSequenceRef.current;
      setTapRipple({ x: normX * 100, y: normY * 100, key: Date.now() });

      if (dotCandidate.edgeLocked && dotCandidate.polygon.length >= 6) {
        nextContour = dotCandidate;
        setActiveCandidateId(dotCandidate.id);
      } else {
        setIsTracingContour(true);
        const segmented = await segmentPartAtTapPoint(
          activeSrc,
          dotCandidate.center.x,
          dotCandidate.center.y,
          0,
          {
            id: dotCandidate.id,
            label: dotCandidate.label,
            partFamily: dotCandidate.partFamily,
          },
        );
        if (seq !== pipelineSequenceRef.current) return;
        setIsTracingContour(false);
        nextContour = segmented || dotCandidate;
        setActiveCandidateId(nextContour.id);
        setDetectedCandidates((prev) =>
          prev.map((p) => (p.id === dotCandidate.id ? nextContour : p)),
        );
      }
    } else {
      const activeCand = detectedCandidates.find((c) => c.id === activeCandidateId);
      const activeRegion = activeCand?.region || queryRegion;
      const activeArea = activeRegion.width * activeRegion.height;
      const inActiveRect =
        normX >= activeRegion.x &&
        normX <= activeRegion.x + activeRegion.width &&
        normY >= activeRegion.y &&
        normY <= activeRegion.y + activeRegion.height;
      const isInsideActive =
        inActiveRect &&
        (activeCand?.polygon && activeCand.polygon.length >= 6
          ? isPointInsidePolygon(normX, normY, activeCand.polygon)
          : true);

      // Branch 1: Tapping inside an already-selected large whole assembly -> isolate distinct inner sub-part (e.g. center bearing)
      if (isInsideActive && activeArea > 0.20) {
        const innerCand = [...detectedCandidates]
          .filter((c) => {
            if (c.id === activeCandidateId) return false;
            const cArea = c.region.width * c.region.height;
            if (cArea >= activeArea * 0.62) return false;
            const inRect =
              normX >= c.region.x &&
              normX <= c.region.x + c.region.width &&
              normY >= c.region.y &&
              normY <= c.region.y + c.region.height;
            if (!inRect) return false;
            return c.polygon.length >= 6 ? isPointInsidePolygon(normX, normY, c.polygon) : true;
          })
          .sort((a, b) => a.region.width * a.region.height - b.region.width * b.region.height)[0];

        if (innerCand) {
          userInteractedRef.current = true;
          seq = ++pipelineSequenceRef.current;
          setTapRipple({ x: normX * 100, y: normY * 100, key: Date.now() });
          nextContour = innerCand;
          setActiveCandidateId(innerCand.id);
        } else {
          const seqBefore = pipelineSequenceRef.current;
          setIsTracingContour(true);
          const innerSeg = await segmentPartAtTapPoint(activeSrc, normX, normY, 0, undefined, {
            preferInnerAtTap: true,
            outerBound: activeRegion,
          });
          if (seqBefore !== pipelineSequenceRef.current) return;
          setIsTracingContour(false);
          if (!innerSeg) {
            return;
          }

          userInteractedRef.current = true;
          seq = ++pipelineSequenceRef.current;
          setTapRipple({ x: normX * 100, y: normY * 100, key: Date.now() });
          nextContour = innerSeg;
          setActiveCandidateId(nextContour.id);
          setDetectedCandidates((prev) => {
            const exists = prev.some((p) => p.id === nextContour.id);
            if (exists) return prev.map((p) => (p.id === nextContour.id ? nextContour : p));
            return prev.length ? [prev[0], nextContour, ...prev.slice(1)].slice(0, 6) : [nextContour];
          });
        }
      } else {
        // Branch 2: Tapping outside current selection (e.g. outer wheel rim while center bearing is active, or another part)
        const matchingOtherCand = [...detectedCandidates]
          .filter((c) => {
            if (c.id === activeCandidateId) return false;
            const inRect =
              normX >= c.region.x &&
              normX <= c.region.x + c.region.width &&
              normY >= c.region.y &&
              normY <= c.region.y + c.region.height;
            if (!inRect) return false;
            return c.polygon.length >= 6 ? isPointInsidePolygon(normX, normY, c.polygon) : true;
          })
          .sort((a, b) => {
            // If current selection is an inner sub-part, prefer restoring the enclosing whole assembly;
            // otherwise prefer the tightest distinct part under the cursor.
            const aArea = a.region.width * a.region.height;
            const bArea = b.region.width * b.region.height;
            return activeArea < 0.35 ? bArea - aArea : aArea - bArea;
          })[0];

        if (matchingOtherCand) {
          userInteractedRef.current = true;
          seq = ++pipelineSequenceRef.current;
          setTapRipple({ x: normX * 100, y: normY * 100, key: Date.now() });
          nextContour = matchingOtherCand;
          setActiveCandidateId(matchingOtherCand.id);
        } else {
          const seqBefore = pipelineSequenceRef.current;
          setIsTracingContour(true);
          const segmented = await segmentPartAtTapPoint(activeSrc, normX, normY, 0);
          if (seqBefore !== pipelineSequenceRef.current) return;
          setIsTracingContour(false);

          // Clicked empty background without a real physical part: keep default/current cutout intact!
          if (!segmented) {
            return;
          }

          userInteractedRef.current = true;
          seq = ++pipelineSequenceRef.current;
          setTapRipple({ x: normX * 100, y: normY * 100, key: Date.now() });

          const matchedExisting = detectedCandidates.find(
            (p) =>
              p.id === segmented.id ||
              (Math.hypot(p.center.x - segmented.center.x, p.center.y - segmented.center.y) < 0.06 &&
                Math.max(p.region.width * p.region.height, segmented.region.width * segmented.region.height) /
                  Math.max(1e-5, Math.min(p.region.width * p.region.height, segmented.region.width * segmented.region.height)) <
                  2.1),
          );

          nextContour = matchedExisting
            ? {
                ...segmented,
                id: matchedExisting.id,
                label: matchedExisting.label || segmented.label,
                partFamily: matchedExisting.partFamily || segmented.partFamily,
              }
            : segmented;

          setActiveCandidateId(nextContour.id);
          setDetectedCandidates((prev) => {
            const hasMatch = prev.some((p) => p.id === nextContour.id);
            if (hasMatch) {
              return prev.map((p) => (p.id === nextContour.id ? nextContour : p));
            }
            return prev.length ? [prev[0], nextContour, ...prev.slice(1)].slice(0, 6) : [nextContour];
          });
        }
      }
    }

    const isSameSelectionReady =
      nextContour.id === activeCandidateId &&
      Boolean(analysisResult) &&
      !errorMessage &&
      !isMatching &&
      Math.abs(nextContour.region.x - queryRegion.x) < 0.005 &&
      Math.abs(nextContour.region.width - queryRegion.width) < 0.005;

    setQueryRegion(nextContour.region);
    setActivePolygon(nextContour.polygon);
    triggerEdgeLockAnimation();

    if (isSameSelectionReady) {
      return;
    }

    const nextHint =
      nextContour.label ||
      (detectedCandidates.length > 1 && nextContour.id !== detectedCandidates[0]?.id ? '' : selectedSampleHint);

    await runRegionVisualMatch({
      imageSrc: cutoutBaseSrc,
      region: nextContour.region,
      polygon: nextContour.polygon,
      alphaData: nextContour.fromAiMask ? aiAlphaDataRef.current : null,
      seq,
      displayUrl: selectedImage || cutoutBaseSrc,
      sampleHint: nextHint,
      originalName: '',
    });
  };

  const handlePhotoSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = lensBoxRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return;
    const normX = Math.max(0.02, Math.min(0.98, (e.clientX - box.left) / box.width));
    const normY = Math.max(0.02, Math.min(0.98, (e.clientY - box.top) / box.height));
    void handleImagePointSelect(normX, normY);
  };

  const handleFile = (file: File) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const fileMime = (file.type || '').toLowerCase();
    const okExt = /\.(?:jpe?g|png|webp)$/i.test(file.name);
    if ((fileMime ? !allowed.includes(fileMime) : !okExt) || file.size > 10 * 1024 * 1024) {
      setErrorMessage('لطفاً تصویر JPG، PNG یا WebP با حجم حداکثر ۱۰ مگابایت انتخاب کنید.');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    void launchDirectVisualResults(objectUrl, file, {
      originalName: file.name,
      sampleHint: file.name,
      mime: file.type || 'image/jpeg',
    });
  };

  const handleRecentClick = (item: VisionRecentSearchItem) => {
    if (!item.imageUrl) {
      setErrorMessage('تصویر این جستجوی قبلی ذخیره نشده است؛ لطفاً تصویر قطعه را دوباره بارگذاری کنید.');
      return;
    }
    void launchDirectVisualResults(item.imageUrl, item.imageUrl, {
      originalName: item.code || item.id,
      sampleHint: `${item.title} ${item.partHint || ''} ${item.code || ''}`.trim(),
      mime: 'image/png',
    });
  };

  // Camera actions
  const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    const req = ++cameraRequestRef.current;
    setScreen('camera');
    setIsCameraReady(false);
    setCameraNotice('');
    setErrorMessage('');
    setCameraZoom(1);
    cameraZoomRef.current = 1;

    try {
      const seen = window.localStorage.getItem(CAMERA_TIPS_SEEN_KEY);
      if (!seen) setCameraGuideOpen(true);
    } catch {
      setCameraGuideOpen(true);
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('دوربین زنده در این مرورگر فعال نیست.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (req !== cameraRequestRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      cameraStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const cap = track?.getCapabilities?.() as
        | (MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number } })
        | undefined;
      setCanUseTorch(Boolean(facing === 'environment' && cap?.torch));
      hwZoomRangeRef.current =
        cap?.zoom && typeof cap.zoom.min === 'number' && typeof cap.zoom.max === 'number'
          ? { min: cap.zoom.min, max: cap.zoom.max }
          : null;
      setTorchEnabled(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setIsCameraReady(false);
      setCameraNotice('دوربین متصل نیست؛ می‌توانید عکس گالری را باز کنید یا میز نور آزمایشی را ثبت نمایید.');
    }
  };

  const switchCamera = () => {
    const next = cameraFacing === 'environment' ? 'user' : 'environment';
    stopCameraStream();
    setCameraFacing(next);
    void startCamera(next);
  };

  const toggleTorch = async () => {
    const track = cameraStreamRef.current?.getVideoTracks()[0];
    if (!canUseTorch || !track) return;
    try {
      const nextTorch = !torchEnabled;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet & { torch: boolean }],
      });
      setTorchEnabled(nextTorch);
    } catch {
      setCanUseTorch(false);
    }
  };

  const captureCameraFrame = (quickCategoryHint?: string) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!isCameraReady || !video || !canvas || !video.videoWidth || !video.videoHeight) {
      setErrorMessage('دوربین هنوز تصویر واقعی و آماده‌ای برای ثبت ندارد. لطفاً کمی صبر کنید یا از گالری استفاده کنید.');
      return;
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const digitalZoom = hwZoomRangeRef.current ? 1 : cameraZoomRef.current;
    const cropWidth = Math.max(1, Math.round(videoWidth / digitalZoom));
    const cropHeight = Math.max(1, Math.round(videoHeight / digitalZoom));
    const sourceX = Math.round((videoWidth - cropWidth) / 2);
    const sourceY = Math.round((videoHeight - cropHeight) / 2);

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setErrorMessage('آماده‌سازی تصویر دوربین انجام نشد. دوباره تلاش کنید.');
      return;
    }

    context.drawImage(video, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    if (!dataUrl.startsWith('data:image/jpeg;base64,')) {
      setErrorMessage('ثبت تصویر دوربین ناموفق بود. دوباره تلاش کنید.');
      return;
    }

    setCameraReviewImage(dataUrl);
    setCameraReviewHint(quickCategoryHint || '');
    setCameraGuideOpen(false);
    setErrorMessage('');
    stopCameraStream();
    setScreen('review');
  };

  const retakeCameraPhoto = () => {
    setCameraReviewImage(null);
    setCameraReviewHint('');
    setErrorMessage('');
    setScreen('camera');
    void startCamera();
  };

  const confirmCameraPhoto = () => {
    if (!cameraReviewImage) return;
    const image = cameraReviewImage;
    const hint = cameraReviewHint;
    setCameraReviewImage(null);
    setCameraReviewHint('');
    void launchDirectVisualResults(image, image, {
      originalName: 'camera-capture.jpg',
      sampleHint: hint,
      mime: 'image/jpeg',
    });
  };

  const handleCloseAction = () => {
    stopCameraStream();
    setCameraReviewImage(null);
    setCameraReviewHint('');
    customRequestSequenceRef.current++;
    const latest = latestImageUrlRef.current;
    if (latest?.startsWith('blob:')) URL.revokeObjectURL(latest);
    latestImageUrlRef.current = null;
    pipelineSequenceRef.current++;
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    detectAbortRef.current?.abort();
    detectAbortRef.current = null;
    if (standalone) {
      goBackOrFallback(navigate, '/');
    } else {
      onClose();
    }
  };

  const openCustomManufacturingRequest = async () => {
    if (isPreparingCustomRequest || !selectedImage) return;
    const reqSeq = ++customRequestSequenceRef.current;
    setIsPreparingCustomRequest(true);
    setErrorMessage('');
    try {
      let imageBlob: Blob | null = null;
      let originalName = selectedOriginalName || 'forza-part-image';
      if (localImageId) {
        const localRec = await getCustomerDeviceImage(localImageId).catch(() => null);
        if (reqSeq !== customRequestSequenceRef.current || !isOpen) return;
        if (localRec) {
          imageBlob = localRec.blob;
          originalName = localRec.originalName || originalName;
        }
      }
      if (!imageBlob) {
        const res = await fetch(croppedPreviewUrl || temporaryImageDataUrl || selectedImage);
        if (!res.ok) throw new Error('خواندن تصویر انجام نشد.');
        imageBlob = await res.blob();
      }
      if (reqSeq !== customRequestSequenceRef.current || !isOpen) return;
      const file = await createManufacturingImageFile(imageBlob, originalName);
      if (reqSeq !== customRequestSequenceRef.current || !isOpen) return;
      const summary = analysisResult?.summary;
      const detectedName = [summary?.partFamilyFarsi, summary?.detectedPartType]
        .map((v) => String(v || '').trim())
        .find((v) => v.length > 1 && !/قطعه نامشخص|نامشخص/i.test(v));
      const observedDimensions = (summary?.observedSpecifications || [])
        .filter((spec) => String(spec.value || '').trim())
        .map((spec) => `${spec.name || 'مشخصه'}: ${String(spec.value).trim()}`)
        .join('، ')
        .slice(0, 480);
      const unknownParameters = (summary?.unknownParameters || []).filter(Boolean);
      const regionNote = queryRegion
        ? `ناحیه انتخاب‌شده در تصویر: x=${queryRegion.x.toFixed(4)}, y=${queryRegion.y.toFixed(4)}, width=${queryRegion.width.toFixed(4)}, height=${queryRegion.height.toFixed(4)} (مختصات نسبی تصویر).`
        : 'درخواست بر اساس تصویر کامل ارسالی ثبت شده است.';
      const visualSummary = String(summary?.visualAnalysis || summary?.whatYouSee || 'در کاتالوگ، تطابق تصویری کافی پیدا نشد.').trim();

      setCustomRequestDraft({
        file,
        partName: detectedName || 'قطعه صنعتی برای بررسی و ساخت سفارشی',
        partType: 'سایر قطعات مکانیکی خاص',
        dimensions: observedDimensions,
        alloyCondition: String(summary?.material || ''),
        notes: [
          'درخواست ساخت و مهندسی معکوس از جستجوی تصویری FORZA ثبت شده است.',
          'خلاصه بررسی تصویر: ' + visualSummary,
          analysisResult?.technicalAdvice ? 'توصیه فنی اولیه: ' + analysisResult.technicalAdvice : '',
          unknownParameters.length ? 'پارامترهای نیازمند اندازه‌گیری یا تأیید: ' + unknownParameters.join('، ') : '',
          regionNote,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 2800),
      });
      setCustomRequestOpen(true);
    } catch (error: any) {
      setErrorMessage(error?.message || 'آماده‌سازی تصویر برای ثبت سفارش ساخت انجام نشد.');
    } finally {
      if (reqSeq === customRequestSequenceRef.current) setIsPreparingCustomRequest(false);
    }
  };

  // UNIFIED Catalog Product Grid (NEVER splits exact matches vs similar)
  const unifiedProducts = analysisResult
    ? [
        ...(analysisResult.matchedProducts || []),
        ...(analysisResult.similarCandidates || []),
      ].filter((item, idx, self) => idx === self.findIndex((t) => t.code === item.code))
    : [];

  const displayedRecentSearches = showAllHistory ? recentSearches : recentSearches.slice(0, 6);

  const navigateConsult = (code: string, name: string, brand: string, isSimilar: boolean) => {
    if (imageEventId) {
      void selectCustomerImageProduct(imageEventId, code).catch(() => undefined);
    }
    const q = buildVisionConsultationPrompt({ code, name, brand, isSimilar }, analysisResult?.summary);
    const params = new URLSearchParams({
      productCode: code,
      productName: name,
      ...(q ? { q } : {}),
    });
    onClose();
    navigate('/ai-consult?' + params.toString());
  };

  const shellPositionClass = standalone
    ? 'fv-workbench'
    : 'fv-workbench fixed inset-0 z-[110] overflow-y-auto';

  const digitalPreviewZoom = hwZoomRangeRef.current ? 1 : cameraZoom;

  const renderUnifiedProductCard = (item: (typeof unifiedProducts)[number]) => {
    const product = item.catalogProduct;
    const resolvedPrice =
      product && product.prices
        ? pricingCreditService.calculateInquiryPrice(
            product,
            currentUser?.assignedPriceListId || undefined,
          )?.calculatedPrice ||
          product.prices.retail ||
          0
        : 0;

    return (
      <article
        key={item.code}
        className="group flex flex-col rounded-2xl border border-[#E7E8EC] bg-[#FFFFFF] p-2.5 transition-all duration-150 hover:border-[#E06518]/65 hover:shadow-[0_10px_28px_-14px_rgba(43,49,58,0.18)]"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#F5F6F6] border border-[#E7E8EC]/60">
          <CatalogResultImage
            sources={[item.image, product?.image]}
            alt={item.name}
            familyReference={false}
            hideZoomPill
            cleanSurface
            className="h-full w-full"
          />
        </div>

        <div className="flex flex-1 flex-col gap-1 pt-2.5 px-1">
          <h4 className="line-clamp-2 text-[12.5px] sm:text-[13px] font-bold leading-snug text-[#2B313A]">
            {item.name}
          </h4>

          <div className="mt-1 flex items-center justify-between gap-2">
            {resolvedPrice > 0 ? (
              <span className="text-[13px] font-extrabold text-[#2B313A] tabular-nums">
                {formatPrice(resolvedPrice)}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-700">موجود در کاتالوگ</span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-[#F3F4F6] text-[11px] text-[#74757C]">
            <span className="truncate">
              {item.brand} · <span className="font-mono text-[#55565A]">{item.code}</span>
            </span>

            {product ? (
              <Link
                to={`/product/${product.code}`}
                onClick={() => onClose()}
                className="inline-flex items-center gap-0.5 shrink-0 font-bold text-[#E06518] hover:text-[#C95210] transition-colors whitespace-nowrap"
              >
                <span>مشاهده</span>
                <ArrowUpLeft className="h-3 w-3" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => navigateConsult(item.code, item.name, item.brand, true)}
                className="inline-flex items-center gap-0.5 shrink-0 font-bold text-[#E06518] hover:text-[#C95210] transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>مشاوره</span>
                <ArrowUpLeft className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div
      className={shellPositionClass}
      dir="rtl"
      data-fullscreen={standalone || fullScreen || initialCamera ? 'true' : 'false'}
      role={standalone ? 'main' : 'dialog'}
      aria-modal={standalone ? undefined : 'true'}
      aria-label="جستجوی تصویری قطعات صنعتی FORZA VISION"
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="انتخاب تصویر قطعه از دستگاه"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) handleFile(f);
          e.currentTarget.value = '';
        }}
      />

      {/* Top-to-Bottom FORZA Logo Entry Transition Curtain */}
      <AnimatePresence>
        {showVisionSplash && screen === 'entry' && (
          <motion.div
            key="forza-vision-entry-curtain"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: 24, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
            onClick={() => setShowVisionSplash(false)}
            className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-[#FFFFFF] cursor-pointer select-none px-6"
            aria-label="ورود به اسکنر هوشمند FORZA VISION"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-45"
              style={{
                backgroundImage:
                  'linear-gradient(#dfe3e6 1px, transparent 1px), linear-gradient(90deg, #dfe3e6 1px, transparent 1px)',
                backgroundSize: '44px 44px',
                maskImage: 'radial-gradient(circle at center, #000 18%, transparent 72%)',
              }}
            />

            <motion.div
              initial={{ y: -56, opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
              animate={{ y: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
              transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col items-center"
            >
              <img
                src="/assets/aistudio/logo-forza_9b7fcf6e.png"
                alt="لوگوی FORZA"
                className="w-64 sm:w-80 md:w-[360px] h-auto object-contain drop-shadow-[0_12px_32px_rgba(224,101,24,0.18)]"
              />
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.22, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                className="mt-5 h-[2.5px] w-36 rounded-full bg-gradient-to-r from-transparent via-[#E06518] to-transparent origin-center"
              />
              <motion.p
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.28, duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                className="mt-3 text-xs sm:text-sm font-bold text-[#55565A] tracking-tight"
              >
                شناسایی هوشمند قطعات FORZA VISION · تطبیق کاتالوگ اطلس
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* SCREEN: PRECISION OPTICAL CAMERA VIEWFINDER + GUIDE OVERLAY          */}
      {/* ==================================================================== */}
      {screen === 'camera' && (
        <motion.section
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[120] flex flex-col bg-[#0B0E13] text-white touch-none"
          data-testid="full-screen-camera-experience"
          aria-label="دوربین هوشمند شناسایی قطعه"
        >
          {/* Sleek Optical HUD Header */}
          <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#141820]/95 px-3 sm:px-6 h-14 backdrop-blur-md shrink-0">
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                if (selectedImage) {
                  setScreen('results');
                } else if (initialCamera) {
                  handleCloseAction();
                } else {
                  setScreen('entry');
                }
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <span>بازگشت</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/assets/aistudio/logo-forza_9b7fcf6e.png"
                alt="FORZA"
                className="h-6 sm:h-7 w-auto object-contain shrink-0"
              />
              <span className="h-2 w-2 rounded-full bg-[#E06518] shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap tabular-nums">
                LENS · {toPersianDigits(cameraZoom)}×
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setCameraGuideOpen((v) => !v)}
                aria-label="راهنمای عکاسی"
                aria-expanded={cameraGuideOpen}
                className={`grid h-10 w-10 place-items-center rounded-xl border transition-colors cursor-pointer ${
                  cameraGuideOpen
                    ? 'border-[#E06518] bg-[#E06518] text-white'
                    : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void toggleTorch()}
                disabled={!canUseTorch}
                aria-label="فلش دوربین"
                aria-pressed={torchEnabled}
                className={`grid h-10 w-10 place-items-center rounded-xl border transition-colors cursor-pointer disabled:opacity-35 ${
                  torchEnabled
                    ? 'border-[#E06518] bg-[#E06518] text-white'
                    : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                <Zap className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleCloseAction}
                aria-label="بستن"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/5 text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Camera-only Pinch Zoom Viewfinder Stage */}
          <div
            ref={cameraStageRef}
            className="sanat-camera-experience__stage fv-camera-stage relative flex-1 flex items-center justify-center overflow-hidden bg-[#07090D] p-3 sm:p-6"
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onCanPlay={() => setIsCameraReady(true)}
              style={{
                transform: `scale(${digitalPreviewZoom})`,
                transformOrigin: 'center center',
              }}
              className={`h-full w-full max-w-4xl rounded-2xl object-cover transition-transform duration-75 ${
                isCameraReady ? 'opacity-100' : 'hidden'
              }`}
            />

            {!isCameraReady && (
              <div className="relative flex h-full w-full max-w-4xl flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/12 bg-[#12161E] p-6 text-center">
                <Camera className="h-12 w-12 text-white/45" aria-hidden="true" />
                <p className="text-sm font-bold text-white">
                  {cameraNotice || 'در حال آماده‌سازی دوربین…'}
                </p>
                <p className="max-w-sm text-xs leading-6 text-slate-300">
                  تا زمانی که تصویر واقعی دوربین آماده نشده، امکان ثبت یا تحلیل تصویر وجود ندارد.
                </p>
              </div>
            )}

            {/* Rule-of-Thirds Calibrated Grid Overlay */}
            <div className="pointer-events-none absolute inset-0 mx-auto max-w-4xl opacity-15">
              <div className="h-full w-full grid grid-cols-3 grid-rows-3">
                <div className="border-l border-b border-white/50" />
                <div className="border-l border-b border-white/50" />
                <div className="border-b border-white/50" />
                <div className="border-l border-b border-white/50" />
                <div className="border-l border-b border-white/50" />
                <div className="border-b border-white/50" />
                <div className="border-l border-white/50" />
                <div className="border-l border-white/50" />
                <div />
              </div>
            </div>

            {/* Quick Scan vs Deep AI Mode Toggle Bar */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-15 flex items-center gap-1 rounded-full border border-white/20 bg-[#141820]/90 p-1 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={() => setScanMode('deep')}
                aria-pressed={scanMode === 'deep'}
                className={`min-h-[32px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  scanMode === 'deep'
                    ? 'bg-[#E06518] text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>هوش مصنوعی عمیق</span>
              </button>
              <button
                type="button"
                onClick={() => setScanMode('quick')}
                aria-pressed={scanMode === 'quick'}
                className={`min-h-[32px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  scanMode === 'quick'
                    ? 'bg-[#E06518] text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>اسکن سریع</span>
              </button>
            </div>

            {/* Real-Time Motion Tracking Bounding Box (When Quick Scan is Active) */}
            {scanMode === 'quick' && quickDetection && (
              <div className="pointer-events-none absolute inset-0 mx-auto max-w-4xl">
                <div
                  style={{
                    left: `${quickDetection.bbox.x * 100}%`,
                    top: `${quickDetection.bbox.y * 100}%`,
                    width: `${quickDetection.bbox.w * 100}%`,
                    height: `${quickDetection.bbox.h * 100}%`,
                  }}
                  className="absolute rounded-2xl border-2 border-[#E06518] bg-[#E06518]/10 transition-all duration-200 shadow-[0_0_24px_rgba(224,101,24,0.3)]"
                >
                  <div className="absolute -top-7 right-0 inline-flex items-center gap-1.5 rounded-full bg-[#E06518] px-2.5 py-0.5 text-[11px] font-bold text-white whitespace-nowrap shadow">
                    <Activity className="h-3 w-3 animate-pulse" aria-hidden="true" />
                    <span>{quickDetection.label}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Precision Reticle Frame + Laser Sweep + Photography Tip */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8">
              <div className="mb-4 max-w-sm rounded-full border border-white/20 bg-[#141820]/85 px-4 py-1.5 text-center text-[11px] font-semibold text-amber-200 backdrop-blur-md">
                {scanMode === 'quick'
                  ? 'اسکن سریع فعال است: ناحیه دارای حرکت برای بررسی مشخص می‌شود'
                  : 'برای تسمه‌ها: مستقیم روبه‌روی برند و اطلاعات درج‌شده روی تسمه عکس بگیرید و بفرستید'}
              </div>
              <div className="fv-corner-brackets h-[min(64vw,290px)] w-[min(64vw,290px)] rounded-2xl overflow-hidden">
                <div className="fv-scan-laser" />
              </div>
            </div>

            {/* First-time Camera Photography Guide Overlay */}
            <AnimatePresence>
              {cameraGuideOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                  role="dialog"
                  aria-label="نکات عکاسی دقیق از قطعه"
                >
                  <motion.div
                    initial={{ y: -18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-md max-h-[86dvh] overflow-y-auto rounded-2xl border border-white/15 bg-[#181C24] p-5 text-white shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
                      <div>
                        <span className="text-[11px] font-bold text-[#FF8C42]">راهنمای عکاسی صنعتی FORZA</span>
                        <h3 className="mt-1 text-base font-extrabold">
                          نکات کلیدی برای تشخیص دقیق‌تر قطعه
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={dismissCameraGuide}
                        aria-label="بستن راهنما"
                        className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-slate-200 hover:bg-white/20 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-start gap-3 rounded-xl border border-[#E06518]/50 bg-[#E06518]/12 p-3">
                        <Focus className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8C42]" aria-hidden="true" />
                        <div>
                          <p className="text-xs font-bold text-white">برای تسمه‌ها: مستقیم روبه‌روی برند و کد تسمه</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-200">
                            دوربین را مستقیم روبه‌روی برند و نوشته‌های روی تسمه بگیرید تا شماره فنی و پروفیل کامل خوانده شود.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <Sun className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8C42]" aria-hidden="true" />
                        <div>
                          <p className="text-xs font-bold text-white">نور یکنواخت و زاویه عمود</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                            دوربین را مستقیم بالای قطعه نگه دارید تا فرم دندانه‌ها و شیارها بدون سایه تند دیده شود.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <ZoomIn className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8C42]" aria-hidden="true" />
                        <div>
                          <p className="text-xs font-bold text-white">بزرگ‌نمایی دو انگشتی (Pinch Zoom)</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                            برای خواندن کدهای حک‌شده روی بلبرینگ یا پولی، دو انگشت را روی تصویر باز کنید یا از دکمه‌های ۱× تا ۳× استفاده کنید.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={dismissCameraGuide}
                      className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#E06518] text-sm font-bold text-white hover:bg-[#C95210] transition-colors cursor-pointer"
                    >
                      متوجه شدم، شروع عکاسی
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Quick Scan Category Lock Pill + Zoom Preset Bar */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
              {scanMode === 'quick' && quickDetection && (
                <button
                  type="button"
                  onClick={() => captureCameraFrame(quickDetection.label)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E06518] bg-[#141820]/95 px-4 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md hover:bg-[#E06518] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Activity className="h-3.5 w-3.5 text-[#FF8C42]" aria-hidden="true" />
                  <span>بررسی ناحیه</span>
                  <span className="text-[10px] opacity-80 tabular-nums">
                    (تحرک {toPersianDigits(quickDetection.motionPercent)}٪)
                  </span>
                </button>
              )}

              <div className="flex items-center gap-1 rounded-full border border-white/15 bg-[#141820]/90 px-2 py-1 backdrop-blur-md">
                {CAMERA_ZOOM_PRESETS.map((z) => {
                  const active = Math.abs(cameraZoom - z) < 0.22;
                  return (
                    <button
                      key={z}
                      type="button"
                      onClick={() => applyCameraZoom(z)}
                      className={`min-h-[30px] rounded-full px-3 py-1 text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#E06518] text-white'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {toPersianDigits(z)}×
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tactile Hardware-Grade Shutter Footer */}
          <footer className="border-t border-white/10 bg-[#141820] px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">
            <div className="mx-auto flex max-w-md items-center justify-between gap-6">
              <button
                type="button"
                onClick={() => cameraGalleryRef.current?.click()}
                aria-label="انتخاب عکس از گالری"
                className="flex flex-col items-center gap-1 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                  <GalleryImage className="h-5 w-5" />
                </span>
                <span>گالری</span>
              </button>

              <button
                type="button"
                onClick={() => captureCameraFrame()}
                disabled={!isCameraReady}
                aria-label="ثبت تصویر قطعه"
                className="group relative grid h-[74px] w-[74px] place-items-center rounded-full border-[3px] border-white p-1.5 transition-transform active:scale-95 cursor-pointer shadow-[0_0_24px_rgba(224,101,24,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="h-full w-full rounded-full bg-[#E06518] transition-colors group-hover:bg-[#f07428]" />
              </button>

              <button
                type="button"
                onClick={switchCamera}
                aria-label="تغییر دوربین"
                className="flex flex-col items-center gap-1 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                  <SwitchCamera className="h-5 w-5" />
                </span>
                <span>چرخش</span>
              </button>
            </div>
            <input
              ref={cameraGalleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = '';
              }}
            />
          </footer>
          <canvas ref={canvasRef} className="sr-only" />
        </motion.section>
      )}

      {screen === 'review' && cameraReviewImage && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="fixed inset-0 z-[120] flex flex-col bg-[#0B0E13] text-white"
          data-testid="kiki-vision-review-shell"
          aria-label="بازبینی تصویر ثبت‌شده"
        >
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#141820] px-4">
            <button type="button" onClick={retakeCameraPhoto} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              بازگشت به دوربین
            </button>
            <span className="text-sm font-black">بازبینی تصویر</span>
            <button type="button" onClick={handleCloseAction} aria-label="بستن" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/5">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-8">
            <img
              src={cameraReviewImage}
              alt="تصویر واقعی ثبت‌شده از قطعه"
              className="max-h-full max-w-full rounded-2xl border border-white/15 object-contain shadow-2xl"
            />
          </div>
          <footer className="shrink-0 border-t border-white/10 bg-[#141820] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={retakeCameraPhoto}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-bold text-white hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                عکس‌برداری مجدد
              </button>
              <button
                type="button"
                onClick={confirmCameraPhoto}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#E06518] px-5 text-sm font-black text-white hover:bg-[#C95210]"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                تأیید و شناسایی قطعه
              </button>
            </div>
          </footer>
        </motion.section>
      )}

      {/* ==================================================================== */}
      {/* SCREEN: INTERACTIVE LENS SPOTLIGHT + WEBSITE-STYLED CATALOG SHEET    */}
      {/* ==================================================================== */}
      {screen === 'results' && selectedImage && (
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex min-h-[100dvh] lg:h-[100dvh] flex-col bg-[#FFFFFF] text-[#2B313A] lg:overflow-hidden"
          aria-label="لنز هوشمند و محصولات مشابه"
          data-testid="kiki-vision-results-shell"
          data-vision-journey="true"
        >
          <div data-testid="forza-vision-two-panel-layout" className="flex flex-1 flex-col lg:grid lg:grid-cols-12 lg:h-full lg:overflow-hidden">
            {/* -------------------------------------------------------------- */}
            {/* PHOTO & CONTOUR LENS STAGE (Mobile Top Split / Desktop Right)   */}
            {/* -------------------------------------------------------------- */}
            <div data-testid="forza-vision-photo-lens" className="relative flex shrink-0 flex-col bg-[#F5F6F6] lg:col-span-5 lg:h-full lg:border-l lg:border-[#DFE3E6]">
              {/* Top Floating Controls */}
              <div data-testid="forza-vision-optical-toolbar" className="pointer-events-none absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-3 sm:px-5 pt-3.5">
                <button
                  type="button"
                  onClick={handleCloseAction}
                  aria-label="بستن جستجوی تصویری"
                  className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-[#2B313A]/85 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-[#2B313A] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>

                <div className="pointer-events-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#2B313A]/85 px-3.5 text-xs font-bold text-white shadow-sm backdrop-blur-md transition-colors hover:bg-[#E06518] whitespace-nowrap cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>دوربین</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      setScreen('entry');
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#2B313A]/85 px-3.5 text-xs font-bold text-white shadow-sm backdrop-blur-md transition-colors hover:bg-[#2B313A] whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>عکس جدید</span>
                  </button>
                </div>
              </div>

              {/* Interactive Optical Spotlight Stage */}
              <div className="relative flex flex-1 h-[39dvh] min-h-[240px] max-h-[360px] lg:h-full lg:max-h-none items-center justify-center bg-[#F5F6F6] px-3 pt-14 pb-8 lg:p-6">
                <div
                  ref={lensBoxRef}
                  onClick={handlePhotoSurfaceClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleImagePointSelect(0.5, 0.5);
                  }}
                  aria-label="برای انتخاب هر قطعه در تصویر روی آن ضربه بزنید"
                  className="relative inline-block max-w-full max-h-full overflow-hidden rounded-2xl bg-[#FFFFFF] border border-[#DFE3E6] shadow-sm cursor-crosshair select-none"
                >
                  <img
                    src={selectedImage}
                    alt="تصویر قطعه ارسالی"
                    className="block max-h-[29dvh] sm:max-h-[34dvh] lg:max-h-[72dvh] max-w-full w-auto h-auto object-contain select-none"
                  />

                  {/* Clean Rounded L-Corner Crop Frame & Dimmed Outside Mask */}
                  <div
                    aria-hidden="true"
                    style={{
                      left: `${queryRegion.x * 100}%`,
                      top: `${queryRegion.y * 100}%`,
                      width: `${queryRegion.width * 100}%`,
                      height: `${queryRegion.height * 100}%`,
                    }}
                    className={`fv-lens-bracket fv-lens-bracket--box-mask ${edgeLockFlash ? 'fv-lens-bracket--locking' : ''}`}
                  >
                    <span className="fv-lens-corner fv-lens-corner--tl" />
                    <span className="fv-lens-corner fv-lens-corner--tr" />
                    <span className="fv-lens-corner fv-lens-corner--bl" />
                    <span className="fv-lens-corner fv-lens-corner--br" />
                  </div>

                  {/* Single Active Center Copper Indicator Dot */}
                  {(() => {
                    const activeCand = detectedCandidates.find((c) => c.id === activeCandidateId);
                    const dotCenter = activeCand
                      ? activeCand.center
                      : {
                          x: queryRegion.x + queryRegion.width / 2,
                          y: queryRegion.y + queryRegion.height / 2,
                        };
                    return (
                      <span
                        aria-hidden="true"
                        style={{
                          left: `${dotCenter.x * 100}%`,
                          top: `${dotCenter.y * 100}%`,
                        }}
                        className="fv-object-dot fv-object-dot--active pointer-events-none z-20"
                      />
                    );
                  })()}

                  {/* Tactile Ripple Feedback */}
                  {tapRipple && (
                    <span
                      key={tapRipple.key}
                      className="fv-tap-ripple pointer-events-none absolute z-30"
                      style={{ left: `${tapRipple.x}%`, top: `${tapRipple.y}%` }}
                    />
                  )}
                </div>

                {(isDetectingParts || isAiSegmenting || isTracingContour) && (
                  <div className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full bg-[#2B313A]/90 px-3.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md shadow-sm">
                    {isAiSegmenting
                      ? 'در حال تشخیص و برش هوشمند قطعه...'
                      : isDetectingParts
                      ? 'در حال تشخیص خودکار قطعه...'
                      : 'در حال ردیابی لبه دقیق قطعه...'}
                  </div>
                )}
              </div>

              {/* Multi-Part Quick Selector Bar (Shown cleanly on desktop when > 1 part found) */}
              {detectedCandidates.length > 1 && (
                <div className="hidden lg:flex items-center gap-2 border-t border-[#DFE3E6] bg-[#FFFFFF] px-4 py-2.5 overflow-x-auto scrollbar-none">
                  <span className="text-[11px] font-bold text-[#74757C] shrink-0">بخش‌های تصویر:</span>
                  {detectedCandidates.slice(0, 5).map((cand, idx) => {
                    const active = cand.id === activeCandidateId;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => void handleImagePointSelect(cand.center.x, cand.center.y, cand)}
                        className={`min-h-[32px] px-3 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[#E06518] text-white'
                            : 'bg-[#F5F6F6] border border-[#DFE3E6] text-[#55565A] hover:text-[#2B313A]'
                        }`}
                      >
                        {cand.label || `قطعه ${toPersianDigits(idx + 1)}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* -------------------------------------------------------------- */}
            {/* UNIFIED CATALOG RESULTS SHEET (Mobile Pull-Up / Desktop Left)   */}
            {/* -------------------------------------------------------------- */}
            <div
              ref={mobileResultsAnchorRef}
              data-testid="forza-vision-catalog-results"
              data-sheet-expanded={mobileSheetExpanded}
              aria-expanded={mobileSheetExpanded}
              className={`flex flex-1 min-h-0 flex-col bg-[#FFFFFF] text-[#2B313A] lg:col-span-7 lg:h-full lg:overflow-y-auto transition-all ${
                mobileSheetExpanded
                  ? 'fixed inset-0 z-40 rounded-none mt-0 overflow-y-auto lg:static lg:inset-auto lg:z-auto'
                  : 'relative z-20 -mt-5 rounded-t-[26px] border-t border-[#DFE3E6] shadow-[0_-12px_32px_rgba(43,49,58,0.08)] lg:mt-0 lg:rounded-none lg:border-t-0 lg:shadow-none'
              }`}
            >
              {/* Mobile Pull Handle */}
              <div className="flex justify-center pt-2.5 pb-1 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileSheetExpanded((v) => !v)}
                  aria-label="تغییر ارتفاع لیست نتایج"
                  className="h-1 w-10 rounded-full bg-[#CBD2D8] cursor-pointer"
                />
              </div>

              {/* Sticky Summary Header */}
              <div data-testid="forza-vision-catalog-sheet-header" className="sticky top-0 z-20 border-b border-[#DFE3E6] bg-[#FFFFFF]/95 px-4 py-3 backdrop-blur sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="sp-vision-result-intro flex items-center gap-3 min-w-0">
                    <div className="h-13 w-13 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl border border-[#DFE3E6] bg-[#F5F6F6] p-1">
                      <img
                        src={croppedPreviewUrl || selectedImage}
                        alt="برش قطعه انتخاب‌شده"
                        data-testid="sp-vision-match-photo"
                        className="sp-vision-match-photo h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-extrabold text-[#2B313A]">
                        محصولات مشابه کاتالوگ
                      </h2>
                      <p className="mt-0.5 text-xs text-[#74757C] tabular-nums truncate">
                        {isMatching
                          ? 'در حال تطبیق با کاتالوگ صنعت پیش...'
                          : `${toPersianDigits(unifiedProducts.length)} محصول مشابه${
                              analysisResult?.summary?.partFamilyFarsi
                                ? ` · ${analysisResult.summary.partFamilyFarsi}`
                                : ''
                            }`}
                      </p>
                      <p className="mt-1 text-[10px] leading-5 text-[#74757C]">
                        این تطبیق تصویری پیشنهادی و نیازمند تأیید فنی کد، ابعاد و سازگاری قطعه پیش از سفارش است.
                      </p>
                      <button
                        type="button"
                        data-testid="forza-vision-full-image-search"
                        onClick={runFullImageVisualMatch}
                        disabled={isMatching || !localImageId}
                        className="mt-1 inline-flex items-center text-[11px] font-bold text-[#E06518] transition-colors hover:text-[#B94D0B] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="جست‌وجوی کل تصویر"
                      >
                        جست‌وجوی کل تصویر
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSheetExpanded((v) => {
                          const next = !v;
                          if (!next) {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                          return next;
                        });
                      }}
                      className="lg:hidden inline-flex h-9 items-center gap-1 rounded-full bg-[#2B313A] px-3.5 text-xs font-bold text-white transition-colors hover:bg-[#E06518] whitespace-nowrap cursor-pointer"
                    >
                      <span>{mobileSheetExpanded ? 'مشاهده تصویر' : 'همه نتایج'}</span>
                      {mobileSheetExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const first = unifiedProducts[0];
                        if (first) {
                          navigateConsult(first.code, first.name, first.brand, true);
                        } else {
                          onClose();
                          navigate('/ai-consult');
                        }
                      }}
                      className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F5F6F6] border border-[#DFE3E6] px-3.5 text-xs font-bold text-[#2B313A] transition-colors hover:border-[#E06518] hover:text-[#E06518] whitespace-nowrap cursor-pointer"
                    >
                      <span>مشاوره FORZA</span>
                      <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isMatching && (
                  <div
                    data-testid="vision-analyzing-screen"
                    role="status"
                    aria-live="polite"
                    className="fv-indeterminate-bar mt-2.5 rounded-full"
                  />
                )}
              </div>

              {errorMessage && (
                <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 sm:mx-6">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Observed Visual Parameters Summary Strip (Zero Pill Clutter) */}
              {analysisResult?.summary &&
                (analysisResult.summary.detectedProfile || analysisResult.summary.material) && (
                  <div className="mx-4 mt-4 sm:mx-6 rounded-2xl border border-[#DFE3E6] bg-[#F5F6F6] px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {analysisResult.summary.detectedPartType && (
                      <div>
                        <span className="block text-[10px] text-[#74757C]">نوع قطعه</span>
                        <strong className="text-[#2B313A] font-bold">
                          {analysisResult.summary.detectedPartType}
                        </strong>
                      </div>
                    )}
                    {analysisResult.summary.detectedProfile && (
                      <div>
                        <span className="block text-[10px] text-[#74757C]">پروفیل / کد مشاهده‌شده</span>
                        <strong className="text-[#E06518] font-mono font-bold" dir="ltr">
                          {analysisResult.summary.detectedProfile}
                        </strong>
                      </div>
                    )}
                    {analysisResult.summary.material && (
                      <div>
                        <span className="block text-[10px] text-[#74757C]">جنس بدنه</span>
                        <strong className="text-[#2B313A] font-bold">
                          {analysisResult.summary.material}
                        </strong>
                      </div>
                    )}
                  </div>
                )}

              {/* UNIFIED Product Grid */}
              <div className="flex-1 p-4 sm:p-6">
                {unifiedProducts.length > 0 ? (
                  <>
                    <div data-testid="forza-vision-catalog-results" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                      {(mobileSheetExpanded ? unifiedProducts : unifiedProducts.slice(0, 12)).map(
                        renderUnifiedProductCard,
                      )}
                    </div>

                    {analysisResult?.summary?.partFamilyFarsi && (
                      <div className="mt-6 flex justify-center">
                        <Link
                          to={`/products?search=${encodeURIComponent(analysisResult.summary.partFamilyFarsi)}`}
                          onClick={() => onClose()}
                          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#DFE3E6] bg-[#F5F6F6] px-5 text-xs font-bold text-[#2B313A] transition-colors hover:border-[#E06518] hover:bg-[#E06518] hover:text-white whitespace-nowrap"
                        >
                          <span>مشاهده همه کالاهای مرتبط در کاتالوگ</span>
                          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    )}
                  </>
                ) : analysisResult?.modelSuggestions?.length ? (
                  <LocalModelResults
                    items={analysisResult.modelSuggestions}
                    onClose={() => onClose()}
                  />
                ) : isMatching ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="animate-pulse rounded-2xl border border-[#E7E8EC] p-2.5">
                        <div className="aspect-square w-full rounded-xl bg-[#F3F4F6]" />
                        <div className="mt-3 h-3 w-3/4 rounded bg-[#F3F4F6]" />
                        <div className="mt-2 h-3 w-1/2 rounded bg-[#F3F4F6]" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div data-testid="vision-kiki-no-match" className="rounded-2xl border border-[#DFE3E6] bg-[#F5F6F6] p-8 text-center">
                    <p className="text-sm font-bold text-[#2B313A]">
                      محصول مشابهی در کاتالوگ پیدا نشد
                    </p>
                    <p className="mt-1 text-xs text-[#74757C]">
                      روی بخش دیگری از تصویر کلیک کنید یا درخواست ساخت سفارشی ثبت کنید.
                    </p>
                    <p className="mt-3 text-[11px] leading-6 text-[#74757C]">
                      برای تحلیل، نسخه موقت تصویر به API شناسایی ارسال می‌شود؛ تصویر اصلی در حافظه محلی مرورگر نگهداری می‌شود و در CRM ذخیره نمی‌شود. تصویر فقط با ثبت نهایی فرم به درخواست ساخت پیوست می‌شود.
                    </p>
                  </div>
                )}

                {/* End of scrollable product list; bottom manufacturing bar is pinned below */}
              </div>

              {/* Sticky Bottom Custom Manufacturing Bar — Always visible while scrolling */}
              <div className="sticky bottom-0 z-30 mt-auto border-t border-[#DFE3E6] bg-[#FFFFFF]/95 backdrop-blur-md px-3.5 py-2.5 sm:px-6 sm:py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-6px_rgba(43,49,58,0.1)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="w-full min-w-0 sm:flex-1 text-xs">
                    <p className="font-extrabold text-[11.5px] sm:text-xs leading-snug text-[#2B313A]">
                      قطعه مورد نظر در نتایج نبود؟ ما آن را برای شما تولید می‌کنیم
                    </p>
                    <p className="mt-0.5 text-[10.5px] sm:text-[11px] leading-snug text-[#74757C] line-clamp-1 sm:line-clamp-none">
                      مهندسی معکوس و ساخت سفارشی FORZA با ارسال همین تصویر به تیم مهندسی صنعت پیش
                    </p>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] w-full sm:w-auto sm:flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void openCustomManufacturingRequest()}
                      disabled={isPreparingCustomRequest}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#E06518] px-3 sm:px-3.5 text-xs font-bold text-white hover:bg-[#C95210] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>ثبت سفارش ساخت</span>
                    </button>
                    <a
                      href="tel:03535254703"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#DFE3E6] bg-[#FFFFFF] px-2.5 sm:px-3 text-xs font-semibold text-[#2B313A] hover:border-[#2B313A] transition-colors whitespace-nowrap"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>تماس</span>
                    </a>
                    <a
                      href="https://wa.me/989903427027"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 sm:px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>واتساپ</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ==================================================================== */}
      {/* SCREEN: WEBSITE-ALIGNED ENTRY PORTAL (DESKTOP & MOBILE RESPONSIVE)   */}
      {/* ==================================================================== */}
      {screen === 'entry' && (
        <div data-testid="forza-vision-entry" className="flex min-h-[100dvh] flex-col bg-[#FFFFFF] text-[#2B313A]">
          {/* Clean Branded Header */}
          <header className="border-b border-[#DFE3E6] bg-[#FFFFFF] shrink-0">
            <div className="mx-auto flex h-16 sm:h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/logo-forza_9b7fcf6e.png"
                  alt="FORZA"
                  className="h-9 sm:h-11 w-auto object-contain"
                />
                <span className="h-6 w-px bg-[#DFE3E6]" aria-hidden="true" />
                <div>
                  <span className="block text-xs sm:text-sm font-extrabold tracking-tight text-[#2B313A] whitespace-nowrap">
                    FORZA VISION
                  </span>
                  <p className="hidden sm:block text-[11px] text-[#74757C] whitespace-nowrap">
                    سامانه بینایی ماشین و تطبیق قطعات صنعتی
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseAction}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#DFE3E6] bg-[#F5F6F6] px-4 text-xs font-bold text-[#2B313A] transition-colors hover:border-[#E06518] hover:text-[#E06518] whitespace-nowrap cursor-pointer"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                <span>{standalone ? 'بازگشت' : 'بستن'}</span>
              </button>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-5 sm:px-6 lg:py-8">
            {errorMessage && (
              <div className="mb-5 flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Top-to-Bottom Smooth Studio Reveal */}
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12 lg:gap-7"
            >
              {/* Primary Action & Upload Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                data-testid="forza-vision-upload-panel"
                className={`relative overflow-hidden flex flex-col justify-between rounded-3xl border p-5 sm:p-8 lg:col-span-7 transition-colors ${
                  isDragOver
                    ? 'border-[#E06518] bg-[#FFF4EC]'
                    : 'border-[#DFE3E6] bg-[#F5F6F6]'
                }`}
              >
                {/* Architectural Drafting Grid Corner */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'linear-gradient(#dfe3e6 1px, transparent 1px), linear-gradient(90deg, #dfe3e6 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    maskImage: 'linear-gradient(135deg, #000, transparent 58%)',
                  }}
                />

                <div className="relative">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-[#E06518] mb-3">
                    <VisualScannerIcon size={17} />
                    <span>تشخیص خودکار کانتور و کد فنی</span>
                  </div>

                  <h1 className="text-xl font-black leading-snug text-[#2B313A] sm:text-3xl lg:text-[34px]">
                    قطعه را با یک عکس بشناسید و نمونه مشابه را پیدا کنید
                  </h1>
                  <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#55565A]">
                    تصویر را اینجا رها کنید یا مستقیماً عکس بگیرید؛ قطعات بلافاصله دورگیری و با کاتالوگ اطلس تطبیق داده می‌شوند.
                  </p>

                  {/* Two Primary Actions */}
                  <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-[#E06518] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#C95210] whitespace-nowrap cursor-pointer"
                    >
                      <Camera className="h-5 w-5" aria-hidden="true" />
                      <span>گرفتن عکس با دوربین</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl border border-[#DFE3E6] bg-[#FFFFFF] px-6 text-sm font-bold text-[#2B313A] transition-colors hover:border-[#2B313A] whitespace-nowrap cursor-pointer"
                    >
                      <GalleryImage className="h-5 w-5 text-[#E06518]" aria-hidden="true" />
                      <span>انتخاب تصویر از گالری</span>
                    </button>
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-[11px] sm:text-xs text-[#74757C]">
                    <UploadCloud className="h-4 w-4 text-[#E06518] shrink-0" aria-hidden="true" />
                    <span>پشتیبانی از JPG، PNG و WebP تا ۱۰ مگابایت · امکان کشیدن و رها کردن تصویر</span>
                  </p>
                </div>

                {/* Hairline-Separated Guidance Points */}
                <div className="relative mt-7 divide-y divide-[#DFE3E6] border-t border-[#DFE3E6] pt-2">
                  <div className="flex items-start gap-2.5 py-2.5">
                    <Focus className="mt-0.5 h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                    <span className="text-xs font-bold leading-relaxed text-[#2B313A]">
                      برای تسمه‌ها: مستقیم روبه‌روی برند و اطلاعات درج‌شده روی تسمه عکس بگیرید و بفرستید
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 py-2.5">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                    <span className="text-xs leading-relaxed text-[#55565A]">
                      تشخیص خودکار قطعه در لحظه ثبت عکس با جداسازی دقیق لبه‌ها از پس‌زمینه
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 py-2.5">
                    <Search className="mt-0.5 h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                    <span className="text-xs leading-relaxed text-[#55565A]">
                      کلیک روی هر بخش از تصویر برای تغییر قطعه هدف و مشاهده محصولات مشابه
                    </span>
                  </div>
                </div>
              </div>

              {/* Photographic Optical Showcase & Supported Industrial Families */}
              <div className="flex flex-col justify-between gap-4 lg:col-span-5">
                <div className="relative flex-1 overflow-hidden rounded-3xl border border-[#DFE3E6] bg-[#2B313A] min-h-[210px]">
                  <img
                    src="/images/company/ai-search-mobile.webp"
                    alt="جستجوی تصویری قطعات صنعتی فورزا"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#181C22]/90 via-[#181C22]/25 to-transparent" />
                  {/* Optical Reticle Accent Preview */}
                  <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-white/85">
                    <span className="rounded-full bg-[#181C22]/70 px-2.5 py-1 backdrop-blur-xs">
                      AUTO CONTOUR · U2NET
                    </span>
                    <span className="h-2 w-2 rounded-full bg-[#E06518]" />
                  </div>
                  <div className="absolute bottom-5 right-5 left-5 text-white">
                    <p className="text-sm font-extrabold sm:text-base">
                      تشخیص دقیق تسمه، بلبرینگ، پولی و قطعات صنعتی
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      تطبیق فوری با کدهای فنی و موجودی انبار صنعت‌پیش
                    </p>
                  </div>
                </div>

                {/* Supported Families Quick Visual Strip */}
                <div className="grid grid-cols-4 gap-2 rounded-2xl border border-[#DFE3E6] bg-[#FFFFFF] p-2.5 text-center">
                  <div className="flex flex-col items-center gap-1 py-1">
                    <BeltIcon size={18} className="text-[#E06518]" />
                    <span className="text-[11px] font-bold text-[#2B313A]">تسمه</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 py-1">
                    <PulleyIcon size={18} className="text-[#55565A]" />
                    <span className="text-[11px] font-bold text-[#2B313A]">پولی</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 py-1">
                    <BearingIcon size={18} className="text-[#55565A]" />
                    <span className="text-[11px] font-bold text-[#2B313A]">بلبرینگ</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 py-1">
                    <ChainCouplingIcon size={18} className="text-[#55565A]" />
                    <span className="text-[11px] font-bold text-[#2B313A]">کوپلینگ</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* User Recent Scans History */}
            {recentSearches.length > 0 && (
              <section data-testid="forza-vision-recent-history" className="mt-7">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#2B313A]">
                    <History className="h-4 w-4 text-[#E06518]" aria-hidden="true" />
                    <span>جستجوهای تصویری اخیر شما</span>
                  </h3>
                  {recentSearches.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowAllHistory((v) => !v)}
                      className="text-xs font-bold text-[#E06518] hover:underline cursor-pointer"
                    >
                      {showAllHistory ? 'نمایش کمتر' : `همه (${toPersianDigits(recentSearches.length)})`}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                  {displayedRecentSearches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.imageUrl}
                      onClick={() => handleRecentClick(item)}
                      className="flex items-center gap-3 rounded-2xl border border-[#DFE3E6] bg-[#FFFFFF] p-2.5 text-right transition-colors hover:border-[#E06518]/65 hover:bg-[#FAFBFB] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#E7E8EC] bg-[#F5F6F6] p-1">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <History className="h-full w-full p-2 text-[#A0A2A8]" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#2B313A]">{item.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[#74757C]">
                          {item.subtitle || formatVisionRecentTime(item.createdAt)}
                        </p>
                      </div>
                      <ChevronLeft className="h-4 w-4 shrink-0 text-[#74757C]" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      )}

      {/* Lazy Custom Manufacturing Modal */}
      {(isMatching || isDetectingParts || isAiSegmenting) && (
        <div
          className="fixed inset-0 z-[140] overflow-y-auto bg-[#F5F6F8]"
          data-testid="vision-analysis-progress-overlay"
        >
          <VisionAnalysisProgress
            image={selectedImage}
            region={queryRegion || undefined}
            progress={0}
            phaseIndex={isDetectingParts ? 0 : isAiSegmenting ? 1 : 2}
            phases={VISION_ANALYSIS_PHASES}
            counts={null}
            quickMode={scanMode === 'quick'}
            onClose={handleCloseAction}
          />
        </div>
      )}

      {customRequestOpen && customRequestDraft && (
        <Suspense fallback={null}>
          <LazyCustomPartRequestModal
            isOpen={customRequestOpen}
            initialFile={customRequestDraft.file}
            initialPartName={customRequestDraft.partName}
            initialPartType={customRequestDraft.partType}
            initialDimensions={customRequestDraft.dimensions}
            initialAlloyCondition={customRequestDraft.alloyCondition}
            initialNotes={customRequestDraft.notes}
            onClose={() => setCustomRequestOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};
