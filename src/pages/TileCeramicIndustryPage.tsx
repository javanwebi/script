import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { scrollToSectionElement } from '../components/layout/ScrollToTop';
import {
  Search,
  MessageSquare,
  ShieldCheck,
  Clock,
  HelpCircle,
  RefreshCw,
  Play,
  Camera,
  Upload,
  SlidersHorizontal,
  ClipboardList,
  ChevronLeft,
  CheckCircle2,
  Heart,
  Info,
  X,
  FileText,
  Factory,
  Layers,
  Award,
  Sparkles,
  Wrench,
  ArrowLeft,
} from 'lucide-react';
import { STORE_ASSETS } from '../assets/images';
import { getProductImageUrl } from '../assets/imagesproducts';
import { PartIdentificationLink } from '../components/search/PartIdentificationProvider';
import { useWishlist } from '../context/WishlistContext';

interface StageSubPart {
  id: string;
  title: string;
  image: string;
  fallbackImage: string;
  query: string;
}

interface ProductionStage {
  id: string;
  number: string;
  shortLabel: string;
  badgeLabel?: string;
  title: string;
  description: string;
  details: string;
  image: string;
  hotspotX: string; // percentage from left
  hotspotY: string; // percentage from top
  query: string;
  popularParts: StageSubPart[];
}

interface ProblemItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  symptom: string;
  cause: string;
  solution: string;
  recommendedQuery: string;
}

interface RecommendedProductItem {
  code: string;
  name: string;
  subtitle: string;
  spec: string;
  image: string;
  fallbackImage: string;
  query: string;
}

