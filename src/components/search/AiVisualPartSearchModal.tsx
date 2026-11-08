import {LocalModelResults} from './LocalModelResults';
import {apiUrl} from '../../config/apiConfig';
import {ImageRegionSelector} from './ImageRegionSelector';
import type {ImageRegion} from '../../services/localQueryImage';
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
import "./industrial-scan.css";
import { VisionAnalysisProgress } from "./VisionAnalysisProgress";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fullScreen?: boolean;
  initialCamera?: boolean;
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
  {title:"آماده‌سازی تصویر مشتری",en:"IMAGE PREPARATION",icon:Scan,tag:"تصویر مشتری",detail:"بررسی کیفیت و نشانه‌های قابل مشاهده"},
  {title:"خواندن نوشته و ویژگی‌های ظاهری",en:"VISIBLE FEATURES",icon:Ruler,tag:"نشانه‌های قطعه",detail:"بدون حدس ابعاد یا جنس نامشخص"},
  {title:"مقایسه تمام تصاویر کاتالوگ",en:"FULL CATALOGUE SCAN",icon:Layers,tag:"همهٔ تصاویر",detail:"بررسی عکس‌های کاتالوگ و تصاویر تازه"},
  {title:"بررسی دوبارهٔ گزینه‌های مشابه",en:"DETAILED COMPARISON",icon:Cpu,tag:"بررسی دقیق‌تر",detail:"مقایسهٔ جزئیات با وضوح بالاتر"},
];

