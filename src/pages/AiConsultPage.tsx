import {durableStorage} from "../services/durableStorage";
import {WorkspaceCatalog, type ConsultationCatalogProduct, type WorkspaceCatalogResult} from '../components/search/WorkspaceCatalog';
import {memberPath} from '../components/storefront/MemberAccess';
import {useAuth} from '../context/AuthContext';
import React, { lazy, Suspense, useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Camera,
  Check,
  Plus,
  Settings,
  Home,
  Trash2,
  Share2,
  Factory,
  Upload,
  ShoppingCart,
  SwitchCamera,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Loader2,
  Square,
  ArrowUpLeft,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { apiUrl } from '../config/apiConfig';
import { goBackOrFallback } from '../utils/navigateBackOrFallback';
import { consumeForzaTextStream } from '../utils/forzaStreamClient';
import { buildVisionConsultationPrompt } from '../utils/visionConsultationPrompt';
import { CognivoGeometricLogo } from '../components/common/AiFloatingButton';
import {
  BeltIcon,
  PulleyIcon,
  BearingIcon,
  ChainCouplingIcon,
  KilnRollerIcon,
  MechanicalSealIcon,
  DinCalculatorIcon,
  VisualScannerIcon,
  LiveVoiceIcon,
  DeepEngineeringIcon,
  CatalogFinderIcon,
  SpecSheetIcon,
  NewComposeIcon,
  SidebarToggleIcon,
  SendArrowIcon,
} from '../components/forza/ForzaWorkspaceIcons';
import {
  DinCalculatorModal,
  WorkspaceSettingsModal,
} from '../components/forza/ForzaWorkspaceModals';
import { WorkspaceMessageItem } from '../components/forza/ForzaWorkspaceMessage';
import {
  aiVisualSearchService,
  AiPartAnalysisResult,
  MatchedPartItem,
  INDUSTRIAL_PRESET_SAMPLES,
  IndustrialPresetSample,
} from '../services/aiVisualSearchService';
import { useCart } from '../context/CartContext';
import {
  saveCustomerDeviceImage,
  getCustomerDeviceImage,
  adoptCustomerDeviceImage,
  customerImageBlobToDataUrl,
  getCustomerDeviceImageMetadata,
} from '../services/customerImageVault';
import {
  createCustomerImageIdentification,
  completeCustomerImageIdentification,
  saveCustomerConsultation,
  selectCustomerImageProduct,
} from '../services/customerIntelligenceService';
const AiVisualPartSearchModal = lazy(() => import('../components/search/KikiVisualPartSearchModal').then(m=>({default:m.AiVisualPartSearchModal})));

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  suggestedAction?: {
    label: string;
    link?: string;
  };
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: Message[];
}

type ConsultationProduct = ConsultationCatalogProduct;

const STORAGE_KEY = 'forza_industrial_chat_sessions_v2';
const ACTIVE_SESSION_KEY = 'forza_active_session_id_v2';

interface PartCategoryOption {
  id: string;
  title: string;
  subtitle: string;
  defaultApplication: string;
  recommendedParams: string;
  icon: React.FC<{ className?: string; size?: number }>;
}

const PART_CATEGORIES: PartCategoryOption[] = [
  {
    id: 'belts',
    title: 'تسمه‌های انتقال قدرت و تایمینگ',
    subtitle: 'V-Belt، تایمینگ PU و کلروپرن، شیاردار، جوشی',
    defaultApplication: 'سیستم‌های انتقال قدرت الکتروموتور و شفت',
    recommendedParams: 'طول اسمی (Li/Lp)، عرض مقطع (mm)، گام دندانه',
    icon: BeltIcon,
  },
  {
    id: 'pulleys',
    title: 'پولی‌ها و چرخ‌تسمه‌های صنعتی',
    subtitle: 'تایمینگ دندانه‌دار، گوه، تیپرلاک FORZA، چدنی',
    defaultApplication: 'شفت الکتروموتور و گیربکس خطوط تولید',
    recommendedParams: 'قطر خارجی، تعداد دندانه یا شیار، قطر سوراخ شفت',
    icon: PulleyIcon,
  },
  {
    id: 'bearings',
    title: 'بلبرینگ‌ها و یاتاقان‌ها',
    subtitle: 'شیار عمیق، رولربیرینگ، یاتاقان بلبرینگ صنعتی',
    defaultApplication: 'محورها و شفت‌های دوار با دور بالا',
    recommendedParams: 'قطر داخلی (d)، قطر خارجی (D)، پهنا (B)',
    icon: BearingIcon,
  },
  {
    id: 'chains',
    title: 'زنجیرها، چرخ‌دنده‌ها و کوپلینگ‌ها',
    subtitle: 'زنجیر تک‌ردیفه و دوبل، دنده‌زنجیر، کوپلینگ رابر',
    defaultApplication: 'انتقال گشتاور و نوار نقاله‌های بار سنگین',
    recommendedParams: 'گام زنجیر (اینچ/میلیمتر)، تعداد دندانه، مدل کوپلینگ',
    icon: ChainCouplingIcon,
  },
  {
    id: 'kiln',
    title: 'قطعات خطوط کوره، کاشی و سرامیک',
    subtitle: 'رولیک نسوز، لاستیک کوره، تسمه‌های حرارتی',
    defaultApplication: 'کوره رولری پخت کاشی و خطوط لعاب‌کاری',
    recommendedParams: 'طول رولیک، قطر خارجی، دمای کارکرد (C°)',
    icon: KilnRollerIcon,
  },
  {
    id: 'other',
    title: 'سایر قطعات مکانیکی و ساختنی',
    subtitle: 'کاسه‌نمد، بوش‌های برنزی، واشرها و قطعات خاص',
    defaultApplication: 'آب‌بندی و نگهداری تخصصی تجهیزات کارخانه',
    recommendedParams: 'ابعاد سه‌گانه، متریال (NBR / فولاد / پلی‌یورتان)',
    icon: MechanicalSealIcon,
  },
];

const INDUSTRY_DOMAINS = [
  { id: 'general', label: 'عمومی و خطوط انتقال قدرت' },
  { id: 'ceramic', label: 'کاشی، سرامیک و کوره‌های رولری' },
  { id: 'textile', label: 'نساجی، ریسندگی و بافندگی' },
  { id: 'cement', label: 'سیمان، فولاد و معادن سنگین' },
  { id: 'food', label: 'صنایع غذایی و نوشیدنی' },
  { id: 'packaging', label: 'بسته‌بندی و کارتن‌سازی' },
  { id: 'machinery', label: 'ماشین‌سازی و تجهیزات صنعتی' },
  { id: 'rubber', label: 'لاستیک و پلاستیک' },
];

const PROMPT_SUGGESTIONS = [
  {
    title: 'محاسبه طول تسمه DIN 2215',
    desc: 'فرمول دقیق با فاصله مراکز و قطر پولی‌ها',
    query: 'محاسبه و طراحی فنی: فرمول دقیق محاسبه طول اسمی تسمه، فاصله محور شفت‌ها و نسبت تبدیل دور پولی',
    icon: DinCalculatorIcon,
  },
  {
    title: 'استعلام قطعات FORZA و SWR',
    desc: 'کد، ابعاد و اطلاعات ثبت‌شده محصولات',
    query: 'بررسی مشخصات فنی، موجودی انبار مرکزی و استعلام قیمت برندهای انحصاری SWR آلمان و FORZA ایتالیا',
    icon: CatalogFinderIcon,
  },
  {
    title: 'قطعات کوره کاشی و سرامیک',
    desc: 'رولیک‌های سرامیکی، پولی و تسمه‌های نسوز',
    query: 'شرایط نگهداری، طول عمر مفید و دمای کارکرد تسمه‌های صنعتی و رولیک‌های نسوز در کوره کاشی و سرامیک چیست؟',
    icon: KilnRollerIcon,
  },
  {
    title: 'تطبیق و استخراج مشخصات',
    desc: 'تبدیل لیست قطعات به کدهای استاندارد',
    query: 'خلاصه‌سازی و استخراج مشخصات فنی: لیست کدهای فنی تسمه، پولی و یاتاقان را با استانداردهای مربوطه مرتب کنید.',
    icon: SpecSheetIcon,
  },
];