export const TileCeramicIndustryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isInWishlist, toggleWishlist } = useWishlist();

  // Interactive Stage State (Persisted in sessionStorage so Back button keeps selected stage)
  const [activeStageId, setActiveStageId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.sessionStorage.getItem('sanat_ceramic_active_stage') || 'press';
      } catch {
        return 'press';
      }
    }
    return 'press';
  });
  const [stageHighlightPulse, setStageHighlightPulse] = useState<boolean>(false);
  const stageDetailRef = useRef<HTMLDivElement>(null);

  const handleSelectStage = (stageId: string) => {
    setActiveStageId(stageId);
    try {
      window.sessionStorage.setItem('sanat_ceramic_active_stage', stageId);
    } catch {
      // ignore storage errors
    }
    setStageHighlightPulse(true);
    window.setTimeout(() => setStageHighlightPulse(false), 750);
    window.requestAnimationFrame(() => {
      scrollToSectionElement(stageDetailRef.current, { behavior: 'smooth' });
    });
  };

  // Smart Search Input States
  const [techSpecQuery, setTechSpecQuery] = useState<string>('');
  const [machineProblemQuery, setMachineProblemQuery] = useState<string>('');

  // Modals State
  const [rfqModalOpen, setRfqModalOpen] = useState<boolean>(false);
  const [rfqItemName, setRfqItemName] = useState<string>('');
  const [rfqCustomerName, setRfqCustomerName] = useState<string>('');
  const [rfqPhone, setRfqPhone] = useState<string>('');
  const [rfqFactory, setRfqFactory] = useState<string>('');
  const [rfqNote, setRfqNote] = useState<string>('');
  const [rfqSubmitted, setRfqSubmitted] = useState<boolean>(false);

  const [selectedProblem, setSelectedProblem] = useState<ProblemItem | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState<boolean>(false);
  const [stageInfoModalOpen, setStageInfoModalOpen] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // 7 STAGES OF TILE & CERAMIC PRODUCTION LINE (01 to 07, Right to Left)
  // ---------------------------------------------------------------------------
  const productionStages: ProductionStage[] = [
    {
      id: 'raw-material',
      number: '01',
      shortLabel: 'آماده‌سازی مواد اولیه',
      title: 'آماده‌سازی و توزین مواد اولیه',
      description: 'انتقال خاک، فلدسپات و سیلیس از سیلوها به سیستم توزین با تسمه‌های نقاله مقاوم به سایش و رولیک‌های ضربه‌گیر.',
      details:
        'در ابتدای خط تولید کاشی و سرامیک، بارگیری و توزین دقیق مواد معدنی ساینده نیازمند تسمه نقاله‌های لاستیکی چندلایه EP، رولیک‌های ضربه‌گیر لاستیکی، یاتاقان‌های ضد گردوغبار و زنجیرهای انتقال قدرت سنگین است.',
      image: STORE_ASSETS.industries.ceramic,
      hotspotX: '90%',
      hotspotY: '48%',
      query: 'تسمه نقاله',
      popularParts: [
        {
          id: 'rm-1',
          title: 'تسمه نقاله',
          image: getProductImageUrl('e(859).png'),
          fallbackImage: STORE_ASSETS.products.pvcBelt,
          query: 'نوار نقاله',
        },
        {
          id: 'rm-2',
          title: 'رولیک و چرخ',
          image: getProductImageUrl('e(394).png'),
          fallbackImage: STORE_ASSETS.products.ceramicRoller,
          query: 'چرخ',
        },
        {
          id: 'rm-3',
          title: 'بلبرینگ و یاتاقان',
          image: getProductImageUrl('e(383).png'),
          fallbackImage: STORE_ASSETS.products.bearing,
          query: 'بلبرینگ',
        },
        {
          id: 'rm-4',
          title: 'ضربه‌گیر لاستیکی',
          image: getProductImageUrl('e(817).png'),
          fallbackImage: STORE_ASSETS.products.ceramicParts,
          query: 'ضربه گیر',
        },
      ],
    },
    {
      id: 'spray-dryer',
      number: '02',
      shortLabel: 'اسپری درایر',
      title: 'بالمیل و خشک‌کن پاششی (اسپری درایر)',
      description: 'پمپاژ دوغاب سرامیک با فشار بالا و تبدیل به گرانول یکنواخت توسط نازل‌های ضدسایش و تسمه‌های انتقال نیرو.',
      details:
        'در واحد بالمیل و اسپری درایر، سایش شدید دوغاب سیلیسی و دمای خشک‌کن چالش اصلی است. پولی‌های چدنی بالانس‌شده، تسمه‌های V-Belt قدرتمند، قطعات پمپ و اورینگ‌های نسوز پایداری این مرحله را تضمین می‌کنند.',
      image: STORE_ASSETS.industries.bgPlant,
      hotspotX: '76%',
      hotspotY: '44%',
      query: 'پمپ',
      popularParts: [
        {
          id: 'sd-1',
          title: 'قطعات پمپ',
          image: getProductImageUrl('e(570).png'),
          fallbackImage: STORE_ASSETS.products.pump,
          query: 'پمپ',
        },
        {
          id: 'sd-2',
          title: 'پولی و کوپلینگ',
          image: getProductImageUrl('e(165).png'),
          fallbackImage: STORE_ASSETS.products.aluPulley,
          query: 'پولی',
        },
        {
          id: 'sd-3',
          title: 'تسمه V-Belt',
          image: STORE_ASSETS.categories.belts,
          fallbackImage: STORE_ASSETS.products.forzaBelt,
          query: 'تسمه',
        },
        {
          id: 'sd-4',
          title: 'اورینگ و آب‌بندی',
          image: getProductImageUrl('e(648).png'),
          fallbackImage: STORE_ASSETS.products.ceramicParts,
          query: 'اورینگ',
        },
      ],
    },
    {
      id: 'final-milling',
      number: '03',
      shortLabel: 'آسیاب نهایی',
      title: 'آسیاب نهایی و الک ویبره گرانول',
      description: 'همگن‌سازی ذرات پودر گرانول و جداسازی ناخالصی‌ها پیش از ورود به سیلوهای تغذیه پرس.',
      details:
        'الک‌های ویبره و خطوط انتقال گرانول نیازمند فنرهای صنعتی، ضربه‌گیرهای لاستیکی دو سر پیچ، توری‌های صنعتی مقاوم و بوش‌های تفلونی ضدسایش هستند تا جریان یکنواخت پودر به سمت پرس حفظ شود.',
      image: STORE_ASSETS.industries.manufacturing,
      hotspotX: '62%',
      hotspotY: '38%',
      query: 'توری صنعتی',
      popularParts: [
        {
          id: 'fm-1',
          title: 'ضربه‌گیر صنعتی',
          image: getProductImageUrl('e(820).png'),
          fallbackImage: STORE_ASSETS.products.ceramicParts,
          query: 'ضربه گیر',
        },
        {
          id: 'fm-2',
          title: 'توری و الک',
          image: getProductImageUrl('e(337).png'),
          fallbackImage: STORE_ASSETS.categories.ceramic,
          query: 'توری صنعتی',
        },
        {
          id: 'fm-3',
          title: 'بوش تفلونی',
          image: getProductImageUrl('e(219).png'),
          fallbackImage: STORE_ASSETS.products.ceramicParts,
          query: 'بوش تفلونی',
        },
        {
          id: 'fm-4',
          title: 'فنر صنعتی',
          image: getProductImageUrl('e(1).png'),
          fallbackImage: STORE_ASSETS.forzaSubFittings,
          query: 'فنر',
        },
      ],
    },
    {
      id: 'dryer',
      number: '04',
      shortLabel: 'خشک‌کن',
      title: 'خشک‌کن سریع عمودی و افقی',
      description: 'رطوبت‌گیری کنترل‌شده بیسکویت خام کاشی پس از پرس با حرکت پیوسته سبدها، زنجیرها و رولیک‌های نسوز.',
      details:
        'در خشک‌کن‌های عمودی و افقی، رطوبت بالا و دمای متناوب باعث فرسایش سریع قطعات متحرک می‌شود. چرخ‌دنده‌های دقیق، زنجیرهای صنعتی، بوش‌های داخل رولر و بلبرینگ‌های دورنگهدارنده از توقف خشک‌کن جلوگیری می‌کنند.',
      image: STORE_ASSETS.industries.ceramic,
      hotspotX: '47%',
      hotspotY: '35%',
      query: 'بوش داخل رولر',
      popularParts: [
        {
          id: 'dr-1',
          title: 'بوش داخل رولر',
          image: getProductImageUrl('e(168).png'),
          fallbackImage: STORE_ASSETS.products.ceramicRoller,
          query: 'بوش داخل رولر',
        },
        {
          id: 'dr-2',
          title: 'چرخ‌دنده صنعتی',
          image: getProductImageUrl('e(549).png'),
          fallbackImage: STORE_ASSETS.categories.chains,
          query: 'چرخ دنده',
        },
        {
          id: 'dr-3',
          title: 'انگشتی رولر',
          image: getProductImageUrl('e(198).png'),
          fallbackImage: STORE_ASSETS.products.ceramicParts,
          query: 'انگشتی رولر',
        },
        {
          id: 'dr-4',
          title: 'بلبرینگ نسوز',
          image: getProductImageUrl('e(383).png'),
          fallbackImage: STORE_ASSETS.products.bearing,
          query: 'بلبرینگ',
        },
      ],
    },
    {
      id: 'press',
      number: '05',
      shortLabel: 'پرس و شکل‌دهی',
      title: 'پرس و شکل‌دهی',
      description: 'انتقال و موقعیت‌دهی بدنه کاشی، قطعات مکانیکی و لاستیکی مقاوم در برابر سایش و فشار',
      details:
        'در بخش پرس هیدرولیک و خطوط تغذیه و خروج بیسکویت خام، شوک‌های مکانیکی، گردوغبار پودر گرانول و نیاز به هم‌راستایی دقیق کاشی اهمیت حیاتی دارد. استفاده از پولی و کوپلینگ‌های بالانس‌شده، قطعات لاستیکی ضدسایش، رولیک و چرخ‌های روکش پلی‌یورتان و تسمه‌های انتقال دقیق، راندمان خط پرس را تضمین می‌کند.',
      image: STORE_ASSETS.industries.ceramic,
      hotspotX: '35%',
      hotspotY: '35%',
      query: 'پولی',
      popularParts: [
        {
          id: 'pr-1',
          title: 'پولی و کوپلینگ',
          image: STORE_ASSETS.categories.pulleys,
          fallbackImage: STORE_ASSETS.products.aluPulley,
          query: 'پولی',
        },
        {
          id: 'pr-2',
          title: 'قطعات لاستیکی',
          image: getProductImageUrl('e(648).png'),
          fallbackImage: STORE_ASSETS.products.ceramicParts,
          query: 'لاستیک',
        },
        {
          id: 'pr-3',
          title: 'رولیک و چرخ',
          image: getProductImageUrl('e(394).png'),
          fallbackImage: STORE_ASSETS.products.ceramicRoller,
          query: 'چرخ',
        },
        {
          id: 'pr-4',
          title: 'تسمه انتقال',
          image: STORE_ASSETS.products.pvcBelt,
          fallbackImage: STORE_ASSETS.categories.belts,
          query: 'تسمه',
        },
      ],
    },
    {
      id: 'kiln',
      number: '06',
      shortLabel: 'کوره',
      title: 'کوره پخت رولری و خط لعاب',
      description: 'هدایت یکنواخت کاشی و اسلب در دمای بالا با بوش‌ها، انگشتی‌های رولر، چرخ‌دنده‌ها و تسمه‌های نسوز.',
      details:
        'کوره پخت رولری قلب کارخانه کاشی و سرامیک است. هماهنگی چرخش رولرها، مقاومت حرارتی بوش‌ها و سیالیت بلبرینگ‌ها و تسمه‌های انتقال خط لعاب و چاپ دیجیتال، مانع تابیدگی یا شکست کاشی در کوره می‌شود.',
      image: STORE_ASSETS.products.ceramicRoller,
      hotspotX: '21%',
      hotspotY: '33%',
      query: 'رولر',
      popularParts: [
        {
          id: 'kl-1',
          title: 'بوش و انگشتی رولر',
          image: getProductImageUrl('e(185).png'),
          fallbackImage: STORE_ASSETS.products.ceramicRoller,
          query: 'بوش داخل رولر',
        },
        {
          id: 'kl-2',
          title: 'تسمه تایمینگ',
          image: STORE_ASSETS.products.forzaBelt,
          fallbackImage: STORE_ASSETS.categories.belts,
          query: 'تسمه تایمینگ',
        },
        {
          id: 'kl-3',
          title: 'ریل و گاید هدایت',
          image: getProductImageUrl('e(251).png'),
          fallbackImage: STORE_ASSETS.forzaSubFittings,
          query: 'ریل صنعتی',
        },
        {
          id: 'kl-4',
          title: 'برس خط لعاب',
          image: getProductImageUrl('e(714).png'),
          fallbackImage: STORE_ASSETS.products.ceramicParts,
          query: 'برس صنعتی',
        },
      ],
    },
    {
      id: 'sorting-packaging',
      number: '07',
      shortLabel: 'سورت و بسته‌بندی',
      title: 'پولیش، گونیاسازی، سورت و بسته‌بندی',
      description: 'برش و کالیبراسیون دقیق، جابه‌جایی کاشی با لاستیک‌های مکنده وکیوم و بسته‌بندی اتوماتیک کارتن و پالت.',
      details:
        'در انتهای خط تولید، دستگاه‌های پولیش و رکتیفای، خطوط سورتینگ و بازوهای استاکر وکیوم به برس‌های ساب، لاستیک‌های مکنده تک‌طبقه و دوطبقه، تسمه‌های تایمینگ روکش‌دار و ریل‌های صنعتی نیاز دارند.',
      image: STORE_ASSETS.industries.robotArm,
      hotspotX: '9%',
      hotspotY: '31%',
      query: 'لاستیک مکنده',
      popularParts: [
        {
          id: 'sp-1',
          title: 'لاستیک مکنده',
          image: getProductImageUrl('e(639).png'),
          fallbackImage: STORE_ASSETS.products.ceramicParts,
          query: 'لاستیک مکنده',
        },
        {
          id: 'sp-2',
          title: 'برس ساب و پرداخت',
          image: getProductImageUrl('e(710).png'),
          fallbackImage: STORE_ASSETS.products.ceramicParts,
          query: 'برس ساب',
        },
        {
          id: 'sp-3',
          title: 'ریل و پروفیل',
          image: getProductImageUrl('e(251).png'),
          fallbackImage: STORE_ASSETS.forzaSubFittings,
          query: 'ریل صنعتی',
        },
        {
          id: 'sp-4',
          title: 'چرخ پلی‌یورتان',
          image: getProductImageUrl('e(378).png'),
          fallbackImage: STORE_ASSETS.products.ceramicRoller,
          query: 'چرخ با روکش پلی یورتان',
        },
      ],
    },
  ];

  const activeStage =
    productionStages.find((stage) => stage.id === activeStageId) ||
    productionStages[4];

  // ---------------------------------------------------------------------------
  // 6 POPULAR CATEGORIES IN TILE & CERAMIC INDUSTRY
  // ---------------------------------------------------------------------------
  const popularCategories = [
    {
      id: 'cat-belts',
      title: 'تسمه‌های صنعتی',
      image: STORE_ASSETS.categories.belts,
      fallbackImage: STORE_ASSETS.products.forzaBelt,
      link: '/category/تسمه-و-انتقال-نیرو',
    },
    {
      id: 'cat-pulleys',
      title: 'پولی و کوپلینگ',
      image: STORE_ASSETS.categories.pulleys,
      fallbackImage: STORE_ASSETS.products.aluPulley,
      link: '/products?q=' + encodeURIComponent('پولی'),
    },
    {
      id: 'cat-rollers',
      title: 'چرخ و رولیک',
      image: getProductImageUrl('e(378).png'),
      fallbackImage: STORE_ASSETS.products.ceramicRoller,
      link: '/category/چرخ-و-رولر',
    },
    {
      id: 'cat-rubber',
      title: 'قطعات لاستیکی',
      image: getProductImageUrl('e(817).png'),
      fallbackImage: STORE_ASSETS.products.ceramicParts,
      link: '/category/آب‌بندی-و-قطعات-لاستیکی',
    },
    {
      id: 'cat-profiles',
      title: 'پروفیل و ریل‌ها',
      image: getProductImageUrl('e(251).png'),
      fallbackImage: STORE_ASSETS.forzaSubFittings,
      link: '/category/ریل-و-تجهیزات-هدایت',
    },
    {
      id: 'cat-misc',
      title: 'قطعات متفرقه',
      image: getProductImageUrl('e(168).png'),
      fallbackImage: STORE_ASSETS.forzaSubBearing,
      link: '/category/قطعات-مکانیکی',
    },
  ];

  // ---------------------------------------------------------------------------
  // 4 COMMON PRODUCTION LINE PROBLEMS & SOLUTIONS
  // ---------------------------------------------------------------------------
  const commonProblems: ProblemItem[] = [
    {
      id: 'prob-belt-wear',
      title: 'سایش سریع تسمه',
      subtitle: 'بررسی قطعات انتقال و راهکارهای پیشنهادی',
      image: STORE_ASSETS.industries.ceramic,
      symptom: 'پوسیدگی لبه‌ها، رد انداختن روی بدنه کاشی خام و کاهش عمر تسمه در خطوط لعاب، پرس و انتقال.',
      cause: 'اصطکاک مستقیم با پودر سیلیس و لبه‌های تیز بیسکویت کاشی، یا عدم هم‌راستایی پولی‌ها و رولیک‌های هدایت.',
      solution: 'استفاده از تسمه‌های تایمینگ PU سیم‌دار با روکش ضدسایش لیناتکس و بررسی هم‌محوری پولی‌های آلومینیومی و هرزگردها.',
      recommendedQuery: 'تسمه تایمینگ',
    },
    {
      id: 'prob-roller-break',
      title: 'شکستگی چرخ و رولیک',
      subtitle: 'معرفی رولیک مقاوم و جایگزین',
      image: STORE_ASSETS.industries.manufacturing,
      symptom: 'ترک‌خوردگی روکش چرخ‌ها، قفل شدن بلبرینگ داخل رولر و ایجاد ضربه در حرکت کاشی و اسلب.',
      cause: 'بار دینامیکی بیش از حد، نفوذ گردوغبار سرامیک و آب به داخل بلبرینگ یا استفاده از پلیمرهای خشک و غیراستاندارد.',
      solution: 'جایگزینی با چرخ‌های روکش پلی‌یورتان توپی فلزی بلبرینگ‌دار و بوش‌های داخل رولر تقویت‌شده مقاوم به سایش و حرارت.',
      recommendedQuery: 'چرخ با روکش پلی یورتان',
    },
    {
      id: 'prob-tile-misalignment',
      title: 'انحراف کاشی در خط انتقال',
      subtitle: 'بررسی رولیک و سیستم هدایت',
      image: STORE_ASSETS.industries.food,
      symptom: 'کج شدن کاشی هنگام ورود به دستگاه چاپ دیجیتال، خط لعاب یا کالیبراسیون و لب‌پر شدن گوشه‌ها.',
      cause: 'فرسایش نامتقارن ریل‌ها و گایدهای کناری، اختلاف قطر رولیک‌های موازی یا کشیدگی غیریکنواخت تسمه‌های موازی.',
      solution: 'نصب ریل‌های صنعتی ضدسایش با تلرانس دقیق، کالیبره کردن چرخ‌های تفلونی هرزگرد و استفاده از تسمه‌های جفت‌شده (Matched Pair).',
      recommendedQuery: 'ریل صنعتی',
    },
    {
      id: 'prob-line-downtime',
      title: 'توقف ناگهانی خط تولید',
      subtitle: 'بررسی قطعات انتقال و راهکارهای پیشگیرانه',
      image: STORE_ASSETS.industries.bgPlant,
      symptom: 'پارگی ناگهانی تسمه یا شکست کوپلینگ و توقف اضطراری خط پرس، خشک‌کن یا بسته‌بندی.',
      cause: 'شوک‌های گشتاوری بالا، فرسودگی لاستیک کوپلینگ و عدم جایگزینی به‌موقع قطعات ضربه‌گیر و انتقال قدرت.',
      solution: 'تأمین پیشگیرانه کوپلینگ‌های صنعتی، لاستیک‌های کوپلینگ ضدضربه، تسمه‌های فورزا (FORZA) و پولی‌های بالانس‌شده.',
      recommendedQuery: 'کوپلینگ صنعتی',
    },
  ];

  // ---------------------------------------------------------------------------
  // 6 RECOMMENDED PRODUCTS FOR TILE & CERAMIC INDUSTRY
  // ---------------------------------------------------------------------------
  const recommendedProducts: RecommendedProductItem[] = [
    {
      code: 'FAM-35245',
      name: 'چرخ صنعتی',
      subtitle: 'تحمل بار بالا و طول عمر زیاد',
      spec: 'قطر: 50 - 200 mm',
      image: getProductImageUrl('e(378).png'),
      fallbackImage: STORE_ASSETS.products.ceramicRoller,
      query: 'چرخ با روکش پلی یورتان',
    },
    {
      code: 'FAM-80274',
      name: 'لاستیک ضربه‌گیر',
      subtitle: 'مقاوم به سایش و ضربه',
      spec: 'سفارشی‌سازی ابعاد',
      image: getProductImageUrl('e(817).png'),
      fallbackImage: STORE_ASSETS.products.ceramicParts,
      query: 'ضربه‌گیر صنعتی',
    },
    {
      code: 'FAM-41680',
      name: 'پولی آلومینیومی',
      subtitle: 'دقت بالا و وزن سبک',
      spec: 'قطر: 50 - 500 mm',
      image: STORE_ASSETS.products.aluPulley,
      fallbackImage: getProductImageUrl('e(165).png'),
      query: 'پولی',
    },
    {
      code: 'FAM-BELT-TIM',
      name: 'تسمه تایم صنعتی',
      subtitle: 'مقاوم در دماهای بالا',
      spec: 'گام: 200 mm - حرارت',
      image: STORE_ASSETS.products.forzaBelt,
      fallbackImage: STORE_ASSETS.categories.belts,
      query: 'تسمه تایمینگ',
    },
    {
      code: 'FAM-40932',
      name: 'رولیک نقاله',
      subtitle: 'مناسب خطوط انتقال کاشی',
      spec: 'قطر: 20 - 120 mm',
      image: STORE_ASSETS.products.ceramicRoller,
      fallbackImage: getProductImageUrl('e(168).png'),
      query: 'رولر',
    },
    {
      code: 'FAM-52858',
      name: 'تسمه نوار نقاله PVC',
      subtitle: 'مقاوم به سایش و مواد شیمیایی',
      spec: 'عرض: 50 - 1000 mm',
      image: STORE_ASSETS.products.pvcBelt,
      fallbackImage: getProductImageUrl('e(859).png'),
      query: 'نوار نقاله',
    },
  ];

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const handleTechSpecSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = techSpecQuery.trim() || 'تسمه';
    navigate(`/products?q=${encodeURIComponent(q)}`);
  };

  const handleProblemSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = machineProblemQuery.trim() || 'سایش تسمه در خط کاشی';
    navigate(`/ai-consult?industry=ceramic&q=${encodeURIComponent(q)}`);
  };

  const openRfqModal = (itemTitle: string) => {
    setRfqItemName(itemTitle);
    setRfqSubmitted(false);
    setRfqModalOpen(true);
  };

  const handleRfqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfqPhone.trim()) return;
    setRfqSubmitted(true);
    setTimeout(() => {
      setRfqModalOpen(false);
      setRfqSubmitted(false);
      setRfqCustomerName('');
      setRfqPhone('');
      setRfqFactory('');
      setRfqNote('');
    }, 2800);
  };

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-[#2D3036] font-sans pb-16" dir="rtl">
      {/* ========================================================================= */}
      {/* 1. HERO BANNER SECTION (باکس روشن سمت چپ و تصویر خط تولید + آمار سمت راست) */}
      {/* ========================================================================= */}
      <section id="ceramic-hero" className="relative w-full overflow-hidden border-b border-slate-200/80 bg-[#23262B]">
        {/* Background Factory Production Line Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={STORE_ASSETS.industries.ceramic}
            alt="خط تولید کاشی و سرامیک"
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/35 via-black/20 to-black/45" />
        </div>

        <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end min-h-[420px] sm:min-h-[460px]">
            {/* RIGHT COLUMN IN RTL (Factory View + Bottom Dark Stats Bar) */}
            <div className="lg:col-span-7 flex flex-col justify-end h-full order-2 lg:order-1">
              <div className="w-full sm:w-auto self-start bg-[#1E2024]/88 backdrop-blur-md text-white rounded-2xl border border-white/15 px-5 sm:px-8 py-4 shadow-xl">
                <div className="grid grid-cols-3 gap-4 sm:gap-8 divide-x divide-x-reverse divide-white/15">
                  {/* Stat 1 */}
                  <div className="flex items-center gap-3 pr-0 pl-2 sm:pl-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-orange-400">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <div className="text-lg sm:text-2xl font-black tracking-tight tabular-nums text-white" dir="ltr">
                        +20
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-300 font-medium whitespace-nowrap">
                        سال تجربه صنعتی
                      </div>
                    </div>
                  </div>

                  {/* Stat 2 */}
                  <div className="flex items-center gap-3 pr-4 sm:pr-6 pl-2 sm:pl-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-orange-400">
                      <Factory className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <div className="text-lg sm:text-2xl font-black tracking-tight tabular-nums text-white" dir="ltr">
                        +120
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-300 font-medium whitespace-nowrap">
                        کارخانه فعال
                      </div>
                    </div>
                  </div>

                  {/* Stat 3 */}
                  <div className="flex items-center gap-3 pr-4 sm:pr-6">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-orange-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <div className="text-lg sm:text-2xl font-black tracking-tight tabular-nums text-white" dir="ltr">
                        +5,000
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-300 font-medium whitespace-nowrap">
                        قطعه مرتبط
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* LEFT COLUMN IN RTL (Frosted White Hero Card matching reference image) */}
            <div className="lg:col-span-5 order-1 lg:order-2">
              <div className="bg-white/92 backdrop-blur-xl rounded-3xl border border-white/80 shadow-[0_20px_50px_rgba(0,0,0,0.18)] p-6 sm:p-8 text-right space-y-5">
                {/* Breadcrumb */}
                <nav
                  aria-label="مسیر صفحه"
                  className="flex items-center gap-2 text-xs font-medium text-slate-500"
                >
                  <Link to="/" className="hover:text-[#E06518] transition-colors">
                    خانه
                  </Link>
                  <span className="text-slate-300">|</span>
                  <Link to="/industries" className="hover:text-[#E06518] transition-colors">
                    صنایع هدف
                  </Link>
                  <span className="text-slate-300">|</span>
                  <span className="font-bold text-slate-800">صنعت کاشی و سرامیک</span>
                </nav>

                {/* Main Title */}
                <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-[#23262B] leading-[1.35] tracking-tight">
                  تأمین <span className="text-[#E06518]">تخصصی قطعات</span>
                  <span className="block mt-1">خطوط تولید کاشی و سرامیک</span>
                </h1>

                {/* Subtitle */}
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  از انتقال مواد اولیه تا بسته‌بندی نهایی
                  <br />
                  با قطعات باکیفیت و خدمات فنی صنعت پیش
                </p>

                {/* Two CTA Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <Link
                    to="/ai-consult?industry=ceramic"
                    className="h-11 px-4 rounded-xl border-2 border-[#E06518]/80 bg-white hover:bg-orange-50 text-[#E06518] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>مشاوره تخصصی FORZA</span>
                  </Link>

                  <a
                    href="#ceramic-recommended-products"
                    className="h-11 px-4 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 transition-all whitespace-nowrap"
                  >
                    <Search className="w-4 h-4 shrink-0" />
                    <span>جستجوی قطعات</span>
                  </a>
                </div>

                {/* 4 Bottom Trust Items inside Hero Card */}
                <div className="pt-4 border-t border-slate-200/80 grid grid-cols-4 gap-2 divide-x divide-x-reverse divide-slate-200/80 text-center">
                  <div className="px-1 flex flex-col items-center gap-1.5">
                    <ShieldCheck className="w-5 h-5 text-slate-600" />
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 leading-tight">
                      پوشش کامل
                      <br />
                      خطوط تولید
                    </span>
                  </div>

                  <div className="px-1 flex flex-col items-center gap-1.5">
                    <Clock className="w-5 h-5 text-slate-600" />
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 leading-tight">
                      تأمین سریع و
                      <br />
                      مطمئن
                    </span>
                  </div>

                  <div className="px-1 flex flex-col items-center gap-1.5">
                    <HelpCircle className="w-5 h-5 text-slate-600" />
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 leading-tight">
                      مشاوره فنی و
                      <br />
                      انتخاب قطعه
                    </span>
                  </div>

                  <div className="px-1 flex flex-col items-center gap-1.5">
                    <RefreshCw className="w-5 h-5 text-slate-600" />
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 leading-tight">
                      پوشش کامل
                      <br />و جایگزین
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT CONTAINER */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        {/* ========================================================================= */}
        {/* 2. EXPLORE PRODUCTION LINE (کاوش خط تولید کاشی و سرامیک)                  */}
        {/* ========================================================================= */}
        <section id="ceramic-production-line" className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-8 space-y-6">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5 text-right">
              <h2 className="text-xl sm:text-2xl font-black text-[#23262B]">
                کاوش خط تولید کاشی و سرامیک
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                روی هر مرحله کلیک کنید تا قطعات مرتبط و توضیحات فنی را مشاهده کنید.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setVideoModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-orange-200 bg-orange-50/50 hover:bg-orange-50 text-[#E06518] text-xs font-bold transition-colors cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-md bg-[#E06518]/15 flex items-center justify-center">
                    <Play className="w-3 h-3 fill-[#E06518] text-[#E06518]" />
                  </span>
                  <span>نمایش ویدیوی خط تولید</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive 3D Isometric Production Line Diagram */}
          <div className="relative w-full pt-2 pb-4 overflow-x-auto">
            <div className="min-w-[860px] relative">
              {/* Custom High-Detail Isometric 3D Ceramic Production Line SVG */}
              <div className="relative w-full h-[230px] sm:h-[260px] rounded-2xl bg-gradient-to-b from-slate-50/70 via-white to-slate-50/90 border border-slate-100 overflow-hidden">
                <svg
                  viewBox="0 0 1200 280"
                  className="w-full h-full select-none"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Subtle Isometric Technical Floor Grid */}
                  <defs>
                    <pattern id="isoGrid" width="40" height="24" patternUnits="userSpaceOnUse">
                      <path
                        d="M 0 12 L 20 0 L 40 12 L 20 24 Z"
                        fill="none"
                        stroke="#E2E8F0"
                        strokeWidth="0.7"
                      />
                    </pattern>
                    <linearGradient id="machineBody" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F8FAFC" />
                      <stop offset="100%" stopColor="#CBD5E1" />
                    </linearGradient>
                    <linearGradient id="machineSide" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#94A3B8" />
                      <stop offset="100%" stopColor="#64748B" />
                    </linearGradient>
                    <linearGradient id="kilnGlow" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#EA580C" />
                      <stop offset="50%" stopColor="#F97316" />
                      <stop offset="100%" stopColor="#EA580C" />
                    </linearGradient>
                  </defs>

                  <rect x="0" y="0" width="1200" height="280" fill="url(#isoGrid)" opacity="0.65" />

                  {/* Continuous Conveyor Line Track Base (Right x=1130 to Left x=60) */}
                  <path
                    d="M 1140 185 L 65 135 L 85 118 L 1155 168 Z"
                    fill="#E2E8F0"
                    stroke="#94A3B8"
                    strokeWidth="1.5"
                  />
                  {/* Conveyor Support Legs */}
                  {[120, 220, 320, 420, 520, 620, 720, 820, 920, 1020, 1100].map((lx, idx) => {
                    const ly = 136 + ((lx - 65) / 1075) * 48;
                    return (
                      <g key={idx}>
                        <line x1={lx} y1={ly} x2={lx} y2={ly + 32} stroke="#64748B" strokeWidth="3" />
                        <line x1={lx + 14} y1={ly - 8} x2={lx + 14} y2={ly + 24} stroke="#94A3B8" strokeWidth="2.5" />
                      </g>
                    );
                  })}

                  {/* Ceramic Tiles Moving Along the Conveyor Track */}
                  {[150, 290, 445, 595, 760, 930].map((tx, idx) => {
                    const ty = 132 + ((tx - 65) / 1075) * 48;
                    return (
                      <polygon
                        key={idx}
                        points={`${tx},${ty} ${tx + 34},${ty + 2} ${tx + 42},${ty - 5} ${tx + 8},${ty - 7}`}
                        fill="#E7D8C5"
                        stroke="#C2A887"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* ========================================================= */}
                  {/* STAGE 01 (Far Right x=1040..1150): Raw Material Hoppers    */}
                  {/* ========================================================= */}
                  <g>
                    {/* Silo 1 */}
                    <rect x="1085" y="105" width="46" height="55" rx="4" fill="url(#machineBody)" stroke="#64748B" strokeWidth="1.5" />
                    <polygon points="1085,160 1131,160 1116,182 1100,182" fill="url(#machineSide)" stroke="#475569" strokeWidth="1.2" />
                    <ellipse cx="1108" cy="105" rx="23" ry="7" fill="#E2E8F0" stroke="#64748B" strokeWidth="1.5" />
                    {/* Silo 2 */}
                    <rect x="1032" y="112" width="44" height="50" rx="4" fill="url(#machineBody)" stroke="#64748B" strokeWidth="1.5" />
                    <polygon points="1032,162 1076,162 1063,180 1045,180" fill="url(#machineSide)" stroke="#475569" strokeWidth="1.2" />
                    {/* Inclined Belt Conveyor */}
                    <path d="M 1040 168 L 965 135 L 972 128 L 1047 161 Z" fill="#475569" />
                  </g>

                  {/* ========================================================= */}
                  {/* STAGE 02 (x=880..985): Spray Dryer & Ball Mill            */}
                  {/* ========================================================= */}
                  <g>
                    {/* Spray Dryer Cylinder Tower */}
                    <rect x="900" y="75" width="58" height="82" rx="8" fill="url(#machineBody)" stroke="#475569" strokeWidth="1.6" />
                    <ellipse cx="929" cy="75" rx="29" ry="8" fill="#F1F5F9" stroke="#475569" strokeWidth="1.5" />
                    <polygon points="900,157 958,157 940,182 918,182" fill="#64748B" stroke="#475569" strokeWidth="1.4" />
                    {/* Structural Frame */}
                    <line x1="896" y1="85" x2="896" y2="184" stroke="#475569" strokeWidth="2.5" />
                    <line x1="962" y1="85" x2="962" y2="184" stroke="#475569" strokeWidth="2.5" />
                    <rect x="912" y="102" width="34" height="16" rx="2" fill="#E06518" opacity="0.85" />
                  </g>

                  {/* ========================================================= */}
                  {/* STAGE 03 (x=710..835): Final Milling & Screening          */}
                  {/* ========================================================= */}
                  <g>
                    <polygon points="720,105 820,110 835,96 735,91" fill="#F8FAFC" stroke="#64748B" strokeWidth="1.5" />
                    <polygon points="720,105 820,110 820,165 720,160" fill="url(#machineBody)" stroke="#64748B" strokeWidth="1.5" />
                    <polygon points="820,110 835,96 835,151 820,165" fill="url(#machineSide)" stroke="#475569" strokeWidth="1.5" />
                    {/* Control Panels & Pipes */}
                    <rect x="735" y="118" width="22" height="30" rx="2" fill="#E2E8F0" stroke="#64748B" strokeWidth="1.2" />
                    <rect x="768" y="120" width="36" height="22" rx="2" fill="#334155" />
                    <circle cx="746" cy="128" r="3" fill="#E06518" />
                  </g>

                  {/* ========================================================= */}
                  {/* STAGE 04 (x=530..675): Vertical / Horizontal Dryer        */}
                  {/* ========================================================= */}
                  <g>
                    <polygon points="535,70 655,76 675,60 555,54" fill="#F8FAFC" stroke="#64748B" strokeWidth="1.5" />
                    <polygon points="535,70 655,76 655,158 535,152" fill="url(#machineBody)" stroke="#64748B" strokeWidth="1.5" />
                    <polygon points="655,76 675,60 675,142 655,158" fill="url(#machineSide)" stroke="#475569" strokeWidth="1.5" />
                    {/* Vertical Dryer Columns & vents */}
                    {[552, 582, 612, 638].map((vx, i) => (
                      <line key={i} x1={vx} y1="74" x2={vx} y2="154" stroke="#94A3B8" strokeWidth="1.5" />
                    ))}
                    <rect x="562" y="96" width="24" height="14" rx="2" fill="#1E293B" />
                    <rect x="605" y="98" width="24" height="14" rx="2" fill="#E06518" />
                  </g>

                  {/* ========================================================= */}
                  {/* STAGE 05 (x=375..500): Hydraulic Tile Press (Highlighted) */}
                  {/* ========================================================= */}
                  <g>
                    {/* Tall Hydraulic Press Arch */}
                    <polygon points="405,42 475,46 492,32 422,28" fill="#FFFFFF" stroke="#475569" strokeWidth="1.8" />
                    <polygon points="405,42 475,46 475,152 405,148" fill="url(#machineBody)" stroke="#475569" strokeWidth="1.8" />
                    <polygon points="475,46 492,32 492,138 475,152" fill="url(#machineSide)" stroke="#334155" strokeWidth="1.8" />
                    {/* Hydraulic Cylinder Top */}
                    <ellipse cx="448" cy="36" rx="16" ry="6" fill="#E06518" />
                    <rect x="432" y="20" width="32" height="16" rx="3" fill="#334155" />
                    {/* Press Opening & Die Mold */}
                    <rect x="418" y="88" width="44" height="36" rx="3" fill="#1E293B" stroke="#E06518" strokeWidth="1.8" />
                    <rect x="424" y="96" width="32" height="10" fill="#F97316" />
                    {/* Active Highlight Ring on Floor under Stage 05 */}
                    {activeStage.id === 'press' && (
                      <ellipse
                        cx="440"
                        cy="162"
                        rx="58"
                        ry="18"
                        fill="#E06518"
                        fillOpacity="0.12"
                        stroke="#E06518"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                    )}
                  </g>

                  {/* ========================================================= */}
                  {/* STAGE 06 (x=195..355): Multi-Zone Roller Hearth Kiln      */}
                  {/* ========================================================= */}
                  <g>
                    <polygon points="200,82 342,90 360,74 218,66" fill="#F1F5F9" stroke="#475569" strokeWidth="1.6" />
                    <polygon points="200,82 342,90 342,146 200,138" fill="url(#machineBody)" stroke="#475569" strokeWidth="1.6" />
                    <polygon points="342,90 360,74 360,130 342,146" fill="url(#machineSide)" stroke="#334155" strokeWidth="1.6" />
                    {/* Kiln Exhaust Pipes */}
                    {[225, 265, 305].map((kx, i) => (
                      <g key={i}>
                        <rect x={kx} y="52" width="10" height="24" rx="2" fill="#64748B" stroke="#334155" strokeWidth="1.2" />
                        <ellipse cx={kx + 5} cy="52" rx="5" ry="2" fill="#94A3B8" />
                      </g>
                    ))}
                    {/* Glowing Roller Kiln Firing Strip */}
                    <line x1="208" y1="118" x2="334" y2="125" stroke="url(#kilnGlow)" strokeWidth="5" strokeLinecap="round" />
                    {/* Roller ends along kiln wall */}
                    {[215, 230, 245, 260, 275, 290, 305, 320].map((rx, i) => (
                      <circle key={i} cx={rx} cy={128 + i * 0.8} r="2.5" fill="#334155" />
                    ))}
                  </g>

                  {/* ========================================================= */}
                  {/* STAGE 07 (Far Left x=45..180): Sorting & Packaging Line   */}
                  {/* ========================================================= */}
                  <g>
                    {/* Gantry Frame */}
                    <polygon points="58,68 165,75 180,61 73,54" fill="#E2E8F0" stroke="#475569" strokeWidth="1.5" />
                    <polygon points="58,68 165,75 165,136 58,129" fill="url(#machineBody)" stroke="#475569" strokeWidth="1.5" />
                    {/* Vacuum Stacker Arm & Pallet */}
                    <rect x="82" y="84" width="38" height="28" rx="3" fill="#334155" />
                    <rect x="130" y="90" width="24" height="32" rx="2" fill="#E06518" opacity="0.9" />
                    {/* Stacked Tile Pallets at Left End */}
                    <rect x="32" y="112" width="22" height="24" rx="2" fill="#D97706" stroke="#92400E" strokeWidth="1.2" />
                  </g>
                </svg>

                {/* Interactive Hotspot Number Badges (01 to 07) Positioned on Diagram */}
                {productionStages.map((stage) => {
                  const isSelected = stage.id === activeStage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => handleSelectStage(stage.id)}
                      style={{ left: stage.hotspotX, top: stage.hotspotY }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer focus:outline-none transition-transform duration-200 ${
                        isSelected ? 'scale-115' : 'hover:scale-110'
                      }`}
                      aria-label={`مرحله ${stage.number}: ${stage.title}`}
                    >
                      <span
                        className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full font-mono text-xs sm:text-sm font-black shadow-lg transition-all ${
                          isSelected
                            ? 'bg-[#E06518] text-white ring-4 ring-[#E06518]/30 shadow-orange-500/40'
                            : 'bg-[#E06518] text-white/95 ring-2 ring-white hover:ring-orange-300'
                        }`}
                      >
                        {stage.number}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Stage Labels Strip Below Diagram (01 to 07 from Right to Left) */}
              <div className="grid grid-cols-7 gap-2 pt-3 relative">
                {productionStages.map((stage) => {
                  const isSelected = stage.id === activeStage.id;
                  return (
                    <div key={stage.id} className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => handleSelectStage(stage.id)}
                        className={`w-full py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
                          isSelected
                            ? 'bg-white text-[#23262B] font-black shadow-md border-2 border-[#E06518]'
                            : 'bg-slate-100/90 hover:bg-slate-200/75 text-slate-700 border border-slate-200/80'
                        }`}
                      >
                        {stage.shortLabel}
                      </button>

                      {/* Dotted Connector Line to Active Stage Detail Box */}
                      {isSelected && (
                        <div className="flex flex-col items-center mt-1 -mb-5 z-10">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#E06518] ring-4 ring-orange-100" />
                          <span className="w-0.5 h-4 border-r-2 border-dashed border-[#E06518]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile & Tablet Direct Stage Selector Pills (No Horizontal Scroll Needed) */}
          <div className="lg:hidden grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {productionStages.map((stage) => {
              const isSelected = stage.id === activeStage.id;
              return (
                <button
                  key={`mobile-stage-${stage.id}`}
                  type="button"
                  onClick={() => handleSelectStage(stage.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer text-right ${
                    isSelected
                      ? 'bg-[#FFF5EE] text-[#23262B] font-black border-2 border-[#E06518] shadow-xs'
                      : 'bg-slate-100/90 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full font-mono text-[11px] font-black flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[#E06518] text-white'
                        : 'bg-white text-[#E06518] border border-orange-200'
                    }`}
                  >
                    {stage.number}
                  </span>
                  <span className="truncate">{stage.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Stage Detail Panel (3 Columns matching reference design) */}
          <div
            ref={stageDetailRef}
            id="ceramic-stage-detail"
            className={`rounded-2xl bg-[#F9FAFB] border p-4 sm:p-6 transition-all duration-300 scroll-mt-24 ${
              stageHighlightPulse
                ? 'border-[#E06518] ring-2 ring-[#E06518]/20 shadow-md'
                : 'border-slate-200/90'
            }`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Column 1 (Right in RTL): Stage Title, Description & CTAs */}
              <div className="lg:col-span-4 space-y-4 text-right">
                <div className="flex items-center gap-2.5">
                  <span className="w-1 h-6 rounded-full bg-[#E06518]" />
                  <div>
                    <span className="block text-[11px] font-bold text-[#E06518]">
                      مرحله {activeStage.number} از ۰۷ خط تولید
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-[#23262B]">
                      {activeStage.title}
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  {activeStage.description}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <Link
                    to={`/products?q=${encodeURIComponent(activeStage.query)}`}
                    className="h-10 px-5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap"
                  >
                    <Layers className="w-4 h-4" />
                    <span>مشاهده قطعات مرتبط</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setStageInfoModalOpen(true)}
                    className="text-xs font-bold text-[#E06518] hover:text-[#C95210] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>اطلاعات بیشتر</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Column 2 (Center): Stage Close-Up Industrial Photo */}
              <div className="lg:col-span-4">
                <div className="w-full h-44 sm:h-48 rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100">
                  <img
                    src={activeStage.image}
                    alt={activeStage.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* Column 3 (Left in RTL): Popular Parts of This Stage (4 mini cards) */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-[#23262B]">
                    قطعات پرکاربرد این مرحله
                  </h4>
                  <Link
                    to={`/products?q=${encodeURIComponent(activeStage.query)}`}
                    className="text-xs font-bold text-[#E06518] hover:text-[#C95210] flex items-center gap-0.5 transition-colors"
                  >
                    <span>مشاهده همه</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {activeStage.popularParts.map((part) => (
                    <Link
                      key={part.id}
                      to={`/products?q=${encodeURIComponent(part.query)}`}
                      className="group bg-white hover:bg-orange-50/40 rounded-xl border border-slate-200/90 hover:border-[#E06518]/60 p-2.5 flex flex-col items-center text-center transition-all shadow-2xs"
                    >
                      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-lg bg-slate-50 flex items-center justify-center p-1.5 overflow-hidden mb-2">
                        <img
                          src={part.image}
                          alt={part.title}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = part.fallbackImage;
                          }}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#E06518] transition-colors line-clamp-1">
                        {part.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. THREE SMART WAYS TO FIND PARTS (سه روش هوشمند برای پیدا کردن قطعه)     */}
        {/* ========================================================================= */}
        <section id="ceramic-smart-ways" className="space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-[#23262B] text-right">
            سه روش هوشمند برای پیدا کردن قطعه مورد نیاز
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Card 1 (Right in RTL): Visual Part Identification (Highlighted Orange Tint) */}
            <div className="rounded-2xl bg-[#FFF6EE] border border-[#F6C39E] p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#FDE6D2] border border-[#F5B686] text-[#E06518] flex items-center justify-center shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="text-right space-y-1">
                  <h3 className="text-sm sm:text-base font-black text-[#23262B]">
                    شناسایی قطعه از روی تصویر
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    عکس قطعه را بارگذاری کنید تا مشابه موجود را پیشنهاد دهیم
                  </p>
                </div>
              </div>

              <PartIdentificationLink
                to="/identify-part"
                className="w-full h-11 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>بارگذاری قطعه تصویر</span>
              </PartIdentificationLink>
            </div>

            {/* Card 2 (Middle): Search by Technical Specifications */}
            <div className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <div className="text-right space-y-1">
                  <h3 className="text-sm sm:text-base font-black text-[#23262B]">
                    جستجو با مشخصات فنی
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    نام قطعه، ابعاد، جنس یا مدل دستگاه را وارد کنید.
                  </p>
                </div>
              </div>

              <form onSubmit={handleTechSpecSearch} className="relative w-full">
                <input
                  type="text"
                  value={techSpecQuery}
                  onChange={(e) => setTechSpecQuery(e.target.value)}
                  placeholder="مثال: تسمه عرض 50 میلی‌متر، مقاوم به حرارت ..."
                  className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 pr-3.5 pl-10 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#E06518] focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  aria-label="جستجو با مشخصات فنی"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-[#E06518] hover:bg-orange-50 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Card 3 (Left in RTL): Search by Machine Problem */}
            <div className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div className="text-right space-y-1">
                  <h3 className="text-sm sm:text-base font-black text-[#23262B]">
                    جستجو با مشکل دستگاه
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    مشکل خط تولید را توصیف کنید تا قطعات پیشنهادی را دریافت کنید.
                  </p>
                </div>
              </div>

              <form onSubmit={handleProblemSearch} className="relative w-full">
                <input
                  type="text"
                  value={machineProblemQuery}
                  onChange={(e) => setMachineProblemQuery(e.target.value)}
                  placeholder="مثال: تسمه نوار نقاله سریع دچار سایش می‌شود ..."
                  className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 pr-3.5 pl-10 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#E06518] focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  aria-label="جستجو با مشکل دستگاه"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-slate-600 hover:text-[#E06518] hover:bg-orange-50 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. POPULAR PART CATEGORIES (دسته‌بندی قطعات پرکاربرد در صنعت کاشی و سرامیک) */}
        {/* ========================================================================= */}
        <section id="ceramic-popular-categories" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black text-[#23262B]">
              دسته‌بندی قطعات پرکاربرد در صنعت کاشی و سرامیک
            </h2>
            <Link
              to="/categories"
              className="text-xs font-bold text-[#E06518] hover:text-[#C95210] flex items-center gap-1 transition-colors"
            >
              <span>مشاهده همه دسته‌بندی‌ها</span>
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {popularCategories.map((cat) => (
              <Link
                key={cat.id}
                to={cat.link}
                className="group bg-white rounded-2xl border border-slate-200/90 hover:border-[#E06518]/60 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                <div className="w-full h-32 sm:h-36 bg-slate-50/70 p-3 flex items-center justify-center overflow-hidden">
                  <img
                    src={cat.image}
                    alt={cat.title}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = cat.fallbackImage;
                    }}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="px-3.5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs sm:text-[13px] font-extrabold text-[#23262B] group-hover:text-[#E06518] transition-colors truncate">
                    {cat.title}
                  </span>
                  <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-[#E06518] group-hover:-translate-x-0.5 transition-all shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. FORZA SPECIALIST CONSULT + COMMON PRODUCTION LINE PROBLEMS             */}
        {/* ========================================================================= */}
        <section id="ceramic-forza-problems" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Right Column in RTL (4 cols): مشاوره تخصصی FORZA */}
          <div className="lg:col-span-4 rounded-2xl bg-gradient-to-b from-white via-[#F5F8FC] to-[#E9EFF8] border border-slate-200/90 p-6 flex flex-col justify-between shadow-xs relative overflow-hidden">
            <div className="space-y-2 text-right relative z-10">
              <h3 className="text-lg sm:text-xl font-black text-[#23262B]">
                مشاوره تخصصی FORZA
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                با کمک هوش مصنوعی و دانش فنی صنعت پیش بهترین قطعه را برای خط تولید خود انتخاب کنید.
              </p>
            </div>

            <div className="grid grid-cols-12 gap-2 items-center my-4 relative z-10">
              {/* Checklist on Right */}
              <ul className="col-span-7 space-y-2.5 text-right">
                {[
                  'پاسخ به سوالات فنی',
                  'مقایسه قطعات مشابه',
                  'پیشنهاد جایگزین',
                  'استعلام قیمت و موجودی',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-[#E06518] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* 3D FORZA Robot Image on Left */}
              <div className="col-span-5 flex items-center justify-center">
                <img
                  src={STORE_ASSETS.aiConsultRobot}
                  alt="دستیار هوشمند FORZA"
                  className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-md rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <Link
              to="/ai-consult?industry=ceramic"
              className="relative z-10 w-full h-11 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>شروع گفتگو با FORZA</span>
            </Link>
          </div>

          {/* Left Column in RTL (8 cols): مشکلات رایج در خط تولید و راهکارهای پیشنهادی */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-black text-[#23262B]">
                مشکلات رایج در خط تولید و راهکارهای پیشنهادی
              </h3>
              <Link
                to="/ai-consult?industry=ceramic"
                className="text-xs font-bold text-[#E06518] hover:text-[#C95210] flex items-center gap-1 transition-colors"
              >
                <span>مشاهده همه</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
              {commonProblems.map((prob) => (
                <button
                  key={prob.id}
                  type="button"
                  onClick={() => setSelectedProblem(prob)}
                  className="group text-right bg-[#F9FAFB] hover:bg-white rounded-2xl border border-slate-200/80 hover:border-[#E06518]/60 hover:shadow-md transition-all overflow-hidden flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-full h-28 sm:h-32 overflow-hidden bg-slate-200">
                      <img
                        src={prob.image}
                        alt={prob.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-3.5 space-y-1.5">
                      <h4 className="text-xs sm:text-[13px] font-black text-[#23262B] group-hover:text-[#E06518] transition-colors">
                        {prob.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                        {prob.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="px-3.5 pb-3 flex items-center justify-end">
                    <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-[#E06518] group-hover:-translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. RECOMMENDED PRODUCTS (محصولات پیشنهادی برای صنعت کاشی و سرامیک)         */}
        {/* ========================================================================= */}
        <section id="ceramic-recommended-products" className="space-y-4 scroll-mt-20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black text-[#23262B]">
              محصولات پیشنهادی برای صنعت کاشی و سرامیک
            </h2>
            <Link
              to="/products"
              className="text-xs font-bold text-[#E06518] hover:text-[#C95210] flex items-center gap-1 transition-colors"
            >
              <span>مشاهده همه محصولات</span>
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {recommendedProducts.map((item) => {
              const wished = isInWishlist(item.code);
              return (
                <div
                  key={item.code}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-orange-300 shadow-2xs hover:shadow-md transition-all p-4 flex flex-col justify-between relative group"
                >
                  {/* Wishlist Heart Icon (Top Left) */}
                  <button
                    type="button"
                    onClick={() => toggleWishlist(item.code)}
                    aria-label={`افزودن ${item.name} به علاقه‌مندی‌ها`}
                    className="absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-slate-50 hover:bg-orange-50 flex items-center justify-center text-slate-400 hover:text-[#E06518] transition-colors cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        wished ? 'fill-[#E06518] text-[#E06518]' : ''
                      }`}
                    />
                  </button>

                  {/* Product Studio Image */}
                  <div>
                    <Link
                      to={`/products?q=${encodeURIComponent(item.query)}`}
                      className="w-full h-32 sm:h-36 flex items-center justify-center p-2 mb-3 overflow-hidden"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = item.fallbackImage;
                        }}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                        referrerPolicy="no-referrer"
                      />
                    </Link>

                    {/* Title & Subtitle */}
                    <div className="text-center space-y-1 mb-3">
                      <Link
                        to={`/products?q=${encodeURIComponent(item.query)}`}
                        className="block text-sm font-black text-[#23262B] hover:text-[#E06518] transition-colors"
                      >
                        {item.name}
                      </Link>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {item.subtitle}
                      </p>
                      <div className="pt-1 flex items-center justify-center gap-1 text-[11px] text-slate-600 font-medium">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.spec}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Inquiry Button */}
                  <button
                    type="button"
                    onClick={() => openRfqModal(`${item.name} (${item.spec})`)}
                    className="w-full h-9 rounded-xl border border-[#E06518]/75 text-[#E06518] hover:bg-[#E06518] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    استعلام قیمت
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: QUICK PRICE INQUIRY (استعلام قیمت)                               */}
      {/* ========================================================================= */}
      {rfqModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRfqModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-right space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#E06518] flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#23262B]">استعلام قیمت و موجودی</h3>
                  <p className="text-[11px] text-slate-500">واحد مهندسی فروش صنعت پیش</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRfqModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {rfqSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-black text-slate-800">
                  درخواست استعلام با موفقیت ثبت شد
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  کارشناسان فروش صنعت پیش در اسرع وقت پیش‌فاکتور و مشخصات فنی{' '}
                  <span className="font-bold text-slate-800">{rfqItemName}</span> را برای شما ارسال می‌کنند.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRfqSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    قطعه مورد نظر
                  </label>
                  <input
                    type="text"
                    value={rfqItemName}
                    onChange={(e) => setRfqItemName(e.target.value)}
                    className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 focus:border-[#E06518] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نام و نام خانوادگی
                    </label>
                    <input
                      type="text"
                      value={rfqCustomerName}
                      onChange={(e) => setRfqCustomerName(e.target.value)}
                      placeholder="مثال: مهندس رضایی"
                      className="w-full h-10 rounded-xl bg-white border border-slate-200 px-3 text-xs text-slate-800 focus:border-[#E06518] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      شماره موبایل *
                    </label>
                    <input
                      type="tel"
                      required
                      value={rfqPhone}
                      onChange={(e) => setRfqPhone(e.target.value)}
                      placeholder="0912..."
                      dir="ltr"
                      className="w-full h-10 rounded-xl bg-white border border-slate-200 px-3 text-xs text-right text-slate-800 focus:border-[#E06518] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام کارخانه / شرکت
                  </label>
                  <input
                    type="text"
                    value={rfqFactory}
                    onChange={(e) => setRfqFactory(e.target.value)}
                    placeholder="مثال: کاشی میبد / کاشی مرجان"
                    className="w-full h-10 rounded-xl bg-white border border-slate-200 px-3 text-xs text-slate-800 focus:border-[#E06518] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    توضیحات ابعاد یا تعداد مورد نیاز
                  </label>
                  <textarea
                    rows={2}
                    value={rfqNote}
                    onChange={(e) => setRfqNote(e.target.value)}
                    placeholder="سایز، کد فنی یا شرایط کاری قطعه را بنویسید..."
                    className="w-full rounded-xl bg-white border border-slate-200 p-3 text-xs text-slate-800 focus:border-[#E06518] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 h-11 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs sm:text-sm cursor-pointer transition-colors"
                  >
                    ثبت درخواست استعلام
                  </button>
                  <Link
                    to={`/products?q=${encodeURIComponent(rfqItemName.split('(')[0].trim())}`}
                    className="h-11 px-4 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center"
                  >
                    مشاهده در کاتالوگ
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TROUBLESHOOTING PROBLEM SOLUTION MODAL                           */}
      {/* ========================================================================= */}
      {selectedProblem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedProblem(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-right space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#E06518] flex items-center justify-center">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#23262B]">{selectedProblem.title}</h3>
                  <p className="text-[11px] text-slate-500">{selectedProblem.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProblem(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="font-black text-slate-800 block mb-1">نشانه و علائم در خط تولید:</span>
                <p className="text-slate-600">{selectedProblem.symptom}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
                <span className="font-black text-amber-900 block mb-1">علت فنی رخداد:</span>
                <p className="text-amber-800">{selectedProblem.cause}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <span className="font-black text-emerald-900 block mb-1">راهکار مهندسی صنعت پیش:</span>
                <p className="text-emerald-800">{selectedProblem.solution}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to={`/products?q=${encodeURIComponent(selectedProblem.recommendedQuery)}`}
                className="flex-1 h-11 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                <span>مشاهده قطعات پیشنهادی</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link
                to={`/ai-consult?industry=ceramic&q=${encodeURIComponent(selectedProblem.title)}`}
                className="h-11 px-4 rounded-xl border border-slate-200 hover:border-[#E06518] text-slate-700 hover:text-[#E06518] font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-[#E06518]" />
                <span>مشاوره با FORZA</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: STAGE TECHNICAL DETAILS / PRODUCTION LINE OVERVIEW               */}
      {/* ========================================================================= */}
      {(stageInfoModalOpen || videoModalOpen) && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setStageInfoModalOpen(false);
            setVideoModalOpen(false);
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-right space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-bold text-[#E06518]">
                  مرحله {activeStage.number} خط تولید کاشی و سرامیک
                </span>
                <h3 className="text-lg font-black text-[#23262B]">{activeStage.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStageInfoModalOpen(false);
                  setVideoModalOpen(false);
                }}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full h-52 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 relative">
              <img
                src={activeStage.image}
                alt={activeStage.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-4">
                <div className="flex flex-wrap gap-2">
                  {productionStages.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveStageId(s.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        s.id === activeStage.id
                          ? 'bg-[#E06518] text-white'
                          : 'bg-black/50 text-white/90 hover:bg-black/70'
                      }`}
                    >
                      {s.number}. {s.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {activeStage.details}
            </p>

            <div className="flex items-center justify-between pt-2">
              <Link
                to={`/products?q=${encodeURIComponent(activeStage.query)}`}
                className="h-10 px-5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold flex items-center gap-2"
              >
                <span>مشاهده تمامی قطعات این مرحله</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setStageInfoModalOpen(false);
                  setVideoModalOpen(false);
                }}
                className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TileCeramicIndustryPage;
