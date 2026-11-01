import { ProductImageAudit } from './ProductImageAudit';
import { enrichTechnicalVariant } from '../../data/productTechnicalData';
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Layers,
  Package,
  RefreshCw,
  FolderPlus,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Link2,
  ArrowUp,
  ArrowDown,
  Upload,
  ExternalLink,
  Copy,
  RotateCcw,
  ArrowLeftRight,
  CheckCircle2,
  PhoneCall,
  SlidersHorizontal,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { flushDurableChanges } from '../../services/durableStorage';
import { CategoryTreeEditor } from '../CategoryTreeEditor';
import { CatalogNavigationGroupsEditor } from '../CatalogNavigationGroupsEditor';
import { CatalogFamilyTaxonomyManager } from '../CatalogFamilyTaxonomyManager';
import { useApprovedMenuTaxonomy, saveApprovedFamilyAssignment } from '../useApprovedMenuTaxonomy';
import {
  Product,
  ProductVariant,
  ProductGalleryImage,
  Category,
  Brand,
  TechnicalSpec,
} from '../../types';
import { toPersianDigits } from '../../utils/formatters';
import { getProductImageUrl, TOTAL_OFFICIAL_IMAGES_COUNT } from '../../assets/imagesproducts';
import { ProductImage } from '../../components/product/ProductImage';
import { uploadProductImage } from '../../services/productImageUpload';
import { subscribeCatalogChanges, buildDefaultGalleryImages, syncCatalogFromServer, normalizeMergedProduct } from '../../data/mockGenerator';
import { normalizeCatalogueText } from '../../data/userProducts';
import { catalogFamilyCount } from '../catalogFamilyFilters';

interface ProductsModuleProps {
  onQuickImportClick?: () => void;
}

