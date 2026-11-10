import {LocalModelResults} from './LocalModelResults';
import {apiUrl} from '../../config/apiConfig';
import {ImageRegionSelector} from './ImageRegionSelector';
import {ImageRegionReview, type RegionPreparationState} from './ImageRegionReview';
import type {ImageRegion} from '../../utils/imageRegion';
import {measurementError} from '../../utils/partMeasurements';
import { memberPath } from "../storefront/MemberAccess";
import React, { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  Image as GalleryImage,
  SwitchCamera,
  UploadCloud,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Ruler,
  Sliders,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  ShoppingCart,
  Zap,
  Info,
  Check,
  RotateCcw,
  ShieldCheck,
  Eye,
  Wrench,
  Phone,
  MessageCircle,
  Scan,
  Target,
  Cpu,
  Activity,
  ExternalLink,
  Search,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import {
  aiVisualSearchService,
  AiPartAnalysisResult,
  AiAnalysisStage,
  INDUSTRIAL_PRESET_SAMPLES,
  IndustrialPresetSample,
} from "../../services/aiVisualSearchService";
import { getProductImageUrl } from "../../assets/imagesproducts";
import { toPersianDigits, formatPrice } from "../../utils/formatters";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { pricingCreditService } from "../../services/pricingCreditService";
import { IMAGES } from "../../assets/images";
import "./industrial-scan.css";
import { VisionAnalysisProgress } from "./VisionAnalysisProgress";
import { saveCustomerDeviceImage, getCustomerDeviceImage, getCustomerDeviceImageMetadata, adoptCustomerDeviceImage, customerImageBlobToDataUrl } from "../../services/customerImageVault";
import { createCustomerImageIdentification, completeCustomerImageIdentification, selectCustomerImageProduct } from "../../services/customerIntelligenceService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fullScreen?: boolean;
  initialCamera?: boolean;
  onAnalysisResult?: (result: AiPartAnalysisResult, image: string) => void;
}

type WizardStep = 1 | 2 | 3 | "analyzing" | "results";

interface AnalysisPhase {
  title: string;
  en: string;
  icon: React.ElementType;
  tag: string;
  detail: string;
}

const ANALYSIS_PHASES: AnalysisPhase[] = [
  {title:"آماده‌سازی برش تأییدشده",en:"APPROVED CROP",icon:Scan,tag:"برش قطعه",detail:"استفاده از همان ناحیه‌ای که مشتری تأیید کرده است"},
  {title:"استخراج ویژگی‌های ظاهری",en:"VISIBLE FEATURES",icon:Ruler,tag:"ویژگی‌های ظاهری",detail:"بررسی شکل، نشانه‌ها و نوشته‌های قابل مشاهده"},
  {title:"ساخت توصیف تصویری",en:"VISUAL EMBEDDING",icon:Cpu,tag:"تحلیل تصویر",detail:"استخراج بردار تصویری از موتور محلی"},
  {title:"مقایسه با کاتالوگ واقعی",en:"CATALOGUE RETRIEVAL",icon:Layers,tag:"مقایسه کاتالوگ",detail:"مقایسه با تصاویر خانواده‌ها و مدل‌های ثبت‌شده"},
  {title:"مرتب‌سازی گزینه‌های معتبر",en:"RESULT VALIDATION",icon:ShieldCheck,tag:"اعتبارسنجی نتایج",detail:"حذف پیشنهادهای ضعیف و نامرتبط"},
];

