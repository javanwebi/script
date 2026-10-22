import {durableStorage} from "../services/durableStorage";
import {WorkspaceCatalog} from '../components/search/WorkspaceCatalog';
import {MemberAccess,memberPath} from '../components/storefront/MemberAccess';
import {useAuth} from '../context/AuthContext';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  User,
  ChevronLeft,
  X,
  RotateCcw,
  Calculator,
  Camera,
  PhoneCall,
  FileText,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Globe,
  Lightbulb,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Settings,
  Home,
  Send,
  Trash2,
  Scan,
  Share2,
  Factory,
  Upload,
  RefreshCw,
  ShoppingCart,
  SwitchCamera,
  MessageSquare,
  Search,
  Zap,
  Gauge,
  History,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { apiUrl } from '../config/apiConfig';
import { toPersianDigits, formatPrice } from '../utils/formatters';
import { renderEngineeringMarkdown } from '../utils/engineeringMarkdown';
import { CognivoGeometricLogo } from '../components/common/AiFloatingButton';
import {
  aiVisualSearchService,
  AiPartAnalysisResult,
  MatchedPartItem,
  INDUSTRIAL_PRESET_SAMPLES,
  IndustrialPresetSample,
} from '../services/aiVisualSearchService';
import { useCart } from '../context/CartContext';
import { AiVisualPartSearchModal } from '../components/search/AiVisualPartSearchModal';

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

const STORAGE_KEY = 'forza_industrial_chat_sessions_v2';
const ACTIVE_SESSION_KEY = 'forza_active_session_id_v2';

interface PartCategoryOption {
  id: string;
  title: string;
  subtitle: string;
  defaultApplication: string;
  recommendedParams: string;
}

const PART_CATEGORIES: PartCategoryOption[] = [
  {
    id: 'belts',
    title: 'تسمه‌های انتقال قدرت و تایمینگ',
    subtitle: 'V-Belt، تایمینگ PU و کلروپرن، شیاردار، جوشی',
    defaultApplication: 'سیستم‌های انتقال قدرت الکتروموتور و شفت',
    recommendedParams: 'طول اسمی (Li/Lp)، عرض مقطع (mm)، گام دندانه',
  },
  {
    id: 'pulleys',
    title: 'پولی‌ها و چرخ‌تسمه‌های صنعتی',
    subtitle: 'تایمینگ دندانه‌دار، گوه، تیپرلاک FORZA، چدنی',
    defaultApplication: 'شفت الکتروموتور و گیربکس خطوط تولید',
    recommendedParams: 'قطر خارجی، تعداد دندانه یا شیار، قطر سوراخ شفت',
  },
  {
    id: 'bearings',
    title: 'بلبرینگ‌ها و یاتاقان‌ها',
    subtitle: 'شیار عمیق، رولربیرینگ، یاتاقان بلبرینگ صنعتی',
    defaultApplication: 'محورها و شفت‌های دوار با دور بالا',
    recommendedParams: 'قطر داخلی (d)، قطر خارجی (D)، پهنا (B)',
  },
  {
    id: 'chains',
    title: 'زنجیرها، چرخ‌دنده‌ها و کوپلینگ‌ها',
    subtitle: 'زنجیر تک‌ردیفه و دوبل، دنده‌زنجیر، کوپلینگ رابر',
    defaultApplication: 'انتقال گشتاور و نوار نقاله‌های بار سنگین',
    recommendedParams: 'گام زنجیر (اینچ/میلیمتر)، تعداد دندانه، مدل کوپلینگ',
  },
  {
    id: 'kiln',
    title: 'قطعات خطوط کوره، کاشی و سرامیک',
    subtitle: 'رولیک نسوز، لاستیک کوره، تسمه‌های حرارتی',
    defaultApplication: 'کوره رولری پخت کاشی و خطوط لعاب‌کاری',
    recommendedParams: 'طول رولیک، قطر خارجی، دمای کارکرد (C°)',
  },
  {
    id: 'other',
    title: 'سایر قطعات مکانیکی و ساختنی',
    subtitle: 'کاسه‌نمد، بوش‌های برنزی، واشرها و قطعات خاص',
    defaultApplication: 'آب‌بندی و نگهداری تخصصی تجهیزات کارخانه',
    recommendedParams: 'ابعاد سه‌گانه، متریال (NBR / فولاد / پلی‌یورتان)',
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
    icon: Calculator,
  },
  {
    title: 'استعلام قطعات FORZA و SWR',
    desc: 'کد، ابعاد و اطلاعات ثبت‌شده محصولات',
    query: 'بررسی مشخصات فنی، موجودی انبار مرکزی و استعلام قیمت برندهای انحصاری SWR آلمان و FORZA ایتالیا',
    icon: Globe,
  },
  {
    title: 'قطعات کوره کاشی و سرامیک',
    desc: 'رولیک‌های سرامیکی، پولی و تسمه‌های نسوز',
    query: 'شرایط نگهداری، طول عمر مفید و دمای کارکرد تسمه‌های صنعتی و رولیک‌های نسوز در کوره کاشی و سرامیک چیست؟',
    icon: Factory,
  },
  {
    title: 'تطبیق و استخراج مشخصات',
    desc: 'تبدیل لیست قطعات به کدهای استاندارد',
    query: 'خلاصه‌سازی و استخراج مشخصات فنی: لیست کدهای فنی تسمه، پولی و یاتاقان را با استانداردهای مربوطه مرتب کنید.',
    icon: FileText,
  },
];