export const AiVisualPartSearchModal: React.FC<Props> = ({
  isOpen,
  onClose,
  fullScreen = false,
  initialCamera = false,
}) => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { currentUser, openAuthModal } = useAuth();

  // Wizard state: 1: Image, 2: Dimensions, 3: Application & Features, 'analyzing', 'results'
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Form states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [queryRegion,setQueryRegion]=useState<ImageRegion>();
  const [autoQueryRegion,setAutoQueryRegion]=useState<ImageRegion|null>(null);
  const [queryRegionSource,setQueryRegionSource]=useState<'automatic'|'manual'|'full'>('full');
  const analysisSequenceRef=useRef(0);
  const analysisBusyRef=useRef(false);
  const autoAnalyzedImageRef=useRef<string|null>(null);
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
  React.useEffect(()=>{setQueryRegion(undefined);setAutoQueryRegion(null);setQueryRegionSource('full');analysisSequenceRef.current++;analysisBusyRef.current=false;if(regionTimerRef.current)clearTimeout(regionTimerRef.current);},[selectedImage]);
  React.useEffect(()=>{if(!isOpen){analysisSequenceRef.current++;analysisBusyRef.current=false;setCurrentStep(step=>step==="analyzing"?1:step);}return()=>{if(regionTimerRef.current)clearTimeout(regionTimerRef.current);};},[isOpen]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
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

  const uploadSelectedImage = (source: string | Blob) => {
    const sequence = ++imageUploadSequenceRef.current;
    setIsUploadingImage(true);
    setUploadedImageUrl(null);
    aiVisualSearchService
      .uploadCustomerImage(source)
      .then((uploaded) => {
        if (sequence === imageUploadSequenceRef.current) {
          setUploadedImageUrl(uploaded.imageUrl);
        }
      })
      .catch((error: any) => {
        if (sequence === imageUploadSequenceRef.current) {
          setErrorMessage(error?.message || "ذخیره تصویر در سرور انجام نشد.");
        }
      })
      .finally(() => {
        if (sequence === imageUploadSequenceRef.current)
          setIsUploadingImage(false);
      });
  };

  // Upload the selected image to the server folder as soon as the customer selects it.
  const handleFile = (file: File) => {
    if (selectedImage?.startsWith("blob:")) URL.revokeObjectURL(selectedImage);
    setErrorMessage("");
    setUploadedImageUrl(null);
    setAnalysisResult(null);setMeasurements({});
    setSelectedImage(URL.createObjectURL(file));
    setMimeType(file.type || "image/jpeg");
    if (isUsingCamera) stopCamera();
    uploadSelectedImage(file);
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
    setUploadedImageUrl(null);
    setMimeType("image/jpeg");
    setErrorMessage("");
    uploadSelectedImage(preset.imageUrl);
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
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024) {
      setErrorMessage("لطفاً تصویر JPG، PNG یا WebP کوچک‌تر از ۱۲ مگابایت انتخاب کنید.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      if (selectedImage?.startsWith("blob:")) URL.revokeObjectURL(selectedImage);
      imageUploadSequenceRef.current += 1;
      setUploadedImageUrl(null);
      setAnalysisResult(null);
      setMeasurements({});
      setSelectedImage(reader.result);
      setMimeType(file.type);
      setErrorMessage("");
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
        if (selectedImage?.startsWith("blob:"))
          URL.revokeObjectURL(selectedImage);
        setAnalysisResult(null);setMeasurements({});
        setSelectedImage(dataUrl);
        setUploadedImageUrl(null);
        setMimeType("image/jpeg");
        setErrorMessage("");
        if (cameraFlowActive) {
          // Keep the captured frame local until the customer confirms it.
          setCameraReview(true);
          stopCamera();
          return;
        }
        uploadSelectedImage(dataUrl);
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
    imageUploadSequenceRef.current += 1;
    setIsUploadingImage(false);
    if (selectedImage?.startsWith("blob:")) URL.revokeObjectURL(selectedImage);
    setSelectedImage(null);
    setUploadedImageUrl(null);
    setLength("");
    setWidth("");
    setPitch("");
    setApplication("");
    setFeatures("");
    setAnalysisResult(null);setMeasurements({});
    setQueryRegion(undefined);setAutoQueryRegion(null);setQueryRegionSource('full');
    setErrorMessage("");
    setPendingStage("refined");
    setLastStage("refined");
    setCurrentStep(1);
  };

  // Navigation handlers
  const goToStep2 = () => {
    if(selectedImage && !analysisResult?.requiredMeasurements){void handleAnalyze("quick");return;}
    setErrorMessage("");
    setCurrentStep(2);
  };

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
  const handleAnalyze = async (stage: AiAnalysisStage = "refined", regionOverride?:ImageRegion|null) => {
    if(analysisBusyRef.current)return;
    if (!selectedImage && !length && !width) {
      setErrorMessage(
        "لطفاً حداقل تصویر قطعه یا ابعاد (طول و عرض) را مشخص فرمایید.",
      );
      return;
    }
    if (stage === "quick" && !selectedImage) {
      setErrorMessage("برای شناسایی فوری، ابتدا تصویر قطعه را بارگذاری کنید.");
      return;
    }

    if (isUploadingImage) {
      setErrorMessage("لطفاً صبر کنید تا بارگذاری تصویر روی سرور کامل شود.");
      return;
    }

    if(stage==="refined" && analysisResult?.requiredMeasurements){const issue=measurementError(analysisResult.requiredMeasurements,measurements);if(issue){setErrorMessage(issue);setCurrentStep(2);return;}}
    analysisBusyRef.current=true;
    const sequence=++analysisSequenceRef.current;
    setErrorMessage("");
    setPendingStage(stage);
    setAnalysisProgress(0);
    setAnalysisPhaseIndex(0);
    setScanCounts(null);
    setCurrentStep("analyzing");

    try {
      const effectiveRegion=localRegionEnabled?(regionOverride===null?undefined:regionOverride || queryRegion):undefined;
      const manualRegionRequest=Boolean(localRegionEnabled && effectiveRegion && (regionOverride!==undefined ? regionOverride!==null : queryRegionSource==='manual'));
      const result = await aiVisualSearchService.analyzePartWithAi({
        imageUrl: uploadedImageUrl || undefined,
        imageBase64: uploadedImageUrl ? undefined : selectedImage || undefined,
        mimeType: mimeType,
        length: length ? parseFloat(length) : undefined,
        width: width ? parseFloat(width) : undefined,
        pitch: pitch ? parseFloat(pitch) : undefined,
        application: application.trim() || undefined,
        features: features.trim() || undefined,
        stage,
        observationOnly:false,
        region:effectiveRegion,
        fallbackRegion:manualRegionRequest ? autoQueryRegion : undefined,
        includeNearest:false,
        measurements:stage==="refined" && analysisResult?.requiredMeasurements ? measurements : undefined,
      }, progress => {
        if(sequence!==analysisSequenceRef.current)return;
        setScanCounts(progress);
        setAnalysisProgress(progress.total ? Math.floor(progress.compared*100/progress.total) : 0);
        setAnalysisPhaseIndex(progress.stage==='verifying' ? 3 : progress.stage==='scanning' ? 2 : 0);
      });

      if(sequence!==analysisSequenceRef.current)return;
      if(localRegionEnabled){
        const selectedRegion=result.queryRegion || (regionOverride===null?undefined:regionOverride || queryRegion);
        setQueryRegion(selectedRegion);
        if(result.regionFallbackUsed){
          setQueryRegionSource(selectedRegion?'automatic':'full');
        }else if(manualRegionRequest){
          setQueryRegionSource('manual');
        }else{
          setAutoQueryRegion(selectedRegion || null);
          setQueryRegionSource(selectedRegion?'automatic':'full');
        }
      }
      if(result.customerImageUrl)setUploadedImageUrl(result.customerImageUrl);
      setAnalysisResult(result);
      setLastStage(result.stage || stage);
      setCurrentStep(result.observationOnly ? 2 : "results");
    } catch (err: any) {
      if(sequence!==analysisSequenceRef.current)return;
      console.error(err);
      setErrorMessage(
        err.message || "خطا در ارتباط با سامانه تحلیل هوش مصنوعی.",
      );
      setCurrentStep(stage === "quick" ? 1 : 3);
    }finally{if(sequence===analysisSequenceRef.current)analysisBusyRef.current=false;}
  };

  // Auto-search only after gallery upload completes. Camera photos still require confirmation.
  React.useEffect(()=>{
    if(!isOpen||!localRegionEnabled||!uploadedImageUrl||isUploadingImage||!selectedImage||cameraFlowActive||cameraReview||currentStep!==1||autoAnalyzedImageRef.current===uploadedImageUrl)return;
    autoAnalyzedImageRef.current=uploadedImageUrl;
    void handleAnalyze("quick");
  },[isOpen,localRegionEnabled,uploadedImageUrl,isUploadingImage,selectedImage,cameraFlowActive,cameraReview,currentStep]);
  const searchRegion=(region:ImageRegion|undefined)=>{
    setQueryRegion(region);
    setQueryRegionSource(region?'manual':'full');
    if(regionTimerRef.current)clearTimeout(regionTimerRef.current);
    regionTimerRef.current=setTimeout(()=>{void handleAnalyze("quick",region || null);},300);
  };

  const retakeCameraPhoto = () => {
    if (selectedImage?.startsWith("blob:")) URL.revokeObjectURL(selectedImage);
    setSelectedImage(null);
    setUploadedImageUrl(null);
    setCameraReview(false);
    setErrorMessage("");
    void startCamera();
  };

  const confirmCameraPhoto = () => {
    if (!selectedImage) {
      setErrorMessage("ابتدا عکس قطعه را ثبت کنید.");
      return;
    }
    // analyzePartWithAi uploads this confirmed data URL once and reuses the existing catalog pipeline.
    setCameraReview(false);
    setCameraFlowActive(false);
    void handleAnalyze("quick");
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
        <div style={fullScreen ? { minHeight: "100dvh" } : undefined} dir="rtl" data-testid="identification-wizard" className="sp-vision-workspace relative">
          <button type="button" onClick={() => { stopCamera(); onClose(); }}
            className="absolute left-3 top-3 z-30 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 text-slate-600 shadow-sm transition hover:border-orange-300 hover:text-[#C95210] sm:left-5 sm:top-5"
            aria-label={fullScreen ? "بازگشت به میزکار" : "بستن"}>
            {fullScreen ? <><ArrowRight className="h-4 w-4"/><span className="text-xs font-bold">بازگشت</span></> : <X className="h-4 w-4"/>}
          </button>

          <main className="sp-vision-workspace__main">
            <header className="sp-vision-workspace__heading">
              <span className="sp-vision-workspace__eyebrow"><Sparkles size={14}/> FORZA VISION / جست‌وجوی تصویری</span>
              <h1>قطعه را از روی تصویر پیدا کن</h1>
              <p>عکس قطعه را بفرست؛ سیستم خودش ناحیه آن را پیدا می‌کند و با تصاویر واقعی کاتالوگ مقایسه می‌کند.</p>
            </header>

            {errorMessage && <div className="sp-vision-workspace__error" role="alert"><AlertCircle size={17}/><span>{errorMessage}</span></div>}

            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="انتخاب تصویر قطعه"
              onChange={event=>{const image=event.currentTarget.files?.[0];if(image)handleFile(image);event.currentTarget.value="";}}/>

            {!selectedImage && !isUsingCamera ? (
              <div className={"sp-vision-workspace__dropzone "+(isDragOver?"is-dragging":"")}
                onDragOver={event=>{event.preventDefault();setIsDragOver(true);}}
                onDragLeave={()=>setIsDragOver(false)} onDrop={handleDrop}
                onClick={()=>fileInputRef.current?.click()} role="button" tabIndex={0}
                onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();fileInputRef.current?.click();}}}>
                <span className="sp-vision-workspace__upload-icon"><UploadCloud size={28}/></span>
                <strong>تصویر قطعه را انتخاب یا اینجا رها کن</strong>
                <span>عکس واضح از خود قطعه؛ پس‌زمینه ساده به تشخیص بهتر کمک می‌کند.</span>
                <span className="sp-vision-workspace__format">JPG · PNG · WEBP <i/> حداکثر ۱۲ مگابایت</span>
                <button type="button" onClick={event=>{event.stopPropagation();fileInputRef.current?.click();}}>انتخاب تصویر از دستگاه</button>
              </div>
            ) : isUsingCamera ? (
              <div className="sp-vision-workspace__camera">
                <div className="sp-vision-workspace__camera-view">
                  <video ref={node=>{videoRef.current=node;if(node&&cameraStreamRef.current&&node.srcObject!==cameraStreamRef.current){node.srcObject=cameraStreamRef.current;void node.play().catch(()=>undefined);}}}
                    onLoadedMetadata={()=>setIsCameraReady(true)} aria-label="پیش‌نمایش زنده دوربین برای عکاسی از قطعه"
                    className="h-full w-full object-contain" autoPlay playsInline/>
                  <canvas ref={canvasRef} className="hidden"/>
                  <span className="sp-vision-workspace__camera-status" role="status" aria-live="polite">{isCameraReady?"دوربین آماده است؛ قطعه را داخل کادر قرار بده":"در حال آماده‌سازی دوربین…"}</span>
                </div>
                <div className="flex flex-wrap justify-center gap-2 p-3">
                  <button type="button" onClick={capturePhoto} disabled={!isCameraReady} className="sp-vision-workspace__primary"><Camera size={17}/> ثبت عکس قطعه</button>
                  <button type="button" onClick={stopCamera} className="sp-vision-workspace__secondary">انصراف</button>
                </div>
              </div>
            ) : (
              <div className="sp-vision-workspace__selected">
                <div className="sp-vision-workspace__selected-image"><img src={selectedImage||undefined} alt="قطعه انتخابی"/></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>تصویر دریافت شد</strong>
                    <span className={"sp-vision-workspace__upload-state "+(isUploadingImage?"is-uploading":uploadedImageUrl?"is-ready":"")}>
                      {isUploadingImage?<RefreshCw size={12} className="animate-spin"/>:<CheckCircle2 size={12}/>}
                      {isUploadingImage?"در حال ذخیره تصویر":uploadedImageUrl?"آماده تحلیل":"تصویر انتخاب شد"}
                    </span>
                  </div>
                  <p>سیستم ابتدا قطعه را در تصویر پیدا می‌کند. می‌توانی ناحیه پیشنهادی را تغییر بدهی.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={()=>fileInputRef.current?.click()} className="sp-vision-workspace__small-action">تغییر تصویر</button>
                    <button type="button" onClick={()=>{imageUploadSequenceRef.current++;setIsUploadingImage(false);if(selectedImage?.startsWith("blob:"))URL.revokeObjectURL(selectedImage);setSelectedImage(null);setUploadedImageUrl(null);setQueryRegion(undefined);setAutoQueryRegion(null);setQueryRegionSource('full');setAnalysisResult(null);stopCamera();}} className="sp-vision-workspace__small-action is-danger">حذف تصویر</button>
                  </div>
                </div>
              </div>
            )}

            {localRegionEnabled && selectedImage && !isUsingCamera &&
              <ImageRegionSelector src={selectedImage} value={queryRegion} mode={queryRegionSource} onChange={searchRegion}/>}

            <div className="sp-vision-workspace__actions">
              <button type="button" onClick={()=>selectedImage?handleAnalyze("quick"):fileInputRef.current?.click()} disabled={isUploadingImage} className="sp-vision-workspace__primary">
                <Scan size={17}/>{selectedImage?"شروع شناسایی قطعه":"انتخاب تصویر"}
              </button>
              <button type="button" onClick={()=>void startCamera()} className="sp-vision-workspace__secondary"><Camera size={17}/> استفاده از دوربین</button>
            </div>
            <p className="sp-vision-workspace__privacy"><ShieldCheck size={15}/> فقط گزینه‌های واقعی و مرتبط با کاتالوگ نمایش داده می‌شوند؛ نتیجه ضعیف به‌زور به‌عنوان محصول پیشنهاد نمی‌شود.</p>
          </main>

          <aside className="sp-vision-workspace__aside">
            <div className="sp-vision-workspace__aside-card">
              <span className="sp-vision-workspace__aside-kicker">SMART PART LOCALIZATION</span>
              <h2>از عکس تا نزدیک‌ترین قطعه</h2>
              <p>نیازی نیست خودت از ابتدا دور قطعه را برش بدهی. سیستم چند ناحیه محتمل را بررسی می‌کند و بهترین ناحیه را برای جست‌وجو انتخاب می‌کند.</p>
              <ol>
                <li><span>۱</span><div><strong>پیدا کردن قطعه</strong><small>پیشنهاد خودکار محدوده در عکس</small></div></li>
                <li><span>۲</span><div><strong>انتخاب با لمس</strong><small>اگر قطعه دیگری مدنظر است، روی آن بزن</small></div></li>
                <li><span>۳</span><div><strong>مقایسه با کاتالوگ</strong><small>نمایش مدل‌های مشابه، حتی خانواده بدون کد</small></div></li>
              </ol>
              <div className="sp-vision-workspace__aside-note"><Target size={16}/> اگر انتخاب دستی نتیجه‌ای نداشته باشد، سیستم دوباره ناحیه پیشنهادی خودش را امتحان می‌کند.</div>
            </div>
            <div className="sp-vision-workspace__samples">
              <div><strong>برای آشنایی، یک نمونه را امتحان کن</strong><span>نمونه‌های واقعی آموزشی</span></div>
              <div className="sp-vision-workspace__sample-list">
                {INDUSTRIAL_PRESET_SAMPLES.slice(0,5).map(sample=><button key={sample.id} type="button" onClick={()=>loadPreset(sample)} title={sample.title} aria-label={"نمونه "+sample.title}><img src={sample.imageUrl} alt={sample.title}/></button>)}
              </div>
            </div>
          </aside>
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
                    <span className="text-[11px] text-slate-500 font-normal">
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
                {localRegionEnabled && selectedImage && <ImageRegionSelector src={selectedImage} value={queryRegion} mode={queryRegionSource} onChange={searchRegion} />}
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
                <div className="bg-white text-slate-800 border border-slate-200 shadow-sm p-4 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#E06518] text-white flex items-center justify-center font-bold text-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2 flex-wrap">
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
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
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
                        className="relative w-full sm:w-40 h-32 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shrink-0"
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
                      <p className="text-sm text-slate-700 leading-7"><strong>تحلیل قطعه: </strong>{analysisResult.summary.visualAnalysis}</p>
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
                    className={`p-4 rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm transition-all ${
                      analysisResult.summary.catalogAvailability.status ===
                      "confirmed_in_catalog"
                        ? "bg-emerald-50 border-emerald-200 text-slate-800"
                        : analysisResult.summary.catalogAvailability.status ===
                            "similar_in_catalog"
                          ? "bg-blue-50 border-blue-200 text-slate-800"
                          : "bg-amber-50 border-amber-200 text-slate-800"
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
                          <span className="font-black text-sm text-slate-900">
                            {
                              analysisResult.summary.catalogAvailability
                                .statusFarsiTitle
                            }
                          </span>
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                              analysisResult.summary.catalogAvailability
                                .status === "confirmed_in_catalog"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : analysisResult.summary.catalogAvailability
                                      .status === "similar_in_catalog"
                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
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
                        <p className="text-xs text-slate-600 leading-relaxed">
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
                            با مشخصات فعلی، قطعهٔ کاملاً منطبق در کاتالوگ آماده
                            سرور یافت نشد. کارگاه تخصصی صنعت پیش توانایی طراحی،
                            ساخت یا تأمین سفارشی{" "}
                            <strong>دقیقاً همین قطعه</strong> را با بالاترین
                            کیفیت متریال دارد.
                          </p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            کافیست همین عکس را برای کارشناسان ما ارسال کنید تا
                            شناسایی ابعادی، استعلام قیمت و زمان ساخت فوری اعلام
                            شود.
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
    </Modal>
  );
};