export const ProductsModule: React.FC<ProductsModuleProps> = () => {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'categories' | 'brands'>('products');

  // Full catalog state (all 1,383+ families & 10,435+ SKUs)
  const [products, setProducts] = useState<Product[]>(() => adminService.getProducts());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMenuGroup, setSelectedMenuGroup] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubmenu, setSelectedSubmenu] = useState('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'priced' | 'inquiry'>('all');
  const [imageFilter, setImageFilter] = useState<'all' | 'sku_bound' | 'has_images' | 'no_images'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Subscribe to catalog updates
  useEffect(() => {
    return subscribeCatalogChanges(() => {
      setProducts(adminService.getProducts());
      setCategories(adminService.getCategories());
    });
  }, []);

  const refreshProducts = () => {
    setProducts(adminService.getProducts());
  };

  // Categories & Brands state
  const [categories, setCategories] = useState<Category[]>(() => adminService.getCategories());
  const [brands, setBrands] = useState<Brand[]>(() => adminService.getBrands());
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryImageUploading, setCategoryImageUploading] = useState(false);
  const [categorySavePending, setCategorySavePending] = useState(false);
  const [categorySaveError, setCategorySaveError] = useState('');
  const [categoryImageCandidate,setCategoryImageCandidate] = useState('');
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandSpecialtyInput, setBrandSpecialtyInput] = useState('');
  const [brandBadgeAccent, setBrandBadgeAccent] = useState('#E06518');

  const handleOpenCategoryModal = (cat?: Category,candidateImage = '') => {
    setCategoryImageCandidate(candidateImage&&!candidateImage.startsWith('blob:')?candidateImage:'');
    if (cat) {
      setEditingCategory({
        ...cat,
        subcategories: [...(cat.subcategories || [])],
        children: (cat.children || (cat.subcategories || []).map(name => ({ name, value: name, children: [] }))).map(node => ({ ...node, children: (node.children || []).map(child => ({ ...child })) })),
        active: cat.active !== undefined ? cat.active : true,
      });
    } else {
      const nextId = Math.max(0, ...categories.map(c => Number(c.id) || 0)) + 1;
      setEditingCategory({
        id: nextId,
        slug: '',
        name: '',
        nameEn: '',
        description: '',
        subcategories: [],
        children: [],
        icon: 'Cog',
        count: 0,
        image: '',
        active: true,
      });
    }
    setCategorySaveError('');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategoryModal = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    const finalSlug =
      editingCategory.slug.trim() ||
      editingCategory.name.trim().replace(/[\s\u200c]+/g, '-');
    const children = (editingCategory.children || []).filter(node => node.name.trim()).map(node => ({
      ...node, name: node.name.trim(), children: (node.children || []).filter(child => child.name.trim()).map(child => ({ ...child, name: child.name.trim() })),
    }));
    const toSave: Category = {
      ...editingCategory,
      name: editingCategory.name.trim(),
      nameEn: editingCategory.nameEn.trim() || finalSlug,
      slug: finalSlug,
      children,
      subcategories: children.filter(node => !node.hidden).map(node => node.name),
    };
    setCategorySavePending(true);
    setCategorySaveError('');
    try {
      adminService.saveCategory(toSave);
      await flushDurableChanges();
      setCategories(adminService.getCategories());
      window.dispatchEvent(new CustomEvent('atlas-image-assignment-hierarchy-saved',{detail:{categoryName:toSave.name}}));
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      setCategorySaveError(error instanceof Error ? error.message : 'تغییرات دسته‌بندی ذخیره نشد.');
    } finally {
      setCategorySavePending(false);
    }
  };

  const handleCategoryImageUpload = async (file: File) => {
    setCategorySaveError('');
    setCategoryImageUploading(true);
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || !file.size || file.size > 8 * 1024 * 1024)
        throw new Error('تصویر PNG، JPG یا WebP با حداکثر حجم ۸ مگابایت انتخاب کنید.');
      const response = await fetch('/api/catalog/category-images/upload', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':file.type}, body:file,
      });
      const result = await response.json().catch(() => ({ success:false, message:'پاسخ سرور قابل خواندن نیست.' }));
      if (!response.ok || !result.success || !result.url) throw new Error(result.message || 'آپلود تصویر انجام نشد.');
      setEditingCategory(prev => prev ? { ...prev, image: result.url } : prev);
    } catch (error) {
      setCategorySaveError(error instanceof Error ? error.message : 'آپلود تصویر با خطا مواجه شد.');
    } finally { setCategoryImageUploading(false); }
  };

  const handleDeleteCategoryItem = (slug: string) => {
    adminService.deleteCategory(slug);
    setCategories(adminService.getCategories());
  };

  const generateBrandVisualSvg = (title: string, subtitle: string, accent: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 200" width="360" height="200">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="360" height="200" rx="22" fill="url(#bg)" />
      <rect x="8" y="8" width="344" height="184" rx="16" fill="none" stroke="${accent}" stroke-width="2.5" stroke-opacity="0.65" />
      <circle cx="315" cy="40" r="50" fill="${accent}" fill-opacity="0.12" />
      <rect x="28" y="28" width="52" height="7" rx="3.5" fill="${accent}" />
      <text x="180" y="108" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="38" fill="#ffffff" letter-spacing="2">${title || 'BRAND'}</text>
      <text x="180" y="142" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-weight="700" font-size="14" fill="${accent}">${subtitle || 'INDUSTRIAL BRAND'}</text>
      <rect x="105" y="160" width="150" height="4" rx="2" fill="${accent}" fill-opacity="0.5" />
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const handleOpenBrandModal = (brand?: Brand) => {
    if (brand) {
      setEditingBrand({
        ...brand,
        image: brand.image || brand.logo || '',
        logo: brand.logo || brand.image || '',
        bannerImage: brand.bannerImage || '',
        specialties: [...(brand.specialties || [])],
        active: brand.active !== undefined ? brand.active : true,
      });
    } else {
      const id = `brand-${Date.now().toString().slice(-4)}`;
      const defaultSvg = generateBrandVisualSvg('NEW BRAND', 'INDUSTRIAL QUALITY', '#E06518');
      setEditingBrand({
        id,
        name: '',
        nameEn: '',
        country: 'آلمان / ایتالیا',
        description: '',
        isExclusive: false,
        image: defaultSvg,
        logo: defaultSvg,
        bannerImage: '',
        specialties: ['قطعات صنعتی', 'انتقال قدرت'],
        active: true,
      });
    }
    setBrandSpecialtyInput('');
    setIsBrandModalOpen(true);
  };

  const handleBrandImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'image' | 'bannerImage'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !editingBrand) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;
      if (field === 'image') {
        setEditingBrand(prev => (prev ? { ...prev, image: dataUrl, logo: dataUrl } : prev));
      } else {
        setEditingBrand(prev => (prev ? { ...prev, bannerImage: dataUrl } : prev));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveBrandModal = () => {
    if (!editingBrand || !editingBrand.name.trim()) return;
    const cleanId =
      editingBrand.id.trim() ||
      editingBrand.nameEn.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
      `brand-${Date.now()}`;
    const img =
      editingBrand.image ||
      editingBrand.logo ||
      generateBrandVisualSvg(
        editingBrand.nameEn || editingBrand.name,
        editingBrand.country || 'INDUSTRIAL',
        brandBadgeAccent
      );
    const toSave: Brand = {
      ...editingBrand,
      id: cleanId,
      name: editingBrand.name.trim(),
      nameEn: editingBrand.nameEn.trim() || editingBrand.name.trim(),
      image: img,
      logo: img,
    };
    adminService.saveBrand(toSave);
    setBrands(adminService.getBrands());
    setIsBrandModalOpen(false);
    setEditingBrand(null);
  };

  const handleDeleteBrandItem = (id: string) => {
    adminService.deleteBrand(id);
    setBrands(adminService.getBrands());
  };

  // Two-Level Family & SKU Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<'family' | 'variants' | 'images' | 'preview'>('family');
  const [isCreatingNewFamily, setIsCreatingNewFamily] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Draft Family being edited
  const [draftFamily, setDraftFamily] = useState<Product | null>(null);
  const [draftMenuGroup, setDraftMenuGroup] = useState('');
  const [draftMenuCategory, setDraftMenuCategory] = useState('');
  const [draftMenuSubmenu, setDraftMenuSubmenu] = useState('');
  const [draftMenuLeaf, setDraftMenuLeaf] = useState('');
  const [familySavePending,setFamilySavePending] = useState(false);
  const [pendingFamilyUpload,setPendingFamilyUpload] = useState<File|null>(null);
  const [pendingFamilyImageTitle,setPendingFamilyImageTitle] = useState('');
  // Active variant code being edited inside Tab 2 ("variants")
  const [editingVariantCode, setEditingVariantCode] = useState<string>('');
  const [showSkuTechnicalSpecs, setShowSkuTechnicalSpecs] = useState(false);
  const [variantSearchQuery, setVariantSearchQuery] = useState('');

  // Image addition state in Tab 3 ("images")
  const [newImgSourceType, setNewImgSourceType] = useState<'catalogue' | 'upload' | 'url'>('catalogue');
  const [catalogueImgNum, setCatalogueImgNum] = useState<number>(549);
  const [customImgUrl, setCustomImgUrl] = useState('');
  const [newImgScope, setNewImgScope] = useState<'family' | 'variant'>('variant');
  const [newImgVariantCode, setNewImgVariantCode] = useState('');
  const [newImgTitle, setNewImgTitle] = useState('');
  const [imageFormFeedback, setImageFormFeedback] = useState<string | null>(null);
  const [productImageUploading, setProductImageUploading] = useState(false);

  // Image replacement / move to another family state
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);
  const [replaceCatalogueNum, setReplaceCatalogueNum] = useState<number>(1);
  const [replaceCustomUrl, setReplaceCustomUrl] = useState<string>('');
  const [movingImageId, setMovingImageId] = useState<string | null>(null);
  const [moveTargetFamilyQuery, setMoveTargetFamilyQuery] = useState('');
  const [moveTargetFamilyCode, setMoveTargetFamilyCode] = useState('');
  const [moveTargetVariantCode, setMoveTargetVariantCode] = useState('');

  // Preview state in Tab 4 ("preview")
  const [previewSelectedVariantCode, setPreviewSelectedVariantCode] = useState('');
  const [previewActiveImageIdx, setPreviewActiveImageIdx] = useState(0);

  // One PostgreSQL-backed taxonomy for mega-menu, catalogue, product filters and image audit.
  // Keep the original family category fields unchanged for old product links.
  const taxonomy = useApprovedMenuTaxonomy();
  const approvedCategories = taxonomy.categories;
  const approvedGroups = taxonomy.groups;
  const selectedApprovedCategory = approvedCategories.find(item=>item.slug===selectedCategory);
  const visibleMenuCategories = selectedMenuGroup==='all'
    ? approvedCategories
    : approvedCategories.filter(item=>approvedGroups.find(g=>g.id===selectedMenuGroup)?.categorySlugs.includes(item.slug));
  const menuSubmenus = selectedApprovedCategory?.children?.map(node=>node.name)||[];
  const menuLeaves = selectedApprovedCategory?.children
    ?.filter(node=>selectedSubmenu==='all'||node.name===selectedSubmenu)
    .flatMap(node=>(node.children||[]).map(child=>child.name))||[];
  const editorApprovedCategory = approvedCategories.find(item=>item.slug===draftMenuCategory);
  const editorSubmenus = editorApprovedCategory?.children||[];
  const editorLeaves = editorSubmenus.find(node=>node.name===draftMenuSubmenu)?.children||[];
  const openFamiliesInCategory = (category:string) => {
    setActiveSubTab('products');setSelectedMenuGroup('all');setSelectedCategory(category);
    setSelectedSubmenu('all');setSelectedSubcategory('all');setSearchQuery('');
    setPriceFilter('all');setImageFilter('all');setStatusFilter('all');setCurrentPage(1);
  };

  // Global stats
  const catalogStats = useMemo(() => {
    let totalSkus = 0;
    let pricedSkus = 0;
    let skuBoundImages = 0;
    let familiesWithImages = 0;
    products.forEach(p => {
      const vars = p.variants || [];
      totalSkus += vars.length;
      vars.forEach(v => {
        const pr = v.price ?? v.prices?.retail ?? 0;
        const inq = v.inquiryOnly !== undefined ? v.inquiryOnly : pr <= 0;
        if (!inq && pr > 0) pricedSkus++;
      });
      const gal = p.galleryImages || [];
      skuBoundImages += gal.filter(g => g.scope === 'variant' && g.variantCode).length;
      if ((p.images && p.images.length > 0) || gal.length > 0) familiesWithImages++;
    });
    return {
      totalFamilies: products.length,
      totalSkus,
      pricedSkus,
      skuBoundImages,
      familiesWithImages,
    };
  }, [products]);

  // Filtered products across all 1,383+ families & 10,435+ SKUs
  const filteredProducts = useMemo(() => {
    const q = normalizeCatalogueText(searchQuery);
    return products.filter(p => {
      if (q) {
        const hay = normalizeCatalogueText(
          [
            p.code,
            p.name,
            p.brand,
            p.categoryName,
            p.submenu || '',
            p.subcategory || '',
            ...(p.variants || []).flatMap(v => [v.code, v.name, v.size, v.model || '']),
          ].join(' ')
        );
        const terms = q.split(' ').filter(Boolean);
        if (!terms.every(t => hay.includes(t))) return false;
      }

      const assigned=taxonomy.byFamily.get(p.code);
      if(selectedCategory==='unassigned') {
        if(taxonomy.assignmentsLoaded && assigned) return false;
      } else {
        if(selectedCategory!=='all' && assigned?.categorySlug!==selectedCategory) return false;
        if(selectedSubmenu!=='all' && assigned?.submenuName!==selectedSubmenu) return false;
        if(selectedSubcategory!=='all' && assigned?.leafName!==selectedSubcategory) return false;
      }
      if(selectedMenuGroup!=='all' && !approvedGroups.find(g=>g.id===selectedMenuGroup)?.categorySlugs.includes(assigned?.categorySlug||'')) return false;

      if (statusFilter === 'active' && p.active === false) return false;
      if (statusFilter === 'inactive' && p.active !== false) return false;

      if (priceFilter !== 'all') {
        const hasPricedVariant = (p.variants || []).some(v => {
          const pr = v.price ?? v.prices?.retail ?? 0;
          const inq = v.inquiryOnly !== undefined ? v.inquiryOnly : pr <= 0;
          return !inq && pr > 0;
        });
        if (priceFilter === 'priced' && !hasPricedVariant) return false;
        if (priceFilter === 'inquiry' && hasPricedVariant) return false;
      }

      if (imageFilter !== 'all') {
        const gal = p.galleryImages || [];
        const hasAnyImg = (p.images && p.images.length > 0) || gal.length > 0;
        const hasSkuBound = gal.some(g => g.scope === 'variant' && g.variantCode);
        if (imageFilter === 'sku_bound' && !hasSkuBound) return false;
        if (imageFilter === 'has_images' && !hasAnyImg) return false;
        if (imageFilter === 'no_images' && hasAnyImg) return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedMenuGroup, selectedCategory, selectedSubmenu, selectedSubcategory, statusFilter, priceFilter, imageFilter, taxonomy.byFamily, taxonomy.assignmentsLoaded, approvedGroups]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Open Editor for New Family
  const handleOpenNewFamily = () => {
    const familyId = `FAM-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const newFam: Product = {
      code: familyId,
      name: '',
      brand: 'ATLAS',
      categoryName: 'قطعات مکانیکی',
      categorySlug: 'قطعات-مکانیکی',
      submenu: '',
      subcategory: '',
      unit: 'عدد',
      active: true,
      inquiryOnly: true,
      stock: 0,
      stockKnown: true,
      prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
      description: '',
      tags: ['قطعه صنعتی'],
      images: [],
      galleryImages: [],
      technicalSpecs: [
        { key: 'نوع فنی خانواده', value: 'قطعه صنعتی' },
        { key: 'واحد فروش', value: 'عدد' },
      ],
      variants: [],
    };

    setDraftMenuGroup('');
    setDraftMenuCategory('');
    setDraftMenuSubmenu('');
    setDraftMenuLeaf('');
    setIsCreatingNewFamily(true);
    setPendingFamilyUpload(null);
    setPendingFamilyImageTitle('');
    setDraftFamily(newFam);
    setEditingVariantCode('');
    setNewImgVariantCode('');
    setPreviewSelectedVariantCode('');
    setPreviewActiveImageIdx(-1);
    setEditorTab('family');
    setIsEditorOpen(true);
  };

  // Open Editor for Existing Family
  const handleOpenEditFamily = (
    product: Product,
    initialTab: 'family' | 'variants' | 'images' | 'preview' = 'family'
  ) => {
    const gallery = buildDefaultGalleryImages(product);
    const variantsCopy: ProductVariant[] = (product.variants || []).map(v => {
      const pr = v.price ?? v.prices?.retail ?? 0;
      const inq = v.inquiryOnly !== undefined ? v.inquiryOnly : pr <= 0;
      return {
        ...v,
        model: v.model || '',
        brand: v.brand || product.brand || '',
        unit: v.unit || product.unit || 'عدد',
        price: pr,
        prices: v.prices || {
          base: pr > 0 ? Math.round(pr * 0.8) : 0,
          retail: pr,
          wholesale: pr > 0 ? Math.round(pr * 0.9) : 0,
          dealer: pr > 0 ? Math.round(pr * 0.84) : 0,
        },
        inquiryOnly: inq,
        stock: v.stock ?? 0,
        stockKnown: v.stockKnown ?? (pr > 0),
        active: v.active ?? true,
        technicalSpecs: v.technicalSpecs ? [...v.technicalSpecs] : [],
        images: v.images ? [...v.images] : [],
      };
    });

    const firstCode = variantsCopy[0]?.code || '';
    const existingAssignment=taxonomy.byFamily.get(product.code);
    setDraftMenuCategory(existingAssignment?.categorySlug||'');
    setDraftMenuGroup(approvedGroups.find(g=>g.categorySlugs.includes(existingAssignment?.categorySlug||''))?.id||'');
    setDraftMenuSubmenu(existingAssignment?.submenuName||'');
    setDraftMenuLeaf(existingAssignment?.leafName||'');
    setIsCreatingNewFamily(false);
    setPendingFamilyUpload(null);
    setPendingFamilyImageTitle('');
    setDraftFamily({
      ...product,
      active: product.active ?? true,
      technicalSpecs: (product.technicalSpecs || []).map(s => ({ ...s })),
      galleryImages: gallery,
      variants: variantsCopy,
    });
    setEditingVariantCode(firstCode);
    setNewImgVariantCode(firstCode);
    setPreviewSelectedVariantCode(firstCode);
    setPreviewActiveImageIdx(gallery.findIndex(img => img.scope === 'variant' && img.variantCode === firstCode));
    setVariantSearchQuery('');
    setEditorTab(initialTab);
    setIsEditorOpen(true);
  };

  // Save Family + Variants + Images + Prices to Database
  const handleSaveDraftFamily = async () => {
    if (!draftFamily || familySavePending) return;
    if (!draftFamily.name.trim()) {
      setSaveFeedback('لطفاً نام خانواده محصول را وارد کنید.');
      setTimeout(() => setSaveFeedback(null), 3000);
      return;
    }
    if(isCreatingNewFamily && (!draftMenuCategory||!draftMenuSubmenu)) {
      setSaveFeedback('برای خانواده جدید باید دسته و زیرمنو از فهرست مصوب انتخاب شود.');
      return;
    }
    if(draftMenuCategory && !draftMenuSubmenu) {
      setSaveFeedback('ابتدا زیرمنوی معتبر را برای دسته انتخاب‌شده مشخص کنید.');
      return;
    }

    const cleanSpecs = (draftFamily.technicalSpecs || [])
      .filter(s => s.key.trim())
      .map(s => ({ key: s.key.trim(), value: s.value.trim() }));

    const cleanGallery = (draftFamily.galleryImages || []).map((img, i) => ({
      ...img,
      order: i + 1,
      variantCode: img.scope === 'variant' ? img.variantCode : undefined,
    }));

    const cleanVariants = (draftFamily.variants || []).map(v => {
      const unitPrice = v.inquiryOnly ? 0 : Number(v.price || 0);
      const linkedImgs = cleanGallery
        .filter(g => g.scope === 'variant' && g.variantCode === v.code)
        .map(g => g.url);
      return {
        ...v,
        code: v.code.trim(),
        name: v.name.trim() || draftFamily.name.trim(),
        size: v.size.trim() || 'استاندارد',
        price: unitPrice,
        prices: {
          base: v.prices?.base || (unitPrice > 0 ? Math.round(unitPrice * 0.8) : 0),
          retail: unitPrice,
          wholesale: v.prices?.wholesale || (unitPrice > 0 ? Math.round(unitPrice * 0.9) : 0),
          dealer: v.prices?.dealer || (unitPrice > 0 ? Math.round(unitPrice * 0.84) : 0),
        },
        inquiryOnly: v.inquiryOnly || unitPrice <= 0,
        images: linkedImgs,
        technicalSpecs: (v.technicalSpecs || []).filter(s => s.key.trim()),
      };
    });

    const legacyTargetSlug=(editorApprovedCategory as (typeof editorApprovedCategory & {routeSlug?:string}))?.routeSlug;
    const legacyDestination=categories.find(item=>item.slug===legacyTargetSlug);
    const payload: Product = {
      ...draftFamily,
      code: draftFamily.code.trim(),
      name: draftFamily.name.trim(),
      // The original family hierarchy is kept for old product links. New families also
      // get their proper legacy category route; their visible taxonomy lives in the mapping table.
      categoryName:isCreatingNewFamily ? (legacyDestination?.name||draftFamily.categoryName) : draftFamily.categoryName,
      categorySlug:isCreatingNewFamily
        ? (legacyTargetSlug || draftFamily.categorySlug)
        : draftFamily.categorySlug,
      submenu:isCreatingNewFamily ? draftMenuSubmenu : draftFamily.submenu,
      subcategory:isCreatingNewFamily ? (draftMenuLeaf||draftMenuSubmenu) : draftFamily.subcategory,
      technicalSpecs: cleanSpecs,
      galleryImages: cleanGallery,
      images: cleanGallery.map(g => g.url),
      variants: cleanVariants,
    };

    setFamilySavePending(true);
    setSaveFeedback(null);
    try {
      const normalized=normalizeMergedProduct(payload,payload);
      const response=await fetch('/api/catalog/overrides/family',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({family:normalized}),signal:AbortSignal.timeout(20000)
      });
      const data=await response.json().catch(()=>({success:false,message:'پاسخ پایگاه داده معتبر نیست.'}));
      if(!response.ok||!data.success)throw new Error(data.message||'ذخیره خانواده در دیتابیس انجام نشد.');
      let categoryWarning='';
      if(draftMenuCategory && draftMenuSubmenu){
        try {
          await saveApprovedFamilyAssignment({
            familyCode:payload.code,categorySlug:draftMenuCategory,
            submenu:draftMenuSubmenu,leaf:draftMenuLeaf
          });
          taxonomy.refresh();
        } catch(error){
          categoryWarning=error instanceof Error?error.message:'اتصال خانواده به دسته‌بندی مصوب ثبت نشد.';
        }
      }
      let imageWarning='';
      let storedFamilyImage:{id:string;url:string;fileName:string}|undefined;
      if(pendingFamilyUpload){
        try{
          const stored=await uploadProductImage(pendingFamilyUpload,{
            familyCode:payload.code,title:pendingFamilyImageTitle||pendingFamilyUpload.name
          });
          storedFamilyImage=stored;
          setPendingFamilyUpload(null);
          setDraftFamily(previous=>{
            if(!previous)return previous;
            const gallery=previous.galleryImages||[];
            if(gallery.some(image=>image.id===stored.id))return previous;
            const nextGallery=[...gallery,{
              id:stored.id,url:stored.url,fileName:stored.fileName,scope:'family' as const,
              title:pendingFamilyImageTitle||stored.fileName,identityVerified:false,order:gallery.length+1
            }];
            return {...previous,galleryImages:nextGallery,images:nextGallery.map(image=>image.url)};
          });
        }catch(error){
          imageWarning=error instanceof Error?error.message:'بارگذاری تصویر انجام نشد.';
        }
      }
      await syncCatalogFromServer();
      refreshProducts();
      setIsCreatingNewFamily(false);
      window.dispatchEvent(new CustomEvent('atlas-image-assignment-hierarchy-saved',{
        detail:{categoryName:payload.categoryName,submenu:payload.submenu||'',subcategory:payload.subcategory,familyCode:payload.code,imageUrl:storedFamilyImage?.url,imageFileName:storedFamilyImage?.fileName}
      }));
      if(imageWarning||categoryWarning){
        if(imageWarning)setEditorTab('images');
        setSaveFeedback('خانواده ذخیره شد؛ '+(categoryWarning?'اما مسیر منو ثبت نشد: '+categoryWarning+' ':'')+
          (imageWarning?'تصویر ذخیره نشد: '+imageWarning:''));
      }else setSaveFeedback('خانواده، کدها و مسیر دسته‌بندی مصوب در Supabase ثبت شدند.');
    }catch(error){
      setSaveFeedback(error instanceof Error?error.message:'ذخیره خانواده در دیتابیس انجام نشد.');
    }finally{
      setFamilySavePending(false);
    }
  };

  // Toggle Family Active/Inactive directly from table
  const handleToggleFamilyActive = (product: Product) => {
    const updated: Product = {
      ...product,
      active: product.active === false ? true : false,
    };
    adminService.saveProduct(updated);
    refreshProducts();
  };

  // Reset Family to Workbook Default
  const handleResetFamily = (code: string) => {
    adminService.resetProductToDefault(code);
    refreshProducts();
  };

  // Helpers inside Editor for Variants (Tab 2)
  const currentEditingVariant = useMemo(() => {
    if (!draftFamily?.variants) return null;
    return (
      draftFamily.variants.find(v => v.code === editingVariantCode) ||
      draftFamily.variants[0] ||
      null
    );
  }, [draftFamily, editingVariantCode]);

  const technicalReview = draftFamily && currentEditingVariant ? enrichTechnicalVariant(draftFamily, currentEditingVariant).technicalReview : undefined;

  const downloadTechnicalAudit = () => {
    const records = products.flatMap(product => (product.variants || []).map(original => {
      const variant = enrichTechnicalVariant(product, original);
      return { familyCode: product.code, familyName: product.name, sku: variant.code, name: variant.name,
        size: variant.size, model: variant.model, specifications: variant.technicalSpecs, review: variant.technicalReview };
    }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'sanatpish-technical-review.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const updateCurrentVariant = (updater: (v: ProductVariant) => ProductVariant) => {
    if (!draftFamily || !currentEditingVariant) return;
    const targetCode = currentEditingVariant.code;
    setDraftFamily(prev => {
      if (!prev) return prev;
      const nextVariants = (prev.variants || []).map(v =>
        v.code === targetCode ? updater(v) : v
      );
      // If variant code changed, also update any galleryImages pointing to old code
      const updatedVar = nextVariants.find(
        (_, idx) => prev.variants?.[idx]?.code === targetCode
      );
      const nextGallery =
        updatedVar && updatedVar.code !== targetCode
          ? (prev.galleryImages || []).map(img =>
              img.scope === 'variant' && img.variantCode === targetCode
                ? { ...img, variantCode: updatedVar.code }
                : img
            )
          : prev.galleryImages;

      if (updatedVar && updatedVar.code !== targetCode) {
        setEditingVariantCode(updatedVar.code);
      }

      return {
        ...prev,
        variants: nextVariants,
        galleryImages: nextGallery,
      };
    });
  };

  const handleAddVariantToDraft = () => {
    if (!draftFamily) return;
    const baseNum = draftFamily.code.replace(/^FAM-/i, '');
    const nextIdx = (draftFamily.variants?.length || 0) + 1;
    const newCode = `${baseNum}-V${nextIdx}`;
    const newVar: ProductVariant = {
      code: newCode,
      name: `${draftFamily.name || 'محصول'} — نوع ${toPersianDigits(nextIdx)}`,
      size: 'سایز جدید',
      model: '',
      brand: draftFamily.brand || 'ATLAS',
      unit: draftFamily.unit || 'عدد',
      price: 0,
      prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
      inquiryOnly: true,
      stock: 10,
      stockKnown: true,
      active: true,
      images: [],
      technicalSpecs: [{ key: 'مشخصه فنی', value: 'مقدار' }],
    };

    setDraftFamily(prev =>
      prev
        ? {
            ...prev,
            variants: [...(prev.variants || []), newVar],
          }
        : prev
    );
    setEditingVariantCode(newCode);
  };

  const handleDeleteVariantFromDraft = (variantCode: string) => {
    if (!draftFamily || (draftFamily.variants?.length || 0) <= 1) return;
    setDraftFamily(prev => {
      if (!prev) return prev;
      const remaining = (prev.variants || []).filter(v => v.code !== variantCode);
      const nextGallery = (prev.galleryImages || []).map(img =>
        img.scope === 'variant' && img.variantCode === variantCode
          ? { ...img, scope: 'family' as const, variantCode: undefined }
          : img
      );
      setEditingVariantCode(remaining[0]?.code || '');
      return {
        ...prev,
        variants: remaining,
        galleryImages: nextGallery,
      };
    });
  };

  // Helpers inside Editor for Images (Tab 3)
  const handleAddImageToDraft = (urlToAdd: string, fileName?: string, persistedId?: string) => {
    if (!draftFamily || !urlToAdd.trim()) return;
    const resolvedUrl = getProductImageUrl(urlToAdd) || urlToAdd.trim();
    const targetVarCode = newImgScope === 'variant' ? newImgVariantCode : undefined;
    if (newImgScope === 'variant' && !draftFamily.variants?.some(v => v.code === targetVarCode)) {
      setImageFormFeedback('برای تصویر اختصاصی، ابتدا یک کد کالای معتبر انتخاب کنید؛ تصویر به کد دیگری متصل نمی‌شود.');
      return;
    }

    const newImg: ProductGalleryImage = {
      id: persistedId || `img-${draftFamily.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: resolvedUrl,
      fileName,
      scope: newImgScope,
      variantCode: targetVarCode,
      title:
        newImgTitle.trim() ||
        (newImgScope === 'variant' && targetVarCode
          ? `تصویر اختصاصی کد ${targetVarCode} — ${draftFamily.name}`
          : `تصویر عمومی خانواده ${draftFamily.name}`),
      order: (draftFamily.galleryImages?.length || 0) + 1,
    };

    setDraftFamily(prev => {
      if (!prev) return prev;
      const nextGallery = [...(prev.galleryImages || []), newImg];
      return {
        ...prev,
        galleryImages: nextGallery,
        images: nextGallery.map(g => g.url),
      };
    });
    setNewImgTitle('');
    setCustomImgUrl('');
    setImageFormFeedback(persistedId
      ? 'تصویر در Storage سرور و پایگاه داده ذخیره شد؛ بدون نیاز به انتشار مجدد سایت.'
      : 'تصویر به پیش‌نویس اضافه شد. برای ثبت نهایی، دکمه «ذخیره در پایگاه داده سایت» را بزنید.');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, replaceId?: string) => {
    const file=e.target.files?.[0];
    e.target.value='';
    if(!file||!draftFamily)return;
    if(isCreatingNewFamily || !products.some(p=>p.code===draftFamily.code)){
      setImageFormFeedback('برای تصویر جدید ابتدا خانواده را با دکمه «ذخیره در پایگاه داده سایت» ثبت کنید.');
      return;
    }
    const prior=replaceId?(draftFamily.galleryImages||[]).find(g=>g.id===replaceId):undefined;
    const variantCode=prior ? (prior.scope==='variant'?prior.variantCode:undefined) :
      (newImgScope==='variant'?newImgVariantCode:undefined);
    if((prior?.scope==='variant'||(!prior&&newImgScope==='variant'))&&!variantCode){
      setImageFormFeedback('ابتدا کد دقیق SKU را انتخاب کنید.');
      return;
    }
    setProductImageUploading(true);
    setImageFormFeedback('در حال ذخیره تصویر روی هارد سرور و ثبت ارتباط در PostgreSQL…');
    try{
      const stored=await uploadProductImage(file,{
        familyCode:draftFamily.code,
        variantCode,
        title:prior?.title||newImgTitle.trim()||file.name,
        replaceId
      });
      if(replaceId){
        handleReplaceImageInDraft(replaceId,stored.url,stored.fileName);
        setImageFormFeedback('تصویر قبلی با تصویر ذخیره‌شده در Storage جایگزین شد و در دیتابیس ثبت شد.');
      }else handleAddImageToDraft(stored.url,stored.fileName,stored.id);
      setReplacingImageId(null);
    }catch(error:any){
      setImageFormFeedback(error.message||'ذخیره تصویر انجام نشد؛ فایل و دیتابیس تغییر نکردند.');
    }finally{setProductImageUploading(false);}
  };

  const handleUpdateGalleryImage = (
    imgId: string,
    updater: (img: ProductGalleryImage) => ProductGalleryImage
  ) => {
    setDraftFamily(prev => {
      if (!prev) return prev;
      const nextGallery = (prev.galleryImages || []).map(img => {
        if (img.id !== imgId) return img;
        const next = updater(img);
        if (next.url !== img.url || next.variantCode !== img.variantCode || next.scope !== 'variant')
          next.identityVerified = false;
        return next;
      });
      return {
        ...prev,
        galleryImages: nextGallery,
        images: nextGallery.map(g => g.url),
      };
    });
  };

  const handleReplaceImageInDraft = (imgId: string, newUrl: string, fileName?: string) => {
    const resolved = getProductImageUrl(newUrl) || newUrl.trim();
    if (!resolved) return;
    handleUpdateGalleryImage(imgId, img => ({
      ...img,
      url: resolved,
      fileName: fileName || img.fileName,
    }));
    setReplacingImageId(null);
  };

  const handleReorderGalleryImage = (idx: number, direction: 'up' | 'down' | 'first') => {
    setDraftFamily(prev => {
      if (!prev || !prev.galleryImages) return prev;
      const list = [...prev.galleryImages];
      const targetIdx =
        direction === 'first' ? 0 : direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return prev;
      const [item] = list.splice(idx, 1);
      list.splice(targetIdx, 0, item);
      const reordered = list.map((g, i) => ({ ...g, order: i + 1 }));
      return {
        ...prev,
        galleryImages: reordered,
        images: reordered.map(g => g.url),
      };
    });
  };

  const handleDeleteGalleryImage = (imgId: string) => {
    setDraftFamily(prev => {
      if (!prev) return prev;
      const nextGallery = (prev.galleryImages || [])
        .filter(g => g.id !== imgId)
        .map((g, i) => ({ ...g, order: i + 1 }));
      return {
        ...prev,
        galleryImages: nextGallery,
        images: nextGallery.map(g => g.url),
      };
    });
  };

  const handleExecuteMoveImageToAnotherFamily = async (imageId: string) => {
    if (!draftFamily || !moveTargetFamilyCode) return;
    // First save current draft so nothing is lost
    handleSaveDraftFamily();
    const ok = await adminService.moveImageBetweenFamilies(
      draftFamily.code,
      imageId,
      moveTargetFamilyCode,
      moveTargetVariantCode || undefined
    );
    if (ok) {
      handleDeleteGalleryImage(imageId);
      refreshProducts();
      setMovingImageId(null);
      setMoveTargetFamilyCode('');
      setMoveTargetVariantCode('');
      setSaveFeedback(`تصویر با موفقیت به خانواده ${moveTargetFamilyCode} منتقل شد.`);
      setTimeout(() => setSaveFeedback(null), 3500);
    }
  };

  // Preview Bidirectional Sync in Tab 4
  const handlePreviewSelectVariant = (vCode: string) => {
    setPreviewSelectedVariantCode(vCode);
    const gal = draftFamily?.galleryImages || [];
    const curImg = gal[previewActiveImageIdx];
    if (curImg && curImg.scope === 'variant' && curImg.variantCode === vCode) return;
    const firstMatch = gal.findIndex(g => g.scope === 'variant' && g.variantCode === vCode);
    if (firstMatch >= 0) {
      setPreviewActiveImageIdx(firstMatch);
    } else {
      setPreviewActiveImageIdx(-1);
    }
  };

  const handlePreviewSelectImage = (idx: number) => {
    setPreviewActiveImageIdx(idx);
    const gal = draftFamily?.galleryImages || [];
    const clicked = gal[idx];
    if (clicked && clicked.scope === 'variant' && clicked.variantCode) {
      setPreviewSelectedVariantCode(clicked.variantCode);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <ProductImageAudit products={products} categories={categories}
        onCreateCategory={candidateImage=>handleOpenCategoryModal(undefined,candidateImage)}
        onEditCategory={(name,candidateImage)=>{
          const found=categories.find(c=>c.name===name);
          if(found)handleOpenCategoryModal(found,candidateImage);
        }}
        onEditFamily={(code,file,imageUrl,imageTitle,upload)=>{
          const product=products.find(p=>p.code===code);
          if(!product)return;
          handleOpenEditFamily(product,'family');
          setPendingFamilyUpload(upload||null);
          setPendingFamilyImageTitle(imageTitle||'');
          setNewImgTitle(imageTitle||'');
          setNewImgScope('family');
          const persistedUrl=imageUrl&&!imageUrl.startsWith('blob:')?imageUrl:'';
          if(persistedUrl)setDraftFamily(previous=>{
            if(!previous)return previous;
            const gallery=previous.galleryImages||[];
            if(gallery.some(image=>image.url===persistedUrl))return previous;
            const nextGallery=[...gallery,{
              id:'review-selected-'+Date.now(),url:persistedUrl,fileName:file,scope:'family' as const,
              identityVerified:false,title:imageTitle||'تصویر انتخاب‌شده از بانک تصاویر',
              order:gallery.length+1
            }];
            return {...previous,galleryImages:nextGallery,images:nextGallery.map(image=>image.url)};
          });
        }}
        onCreateFamily={(file,category,submenu,subcategory,imageUrl,imageTitle,upload,target)=>{
          handleOpenNewFamily();
          if(target){
            setDraftMenuCategory(target.categorySlug);
            setDraftMenuGroup(approvedGroups.find(group=>group.categorySlugs.includes(target.categorySlug))?.id||'');
            setDraftMenuSubmenu(target.submenu);
            setDraftMenuLeaf(target.leaf);
          }
          const legacySlug=target
            ? (approvedCategories.find(cat=>cat.slug===target.categorySlug) as
               (typeof approvedCategories[number] & {routeSlug?:string})|undefined)?.routeSlug
            : undefined;
          const legacyCategory=categories.find(cat=>cat.slug===legacySlug);
          const persistedUrl=imageUrl&&!imageUrl.startsWith('blob:')?imageUrl:'';
          setPendingFamilyUpload(upload||null);
          setPendingFamilyImageTitle(imageTitle||'');
          setDraftFamily(previous=>previous?{
            ...previous,
            categoryName:legacyCategory?.name||previous.categoryName,
            categorySlug:legacySlug||previous.categorySlug,
            submenu:target?.submenu||submenu||previous.submenu,
            subcategory:target?.leaf||subcategory||previous.subcategory,
            images:persistedUrl?[persistedUrl]:[],
            galleryImages:persistedUrl?[{
              id:'review-new-'+file,url:persistedUrl,fileName:file,scope:'family',
              identityVerified:false,title:imageTitle?.trim()||'تصویر نیازمند بررسی مشخصات',order:1
            }]:[]
          }:previous);
          setEditorTab('family');
        }}
        onCreateSku={(code,file,imageUrl,imageTitle)=>{
          const product=products.find(p=>p.code===code);if(!product)return;
          handleOpenEditFamily(product,'variants');
          setShowSkuTechnicalSpecs(true);
          setDraftFamily(previous=>{
            if(!previous)return previous;
            const url=imageUrl||getProductImageUrl(file),gallery=previous.galleryImages||[];
            if(gallery.some(image=>image.url===url))return previous;
            return {...previous,galleryImages:[...gallery,{
              id:`review-draft-${file}`,url,fileName:file,scope:'family',
              identityVerified:false,title:imageTitle?.trim()||'تصویر در انتظار کد کالا',order:gallery.length+1
            }],images:[...(previous.images||[]),url]};
          });
        }}
        onAssignDirectSku={async input=>{
          const response=await fetch('/api/catalog/direct-skus',{
            method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
            body:JSON.stringify(input),signal:AbortSignal.timeout(20000)
          });
          const data=await response.json().catch(()=>({}));
          if(!response.ok||!data.success)throw Error(data.message||'کد کالا مستقیماً ثبت نشد.');
          setSaveFeedback('کد '+input.skuCode+' بدون نیاز به خانواده در زیرمنو ثبت شد.');
          window.dispatchEvent(new Event('catalog-direct-skus-updated'));
        }}
        onAssignSku={async input=>{
          const response=await fetch('/api/catalog/sku-transfer',{
            method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
            signal:AbortSignal.timeout(20000),body:JSON.stringify(input)
          });
          const result=await response.json().catch(()=>({success:false,message:'پاسخ سرور قابل خواندن نیست.'}));
          if(!response.ok||!result.success)throw new Error(result.message||'انتقال کد کالا انجام نشد.');
          await syncCatalogFromServer();
          refreshProducts();
          setSaveFeedback(`کد ${input.skuCode} به خانواده ${input.targetFamilyCode} منتقل شد و تصویر آن ثبت شد.`);
          window.setTimeout(()=>setSaveFeedback(null),3500);
        }}
        onEdit={(code,file,skuCode,imageUrl,imageTitle,persistedId)=>{
          const product=products.find(p=>p.code===code);if(!product)return;
          handleOpenEditFamily(product,skuCode?'variants':'images');
          if(skuCode){
            setEditingVariantCode(skuCode);
            setShowSkuTechnicalSpecs(true);
            setNewImgScope('variant');
            setNewImgVariantCode(skuCode);
          }else{
            setShowSkuTechnicalSpecs(false);
            setNewImgScope('family');
            setNewImgVariantCode('');
          }
          setDraftFamily(previous=>{
            if(!previous)return previous;
            const url=imageUrl||getProductImageUrl(file),gallery=previous.galleryImages||[];
            if(gallery.some(image=>image.url===url))return previous;
            return {...previous,galleryImages:[...gallery,{
              id:persistedId||`review-${file}`,url,fileName:file,
              scope:skuCode?'variant':'family',variantCode:skuCode,
              identityVerified:false,title:imageTitle?.trim()||'تصویر در انتظار تأیید مشخصات',order:gallery.length+1
            }],images:skuCode?[...(previous.images||[])]:[...(previous.images||[]),url]};
          });
        }}
      />

      {/* 1. HEADER & GLOBAL STATS */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-[#37383b] flex items-center gap-2">
              <Package className="w-5 h-5 text-[#E06518]" />
              <span>کاتالوگ و کالاها</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              خانواده‌های محصول را پیدا کنید، کدها و قیمت‌هایشان را مدیریت کنید و تصاویر را به مورد درست وصل کنید. هیچ اطلاعاتی از کالاها حذف نمی‌شود.
            </p>
          </div>

          <div className="flex max-w-full overflow-x-auto items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('products')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'products'
                  ? 'bg-white text-[#E06518] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              کالاها ({toPersianDigits(catalogStats.totalFamilies)})
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('categories')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'categories'
                  ? 'bg-white text-[#E06518] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              دسته‌بندی‌ها ({toPersianDigits(approvedCategories.length)})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('brands')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'brands'
                  ? 'bg-white text-[#E06518] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              برندها ({toPersianDigits(brands.length)})
            </button>
          </div>
        </div>

        {activeSubTab === 'products' && <>
        {/* Summary Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] text-slate-500 block">کل خانواده‌های محصول</span>
            <span className="text-base font-black text-slate-800 font-mono">
              {toPersianDigits(catalogStats.totalFamilies)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] text-slate-500 block">کل کدهای کالا (SKU)</span>
            <span className="text-base font-black text-[#E06518] font-mono">
              {toPersianDigits(catalogStats.totalSkus)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
            <span className="text-[11px] text-emerald-800 block">کدهای دارای قیمت مصوب</span>
            <span className="text-base font-black text-emerald-800 font-mono">
              {toPersianDigits(catalogStats.pricedSkus)} کد
            </span>
          </div>
          <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-200/80">
            <span className="text-[11px] text-orange-900 block">تصاویر متصل به کد کالا</span>
            <span className="text-base font-black text-orange-800 font-mono">
              {toPersianDigits(catalogStats.skuBoundImages)} تصویر
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] text-slate-500 block">خانواده‌های دارای تصویر</span>
            <span className="text-base font-black text-slate-800 font-mono">
              {toPersianDigits(catalogStats.familiesWithImages)} خانواده
            </span>
          </div>
        </div>

        {/* Flagship Sample Quick Bar: چرخ دنده (FAM-34265 & FAM-80301) */}
        <details className="rounded-xl border border-orange-200/90 bg-orange-50/40">
          <summary className="cursor-pointer select-none px-4 py-3 text-xs font-bold text-[#55565A]">نمونهٔ راهنما برای یادگیری کار با خانواده و کد کالا (اختیاری)</summary>
          <div className="p-3.5 rounded-xl bg-orange-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-black text-[#37383b] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#E06518]" />
              <span>نمونهٔ کامل پیاده‌سازی‌شده: خانوادهٔ «چرخ دنده» (FAM-34265 و FAM-80301)</span>
            </div>
            <p className="text-[11px] text-slate-600">
              شامل چند کد کالای مستقل با قیمت‌های متفاوت، کد نیازمند استعلام، چند تصویر متصل به یک کد و تصویر عمومی خانواده.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const gear = products.find(p => p.code === 'FAM-34265');
                if (gear) handleOpenEditFamily(gear, 'variants');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>مدیریت کدها و تصاویر «چرخ دنده» (FAM-34265)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const whiteGear = products.find(p => p.code === 'FAM-80301');
                if (whiteGear) handleOpenEditFamily(whiteGear, 'images');
              }}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-orange-100 text-[#E06518] border border-orange-300 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>چرخ دنده پلاستیکی سفید (FAM-80301)</span>
            </button>
            <Link
              to="/product/FAM-34265?preview=1"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>مشاهده صفحهٔ «چرخ دنده» در سایت</span>
            </Link>
          </div>
            </div>
        </details>
        </>}
      </div>

      {/* 2. PRODUCTS & SKU FAMILIES TAB */}
      {activeSubTab === 'products' && (
        <div className="space-y-4">
          {/* Search & Filters Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="جستجو با نام کالا، کد، سایز یا برند..."
                  aria-label="جستجو در کاتالوگ کالاها"
                  className="w-full pr-10 pl-3 py-3 rounded-xl border border-slate-300 text-xs focus:border-[#E06518] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleOpenNewFamily}
                className="w-full sm:w-auto min-h-11 px-5 bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن کالا</span>
              </button>
            </div>

            <details className="rounded-xl border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer select-none px-3 py-3 text-xs font-bold text-slate-700">
                فیلترهای بیشتر: دسته‌بندی و وضعیت تصویر
                {(selectedMenuGroup !== 'all' || selectedCategory !== 'all' || selectedSubmenu !== 'all' || selectedSubcategory !== 'all' || imageFilter !== 'all') && <span className="mr-2 rounded-full bg-[#FFF0E5] px-2 py-1 text-[#B94D0A]">فیلتر فعال</span>}
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 pt-0">
                <label className="block text-xs font-bold text-slate-600">گروه‌بندی مگامنو (سطح ۱)
                  <select value={selectedMenuGroup} onChange={e=>{
                    setSelectedMenuGroup(e.target.value);setSelectedCategory('all');
                    setSelectedSubmenu('all');setSelectedSubcategory('all');setCurrentPage(1);
                  }} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs">
                    <option value="all">تمام سرگروه‌ها</option>
                    {approvedGroups.map(group=><option key={group.id} value={group.id}>{group.title}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-600">دسته‌های فایل (سطح ۲)
                  <select value={selectedCategory} onChange={e=>{
                    setSelectedCategory(e.target.value);setSelectedSubmenu('all');
                    setSelectedSubcategory('all');setCurrentPage(1);
                  }} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs">
                    <option value="all">همه دسته‌ها ({toPersianDigits(visibleMenuCategories.length)})</option>
                    {selectedMenuGroup==='all'&&<option value="unassigned">خانواده‌های هنوز دسته‌بندی‌نشده (نیازمند بررسی)</option>}
                    {visibleMenuCategories.map(cat=><option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-600">زیرمنو (سطح ۳)
                  <select value={selectedSubmenu} disabled={!selectedApprovedCategory}
                    onChange={e=>{setSelectedSubmenu(e.target.value);setSelectedSubcategory('all');setCurrentPage(1)}}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs disabled:opacity-50">
                    <option value="all">تمام زیرمنوها</option>
                    {menuSubmenus.map(name=><option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-600">ریزاقلام (سطح ۴)
                  <select value={selectedSubcategory} disabled={!selectedApprovedCategory}
                    onChange={e=>{setSelectedSubcategory(e.target.value);setCurrentPage(1)}}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs disabled:opacity-50">
                    <option value="all">تمام ریزاقلام</option>
                    {[...new Set(menuLeaves)].map(name=><option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  وضعیت تصویر
                  <select
                    value={imageFilter}
                    onChange={e => {
                      setImageFilter(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="mt-1.5 w-full px-3 py-3 rounded-xl border border-slate-300 text-xs bg-white focus:border-[#E06518] focus:outline-none"
                  >
                    <option value="all">همه وضعیت‌های تصویر</option>
                    <option value="sku_bound">دارای تصویر متصل به کد کالا</option>
                    <option value="has_images">دارای تصویر (عمومی یا کد)</option>
                    <option value="no_images">بدون تصویر ثبت‌شده</option>
                  </select>
                </label>
              </div>
            </details>
            {/* Secondary Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>فیلتر سریع:</span>
                </span>
                {[
                  { id: 'all', label: 'همه خانواده‌ها' },
                  { id: 'priced', label: 'دارای کد قیمت‌دار' },
                  { id: 'inquiry', label: 'فقط نیازمند استعلام' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPriceFilter(item.id as any);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                      priceFilter === item.id
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                <span className="text-slate-300 mx-1">|</span>

                {[
                  { id: 'all', label: 'همه وضعیت‌ها' },
                  { id: 'active', label: 'فعال در سایت' },
                  { id: 'inactive', label: 'غیرفعال موقت' },
                ].map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st.id as any);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                      statusFilter === st.id
                        ? 'bg-[#E06518] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <button type="button" onClick={downloadTechnicalAudit} className="rounded-lg border border-orange-200 px-3 py-1.5 font-bold text-[#E06518]">خروجی بررسی فنی همه کدها</button>
              <div className="text-slate-500">
                نمایش <strong>{toPersianDigits(filteredProducts.length)}</strong> خانواده محصول
              </div>
            </div>
          </div>

          {/* Mobile-first family cards: same actions as the desktop table without horizontal scrolling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {paginatedProducts.map(product => {
              const variants=product.variants||[];
              const gallery=product.galleryImages||[];
              const priced=variants.filter(v=>{const price=v.price??v.prices?.retail??0;const inquiry=v.inquiryOnly!==undefined?v.inquiryOnly:price<=0;return !inquiry&&price>0;});
              return <article key={product.code} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
                <div className="flex gap-3 min-w-0">
                  <div className="w-20 h-20 shrink-0 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
                    <ProductImage src={product.images?.[0]||gallery[0]?.url} alt={product.name} className="w-full h-full object-contain p-1"/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-sm text-[#55565A] leading-6">{product.name||"بدون نام"}</h3>
                    <p dir="ltr" className="text-[11px] font-mono text-slate-500 truncate text-right">{product.code}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{product.categoryName||"بدون دسته"}{product.subcategory ? " / "+product.subcategory : ""}</p>
                    <span className={product.active===false ? "inline-flex mt-2 rounded-full px-2 py-1 text-[10px] font-bold bg-rose-50 text-rose-700" : "inline-flex mt-2 rounded-full px-2 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700"}>{product.active===false?"غیرفعال":"فعال در سایت"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 p-2"><span className="block text-[10px] text-slate-500">کد کالا</span><strong className="text-xs text-[#E06518]">{toPersianDigits(variants.length)}</strong></div>
                  <div className="rounded-lg bg-slate-50 p-2"><span className="block text-[10px] text-slate-500">تصاویر</span><strong className="text-xs text-[#55565A]">{toPersianDigits(gallery.length||product.images?.length||0)}</strong></div>
                  <div className="rounded-lg bg-slate-50 p-2"><span className="block text-[10px] text-slate-500">قیمت‌دار</span><strong className="text-xs text-emerald-700">{toPersianDigits(priced.length)}/{toPersianDigits(variants.length)}</strong></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={()=>handleOpenEditFamily(product,"family")} className="rounded-xl bg-[#E06518] text-white py-2.5 text-xs font-bold flex justify-center items-center gap-1.5"><Edit2 size={14}/> مدیریت کالا</button>
                  <button type="button" onClick={()=>handleOpenEditFamily(product,"variants")} className="rounded-xl border border-slate-200 text-[#55565A] py-2.5 text-xs font-bold flex justify-center items-center gap-1.5"><Layers size={14}/> کدها و قیمت</button>
                  <button type="button" onClick={()=>handleOpenEditFamily(product,"images")} className="rounded-xl border border-slate-200 text-[#55565A] py-2.5 text-xs font-bold flex justify-center items-center gap-1.5"><ImageIcon size={14}/> تصاویر</button>
                  <button type="button" onClick={()=>handleToggleFamilyActive(product)} className={product.active===false ? "rounded-xl border border-emerald-200 text-emerald-700 py-2.5 text-xs font-bold flex justify-center items-center gap-1.5" : "rounded-xl border border-rose-200 text-rose-700 py-2.5 text-xs font-bold flex justify-center items-center gap-1.5"}>{product.active===false?<Eye size={14}/>:<EyeOff size={14}/>} {product.active===false?"فعال‌سازی":"غیرفعال‌سازی"}</button>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <Link to={"/product/"+encodeURIComponent(product.code)+"?preview=1"} className="text-xs text-[#C65A16] font-bold flex items-center gap-1"><ExternalLink size={13}/> پیش‌نمایش سایت</Link>
                  <button type="button" onClick={()=>handleResetFamily(product.code)} className="text-[11px] text-slate-500 flex items-center gap-1"><RotateCcw size={13}/> بازنشانی اطلاعات</button>
                </div>
              </article>;
            })}
          </div>
          {/* Desktop data table retains all catalog columns and operations */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">خانواده محصول (سطح ۱)</th>
                    <th className="py-3.5 px-3 font-bold">دسته‌بندی و زیرگروه</th>
                    <th className="py-3.5 px-3 font-bold">کدهای زیرمجموعه (سطح ۲)</th>
                    <th className="py-3.5 px-3 font-bold">تصاویر و اتصال به کدها</th>
                    <th className="py-3.5 px-3 font-bold">وضعیت قیمت کدها</th>
                    <th className="py-3.5 px-3 font-bold">وضعیت انتشار</th>
                    <th className="py-3.5 px-4 font-bold text-left">عملیات مدیریت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProducts.map(product => {
                    const variants = product.variants || [];
                    const gallery = product.galleryImages || [];
                    const skuImagesCount = gallery.filter(
                      g => g.scope === 'variant' && g.variantCode
                    ).length;
                    const familyImagesCount = gallery.filter(g => g.scope === 'family').length;
                    const pricedVariants = variants.filter(v => {
                      const pr = v.price ?? v.prices?.retail ?? 0;
                      const inq = v.inquiryOnly !== undefined ? v.inquiryOnly : pr <= 0;
                      return !inq && pr > 0;
                    });

                    return (
                      <tr
                        key={product.code}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          product.active === false ? 'bg-rose-50/30 opacity-75' : ''
                        }`}
                      >
                        {/* Family Info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                              <ProductImage
                                src={product.images?.[0]}
                                alt={product.name}
                                className="w-full h-full object-contain p-1"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-sm truncate max-w-[220px]">
                                {product.name}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span className="font-mono font-bold text-slate-700" dir="ltr">
                                  {product.code}
                                </span>
                                <span>·</span>
                                <span>برند: {product.brand || 'ثبت نشده'}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category & Subcategory */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-700">{product.categoryName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {product.submenu ? `${product.submenu} / ` : ''}
                            {product.subcategory}
                          </div>
                        </td>

                        {/* Variants Summary */}
                        <td className="py-3.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEditFamily(product, 'variants')}
                            className="text-right group cursor-pointer"
                          >
                            <div className="font-bold text-[#E06518] group-hover:underline flex items-center gap-1">
                              <span>{toPersianDigits(variants.length)} کد کالا (SKU)</span>
                              <Edit2 className="w-3 h-3" />
                            </div>
                            <div className="text-[10.5px] font-mono text-slate-500 truncate max-w-[160px] mt-0.5" dir="ltr">
                              {variants
                                .slice(0, 3)
                                .map(v => v.code)
                                .join(', ')}
                              {variants.length > 3 ? ' ...' : ''}
                            </div>
                          </button>
                        </td>

                        {/* Images Summary */}
                        <td className="py-3.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEditFamily(product, 'images')}
                            className="text-right cursor-pointer group space-y-0.5"
                          >
                            {gallery.length > 0 ? (
                              <>
                                <div className="font-bold text-slate-800 group-hover:text-[#E06518]">
                                  {toPersianDigits(gallery.length)} تصویر ثبت‌شده
                                </div>
                                <div className="text-[10.5px] text-slate-500">
                                  {skuImagesCount > 0 && (
                                    <span className="text-emerald-700 font-bold ml-1.5">
                                      {toPersianDigits(skuImagesCount)} اختصاصی کد
                                    </span>
                                  )}
                                  {familyImagesCount > 0 && (
                                    <span>{toPersianDigits(familyImagesCount)} عمومی خانواده</span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 group-hover:text-[#E06518]">
                                + افزودن و اتصال تصویر
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Pricing Status across SKUs */}
                        <td className="py-3.5 px-3">
                          {pricedVariants.length > 0 ? (
                            <div>
                              <div className="text-emerald-800 font-bold">
                                {toPersianDigits(pricedVariants.length)} از {toPersianDigits(variants.length)} کد قیمت‌دار
                              </div>
                              <div className="text-[10.5px] font-mono text-slate-600 mt-0.5">
                                از{' '}
                                {toPersianDigits(
                                  new Intl.NumberFormat('fa-IR').format(product.prices.retail)
                                )}{' '}
                                تومان
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-700 font-semibold">
                              نیازمند استعلام ({toPersianDigits(variants.length)} کد)
                            </span>
                          )}
                        </td>

                        {/* Active / Inactive Toggle */}
                        <td className="py-3.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleToggleFamilyActive(product)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                              product.active === false
                                ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            }`}
                          >
                            {product.active === false ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>غیرفعال موقت</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>فعال در سایت</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditFamily(product, 'family')}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#E06518] hover:text-white text-slate-700 font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="ویرایش خانواده، کدها، تصاویر و قیمت‌ها"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>مدیریت کامل</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditFamily(product, 'images')}
                              className="p-1.5 rounded-lg border border-slate-200 hover:border-[#E06518] text-slate-600 hover:text-[#E06518] transition-colors cursor-pointer"
                              title="مدیریت تصاویر و اتصال به کد کالا"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>

                            <Link
                              to={`/product/${encodeURIComponent(product.code)}?preview=1`}
                              className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-600 hover:text-slate-900 transition-colors"
                              title="پیش‌نمایش صفحه مشتری"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleResetFamily(product.code)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:border-amber-400 text-slate-500 hover:text-amber-700 transition-colors cursor-pointer"
                              title="بازنشانی به اطلاعات اولیه کاتالوگ"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 font-bold cursor-pointer"
                >
                  صفحه قبلی
                </button>
                <span className="font-semibold text-slate-600">
                  صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)} (کل:{' '}
                  {toPersianDigits(filteredProducts.length)} خانواده)
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 font-bold cursor-pointer"
                >
                  صفحه بعدی
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. CATEGORIES SUBTAB (ADD & EDIT CATEGORIES & SUBCATEGORIES) */}
      {activeSubTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#E06518]" />
                <span>مدیریت دسته‌بندی‌ها و زیرگروه‌های محصولات صنعتی</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                افزودن دسته‌بندی جدید، ویرایش نام، اسلاگ، توضیحات و زیرگروه‌های هر دسته در کاتالوگ سایت
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenCategoryModal()}
              className="px-4 py-2.5 bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ افزودن دسته‌بندی جدید</span>
            </button>
          </div>

          <CatalogNavigationGroupsEditor categories={approvedCategories}/>
          <CatalogFamilyTaxonomyManager/>

          <h4 className="text-sm font-black text-slate-700">دسته‌های مصوب و خانواده‌های مرتبط</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {approvedCategories.map(cat=>{
              const count=taxonomy.assignments.filter(item=>item.categorySlug===cat.slug).length;
              const group=approvedGroups.find(item=>item.categorySlugs.includes(cat.slug));
              return <article key={cat.slug} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-[10px] font-bold text-[#C45A18]">{group?.title||'سرگروه تأییدشده'}</p>
                  <h5 className="mt-1 text-sm font-black text-slate-800">{cat.name}</h5>
                  <p className="mt-2 text-xs text-slate-500">{toPersianDigits(cat.children?.length||0)} زیرمنو · {toPersianDigits(count)} خانواده متصل</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(cat.children||[]).slice(0,4).map(node=><span key={node.name} className="rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-600">{node.name}</span>)}
                  </div>
                </div>
                <button type="button" onClick={()=>openFamiliesInCategory(cat.slug)}
                  className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-[#C65A16]">
                  مشاهده خانواده‌ها و کالاها
                </button>
              </article>;
            })}
          </div>
          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-xs font-bold text-slate-500">ساختار قدیمی کاتالوگ (صرفاً جهت حفظ سازگاری)</summary>
            <p className="mt-2 text-xs leading-6 text-slate-600">این دسته‌ها برای لینک محصولات قدیمی حفظ شده‌اند، اما فهرست مصوب مگامنو و کاتالوگ از ۳۴ دسته بالا استفاده می‌کند. حذف رکوردهای قدیمی توصیه نمی‌شود.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              {categories.filter(cat=>cat.active!==false&&!/^excel-v2-/.test(cat.slug)).map(cat=>
                <div key={cat.slug} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <span className="font-bold">{cat.name}</span>
                  <p className="mt-1 text-[10px] text-slate-400" dir="ltr">{cat.slug}</p>
                </div>)}
            </div>
          </details>
        </div>
      )}

      {/* 4. BRANDS SUBTAB (IMAGE-FIRST BRAND SHOWCASE & EDITOR) */}
      {activeSubTab === 'brands' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#E06518]" />
                <span>مدیریت تصویری برندهای صنعتی (ویترین شناخت برند برای مشتری)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                برندها در سایت بیشتر با تصویر و نشان تجاری شناخته می‌شوند؛ در این بخش می‌توانید برند جدید با تصویر اختصاصی اضافه کنید یا تصاویر و مشخصات برندهای فعلی را ویرایش نمایید.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenBrandModal()}
              className="px-4 py-2.5 bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ افزودن برند تصویری جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {brands.map(b => {
              const brandImg = b.image || b.logo;
              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between bg-white shadow-2xs hover:shadow-md ${
                    b.active === false
                      ? 'border-slate-200 opacity-60'
                      : b.isExclusive
                      ? 'border-amber-300 ring-1 ring-amber-200/50'
                      : 'border-slate-200 hover:border-[#E06518]'
                  }`}
                >
                  <div>
                    {/* Visual Brand Image Header */}
                    <div className="relative h-36 bg-gradient-to-br from-slate-900 to-slate-800 p-4 flex items-center justify-center border-b border-slate-100 overflow-hidden">
                      {b.bannerImage && (
                        <img
                          src={b.bannerImage}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-20"
                        />
                      )}
                      <div className="relative z-10 w-full h-full bg-white rounded-xl p-2.5 flex items-center justify-center shadow-inner">
                        {brandImg ? (
                          <img
                            src={brandImg}
                            alt={b.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <div className="text-center">
                            <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                            <span className="text-[11px] text-slate-400 font-bold">بدون تصویر برند</span>
                          </div>
                        )}
                      </div>

                      {b.isExclusive && (
                        <span className="absolute top-2.5 right-2.5 z-20 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shadow-xs">
                          نمایندگی / انحصاری اطلس
                        </span>
                      )}
                      {b.active === false && (
                        <span className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                          غیرفعال
                        </span>
                      )}
                    </div>

                    {/* Brand Info Body */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-black text-sm text-slate-800">{b.name}</h4>
                        <span className="text-[11px] font-mono font-bold text-[#E06518]" dir="ltr">
                          {b.nameEn}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        کشور سازنده: <strong className="text-slate-700">{b.country}</strong>
                      </div>
                      {b.description && (
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                          {b.description}
                        </p>
                      )}
                      {b.specialties && b.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {b.specialties.map((sp, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                            >
                              {sp}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenBrandModal(b)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-orange-50 text-[#E06518] border border-orange-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>ویرایش برند و تصویر</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBrandItem(b.id)}
                      className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer transition-colors"
                      title="حذف برند"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          CATEGORY ADD / EDIT MODAL
         ===================================================================== */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-[180] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl max-h-[100dvh] sm:max-h-[92vh] rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-white text-[#55565A] border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#E06518]" />
                <span>
                  {categories.some(c => c.slug === editingCategory.slug)
                    ? `ویرایش دسته‌بندی: ${editingCategory.name}`
                    : 'افزودن دسته‌بندی جدید به سایت'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto max-h-[78vh]">
              <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 leading-6 text-[#55565A]">
                <strong className="block text-sm mb-1">دسته‌بندی برای مرتب‌کردن کالاهاست</strong>
                نام فارسی و توضیح کوتاه را وارد کنید؛ زیرگروه‌ها را پایین همین فرم اضافه کنید. شناسه مسیر و تنظیمات تکمیلی در بخش بازشونده‌اند.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نام فارسی دسته‌بندی *</label>
                  <input type="text" value={editingCategory.name} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} placeholder="مثلاً: تسمه‌های صنعتی یا چرخ‌دنده‌ها" className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold" />
                </div>
                <details className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer select-none font-bold text-slate-700">تنظیمات تکمیلی (اختیاری): نام انگلیسی، شناسه مسیر و تعداد</summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">نام انگلیسی</label>
                      <input type="text" dir="ltr" value={editingCategory.nameEn} onChange={e => setEditingCategory({ ...editingCategory, nameEn: e.target.value })} placeholder="Industrial Belts" className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">شناسه مسیر (Slug)</label>
                      <input type="text" dir="ltr" value={editingCategory.slug} onChange={e => setEditingCategory({ ...editingCategory, slug: e.target.value })} disabled={categories.some(c => c.id === editingCategory.id)} title="شناسه مسیر دسته‌بندی موجود تغییر نمی‌کند تا لینک محصولات حفظ شود." placeholder="industrial-belts" className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">تعداد خانواده محصول</label>
                      <input type="number" value={editingCategory.count || 0} onChange={e => setEditingCategory({ ...editingCategory, count: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono" />
                    </div>
                  </div>
                </details>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات دسته‌بندی</label>
                <textarea
                  rows={2}
                  value={editingCategory.description}
                  onChange={e =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  placeholder="توضیح کوتاه برای معرفی این گروه کالایی به مشتریان..."
                  className="w-full p-3 rounded-xl border border-slate-300"
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-black text-slate-800">تصویر دسته‌بندی</h4>
                <p className="text-[11px] text-slate-500">تصویر در فضای دائمی سرور ذخیره شده و در هدر، صفحه اصلی و صفحه دسته‌بندی نمایش داده می‌شود.</p>
                <div className="flex items-center gap-3">
                  <div className="h-24 w-28 flex items-center justify-center overflow-hidden rounded-xl bg-white border border-slate-200 shrink-0">
                    {editingCategory.image ? <img src={editingCategory.image} className="h-full w-full object-contain p-1" alt="پیش‌نمایش دسته‌بندی" /> : <ImageIcon className="text-slate-300" size={30} />}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#E06518] px-4 py-2.5 text-white font-bold">
                      <Upload size={16} /> {categoryImageUploading ? 'در حال بارگذاری...' : 'آپلود / تعویض تصویر'}
                      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={categoryImageUploading}
                        className="sr-only" onChange={e => { const file=e.target.files?.[0]; if(file) void handleCategoryImageUpload(file); e.target.value=''; }} />
                    </label>
                    {editingCategory.image && <button type="button" onClick={() => setEditingCategory({...editingCategory,image:''})} className="block text-[11px] font-bold text-rose-600">حذف تصویر از دسته</button>}
                    <p className="text-[10px] text-slate-500">حداکثر ۸ مگابایت؛ تصویر برای وب بهینه می‌شود.</p>
                  </div>
                </div>
              </div>

              {categoryImageCandidate && categoryImageCandidate!==editingCategory.image && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-orange-50/50 p-3">
                <ProductImage src={categoryImageCandidate} alt="تصویر انتخاب‌شده از بانک تصاویر" className="h-16 w-16 rounded-lg bg-white object-contain"/>
                <p className="min-w-0 flex-1 text-[11px] leading-5 font-bold text-slate-700">همین تصویر انتخاب‌شده در بررسی کالا را می‌توانید به دسته‌بندی اختصاص دهید.</p>
                <button type="button" onClick={()=>setEditingCategory({...editingCategory,image:categoryImageCandidate})} className="rounded-lg bg-[#E56B1E] px-3 py-2 text-xs font-bold text-white">انتخاب این تصویر برای دسته</button>
              </div>}
              <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white cursor-pointer">
                <input type="checkbox" checked={editingCategory.active !== false}
                  onChange={e => setEditingCategory({...editingCategory,active:e.target.checked})}
                  className="accent-[#E06518] h-4 w-4" />
                <span className="font-bold text-slate-800">نمایش دسته‌بندی در سایت و منوی همه محصولات</span>
              </label>

              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <h4 className="font-black text-slate-800">مدیریت نام و نمایش زیرمنوها</h4>
                  <p className="text-[11px] text-slate-500 leading-6">هر نام را مستقیم تغییر دهید یا مخفی کنید. تغییر نام، کلید فیلتر کالاهای موجود را عوض نمی‌کند.</p>
                </div>
                <CategoryTreeEditor nodes={editingCategory.children || []}
                  onChange={children => setEditingCategory(prev => prev ? {...prev,children,subcategories:children.filter(node => !node.hidden).map(node => node.name)} : prev)} />
              </div>

              {categorySaveError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{categorySaveError}</p>}

              <div className="sticky bottom-0 bg-white flex justify-end gap-2 pt-3 pb-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveCategoryModal()}
                  disabled={categorySavePending || categoryImageUploading}
                  className="px-5 py-2 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold cursor-pointer"
                >
                  {categorySavePending ? "در حال ذخیره..." : "ذخیره دسته‌بندی"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VISUAL BRAND ADD / EDIT MODAL (IMAGE-FIRST FOR CUSTOMER RECOGNITION)
         ===================================================================== */}
      {isBrandModalOpen && editingBrand && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 shadow-2xl overflow-hidden max-h-[100dvh] sm:max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 bg-white text-[#55565A] border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-black flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#E06518]" />
                  <span>
                    {brands.some(b => b.id === editingBrand.id)
                      ? `ویرایش برند و تصویر: ${editingBrand.name || editingBrand.nameEn}`
                      : 'افزودن برند تصویری جدید به سایت'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  تصویر و نشان تجاری برند برای شناخت سریع مشتری در صفحه اصلی و کاتالوگ نمایش داده می‌شود
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBrandModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Top Section: Live Visual Brand Preview + Image Upload Controls */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="md:col-span-5 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 p-4 text-[#55565A] relative overflow-hidden">
                  <span className="text-[10px] text-[#E06518] font-bold mb-2">
                    پیش‌نمایش کارت تصویری برند برای مشتری
                  </span>
                  <div className="w-44 h-28 bg-white rounded-xl p-2.5 flex items-center justify-center shadow-lg mb-2.5">
                    {editingBrand.image || editingBrand.logo ? (
                      <img
                        src={editingBrand.image || editingBrand.logo}
                        alt={editingBrand.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-slate-400">بدون تصویر</span>
                    )}
                  </div>
                  <div className="font-black text-sm text-center">
                    {editingBrand.name || 'نام فارسی برند'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {editingBrand.nameEn || 'BRAND NAME'} • {editingBrand.country}
                  </div>
                </div>

                <div className="md:col-span-7 space-y-3">
                  <div className="font-black text-slate-800 text-xs">
                    ۱. انتخاب یا بارگذاری تصویر اصلی برند (لوگو / نشان تجاری):
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="px-3.5 py-2 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs">
                      <Upload className="w-4 h-4" />
                      <span>بارگذاری فایل تصویر برند</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleBrandImageUpload(e, 'image')}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        const svg = generateBrandVisualSvg(
                          editingBrand.nameEn || editingBrand.name || 'BRAND',
                          editingBrand.country || 'INDUSTRIAL',
                          brandBadgeAccent
                        );
                        setEditingBrand({ ...editingBrand, image: svg, logo: svg });
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer"
                    >
                      ساخت خودکار نشان تصویری برند
                    </button>

                    <input
                      type="color"
                      value={brandBadgeAccent}
                      onChange={e => setBrandBadgeAccent(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer bg-white p-0.5"
                      title="انتخاب رنگ نشان برند"
                    />
                  </div>

                  <details className="rounded-xl border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer select-none font-bold text-slate-700">روش‌های دیگر انتخاب تصویر (لینک و نشان‌های آماده)</summary>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      یا لینک مستقیم تصویر برند (URL / Data URI):
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={editingBrand.image || ''}
                      onChange={e =>
                        setEditingBrand({
                          ...editingBrand,
                          image: e.target.value,
                          logo: e.target.value,
                        })
                      }
                      placeholder="https://... یا انتخاب از تصاویر کاتالوگ"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      انتخاب سریع از نشان‌های موجود یا تصاویر کاتالوگ:
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { label: 'نشان SWR', accent: '#f59e0b', title: 'SWR', sub: 'GERMANY' },
                        { label: 'نشان FORZA', accent: '#ef4444', title: 'FORZA', sub: 'HEAVY DUTY' },
                        { label: 'نشان OPTIBELT', accent: '#0284c7', title: 'OPTIBELT', sub: 'GERMANY' },
                        { label: 'نشان MEGADYNE', accent: '#10b981', title: 'MEGADYNE', sub: 'ITALY' },
                      ].map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const svg = generateBrandVisualSvg(
                              preset.title,
                              preset.sub,
                              preset.accent
                            );
                            setEditingBrand({ ...editingBrand, image: svg, logo: svg });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-[#E06518] text-[11px] font-bold cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  </details>
                </div>
              </div>

              {/* Brand Text & Identity Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نام فارسی برند *</label>
                  <input
                    type="text"
                    value={editingBrand.name}
                    onChange={e => setEditingBrand({ ...editingBrand, name: e.target.value })}
                    placeholder="مثلاً: اس دبلیو آر (SWR)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نام انگلیسی برند *</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editingBrand.nameEn}
                    onChange={e =>
                      setEditingBrand({ ...editingBrand, nameEn: e.target.value })
                    }
                    placeholder="SWR / FORZA / SKF"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">کشور سازنده</label>
                  <input
                    type="text"
                    value={editingBrand.country}
                    onChange={e =>
                      setEditingBrand({ ...editingBrand, country: e.target.value })
                    }
                    placeholder="مثلاً: آلمان / ایتالیا"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer select-none px-4 py-3 font-bold text-slate-700">اطلاعات تکمیلی برند (اختیاری): معرفی و حوزه‌های تخصصی</summary>
                <div className="p-4 space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  معرفی و توضیحات برند برای شناخت مشتری
                </label>
                <textarea
                  rows={2}
                  value={editingBrand.description}
                  onChange={e =>
                    setEditingBrand({ ...editingBrand, description: e.target.value })
                  }
                  placeholder="توضیح مختصر درباره کیفیت، کاربرد صنعتی و اصالت این برند..."
                  className="w-full p-3 rounded-xl border border-slate-300"
                />
              </div>

              {/* Brand Specialties */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">
                  حوزه‌های تخصصی این برند (تسمه تایمینگ، چرخ‌دنده، بلبرینگ و...)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={brandSpecialtyInput}
                    onChange={e => setBrandSpecialtyInput(e.target.value)}
                    placeholder="مثلاً: تسمه تایمینگ کوره..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!brandSpecialtyInput.trim()) return;
                      setEditingBrand({
                        ...editingBrand,
                        specialties: [
                          ...(editingBrand.specialties || []),
                          brandSpecialtyInput.trim(),
                        ],
                      });
                      setBrandSpecialtyInput('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 text-white font-bold cursor-pointer"
                  >
                    + افزودن تخصص
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(editingBrand.specialties || []).map((sp, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700"
                    >
                      <span>{sp}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingBrand({
                            ...editingBrand,
                            specialties: (editingBrand.specialties || []).filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                        className="text-rose-500 font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

                </div>
              </details>

              {/* Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(editingBrand.isExclusive)}
                    onChange={e =>
                      setEditingBrand({ ...editingBrand, isExclusive: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#E06518]"
                  />
                  <span>برند انحصاری / نمایندگی رسمی هایپرصنعت اطلس</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editingBrand.active !== false}
                    onChange={e =>
                      setEditingBrand({ ...editingBrand, active: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span>نمایش فعال در ویترین برندهای سایت</span>
                </label>
              </div>

              <div className="sticky bottom-0 bg-white flex justify-end gap-2 pt-3 pb-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBrandModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveBrandModal}
                  className="px-5 py-2 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold cursor-pointer shadow-xs"
                >
                  ذخیره برند و تصویر در سایت
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TWO-LEVEL FAMILY & SKU EDITOR MODAL
         ===================================================================== */}
      {isEditorOpen && draftFamily && (
        <div role="dialog" aria-modal="true" aria-label="ویرایش خانواده محصول" className="fixed inset-0 z-[180] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[94vh] rounded-none sm:rounded-3xl border-0 sm:border sm:border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Top Header */}
            <div className="px-3 sm:px-5 py-3 sm:py-4 bg-white text-[#55565A] border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-[#FFF2E8] text-[#B94D0A] px-2.5 py-1 rounded-lg" dir="ltr">
                    {draftFamily.code}
                  </span>
                  <h3 className="text-base font-black">
                    {isCreatingNewFamily
                      ? 'افزودن خانواده محصول جدید'
                      : `مدیریت خانواده محصول: ${draftFamily.name}`}
                  </h3>
                  {draftFamily.active === false && (
                    <span className="text-[11px] bg-rose-500 text-white px-2 py-0.5 rounded-md font-bold">
                      غیرفعال موقت
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  سطح ۱: اطلاعات مشترک خانواده | سطح ۲: کدهای کالا ({toPersianDigits(draftFamily.variants?.length || 0)} کد)، مشخصات اختصاصی، تصاویر متصل و قیمت هر کد
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={()=>void handleSaveDraftFamily()}
                  disabled={familySavePending}
                  className="px-4 py-2 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>ذخیره تغییرات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  بستن
                </button>
              </div>
            </div>

            {/* Save Toast Feedback */}
            {saveFeedback && (
              <div className="bg-emerald-600 text-white text-xs font-bold px-5 py-2.5 flex items-center justify-between">
                <span>{saveFeedback}</span>
                <Link
                  to={`/product/${encodeURIComponent(draftFamily.code)}?preview=1`}
                  className="underline text-white font-bold flex items-center gap-1"
                >
                  <span>مشاهده در صفحه محصول</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* 4 Step Tabs inside Editor */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 border-b border-slate-200 bg-slate-50 p-3 shrink-0">
              {[
                {
                  id: 'family',
                  label: 'اطلاعات خانواده',
                  description: 'نام، دسته و مشخصات مشترک',
                },
                {
                  id: 'variants',
                  label: 'کدهای کالا و قیمت',
                  description: `${toPersianDigits(draftFamily.variants?.length || 0)} کد کالا`,
                },
                {
                  id: 'images',
                  label: 'تصاویر کالا',
                  description: `${toPersianDigits(draftFamily.galleryImages?.length || 0)} تصویر`,
                },
                {
                  id: 'preview',
                  label: 'پیش‌نمایش سایت',
                  description: 'بررسی قبل از انتشار',
                },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEditorTab(tab.id as any)}
                  aria-current={editorTab === tab.id ? 'step' : undefined}
                  className={`min-w-0 rounded-xl border p-3 text-right cursor-pointer transition-colors ${
                    editorTab === tab.id
                      ? 'border-[#E06518] bg-[#FFF4EB] text-[#B94D0A] shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-xs font-black">{tab.label}</span>
                  <span className="block text-[10px] font-medium mt-1 opacity-80">{tab.description}</span>
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
              {/* ===============================================================
                  TAB 1: FAMILY LEVEL (نام، دسته‌بندی، توضیحات، مشخصات مشترک)
                 =============================================================== */}
              {editorTab === 'family' && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-xs leading-6 text-[#55565A]">
                    <strong className="block text-sm mb-1">اطلاعات کلی این محصول</strong>
                    نام، دسته، برند و توضیحاتی را وارد کنید که بین همه سایزها و مدل‌های این خانواده مشترک‌اند. برای کد و قیمت هر سایز، بخش «کدهای کالا و قیمت» را باز کنید.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        شناسه داخلی خانواده
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={draftFamily.code}
                        onChange={e =>
                          setDraftFamily({ ...draftFamily, code: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نام خانواده محصول (مثلاً: چرخ دنده)
                      </label>
                      <input
                        type="text"
                        value={draftFamily.name}
                        onChange={e =>
                          setDraftFamily({ ...draftFamily, name: e.target.value })
                        }
                        placeholder="مثلاً چرخ دنده"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3 space-y-3 rounded-xl border border-orange-200 bg-orange-50/30 p-3">
                      <h4 className="text-sm font-bold text-slate-800">دسته‌بندی استاندارد صنعت پیش</h4>
                      <p className="text-[11px] leading-6 text-slate-600">همان گروه‌ها، دسته‌ها و زیرمنوهای مگامنو و کاتالوگ؛ مسیر قدیمی محصولات برای سازگاری حفظ می‌شود.</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="text-xs font-bold text-slate-700">گروه‌بندی (سطح ۱)
                          <select value={draftMenuGroup} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5"
                            onChange={e=>{setDraftMenuGroup(e.target.value);setDraftMenuCategory('');setDraftMenuSubmenu('');setDraftMenuLeaf('');}}>
                            <option value="">انتخاب سرگروه</option>
                            {approvedGroups.map(group=><option key={group.id} value={group.id}>{group.title}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-bold text-slate-700">دسته (سطح ۲)
                          <select value={draftMenuCategory} disabled={!draftMenuGroup}
                            onChange={e=>{setDraftMenuCategory(e.target.value);setDraftMenuSubmenu('');setDraftMenuLeaf('');}}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 disabled:opacity-50">
                            <option value="">انتخاب دسته</option>
                            {approvedCategories.filter(cat=>approvedGroups.find(g=>g.id===draftMenuGroup)?.categorySlugs.includes(cat.slug))
                              .map(cat=><option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-bold text-slate-700">زیرمنو (سطح ۳)
                          <select value={draftMenuSubmenu} disabled={!draftMenuCategory}
                            onChange={e=>{setDraftMenuSubmenu(e.target.value);setDraftMenuLeaf('');}}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 disabled:opacity-50">
                            <option value="">انتخاب زیرمنو</option>
                            {editorSubmenus.map(node=><option key={node.name} value={node.name}>{node.name}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-bold text-slate-700">زیرمنوی زیرمنو (سطح ۴)
                          <select value={draftMenuLeaf} disabled={!draftMenuSubmenu}
                            onChange={e=>setDraftMenuLeaf(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 disabled:opacity-50">
                            <option value="">بدون ریزقلم مشخص</option>
                            {editorLeaves.map(node=><option key={node.name} value={node.name}>{node.name}</option>)}
                          </select>
                        </label>
                      </div>
                      {!taxonomy.assignmentsLoaded&&<p className="text-[11px] text-amber-700">{taxonomy.loadError||'در حال دریافت ارتباط خانواده‌ها از دیتابیس'}</p>}
                      <p className="text-[11px] text-slate-500">دسته قدیمی این خانواده: {draftFamily.categoryName} · {draftFamily.submenu||'—'} / {draftFamily.subcategory||'—'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          برند پیش‌فرض خانواده
                        </label>
                        <input
                          type="text"
                          value={draftFamily.brand}
                          onChange={e =>
                            setDraftFamily({ ...draftFamily, brand: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          واحد شمارش
                        </label>
                        <input
                          type="text"
                          value={draftFamily.unit}
                          onChange={e =>
                            setDraftFamily({ ...draftFamily, unit: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Family Publication Status */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        وضعیت نمایش خانواده در سایت
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        می‌توانید این خانواده محصول را موقتاً غیرفعال کنید و پیش از انتشار نهایی، در تب «پیش‌نمایش زنده» نتیجه را بررسی کنید.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFamily({
                          ...draftFamily,
                          active: draftFamily.active === false ? true : false,
                        })
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        draftFamily.active === false
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {draftFamily.active === false
                        ? 'وضعیت فعلی: غیرفعال موقت (کلیک برای انتشار)'
                        : 'وضعیت فعلی: فعال و منتشرشده در سایت'}
                    </button>
                  </div>

                  {/* General Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      توضیحات عمومی خانواده محصول
                    </label>
                    <textarea
                      rows={3}
                      value={draftFamily.description || ''}
                      onChange={e =>
                        setDraftFamily({ ...draftFamily, description: e.target.value })
                      }
                      className="w-full p-3 rounded-xl border border-slate-300 text-xs leading-relaxed"
                      placeholder="توضیحات مشترک خانواده محصول و کاربرد آن در خطوط تولید..."
                    />
                  </div>

                  {/* Shared Family Technical Specs */}
                  <details className="rounded-2xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer select-none px-4 py-3 text-xs font-black text-slate-800">مشخصات فنی مشترک (اختیاری) — برای همه کدهای این خانواده</summary>
                    <div className="px-4 pb-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-slate-800">
                          مشخصات فنی مشترک خانواده محصول
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          این مشخصات بین تمام کدهای زیرمجموعهٔ این خانواده مشترک است (مشخصات اختصاصی هر کد را در تب ۲ وارد کنید).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftFamily({
                            ...draftFamily,
                            technicalSpecs: [
                              ...(draftFamily.technicalSpecs || []),
                              { key: '', value: '' },
                            ],
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold cursor-pointer"
                      >
                        + افزودن مشخصه مشترک
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(draftFamily.technicalSpecs || []).map((spec, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            placeholder="عنوان ویژگی (مثلاً استاندارد دندانه)"
                            value={spec.key}
                            onChange={e => {
                              const next = [...(draftFamily.technicalSpecs || [])];
                              next[idx] = { ...next[idx], key: e.target.value };
                              setDraftFamily({ ...draftFamily, technicalSpecs: next });
                            }}
                            className="col-span-5 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                          />
                          <input
                            type="text"
                            placeholder="مقدار ویژگی"
                            value={spec.value}
                            onChange={e => {
                              const next = [...(draftFamily.technicalSpecs || [])];
                              next[idx] = { ...next[idx], value: e.target.value };
                              setDraftFamily({ ...draftFamily, technicalSpecs: next });
                            }}
                            className="col-span-6 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = (draftFamily.technicalSpecs || []).filter(
                                (_, i) => i !== idx
                              );
                              setDraftFamily({ ...draftFamily, technicalSpecs: next });
                            }}
                            className="col-span-1 p-2 text-rose-600 hover:bg-rose-50 rounded-lg flex justify-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                    </div>
                    </details>
                </div>
              )}

              {/* ===============================================================
                  TAB 2: SKU VARIANTS LEVEL (کد کالا، سایز، مدل، مشخصات اختصاصی، قیمت هر کد)
                 =============================================================== */}
              {editorTab === 'variants' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-12 rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-xs leading-6 text-[#55565A]">
                    <strong>هر کد کالا نماینده یک سایز یا مدل مشخص است.</strong> ابتدا کد را از فهرست انتخاب کنید؛ سپس نام دقیق، مشخصات، قیمت و موجودی همان کد را ویرایش کنید. مشخصات فنی تکمیلی در بخش بازشونده قرار دارد.
                  </div>
                  {/* Left Column: List of SKU Variants in this Family */}
                  <div className="lg:col-span-4 bg-slate-50 rounded-2xl border border-slate-200 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-800">
                        کدهای کالای زیرمجموعه ({toPersianDigits(draftFamily.variants?.length || 0)})
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddVariantToDraft}
                        className="px-2.5 py-1.5 rounded-lg bg-[#E06518] hover:bg-[#C95210] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن کد جدید</span>
                      </button>
                    </div>

                    {(draftFamily.variants?.length || 0) > 4 && (
                      <input
                        type="search"
                        value={variantSearchQuery}
                        onChange={e => setVariantSearchQuery(e.target.value)}
                        placeholder="جستجوی کد یا سایز..."
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
                      />
                    )}

                    <div className="max-h-[460px] overflow-y-auto space-y-2 pr-0.5">
                      {(draftFamily.variants || [])
                        .filter(v => {
                          if (!variantSearchQuery.trim()) return true;
                          const q = normalizeCatalogueText(variantSearchQuery);
                          return normalizeCatalogueText(
                            `${v.code} ${v.name} ${v.size} ${v.model || ''}`
                          ).includes(q);
                        })
                        .map(v => {
                          const isSel = currentEditingVariant?.code === v.code;
                          const linkedCount = (draftFamily.galleryImages || []).filter(
                            g => g.scope === 'variant' && g.variantCode === v.code
                          ).length;
                          const pr = v.price ?? v.prices?.retail ?? 0;
                          const inq = v.inquiryOnly !== undefined ? v.inquiryOnly : pr <= 0;

                          return (
                            <div
                              key={v.code}
                              onClick={() => setEditingVariantCode(v.code)}
                              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                isSel
                                  ? 'bg-white border-[#E06518] ring-2 ring-[#E06518]/20 shadow-xs'
                                  : 'bg-white/80 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-black text-[#E06518]" dir="ltr">
                                  {v.code}
                                </span>
                                <div className="flex items-center gap-1">
                                  {v.active === false && (
                                    <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">
                                      غیرفعال
                                    </span>
                                  )}
                                  {linkedCount > 0 && (
                                    <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-bold">
                                      {toPersianDigits(linkedCount)} عکس
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                                {v.name}
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                                <span>سایز: {v.size || '—'}</span>
                                {!inq && pr > 0 ? (
                                  <span className="font-mono font-bold text-emerald-700">
                                    {toPersianDigits(new Intl.NumberFormat('fa-IR').format(pr))} ت
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-semibold">استعلامی</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Right Column: Detailed Editor for Selected SKU Variant */}
                  <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-5">
                    {currentEditingVariant ? (
                      <>
                        {technicalReview && <details className="rounded-xl border border-orange-200 bg-orange-50/40"><summary className="cursor-pointer select-none px-3 py-2 text-xs font-bold text-[#55565A]">جزئیات بررسی فنی و منابع (اختیاری)</summary><div className="p-3 space-y-2 text-xs leading-6">
                          <strong>بررسی فنی کد کالا</strong>
                          <p>{technicalReview.categoryPath.join(' ← ')}</p>
                          <p>وضعیت: {technicalReview.status === 'reference-enriched' ? 'دارای اطلاعات مرجع پروفیل' : technicalReview.status === 'catalog-extracted' ? 'استخراج از شرح کاتالوگ' : 'نیازمند شناسایی مدل'}</p>
                          <p>اطلاعات مورد نیاز: {technicalReview.missing.join('، ')}</p>
                          {technicalReview.catalogPartCode&&<p>کد موجود در نام اصلی کالا: {technicalReview.catalogPartCode}؛ به معنی کد استاندارد نیست.</p>}
                          {technicalReview.ownerCatalogue&&<p>تطبیق کد اصلی با جدول کاتالوگ اطلس: صفحهٔ چاپی {technicalReview.ownerCatalogue.printedPage}؛ صفحهٔ PDF {technicalReview.ownerCatalogue.pdfPage}.</p>}
                          {technicalReview.researchWarnings?.map(warning=><p key={warning} className="text-amber-800">نیازمند تطبیق: {warning}</p>)}
                          <p>بررسی تکمیلی: {technicalReview.requiredChecks?.join('، ')}</p>
                          {technicalReview.originalTechnicalType && technicalReview.originalTechnicalType !== technicalReview.categoryPath[2] && <p>نوع فنی اولیهٔ خانواده: {technicalReview.originalTechnicalType}؛ نوع دقیق این کد را پیش از تغییر کل خانواده بررسی کنید.</p>}
                          {technicalReview.comparisonReferences?.map(ref=><p key={ref.url}><a href={ref.url} target="_blank" rel="noopener noreferrer" className="underline text-[#E06518]">{ref.title}</a> — فقط مرجع مقایسه: {ref.condition}</p>)}
                          <div className="flex flex-wrap gap-3">{technicalReview.references.map(ref => <a key={ref.url} href={ref.url} target="_blank" rel="noopener noreferrer" className="underline text-[#E06518]">{ref.title}</a>)}</div>
                        </div></details>}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div>
                            <h4 className="text-sm font-black text-slate-800">
                              ویرایش کد کالای انتخاب‌شده:{' '}
                              <span className="font-mono text-[#E06518]" dir="ltr">
                                {currentEditingVariant.code}
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              قیمت، مشخصات فنی اختصاصی، سایز و تصاویر متصل به این کد کالا را تنظیم کنید.
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateCurrentVariant(v => ({
                                  ...v,
                                  active: v.active === false ? true : false,
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                currentEditingVariant.active === false
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {currentEditingVariant.active === false
                                ? 'غیرفعال موقت (کلیک برای فعال‌سازی)'
                                : 'فعال در صفحه محصول'}
                            </button>

                            {(draftFamily.variants?.length || 0) > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteVariantFromDraft(currentEditingVariant.code)
                                }
                                className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                              >
                                حذف این کد
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Basic Variant Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              کد کالا (SKU مستقل)
                            </label>
                            <input
                              type="text"
                              dir="ltr"
                              value={currentEditingVariant.code}
                              onChange={e =>
                                updateCurrentVariant(v => ({ ...v, code: e.target.value }))
                              }
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              نام دقیق این کد کالا
                            </label>
                            <input
                              type="text"
                              value={currentEditingVariant.name}
                              onChange={e =>
                                updateCurrentVariant(v => ({ ...v, name: e.target.value }))
                              }
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              سایز / ابعاد
                            </label>
                            <input
                              type="text"
                              value={currentEditingVariant.size}
                              onChange={e =>
                                updateCurrentVariant(v => ({ ...v, size: e.target.value }))
                              }
                              placeholder="مثلاً Z18 — قطر ۸۰ × شفت ۲۵"
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              مدل فنی
                            </label>
                            <input
                              type="text"
                              dir="ltr"
                              value={currentEditingVariant.model || ''}
                              onChange={e =>
                                updateCurrentVariant(v => ({ ...v, model: e.target.value }))
                              }
                              placeholder="مثلاً SG-Z18-M4"
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              برند این کد کالا
                            </label>
                            <input
                              type="text"
                              value={currentEditingVariant.brand || ''}
                              onChange={e =>
                                updateCurrentVariant(v => ({ ...v, brand: e.target.value }))
                              }
                              placeholder={draftFamily.brand}
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                            />
                          </div>
                        </div>

                        {/* SKU-Owned Pricing & Inventory Section */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h5 className="text-xs font-black text-slate-800">
                                قیمت و موجودی اختصاصی کد {currentEditingVariant.code}
                              </h5>
                              <p className="text-[11px] text-slate-500">
                                اگر این کد قیمت مشخصی ندارد، گزینهٔ «نیازمند استعلام» را فعال کنید.
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() =>
                                  updateCurrentVariant(v => {
                                    const defaultPrice =
                                      (v.price && v.price > 0 ? v.price : 1500000);
                                    return {
                                      ...v,
                                      inquiryOnly: false,
                                      price: defaultPrice,
                                      stockKnown: true,
                                    };
                                  })
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                  !currentEditingVariant.inquiryOnly &&
                                  (currentEditingVariant.price || 0) > 0
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                دارای قیمت مشخص
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCurrentVariant(v => ({
                                    ...v,
                                    inquiryOnly: true,
                                    price: 0,
                                  }))
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                  currentEditingVariant.inquiryOnly ||
                                  (currentEditingVariant.price || 0) <= 0
                                    ? 'bg-amber-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                نیازمند استعلام
                              </button>
                            </div>
                          </div>

                          {!currentEditingVariant.inquiryOnly &&
                          (currentEditingVariant.price || 0) > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  قیمت فروش این کد (تومان)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="10000"
                                  value={currentEditingVariant.price || 0}
                                  onChange={e => {
                                    const val = Math.max(0, Number(e.target.value) || 0);
                                    updateCurrentVariant(v => ({
                                      ...v,
                                      price: val,
                                      inquiryOnly: val <= 0,
                                      prices: {
                                        base: Math.round(val * 0.8),
                                        retail: val,
                                        wholesale: Math.round(val * 0.9),
                                        dealer: Math.round(val * 0.84),
                                      },
                                    }));
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-emerald-400 bg-white text-xs font-mono font-bold text-emerald-900"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  موجودی انبار ({currentEditingVariant.unit || draftFamily.unit})
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={currentEditingVariant.stock ?? 0}
                                  onChange={e =>
                                    updateCurrentVariant(v => ({
                                      ...v,
                                      stock: Math.max(0, Number(e.target.value) || 0),
                                      stockKnown: true,
                                    }))
                                  }
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                                />
                              </div>

                              <div className="flex flex-col justify-end">
                                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                                  نمایش در سایت:{' '}
                                  <strong className="font-mono">
                                    {toPersianDigits(
                                      new Intl.NumberFormat('fa-IR').format(
                                        currentEditingVariant.price || 0
                                      )
                                    )}{' '}
                                    تومان
                                  </strong>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                              این کد کالا در صفحه محصول با وضعیت <strong>«نیازمند استعلام»</strong> نمایش داده می‌شود و مشتری می‌تواند برای همین کد درخواست قیمت ثبت کند.
                            </div>
                          )}
                        </div>

                        {/* Variant-Specific Technical Specs */}
                        <details open={showSkuTechnicalSpecs} onToggle={event=>setShowSkuTechnicalSpecs(event.currentTarget.open)}
                          className="rounded-xl border border-slate-200 bg-white">
                          <summary className="cursor-pointer select-none px-3 py-3 text-xs font-bold text-slate-700">
                            مشخصات فنی کد {currentEditingVariant.code} — {toPersianDigits((currentEditingVariant.technicalSpecs||[]).filter(s=>s.key.trim()).length)} مشخصه
                          </summary>
                          <div className="px-3 pb-3 space-y-3">
<div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="text-xs font-black text-slate-800">
                                مشخصات فنی مخصوص کد {currentEditingVariant.code}
                              </h5>
                              <p className="text-[11px] text-slate-500">
                                ویژگی‌هایی که مختص همین کد/سایز است (مثل تعداد دندانه، قطر شفت، جنس یا مدول).
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                updateCurrentVariant(v => ({
                                  ...v,
                                  technicalSpecs: [
                                    ...(v.technicalSpecs || []),
                                    { key: '', value: '' },
                                  ],
                                }))
                              }
                              className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-bold cursor-pointer"
                            >
                              + افزودن مشخصه فنی کد
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(currentEditingVariant.technicalSpecs || []).map((sp, sIdx) => (
                              <div key={sIdx} className="grid grid-cols-12 gap-2 items-center">
                                <input
                                  type="text"
                                  placeholder="عنوان مشخصه (مثلاً تعداد دندانه Z)"
                                  value={sp.key}
                                  onChange={e =>
                                    updateCurrentVariant(v => {
                                      const next = [...(v.technicalSpecs || [])];
                                      next[sIdx] = { ...next[sIdx], key: e.target.value };
                                      return { ...v, technicalSpecs: next };
                                    })
                                  }
                                  className="col-span-5 px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                                />
                                <input
                                  type="text"
                                  placeholder="مقدار مشخصه (مثلاً ۱۸ دندانه ساده)"
                                  value={sp.value}
                                  onChange={e =>
                                    updateCurrentVariant(v => {
                                      const next = [...(v.technicalSpecs || [])];
                                      next[sIdx] = { ...next[sIdx], value: e.target.value };
                                      return { ...v, technicalSpecs: next };
                                    })
                                  }
                                  className="col-span-6 px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCurrentVariant(v => ({
                                      ...v,
                                      technicalSpecs: (v.technicalSpecs || []).filter(
                                        (_, i) => i !== sIdx
                                      ),
                                    }))
                                  }
                                  className="col-span-1 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg flex justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {(!currentEditingVariant.technicalSpecs ||
                              currentEditingVariant.technicalSpecs.length === 0) && (
                              <p className="text-xs text-slate-400 italic">
                                هنوز مشخصه فنی اختصاصی برای این کد ثبت نشده است.
                              </p>
                            )}
                          </div>
                        </div>
                          </div>
                        </details>

{/* Images Linked to this SKU Variant */}
                        <div className="p-4 rounded-2xl bg-orange-50/40 border border-orange-200/80 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <h5 className="text-xs font-black text-slate-800">
                                تصاویر متصل به کد کالای {currentEditingVariant.code}
                              </h5>
                              <p className="text-[11px] text-slate-500">
                                با کلیک مشتری روی هر یک از این تصاویر، کد {currentEditingVariant.code} خودکار انتخاب می‌شود.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setNewImgScope('variant');
                                setNewImgVariantCode(currentEditingVariant.code);
                                setEditorTab('images');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#E06518] text-white text-[11px] font-bold cursor-pointer"
                            >
                              مدیریت و افزودن تصویر برای این کد
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2.5">
                            {(draftFamily.galleryImages || [])
                              .filter(
                                g =>
                                  g.scope === 'variant' &&
                                  g.variantCode === currentEditingVariant.code
                              )
                              .map(img => (
                                <div
                                  key={img.id}
                                  className="w-20 h-20 rounded-xl border border-orange-300 bg-white p-1.5 relative group"
                                >
                                  <ProductImage
                                    src={img.url}
                                    alt={img.title || currentEditingVariant.code}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              ))}
                            {(draftFamily.galleryImages || []).filter(
                              g =>
                                g.scope === 'variant' &&
                                g.variantCode === currentEditingVariant.code
                            ).length === 0 && (
                              <span className="text-xs text-slate-500">
                                تصویر اختصاصی برای این کد ثبت نشده است. تصویر عمومی خانواده شاهد تطبیق همین کد نیست.
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}

              {/* ===============================================================
                  TAB 3: IMAGE MANAGER & SKU BINDING (اتصال هر تصویر به کد کالا / اصلاح ارتباط‌ها)
                 =============================================================== */}
              {editorTab === 'images' && (
                <div className="space-y-4 sm:space-y-5">
                  <div className="rounded-2xl border border-[#E8EAEE] bg-white p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-sm font-black text-[#55565A]">افزودن تصویر</h4>
                        <p className="text-xs text-slate-500 mt-1">۱. منبع تصویر را انتخاب کنید، ۲. نوع اتصال را تعیین کنید، ۳. تصویر را اضافه کنید.</p>
                      </div>
                      <span className="rounded-full bg-[#FFF2E8] text-[#B94D0A] px-3 py-1 text-xs font-bold">{toPersianDigits(draftFamily.galleryImages?.length || 0)} تصویر ثبت‌شده</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4" role="group" aria-label="انتخاب منبع تصویر">
                      {[
                        {id:'catalogue' as const,title:'بانک کاتالوگ',desc:'انتخاب از ۸۶۹ تصویر'},
                        {id:'upload' as const,title:'بارگذاری فایل',desc:'از دستگاه شما'},
                        {id:'url' as const,title:'لینک مستقیم',desc:'آدرس تصویر آنلاین'},
                      ].map(source => (
                        <button key={source.id} type="button" aria-pressed={newImgSourceType===source.id}
                          onClick={() => setNewImgSourceType(source.id)}
                          className={`rounded-xl border p-3 text-right transition-colors ${newImgSourceType===source.id?'border-[#E06518] bg-[#FFF6EF] ring-1 ring-[#E06518]/20':'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'}`}>
                          <span className="block text-xs font-black text-[#55565A]">{source.title}</span>
                          <span className="block text-[11px] text-slate-500 mt-1">{source.desc}</span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 p-3 sm:p-4 space-y-3">
                      <div>
                        <h5 className="text-xs font-black text-[#55565A]">ارتباط تصویر</h5>
                        <p className="text-[11px] text-slate-500 mt-1">مشخص کنید تصویر عمومی خانواده است یا فقط به یک کد کالا تعلق دارد.</p>
                      </div>
                      <label className="block text-xs font-bold text-slate-700">نوع اتصال
                        <select value={newImgScope === 'family' ? '__FAMILY__' : newImgVariantCode || '__SELECT_SKU__'}
                          onChange={e => {const val=e.target.value;if(val==='__FAMILY__'){setNewImgScope('family');setNewImgVariantCode('')}else if(val==='__SELECT_SKU__'){setNewImgScope('variant');setNewImgVariantCode('')}else{setNewImgScope('variant');setNewImgVariantCode(val)}setImageFormFeedback(null)}}
                          className="mt-2 w-full px-3 py-3 rounded-xl border border-slate-300 bg-white text-xs">
                          <option value="__FAMILY__">تصویر عمومی خانواده — کد انتخاب‌شده مشتری تغییر نمی‌کند</option>
                          <option value="__SELECT_SKU__" disabled>انتخاب کد کالا…</option>
                          {(draftFamily.variants||[]).map(v=><option key={v.code} value={v.code}>{v.code} — {v.name}{v.size? ` (${v.size})`:''}</option>)}
                        </select>
                      </label>
                      {newImgScope==='variant'&&newImgVariantCode&&<div className="rounded-lg bg-[#FFF6EF] border border-[#F4D4BE] p-3 text-xs text-[#88400F]">تصویر برای کد <b dir="ltr">{newImgVariantCode}</b> ثبت می‌شود. فقط پس از تطبیق شکل، اندازه و مشخصات فنی، تأیید هویت را انجام دهید.</div>}
                      <details>
                        <summary className="cursor-pointer select-none text-xs font-bold text-slate-600 py-1">عنوان یا توضیح تصویر (اختیاری)</summary>
                        <input type="text" value={newImgTitle} onChange={e=>setNewImgTitle(e.target.value)} placeholder="مثلاً نمای روبه‌رو قطعه"
                          className="mt-2 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs"/>
                      </details>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 sm:p-4">
                      {newImgSourceType === 'catalogue' && (
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_84px_auto] gap-3 items-end">
                          <label className="block text-xs font-bold text-slate-700">شماره تصویر کاتالوگ
                            <span className="block text-[11px] font-normal text-slate-500 mt-1">عدد بین ۱ تا {toPersianDigits(TOTAL_OFFICIAL_IMAGES_COUNT)}</span>
                            <input type="number" min={1} max={TOTAL_OFFICIAL_IMAGES_COUNT} value={catalogueImgNum}
                              onChange={e => setCatalogueImgNum(Math.min(TOTAL_OFFICIAL_IMAGES_COUNT,Math.max(1,parseInt(e.target.value)||1)))}
                              className="mt-2 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono" />
                          </label>
                          <div className="h-[84px] w-full sm:w-[84px] rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <ProductImage src={getProductImageUrl(`e(${catalogueImgNum}).png`)} alt={`e(${catalogueImgNum}).png`} className="w-full h-full object-contain p-2"/>
                          </div>
                          <button type="button" onClick={() => handleAddImageToDraft(getProductImageUrl(`e(${catalogueImgNum}).png`),`e(${catalogueImgNum}).png`)}
                            className="w-full sm:w-auto h-11 px-5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-black">افزودن تصویر</button>
                        </div>
                      )}
                      {newImgSourceType === 'upload' && (
                        <label className="min-h-24 px-4 py-5 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#E06518] bg-white text-[#55565A] flex flex-col items-center justify-center gap-2 cursor-pointer">
                          <Upload className="w-5 h-5 text-[#E06518]"/>
                          <span className="text-sm font-bold">انتخاب تصویر از دستگاه</span>
                          <span className="text-[11px] text-slate-500">PNG، JPG، WebP تا ۸ مگابایت — ذخیره دائمی روی سرور</span>
                          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={productImageUploading} onChange={e => {void handleFileUpload(e)}} className="hidden"/>
                        </label>
                      )}
                      {newImgSourceType === 'url' && (
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-700">آدرس مستقیم تصویر</label>
                          <input type="url" dir="ltr" value={customImgUrl} onChange={e => setCustomImgUrl(e.target.value)}
                            placeholder="https://example.com/image.png" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono"/>
                          <button type="button" onClick={() => handleAddImageToDraft(customImgUrl)}
                            disabled={!/^https?:\/\//i.test(customImgUrl.trim())}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-black disabled:opacity-40">افزودن تصویر از لینک</button>
                        </div>
                      )}
                    </div>
                                        {imageFormFeedback&&<div role="status" className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${imageFormFeedback.startsWith('تصویر به پیش‌نویس')?'bg-emerald-50 border-emerald-200 text-emerald-800':'bg-amber-50 border-amber-200 text-amber-900'}`}>{imageFormFeedback}</div>}
                  </div>

                  <div className="rounded-2xl border border-[#E8EAEE] bg-white overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
                      <div>
                        <h4 className="text-sm font-black text-[#55565A]">تصاویر فعلی خانواده</h4>
                        <p className="text-[11px] text-slate-500 mt-1">ارتباط و عنوان را همین‌جا ویرایش کنید؛ عملیات کم‌استفاده در منوی هر تصویر قرار دارد.</p>
                      </div>
                      <span className="text-xs font-bold text-[#55565A]">{toPersianDigits(draftFamily.galleryImages?.length || 0)} تصویر</span>
                    </div>

                    {(draftFamily.galleryImages||[]).length===0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">هنوز تصویری ثبت نشده است. از بخش «افزودن تصویر» در بالا شروع کنید.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {(draftFamily.galleryImages||[]).map((img,idx)=>(
                          <article key={img.id} className="p-3 sm:p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-[92px_minmax(0,1fr)] gap-3">
                              <div className="w-full h-36 sm:w-[92px] sm:h-[92px] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden relative">
                                <ProductImage src={img.url} alt={img.title||draftFamily.name} className="w-full h-full object-contain p-2"/>
                                <span className="absolute top-1 right-1 bg-slate-800/80 text-white text-[10px] px-1.5 py-0.5 rounded">#{toPersianDigits(idx+1)}</span>
                              </div>
                              <div className="min-w-0 space-y-3">
                                <div className="flex flex-wrap items-center gap-2 justify-between">
                                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${img.scope==='variant'&&img.variantCode?'bg-[#FFF0E5] text-[#B94D0A]':'bg-slate-100 text-slate-600'}`}>
                                    {img.scope==='variant'&&img.variantCode?`متصل به کد ${img.variantCode}`:'تصویر عمومی خانواده'}
                                  </span>
                                  <span className="text-[11px] text-slate-400 truncate max-w-full" dir="ltr">{img.title||img.url}</span>
                                </div>
                                <label className="block text-xs font-bold text-slate-700">ارتباط تصویر
                                  <select value={img.scope==='variant'&&img.variantCode?img.variantCode:'__FAMILY__'}
                                    onChange={e=>{const val=e.target.value;if(val==='__FAMILY__')handleUpdateGalleryImage(img.id,g=>({...g,scope:'family',variantCode:undefined,identityVerified:false}));else handleUpdateGalleryImage(img.id,g=>({...g,scope:'variant',variantCode:val,identityVerified:false}))}}
                                    className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs">
                                    <option value="__FAMILY__">تصویر عمومی خانواده</option>
                                    {(draftFamily.variants||[]).map(v=><option key={v.code} value={v.code}>کد {v.code} — {v.name}{v.size? ` (${v.size})`:''}</option>)}
                                  </select>
                                </label>
                                <label className="block text-xs font-bold text-slate-700">عنوان تصویر
                                  <input type="text" value={img.title||''} onChange={e=>handleUpdateGalleryImage(img.id,g=>({...g,title:e.target.value}))}
                                    placeholder="عنوان کوتاه تصویر (اختیاری)" className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs"/>
                                </label>
                                {img.scope==='variant'&&img.variantCode&&(
                                  <label className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs leading-5 text-amber-900">
                                    <input type="checkbox" checked={img.identityVerified===true} onChange={e=>handleUpdateGalleryImage(img.id,g=>({...g,identityVerified:e.target.checked}))} className="mt-1 accent-orange-600"/>
                                    <span>تطبیق این تصویر با کد <b dir="ltr">{img.variantCode}</b> و مشخصات فنی را بررسی کرده‌ام.</span>
                                  </label>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                  <button type="button" disabled={idx===0} onClick={()=>handleReorderGalleryImage(idx,'up')} className="px-3 py-2 rounded-lg border border-slate-200 text-xs disabled:opacity-40">↑ جابه‌جایی به بالا</button>
                                  <button type="button" disabled={idx===(draftFamily.galleryImages?.length||1)-1} onClick={()=>handleReorderGalleryImage(idx,'down')} className="px-3 py-2 rounded-lg border border-slate-200 text-xs disabled:opacity-40">↓ جابه‌جایی به پایین</button>
                                  {idx!==0&&<button type="button" onClick={()=>handleReorderGalleryImage(idx,'first')} className="px-3 py-2 rounded-lg border border-slate-200 text-xs">تصویر اصلی</button>}
                                  <details className="relative">
                                    <summary className="list-none cursor-pointer px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-[#55565A]">عملیات بیشتر ▾</summary>
                                    <div className="mt-2 p-3 rounded-xl border border-slate-200 bg-white flex flex-wrap gap-2">
                                      <button type="button" onClick={()=>setReplacingImageId(replacingImageId===img.id?null:img.id)} className="px-3 py-2 rounded-lg border border-slate-300 text-xs">جایگزینی تصویر</button>
                                      <button type="button" onClick={()=>setMovingImageId(movingImageId===img.id?null:img.id)} className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs">انتقال به خانواده دیگر</button>
                                      <button type="button" onClick={()=>handleDeleteGalleryImage(img.id)} className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs">حذف تصویر</button>
                                    </div>
                                  </details>
                                </div>
                              </div>
                            </div>

                            {replacingImageId===img.id&&(
                              <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                                <strong className="block text-[#55565A]">جایگزینی تصویر (ارتباط فعلی حفظ می‌شود)</strong>
                                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-end">
                                  <label className="block text-xs">شماره تصویر جدید کاتالوگ<input type="number" min={1} max={TOTAL_OFFICIAL_IMAGES_COUNT} value={replaceCatalogueNum} onChange={e=>setReplaceCatalogueNum(Math.max(1,parseInt(e.target.value)||1))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"/></label>
                                  <button type="button" onClick={()=>handleReplaceImageInDraft(img.id,getProductImageUrl(`e(${replaceCatalogueNum}).png`),`e(${replaceCatalogueNum}).png`)} className="px-3 py-2 rounded-lg bg-[#E06518] text-white font-bold">جایگزینی از کاتالوگ</button>
                                  <label className="px-3 py-2 rounded-lg bg-slate-800 text-white font-bold cursor-pointer text-center">بارگذاری فایل<input type="file" accept="image/png,image/jpeg,image/webp" disabled={productImageUploading} onChange={e=>{void handleFileUpload(e,img.id)}} className="hidden"/></label>
                                </div>
                              </div>
                            )}

                            {movingImageId===img.id&&(
                              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-3 text-xs">
                                <strong className="block text-amber-950">انتقال تصویر به خانواده دیگر</strong>
                                <input type="search" value={moveTargetFamilyQuery} onChange={e=>setMoveTargetFamilyQuery(e.target.value)} placeholder="جستجوی نام یا کد خانواده مقصد" className="w-full px-3 py-2.5 rounded-lg border border-amber-300 bg-white"/>
                                <select value={moveTargetFamilyCode} onChange={e=>{setMoveTargetFamilyCode(e.target.value);setMoveTargetVariantCode('')}} className="w-full px-3 py-2.5 rounded-lg border border-amber-300 bg-white">
                                  <option value="">انتخاب خانواده مقصد</option>
                                  {products.filter(p=>p.code!==draftFamily.code&&(!moveTargetFamilyQuery.trim()||normalizeCatalogueText(`${p.code} ${p.name}`).includes(normalizeCatalogueText(moveTargetFamilyQuery)))).slice(0,40).map(p=><option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}
                                </select>
                                {moveTargetFamilyCode&&<select value={moveTargetVariantCode} onChange={e=>setMoveTargetVariantCode(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-amber-300 bg-white"><option value="">تصویر عمومی خانواده مقصد</option>{(products.find(p=>p.code===moveTargetFamilyCode)?.variants||[]).map(v=><option key={v.code} value={v.code}>کد {v.code} — {v.name}</option>)}</select>}
                                <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>{setMovingImageId(null);setMoveTargetFamilyCode('');setMoveTargetVariantCode('')}} className="px-3 py-2 rounded-lg border border-amber-300">انصراف</button><button type="button" disabled={!moveTargetFamilyCode} onClick={()=>handleExecuteMoveImageToAnotherFamily(img.id)} className="px-3 py-2 rounded-lg bg-amber-800 text-white font-bold disabled:opacity-40">تأیید و انتقال</button></div>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===============================================================
                  TAB 4: INTERACTIVE CUSTOMER PREVIEW (پیش‌نمایش دوطرفه قبل از انتشار)
                 =============================================================== */}
              {editorTab === 'preview' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <strong>پیش‌نمایش تعاملی صفحه مشتری (پیش از انتشار):</strong> روی کدها یا تصاویر کلیک کنید تا رابطهٔ دوطرفهٔ کد کالا، تصویر، مشخصات و قیمت را آزمایش کنید.
                    </div>
                    <span className="text-orange-300 font-bold">
                      {draftFamily.active === false
                        ? 'وضعیت خانواده: غیرفعال موقت'
                        : 'وضعیت خانواده: آماده نمایش در سایت'}
                    </span>
                  </div>

                  {(() => {
                    const gal = draftFamily.galleryImages || [];
                    const vars = draftFamily.variants || [];
                    const activeVar =
                      vars.find(v => v.code === previewSelectedVariantCode) || vars[0];
                    const activeImg = gal[previewActiveImageIdx];
                    const vPrice = activeVar
                      ? activeVar.price ?? activeVar.prices?.retail ?? 0
                      : 0;
                    const vInquiry = activeVar
                      ? activeVar.inquiryOnly !== undefined
                        ? activeVar.inquiryOnly
                        : vPrice <= 0
                      : true;

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
                        {/* Left: Interactive Gallery Preview */}
                        <div className="lg:col-span-5 space-y-3">
                          <div className="relative pt-[78%] rounded-2xl border border-slate-200 bg-white overflow-hidden">
                            <ProductImage
                              src={activeImg?.url}
                              alt={draftFamily.name}
                              className="absolute inset-0 w-full h-full object-contain p-5"
                            />
                            {activeImg && (
                              <div className="absolute top-3 right-3">
                                {activeImg.scope === 'variant' && activeImg.variantCode ? (
                                  <span className="bg-[#E06518] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                                    تصویر اختصاصی کد {activeImg.variantCode}
                                  </span>
                                ) : (
                                  <span className="bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                                    تصویر عمومی خانواده
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            {gal.map((g, i) => (
                              <button
                                key={g.id || i}
                                type="button"
                                onClick={() => handlePreviewSelectImage(i)}
                                className={`relative pt-[75%] rounded-xl border bg-white overflow-hidden cursor-pointer ${
                                  previewActiveImageIdx === i
                                    ? 'border-[#E06518] ring-2 ring-[#E06518]'
                                    : 'border-slate-200'
                                }`}
                              >
                                <ProductImage
                                  src={g.url}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-contain p-1.5 pb-4"
                                />
                                <span
                                  className={`absolute bottom-0 inset-x-0 text-[9px] font-bold text-center py-0.5 truncate ${
                                    g.scope === 'variant'
                                      ? 'bg-[#E06518] text-white font-mono'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                  dir="ltr"
                                >
                                  {g.scope === 'variant' && g.variantCode
                                    ? g.variantCode
                                    : 'عمومی'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Right: Interactive SKU & Price Preview */}
                        <div className="lg:col-span-7 space-y-4">
                          <div>
                            <div className="text-xs text-slate-500">
                              خانواده: {draftFamily.name} ({draftFamily.categoryName})
                            </div>
                            <h4 className="text-lg font-black text-slate-800 mt-0.5">
                              {activeVar ? activeVar.name : draftFamily.name}
                            </h4>
                            {activeVar && (
                              <div className="text-xs font-bold text-[#E06518] mt-1">
                                کد انتخاب‌شده: <span className="font-mono">{activeVar.code}</span> | سایز: {activeVar.size}
                              </div>
                            )}
                          </div>

                          {/* Variant Buttons */}
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-700 block">
                              انتخاب کد کالا (کلیک کنید):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {vars.map(v => (
                                <button
                                  key={v.code}
                                  type="button"
                                  onClick={() => handlePreviewSelectVariant(v.code)}
                                  className={`px-3 py-2 rounded-xl border text-right text-xs cursor-pointer ${
                                    activeVar?.code === v.code
                                      ? 'border-[#E06518] bg-orange-50 font-bold text-slate-900'
                                      : 'border-slate-200 bg-white text-slate-700'
                                  }`}
                                >
                                  <div className="font-mono text-[#E06518] font-bold" dir="ltr">
                                    {v.code}
                                  </div>
                                  <div className="text-[11px]">{v.size}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Price Display for Selected SKU */}
                          <div className="p-4 rounded-2xl bg-white border border-slate-200">
                            {!vInquiry && vPrice > 0 ? (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600">
                                  قیمت کد {activeVar?.code}:
                                </span>
                                <span className="text-xl font-black text-emerald-800 font-mono">
                                  {toPersianDigits(
                                    new Intl.NumberFormat('fa-IR').format(vPrice)
                                  )}{' '}
                                  تومان
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600">
                                  وضعیت قیمت کد {activeVar?.code}:
                                </span>
                                <span className="text-sm font-black text-amber-700">
                                  نیازمند استعلام
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Combined Specs Preview */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-200 space-y-1.5">
                              <div className="font-bold text-slate-800">
                                مشخصات اختصاصی کد {activeVar?.code}:
                              </div>
                              {(activeVar?.technicalSpecs || []).map((s, i) => (
                                <div key={i} className="flex justify-between">
                                  <span className="text-slate-500">{s.key}:</span>
                                  <span className="font-bold">{s.value}</span>
                                </div>
                              ))}
                            </div>
                            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
                              <div className="font-bold text-slate-800">
                                مشخصات مشترک خانواده:
                              </div>
                              {(draftFamily.technicalSpecs || []).map((s, i) => (
                                <div key={i} className="flex justify-between">
                                  <span className="text-slate-500">{s.key}:</span>
                                  <span className="font-bold">{s.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