export const AiVisualPartSearchModal: React.FC<Props> = ({
  isOpen,
  onClose,
  fullScreen = false,
  initialCamera = false,
  onAnalysisResult,
}) => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { currentUser, openAuthModal } = useAuth();

  // Wizard state: 1: Image, 2: Dimensions, 3: Application & Features, 'analyzing', 'results'
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Form states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [queryRegion,setQueryRegion]=useState<ImageRegion>();
  const [candidateRegions,setCandidateRegions]=useState<ImageRegion[]>([]);
  const [regionDetectionState,setRegionDetectionState]=useState<RegionPreparationState>('uploading');
  const [regionDetectionMessage,setRegionDetectionMessage]=useState('');
  const [regionDetectionId,setRegionDetectionId]=useState<string|null>(null);
  const [fullImageSelected,setFullImageSelected]=useState(false);
  const regionDetectionSequenceRef=useRef(0);
  const imagePreparationSequenceRef=useRef(0);
  const analysisSequenceRef=useRef(0);
  const analysisBusyRef=useRef(false);
  const regionTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [localRegionEnabled,setLocalRegionEnabled]=useState(false);
  React.useEffect(()=>{
    if(!isOpen)return;
    const controller=new AbortController();
    fetch(apiUrl('/api/ai/local-vision-status'),{signal:controller.signal,cache:'no-store'})
      .then(r=>r.ok?r.json():null).then(data=>{if(!controller.signal.aborted)setLocalRegionEnabled(data?.enabled===true && ['local-lens-v2','local-lens-v3'].includes(data?.pipeline));})
      .catch(()=>{if(!controller.signal.aborted)setLocalRegionEnabled(false);});
    return ()=>controller.abort();
  },[isOpen]);
  React.useEffect(()=>{setQueryRegion(undefined);setCandidateRegions([]);setRegionDetectionId(null);setFullImageSelected(false);regionDetectionSequenceRef.current++;analysisSequenceRef.current++;analysisBusyRef.current=false;if(regionTimerRef.current)clearTimeout(regionTimerRef.current);},[selectedImage]);
  React.useEffect(()=>{if(!isOpen){analysisSequenceRef.current++;analysisBusyRef.current=false;setCurrentStep(step=>step==="analyzing"?1:step);}return()=>{if(regionTimerRef.current)clearTimeout(regionTimerRef.current);};},[isOpen]);
  const [localImageId, setLocalImageId] = useState<string | null>(null);
  const [imageEventId, setImageEventId] = useState<string | null>(null);
  // Request-scoped data URL only; original Blob remains in the device vault.
  const [temporaryImageDataUrl, setTemporaryImageDataUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const imageUploadSequenceRef = useRef(0);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [length, setLength] = useState<string>("");

  // Progress reflects completed image comparisons returned by the server.
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhaseIndex, setAnalysisPhaseIndex] = useState(0);
  const [scanCounts,setScanCounts]=useState<{compared:number;total:number;stage:string}|null>(null);
  const [width, setWidth] = useState<string>("");
  const [pitch, setPitch] = useState<string>("");
  const [application, setApplication] = useState<string>("");
  const [features, setFeatures] = useState<string>("");

  // Camera stream state
  const [isUsingCamera, setIsUsingCamera] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraFlowActive, setCameraFlowActive] = useState<boolean>(initialCamera);
  const [cameraReview, setCameraReview] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [canUseTorch, setCanUseTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showCameraHelp, setShowCameraHelp] = useState(false);
  const cameraGalleryRef = useRef<HTMLInputElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  React.useEffect(() => {
    if (!isOpen) {
      cameraRequestRef.current++;
      cameraStreamRef.current?.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    return () => {
      cameraRequestRef.current++;
      cameraStreamRef.current?.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    };
  }, [isOpen]);
  React.useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add("sanat-visual-search-open");
    return () => document.body.classList.remove("sanat-visual-search-open");
  }, [isOpen]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [measurements,setMeasurements]=useState<Record<string,string>>({});
  // Analysis result & error
  const [analysisResult, setAnalysisResult] =
    useState<AiPartAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showSimilar, setShowSimilar] = useState<boolean>(true);
  const visiblePhotoMatches=(analysisResult?.catalogImageMatches || []).filter(photo=>
    !analysisResult?.modelSuggestions?.length || photo.bindings.length===0);

  // Short part family for dynamic titles, e.g. «این چرخ‌دهنده‌ها را داریم».
  // Different per product type (wheel / belt / pulley / bush / ...).
  const partFamily =
    (analysisResult?.summary?.partFamilyFarsi || "").trim() ||
    (analysisResult?.summary?.detectedPartType || "")
      .split(/[()/،,]/)[0]
      .trim()
      .split(/\s+/)[0] ||
    "";
  const partFamilyPlural = partFamily ? partFamily + "\u200cها" : "اقلام مشابه";

  // Two-stage flow: 'quick' = image-only instant ID, 'refined' = image + dims + application
  const [pendingStage, setPendingStage] = useState<AiAnalysisStage>("refined");
  const [lastStage, setLastStage] = useState<AiAnalysisStage>("refined");

  // Quick preset chips for applications and features
  const APPLICATION_SUGGESTIONS = [
    "کوره رولری پخت کاشی و سرامیک",
    "خط لعاب‌کاری و چاپ دیجیتال",
    "فن‌های مکنده و کمپرسور باد",
    "ماشین‌آلات بسته‌بندی پرسرعت",
    "پرس هیدرولیک و اکسترودر",
    "نوار نقاله و خطوط انتقال مواد",
  ];

  const FEATURE_SUGGESTIONS = [
    "مقاوم به حرارت بالا (تا ۱۲۰۰ درجه)",
    "ضدروغن، اسید و گریس صنعتی",
    "روکش پارچه‌ای ضدسایش (بی‌صدا)",
    "کورد استیل ضدزنگ و تقویت‌شده",
    "بدون لغزش دندانه و انعطاف بالا",
  ];

  const uploadSelectedImage = async (source: string | Blob, originalName = "customer-image"): Promise<string> => {
    const sequence = ++imageUploadSequenceRef.current;
    setIsUploadingImage(true);
    try {
      const blob = typeof source === "string"
        ? await fetch(source, { credentials: "same-origin", cache: "no-store" }).then(response => {
            if (!response.ok) throw new Error("خواندن تصویر انتخاب‌شده ناموفق بود.");
            return response.blob();
          })
        : source;
      const saved = await saveCustomerDeviceImage(blob, currentUser?.id || "guest", originalName);
      const dataUrl = await customerImageBlobToDataUrl(blob);
      if (sequence === imageUploadSequenceRef.current) {
        setLocalImageId(saved.id);
        setMimeType(saved.mimeType);
        setTemporaryImageDataUrl(dataUrl);
      }
      return dataUrl;
    } catch (error: any) {
      if (sequence === imageUploadSequenceRef.current) {
        setLocalImageId(null);
        setTemporaryImageDataUrl(null);
        setErrorMessage(error?.message || "ذخیره تصویر در حافظه داخلی دستگاه انجام نشد.");
      }
      throw error;
    } finally {
      if (sequence === imageUploadSequenceRef.current) setIsUploadingImage(false);
    }
  };

  const friendlyVisionError = (error: any) => {
    if (error?.code === 'VISION_BUSY' || error?.status === 429) return 'موتور شناسایی در حال تأیید ناحیه دیگری است. چند لحظه دیگر دوباره تلاش کنید.';
    if (error?.code === 'INDEX_NOT_READY') return 'کاتالوگ تصویری در حال آماده‌سازی است. تصویر شما محفوظ است؛ کمی بعد دوباره تلاش کنید.';
    if (error?.code === 'VISION_DISABLED') return 'تشخیص خودکار روی این سرور فعال نیست؛ ناحیه قطعه را دستی انتخاب کنید.';
    if (error?.code === 'CATALOG_UNAVAILABLE') return 'ارتباط با کاتالوگ برقرار نیست. تصویر شما محفوظ است؛ کمی بعد دوباره تلاش کنید.';
    if (error?.code === 'INVALID_REGION') return 'کادر انتخاب‌شده معتبر نیست؛ لطفاً ناحیه را دوباره مشخص کنید.';
    if (error?.status === 503) return 'ارتباط با موتور تحلیل موقتاً برقرار نشد. تصویر شما حذف نشده است؛ دوباره تلاش کنید یا ناحیه را دستی انتخاب کنید.';
    if (error?.name === 'TypeError') return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.';
    return error?.message || 'تحلیل تصویر کامل نشد. دوباره تلاش کنید.';
  };

  const detectUploadedImageRegions = async (imageUrl: string) => {
    const sequence = ++regionDetectionSequenceRef.current;
    setRegionDetectionState('detecting');
    setRegionDetectionMessage('');
    setRegionDetectionId(null);
    try {
      const detection = await aiVisualSearchService.detectImageRegions(imageUrl);
      if (sequence !== regionDetectionSequenceRef.current) return;
      setRegionDetectionId(detection.detectionId);
      setQueryRegion(detection.queryRegion);
      setCandidateRegions(detection.queryRegions);
      setFullImageSelected(!detection.queryRegion);
      setRegionDetectionState('ready');
      setLocalRegionEnabled(true);
      if (!detection.queryRegion) setRegionDetectionMessage('ناحیه خودکار قابل‌اعتماد پیدا نشد؛ می‌توانید کادر را دستی بکشید یا کل تصویر را انتخاب کنید.');
    } catch (error: any) {
      if (sequence !== regionDetectionSequenceRef.current) return;
      setRegionDetectionId(null);
      setQueryRegion(undefined);
      setCandidateRegions([]);
      setFullImageSelected(true);
      setRegionDetectionState('fallback');
      setRegionDetectionMessage(friendlyVisionError(error));
    }
  };

  const uploadAndPrepareImage = async (source: string | Blob, originalName = "customer-image") => {
    const sequence = ++imagePreparationSequenceRef.current;
    setErrorMessage('');
    setRegionDetectionMessage('');
    setRegionDetectionState('uploading');
    try {
      const imageUrl = await uploadSelectedImage(source, originalName);
      if (sequence !== imagePreparationSequenceRef.current) return;
      await detectUploadedImageRegions(imageUrl);
    } catch (error: any) {
      if (sequence !== imagePreparationSequenceRef.current) return;
      setRegionDetectionState('fallback');
      setFullImageSelected(true);
      setRegionDetectionMessage(friendlyVisionError(error));
    }
  };

  const retryRegionPreparation = () => {
    if (temporaryImageDataUrl) void detectUploadedImageRegions(temporaryImageDataUrl);
    else if (selectedImage) void uploadAndPrepareImage(selectedImage, "camera-capture.jpg");
  };

  const handleRegionSelection = (region: ImageRegion | undefined) => {
    setQueryRegion(region);
    setFullImageSelected(!region);
    setErrorMessage('');
  };

  // Upload first, then ask the local vision engine only for a crop proposal.
  // The full catalogue analysis is deliberately deferred until customer confirmation.
  const handleFile = (file: File) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const fileMime = (file.type || '').toLowerCase();
    const supportedExtension = /\.(?:jpe?g|png|webp)$/i.test(file.name);
    if ((fileMime ? !allowed.includes(fileMime) : !supportedExtension) || file.size > 10 * 1024 * 1024) {
      setErrorMessage('لطفاً تصویر JPG، PNG یا WebP با حجم حداکثر ۱۰ مگابایت انتخاب کنید.');
      return;
    }
    if (selectedImage?.startsWith("blob:")) URL.revokeObjectURL(selectedImage);
    imageUploadSequenceRef.current++;
    setLocalImageId(null);
    setTemporaryImageDataUrl(null);
    setImageEventId(null);
    setErrorMessage('');
    setAnalysisResult(null);
    setMeasurements({});
    setSelectedImage(URL.createObjectURL(file));
    setMimeType(file.type || "image/jpeg");
    setRegionDetectionState('uploading');
    setFullImageSelected(false);
    if (isUsingCamera) stopCamera();
    void uploadAndPrepareImage(file, file.name);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Preset sample loader
  const loadPreset = (preset: IndustrialPresetSample) => {
    if (selectedImage?.startsWith("blob:")) URL.revokeObjectURL(selectedImage);
    setAnalysisResult(null);setMeasurements({});
    setSelectedImage(preset.imageUrl);
    setLocalImageId(null);
    setTemporaryImageDataUrl(null);
    setImageEventId(null);
    setMimeType("image/jpeg");
    setErrorMessage("");
    setRegionDetectionState('uploading');
    void uploadAndPrepareImage(preset.imageUrl);
    setLength(preset.length ? preset.length.toString() : "");
    setWidth(preset.width ? preset.width.toString() : "");
    if (preset.pitch) setPitch(preset.pitch.toString());
    else setPitch("");
    setApplication(preset.application);
    setFeatures(preset.features);
    setErrorMessage("");
    if (isUsingCamera) stopCamera();
    // Presets follow the same observation and measurement flow as uploads.
    setCurrentStep(1);
  };

  // Camera start / stop / capture
  const startCamera = async (facing: "environment" | "user" = cameraFacing) => {
    const request = ++cameraRequestRef.current;
    try {
      setIsUsingCamera(true);
      setIsCameraReady(false);
      setErrorMessage("");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setCanUseTorch(Boolean(facing === "environment" && capabilities?.torch));
      setTorchEnabled(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setIsUsingCamera(false);
      setErrorMessage(
        "دسترسی به دوربین برقرار نشد. لطفاً از آپلود فایل یا تصاویر نمونه استفاده کنید.",
      );
    }
  };

  const stopCamera = () => {
    cameraRequestRef.current++;
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsUsingCamera(false);
    setIsCameraReady(false);
    setCanUseTorch(false);
    setTorchEnabled(false);
  };

  // Camera hardware actions are real, with disabled/unavailable states where unsupported.
  const switchCamera = () => {
    const next = cameraFacing === "environment" ? "user" : "environment";
    stopCamera();
    setCameraFacing(next);
    void startCamera(next);
  };
  const toggleTorch = async () => {
    const track = cameraStreamRef.current?.getVideoTracks()[0];
    if (!canUseTorch || !track) return;
    try {
      const torch = !torchEnabled;
      await track.applyConstraints({
        advanced: [{ torch } as MediaTrackConstraintSet & { torch: boolean }],
      });
      setTorchEnabled(torch);
    } catch {
      setErrorMessage("فلش دوربین در این دستگاه قابل فعال‌سازی نیست.");
      setCanUseTorch(false);
    }
  };
  const selectCameraGalleryImage = (file: File) => {
    const fileMime = (file.type || '').toLowerCase();
    const supportedExtension = /\.(?:jpe?g|png|webp)$/i.test(file.name);
    if ((fileMime ? !['image/jpeg','image/jpg','image/png','image/webp'].includes(fileMime) : !supportedExtension) || file.size > 12 * 1024 * 1024) {
      setErrorMessage("لطفاً تصویر JPG، PNG یا WebP کوچک‌تر از ۱۲ مگابایت انتخاب کنید.");
      return;
    }
    const preparationSequence = ++imagePreparationSequenceRef.current;
    imageUploadSequenceRef.current += 1;
    setIsUploadingImage(false);
    const reader = new FileReader();
    reader.onload = () => {
      if (preparationSequence !== imagePreparationSequenceRef.current || typeof reader.result !== "string") return;
      if (selectedImage?.startsWith("blob:")) URL.revokeObjectURL(selectedImage);
        setAnalysisResult(null);
      setMeasurements({});
      setSelectedImage(reader.result);
      setLocalImageId(null);
    setTemporaryImageDataUrl(null);
      setImageEventId(null);
      setMimeType(file.type || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : file.name.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'));
      setErrorMessage("");
      void uploadSelectedImage(file, file.name);
      setCameraReview(true);
      stopCamera();
    };
    reader.onerror = () => setErrorMessage("خواندن عکس از گالری انجام نشد. لطفاً دوباره تلاش کنید.");
    reader.readAsDataURL(file);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!isCameraReady || !video.videoWidth || !video.videoHeight) {
        setErrorMessage('تصویر دوربین هنوز آماده نشده است. پس از نمایش تصویر دوباره تلاش کنید.');
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        imagePreparationSequenceRef.current++;
        if (selectedImage?.startsWith("blob:"))
          URL.revokeObjectURL(selectedImage);
        setAnalysisResult(null);setMeasurements({});
        setSelectedImage(dataUrl);
            setLocalImageId(null);
    setTemporaryImageDataUrl(null);
        setImageEventId(null);
        setMimeType("image/jpeg");
        setErrorMessage("");
        if (cameraFlowActive) {
          // Keep the captured frame in memory only until the customer confirms it.
          setCameraReview(true);
          stopCamera();
          return;
        }
        setRegionDetectionState('uploading');
        void uploadAndPrepareImage(dataUrl, "camera-capture.jpg");
        stopCamera();
      }
    }
  };

  // Use the existing secure camera and catalog search pipeline for dock launches.
  React.useEffect(() => {
    if (!isOpen || !initialCamera) return;
    setCurrentStep(1);
    setCameraFlowActive(true);
    setCameraReview(false);
    void startCamera();
  }, [isOpen, initialCamera]);

  // Reset all
  const resetForm = () => {
    stopCamera();
    imagePreparationSequenceRef.current++;
    imageUploadSequenceRef.current += 1;
    setIsUploadingImage(false);
    if (selectedImage?.startsWith("blob:")) URL.revokeObjectURL(selectedImage);
    setSelectedImage(null);
    setLocalImageId(null);
    setTemporaryImageDataUrl(null);
    setImageEventId(null);
    setLength("");
    setWidth("");
    setPitch("");
    setApplication("");
    setFeatures("");
    setAnalysisResult(null);setMeasurements({});
    regionDetectionSequenceRef.current++;
    setRegionDetectionState('uploading');
    setRegionDetectionMessage('');
    setRegionDetectionId(null);
    setFullImageSelected(false);
    setErrorMessage("");
    setPendingStage("refined");
    setLastStage("refined");
    setCurrentStep(1);
  };

  // Navigation handlers
  const goToStep3 = () => {
    const issue=analysisResult?.requiredMeasurements && measurementError(analysisResult.requiredMeasurements,measurements);
    if(issue){setErrorMessage(issue);return;}
    if (!length && !width && !selectedImage) {
      setErrorMessage(
        "لطفاً طول و عرض تقریبی را وارد نمایید یا در مرحله قبل تصویر بارگذاری کنید.",
      );
      return;
    }
    setErrorMessage("");
    setCurrentStep(3);
  };

  // Submit to AI (two-stage: quick = image only, refined = image + dims + application)
  const handleAnalyze = async (stage: AiAnalysisStage = "refined", regionOverride?: ImageRegion | null, localImageIdOverride?: string) => {
    if (analysisBusyRef.current) return;
    if (!selectedImage && !length && !width) { setErrorMessage("لطفاً حداقل تصویر قطعه یا ابعاد (طول و عرض) را مشخص فرمایید."); return; }
    if (stage === "quick" && !selectedImage) { setErrorMessage("برای شناسایی فوری، ابتدا تصویر قطعه را بارگذاری کنید."); return; }
    if (isUploadingImage && !localImageIdOverride) { setErrorMessage("لطفاً صبر کنید تا ذخیره تصویر روی دستگاه کامل شود."); return; }
    const effectiveLocalImageId = localImageIdOverride || localImageId;
    if (stage === "refined" && analysisResult?.requiredMeasurements) {
      const issue = measurementError(analysisResult.requiredMeasurements, measurements);
      if (issue) { setErrorMessage(issue); setCurrentStep(2); return; }
    }
    const requestRegion = localRegionEnabled ? (regionOverride === null ? undefined : regionOverride || queryRegion) : undefined;
    const requestFullImage = regionOverride === null || (!requestRegion && fullImageSelected);
    analysisBusyRef.current = true;
    const sequence = ++analysisSequenceRef.current;
    setErrorMessage(""); setPendingStage(stage); setAnalysisProgress(0); setAnalysisPhaseIndex(0); setScanCounts(null); setCurrentStep("analyzing");
    let activeImageEventId: string | null = imageEventId;
    try {
      let imageBase64: string | undefined;
      if (selectedImage) {
        if (!effectiveLocalImageId) throw new Error("تصویر در حافظه داخلی دستگاه ثبت نشده است؛ لطفاً تصویر را دوباره انتخاب کنید.");
        const localRecord = await getCustomerDeviceImage(effectiveLocalImageId);
        if (!localRecord) throw new Error("تصویر محلی پیدا نشد؛ لطفاً تصویر را دوباره انتخاب کنید.");
        if (currentUser) await adoptCustomerDeviceImage(effectiveLocalImageId, currentUser.id);
        imageBase64 = await customerImageBlobToDataUrl(localRecord.blob);
        if (currentUser && !activeImageEventId) {
          const metadata = await getCustomerDeviceImageMetadata(effectiveLocalImageId);
          if (!metadata) throw new Error("اطلاعات تصویر محلی پیدا نشد.");
          try {
            const event = await createCustomerImageIdentification({ deviceImageId: metadata.id, sha256: metadata.sha256, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, originalName: metadata.originalName });
            activeImageEventId = event.id; setImageEventId(event.id);
          } catch (trackingError) { console.warn("[Customer image history] metadata sync unavailable", trackingError); }
        }
      }
      const result = await aiVisualSearchService.analyzePartWithAi({
        imageBase64, mimeType,
        length: length ? parseFloat(length) : undefined, width: width ? parseFloat(width) : undefined, pitch: pitch ? parseFloat(pitch) : undefined,
        application: application.trim() || undefined, features: features.trim() || undefined,
        stage, observationOnly: false, region: requestRegion, detectionId: regionDetectionId || undefined, fullImage: requestFullImage, includeNearest: false,
        measurements: stage === "refined" && analysisResult?.requiredMeasurements ? measurements : undefined,
      }, progress => {
        if (sequence !== analysisSequenceRef.current) return;
        setScanCounts(progress); setAnalysisProgress(progress.total ? Math.floor(progress.compared * 100 / progress.total) : 0);
        setAnalysisPhaseIndex(progress.stage === "verifying" ? 4 : progress.stage === "scanning" ? 3 : progress.stage === "preparing" ? 0 : 1);
      });
      if (sequence !== analysisSequenceRef.current) return;
      if (localRegionEnabled || result.localVisionMetrics) {
        setLocalRegionEnabled(true); setQueryRegion(result.queryRegion || requestRegion);
        if (!requestRegion) setCandidateRegions(result.queryRegions || []);
        setFullImageSelected(requestFullImage); setRegionDetectionState("ready");
      }
      if (activeImageEventId) {
        const matched = result.matchedProducts || [], similar = result.similarCandidates || [];
        void completeCustomerImageIdentification(activeImageEventId, {
          status: matched.length || similar.length ? "completed" : "unmatched", detectedPartType: result.summary?.detectedPartType,
          summary: result.summary?.whatYouSee || result.summary?.visualAnalysis, technicalAdvice: result.technicalAdvice,
          matchedProductCodes: matched.map(item => item.code), similarProductCodes: similar.map(item => item.code), confidence: result.summary?.confidence,
        }).catch(error => console.warn("[Customer image history] result sync unavailable", error));
      }
      setAnalysisResult(result);
      if (!result.observationOnly && (result.matchedProducts?.length || result.similarCandidates?.length)) {
        const conversationImage = temporaryImageDataUrl || selectedImage;
        if (conversationImage) onAnalysisResult?.(result, conversationImage);
      } setLastStage(result.stage || stage); setCurrentStep(result.observationOnly ? 2 : "results");
    } catch (error: any) {
      if (sequence !== analysisSequenceRef.current) return;
      console.error(error);
      if (activeImageEventId) void completeCustomerImageIdentification(activeImageEventId, { status: "failed" }).catch(() => undefined);
      setErrorMessage(friendlyVisionError(error)); setCurrentStep(stage === "quick" ? 1 : 3);
    } finally { if (sequence === analysisSequenceRef.current) analysisBusyRef.current = false; }
  };

  const confirmRegionAndAnalyze = () => {
    if (!temporaryImageDataUrl || isUploadingImage || regionDetectionState === 'uploading' || regionDetectionState === 'detecting') return;
    setErrorMessage('');
    void handleAnalyze('quick', fullImageSelected ? null : queryRegion);
  };

  const goToStep2 = () => {
    if(selectedImage && !analysisResult?.requiredMeasurements){confirmRegionAndAnalyze();return;}
    setErrorMessage("");
    setCurrentStep(2);
  };

  // Region edits in the results view intentionally re-run the search; edits in the
  // review step only update the crop and wait for the explicit confirmation button.
  const searchRegion=(region:ImageRegion|undefined)=>{
    setQueryRegion(region);
    setFullImageSelected(!region);
    if(regionTimerRef.current)clearTimeout(regionTimerRef.current);
    regionTimerRef.current=setTimeout(()=>{void handleAnalyze("quick",region || null);},300);
  };

  const retakeCameraPhoto = () => {
    imagePreparationSequenceRef.current++;
    regionDetectionSequenceRef.current++;
    imageUploadSequenceRef.current++;
    setIsUploadingImage(false);
    if (selectedImage?.startsWith("blob:")) URL.revokeObjectURL(selectedImage);
    setSelectedImage(null);
    setLocalImageId(null);
    setTemporaryImageDataUrl(null);
    setImageEventId(null);
    setRegionDetectionId(null);
    setQueryRegion(undefined);
    setCandidateRegions([]);
    setCameraReview(false);
    setErrorMessage("");
    void startCamera();
  };

  const confirmCameraPhoto = async () => {
    if (!selectedImage) {
      setErrorMessage("ابتدا عکس قطعه را ثبت کنید.");
      return;
    }
    // Camera review is followed by the same crop-detection and customer-confirmation flow as gallery uploads.
    setCameraReview(false);
    setCameraFlowActive(false);
    setRegionDetectionState('uploading');
    void uploadAndPrepareImage(selectedImage);
  };

  // Resolve a match image that may be a bare catalog filename (e.g. "e(001).png")
  const resolveMatchImage = (match: any, catalogItem: any): string => {
    const raw: string =
      (catalogItem?.images && catalogItem.images[0]) ||
      catalogItem?.image ||
      match?.image ||
      "";
    if (raw && /^e\(\d+\)\.png$/i.test(raw.trim())) {
      return getProductImageUrl(raw.trim());
    }
    return raw;
  };

  // Calculate inquiry price for user
  const getItemPrice = (
    _catalogItem?: any,
  ): ReturnType<typeof pricingCreditService.calculateInquiryPrice> => null;

  return (
    <Modal
      dialogLabel="شناسایی تصویری قطعه"
      fullScreen={fullScreen || initialCamera || cameraFlowActive || currentStep === "analyzing"}
      closeLabel={fullScreen || cameraFlowActive ? (initialCamera ? "بازگشت به سایت" : "بازگشت به میزکار") : "بستن"}
      isOpen={isOpen}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title={
        currentStep === 1 || currentStep === "analyzing"
          ? undefined
          : "شناسایی هوشمند قطعه و تسمه با هوش مصنوعی"
      }
      maxWidth={
        currentStep === 1
          ? "2xl"
          : currentStep === "analyzing" || currentStep === "results"
            ? "xl"
            : "lg"
      }
      noPadding={currentStep === 1 || currentStep === "analyzing"}
    >
      <div className="sanat-visual-search-shell" dir="rtl">
      {cameraFlowActive ? (
        <section className="sanat-camera-experience sanat-camera-reference" dir="rtl"
          data-testid="full-screen-camera-experience" aria-label="دوربین تمام صفحه شناسایی قطعه">
          <header className="sanat-camera-experience__header">
            <button
              type="button"
              onClick={() => void toggleTorch()}
              disabled={cameraReview || !canUseTorch}
              aria-label={torchEnabled ? "خاموش کردن فلش دوربین" : "روشن کردن فلش دوربین"}
              aria-pressed={torchEnabled}
              title={canUseTorch ? "فلش دوربین" : "فلش در این دستگاه در دسترس نیست"}
              className={`sanat-camera-experience__torch ${torchEnabled ? "is-on" : ""}`}
            >
              <Zap size={21} aria-hidden="true" />
            </button>
            <div className="sanat-camera-experience__heading">
              <h1>{cameraReview ? "بازبینی عکس قطعه" : "شناسایی قطعه با دوربین"}</h1>
            </div>
            <div className="sanat-camera-experience__header-actions">
              <button type="button" className="sanat-camera-experience__info"
                onClick={() => setShowCameraHelp(value => !value)}
                aria-expanded={showCameraHelp}
                aria-label="راهنمای تصویربرداری از قطعه">
                <Info size={20} aria-hidden="true" />
              </button>
              <button type="button" className="sanat-camera-experience__close"
                onClick={() => { stopCamera(); onClose(); }} aria-label="بستن دوربین">
                <X size={19} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className={`sanat-camera-experience__stage ${cameraReview ? "is-review" : ""}`}>
            {cameraReview && selectedImage ? (
              <img src={selectedImage} alt="پیش‌نمایش عکس ثبت‌شده از قطعه"
                className="sanat-camera-experience__preview"/>
            ) : (
              <video
                ref={(node) => {
                  videoRef.current = node;
                  if (node && cameraStreamRef.current && node.srcObject !== cameraStreamRef.current) {
                    node.srcObject = cameraStreamRef.current;
                    void node.play().catch(() => undefined);
                  }
                }}
                onLoadedMetadata={() => setIsCameraReady(true)}
                aria-label="تصویر زنده دوربین برای اسکن قطعه"
                className={`sanat-camera-experience__video ${cameraFacing === "user" ? "is-selfie" : ""}`}
                autoPlay playsInline muted
              />
            )}
            <span className="sanat-camera-experience__stage-shade" aria-hidden="true"/>
            <div className="sanat-camera-experience__instruction">
              <Target size={17} aria-hidden="true"/>
              <span>{cameraReview ? "عکس ثبت شد؛ تصویر را تأیید کنید" : "قطعه مورد نظر را در قاب قرار دهید"}</span>
            </div>
            <span className="sanat-camera-experience__frame" aria-hidden="true"/>
            {!cameraReview && isCameraReady && <span className="sanat-camera-experience__scan-line" aria-hidden="true"/>}
            <span className="sanat-camera-experience__live-tag" role="status" aria-live="polite">
              {cameraReview ? "پیش‌نمایش تصویر" : isCameraReady ? "دوربین فعال" : "در حال آماده‌سازی دوربین…"}
            </span>
            {!cameraReview && !isCameraReady && !errorMessage && (
              <span className="sanat-camera-experience__loading">در حال اتصال به دوربین دستگاه</span>
            )}
            {showCameraHelp && (
              <aside className="sanat-camera-experience__help" aria-label="راهنمای ثبت عکس">
                قطعه را کامل داخل چهار گوشه نارنجی قرار دهید. نور کافی، نوشته‌های خوانا و تصویر واضح باعث شناسایی دقیق‌تر می‌شود.
              </aside>
            )}
            <canvas ref={canvasRef} className="hidden" aria-hidden="true"/>
          </div>

          <footer className="sanat-camera-experience__footer">
            {errorMessage && <div className="sanat-camera-experience__error" role="alert">{errorMessage}</div>}
            <input
              ref={cameraGalleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="انتخاب عکس قطعه از گالری"
              onChange={event => {
                const selected = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (selected) selectCameraGalleryImage(selected);
              }}
            />
            {cameraReview ? (
              <div className="sanat-camera-experience__actions">
                <button type="button" onClick={confirmCameraPhoto} className="sanat-camera-experience__confirm">
                  <CheckCircle2 size={19} />
                  <span>تأیید و جستجوی قطعه</span>
                </button>
                <button type="button" onClick={retakeCameraPhoto} className="sanat-camera-experience__retake">
                  <RefreshCw size={18} />
                  <span>عکس‌برداری مجدد</span>
                </button>
              </div>
            ) : errorMessage && !isCameraReady ? (
              <div className="sanat-camera-experience__actions">
                <button type="button" onClick={() => void startCamera()} className="sanat-camera-experience__confirm">
                  <RefreshCw size={18} /> تلاش دوباره برای دوربین
                </button>
                <button type="button" onClick={() => cameraGalleryRef.current?.click()} className="sanat-camera-experience__retake">
                  <GalleryImage size={18}/> انتخاب از گالری
                </button>
              </div>
            ) : (
              <div className="sanat-camera-experience__live-actions">
                <button type="button" className="sanat-camera-experience__side-action"
                  onClick={() => cameraGalleryRef.current?.click()}
                  aria-label="انتخاب عکس از گالری">
                  <GalleryImage size={26} aria-hidden="true" />
                </button>
                <button type="button" onClick={capturePhoto} disabled={!isCameraReady}
                  className="sanat-camera-experience__capture" aria-label="ثبت عکس قطعه">
                  <span className="sanat-camera-experience__shutter" aria-hidden="true" />
                  <span className="sr-only">ثبت عکس قطعه</span>
                </button>
                <button type="button" onClick={switchCamera} disabled={!isCameraReady}
                  className="sanat-camera-experience__side-action" aria-label="تعویض دوربین جلو و پشت">
                  <SwitchCamera size={27} aria-hidden="true" />
                </button>
              </div>
            )}
            <p className="sanat-camera-experience__footnote">
              {cameraReview ? "در صورت واضح بودن عکس، تأیید کنید؛ یا دوباره عکس بگیرید." : "قاب نارنجی را روی تمام قطعه قرار دهید."}
            </p>
          </footer>
        </section>
      ) : currentStep === 1 ? (
        <div style={fullScreen ? { minHeight: "100dvh" } : undefined} dir="rtl" data-testid="identification-wizard" className="sp-vision-entry sanat-visual-search-wizard grid grid-cols-1 lg:grid-cols-12 min-h-[580px] lg:min-h-[630px] rounded-2xl md:rounded-3xl overflow-hidden bg-white text-right font-['Vazirmatn'] relative">
          {/* Absolute Close Button for Step 1 */}
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className={`absolute top-4 left-4 z-30 ${fullScreen ? "px-3 h-9 gap-2 rounded-xl" : "w-8 h-8 rounded-full"} bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shadow-xs`}
            aria-label={fullScreen ? "بازگشت به میزکار" : "بستن"}
          >
            {fullScreen ? <><ArrowRight className="w-4 h-4" /><span className="text-xs font-bold">بازگشت به میزکار</span></> : <X className="w-5 h-5" />}
          </button>

          {/* BANNER / HERO PANEL (Desktop = Left in RTL, Mobile = Top) */}
          <div data-testid="identification-image-panel" className="sanat-visual-search-hero lg:col-span-5 lg:col-start-8 lg:row-start-1 order-first lg:order-last bg-[#0B0F19] text-white p-4 pt-14 lg:p-8 relative flex flex-col justify-between overflow-hidden shadow-2xl">
            {/* Industrial Background Texture */}
            <div
              className="absolute inset-0 z-0 opacity-25 bg-cover bg-center pointer-events-none filter contrast-125"
              style={{
                backgroundImage: `url(${IMAGES.authIndustrialHero || IMAGES.refineryDuskWide})`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0B0F19]/85 via-[#0B0F19]/90 to-[#0B0F19] z-0" />

            {/* Content Container */}
            <div className="sanat-visual-search-hero__content relative z-10 grid grid-cols-3 items-center gap-3 lg:flex lg:flex-col lg:items-stretch lg:justify-between h-full lg:space-y-4">
              <div className="sanat-visual-search-hero__copy col-span-2 col-start-2 row-start-1">
                {/* Header Tag */}
                <div className="flex items-center gap-2 text-[#E06518] text-[11px] lg:text-xs font-mono font-extrabold tracking-widest uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-[#E06518]" />
                  <span>AI PART SEARCH</span>
                </div>

                {/* Main Title & Subtitle */}
                <div className="mt-3 space-y-2">
                  <h3 className="text-base lg:text-2xl font-black text-white leading-tight">
                    با <span className="text-[#E06518]">هوش مصنوعی</span> قطعه
                    را پیدا کنید
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    با یک عکس، مشخصات قطعه را شناسایی کرده و سریع‌تر به محصول
                    مورد نظر خود دسترسی پیدا کنید.
                  </p>
                </div>
              </div>

              {/* Central Targeted Bearing / Industrial Part Image */}
              <div className="sanat-visual-search-hero__image col-start-1 row-start-1 lg:my-5 relative flex items-center justify-center">
                <div className="relative p-2 lg:p-4 rounded-2xl bg-gradient-to-b from-slate-800/70 to-slate-900/90 border border-slate-700/80 shadow-2xl group max-w-[220px]">
                  {/* Futuristic Glowing Orange Framing Brackets */}
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-[#E06518] rounded-tr-lg shadow-[0_0_8px_#E06518]" />
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-[#E06518] rounded-tl-lg shadow-[0_0_8px_#E06518]" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-[#E06518] rounded-br-lg shadow-[0_0_8px_#E06518]" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-[#E06518] rounded-bl-lg shadow-[0_0_8px_#E06518]" />

                  <img
                    src={IMAGES.products.bearingNsk || IMAGES.products.bearing}
                    alt="AI Part Search"
                    className="w-16 h-20 sm:w-24 sm:h-24 lg:w-44 lg:h-44 object-contain filter drop-shadow-[0_12px_24px_rgba(224,101,24,0.4)] transform group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>

              {/* Feature Badges - Desktop (Vertical) vs Mobile (3 Horizontal) */}
              <div className="hidden lg:flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-[#E06518]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      شناسایی دقیق قطعه
                    </div>
                    <div className="text-[10px] text-slate-400">
                      با هوش مصنوعی پیشرفته
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-[#E06518]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      جستجوی سریع
                    </div>
                    <div className="text-[10px] text-slate-400">
                      در میان هزاران محصول
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <Cpu className="w-4 h-4 text-[#E06518]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      نتایج معتبر
                    </div>
                    <div className="text-[10px] text-slate-400">
                      بر اساس کاتالوگ واقعی و قیمت‌گذاری
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Horizontal Feature Row */}
              <div className="hidden grid-cols-3 gap-2 py-2 border-t border-b border-slate-800 text-center">
                <div className="flex flex-col items-center">
                  <Zap className="w-4 h-4 text-[#E06518] mb-1" />
                  <span className="text-[11px] font-bold text-white">
                    شناسایی دقیق
                  </span>
                  <span className="text-[9px] text-slate-400">
                    با هوش مصنوعی
                  </span>
                </div>
                <div className="flex flex-col items-center border-r border-l border-slate-800 px-1">
                  <ShieldCheck className="w-4 h-4 text-[#E06518] mb-1" />
                  <span className="text-[11px] font-bold text-white">
                    جستجوی سریع
                  </span>
                  <span className="text-[9px] text-slate-400">در کاتالوگ</span>
                </div>
                <div className="flex flex-col items-center">
                  <Cpu className="w-4 h-4 text-[#E06518] mb-1" />
                  <span className="text-[11px] font-bold text-white">
                    نتایج معتبر
                  </span>
                  <span className="text-[9px] text-slate-400">
                    قیمت‌گذاری دقیق
                  </span>
                </div>
              </div>

              {/* Bottom Branding Tag */}
              <div className="hidden lg:flex items-center gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E06518] animate-pulse shadow-[0_0_8px_#E06518]" />
                <span>
                  Powered by{" "}
                  <strong className="text-white font-bold">FORZA AI</strong>
                </span>
              </div>
            </div>
          </div>

          {/* FORM / UPLOAD PANEL (Desktop = Right in RTL, Mobile = Bottom) */}
          <div className="sanat-visual-search-form lg:col-span-7 lg:col-start-1 lg:row-start-1 order-last lg:order-first bg-[#FAFBFD] p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
            {/* STEPPER HEADER */}
            <div className="sanat-visual-stepper pt-2 pb-4 border-b border-slate-200/80">
              <div className="flex items-center justify-between max-w-sm mx-auto relative">
                {/* Step 1 Item */}
                <div className="flex flex-col items-center gap-1.5 relative z-10">
                  <div className="w-9 h-9 rounded-full bg-[#E06518] text-white font-black text-sm flex items-center justify-center shadow-md shadow-orange-500/20 ring-4 ring-orange-100">
                    ۱
                  </div>
                  <span className="text-xs font-bold text-[#E06518]">
                    تصویر قطعه
                  </span>
                </div>

                <div className="flex-1 h-0.5 bg-slate-200 mx-2 -mt-5" />

                {/* Step 2 Item */}
                <div className="flex flex-col items-center gap-1.5 relative z-10 opacity-60">
                  <div className="w-9 h-9 rounded-full bg-white border border-slate-300 text-slate-500 font-bold text-sm flex items-center justify-center shadow-2xs">
                    ۲
                  </div>
                  <span className="text-xs font-medium text-slate-600">
                    پردازش تصویر
                  </span>
                </div>

                <div className="flex-1 h-0.5 bg-slate-200 mx-2 -mt-5" />

                {/* Step 3 Item */}
                <div className="flex flex-col items-center gap-1.5 relative z-10 opacity-60">
                  <div className="w-9 h-9 rounded-full bg-white border border-slate-300 text-slate-500 font-bold text-sm flex items-center justify-center shadow-2xs">
                    ۳
                  </div>
                  <span className="text-xs font-medium text-slate-600">
                    تحلیل و نتایج
                  </span>
                </div>
              </div>
            </div>

            {/* STEP CONTENT BODY */}
            <div className="my-4 space-y-4">
              <div className="sanat-visual-search-heading text-right space-y-1">
                <h3 className="text-xl lg:text-2xl font-black text-[#2B313A]">
                  {isUsingCamera ? "قطعه را در کادر دوربین قرار دهید" : "قطعه صنعتی خود را شناسایی کنید"}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  عکس واضح بگیرید یا تصویر انتخاب کنید؛ کدها و شکل ظاهری قطعه در کادر مشخص باشند.
                </p>
              </div>

              {!selectedImage && !isUsingCamera && (
                <div className="sanat-scan-intro" role="note">
                  <div className="sanat-scan-intro__copy">
                    <span className="sanat-scan-intro__eyebrow">FORZA VISION / صنعت پیش</span>
                    <strong>از روی ظاهر قطعه جستجو کنید</strong>
                    <span>عکس واقعی · مشخصات واقعی · نتیجه از کاتالوگ</span>
                  </div>
                </div>
              )}
              {/* Error notification banner */}
              {errorMessage && !selectedImage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
              )}

              <input
                ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="sr-only" tabIndex={-1} aria-label="انتخاب تصویر قطعه"
                onChange={(event) => {
                  const image = event.currentTarget.files?.[0];
                  if (image) handleFile(image);
                  event.currentTarget.value = "";
                }}
              />
              {/* Upload Dropzone OR Camera OR Selected Image */}
              {!selectedImage && !isUsingCamera ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`sanat-visual-upload-dropzone border-2 border-dashed rounded-2xl p-6 lg:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragOver
                      ? "border-[#E06518] bg-orange-50/70 scale-[1.01]"
                      : "border-[#CBD8E6] bg-[#F4F7FC] hover:bg-slate-100/80 hover:border-slate-300"
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-200/80 flex items-center justify-center text-[#E06518] mb-3 group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-7 h-7 text-[#E06518]" />
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-[#2B313A]">
                    عکس قطعه را اینجا رها کنید یا برای انتخاب کلیک کنید
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 font-mono">
                    حداکثر حجم ۱۲ مگابایت | JPG • PNG • WEBP
                  </span>
                </div>
              ) : isUsingCamera ? (
                <div className="sanat-scan-viewfinder relative rounded-2xl overflow-hidden bg-[#12203C] border border-slate-800 shadow-md my-2">
                  <div className="sanat-scan-viewfinder__video relative aspect-video w-full flex items-center justify-center bg-[#12203C]">
                    <video
                      ref={(node) => {
                        videoRef.current = node;
                        if (node && cameraStreamRef.current && node.srcObject !== cameraStreamRef.current) {
                          node.srcObject = cameraStreamRef.current;
                          void node.play().catch(() => undefined);
                        }
                      }}
                      onLoadedMetadata={() => setIsCameraReady(true)}
                      aria-label="پیش‌نمایش زنده دوربین برای عکاسی از قطعه"
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <span className="sanat-scan-viewfinder__corners" aria-hidden="true" />
                    <span className="sanat-scan-viewfinder__hint" role="status" aria-live="polite">{isCameraReady ? "دوربین فعال · قطعه را در کادر قرار دهید" : "در حال آماده‌سازی تصویر دوربین…"}</span>
                  </div>
                  <div className="sanat-scan-viewfinder__actions absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 px-4">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={!isCameraReady}
                      className="min-h-12 px-5 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>ثبت عکس قطعه</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="min-h-12 px-4 bg-white/90 hover:bg-white text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-all"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              ) : (
                <ImageRegionReview
                  image={selectedImage || ''}
                  status={regionDetectionState}
                  selectedRegion={queryRegion}
                  candidateRegions={candidateRegions}
                  message={[regionDetectionMessage, localImageId ? 'تصویر اصلی فقط در حافظه خصوصی همین مرورگر نگهداری می‌شود.' : ''].filter(Boolean).join(' ')}
                  analysisError={errorMessage}
                  busy={isUploadingImage || !temporaryImageDataUrl}
                  onRegionChange={handleRegionSelection}
                  onConfirm={confirmRegionAndAnalyze}
                  onRetryPreparation={retryRegionPreparation}
                  onRetryAnalysis={() => { setErrorMessage(''); void handleAnalyze('quick', fullImageSelected ? null : queryRegion); }}
                  onChangeImage={() => fileInputRef.current?.click()}
                />
              )}
              {!selectedImage && !isUsingCamera && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedImage) {
                      handleAnalyze("quick");
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  disabled={isUploadingImage}
                  className="h-12 bg-[#E06518] hover:bg-[#C95210] active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-orange-500/20 hover:shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {selectedImage ? "شروع شناسایی هوشمند" : "انتخاب تصویر"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="h-12 bg-white hover:bg-slate-50 active:scale-[0.98] text-[#2B313A] border border-slate-200 hover:border-slate-300 rounded-2xl text-xs sm:text-sm font-bold shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>استفاده از دوربین</span>
                </button>
              </div>
              )}

              {/* 3 FEATURE HIGHLIGHT BADGES */}
              {!selectedImage && !isUsingCamera && (
              <div className="grid grid-cols-3 gap-2 py-3 px-3 bg-slate-100/70 rounded-2xl border border-slate-200/60 text-center">
                <div className="flex flex-col items-center justify-center">
                  <Cpu className="w-4 h-4 text-[#E06518] mb-1" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">
                    تشخیص خودکار با AI
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center border-r border-l border-slate-200/80 px-1">
                  <Search className="w-4 h-4 text-[#E06518] mb-1" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">
                    جستجو در کاتالوگ
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <Target className="w-4 h-4 text-[#E06518] mb-1" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">
                    نمایش نتایج دقیق
                  </span>
                </div>
              </div>
              )}
            </div>

            {/* BOTTOM SAMPLE THUMBNAILS SECTION */}
            {!selectedImage && !isUsingCamera && (
            <div className="pt-3 border-t border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>نمونه تصاویر قابل قبول</span>
              </div>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {INDUSTRIAL_PRESET_SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => loadPreset(sample)}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white hover:bg-orange-50/70 border border-slate-200 hover:border-[#E06518] p-1.5 flex items-center justify-center transition-all cursor-pointer shrink-0 group shadow-2xs"
                    title={sample.title}
                  >
                    <img
                      src={sample.imageUrl}
                      alt={sample.title}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => loadPreset(INDUSTRIAL_PRESET_SAMPLES[0])}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      ) : (
        <div className={currentStep === "analyzing" ? "sp-vision-analysis-container" : "p-5 sm:p-6 text-right space-y-5"}>
          {/* TOP STEPPER (Only visible during steps 2 & 3) */}
          {typeof currentStep === "number" && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
              <div className="flex items-center justify-between max-w-md mx-auto relative">
                {/* Stepper connecting line */}
                <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0.5 bg-slate-200 z-0" />
                <div
                  className="absolute top-1/2 right-6 -translate-y-1/2 h-0.5 bg-[#E06518] transition-all duration-300 z-0"
                  style={{
                    width: currentStep === 2 ? "50%" : "100%",
                  }}
                />

                {/* Step 1 Item */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`relative z-10 flex flex-col items-center gap-1.5 cursor-pointer group transition-all`}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all bg-emerald-500 text-white">
                    <Check className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600">
                    تصویر قطعه
                  </span>
                </button>

                {/* Step 2 Item */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`relative z-10 flex flex-col items-center gap-1.5 cursor-pointer group transition-all`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      currentStep === 2
                        ? "bg-[#E06518] text-white ring-4 ring-orange-100 shadow-sm"
                        : currentStep > 2
                          ? "bg-emerald-500 text-white"
                          : "bg-white text-slate-400 border border-slate-300"
                    }`}
                  >
                    {currentStep > 2 ? <Check className="w-4 h-4" /> : "۲"}
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      currentStep === 2 ? "text-[#E06518]" : "text-slate-600"
                    }`}
                  >
                    طول و عرض
                  </span>
                </button>

                {/* Step 3 Item */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedImage || length || width) {
                      setCurrentStep(3);
                    }
                  }}
                  className={`relative z-10 flex flex-col items-center gap-1.5 cursor-pointer group transition-all`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      currentStep === 3
                        ? "bg-[#E06518] text-white ring-4 ring-orange-100 shadow-sm"
                        : "bg-white text-slate-400 border border-slate-300"
                    }`}
                  >
                    ۳
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      currentStep === 3 ? "text-[#E06518]" : "text-slate-600"
                    }`}
                  >
                    کاربرد و ویژگی‌ها
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Error notification banner */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* MAIN STEP CONTENT AREA WITH MOTION ANIMATION */}
          <AnimatePresence mode="wait">
            {/* STEP 2: DIMENSIONS (LENGTH & WIDTH)                          */}
            {/* ============================================================ */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Header Title */}
                <div className="text-center space-y-1">
                  <h4 className="text-base font-black text-[#55565A] flex items-center justify-center gap-2">
                    <Ruler className="w-5 h-5 text-[#E06518]" />
                    <span>مرحله دوم: مشخصات لازم برای تطبیق کد</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    ابعاد فیزیکی قطعه را برحسب میلی‌متر وارد نمایید تا انطباق
                    دقیق در کاتالوگ انجام گیرد.
                  </p>
                </div>

                {/* Context bar showing if image was selected */}
                {selectedImage && (
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={selectedImage}
                        alt="قطعه"
                        className="w-10 h-10 object-cover rounded-lg border border-emerald-200 bg-[#12203C]"
                      />
                      <div>
                        <span className="text-xs font-bold text-emerald-900 block">
                          تصویر قطعه دریافت شد
                        </span>
                        <span className="text-[10px] text-emerald-700">
                          اکنون ابعاد قطعه را وارد نمایید
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                    >
                      تغییر عکس
                    </button>
                  </div>
                )}

                {analysisResult?.requiredMeasurements ? <>
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 space-y-2" role="status">
                    <h5 className="font-bold text-sm text-slate-800">تحلیل قطعه</h5>
                    <p className="text-sm leading-7 text-slate-700">{analysisResult.summary.visualAnalysis}</p>
                    <p className="text-xs leading-6 text-slate-500">مشخصات زیر برای این نوع قطعه لازم‌اند. هر مورد را اندازه بگیرید یا «مشخص نیست» را انتخاب کنید؛ با مقدار نامعلوم فقط مشابه‌ها نمایش داده می‌شوند.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {analysisResult.requiredMeasurements.map(field=><div key={field.id} className="rounded-2xl border border-slate-200 p-4 space-y-2 bg-slate-50/70">
                      <label htmlFor={`part-${field.id}`} className="text-sm font-bold text-slate-700">{field.label}{field.unit ? ` (${field.unit})` : ''}</label>
                      <input id={`part-${field.id}`} type={field.kind==='number' ? 'number' : 'text'} min={field.kind==='number' ? '0' : undefined} step="any" dir="auto" disabled={measurements[field.id]==='unknown'} value={measurements[field.id]==='unknown' ? '' : measurements[field.id] || ''} onChange={event=>setMeasurements(previous=>({...previous,[field.id]:event.target.value}))} className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm disabled:bg-slate-100 focus:border-orange-500 outline-none" />
                      <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={measurements[field.id]==='unknown'} onChange={event=>setMeasurements(previous=>({...previous,[field.id]:event.target.checked ? 'unknown' : ''}))} />مشخص نیست / کاربرد ندارد</label>
                      <p className="text-xs leading-5 text-slate-500">{field.hint}</p>
                    </div>)}
                  </div>
                </> : <>
                {/* Dimensions Input Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Length Input */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="block text-xs font-bold text-[#55565A]">
                      طول قطعه یا تسمه (میلی‌متر){" "}
                      <span className="text-[#E06518]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        dir="ltr"
                        value={length}
                        onChange={(e) => setLength(e.target.value)}
                        placeholder="مثلاً 1760"
                        className="w-full h-11 px-3 border border-slate-300 rounded-xl text-sm font-mono text-left focus:border-[#E06518] focus:bg-white focus:outline-none bg-white shadow-2xs"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">
                        mm
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      محیط دور بیرونی، طول گام دندانه یا طول کلی رولیک/نوار
                    </p>
                  </div>

                  {/* Width Input */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="block text-xs font-bold text-[#55565A]">
                      عرض مقطع (میلی‌متر){" "}
                      <span className="text-[#E06518]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        dir="ltr"
                        value={width}
                        onChange={(e) => setWidth(e.target.value)}
                        placeholder="مثلاً 50 یا 13"
                        className="w-full h-11 px-3 border border-slate-300 rounded-xl text-sm font-mono text-left focus:border-[#E06518] focus:bg-white focus:outline-none bg-white shadow-2xs"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">
                        mm
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      پهنای پشت تسمه، قطر لوله رولیک یا ضخامت نوار
                    </p>
                  </div>
                </div>

                {/* Optional Pitch / Tooth Profile */}
                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#55565A]">
                      فاصله گام دندانه‌ها یا ضخامت (اختیاری)
                    </label>
                    <span className="text-[10px] text-slate-400">اختیاری</span>
                  </div>
                  <div className="relative max-w-sm">
                    <input
                      type="number"
                      dir="ltr"
                      value={pitch}
                      onChange={(e) => setPitch(e.target.value)}
                      placeholder="مثلاً 8 برای گام 8M یا 10 برای T10"
                      className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs font-mono text-left focus:border-[#E06518] focus:bg-white focus:outline-none bg-white shadow-2xs"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">
                      mm
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    فاصله نوک یک دندانه تا نوک دندانه بعدی بر حسب میلی‌متر (در
                    صورت نامشخص بودن خالی بگذارید).
                  </p>
                </div>

                </>}
                {/* Step 2 Actions (Back & Next) */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>بازگشت به مرحله تصویر</span>
                  </button>

                  <button
                    type="button"
                    onClick={goToStep3}
                    className="h-11 px-6 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>مرحله بعد: کاربرد و ویژگی‌ها</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ============================================================ */}
            {/* STEP 3: APPLICATION & FEATURES (FINAL STEP BEFORE AI)        */}
            {/* ============================================================ */}
            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Header Title */}
                <div className="text-center space-y-1">
                  <h4 className="text-base font-black text-[#55565A] flex items-center justify-center gap-2">
                    <Sliders className="w-5 h-5 text-[#E06518]" />
                    <span>
                      مرحله سوم: برای چه کاری می‌خواهید؟ و ویژگی‌های محصول
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    نوع دستگاه و شرایط کاری را مشخص فرمایید تا بهترین قطعه
                    سازگار انتخاب شود.
                  </p>
                </div>

                {/* Compact Review of Steps 1 & 2 */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    {selectedImage ? (
                      <img
                        src={selectedImage}
                        alt="قطعه"
                        className="w-9 h-9 object-cover rounded-lg border border-slate-300 bg-[#12203C]"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">
                        <Camera className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-[#55565A] block">
                        {selectedImage ? "تصویر دارد" : "بدون تصویر"}
                      </span>
                      <span className="text-slate-500 text-[11px] font-mono">
                        طول: {length ? `${length}mm` : "نامشخص"} | عرض:{" "}
                        {width ? `${width}mm` : "نامشخص"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-xs text-[#E06518] font-bold hover:underline cursor-pointer"
                  >
                    ویرایش ابعاد
                  </button>
                </div>

                {/* 1. Application / Purpose */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#55565A] flex items-center justify-between">
                    <span>
                      برای چه کاری می‌خواهید؟ (دستگاه یا صنعت مورد نظر)
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      توصیه شده
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={application}
                    onChange={(e) => setApplication(e.target.value)}
                    placeholder="مثال: برای کوره رولری پخت سوم کاشی، فن مکنده صنعتی، خط انتقال بسته‌بندی، نساجی، سنگبری..."
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:border-[#E06518] focus:bg-white focus:outline-none bg-slate-50/50 resize-none transition-colors"
                  />

                  {/* Quick Application Suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold ml-1">
                      پیشنهاد سریع:
                    </span>
                    {APPLICATION_SUGGESTIONS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setApplication(item)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          application === item
                            ? "bg-orange-50 border-[#E06518] text-[#E06518] font-bold"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Features / Environmental requirements */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#55565A] flex items-center justify-between">
                    <span>ویژگی خاص یا الزامات فنی قطعه</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      اختیاری
                    </span>
                  </label>
                  <input
                    type="text"
                    value={features}
                    onChange={(e) => setFeatures(e.target.value)}
                    placeholder="مثال: مقاومت به حرارت ۱۲۰۰ درجه، ضدروغن و گریس، روکش ضدسایش دندانه، کورد استیل..."
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs focus:border-[#E06518] focus:bg-white focus:outline-none bg-slate-50/50 transition-colors"
                  />

                  {/* Quick Feature Suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold ml-1">
                      ویژگی‌های پرکاربرد:
                    </span>
                    {FEATURE_SUGGESTIONS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (features.includes(item)) return;
                          setFeatures(features ? `${features}، ${item}` : item);
                        }}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-[#E06518] hover:text-[#E06518] transition-all cursor-pointer"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 3 Actions: Back to Step 2 & Trigger AI Analysis */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>بازگشت به مرحله ابعاد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAnalyze("refined")}
                    disabled={isUploadingImage}
                    className="h-11 px-7 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isUploadingImage ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>
                      {isUploadingImage
                        ? "در حال بارگذاری تصویر…"
                        : lastStage === "quick"
                          ? "تحلیل دقیق نهایی با ابعاد"
                          : "تحلیل هوش مصنوعی و یافتن کالا"}
                    </span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ============================================================ */}
            {/* STEP: ANALYZING STATE (Bright, Delightful Studio Scanner)    */}
            {/* ============================================================ */}
            {currentStep === "analyzing" && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="sp-vision-progress-screen"
                data-testid="vision-analyzing-screen"
              >
                <VisionAnalysisProgress
                  image={selectedImage}
                  region={queryRegion}
                  progress={analysisProgress}
                  phaseIndex={analysisPhaseIndex}
                  phases={ANALYSIS_PHASES}
                  counts={scanCounts}
                  quickMode={pendingStage === "quick"}
                  onClose={() => { stopCamera(); onClose(); }}
                />
              </motion.div>
            )}

            {/* ============================================================ */}
            {/* STEP: RESULTS VIEW                                           */}
            {/* ============================================================ */}
            {currentStep === "results" && analysisResult && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {localRegionEnabled && selectedImage && <ImageRegionSelector
                  src={selectedImage}
                  value={queryRegion}
                  candidateRegions={candidateRegions}
                  onChange={searchRegion}
                  onFullImageSearch={() => { setQueryRegion(undefined); setFullImageSelected(true); void handleAnalyze('quick', null); }}
                />}
                {/* Fallback / AI-error notices */}
                {!analysisResult.isAiGenerated &&
                  analysisResult.fallbackNotice && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold block">
                          حالت تطبیق مهندسی (بدون هوش مصنوعی)
                        </span>
                        <span className="leading-relaxed block">
                          {analysisResult.fallbackNotice}
                        </span>
                        {analysisResult.aiError && (
                          <span
                            className="block text-[10px] text-amber-700 font-mono"
                            dir="ltr"
                          >
                            Detail: {analysisResult.aiError.slice(0, 220)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                {analysisResult.catalogSearchWarning && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span className="leading-relaxed">
                      {analysisResult.catalogSearchWarning}
                    </span>
                  </div>
                )}

                {/* Summary Bar */}
                <div className="bg-[#55565A] text-white p-4 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#E06518] text-white flex items-center justify-center font-bold text-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                          <span>
                            {analysisResult.isAiGenerated
                              ? "نتیجه تطبیق قطعه توسط هوش مصنوعی"
                              : "نتیجه تطبیق قطعه"}
                          </span>
                          {(analysisResult.stage || lastStage) === "quick" ? (
                            <span className="text-[10px] font-bold bg-teal-500/20 border border-teal-400/40 text-teal-300 px-2 py-0.5 rounded-lg">
                              تحلیل اولیه از روی تصویر
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-orange-500/20 border border-orange-400/40 text-orange-300 px-2 py-0.5 rounded-lg">
                              تحلیل دقیق با ابعاد و مشخصات
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          نوع قطعه: {analysisResult.summary.detectedPartType} |
                          مقطع: {analysisResult.summary.detectedProfile}
                          {analysisResult.summary.material
                            ? ` | جنس: ${analysisResult.summary.material}`
                            : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {analysisResult.retrieval?.mode === "local-embedding"
                            ? "جست‌وجوی محلی بر اساس شباهت تصویر"
                            : <>اطمینان تحلیل تصویری: {toPersianDigits(analysisResult.summary.confidence)}٪</>}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>جستجوی جدید</span>
                      </button>
                    </div>
                  </div>

                  {/* What the AI literally sees + detected part location on the user image */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {selectedImage && (
                      <div
                        className="relative w-full sm:w-40 h-32 rounded-xl overflow-hidden bg-[#12203C] border border-slate-700 shrink-0"
                        dir="ltr"
                      >
                        <img
                          src={selectedImage}
                          alt="تصویر کاربر"
                          className="w-full h-full object-contain"
                        />
                        {analysisResult.summary.boundingBox && (
                          <div
                            className="absolute border-2 border-emerald-400 rounded-md shadow-[0_0_0_2px_rgba(52,211,153,0.35)]"
                            style={{
                              left: `${analysisResult.summary.boundingBox.x_min / 10}%`,
                              top: `${analysisResult.summary.boundingBox.y_min / 10}%`,
                              width: `${(analysisResult.summary.boundingBox.x_max - analysisResult.summary.boundingBox.x_min) / 10}%`,
                              height: `${(analysisResult.summary.boundingBox.y_max - analysisResult.summary.boundingBox.y_min) / 10}%`,
                            }}
                          >
                            <span className="absolute -top-5 left-0 text-[9px] font-bold bg-emerald-400 text-slate-900 px-1.5 py-0.5 rounded whitespace-nowrap">
                              قطعه شناسایی‌شده
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 space-y-2 min-w-0">
                      <p className="text-sm text-slate-100 leading-7"><strong>تحلیل قطعه: </strong>{analysisResult.summary.visualAnalysis}</p>
                    </div>
                  </div>
                </div>

                {/* Refine CTA: visible after quick (image-only) analysis */}
                {(analysisResult.stage || lastStage) === "quick" && (
                  <div className="p-4 bg-gradient-to-l from-orange-50 to-amber-50 border border-orange-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#E06518] text-white flex items-center justify-center shrink-0">
                        <Ruler className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-sm text-[#55565A]">
                          می‌خوای دقیق‌تر پیدا کنی؟
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          طول، عرض، گام دندانه و کاربرد دستگاه را وارد کن تا
                          سرور بتواند محصولات واقعی کاتالوگ را دقیق‌تر رتبه‌بندی
                          کند.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="h-10 px-5 bg-[#55565A] hover:bg-[#1B293E] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>وارد کردن ابعاد و مشخصات</span>
                    </button>
                  </div>
                )}

                {/* Visual Verification & Catalog Availability Banner */}
                {analysisResult.summary.catalogAvailability && (
                  <div
                    className={`p-4 rounded-2xl border shadow-xs transition-all ${
                      analysisResult.summary.catalogAvailability.status ===
                      "confirmed_in_catalog"
                        ? "bg-gradient-to-l from-emerald-950 via-[#55565A] to-[#55565A] border-emerald-500/50 text-white"
                        : analysisResult.summary.catalogAvailability.status ===
                            "similar_in_catalog"
                          ? "bg-gradient-to-l from-blue-950 via-[#55565A] to-[#55565A] border-blue-500/50 text-white"
                          : "bg-gradient-to-l from-amber-950 via-slate-900 to-[#55565A] border-amber-500/50 text-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          analysisResult.summary.catalogAvailability.status ===
                          "confirmed_in_catalog"
                            ? "bg-emerald-500 text-white"
                            : analysisResult.summary.catalogAvailability
                                  .status === "similar_in_catalog"
                              ? "bg-blue-500 text-white"
                              : "bg-amber-500 text-slate-950"
                        }`}
                      >
                        {analysisResult.summary.catalogAvailability.status ===
                        "confirmed_in_catalog" ? (
                          <ShieldCheck className="w-6 h-6" />
                        ) : analysisResult.summary.catalogAvailability
                            .status === "similar_in_catalog" ? (
                          <Sparkles className="w-5 h-5" />
                        ) : (
                          <Wrench className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-white">
                            {
                              analysisResult.summary.catalogAvailability
                                .statusFarsiTitle
                            }
                          </span>
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                              analysisResult.summary.catalogAvailability
                                .status === "confirmed_in_catalog"
                                ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/40"
                                : analysisResult.summary.catalogAvailability
                                      .status === "similar_in_catalog"
                                  ? "bg-blue-400/20 text-blue-300 border border-blue-400/40"
                                  : "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                            }`}
                          >
                            {analysisResult.summary.catalogAvailability
                              .status === "confirmed_in_catalog"
                              ? "کد یا تصویر با یک رکورد کاتالوگ تطبیق دارد"
                              : analysisResult.summary.catalogAvailability
                                    .status === "similar_in_catalog"
                                ? "نامزدهای مرتبط؛ سازگاری فنی تأیید نشده"
                                : "نیاز به بررسی یا استعلام سفارشی"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          {
                            analysisResult.summary.catalogAvailability
                              .statusFarsiMessage
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!!analysisResult.summary.readableMarkings?.length && <p className="text-xs leading-6 text-slate-600">نوشته‌های خوانده‌شده: {analysisResult.summary.readableMarkings.join(" · ")}</p>}
                {!!analysisResult.summary.observedSpecifications?.length && <div className="grid grid-cols-2 gap-2">{analysisResult.summary.observedSpecifications.map((spec,i)=><div key={i} className="rounded-xl border border-slate-200 p-3 text-xs"><span className="text-slate-500">{spec.name}: </span><span dir="auto">{spec.value}</span><p className="text-slate-400 mt-1">خوانده‌شده از نوشتهٔ تصویر</p></div>)}</div>}
                {analysisResult.scanCoverage && (
                  <p role="status" className="text-xs text-slate-600 leading-6 border border-slate-200 rounded-xl p-3">
                    {toPersianDigits(analysisResult.scanCoverage.compared)} از {toPersianDigits(analysisResult.scanCoverage.total)} تصویر {analysisResult.retrieval?.mode === "local-embedding" ? "در نمایهٔ جست‌وجوی محلی مقایسه شد." : "با هوش مصنوعی بررسی شد."}
                    {analysisResult.retrieval?.mode==="local-embedding" ? " نتایج بر اساس شباهت تصویر هستند؛ مدل و سایز هنوز تأیید نشده است." : analysisResult.retrieval?.mode==="indexed" ? ` جست‌وجو در ${toPersianDigits(analysisResult.retrieval.indexed)} تصویر ایندکس‌شده؛ ${analysisResult.scanCoverage.complete ? "بازبینی گزینه‌های نزدیک کامل شد." : "بازبینی کامل نشده است."}` : analysisResult.scanCoverage.complete ? " بررسی تمام تصاویر کامل شد." : " بررسی کامل کاتالوگ انجام نشده است؛ نتیجه موقت است."}
                  </p>
                )}
                {analysisResult.modelSuggestions && <LocalModelResults key={analysisResult.customerImageUrl} items={analysisResult.modelSuggestions} onClose={onClose} />}
                {!!visiblePhotoMatches.length && (
                  <section className="space-y-3" aria-label="تصاویر مشابه در کاتالوگ">
                    <h4 className="font-bold text-sm text-slate-800">{analysisResult.modelSuggestions?.length?"تصاویر مشابه بدون کد متصل":"تصاویر مشابه پیدا‌شده در کاتالوگ"}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {visiblePhotoMatches.map(photo=>(
                        <article key={photo.imageId} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                          <img src={photo.image} alt={photo.label} className="w-full h-36 object-contain" loading="lazy" />
                          <p className="text-xs font-bold text-slate-700">{photo.label}</p>
                          <p className="text-xs text-orange-700">{photo.relation==="related" ? "هم‌خانواده؛ دارای تفاوت" : "شباهت بصری بیشتر"}</p>
                          {!!photo.familyNames?.length && <p className="text-xs text-slate-600">خانواده: {photo.familyNames.join("، ")}</p>}
                          <p className="text-xs leading-6 text-slate-500">{photo.reason}</p>
                          {photo.bindings.some(binding=>binding.code) && !photo.bindings.some(binding=>binding.verified) && <p className="text-xs text-slate-500">کدهای متصل به عکس؛ تعلق دقیق تصویر به این کدها هنوز تأیید نشده است.</p>}
                          {[...new Set(photo.bindings.flatMap(binding=>binding.code ? [binding.code] : []))].map(code=>(
                            <Link key={code} to={`/product/${encodeURIComponent(code)}`} onClick={onClose} className="inline-block border rounded-lg px-2 py-1 m-1 text-xs text-orange-700">مشخصات کد {code}</Link>
                          ))}
                          {[...new Set(photo.bindings.map(binding=>binding.familyCode))].map(familyCode=>(
                            <Link key={familyCode} to={`/product/${encodeURIComponent(familyCode)}`} onClick={onClose} className="inline-block border rounded-lg px-2 py-1 m-1 text-xs text-orange-700">مشاهده خانواده و سایزها</Link>
                          ))}
                          {!photo.bindings.some(binding=>binding.code) && <p className="text-xs text-slate-500">تصویر کاتالوگی مشابه؛ کد دقیق این عکس هنوز تأیید نشده است.</p>}
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                {/* Strong visual evidence banner */}
                {analysisResult.summary.exactVisualMatch &&
                  analysisResult.matchedProducts.some(
                    (item) => item.visualVerdict === "exact_match",
                  ) && (
                    <div className="p-4 bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl flex items-center gap-3.5 shadow-lg border border-emerald-400/40">
                      <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-black text-sm sm:text-base flex items-center gap-2">
                          <span>
                            کد منطبق بر اساس شواهد در کاتالوگ پیدا شد
                          </span>
                        </div>
                        <p className="text-xs text-emerald-50 leading-relaxed mt-0.5">
                          محصول دقیق کاتالوگ: «
                          {
                            analysisResult.matchedProducts.find(
                              (item) => item.visualVerdict === "exact_match",
                            )?.name
                          }
                          » (کد:{" "}
                          {
                            analysisResult.matchedProducts.find(
                              (item) => item.visualVerdict === "exact_match",
                            )?.code
                          }
                          ) — پیش از سفارش، ابعاد، جنس و شرایط کارکرد را کنترل کنید.
                        </p>
                      </div>
                    </div>
                  )}

                {/* All matched real catalog records returned by the server */}
                {(() => {
                  if(analysisResult.modelSuggestions?.length)return null;
                  const combinedList = [
                    ...(analysisResult.matchedProducts || []),
                    ...(analysisResult.similarCandidates || []),
                  ].filter(
                    (item, idx, self) =>
                      idx === self.findIndex((t) => t.code === item.code),
                  );

                  const exactMatches = combinedList.filter(
                    (item) =>
                      item.visualVerdict === "exact_match",
                  );

                  // Show all matched and closest similar products found in the catalog
                  const allDisplayProducts = combinedList;

                  if (allDisplayProducts.length > 0) {
                    return (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-slate-100 pb-2">
                          <h4 className="font-black text-sm text-[#55565A] flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#E06518]" />
                            <span>
                              {exactMatches.length > 0
                                ? `کالای منطبق و گزینه‌های مشابه در کاتالوگ (${toPersianDigits(allDisplayProducts.length)} محصول)`
                                : `محصولات با بیشترین تشابه شکل و شمایل به تصویر مشتری (${toPersianDigits(allDisplayProducts.length)} محصول)`}
                            </span>
                          </h4>
                          <span className="text-xs text-slate-500">
                            {exactMatches.length > 0
                              ? "کد منطبق بر اساس شواهد ثبت‌شده؛ ابعاد و شرایط کارکرد را پیش از سفارش کنترل کنید"
                              : "تطبیق تصویری هوشمند بر اساس بیشترین تشابه شکل، هندسه، دندانه‌ها و ساختار ظاهری"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {allDisplayProducts.map((match, idx) => {
                            const catalogItem = (match.catalogProduct ||
                              match) as any;
                            const priceInfo = getItemPrice(catalogItem);
                            const isExact =
                              match.visualVerdict === "exact_match";

                            return (
                              <div
                                key={match.code + idx}
                                className={`bg-white border rounded-2xl p-4 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-3 ${
                                  isExact
                                    ? "border-emerald-500 ring-2 ring-emerald-200/80 shadow-sm"
                                    : "border-blue-300 ring-1 ring-blue-100 hover:border-blue-400"
                                }`}
                              >
                                <div className="space-y-2.5">
                                  <div className="flex items-start gap-3">
                                    {resolveMatchImage(match, catalogItem) && (
                                      <img
                                        src={resolveMatchImage(
                                          match,
                                          catalogItem,
                                        )}
                                        alt={match.name}
                                        referrerPolicy="no-referrer"
                                        className="w-16 h-16 object-contain rounded-xl border border-slate-200 bg-slate-50 p-1 shrink-0"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-1.5 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-lg bg-orange-100 text-[#E06518] font-mono text-xs font-bold">
                                          {match.code}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                                          <Zap className="w-3 h-3 text-emerald-600" />
                                          <span>
                                            امتیاز{" "}
                                            {toPersianDigits(
                                              match.similarityScore,
                                            )}{" "}
                                            از ۱۰۰
                                          </span>
                                        </span>
                                        {match.matchType === "code" && isExact && (
                                          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold">
                                            کد خوانده‌شده منطبق است
                                          </span>
                                        )}
                                        <span
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 ${
                                            isExact
                                              ? "bg-emerald-600 text-white"
                                              : "bg-blue-600 text-white"
                                          }`}
                                        >
                                          {isExact ? (
                                            <CheckCircle2 className="w-3 h-3" />
                                          ) : (
                                            <Sparkles className="w-3 h-3" />
                                          )}
                                          <span>
                                            {isExact
                                              ? "کد منطبق بر اساس شواهد"
                                              : "محصول مشابه در کاتالوگ اطلس"}
                                          </span>
                                        </span>
                                      </div>

                                      <h5 className="font-bold text-sm text-[#55565A] leading-snug mt-1 line-clamp-2">
                                        {match.name}
                                      </h5>

                                      {((match as any).forzaCode ||
                                        (catalogItem as any)?.forzaCode) && (
                                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                                          {(match as any).forzaCode ||
                                            (catalogItem as any)?.forzaCode}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Visual Explanation */}
                                  {match.visualExplanation ? (
                                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-950 space-y-1">
                                      <div className="flex items-center gap-1 font-bold text-emerald-900">
                                        <Eye className="w-3.5 h-3.5 text-emerald-700" />
                                        <span>مبنای رتبه‌بندی سرور:</span>
                                      </div>
                                      <p className="leading-relaxed">
                                        {match.visualExplanation}
                                      </p>
                                    </div>
                                  ) : match.distinction ? (
                                    <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200/70 text-[11px] text-blue-900 flex items-start gap-1.5">
                                      <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                      <span>
                                        <strong>تفاوت عملکردی:</strong>{" "}
                                        {match.distinction}
                                      </span>
                                    </div>
                                  ) : match.matchReason ? (
                                    <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-100">
                                      {match.matchReason}
                                    </p>
                                  ) : null}

                                  {/* Quick Specs */}
                                  {match.specs && match.specs.length > 0 && (
                                    <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                                      {match.specs
                                        .slice(0, 4)
                                        .map((s, sIdx) => (
                                          <div
                                            key={sIdx}
                                            className="bg-slate-50 px-2 py-1 rounded-md text-[10px] text-slate-600 flex justify-between"
                                          >
                                            <span>{s.key}:</span>
                                            <span className="font-mono font-bold text-[#55565A]">
                                              {s.value}
                                            </span>
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>

                                {/* Price & Actions */}
                                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">
                                      قیمت / استعلام:
                                    </span>
                                    {priceInfo ? (
                                      <div className="text-left font-bold text-[#55565A]">
                                        <span>
                                          {formatPrice(
                                            priceInfo.calculatedPrice,
                                          )}
                                        </span>
                                        {priceInfo.discountPercent > 0 && (
                                          <span className="text-[10px] text-emerald-600 mr-1">
                                            (
                                            {toPersianDigits(
                                              priceInfo.discountPercent,
                                            )}
                                            ٪ تخفیف)
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[#E06518] font-bold">
                                        قیمت و موجودی در پنل
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {catalogItem && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onClose();
                                          if (currentUser)
                                            navigate(
                                              memberPath(
                                                currentUser,
                                                match.code,
                                              ),
                                            );
                                          else
                                            openAuthModal(
                                              memberPath(null, match.code),
                                              "register",
                                            );
                                        }}
                                        className="flex-1 h-9 bg-slate-100 hover:bg-orange-50 hover:text-[#E06518] text-[#55565A] rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                                      >
                                        <ShoppingCart className="w-3.5 h-3.5" />
                                        <span>بررسی در پنل</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClose();
                                        navigate(`/product/${match.code}`);
                                      }}
                                      className="h-9 px-4 bg-[#55565A] hover:bg-[#1B293E] text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <span>مشاهده کالا</span>
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (imageEventId) {
                                          void selectCustomerImageProduct(imageEventId, match.code).catch(error =>
                                            console.warn('[Customer image history] selected product sync unavailable', error)
                                          );
                                        }
                                        onClose();
                                        navigate('/ai-consult?productCode=' + encodeURIComponent(match.code) + '&productName=' + encodeURIComponent(match.name || match.code));
                                      }}
                                      className="h-9 px-3 bg-orange-50 hover:bg-orange-100 text-[#A64B14] rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer border border-orange-200"
                                    >
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>مشاوره FORZA</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Workshop custom fabrication reminder */}
                        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 text-slate-700">
                            <Wrench className="w-4 h-4 text-[#E06518] shrink-0" />
                            <span>
                              نیاز به ساخت سفارشی یا تغییر ابعاد همین قطعه
                              دارید؟ کارگاه تخصصی صنعت پیش (پیش به صنعت) در خدمت
                              شماست.
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href="tel:03535254703"
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>۰۳۵-۳۵۲۵۴۷۰۳</span>
                            </a>
                            <a
                              href="https://wa.me/989903427027?text=سلام%2C%20این%20تصویر%20قطعه%20را%20برای%20استعلام%20ارسال%20می‌کنم"
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>واتس‌اپ</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    /* ─── Custom Order Panel (no matching items at all) ─── */
                    <div className="p-5 rounded-2xl border-2 border-dashed border-amber-300 bg-gradient-to-l from-amber-50 via-orange-50 to-amber-50 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#E06518] text-white flex items-center justify-center shrink-0 shadow-md">
                          <Wrench className="w-6 h-6" />
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <div className="font-black text-base text-[#55565A]">
                            درخواست بررسی تخصصی قطعه 🔧
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            در کاتالوگ، محصولی با شباهت تصویری کافی پیدا نشد.
                            این به معنی ناممکن بودن تأمین نیست؛ کارشناسان صنعت پیش
                            پس از بررسی ابعاد، جنس و شرایط کارکرد، امکان تأمین یا
                            ساخت سفارشی را اعلام می‌کنند.
                          </p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            همین عکس را برای کارشناسان ما ارسال کنید تا امکان
                            شناسایی ابعادی، استعلام قیمت و زمان تأمین یا ساخت
                            بررسی شود.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <a
                          href="tel:03535254703"
                          className="flex-1 h-11 bg-[#55565A] hover:bg-[#1B293E] text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                        >
                          <Phone className="w-4 h-4" />
                          <span>تماس با صنعت پیش: ۰۳۵-۳۵۲۵۴۷۰۳</span>
                        </a>
                        <a
                          href="https://wa.me/989903427027?text=سلام%2C%20این%20تصویر%20قطعه%20را%20برای%20ساخت%20سفارشی%20ارسال%20می‌کنم"
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>ارسال عکس در واتس‌اپ</span>
                        </a>
                      </div>
                    </div>
                  );
                })()}

                {/* Technical Advice Footnote */}
                {analysisResult.technicalAdvice && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold block">
                        توصیه فنی مهندسی صنعت پیش:
                      </span>
                      <p className="leading-relaxed">
                        {analysisResult.technicalAdvice}
                      </p>
                    </div>
                  </div>
                )}

                {/* Return to edit button */}
                <div className="pt-2 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>بازگشت و اصلاح مشخصات</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-slate-500 hover:text-[#55565A] font-bold cursor-pointer"
                  >
                    شروع جستجوی جدید
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      </div>
    </Modal>
  );
};