export const AiConsultPage: React.FC<{ identificationOnly?: boolean }> = ({ identificationOnly = false }) => {
  const navigate = useNavigate();
  const handleGoBack = useCallback(() => goBackOrFallback(navigate, '/'), [navigate]);
  const {currentUser,openAuthModal}=useAuth();
  const [entryParams]=useSearchParams();
  const { addToCart } = useCart();

  React.useEffect(() => {
    if (!identificationOnly && entryParams.get('view') === 'visual') {
      navigate('/identify-part?from=workspace&' + entryParams.toString(), { replace: true });
    }
  }, [identificationOnly, entryParams, navigate]);

  // Mode: Engineering Chat OR Visual Part Identification Studio
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'chat' | 'visual_studio'>(()=>identificationOnly || entryParams.get('view')==='visual'?'visual_studio':'chat');

  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');

  // Chat Input & stream state
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, 'up' | 'down'>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isDeeperResearchActive, setIsDeeperResearchActive] = useState(false);
  const [isVisualSearchModalOpen, setIsVisualSearchModalOpen] = useState(false);
  const [isCatalogSearchOpen, setIsCatalogSearchOpen] = useState(false);
  const [isComposerToolsOpen, setIsComposerToolsOpen] = useState(false);
  const [showEntrySplash, setShowEntrySplash] = useState(() => !identificationOnly);

  // Settings State
  const [selectedIndustry, setSelectedIndustry] = useState(()=>entryParams.get('industry')||'general');
  const [calculationStandard, setCalculationStandard] = useState<'din' | 'fast'>('din');

  // Visual Part Studio State
  const [selectedPartCategory, setSelectedPartCategory] = useState<string>('belts');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedImageId, setCapturedImageId] = useState<string | null>(null);
  const [isSavingCapturedImage, setIsSavingCapturedImage] = useState(false);
  const [imageEventId, setImageEventId] = useState<string | null>(null);
  const [selectedConsultProducts, setSelectedConsultProducts] = useState<ConsultationProduct[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Parameters
  const [dimensionLength, setDimensionLength] = useState<string>('');
  const [dimensionWidth, setDimensionWidth] = useState<string>('');
  const [dimensionPitch, setDimensionPitch] = useState<string>('');
  const [partApplication, setPartApplication] = useState<string>('');
  const [partMarking, setPartMarking] = useState<string>('');

  // Analysis result state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiPartAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [addedCartCode, setAddedCartCode] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);

  // A conversation is its own request boundary. Responses from a previously
  // selected/deleted conversation must never update the visible chat or CRM.
  const cancelActiveConsultation = () => {
    streamAbortControllerRef.current?.abort();
    streamAbortControllerRef.current = null;
    setLoading(false);
  };
  useEffect(() => () => {
    streamAbortControllerRef.current?.abort();
    streamAbortControllerRef.current = null;
  }, []);

  // Belt Length Calculator State
  const [calcC, setCalcC] = useState<string>('500');
  const [calcD, setCalcD] = useState<string>('200');
  const [calcd, setCalcd] = useState<string>('100');
  const [calcResult, setCalcResult] = useState<{
    length: number;
    ratio: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerToolsRef = useRef<HTMLDivElement>(null);
  const productContextAddedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!showEntrySplash) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setShowEntrySplash(false), prefersReduced ? 120 : 950);
    return () => window.clearTimeout(timer);
  }, [showEntrySplash]);

  useEffect(() => {
    if (!isComposerToolsOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (composerToolsRef.current && !composerToolsRef.current.contains(event.target as Node)) {
        setIsComposerToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isComposerToolsOpen]);

  const openCatalogFinder = useCallback(() => {
    setIsMobileDrawerOpen(false);
    setIsComposerToolsOpen(false);
    setActiveWorkspaceTab('chat');
    setIsCatalogSearchOpen(true);
    window.setTimeout(() => document.getElementById('forza-workspace-product-search')?.focus(), 70);
  }, []);

  // Use the image-identification design embedded in this supplied workspace.
  // Keep /identify-part outside the workspace on the existing production scanner.
  const openVisualStudio = useCallback(() => {
    setIsMobileDrawerOpen(false);
    setIsComposerToolsOpen(false);
    setIsCatalogSearchOpen(false);
    navigate('/identify-part?from=workspace');
  }, [navigate]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputQuery]);

  const addProductToConsultation = (product: ConsultationProduct) => {
    setSelectedConsultProducts(current => current.some(item => item.code === product.code)
      ? current
      : [...current, product].slice(0, 20));
    setActiveWorkspaceTab('chat');
  };

  useEffect(() => {
    const code = entryParams.get('productCode')?.trim();
    const name = entryParams.get('productName')?.trim();
    if (!code || productContextAddedRef.current === code) return;
    productContextAddedRef.current = code;
    const product = { code, name: name || code };
    setSelectedConsultProducts(current => current.some(item => item.code === code) ? current : [...current, product].slice(0, 20));
    setActiveWorkspaceTab('chat');
  }, [entryParams]);

  // Read the catalog's real reference image and SKU size when a product detail
  // page opens the desk. Images are display references, never proof of SKU identity.
  useEffect(() => {
    const code = entryParams.get('productCode')?.trim();
    if (!code) return;
    const controller = new AbortController();
    void fetch(apiUrl('/api/ai/catalog-search?q=' + encodeURIComponent(code)), {
      signal: controller.signal,
      credentials: 'same-origin',
    }).then(response => response.ok ? response.json() : null).then(payload => {
      if (controller.signal.aborted || !Array.isArray(payload?.results)) return;
      const family = payload.results.find((item: WorkspaceCatalogResult) =>
        item.code === code || item.variants?.some(variant => variant.code === code)
      ) as WorkspaceCatalogResult | undefined;
      if (!family) return;
      const variant = family.variants?.find(item => item.code === code);
      const image = typeof family.images?.[0] === 'string' ? family.images[0] : undefined;
      setSelectedConsultProducts(current => current.map(item => item.code === code
        ? { ...item, size: variant?.size || item.size, image, link: family.link }
        : item));
    }).catch(() => { /* Search results remain optional during a catalog outage. */ });
    return () => controller.abort();
  }, [entryParams]);

  // Load Sessions from LocalStorage
  useEffect(() => {
    const loadSessionsFromStorage = () => {
      try {
        const stored = durableStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: ChatSession[] = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed);
            const savedActiveId = durableStorage.getItem(ACTIVE_SESSION_KEY);
            const matched = parsed.find(s => s.id === savedActiveId) || parsed[0];
            setActiveSessionId(matched.id);
            setMessages(matched.messages || []);
            return;
          }
        }
      } catch {}

      createNewSession(false);
    };

    loadSessionsFromStorage();

    const handleSync = () => {
      loadSessionsFromStorage();
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('forza_chat_updated', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('forza_chat_updated', handleSync);
    };
  }, []);

  const saveSessionsToStorage = (updatedSessions: ChatSession[]) => {
    setSessions(updatedSessions);
    try {
      durableStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch {}
  };

  const createNewSession = (autoFocus = true, baseSessions: ChatSession[] = sessions) => {
    cancelActiveConsultation();
    const newId = 'session-' + Date.now();
    const newSession: ChatSession = {
      id: newId,
      title: 'گفتگوی جدید',
      timestamp: Date.now(),
      messages: [],
    };
    const updated = [newSession, ...baseSessions.filter(s => s.messages.length > 0)];
    saveSessionsToStorage(updated);
    setActiveSessionId(newId);
    try {
      durableStorage.setItem(ACTIVE_SESSION_KEY, newId);
    } catch {}
    setMessages([]);
    setInputQuery('');
    setActiveWorkspaceTab(identificationOnly || (!autoFocus && entryParams.get('view') === 'visual') ? 'visual_studio' : 'chat');
    setIsMobileDrawerOpen(false);
    if (autoFocus) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const switchSession = (sessionId: string) => {
    const target = sessions.find(s => s.id === sessionId);
    if (target) {
      cancelActiveConsultation();
      setActiveSessionId(target.id);
      try {
        durableStorage.setItem(ACTIVE_SESSION_KEY, target.id);
      } catch {}
      setMessages(target.messages || []);
      setActiveWorkspaceTab('chat');
      setIsMobileDrawerOpen(false);
      setTimeout(scrollToBottom, 50);
    }
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== sessionId);
    saveSessionsToStorage(updated);
    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        switchSession(updated[0].id);
      } else {
        createNewSession(false, updated);
      }
    }
  };

  const clearAllHistory = () => {
    cancelActiveConsultation();
    durableStorage.removeItem(STORAGE_KEY);
    durableStorage.removeItem(ACTIVE_SESSION_KEY);
    setSessions([]);
    createNewSession(false, []);
    setSelectedConsultProducts([]);
    setShowSettingsModal(false);
  };

  // Recalculate Belt Formula
  useEffect(() => {
    const C = parseFloat(calcC);
    const D = parseFloat(calcD);
    const d = parseFloat(calcd);
    if (!isNaN(C) && !isNaN(D) && !isNaN(d) && C > 0 && D > 0 && d > 0 && D >= d) {
      const length = 2 * C + 1.57 * (D + d) + Math.pow(D - d, 2) / (4 * C);
      const ratio = D / d;
      setCalcResult({
        length: Math.round(length),
        ratio: Math.round(ratio * 100) / 100,
      });
    } else {
      setCalcResult(null);
    }
  }, [calcC, calcD, calcd]);

  // Clean camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const persistCapturedImageOnDevice = async (blob: Blob, originalName: string) => {
    setIsSavingCapturedImage(true);
    try {
      const saved = await saveCustomerDeviceImage(blob, currentUser?.id || 'guest', originalName);
      setCapturedImageId(saved.id);
      setImageEventId(null);
      setAnalysisError(null);
    } catch (error: any) {
      setCapturedImageId(null);
      setAnalysisError(error?.message || 'ذخیره تصویر در حافظه داخلی دستگاه انجام نشد.');
    } finally {
      setIsSavingCapturedImage(false);
    }
  };

  // Camera Handling
  const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    setCameraError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setCameraFacing(facing);
    } catch (err: any) {
      console.warn('Camera failed:', err);
      setCameraError('دسترسی به دوربین برقرار نشد. می‌توانید از بارگذاری فایل استفاده نمایید.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedImage(dataUrl);
      setCapturedImageId(null);
      setImageEventId(null);
      void fetch(dataUrl).then(response => response.blob()).then(blob => persistCapturedImageOnDevice(blob, 'camera-capture.jpg')).catch((error: unknown) => setAnalysisError(error instanceof Error ? error.message : 'ذخیره تصویر دوربین ناموفق بود.'));
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCapturedImage(reader.result);
        setCapturedImageId(null);
        setImageEventId(null);
        void persistCapturedImageOnDevice(file, file.name);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetSample = (sample: IndustrialPresetSample) => {
    setCapturedImage(sample.imageUrl);
    setCapturedImageId(null);
    setImageEventId(null);
    stopCamera();
    setDimensionLength(sample.length ? sample.length.toString() : "");
    setDimensionWidth(sample.width ? sample.width.toString() : "");
    setDimensionPitch(sample.pitch ? sample.pitch.toString() : "");
    setPartApplication(sample.application);
    setPartMarking(sample.features);
  };

  const runAiPartAnalysis = async () => {
    if (!capturedImage) return;
    if (isSavingCapturedImage) {
      setAnalysisError('لطفاً صبر کنید تا تصویر در حافظه داخلی دستگاه ذخیره شود.');
      return;
    }
    // Guests may identify a part. Only authenticated customers create CRM history.
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    const selectedCategoryObj = PART_CATEGORIES.find(c => c.id === selectedPartCategory);
    const categoryPromptHint = selectedCategoryObj
      ? `[دسته‌بندی اعلامی قطعه: ${selectedCategoryObj.title} - ${selectedCategoryObj.subtitle}] `
      : '';
    const markingHint = partMarking ? `کد و مارکینگ حک‌شده روی بدنه قطعه: ${partMarking}. ` : '';
    const fullFeatures = `${categoryPromptHint}${markingHint}`;

    let activeImageEventId: string | null = imageEventId;
    let requestMimeType = 'image/jpeg';
    try {
      let imageBase64: string | undefined;
      let imageUrl: string | undefined;
      if (/^https?:\/\//i.test(capturedImage)) {
        imageUrl = capturedImage;
      } else {
        if (!capturedImageId) throw new Error('تصویر هنوز در حافظه داخلی دستگاه ذخیره نشده است؛ دوباره انتخاب کنید.');
        const localRecord = await getCustomerDeviceImage(capturedImageId);
        if (!localRecord) throw new Error('تصویر محلی پیدا نشد؛ دوباره انتخاب کنید.');
        if (currentUser) await adoptCustomerDeviceImage(capturedImageId, currentUser.id);
        requestMimeType = localRecord.mimeType;
        imageBase64 = await customerImageBlobToDataUrl(localRecord.blob);
        if (currentUser && !activeImageEventId) {
          const metadata = await getCustomerDeviceImageMetadata(capturedImageId);
          if (!metadata) throw new Error('اطلاعات تصویر محلی پیدا نشد.');
          try {
            const event = await createCustomerImageIdentification({
              deviceImageId: metadata.id,
              sha256: metadata.sha256,
              mimeType: metadata.mimeType,
              sizeBytes: metadata.sizeBytes,
              originalName: metadata.originalName,
            });
            activeImageEventId = event.id;
            setImageEventId(event.id);
          } catch (trackingError) {
            console.warn('[Customer image history] metadata sync unavailable', trackingError);
          }
        }
      }

      const result = await aiVisualSearchService.analyzePartWithAi({
        imageUrl,
        imageBase64,
        mimeType: requestMimeType,
        length: dimensionLength ? parseFloat(dimensionLength) : undefined,
        width: dimensionWidth ? parseFloat(dimensionWidth) : undefined,
        pitch: dimensionPitch ? parseFloat(dimensionPitch) : undefined,
        application: partApplication || selectedCategoryObj?.defaultApplication,
        features: fullFeatures,
        stage: 'refined',
      });

      if (activeImageEventId) {
        void completeCustomerImageIdentification(activeImageEventId, {
          status: (result.matchedProducts?.length || result.similarCandidates?.length) ? 'completed' : 'unmatched',
          detectedPartType: result.summary?.detectedPartType,
          summary: result.summary?.whatYouSee || result.summary?.visualAnalysis,
          technicalAdvice: result.technicalAdvice,
          matchedProductCodes: (result.matchedProducts || []).map(item => item.code),
          similarProductCodes: (result.similarCandidates || []).map(item => item.code),
          confidence: result.summary?.confidence,
        }).catch((error: unknown) => console.warn('[Customer image history] result sync unavailable', error));
      }
      setAnalysisResult(result);
    } catch (err: any) {
      if (activeImageEventId) void completeCustomerImageIdentification(activeImageEventId, { status: 'failed' }).catch(() => undefined);
      console.error('Part analysis error:', err);
      setAnalysisError(
        err?.message || 'خطا در ارتباط با موتور هوش مصنوعی فورزا. لطفاً مجدداً تلاش نمایید.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const transferAnalysisToChat = (item?: MatchedPartItem) => {
    setActiveWorkspaceTab('chat');
    const targetItem = item || analysisResult?.matchedProducts?.[0] || analysisResult?.similarCandidates?.[0];
    const candidateIsSimilar = Boolean(targetItem && (
      analysisResult?.similarCandidates?.some(candidate => candidate.code === targetItem.code) ||
      targetItem.visualVerdict === 'very_similar'
    ));
    const prompt = buildVisionConsultationPrompt(
      targetItem ? {
        code: targetItem.code,
        name: targetItem.name,
        brand: targetItem.brand,
        size: targetItem.specs?.find(spec => /اندازه|ابعاد|size/i.test(spec.key))?.value,
        isSimilar: candidateIsSimilar,
      } : undefined,
      analysisResult?.summary,
    );
    if (!prompt) return;
    if (!targetItem) {
      void handleSend(prompt);
      return;
    }
    const product: ConsultationProduct = {
      code: targetItem.code,
      name: targetItem.name,
      image: targetItem.catalogProduct?.images?.[0],
      link: '/product/' + encodeURIComponent(targetItem.code),
    };
    addProductToConsultation(product);
    // This is a customer-selected candidate, not proof of an exact match.
    // Persist only the selected code in CRM; never persist the customer's photo.
    if (imageEventId && currentUser) {
      void selectCustomerImageProduct(imageEventId, targetItem.code)
        .catch(() => console.warn('[Customer image history] candidate selection unavailable'));
    }
    void handleSend(prompt, product);
  };

  const persistConsultationForCrm = (
    sessionId: string,
    title: string,
    sessionMessages: Message[],
    summary: string,
    productsForTurn: ConsultationProduct[] = selectedConsultProducts,
  ) => {
    if (!currentUser || !sessionId || !sessionMessages.length) return;
    void saveCustomerConsultation({
      sessionId,
      title,
      messages: sessionMessages.slice(-32).map(message => ({
        id: message.id,
        role: message.sender === 'ai' ? 'assistant' : 'user',
        text: message.text.slice(0, 1800),
      })),
      productCodes: productsForTurn.map(product => product.code),
      products: productsForTurn.map(product => ({ code: product.code, name: product.name })),
summary,
    }).catch((error: unknown) => console.warn('[FORZA CRM session sync]', error instanceof Error ? error.message : 'unavailable'));
  };

  const handleSend = async (queryText?: string, productForTurn?: ConsultationProduct) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend) return;
    // Product detail can initiate a turn before the selected-product effect renders.
    const turnSelectedProducts: ConsultationProduct[] = [...selectedConsultProducts];
    const isInitialProductTurn = Boolean(queryText && queryText === entryParams.get('q')?.slice(0, 1500));
    const routeProductCode = isInitialProductTurn ? entryParams.get('productCode')?.trim() : undefined;
    const routeProductName = isInitialProductTurn ? entryParams.get('productName')?.trim() : undefined;
    if (routeProductCode && !turnSelectedProducts.some(item => item.code === routeProductCode)) {
      turnSelectedProducts.push({code: routeProductCode, name: routeProductName || routeProductCode});
    }
    if (productForTurn && !turnSelectedProducts.some(item => item.code === productForTurn.code)) {
      turnSelectedProducts.push(productForTurn);
    }
    if (turnSelectedProducts.length > 20) turnSelectedProducts.splice(0, turnSelectedProducts.length - 20);

    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
      streamAbortControllerRef.current = null;
    }
    const abortCtrl = new AbortController();
    streamAbortControllerRef.current = abortCtrl;

    const userMessageId = 'u-' + Date.now();
    const uniqueResponseId = `resp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timeNow = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    const newUserMessage: Message = {
      id: userMessageId,
      sender: 'user',
      text: textToSend,
      time: timeNow,
    };

    const aiMessageId = `ai-${uniqueResponseId}`;
    const initialAiMessage: Message = {
      id: aiMessageId,
      sender: 'ai',
      text: '',
      time: timeNow,
    };

    const updatedMessages = [...messages, newUserMessage, initialAiMessage];
    setMessages(updatedMessages);
    setInputQuery('');
    setLoading(true);

    const currentSession = sessions.find(s => s.id === activeSessionId);
    let sessionTitle = currentSession?.title || 'گفتگوی فنی';
    if (messages.length === 0 || sessionTitle === 'گفتگوی جدید') {
      sessionTitle = textToSend.slice(0, 32) + (textToSend.length > 32 ? '...' : '');
    }

    let streamedText = '';
    let streamedSuggestedAction: Message['suggestedAction'];

    try {
      const historyPayload = messages
        .filter(m => m.id !== aiMessageId)
        .slice(-6)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
        }));

      const industryPrefix =
        selectedIndustry !== 'general'
          ? `[حوزه صنعتی: ${
              INDUSTRY_DOMAINS.find(d => d.id === selectedIndustry)?.label || 'عمومی'
            }] `
          : '';

      const stageContext = entryParams.get("stage")?.slice(0, 150);
      const productContext = turnSelectedProducts.length
        ? `[محصولات انتخاب‌شده برای مشاوره: ${turnSelectedProducts.map(product => `${product.code} - ${product.name}${product.size ? ' (' + product.size + ')' : ''}`).join('؛ ')}] `
        : '';
      const queryWithContext = `${industryPrefix}${stageContext ? `[بخش خط تولید: ${stageContext}] ` : ""}${
        isDeeperResearchActive ? '[تحلیل عمیق و استاندارد فنی] ' : ''
      }${productContext}${textToSend}`;

      let finalAiText = '';
      const res = await fetch(apiUrl('/api/ai/consult-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortCtrl.signal,
        body: JSON.stringify({
          query: queryWithContext,
          history: historyPayload,
          responseId: uniqueResponseId,
          includeAudio: false,
          productCodes: turnSelectedProducts.map(product => product.code),
        }),
      });

      finalAiText = await consumeForzaTextStream(
        res,
        (_chunk, accumulatedText) => {
          if (abortCtrl.signal.aborted || streamAbortControllerRef.current !== abortCtrl) return;
          streamedText = accumulatedText;
          setMessages(prev =>
            prev.map(m => (m.id === aiMessageId ? { ...m, text: accumulatedText } : m))
          );
        },
        undefined,
        completed => {
          streamedSuggestedAction = completed.suggestedAction;
        },
      );
      if (abortCtrl.signal.aborted || streamAbortControllerRef.current !== abortCtrl) return;
      streamedText = finalAiText;
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMessageId
            ? { ...m, text: finalAiText, suggestedAction: streamedSuggestedAction }
            : m
        )
      );

      const finalMessagesList = [
        ...messages,
        newUserMessage,
        {
          id: aiMessageId,
          sender: 'ai' as const,
          text: finalAiText,
          time: timeNow,
          suggestedAction: streamedSuggestedAction,
        },
      ];
      const updatedSessions = sessions.map(s =>
        s.id === activeSessionId
          ? {
              ...s,
              title: sessionTitle,
              timestamp: Date.now(),
              messages: finalMessagesList,
            }
          : s
      );
      saveSessionsToStorage(updatedSessions);
      persistConsultationForCrm(activeSessionId, sessionTitle, finalMessagesList, finalAiText, turnSelectedProducts);
    } catch (error) {
      // A superseded or explicitly cancelled request must not overwrite the
      // newer turn. In particular, never retry through /api/ai/consult here:
      // that legacy route may select a different provider or paid Gemini.
      if (abortCtrl.signal.aborted || streamAbortControllerRef.current !== abortCtrl) return;

      const failureText = streamedText.trim()
        ? `${streamedText}\n\nپاسخ کامل از سرویس دریافت نشد؛ متن بالا ممکن است ناقص باشد. لطفاً درخواست را دوباره ارسال کنید.`
        : 'سرویس مشاوره فعلاً پاسخ کامل نداد. لطفاً کمی بعد دوباره تلاش کنید.';

      const finalMessagesList = [
        ...messages,
        newUserMessage,
        {
          id: aiMessageId,
          sender: 'ai' as const,
          text: failureText,
          time: timeNow,
        },
      ];
      setMessages(finalMessagesList);

      const updatedSessions = sessions.map(s =>
        s.id === activeSessionId
          ? {
              ...s,
              title: sessionTitle,
              timestamp: Date.now(),
              messages: finalMessagesList,
            }
          : s
      );
      saveSessionsToStorage(updatedSessions);
      persistConsultationForCrm(activeSessionId, sessionTitle, finalMessagesList, failureText, turnSelectedProducts);
    } finally {
      // Only the request that still owns the composer may clear its loading
      // state; an older aborted request must not stop a newer request's spinner.
      if (streamAbortControllerRef.current === abortCtrl) {
        streamAbortControllerRef.current = null;
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      }
    }
  };

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleFeedback = useCallback((id: string, vote: 'up' | 'down') => {
    setFeedbackState(prev => ({ ...prev, [id]: vote }));
  }, []);

  const handleNavigateLink = useCallback((link: string) => {
    navigate(link);
  }, [navigate]);

  const handleCopyChatLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 2500);
  };

  const startCatalogConsultation = (product: ConsultationProduct) => {
    addProductToConsultation(product);
    setActiveWorkspaceTab('chat');
    void handleSend(
      'برای قطعه «' + product.name + '» با کد ' + product.code +
      (product.size ? ' و ابعاد ' + product.size : '') +
      ' مشاوره فنی می‌خواهم. کاربردهای ثبت‌شده و نکات انتخاب را توضیح بده، سازگاری را قطعی فرض نکن و یک سؤال ضروری درباره دستگاه یا شرایط کار من بپرس.',
      product,
    );
  };
  const startCatalogFamilyConsultation = (family: WorkspaceCatalogResult) =>
    startCatalogConsultation({
      code: family.code,
      name: family.name,
      image: typeof family.images?.[0] === 'string' ? family.images[0] : undefined,
      link: family.link,
    });

  // Group and filter sessions
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const entrySentRef=useRef<string | null>(null);
  useEffect(()=>{
    const query=entryParams.get('q');
    const entryKey=entryParams.toString();
    if(!query || !activeSessionId || entrySentRef.current===entryKey)return;
    entrySentRef.current=entryKey;
    void handleSend(query.slice(0,1500));
  },[entryParams,activeSessionId]);
  const filteredSessions = sessions.filter(s =>
    sessionSearchQuery.trim()
      ? s.title.toLowerCase().includes(sessionSearchQuery.toLowerCase())
      : true
  );

  const todaySessions = filteredSessions.filter(
    s => now - s.timestamp < oneDay && s.messages.length > 0
  );
  const yesterdaySessions = filteredSessions.filter(
    s => now - s.timestamp >= oneDay && now - s.timestamp < 2 * oneDay && s.messages.length > 0
  );
  const olderSessions = filteredSessions.filter(
    s => now - s.timestamp >= 2 * oneDay && s.messages.length > 0
  );

  const activeIndustryLabel =
    INDUSTRY_DOMAINS.find(d => d.id === selectedIndustry)?.label || 'عمومی و خطوط انتقال قدرت';

  // Reusable Minimal ChatGPT-Style Composer Box (Website Palette + Single "+" Tools Menu)
  const renderComposerBox = (isEmptyCenterStage = false) => (
    <div className="w-full max-w-[740px] mx-auto">
      {selectedConsultProducts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedConsultProducts.map(product => (
            <span
              key={product.code}
              className="inline-flex max-w-[260px] items-center gap-1.5 rounded-xl border border-[#F8D3B8] bg-[#FFF4EC] px-2.5 py-1 text-[11px] font-bold text-[#C95210]"
              title={product.name}
            >
              {product.image && (
                <img
                  src={product.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 shrink-0 rounded-md bg-white object-contain"
                />
              )}
              <span className="min-w-0 truncate">{product.name}</span>
              <span dir="ltr" className="shrink-0 font-mono tabular-nums text-[10px]">
                {product.code}
              </span>
              <button
                type="button"
                aria-label={`حذف ${product.code} از فهرست مشاوره`}
                onClick={() =>
                  setSelectedConsultProducts(current =>
                    current.filter(item => item.code !== product.code)
                  )
                }
                className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-white/80 text-[#C95210] cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className={`relative w-full bg-[#FFFFFF] rounded-[24px] border border-[#DFE3E6] transition-all duration-150 focus-within:border-[#E06518]/75 ${
          isEmptyCenterStage
            ? 'shadow-[0_10px_34px_-12px_rgba(43,49,58,0.1)] p-2.5 sm:p-3.5'
            : 'shadow-[0_4px_22px_-8px_rgba(43,49,58,0.1)] p-2 sm:p-3'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="سوال فنی خود را درباره تسمه، پولی، یاتاقان یا کد قطعه بپرسید..."
          className="w-full bg-transparent text-[13.5px] sm:text-[14.5px] text-[#2B313A] placeholder-[#74757C] resize-none focus:outline-none min-h-[42px] max-h-36 px-2.5 py-1.5 leading-relaxed"
        />

        <div className="flex items-center justify-between gap-2 pt-1.5 mt-0.5">
          {/* Start side: Single calm "+" tools trigger + optional active research tag */}
          <div className="relative flex items-center gap-1.5" ref={composerToolsRef}>
            <button
              type="button"
              onClick={() => setIsComposerToolsOpen(open => !open)}
              aria-expanded={isComposerToolsOpen}
              aria-haspopup="menu"
              aria-label="ابزارهای مهندسی و کاتالوگ"
              title="ابزارهای مهندسی و کاتالوگ"
              className={`w-9 h-9 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                isComposerToolsOpen
                  ? 'bg-[#2B313A] border-[#2B313A] text-white'
                  : 'bg-[#F5F6F6] border-[#DFE3E6] hover:border-[#E06518] hover:text-[#E06518] text-[#55565A]'
              }`}
            >
              <Plus className={`w-4 h-4 transition-transform duration-150 ${isComposerToolsOpen ? 'rotate-45' : ''}`} />
            </button>

            {isDeeperResearchActive && (
              <button
                type="button"
                onClick={() => setIsDeeperResearchActive(false)}
                className="min-h-[32px] px-2.5 rounded-full bg-[#FFF4EC] border border-[#F8D3B8] text-[#C95210] text-[11px] font-bold flex items-center gap-1.5 hover:bg-[#FFE9D6] transition-colors cursor-pointer whitespace-nowrap"
                title="غیرفعال کردن تحلیل عمیق"
              >
                <DeepEngineeringIcon size={14} />
                <span>تحلیل عمیق</span>
                <X className="w-3 h-3" />
              </button>
            )}

            <AnimatePresence>
              {isComposerToolsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  role="menu"
                  aria-label="ابزارهای میزکار FORZA"
                  className="absolute bottom-full right-0 mb-2.5 w-60 rounded-2xl bg-[#FFFFFF] border border-[#DFE3E6] shadow-[0_18px_42px_-12px_rgba(43,49,58,0.18)] p-1.5 z-40"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openCatalogFinder}
                    className="w-full min-h-[40px] px-3 rounded-xl hover:bg-[#F5F6F6] text-[#2B313A] text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-right"
                  >
                    <CatalogFinderIcon size={16} className="text-[#E06518] shrink-0" />
                    <span>افزودن محصول از کاتالوگ</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsDeeperResearchActive(v => !v);
                      setIsComposerToolsOpen(false);
                    }}
                    className="w-full min-h-[40px] px-3 rounded-xl hover:bg-[#F5F6F6] text-[#2B313A] text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer text-right"
                  >
                    <span className="flex items-center gap-2.5">
                      <DeepEngineeringIcon size={16} className="text-[#55565A] shrink-0" />
                      <span>تحلیل عمیق استانداردها</span>
                    </span>
                    {isDeeperResearchActive && <Check className="w-3.5 h-3.5 text-[#E06518] shrink-0" />}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={openVisualStudio}
                    className="w-full min-h-[40px] px-3 rounded-xl hover:bg-[#F5F6F6] text-[#2B313A] text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-right"
                  >
                    <VisualScannerIcon size={16} className="text-[#55565A] shrink-0" />
                    <span>شناسایی تصویری قطعه</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsComposerToolsOpen(false);
                      setShowCalculatorModal(true);
                    }}
                    className="w-full min-h-[40px] px-3 rounded-xl hover:bg-[#F5F6F6] text-[#2B313A] text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-right"
                  >
                    <DinCalculatorIcon size={16} className="text-[#55565A] shrink-0" />
                    <span>محاسبه‌گر تسمه DIN 2215</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* End side: Only Live Voice + Send / Stop */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/ai-forza')}
              title="مکالمه صوتی زنده با FORZA"
              aria-label="مکالمه صوتی زنده با FORZA"
              className="w-9 h-9 rounded-full border border-[#DFE3E6] bg-[#F5F6F6] hover:bg-[#FFF4EC] hover:border-[#F8D3B8] hover:text-[#E06518] text-[#55565A] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <LiveVoiceIcon size={16} />
            </button>

            {loading ? (
              <button
                type="button"
                onClick={cancelActiveConsultation}
                className="w-9 h-9 rounded-full bg-[#2B313A] hover:bg-[#E06518] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="توقف پاسخ"
                aria-label="توقف پاسخ"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputQuery.trim()}
                className="w-9 h-9 rounded-full bg-[#E06518] hover:bg-[#C95210] disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
                title="ارسال پرسش"
                aria-label="ارسال پرسش"
              >
                <SendArrowIcon size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render Website-Toned ChatGPT-Style Sidebar
  const renderSidebarContent = () => (
    <div className="h-full flex flex-col justify-between select-none bg-[#F5F6F6] border-l border-[#DFE3E6]">
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Sidebar Top Rail with Uploaded FORZA Logo */}
        <div className="h-14 px-3 flex items-center justify-between shrink-0 border-b border-[#DFE3E6]/70">
          <div className="flex items-center gap-2">
            <img
              src="/images/brand/logo-forza.webp"
              alt="FORZA"
              className="h-8 sm:h-9 w-auto object-contain"
            />
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => createNewSession()}
              title="گفتگوی جدید"
              aria-label="گفتگوی جدید"
              className="min-w-[38px] min-h-[38px] rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#E5E7EB]/60 flex items-center justify-center transition-colors cursor-pointer"
            >
              <NewComposeIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsMobileDrawerOpen(false);
              }}
              title="بستن نوار کناری"
              aria-label="بستن نوار کناری"
              className="min-w-[38px] min-h-[38px] rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#E5E7EB]/60 flex items-center justify-center transition-colors cursor-pointer"
            >
              <SidebarToggleIcon size={18} />
            </button>
          </div>
        </div>

        {/* Clean Unboxed Workspace Navigation */}
        <nav className="px-2.5 py-2 space-y-0.5" aria-label="ابزارهای میزکار FORZA">
          <button
            type="button"
            onClick={() => createNewSession()}
            className="w-full min-h-[40px] px-2.5 rounded-xl hover:bg-[#EAECEF] text-[#2B313A] text-[13px] font-bold flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <span className="w-6 h-6 rounded-lg bg-[#FFFFFF] border border-[#DFE3E6] flex items-center justify-center shrink-0">
              <CognivoGeometricLogo className="w-3.5 h-3.5" />
            </span>
            <span className="truncate">مشاوره جدید FORZA</span>
          </button>

          <button
            type="button"
            onClick={openCatalogFinder}
            className="w-full min-h-[38px] px-2.5 rounded-xl hover:bg-[#EAECEF] text-[#55565A] hover:text-[#2B313A] text-[13px] font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <CatalogFinderIcon size={17} className="text-[#74757C] shrink-0 mx-0.5" />
            <span className="truncate">جستجوی کاتالوگ اطلس</span>
          </button>

          <button
            type="button"
            onClick={openVisualStudio}
            className="w-full min-h-[38px] px-2.5 rounded-xl hover:bg-[#EAECEF] text-[#55565A] hover:text-[#2B313A] text-[13px] font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <VisualScannerIcon size={17} className="text-[#74757C] shrink-0 mx-0.5" />
            <span className="truncate">شناسایی تصویری قطعه</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMobileDrawerOpen(false);
              setShowCalculatorModal(true);
            }}
            className="w-full min-h-[38px] px-2.5 rounded-xl hover:bg-[#EAECEF] text-[#55565A] hover:text-[#2B313A] text-[13px] font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <DinCalculatorIcon size={17} className="text-[#74757C] shrink-0 mx-0.5" />
            <span className="truncate">محاسبه‌گر DIN 2215</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMobileDrawerOpen(false);
              navigate('/ai-forza');
            }}
            className="w-full min-h-[38px] px-2.5 rounded-xl hover:bg-[#EAECEF] text-[#55565A] hover:text-[#2B313A] text-[13px] font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <LiveVoiceIcon size={17} className="text-[#E06518] shrink-0 mx-0.5" />
            <span className="truncate">تماس صوتی زنده</span>
          </button>
        </nav>

        {/* History Search */}
        <div className="px-3 py-2 border-t border-[#DFE3E6]/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#74757C] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={sessionSearchQuery}
              onChange={e => setSessionSearchQuery(e.target.value)}
              placeholder="جستجو در گفتگوها..."
              className="w-full h-8.5 pr-8 pl-7 bg-[#FFFFFF] border border-[#DFE3E6] focus:border-[#E06518] rounded-xl text-xs text-[#2B313A] placeholder-[#74757C] focus:outline-none transition-colors"
            />
            {sessionSearchQuery && (
              <button
                type="button"
                onClick={() => setSessionSearchQuery('')}
                aria-label="پاک کردن جستجو"
                className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[#74757C] hover:text-[#2B313A] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chronological Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-4 text-right">
          {todaySessions.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-semibold text-[#74757C]">امروز</div>
              <div className="space-y-0.5">
                {todaySessions.map(session => {
                  const isActive = activeSessionId === session.id && activeWorkspaceTab === 'chat';
                  return (
                    <div
                      key={session.id}
                      onClick={() => switchSession(session.id)}
                      className={`group min-h-[38px] px-2.5 py-1.5 rounded-xl text-[13px] flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#FFFFFF] border border-[#DFE3E6] text-[#2B313A] font-bold shadow-2xs'
                          : 'text-[#55565A] font-normal hover:bg-[#EAECEF]/70 hover:text-[#2B313A]'
                      }`}
                    >
                      <span className="truncate flex-1">{session.title}</span>
                      <button
                        type="button"
                        onClick={e => deleteSession(session.id, e)}
                        title="حذف گفتگو"
                        aria-label={`حذف ${session.title}`}
                        className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg opacity-70 lg:opacity-0 lg:group-hover:opacity-100 text-[#74757C] hover:text-rose-600 transition-all shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {yesterdaySessions.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-semibold text-[#74757C]">دیروز</div>
              <div className="space-y-0.5">
                {yesterdaySessions.map(session => {
                  const isActive = activeSessionId === session.id && activeWorkspaceTab === 'chat';
                  return (
                    <div
                      key={session.id}
                      onClick={() => switchSession(session.id)}
                      className={`group min-h-[38px] px-2.5 py-1.5 rounded-xl text-[13px] flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#FFFFFF] border border-[#DFE3E6] text-[#2B313A] font-bold shadow-2xs'
                          : 'text-[#55565A] font-normal hover:bg-[#EAECEF]/70 hover:text-[#2B313A]'
                      }`}
                    >
                      <span className="truncate flex-1">{session.title}</span>
                      <button
                        type="button"
                        onClick={e => deleteSession(session.id, e)}
                        title="حذف گفتگو"
                        aria-label={`حذف ${session.title}`}
                        className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg opacity-70 lg:opacity-0 lg:group-hover:opacity-100 text-[#74757C] hover:text-rose-600 transition-all shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {olderSessions.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-semibold text-[#74757C]">۷ روز گذشته</div>
              <div className="space-y-0.5">
                {olderSessions.map(session => {
                  const isActive = activeSessionId === session.id && activeWorkspaceTab === 'chat';
                  return (
                    <div
                      key={session.id}
                      onClick={() => switchSession(session.id)}
                      className={`group min-h-[38px] px-2.5 py-1.5 rounded-xl text-[13px] flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#FFFFFF] border border-[#DFE3E6] text-[#2B313A] font-bold shadow-2xs'
                          : 'text-[#55565A] font-normal hover:bg-[#EAECEF]/70 hover:text-[#2B313A]'
                      }`}
                    >
                      <span className="truncate flex-1">{session.title}</span>
                      <button
                        type="button"
                        onClick={e => deleteSession(session.id, e)}
                        title="حذف گفتگو"
                        aria-label={`حذف ${session.title}`}
                        className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg opacity-70 lg:opacity-0 lg:group-hover:opacity-100 text-[#74757C] hover:text-rose-600 transition-all shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sessions.every(s => s.messages.length === 0) && (
            <div className="px-3 py-6 text-center text-xs text-[#74757C] leading-relaxed">
              تاریخچه گفتگوهای شما اینجا نمایش داده می‌شود.
            </div>
          )}
        </div>
      </div>

      {/* Website-Aligned Bottom Account / Store Bar */}
      <div className="p-2.5 border-t border-[#DFE3E6] space-y-1 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            setIsMobileDrawerOpen(false);
            setShowSettingsModal(true);
          }}
          className="w-full min-h-[42px] px-2.5 rounded-xl hover:bg-[#EAECEF] text-[#2B313A] flex items-center justify-between gap-2 text-xs font-semibold transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-full bg-[#FFF4EC] border border-[#F8D3B8] text-[#E06518] flex items-center justify-center shrink-0">
              <Factory className="w-3.5 h-3.5" />
            </span>
            <span className="truncate">{activeIndustryLabel}</span>
          </div>
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#74757C] shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full min-h-[38px] px-2.5 rounded-xl text-[#55565A] hover:text-[#E06518] hover:bg-[#EAECEF] flex items-center justify-between text-xs font-medium transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Home className="w-3.5 h-3.5 shrink-0 mx-1.5" />
            <span>فروشگاه صنعت پیش</span>
          </span>
          <ArrowUpLeft className="w-3.5 h-3.5 opacity-70" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="h-[100dvh] max-h-[100dvh] w-full flex flex-col bg-[#FFFFFF] text-[#2B313A] overflow-hidden select-none relative"
      dir="rtl"
    >
      {/* Top-to-Bottom FORZA Logo Entry Transition Curtain */}
      <AnimatePresence>
        {showEntrySplash && (
          <motion.div
            key="forza-entry-curtain"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: 24, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
            onClick={() => setShowEntrySplash(false)}
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#FFFFFF] cursor-pointer select-none px-6"
            aria-label="ورود به میزکار هوشمند FORZA"
          >
            {/* Architectural drafting grid consistent with website hero */}
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
              transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col items-center"
            >
              <img
                src="/images/brand/logo-forza.webp"
                alt="لوگوی FORZA"
                className="w-64 sm:w-80 md:w-[360px] h-auto object-contain drop-shadow-[0_12px_32px_rgba(224,101,24,0.18)]"
              />

              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="mt-5 h-[2.5px] w-36 rounded-full bg-gradient-to-r from-transparent via-[#E06518] to-transparent origin-center"
              />

              <motion.p
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.32, duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                className="mt-3 text-xs sm:text-sm font-bold text-[#55565A] tracking-tight"
              >
                میزکار مهندسی صنعت پیش · کاتالوگ اطلس و SWR
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. DESKTOP SIDEBAR (Website Toned #F5F6F6 Rail) */}
        <aside
          hidden={identificationOnly}
          className={`${
            !identificationOnly && isSidebarOpen ? 'w-[260px]' : 'w-0 hidden'
          } transition-all duration-200 ease-out hidden lg:flex flex-col shrink-0 overflow-hidden z-20`}
        >
          {renderSidebarContent()}
        </aside>

        {/* 2. MOBILE & TABLET SLIDE-OVER DRAWER */}
        {!identificationOnly && isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex justify-start">
            <div
              className="fixed inset-0 bg-[#2B313A]/45 backdrop-blur-[2px] transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            <div className="relative w-76 max-w-[85vw] h-full shadow-2xl flex flex-col z-50 bg-[#F5F6F6] animate-in slide-in-from-right duration-200">
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* 3. MAIN WORKSPACE CANVAS */}
        <main className="flex-1 flex flex-col bg-[#FFFFFF] overflow-hidden min-w-0">
          {/* Minimalist Website-Aligned Top Header */}
          {identificationOnly ? (
            <header className="h-14 px-4 sm:px-6 border-b border-[#DFE3E6] flex items-center justify-between bg-[#FFFFFF] shrink-0">
              <div className="flex items-center gap-3">
                <img
                  src="/images/brand/logo-forza.webp"
                  alt="FORZA"
                  className="h-8 sm:h-9 w-auto object-contain"
                />
                <strong className="text-sm font-bold text-[#2B313A]">شناسایی هوشمند قطعه</strong>
              </div>
              <button
                type="button"
                onClick={handleGoBack}
                className="min-h-[38px] px-4 py-1.5 rounded-full border border-[#DFE3E6] hover:border-[#E06518] hover:text-[#E06518] text-xs font-semibold text-[#2B313A] transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>بازگشت</span>
              </button>
            </header>
          ) : (
            <header className="h-[52px] sm:h-14 px-2.5 sm:px-5 border-b border-[#DFE3E6]/75 flex items-center justify-between gap-2 shrink-0 bg-[#FFFFFF] z-20">
              {/* Zone 1: Sidebar Controls & Brand Model Selector */}
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(true)}
                  className="lg:hidden min-w-[44px] min-h-[44px] rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="منو و تاریخچه"
                  aria-label="باز کردن نوار کناری"
                >
                  <SidebarToggleIcon size={20} />
                </button>

                {!isSidebarOpen && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsSidebarOpen(true)}
                      title="نمایش نوار کناری"
                      aria-label="نمایش نوار کناری"
                      className="hidden lg:flex min-w-[38px] min-h-[38px] rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F3F4F6] items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <SidebarToggleIcon size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => createNewSession()}
                      title="گفتگوی جدید"
                      aria-label="گفتگوی جدید"
                      className="hidden lg:flex min-w-[38px] min-h-[38px] rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F3F4F6] items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <NewComposeIcon size={18} />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="min-h-[38px] px-2 sm:px-2.5 rounded-xl hover:bg-[#F3F4F6] flex items-center gap-1.5 transition-colors cursor-pointer min-w-0"
                  title="تنظیمات مدل و حوزه صنعتی"
                >
                  <CognivoGeometricLogo className="w-4 h-4 shrink-0" />
                  <span className="font-extrabold text-[13.5px] sm:text-[15px] text-[#2B313A] tracking-tight whitespace-nowrap truncate">
                    FORZA مهندسی
                  </span>
                  <span className="hidden sm:inline text-xs font-semibold text-[#E06518] font-mono">
                    {calculationStandard === 'din' ? 'DIN 2215' : 'سریع'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#74757C] shrink-0" />
                </button>
              </div>

              {/* Zone 2: Segmented Mode Switcher (Tablet sm+ & Desktop) */}
              <div className="hidden sm:flex items-center gap-1 p-1 bg-[#F3F4F6] border border-[#DFE3E6]/70 rounded-full shrink-0">
                <button
                  type="button"
                  onClick={() => (identificationOnly ? navigate('/ai-consult') : setActiveWorkspaceTab('chat'))}
                  className={`min-h-[30px] px-3.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    activeWorkspaceTab === 'chat'
                      ? 'bg-[#FFFFFF] text-[#2B313A] shadow-2xs'
                      : 'text-[#55565A] hover:text-[#2B313A]'
                  }`}
                >
                  <span>مشاوره</span>
                </button>
                <button
                  type="button"
                  onClick={openVisualStudio}
                  className={`min-h-[30px] px-3.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    activeWorkspaceTab === 'visual_studio'
                      ? 'bg-[#FFFFFF] text-[#2B313A] shadow-2xs'
                      : 'text-[#55565A] hover:text-[#2B313A]'
                  }`}
                >
                  <VisualScannerIcon size={14} className="text-[#E06518] shrink-0" />
                  <span>شناسایی تصویری</span>
                </button>
              </div>

              {/* Zone 3: Minimal Header Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (isCatalogSearchOpen) {
                      setIsCatalogSearchOpen(open => !open);
                    } else {
                      openCatalogFinder();
                    }
                  }}
                  title="جستجو در کاتالوگ اطلس"
                  aria-label="جستجو در کاتالوگ اطلس"
                  aria-controls="forza-workspace-catalog-drawer"
                  aria-expanded={isCatalogSearchOpen}
                  className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                    isCatalogSearchOpen
                      ? 'bg-[#FFF4EC] text-[#E06518] border border-[#F8D3B8]'
                      : 'text-[#55565A] hover:text-[#2B313A] hover:bg-[#F3F4F6]'
                  }`}
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => createNewSession()}
                  title="گفتگوی جدید"
                  aria-label="گفتگوی جدید"
                  className="lg:hidden min-w-[40px] min-h-[40px] rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <NewComposeIcon size={18} />
                </button>

                <button
                  type="button"
                  onClick={handleCopyChatLink}
                  title="اشتراک‌گذاری"
                  aria-label="اشتراک‌گذاری"
                  className="hidden md:flex min-w-[38px] min-h-[38px] rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F3F4F6] transition-colors cursor-pointer items-center justify-center"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  title="تنظیمات"
                  aria-label="تنظیمات"
                  className="hidden md:flex min-w-[38px] min-h-[38px] rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F3F4F6] transition-colors cursor-pointer items-center justify-center"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Mobile: Back button to previous page instead of Live Call */}
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="flex md:hidden min-h-[38px] px-3 rounded-full border border-[#DFE3E6] bg-[#F5F6F6] hover:border-[#E06518] hover:text-[#E06518] text-[#2B313A] text-xs font-bold items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  title="بازگشت به صفحه قبلی"
                  aria-label="بازگشت به صفحه قبلی"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>بازگشت</span>
                </button>

                {/* Desktop & Tablet: Live Voice Call */}
                <button
                  type="button"
                  onClick={() => navigate('/ai-forza')}
                  className="hidden md:flex min-h-[36px] px-3 rounded-full bg-[#2B313A] hover:bg-[#E06518] text-white text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  title="تماس زنده صوتی با FORZA"
                >
                  <LiveVoiceIcon size={14} />
                  <span>تماس زنده</span>
                </button>
              </div>
            </header>
          )}

          {/* Share Toast */}
          {showShareToast && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#2B313A] text-white text-xs font-semibold rounded-full shadow-xl flex items-center gap-2 z-50">
              <Check className="w-4 h-4 text-[#E06518] shrink-0" />
              <span>لینک میزکار کپی شد</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 1: VISUAL PART IDENTIFICATION STUDIO                         */}
          {/* ================================================================= */}
          {identificationOnly || activeWorkspaceTab === 'visual_studio' ? (
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-4xl mx-auto w-full pb-20 md:pb-8">
              {/* Studio Header */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F9F9F9] border border-black/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-[#E06518] mb-1">
                    سامانه بینایی ماشین FORZA · تطبیق با کاتالوگ اطلس
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-[#0D0D0D]">
                    استودیوی شناسایی و تطبیق تصویری قطعات
                  </h2>
                  <p className="text-xs text-[#5D5D67] mt-1 leading-relaxed">
                    با انتخاب دسته‌بندی و ارسال تصویر، پروفیل، گام دندانه و کدهای فنی قطعه بررسی می‌شود.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => (identificationOnly ? navigate('/ai-consult') : setActiveWorkspaceTab('chat'))}
                  className="min-h-[40px] px-4 py-2 rounded-full border border-black/[0.1] hover:border-[#E06518] text-[#0D0D0D] hover:text-[#E06518] text-xs font-semibold bg-[#FFFFFF] flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>بازگشت به گفتگوی مهندسی</span>
                </button>
              </div>

              {/* STEP 1: CATEGORY SELECTION */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] border border-black/[0.08] space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono tabular-nums text-xs font-black text-[#E06518]">
                      ۰۱.
                    </span>
                    <h3 className="font-bold text-xs sm:text-sm text-[#0D0D0D]">
                      انتخاب دسته‌بندی قطعه صنعتی
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#8E8EA0] hidden sm:inline">
                    {PART_CATEGORIES.find(c => c.id === selectedPartCategory)?.recommendedParams}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {PART_CATEGORIES.map(category => {
                    const CategoryIcon = category.icon;
                    const isSelected = selectedPartCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedPartCategory(category.id)}
                        className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between min-h-[88px] ${
                          isSelected
                            ? 'border-[#E06518] bg-[#FFF4EC]/55'
                            : 'border-black/[0.08] bg-[#FFFFFF] hover:bg-[#F9F9F9]'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-[#E06518] text-white'
                                : 'bg-[#F4F4F4] text-[#4B5563]'
                            }`}
                          >
                            <CategoryIcon size={17} />
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#E06518]" />}
                        </div>

                        <div>
                          <h4
                            className={`font-bold text-xs ${
                              isSelected ? 'text-[#C95210]' : 'text-[#0D0D0D]'
                            }`}
                          >
                            {category.title}
                          </h4>
                          <p className="text-[10px] text-[#8E8EA0] mt-0.5 line-clamp-1">
                            {category.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: CAMERA CAPTURE OR FILE UPLOAD */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] border border-black/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono tabular-nums text-xs font-black text-[#E06518]">
                      ۰۲.
                    </span>
                    <h3 className="font-bold text-xs sm:text-sm text-[#0D0D0D]">
                      ثبت تصویر قطعه (دوربین زنده یا بارگذاری فایل)
                    </h3>
                  </div>

                  {capturedImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedImage(null);
                        setAnalysisResult(null);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف و ثبت مجدد</span>
                    </button>
                  )}
                </div>

                {!capturedImage ? (
                  <div className="space-y-3.5">
                    {isCameraActive ? (
                      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-80 mx-auto border-2 border-[#E06518]">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="w-48 h-48 border border-white/60 rounded-xl relative">
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#E06518]" />
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#E06518]" />
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#E06518]" />
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#E06518]" />
                          </div>
                        </div>

                        <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={toggleCameraFacing}
                            className="p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                            title="تغییر دوربین"
                          >
                            <SwitchCamera className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="w-12 h-12 rounded-full bg-[#E06518] text-white flex items-center justify-center shadow-lg border-2 border-white active:scale-95 cursor-pointer"
                            title="ثبت تصویر"
                          >
                            <Camera className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                            title="انصراف"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => startCamera()}
                          className="p-6 rounded-xl border border-dashed border-black/[0.15] hover:border-[#E06518] hover:bg-[#FFF9F5] flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
                        >
                          <div className="w-11 h-11 rounded-full bg-[#FFF4EC] text-[#E06518] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                            <Camera className="w-5 h-5" />
                          </div>
                          <span className="font-bold text-xs sm:text-sm text-[#0D0D0D]">
                            فعال‌سازی دوربین زنده
                          </span>
                          <span className="text-[11px] text-[#8E8EA0] mt-0.5">
                            تصویربرداری مستقیم از قطعه یا خط تولید
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-6 rounded-xl border border-dashed border-black/[0.15] hover:border-[#E06518] hover:bg-[#FFF9F5] flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
                        >
                          <div className="w-11 h-11 rounded-full bg-[#F4F4F4] text-[#4B5563] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="font-bold text-xs sm:text-sm text-[#0D0D0D]">
                            بارگذاری تصویر از گالری
                          </span>
                          <span className="text-[11px] text-[#8E8EA0] mt-0.5">
                            فرمت‌های JPG، PNG، WEBP
                          </span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </div>
                    )}

                    {cameraError && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        {cameraError}
                      </div>
                    )}

                    <div className="pt-1">
                      <div className="text-[11px] font-semibold text-[#8E8EA0] mb-2">
                        یا انتخاب سریع از نمونه‌های صنعتی آماده:
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {INDUSTRIAL_PRESET_SAMPLES.map(sample => (
                          <button
                            key={sample.id}
                            type="button"
                            onClick={() => handleSelectPresetSample(sample)}
                            className="px-2.5 py-1.5 rounded-xl border border-black/[0.08] bg-[#FFFFFF] hover:border-[#E06518] text-right shrink-0 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <img
                              src={sample.imageUrl}
                              alt={sample.title}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-lg object-contain bg-[#F9F9F9]"
                            />
                            <div className="text-right">
                              <div className="text-[11px] font-bold text-[#0D0D0D] truncate max-w-[120px]">
                                {sample.title}
                              </div>
                              <div className="text-[10px] text-[#8E8EA0]">{sample.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden bg-[#F9F9F9] border border-black/[0.08] max-h-72 flex items-center justify-center p-2">
                      <img
                        src={capturedImage}
                        alt="تصویر ثبت‌شده"
                        referrerPolicy="no-referrer"
                        className="max-h-64 object-contain rounded-lg"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div>
                        <label className="text-[11px] text-[#5D5D67] font-semibold block mb-1">
                          طول / عرض (mm)
                        </label>
                        <input
                          type="number"
                          value={dimensionLength}
                          onChange={e => setDimensionLength(e.target.value)}
                          placeholder="مثلاً ۱۲۰۰"
                          className="w-full h-9 px-2.5 bg-[#F9F9F9] border border-black/[0.1] rounded-lg text-center font-mono tabular-nums focus:bg-white focus:border-[#E06518] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#5D5D67] font-semibold block mb-1">
                          گام دندانه (mm)
                        </label>
                        <input
                          type="number"
                          value={dimensionPitch}
                          onChange={e => setDimensionPitch(e.target.value)}
                          placeholder="مثلاً ۸"
                          className="w-full h-9 px-2.5 bg-[#F9F9F9] border border-black/[0.1] rounded-lg text-center font-mono tabular-nums focus:bg-white focus:border-[#E06518] focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-[#5D5D67] font-semibold block mb-1">
                          کد یا مارکینگ حک‌شده
                        </label>
                        <input
                          type="text"
                          value={partMarking}
                          onChange={e => setPartMarking(e.target.value)}
                          placeholder="مثلاً FORZA 8M 1200 یا NSK 6205"
                          className="w-full h-9 px-2.5 bg-[#F9F9F9] border border-black/[0.1] rounded-lg text-right focus:bg-white focus:border-[#E06518] focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={runAiPartAnalysis}
                      disabled={isAnalyzing}
                      className="w-full min-h-[46px] py-3 rounded-full bg-[#0D0D0D] hover:bg-[#E06518] active:scale-[0.99] disabled:bg-[#CBD2D8] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {isSavingCapturedImage ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> ذخیره روی دستگاه...
                        </>
                      ) : isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>سامانه در حال استخراج و تحلیل فنی قطعه...</span>
                        </>
                      ) : (
                        <>
                          <VisualScannerIcon size={17} />
                          <span>شروع تحلیل هوشمند و تطبیق با کاتالوگ اطلس</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {analysisError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {analysisError}
                </div>
              )}

              {analysisResult && (
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] border border-black/[0.08] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <h3 className="font-bold text-sm text-[#0D0D0D]">
                        نتیجه تحلیل بینایی ماشین FORZA
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-[#C95210] font-mono tabular-nums">
                      دقت تطبیق: {Number.isFinite(analysisResult.summary.confidence) ? `${analysisResult.summary.confidence}%` : 'اعلام نشده'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F9F9F9] border border-black/[0.06] text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-[#8E8EA0] block text-[10px]">نوع قطعه</span>
                        <strong className="text-[#0D0D0D]">
                          {analysisResult.summary.detectedPartType}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#8E8EA0] block text-[10px]">پروفیل استاندارد</span>
                        <strong className="text-[#0D0D0D] font-mono">
                          {analysisResult.summary.detectedProfile}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#8E8EA0] block text-[10px]">خانواده قطعه</span>
                        <strong className="text-[#0D0D0D]">
                          {analysisResult.summary.partFamilyFarsi || 'نامشخص'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#8E8EA0] block text-[10px]">متریال</span>
                        <strong className="text-[#0D0D0D]">
                          {analysisResult.summary.material || 'نامشخص'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#0D0D0D] mb-3">
                      قطعات منطبق و معادل در کاتالوگ اطلس
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {analysisResult.matchedProducts.map(item => (
                        <div
                          key={item.code}
                          className="p-3.5 rounded-xl bg-[#FFFFFF] border border-black/[0.08] hover:border-[#E06518] flex flex-col justify-between space-y-3 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-15 h-15 rounded-xl bg-[#F9F9F9] border border-black/[0.06] p-1.5 flex items-center justify-center shrink-0">
                              <img
                                src={item.image || (item.catalogProduct ? item.catalogProduct.image : '')}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-[11px] mb-0.5">
                                <span className="text-[#E06518] font-bold">{item.brand}</span>
                                <span aria-hidden="true" className="text-[#CBD2D8]">·</span>
                                <span className="font-mono tabular-nums text-[#8E8EA0]">
                                  {item.code}
                                </span>
                              </div>
                              <h5 className="font-bold text-xs text-[#0D0D0D] line-clamp-1">
                                {item.name}
                              </h5>
                              <p className="text-[11px] text-[#5D5D67] mt-1 line-clamp-2">
                                {item.matchReason}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2.5 border-t border-black/[0.06]">
                            <div className="text-xs">
                              {item.catalogProduct ? (
                                <span className="font-semibold text-[#0D0D0D]">
                                  قیمت و موجودی در پنل
                                </span>
                              ) : (
                                <span className="text-[#8E8EA0] text-[11px]">استعلام قیمت</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {item.catalogProduct && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (currentUser) navigate(memberPath(currentUser, item.code));
                                    else openAuthModal(memberPath(null, item.code), 'register');
                                  }}
                                  className="px-3 py-1.5 rounded-full bg-[#E06518] hover:bg-[#C95210] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>خرید</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => transferAnalysisToChat(item)}
                                className="px-3 py-1.5 rounded-full bg-[#F4F4F4] hover:bg-[#E5E5E5] text-[#0D0D0D] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>چت مهندسی</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ================================================================= */
            /* TAB 2: WEBSITE-TONED CHATGPT ENGINEERING WORKBENCH                */
            /* ================================================================= */
            <div className="flex-1 overflow-hidden flex flex-col justify-between relative bg-[#FFFFFF]">
              {/* Collapsible Catalog Search Drawer (keeps chat area uncluttered) */}
              <AnimatePresence>
                {isCatalogSearchOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    id="forza-workspace-catalog-drawer"
                    className="forza-workspace-catalog-drawer relative z-30 shrink-0 border-b border-[#DFE3E6] bg-[#FAFBFB] overflow-visible"
                  >
                    <div className="px-3 sm:px-6 py-2.5">
                      <WorkspaceCatalog
                        onSelect={family => {
                          setIsCatalogSearchOpen(false);
                          startCatalogFamilyConsultation(family);
                        }}
                        onAddToConsultation={startCatalogConsultation}
                        onClose={() => setIsCatalogSearchOpen(false)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {messages.length === 0 ? (
                /* EMPTY STATE:
                   - Mobile (<640px): Top-down compact brand greeting + starter cards, Composer pinned ergonomically at bottom
                   - Tablet/Desktop (sm+): Centered focal canvas with FORZA logo cascade, headline, centered composer, and 2x2 starter cards */
                <div className="flex-1 flex flex-col overflow-y-auto px-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <div className="hidden sm:block sm:flex-1" />

                  <motion.div
                    initial={{ opacity: 0, y: -14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-[740px] mx-auto flex flex-col flex-1 sm:flex-initial"
                  >
                    {/* Greeting & Website-Aligned Brand Emblem */}
                    <div className="order-1 text-center pt-5 sm:pt-0 pb-4 sm:pb-6">
                      <motion.img
                        initial={{ y: -18, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                        src="/images/brand/logo-forza.webp"
                        alt="FORZA"
                        className="h-9 sm:h-11 w-auto mx-auto mb-3 object-contain"
                      />
                      <h1 className="text-[19px] sm:text-[26px] font-extrabold text-[#2B313A] tracking-tight text-balance">
                        امروز روی چه قطعه‌ای کار می‌کنیم؟
                      </h1>
                      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[#74757C]">
                        <button
                          type="button"
                          onClick={() => setShowSettingsModal(true)}
                          className="inline-flex items-center gap-1 hover:text-[#E06518] transition-colors cursor-pointer"
                        >
                          <span>حوزه فعال:</span>
                          <strong className="text-[#2B313A] font-semibold">
                            {activeIndustryLabel}
                          </strong>
                        </button>
                        <span aria-hidden="true">·</span>
                        <span>کاتالوگ صنعت پیش و اطلس</span>
                      </div>
                    </div>

                    {/* Starter Engineering Cards (Compact grid on Mobile, crisp 2x2 below Composer on Desktop) */}
                    <div className="order-2 sm:order-3 pt-1 sm:pt-5 pb-4 sm:pb-0 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 text-right">
                      {PROMPT_SUGGESTIONS.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSend(item.query)}
                            className="min-h-[56px] sm:min-h-[64px] px-3.5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFFFF] border border-[#DFE3E6] hover:bg-[#FAFBFB] hover:border-[#E06518]/65 text-right transition-all duration-150 cursor-pointer group flex items-center gap-3"
                          >
                            <div className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-[#F5F6F6] group-hover:bg-[#FFF4EC] text-[#55565A] group-hover:text-[#E06518] flex items-center justify-center shrink-0 transition-colors">
                              <Icon size={17} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs sm:text-[13px] text-[#2B313A] truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-[#74757C] mt-0.5 line-clamp-1">
                                {item.desc}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Uncluttered Composer (Bottom Thumb-Zone on Mobile, Centered Hero Focal Anchor on Tablet/Desktop) */}
                    <div className="order-3 sm:order-2 mt-auto sm:mt-0 sticky bottom-0 sm:static pt-2 bg-[#FFFFFF]">
                      {renderComposerBox(true)}
                      <p className="hidden sm:block text-center text-[11px] text-[#74757C] mt-2.5">
                        مشخصات فنی بر اساس کاتالوگ صنعت پیش و بازرگانی تسمه اطلس استخراج می‌شود.
                      </p>
                    </div>
                  </motion.div>

                  <div className="hidden sm:block sm:flex-1" />
                </div>
              ) : (
                /* ACTIVE CONVERSATION STREAM + UNCLUTTERED COMPOSER */
                <>
                  <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
                    <div className="space-y-3 sm:space-y-4 max-w-[740px] mx-auto w-full">
                      {messages.map(m => (
                        <WorkspaceMessageItem
                          key={m.id}
                          message={m}
                          isCopied={copiedId === m.id}
                          feedback={feedbackState[m.id]}
                          onCopy={copyToClipboard}
                          onFeedback={handleFeedback}
                          onNavigateLink={handleNavigateLink}
                        />
                      ))}

                      {loading && (
                        <div className="flex items-start gap-2.5 sm:gap-4 py-2">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFFFFF] border border-[#DFE3E6] flex items-center justify-center shrink-0">
                            <CognivoGeometricLogo className="w-4 h-4 animate-pulse" />
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-[#55565A] pt-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E06518]" />
                            <span>FORZA در حال تنظیم پاسخ فنی...</span>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <div className="px-3 sm:px-6 pt-1 bg-[#FFFFFF] shrink-0 z-20 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    {renderComposerBox(false)}
                    <p className="hidden sm:block text-center text-[11px] text-[#74757C] mt-2">
                      مشخصات فنی بر اساس کاتالوگ صنعت پیش و بازرگانی تسمه اطلس استخراج می‌شود.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Extracted Modals */}
      <DinCalculatorModal
        isOpen={showCalculatorModal}
        onClose={() => setShowCalculatorModal(false)}
        calcC={calcC}
        calcD={calcD}
        calcd={calcd}
        onChangeC={setCalcC}
        onChangeD={setCalcD}
        onChanged={setCalcd}
        calcResult={calcResult}
        onApplyToChat={(length, ratio) => {
          setShowCalculatorModal(false);
          setActiveWorkspaceTab('chat');
          void handleSend(
            `لطفاً تسمه مناسب با طول نامی ${length} میلیمتر و نسبت دور ۱:${ratio} را از کاتالوگ صنعت پیش و بازرگانی تسمه اطلس پیشنهاد دهید.`
          );
        }}
      />

      <WorkspaceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        industries={INDUSTRY_DOMAINS}
        selectedIndustry={selectedIndustry}
        onSelectIndustry={setSelectedIndustry}
        calculationStandard={calculationStandard}
        onChangeCalculationStandard={setCalculationStandard}
        onClearAllHistory={clearAllHistory}
      />

      {/* Visual Part Search Wizard Modal */}
      {isVisualSearchModalOpen && (
        <Suspense fallback={<div role="status">در حال آماده‌سازی شناسایی تصویر…</div>}>
          <AiVisualPartSearchModal
            isOpen={isVisualSearchModalOpen}
            onClose={() => setIsVisualSearchModalOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};
export default AiConsultPage;