export const AiConsultPage: React.FC<{ identificationOnly?: boolean }> = ({ identificationOnly = false }) => {
  const navigate = useNavigate();
  const {currentUser,openAuthModal}=useAuth();
  const [entryParams]=useSearchParams();
  const { addToCart } = useCart();

  React.useEffect(() => {
    if (!identificationOnly && entryParams.get('view') === 'visual') navigate('/identify-part?from=workspace&' + entryParams.toString(), { replace: true });
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

  // Settings State
  const [selectedIndustry, setSelectedIndustry] = useState(()=>entryParams.get('industry')||'general');
  const [calculationStandard, setCalculationStandard] = useState<'din' | 'fast'>('din');

  // Visual Part Studio State
  const [selectedPartCategory, setSelectedPartCategory] = useState<string>('belts');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const createNewSession = (autoFocus = true) => {
    const newId = 'session-' + Date.now();
    const newSession: ChatSession = {
      id: newId,
      title: 'گفتگوی جدید',
      timestamp: Date.now(),
      messages: [],
    };
    const updated = [newSession, ...sessions.filter(s => s.messages.length > 0)];
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
        createNewSession(false);
      }
    }
  };

  const clearAllHistory = () => {
    durableStorage.removeItem(STORAGE_KEY);
    durableStorage.removeItem(ACTIVE_SESSION_KEY);
    setSessions([]);
    createNewSession(false);
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
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetSample = (sample: IndustrialPresetSample) => {
    setCapturedImage(sample.imageUrl);
    stopCamera();
    setDimensionLength(sample.length ? sample.length.toString() : "");
    setDimensionWidth(sample.width ? sample.width.toString() : "");
    setDimensionPitch(sample.pitch ? sample.pitch.toString() : "");
    setPartApplication(sample.application);
    setPartMarking(sample.features);
  };

  const runAiPartAnalysis = async () => {
    if (!capturedImage) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    const selectedCategoryObj = PART_CATEGORIES.find(c => c.id === selectedPartCategory);
    const categoryPromptHint = selectedCategoryObj
      ? `[دسته‌بندی اعلامی قطعه: ${selectedCategoryObj.title} - ${selectedCategoryObj.subtitle}] `
      : '';
    const markingHint = partMarking ? `کد و مارکینگ حک‌شده روی بدنه قطعه: ${partMarking}. ` : '';
    const fullFeatures = `${categoryPromptHint}${markingHint}`;

    try {
      const result = await aiVisualSearchService.analyzePartWithAi({
        imageBase64: capturedImage,
        mimeType: 'image/jpeg',
        length: dimensionLength ? parseFloat(dimensionLength) : undefined,
        width: dimensionWidth ? parseFloat(dimensionWidth) : undefined,
        pitch: dimensionPitch ? parseFloat(dimensionPitch) : undefined,
        application: partApplication || selectedCategoryObj?.defaultApplication,
        features: fullFeatures,
        stage: 'refined',
      });

      setAnalysisResult(result);
    } catch (err: any) {
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
    const targetItem = item || analysisResult?.matchedProducts?.[0];
    if (targetItem) {
      handleSend(
        `در خصوص قطعه شناسایی‌شده «${targetItem.name}» با کد فنی ${targetItem.code} (${targetItem.brand}): لطفاً موجودی انبار مرکزی اطلس، قیمت دقیق و شرایط صدور پیش‌فاکتور رسمی را اعلام فرمایید.`
      );
    } else if (analysisResult?.summary) {
      handleSend(
        `هوش مصنوعی فورزا قطعه را به عنوان «${analysisResult.summary.detectedPartType}» با پروفیل «${analysisResult.summary.detectedProfile}» شناسایی کرده است. لطفاً توصیه‌های فنی و مدل‌های موجود در کاتالوگ را بررسی کنید.`
      );
    }
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend) return;

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
      const queryWithContext = `${industryPrefix}${stageContext ? `[بخش خط تولید: ${stageContext}] ` : ""}${
        isDeeperResearchActive ? '[تحلیل عمیق و استاندارد فنی] ' : ''
      }${textToSend}`;

      let streamSucceeded = false;
      let finalAiText = '';

      try {
        const res = await fetch(apiUrl('/api/ai/consult-stream'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortCtrl.signal,
          body: JSON.stringify({
            query: queryWithContext,
            history: historyPayload,
            responseId: uniqueResponseId,
            includeAudio: false,
          }),
        });

        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let accumulatedText = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              try {
                const data = JSON.parse(trimmed.slice(5).trim());
                if (data.type === 'text_chunk') {
                  streamSucceeded = true;
                  accumulatedText = data.textSoFar || accumulatedText + (data.chunk || '');
                  finalAiText = accumulatedText;
                  setMessages(prev =>
                    prev.map(m => (m.id === aiMessageId ? { ...m, text: accumulatedText } : m))
                  );
                } else if (data.type === 'done') {
                  streamSucceeded = true;
                  accumulatedText = data.fullText || accumulatedText;
                  finalAiText = accumulatedText;
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === aiMessageId
                        ? {
                            ...m,
                            text: accumulatedText,
                            suggestedAction: data.suggestedAction,
                          }
                        : m
                    )
                  );
                }
              } catch {}
            }
          }
        }
      } catch {}

      if (!streamSucceeded) {
        const res = await fetch(apiUrl('/api/ai/consult'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: queryWithContext,
            history: historyPayload,
            includeSpeech: false,
          }),
        });

        if (!res.ok) throw new Error('خطا در دریافت پاسخ');
        const data = await res.json();
        finalAiText =
          data.reply ||
          'توصیه مهندسی FORZA: با توجه به کاتالوگ صنعتی اطلس، استفاده از قطعات اورجینال دارای گواهینامه معتبر پیشنهاد می‌شود.';

        setMessages(prev =>
          prev.map(m =>
            m.id === aiMessageId
              ? {
                  ...m,
                  text: finalAiText,
                  suggestedAction: data.suggestedAction,
                }
              : m
          )
        );
      }

      const finalMessagesList = [
        ...messages,
        newUserMessage,
        {
          id: aiMessageId,
          sender: 'ai' as const,
          text: finalAiText,
          time: timeNow,
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
    } catch {
      const fallbackText = `### پاسخ مشاور مهندسی FORZA:
در انتخاب قطعات انتقال قدرت، توان الکتروموتور، دور ورودی و خروجی، فاصله مراکز شفت‌ها و دمای محیطی کارکرد تعیین‌کننده است.

جهت استعلام موجودی انبار مرکزی و پیش‌فاکتور رسمی مودیان با کدهای استاندارد کالا، همکاران فنی ما در خدمت شما هستند.`;

      const finalMessagesList = [
        ...messages,
        newUserMessage,
        {
          id: aiMessageId,
          sender: 'ai' as const,
          text: fallbackText,
          time: timeNow,
          suggestedAction: {
            label: 'مشاهده کاتالوگ قطعات صنعتی',
            link: '/products',
          },
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
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyChatLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 2500);
  };

  // Group and filter sessions
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
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

  // Render Sidebar
  const renderSidebarContent = () => (
    <div className="h-full flex flex-col justify-between select-none bg-[#F4F4F5] border-l border-[#CBD2D8]">
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Sidebar Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#CBD2D8] bg-[#FFFFFF] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F4F4F5] border border-[#CBD2D8] flex items-center justify-center shrink-0">
              <CognivoGeometricLogo className="w-5 h-5 text-[#E06518]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-[#2B313A]">
                  میزکار FORZA
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="block text-[10px] text-[#777A7D] font-medium">
                مشاور هوشمند خطوط تولید اطلس
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSidebarOpen(false);
              setIsMobileDrawerOpen(false);
            }}
            title="بستن منو"
            className="p-1.5 rounded-lg text-[#55565A] hover:text-[#2B313A] hover:bg-[#DEE2E5] transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="p-3 space-y-2">
          {/* New Chat Button */}
          <button
            type="button"
            onClick={() => createNewSession()}
            className="w-full py-2.5 px-3.5 rounded-xl bg-[#E06518] hover:bg-[#C95210] active:scale-98 text-white font-bold text-xs flex items-center justify-between shadow-xs transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>گفتگوی جدید</span>
            </div>
            <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-white font-mono text-[10px]">
              + New
            </span>
          </button>

          {/* Quick Search in History */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#777A7D] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={sessionSearchQuery}
              onChange={e => setSessionSearchQuery(e.target.value)}
              placeholder="جستجو در گفتگوها..."
              className="w-full h-8 pr-8 pl-3 bg-[#FFFFFF] border border-[#CBD2D8] rounded-xl text-xs text-[#2B313A] placeholder-[#777A7D] focus:outline-none focus:border-[#E06518]"
            />
          </div>

          {/* Live Call to AI FORZA */}
          <button
            type="button"
            onClick={() => {
              setIsMobileDrawerOpen(false);
              navigate('/ai-forza');
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#FFFFFF] border border-[#CBD2D8] hover:border-[#E06518] hover:text-[#E06518] flex items-center justify-between text-right transition-all cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-[#2B313A] group-hover:text-[#E06518]">
                  تماس زنده چهره‌به‌چهره
                </div>
                <div className="text-[10px] text-[#777A7D]">مکالمه بلادرنگ صوتی FORZA</div>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-[#777A7D] group-hover:text-[#E06518] group-hover:-translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-4 text-right">
          {/* Today */}
          {todaySessions.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-[#777A7D]">امروز</div>
              <div className="space-y-1">
                {todaySessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => switchSession(session.id)}
                    className={`group px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between cursor-pointer transition-all ${
                      activeSessionId === session.id && activeWorkspaceTab === 'chat'
                        ? 'bg-[#FFFFFF] text-[#E06518] font-bold shadow-2xs border border-[#CBD2D8]'
                        : 'text-[#55565A] hover:bg-[#DEE2E5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={e => deleteSession(session.id, e)}
                      title="حذف گفتگو"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#777A7D] hover:text-rose-600 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yesterday */}
          {yesterdaySessions.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-[#777A7D]">دیروز</div>
              <div className="space-y-1">
                {yesterdaySessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => switchSession(session.id)}
                    className={`group px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between cursor-pointer transition-all ${
                      activeSessionId === session.id && activeWorkspaceTab === 'chat'
                        ? 'bg-[#FFFFFF] text-[#E06518] font-bold shadow-2xs border border-[#CBD2D8]'
                        : 'text-[#55565A] hover:bg-[#DEE2E5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={e => deleteSession(session.id, e)}
                      title="حذف گفتگو"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#777A7D] hover:text-rose-600 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Older */}
          {olderSessions.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-[#777A7D]">روزهای گذشته</div>
              <div className="space-y-1">
                {olderSessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => switchSession(session.id)}
                    className={`group px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between cursor-pointer transition-all ${
                      activeSessionId === session.id && activeWorkspaceTab === 'chat'
                        ? 'bg-[#FFFFFF] text-[#E06518] font-bold shadow-2xs border border-[#CBD2D8]'
                        : 'text-[#55565A] hover:bg-[#DEE2E5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={e => deleteSession(session.id, e)}
                      title="حذف گفتگو"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#777A7D] hover:text-rose-600 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sessions.every(s => s.messages.length === 0) && (
            <div className="p-4 text-center text-xs text-[#777A7D] leading-relaxed">
              هنوز گفتگویی ذخیره نشده است. با ارسال اولین پیام، تاریخچه به صورت خودکار ایجاد می‌شود.
            </div>
          )}
        </div>
      </div>

      {/* Settings & Profile Bar at Bottom */}
      <div className="p-3 border-t border-[#CBD2D8] bg-[#FFFFFF] space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setIsMobileDrawerOpen(false);
            setShowSettingsModal(true);
          }}
          className="w-full py-2 px-2.5 rounded-xl bg-[#F4F4F5] border border-[#CBD2D8] text-[#55565A] hover:text-[#2B313A] hover:border-[#E06518] flex items-center justify-between text-xs font-bold transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#55565A]" />
            <span>تنظیمات میزکار FORZA</span>
          </div>
          <span className="text-[10px] text-[#777A7D]">مدیریت</span>
        </button>

        <div className="flex items-center justify-between p-2 rounded-xl bg-[#F4F4F5] border border-[#CBD2D8]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E06518]/10 text-[#E06518] flex items-center justify-center font-black text-xs">
              <Factory className="w-4 h-4" />
            </div>
            <div className="text-right leading-tight">
              <div className="font-bold text-xs text-[#2B313A]">
                {INDUSTRY_DOMAINS.find(d => d.id === selectedIndustry)?.label || 'صنایع عمومی'}
              </div>
              <span className="text-[10px] text-[#777A7D]">میزکار صنعتی فعال</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            title="بازگشت به فروشگاه"
            className="p-1 text-[#777A7D] hover:text-[#E06518]"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="h-[100dvh] max-h-[100dvh] w-full flex flex-col bg-[#F8F9FA] text-[#2B313A] overflow-hidden select-none"
      dir="rtl"
    >
      {/* Top Hairline Orange Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#CBD2D8] via-[#E06518] to-[#CBD2D8] opacity-90 shrink-0" />

      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. DESKTOP SIDEBAR */}
        <aside hidden={identificationOnly}
          className={`${
            !identificationOnly && isSidebarOpen ? 'w-72 xl:w-80' : 'w-0 hidden'
          } transition-all duration-300 ease-in-out hidden lg:flex flex-col shrink-0 overflow-hidden z-20`}
        >
          {renderSidebarContent()}
        </aside>

        {/* 2. MOBILE SLIDE-OVER DRAWER (RTL Natural Sheet) */}
        {!identificationOnly && isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex justify-start">
            <div
              className="fixed inset-0 bg-[#2B313A]/50 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            <div className="relative w-80 max-w-[85vw] h-full shadow-2xl flex flex-col z-50 bg-[#F4F4F5] animate-in slide-in-from-right duration-200">
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* 3. MAIN WORKSPACE CONTAINER */}
        <main className="flex-1 flex flex-col bg-[#F8F9FA] overflow-hidden min-w-0">
          {/* Top Header Bar */}
          {identificationOnly ? <header className="h-14 px-4 border-b border-[#CBD2D8] flex items-center justify-between bg-white shrink-0"><strong>شناسایی هوشمند قطعه</strong><button type="button" onClick={() => navigate('/ai-consult')} className="px-4 py-2 rounded-xl border border-[#CBD2D8] text-sm">بازگشت به میزکار</button></header> : <header className="h-14 px-2.5 sm:px-5 border-b border-[#CBD2D8] flex items-center justify-between shrink-0 bg-[#FFFFFF] z-20 shadow-2xs">
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              {/* Mobile Drawer Button */}
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="lg:hidden p-2 rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F4F4F5] transition-colors cursor-pointer border border-[#CBD2D8] bg-[#FFFFFF] shadow-2xs"
                title="تاریخچه گفتگوها و سوابق"
              >
                <PanelLeft className="w-4.5 h-4.5 text-[#2B313A]" />
              </button>

              {/* Desktop Toggle Button */}
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  title="نمایش منو"
                  className="hidden lg:flex p-2 rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F4F4F5] transition-colors cursor-pointer"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              )}

              {/* Brand & Workspace Title */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                  <CognivoGeometricLogo className="w-5 h-5 text-[#E06518]" />
                </div>
                <div className="hidden sm:block text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm text-[#2B313A] tracking-tight">
                      میزکار هوشمند FORZA
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      میزکار یکپارچه
                    </span>
                  </div>
                  <span className="text-[10px] text-[#777A7D] block -mt-0.5">
                    مشاوره تخصصی و شناسایی قطعات خطوط تولید
                  </span>
                </div>
                <div className="sm:hidden flex items-center gap-1.5">
                  <span className="font-black text-xs text-[#2B313A]">
                    میزکار FORZA
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>

              {/* Desktop Workspace Segmented Controller */}
              <div className="hidden md:flex items-center gap-1 p-1 bg-[#F4F4F5] rounded-xl border border-[#CBD2D8] mr-2">
                <button
                  type="button"
                  onClick={() => identificationOnly ? navigate('/ai-consult') : setActiveWorkspaceTab('chat')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeWorkspaceTab === 'chat'
                      ? 'bg-[#FFFFFF] text-[#E06518] shadow-2xs border border-[#CBD2D8]'
                      : 'text-[#55565A] hover:text-[#2B313A]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>گفتگوی مهندسی</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/identify-part?from=workspace')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeWorkspaceTab === 'visual_studio'
                      ? 'bg-[#FFFFFF] text-[#E06518] shadow-2xs border border-[#CBD2D8]'
                      : 'text-[#55565A] hover:text-[#2B313A]'
                  }`}
                >
                  <Scan className="w-3.5 h-3.5 text-[#E06518]" />
                  <span>استودیوی شناسایی قطعه</span>
                </button>
              </div>
            </div>

            {/* Quick Actions (Call, Calculator, Share, Shop) */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Live Voice Call Button */}
              <button
                type="button"
                onClick={() => navigate('/ai-forza')}
                className="px-2 sm:px-3 py-1.5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                title="مکالمه زنده و چهره‌به‌چهره با هوش مصنوعی FORZA"
              >
                <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden xs:inline">تماس زنده</span>
              </button>

              {/* Belt Calculator Trigger */}
              <button
                type="button"
                onClick={() => setShowCalculatorModal(true)}
                title="فرمول محاسبه طول تسمه (DIN 2215)"
                className="p-2 rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F4F4F5] transition-colors cursor-pointer border border-[#CBD2D8] bg-[#FFFFFF] shadow-2xs"
              >
                <Calculator className="w-4 h-4 text-[#E06518]" />
              </button>

              {/* Share */}
              <button
                type="button"
                onClick={handleCopyChatLink}
                title="اشتراک‌گذاری میزکار"
                className="hidden sm:flex p-2 rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F4F4F5] transition-colors cursor-pointer border border-[#CBD2D8] bg-[#FFFFFF]"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {/* Settings */}
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                title="تنظیمات میزکار"
                className="p-2 rounded-xl text-[#55565A] hover:text-[#2B313A] hover:bg-[#F4F4F5] transition-colors cursor-pointer border border-[#CBD2D8] bg-[#FFFFFF] shadow-2xs"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Back to Store */}
              <button
                type="button"
                onClick={() => navigate('/')}
                title="بازگشت به پرتال صنعت پیش"
                className="p-2 rounded-xl text-[#55565A] hover:text-[#E06518] hover:bg-[#F4F4F5] transition-colors cursor-pointer border border-[#CBD2D8] bg-[#FFFFFF] shadow-2xs"
              >
                <Home className="w-4 h-4" />
              </button>
            </div>
          </header>}

          {/* Mobile Dedicated Segmented Tabs Bar (Sticky right below top header) */}
          <div hidden={identificationOnly} className="md:hidden bg-[#FFFFFF] border-b border-[#CBD2D8] px-3 py-1.5 shrink-0 z-10 shadow-2xs">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F4F4F5] rounded-xl border border-[#CBD2D8]">
              <button
                type="button"
                onClick={() => identificationOnly ? navigate('/ai-consult') : setActiveWorkspaceTab('chat')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeWorkspaceTab === 'chat'
                    ? 'bg-[#FFFFFF] text-[#E06518] shadow-xs border border-[#CBD2D8]'
                    : 'text-[#55565A] hover:text-[#2B313A]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>گفتگوی مهندسی</span>
                {messages.length > 0 && (
                  <span className="w-4.5 h-4.5 rounded-full bg-orange-100 text-[#E06518] text-[10px] font-mono font-bold flex items-center justify-center mr-0.5">
                    {messages.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/identify-part?from=workspace')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeWorkspaceTab === 'visual_studio'
                    ? 'bg-[#FFFFFF] text-[#E06518] shadow-xs border border-[#CBD2D8]'
                    : 'text-[#55565A] hover:text-[#2B313A]'
                }`}
              >
                <Scan className="w-4 h-4 text-[#E06518]" />
                <span>استودیو شناسایی قطعه</span>
              </button>
            </div>
          </div>

          {/* Share Toast */}
          {showShareToast && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#2B313A] text-white text-xs font-bold rounded-full shadow-xl flex items-center gap-2 z-40 animate-in fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>لینک صفحه با موفقیت کپی شد!</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 1: VISUAL PART IDENTIFICATION STUDIO                         */}
          {/* ================================================================= */}
          {identificationOnly || activeWorkspaceTab === 'visual_studio' ? (
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-4xl mx-auto w-full pb-20 md:pb-8">
              {/* Studio Header Banner */}
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFFFFF] border border-[#CBD2D8] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#E06518] text-[10px] sm:text-[11px] font-black">
                      سامانه بینایی ماشین هوش مصنوعی
                    </span>
                    <span className="text-[11px] text-[#777A7D]">تطبیق با کاتالوگ صنعتی اطلس</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-[#2B313A]">
                    استودیوی شناسایی و تطبیق تصویری قطعات FORZA
                  </h2>
                  <p className="text-xs text-[#55565A] mt-1 leading-relaxed">
                    با انتخاب دسته‌بندی و ارسال تصویر از طریق دوربین، هوش مصنوعی پروفیل، گام دندانه و مشخصات قطعه را بررسی می‌کند.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => identificationOnly ? navigate('/ai-consult') : setActiveWorkspaceTab('chat')}
                  className="px-3 py-1.5 rounded-xl border border-[#CBD2D8] hover:border-[#E06518] text-[#55565A] hover:text-[#E06518] text-xs font-bold bg-[#FFFFFF] flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>انتقال به گفتگوی مهندسی</span>
                </button>
              </div>

              {/* STEP 1: CATEGORY SELECTION */}
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFFFFF] border border-[#CBD2D8] shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#E06518] text-white text-xs font-black flex items-center justify-center shrink-0">
                      ۱
                    </span>
                    <h3 className="font-black text-xs sm:text-sm text-[#2B313A]">
                      انتخاب دسته‌بندی قطعه صنعتی
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#777A7D] hidden sm:inline">
                    {PART_CATEGORIES.find(c => c.id === selectedPartCategory)?.recommendedParams}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {PART_CATEGORIES.map(category => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedPartCategory(category.id)}
                      className={`p-3 rounded-xl sm:rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                        selectedPartCategory === category.id
                          ? 'border-[#E06518] bg-orange-50/50 shadow-xs ring-1 ring-orange-500/20'
                          : 'border-[#CBD2D8] bg-[#FFFFFF] hover:bg-[#F4F4F5]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            selectedPartCategory === category.id
                              ? 'bg-[#E06518] text-white'
                              : 'bg-[#F4F4F5] text-[#55565A]'
                          }`}
                        >
                          <Scan className="w-3.5 h-3.5" />
                        </div>
                        {selectedPartCategory === category.id && (
                          <Check className="w-3.5 h-3.5 text-[#E06518]" />
                        )}
                      </div>

                      <div>
                        <h4
                          className={`font-black text-xs ${
                            selectedPartCategory === category.id ? 'text-[#E06518]' : 'text-[#2B313A]'
                          }`}
                        >
                          {category.title}
                        </h4>
                        <p className="text-[10px] text-[#777A7D] mt-0.5 line-clamp-1">
                          {category.subtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 2: CAMERA CAPTURE OR FILE UPLOAD */}
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFFFFF] border border-[#CBD2D8] shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#E06518] text-white text-xs font-black flex items-center justify-center shrink-0">
                      ۲
                    </span>
                    <h3 className="font-black text-xs sm:text-sm text-[#2B313A]">
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
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف و ثبت مجدد</span>
                    </button>
                  )}
                </div>

                {/* Viewport or Preview */}
                {!capturedImage ? (
                  <div className="space-y-3">
                    {isCameraActive ? (
                      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-80 mx-auto border-2 border-[#E06518]">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        {/* Camera Scanline overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="w-48 h-48 border border-white/60 rounded-xl relative">
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#E06518]" />
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#E06518]" />
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#E06518]" />
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#E06518]" />
                          </div>
                        </div>

                        {/* Camera controls */}
                        <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={toggleCameraFacing}
                            className="p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                            title="تغییر دوربین"
                          >
                            <SwitchCamera className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="w-12 h-12 rounded-full bg-[#E06518] text-white flex items-center justify-center shadow-lg border-2 border-white active:scale-95"
                            title="ثبت تصویر"
                          >
                            <Camera className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80"
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
                          className="p-6 rounded-2xl border-2 border-dashed border-[#CBD2D8] hover:border-[#E06518] hover:bg-orange-50/20 flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
                        >
                          <div className="w-12 h-12 rounded-full bg-orange-100 text-[#E06518] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                            <Camera className="w-6 h-6" />
                          </div>
                          <span className="font-bold text-xs sm:text-sm text-[#2B313A]">
                            فعال‌سازی دوربین زنده
                          </span>
                          <span className="text-[11px] text-[#777A7D] mt-0.5">
                            تصویربرداری مستقیم از قطعه یا خط تولید
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-6 rounded-2xl border-2 border-dashed border-[#CBD2D8] hover:border-[#E06518] hover:bg-orange-50/20 flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
                        >
                          <div className="w-12 h-12 rounded-full bg-[#DEE2E5] text-[#55565A] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                            <Upload className="w-6 h-6" />
                          </div>
                          <span className="font-bold text-xs sm:text-sm text-[#2B313A]">
                            بارگذاری تصویر از گالری
                          </span>
                          <span className="text-[11px] text-[#777A7D] mt-0.5">
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

                    {/* Industrial Preset Samples Carousel */}
                    <div className="pt-2">
                      <div className="text-[11px] font-bold text-[#777A7D] mb-2">
                        یا انتخاب سریع از نمونه‌های صنعتی آماده:
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {INDUSTRIAL_PRESET_SAMPLES.map(sample => (
                          <button
                            key={sample.id}
                            type="button"
                            onClick={() => handleSelectPresetSample(sample)}
                            className="px-2.5 py-1.5 rounded-xl border border-[#CBD2D8] bg-[#FFFFFF] hover:border-[#E06518] text-right shrink-0 flex items-center gap-2 cursor-pointer shadow-2xs"
                          >
                            <img
                              src={sample.imageUrl}
                              alt={sample.title}
                              className="w-8 h-8 rounded-lg object-contain bg-[#F4F4F5]"
                            />
                            <div className="text-right">
                              <div className="text-[11px] font-bold text-[#2B313A] truncate max-w-[120px]">
                                {sample.title}
                              </div>
                              <div className="text-[9px] text-[#777A7D]">{sample.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Captured image preview & run button */
                  <div className="space-y-4">
                    <div className="relative rounded-2xl overflow-hidden bg-[#F4F4F5] border border-[#CBD2D8] max-h-72 flex items-center justify-center p-2">
                      <img
                        src={capturedImage}
                        alt="تصویر ثبت‌شده"
                        className="max-h-64 object-contain rounded-xl"
                      />
                    </div>

                    {/* Optional Dimensions Inputs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] text-[#55565A] block mb-1">
                          طول / عرض (mm):
                        </label>
                        <input
                          type="number"
                          value={dimensionLength}
                          onChange={e => setDimensionLength(e.target.value)}
                          placeholder="مثلاً ۱۲۰۰"
                          className="w-full h-8 px-2.5 bg-[#F4F4F5] border border-[#CBD2D8] rounded-lg text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#55565A] block mb-1">
                          گام دندانه (mm):
                        </label>
                        <input
                          type="number"
                          value={dimensionPitch}
                          onChange={e => setDimensionPitch(e.target.value)}
                          placeholder="مثلاً ۸"
                          className="w-full h-8 px-2.5 bg-[#F4F4F5] border border-[#CBD2D8] rounded-lg text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-[#55565A] block mb-1">
                          کد یا مارکینگ حک‌شده:
                        </label>
                        <input
                          type="text"
                          value={partMarking}
                          onChange={e => setPartMarking(e.target.value)}
                          placeholder="مثلاً FORZA 8M 1200 یا NSK 6205"
                          className="w-full h-8 px-2.5 bg-[#F4F4F5] border border-[#CBD2D8] rounded-lg text-right"
                        />
                      </div>
                    </div>

                    {/* Run Analysis Button */}
                    <button
                      type="button"
                      onClick={runAiPartAnalysis}
                      disabled={isAnalyzing}
                      className="w-full py-3 rounded-xl bg-[#E06518] hover:bg-[#C95210] active:scale-98 disabled:bg-[#CBD2D8] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      {isAnalyzing ? (
                        <>
                          <Sparkles className="w-4 h-4 animate-spin" />
                          <span>سامانه در حال استخراج و تحلیل فنی قطعه...</span>
                        </>
                      ) : (
                        <>
                          <Scan className="w-4 h-4" />
                          <span>شروع تحلیل هوشمند و تطبیق با کاتالوگ اطلس</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* STEP 3: ANALYSIS RESULTS */}
              {analysisError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {analysisError}
                </div>
              )}

              {analysisResult && (
                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFFFFF] border border-[#CBD2D8] shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#CBD2D8]">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <h3 className="font-black text-sm text-[#2B313A]">
                        نتیجه تحلیل بینایی ماشین FORZA
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-[#E06518] bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                      دقت تطبیق: {analysisResult.summary.confidence}%
                    </span>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3.5 rounded-xl bg-[#F4F4F5] border border-[#CBD2D8] text-xs space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <span className="text-[#777A7D] block text-[10px]">نوع قطعه:</span>
                        <strong className="text-[#2B313A]">
                          {analysisResult.summary.detectedPartType}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#777A7D] block text-[10px]">پروفیل استاندارد:</span>
                        <strong className="text-[#2B313A]">
                          {analysisResult.summary.detectedProfile}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#777A7D] block text-[10px]">خانواده قطعه:</span>
                        <strong className="text-[#2B313A]">
                          {analysisResult.summary.partFamilyFarsi || 'قطعات انتقال قدرت'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#777A7D] block text-[10px]">متریال:</span>
                        <strong className="text-[#2B313A]">
                          {analysisResult.summary.material || 'فولاد / لاستیک صنعتی'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Matched Products */}
                  <div>
                    <h4 className="font-black text-xs sm:text-sm text-[#2B313A] mb-3">
                      قطعات منطبق و معادل در کاتالوگ اطلس:
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {analysisResult.matchedProducts.map(item => (
                        <div
                          key={item.code}
                          className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#FFFFFF] border border-[#CBD2D8] hover:border-[#E06518] shadow-2xs flex flex-col justify-between space-y-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-16 h-16 rounded-xl bg-[#F4F4F5] border border-[#CBD2D8] p-1.5 flex items-center justify-center shrink-0">
                              <img
                                src={item.image || (item.catalogProduct ? item.catalogProduct.image : '')}
                                alt={item.name}
                                className="w-full h-full object-contain"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="px-1.5 py-0.5 rounded bg-orange-100 text-[#E06518] font-bold text-[10px]">
                                  {item.brand}
                                </span>
                                <span className="font-mono text-[10px] text-[#777A7D]">
                                  {item.code}
                                </span>
                              </div>
                              <h5 className="font-black text-xs text-[#2B313A] line-clamp-1">
                                {item.name}
                              </h5>
                              <p className="text-[11px] text-[#55565A] mt-1 line-clamp-2">
                                {item.matchReason}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#DEE2E5]">
                            <div className="text-xs">
                              {item.catalogProduct ? (
                                <span className="font-black text-[#2B313A]">
                                  قیمت و موجودی در پنل
                                </span>
                              ) : (
                                <span className="text-[#777A7D] text-[11px]">استعلام قیمت</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {item.catalogProduct && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if(currentUser)navigate(memberPath(currentUser,item.code));else openAuthModal(memberPath(null,item.code),"register");
                                    return;
                                    setAddedCartCode(item.code);
                                    setTimeout(() => setAddedCartCode(null), 2000);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#E06518] hover:bg-[#C95210] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  {false ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>افزوده شد</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingCart className="w-3 h-3" />
                                      <span>خرید</span>
                                    </>
                                  )}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => transferAnalysisToChat(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#DEE2E5] hover:bg-[#CBD2D8] text-[#2B313A] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
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
            /* TAB 2: ENGINEERING CHAT WORKSPACE                                 */
            /* ================================================================= */
            <div className="flex-1 overflow-hidden flex flex-col justify-between relative">
              {/* Message Feed Area */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 max-w-4xl mx-auto w-full pb-4 md:pb-6">
                {messages.length === 0 ? (
                  /* INITIAL WELCOME SCREEN */
                  <div className="min-h-full flex flex-col items-center justify-center py-6 sm:py-10 max-w-2xl mx-auto text-center">
                    {/* Brand Logo & Status */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#FFFFFF] border border-[#CBD2D8] shadow-sm flex items-center justify-center mb-4">
                      <CognivoGeometricLogo className="w-10 h-10 sm:w-12 sm:h-12 text-[#E06518]" />
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black text-[#2B313A] mb-1.5">
                      میزکار هوشمند FORZA
                    </h1>
                    <p className="text-xs sm:text-sm text-[#55565A] mb-6 max-w-md leading-relaxed">
                      مشاوره انتخاب قطعات، جستجوی مشخصات کاتالوگ و محاسبات مهندسی در یک میزکار
                    </p>

                    {/* Quick Suggestions Grid */}
                    <WorkspaceCatalog />
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-right">
                      {PROMPT_SUGGESTIONS.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSend(item.query)}
                            className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#CBD2D8] hover:border-[#E06518] hover:shadow-sm text-right transition-all cursor-pointer group flex items-start gap-3"
                          >
                            <div className="w-8 h-8 rounded-xl bg-[#F4F4F5] group-hover:bg-orange-50 text-[#55565A] group-hover:text-[#E06518] flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-black text-xs text-[#2B313A] group-hover:text-[#E06518] transition-colors">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-[#777A7D] mt-0.5 line-clamp-1">
                                {item.desc}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ACTIVE MESSAGE STREAM */
                  <div className="space-y-4">
                    {messages.map(m => (
                      <div
                        key={m.id}
                        className={`flex items-start gap-2.5 sm:gap-3.5 ${
                          m.sender === 'user' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm shadow-2xs ${
                            m.sender === 'user'
                              ? 'bg-[#2B313A] text-white'
                              : 'bg-[#FFFFFF] border border-[#CBD2D8] text-[#E06518]'
                          }`}
                        >
                          {m.sender === 'user' ? (
                            <User className="w-4 h-4" />
                          ) : (
                            <CognivoGeometricLogo className="w-4 h-4 text-[#E06518]" />
                          )}
                        </div>

                        <div
                          className={`max-w-[88%] sm:max-w-[80%] rounded-2xl sm:rounded-3xl p-3.5 sm:p-4.5 space-y-2.5 shadow-2xs transition-all ${
                            m.sender === 'user'
                              ? 'bg-[#2B313A] text-white rounded-tr-xs'
                              : 'bg-[#FFFFFF] text-[#2B313A] border border-[#CBD2D8] rounded-tl-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] pb-1 border-b border-current/10">
                            <span className="font-bold">
                              {m.sender === 'user' ? 'شما' : 'مشاور فنی هوش مصنوعی FORZA'}
                            </span>
                            <span className="opacity-60">{m.time}</span>
                          </div>

                          <div className="text-xs sm:text-sm leading-relaxed font-normal">
                            {m.sender === 'ai' ? (
                              renderEngineeringMarkdown(m.text, false)
                            ) : (
                              <div className="whitespace-pre-wrap">{m.text}</div>
                            )}
                          </div>

                          {m.suggestedAction && m.suggestedAction.link && (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => navigate(m.suggestedAction!.link!)}
                                className="w-full py-2 px-3 rounded-xl bg-[#F4F4F5] hover:bg-[#E06518] hover:text-white text-[#2B313A] font-bold text-xs flex items-center justify-between border border-[#CBD2D8] transition-colors cursor-pointer"
                              >
                                <span>{m.suggestedAction.label}</span>
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {m.sender === 'ai' && (
                            <div className="flex items-center justify-between pt-2 border-t border-[#CBD2D8]/60 text-xs">
                              <div className="text-[10px] text-[#777A7D]">
                                کاتالوگ بازرگانی اطلس
                              </div>

                              <div className="flex items-center gap-1.5 text-[#55565A]">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(m.text, m.id)}
                                  className="p-1 hover:text-[#2B313A] hover:bg-[#F4F4F5] rounded transition-colors flex items-center gap-1"
                                  title="کپی متن"
                                >
                                  {copiedId === m.id ? (
                                    <span className="text-emerald-600 font-bold text-[10px]">
                                      کپی شد
                                    </span>
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFeedbackState(prev => ({ ...prev, [m.id]: 'up' }))
                                  }
                                  className={`p-1 rounded transition-colors ${
                                    feedbackState[m.id] === 'up'
                                      ? 'text-emerald-600'
                                      : 'hover:text-[#2B313A]'
                                  }`}
                                  title="مفید بود"
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFeedbackState(prev => ({ ...prev, [m.id]: 'down' }))
                                  }
                                  className={`p-1 rounded transition-colors ${
                                    feedbackState[m.id] === 'down'
                                      ? 'text-rose-600'
                                      : 'hover:text-[#2B313A]'
                                  }`}
                                  title="نیاز به بازنگری"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {loading && (
                      <div className="flex items-center gap-2.5 p-3.5 bg-[#FFFFFF] rounded-2xl border border-[#CBD2D8] text-xs text-[#E06518] font-bold shadow-2xs max-w-sm">
                        <Sparkles className="w-4 h-4 animate-spin text-[#E06518]" />
                        <span>مشاور FORZA در حال پردازش و استخراج پاسخ فنی...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Bottom Sticky Composer Bar (Ergonomic with safe-area padding on mobile) */}
              <div className="p-2 sm:p-3 bg-[#FFFFFF] border-t border-[#CBD2D8] shrink-0 z-20 shadow-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="max-w-4xl mx-auto w-full bg-[#F4F4F5] rounded-2xl border border-[#CBD2D8] p-2 focus-within:border-[#E06518] focus-within:bg-[#FFFFFF] transition-all">
                  <div className="flex items-end gap-2">
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
                      placeholder="پرسش فنی درباره تسمه، پولی، یاتاقان، زنجیر..."
                      className="flex-1 bg-transparent text-xs sm:text-sm text-[#2B313A] placeholder-[#777A7D] resize-none focus:outline-none min-h-[38px] max-h-28 py-1.5 px-1 leading-relaxed"
                    />

                    {/* Action buttons inside composer */}
                    <div className="flex items-center gap-1 shrink-0 pb-0.5">
                      {/* Deep Research toggle */}
                      <button
                        type="button"
                        onClick={() => setIsDeeperResearchActive(!isDeeperResearchActive)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isDeeperResearchActive
                            ? 'bg-[#E06518] text-white shadow-xs'
                            : 'text-[#777A7D] hover:text-[#E06518] hover:bg-[#DEE2E5]'
                        }`}
                        title="تحلیل عمیق فنی استاندارد"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>

                      {/* Camera / Visual Part Switch */}
                      <button
                        type="button"
                        onClick={() => navigate('/identify-part?from=workspace')}
                        className="p-2 rounded-xl text-[#777A7D] hover:text-[#E06518] hover:bg-[#DEE2E5] transition-colors cursor-pointer"
                        title="شناسایی قطعه با دوربین"
                      >
                        <Camera className="w-4 h-4" />
                      </button>

                      {/* Calculator Trigger */}
                      <button
                        type="button"
                        onClick={() => setShowCalculatorModal(true)}
                        className="p-2 rounded-xl text-[#777A7D] hover:text-[#E06518] hover:bg-[#DEE2E5] transition-colors cursor-pointer"
                        title="محاسبه‌گر تسمه DIN 2215"
                      >
                        <Calculator className="w-4 h-4" />
                      </button>

                      {/* Send Button */}
                      <button
                        type="button"
                        onClick={() => handleSend()}
                        disabled={!inputQuery.trim() || loading}
                        className="w-9 h-9 rounded-xl bg-[#E06518] hover:bg-[#C95210] disabled:bg-[#CBD2D8] text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                        title="ارسال"
                      >
                        <Send className="w-4 h-4 -rotate-45" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Belt Calculator Modal (DIN 2215) with Touch-Friendly UI */}
      {showCalculatorModal && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#2B313A]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-[#CBD2D8] space-y-4 text-right animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Mobile Sheet Handle */}
            <div className="w-10 h-1 rounded-full bg-[#CBD2D8] mx-auto -mt-1 mb-1 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-[#DEE2E5]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#E06518] flex items-center justify-center">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#2B313A]">
                    محاسبه طول نامی تسمه و نسبت دور
                  </h3>
                  <span className="text-[10px] text-[#777A7D]">بر مبنای استاندارد DIN 2215</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCalculatorModal(false)}
                className="p-1.5 rounded-lg text-[#55565A] hover:text-[#2B313A] hover:bg-[#DEE2E5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[#55565A] font-bold block mb-1">
                  فاصله بین مراکز دو شفت (C mm):
                </label>
                <input
                  type="number"
                  value={calcC}
                  onChange={e => setCalcC(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F4F4F5] border border-[#CBD2D8] rounded-xl font-mono text-center text-[#2B313A] focus:outline-none focus:border-[#E06518] font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[#55565A] font-bold block mb-1">پولی بزرگ (D mm):</label>
                  <input
                    type="number"
                    value={calcD}
                    onChange={e => setCalcD(e.target.value)}
                    className="w-full h-10 px-3 bg-[#F4F4F5] border border-[#CBD2D8] rounded-xl font-mono text-center text-[#2B313A] focus:outline-none focus:border-[#E06518] font-bold"
                  />
                </div>
                <div>
                  <label className="text-[#55565A] font-bold block mb-1">پولی کوچک (d mm):</label>
                  <input
                    type="number"
                    value={calcd}
                    onChange={e => setCalcd(e.target.value)}
                    className="w-full h-10 px-3 bg-[#F4F4F5] border border-[#CBD2D8] rounded-xl font-mono text-center text-[#2B313A] focus:outline-none focus:border-[#E06518] font-bold"
                  />
                </div>
              </div>

              {calcResult && (
                <div className="p-3.5 bg-[#F4F4F5] border border-[#CBD2D8] rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-[#55565A]">طول اسمی تسمه (Lp):</span>
                    <span className="font-mono font-black text-sm text-[#E06518]">
                      {toPersianDigits(calcResult.length)} میلیمتر
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-[#55565A]">نسبت تبدیل دور (Ratio):</span>
                    <span className="font-mono font-bold text-[#2B313A]">
                      ۱ به {toPersianDigits(calcResult.ratio)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCalculatorModal(false);
                      setActiveWorkspaceTab('chat');
                      handleSend(
                        `لطفاً تسمه مناسب با طول نامی ${calcResult.length} میلیمتر و نسبت دور ۱:${calcResult.ratio} را از کاتالوگ صنعت پیش و بازرگانی تسمه اطلس پیشنهاد دهید.`
                      );
                    }}
                    className="w-full mt-2 py-2.5 bg-[#E06518] hover:bg-[#C95210] active:scale-98 text-white font-bold rounded-xl text-center cursor-pointer shadow-xs"
                  >
                    ارسال این مقادیر به مشاور FORZA ↵
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#2B313A]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-[#CBD2D8] space-y-4 text-right animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Mobile Sheet Handle */}
            <div className="w-10 h-1 rounded-full bg-[#CBD2D8] mx-auto -mt-1 mb-1 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-[#DEE2E5]">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#E06518]" />
                <h3 className="font-black text-sm text-[#2B313A]">تنظیمات میزکار هوشمند FORZA</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg text-[#55565A] hover:text-[#2B313A] hover:bg-[#DEE2E5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Industry Domain */}
              <div>
                <label className="text-[#55565A] font-bold block mb-1.5">
                  حوزه تخصصی کارخانه یا واحد صنعتی:
                </label>
                <select
                  value={selectedIndustry}
                  onChange={e => setSelectedIndustry(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F4F4F5] border border-[#CBD2D8] rounded-xl font-medium text-[#2B313A] focus:outline-none focus:border-[#E06518]"
                >
                  {INDUSTRY_DOMAINS.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#777A7D] mt-1">
                  پاسخ‌های هوش مصنوعی با اولویت استانداردهای این حوزه ارائه می‌شوند.
                </p>
              </div>

              {/* Standard vs Fast Mode */}
              <div>
                <label className="text-[#55565A] font-bold block mb-1.5">دقت محاسبات مهندسی:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCalculationStandard('din')}
                    className={`p-2.5 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                      calculationStandard === 'din'
                        ? 'border-[#E06518] bg-orange-50 text-[#E06518]'
                        : 'border-[#CBD2D8] bg-[#F4F4F5] text-[#55565A]'
                    }`}
                  >
                    استاندارد دقیق DIN 2215
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalculationStandard('fast')}
                    className={`p-2.5 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                      calculationStandard === 'fast'
                        ? 'border-[#E06518] bg-orange-50 text-[#E06518]'
                        : 'border-[#CBD2D8] bg-[#F4F4F5] text-[#55565A]'
                    }`}
                  >
                    استعلام سریع کارگاهی
                  </button>
                </div>
              </div>

              {/* Clear History */}
              <div className="pt-2 border-t border-[#DEE2E5]">
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="w-full py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>پاک‌سازی کامل تاریخچه گفتگوهای ذخیره‌شده</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="w-full py-2.5 bg-[#E06518] hover:bg-[#C95210] text-white font-bold rounded-xl text-center cursor-pointer shadow-xs"
              >
                ذخیره و بازگشت به میزکار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Part Search Wizard Modal */}
      <AiVisualPartSearchModal
        isOpen={isVisualSearchModalOpen}
        onClose={() => setIsVisualSearchModalOpen(false)}
      />
    </div>
  );
};
export default AiConsultPage;
