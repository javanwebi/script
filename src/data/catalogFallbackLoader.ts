import catalogue from '../../tests/fixtures/catalogueSource.json';
import images from '../../tests/fixtures/catalogueImages.json';
import review from '../../docs/product-image-review.json';
import photos from '../../tests/fixtures/ownerCataloguePhotos.json';
import { applyCatalogueCorrections } from './catalogueCorrections';
import { categorySlugFor, installCatalogProducts } from './userProducts';
import { getProductImageUrl } from '../assets/imagesproducts';
import { installCatalogImageMetadata } from '../services/catalogImageCorpus';
import pins from '../../tests/fixtures/ownerCataloguePinTable.json';
import imperial from '../../tests/fixtures/imperialTimingReference.json';
import misumi from '../../tests/fixtures/misumiTimingReference.json';
import { installOwnerPinRows } from './ownerCatalogue';
import { installTimingReferenceRows, type TimingReferenceRow } from './imperialTimingReference';
import { groupProductFamilies } from './productFamilies';
import { enrichProductTechnicalData } from './productTechnicalData';
import { installDatabaseProducts } from './mockGenerator';
import type { Product } from '../types';

let cachedProducts: Product[] | null = null;

export function loadFallbackCatalog(): Product[] {
  if (cachedProducts) return cachedProducts;

  try {
    installOwnerPinRows(pins.rows.map(row => ({
      sku: row.sku,
      dim_2r_outer: (row as any)['2R'],
      dim_w: (row as any).W,
      dim_h: (row as any).h,
      dim_2r_inner: (row as any)['2r'],
      pdf_page: pins.pdfPage,
      printed_page: pins.printedPage,
      drawing_pdf_page: pins.drawingPdfPage,
      source_sha256: pins.sha256,
      is_conflict: pins.conflicts.includes(row.sku)
    })));
  } catch (e) {
    console.warn('[FallbackCatalog] Could not install owner pins', e);
  }

  try {
    const referenceRows: TimingReferenceRow[] = [
      ...Object.entries(imperial.lengths).map(([designation, row]) => ({
        designation,
        reference_source: 'optibelt_imperial' as const,
        length_mm: (row as any).lengthMm,
        teeth_count: (row as any).teeth,
        pdf_page: (row as any).pdfPage,
        source_page: null,
        is_conflict: false,
        source_url: imperial.sourceUrl
      })),
      ...Object.entries(imperial.conflicts).map(([designation, row]) => ({
        designation,
        reference_source: 'optibelt_imperial' as const,
        length_mm: null,
        teeth_count: null,
        pdf_page: (row as any).pdfPage,
        source_page: null,
        is_conflict: true,
        source_url: imperial.sourceUrl
      })),
      ...Object.entries(misumi.lengths).map(([designation, row]) => ({
        designation,
        reference_source: 'misumi_imperial' as const,
        length_mm: (row as any).lengthMm,
        teeth_count: (row as any).teeth,
        pdf_page: null,
        source_page: (row as any).sourcePage,
        is_conflict: false,
        source_url: (row as any).sourceUrl
      }))
    ];
    installTimingReferenceRows(referenceRows);
  } catch (e) {
    console.warn('[FallbackCatalog] Could not install timing reference rows', e);
  }

  const mapped = Object.fromEntries(Object.entries(images as Record<string, { files: string[]; familyName: string }>));
  const raw: Product[] = catalogue.map((family: any) => {
    const imageInfo = mapped[family.code];
    const urls = imageInfo?.familyName === family.name ? imageInfo.files.map(getProductImageUrl) : [];
    const specs = [
      { key: 'نوع فنی', value: family.technicalType },
      { key: 'واحدهای فروش', value: family.unit },
      { key: 'تعداد کد کالا', value: String(family.itemCount) },
      ...(family.profiles ? [{ key: 'پروفیل‌ها', value: family.profiles }] : []),
      ...(family.materials ? [{ key: 'جنس‌های ثبت‌شده', value: family.materials }] : [])
    ];
    return applyCatalogueCorrections({
      code: family.code,
      name: family.name,
      brand: family.brand || 'ثبت نشده',
      categorySlug: categorySlugFor(family.categoryName),
      categoryName: family.categoryName,
      submenu: family.submenu,
      subcategory: family.technicalType,
      variants: family.variants,
      sourceRow: family.sourceRow,
      technicalSpecs: specs,
      prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
      stock: 0,
      stockKnown: false,
      inquiryOnly: true,
      images: urls,
      hasCatalogueImage: urls.length > 0,
      imageScope: urls.length ? 'family-example' as const : undefined,
      unit: family.unit || 'عدد',
      tags: [family.submenu, family.technicalType, family.profiles || ''].filter(Boolean),
      description: `${family.name}؛ ${family.itemCount.toLocaleString('fa-IR')} کد کالا در این خانواده ثبت شده است. سایز و کد مورد نیاز را از فهرست زیر انتخاب کنید. قیمت و موجودی پس از استعلام اعلام می‌شود.`
    });
  });

  const grouped = groupProductFamilies(raw).map(enrichProductTechnicalData);
  installCatalogProducts(raw, { rawFixture: true });
  installDatabaseProducts(grouped);

  try {
    installCatalogImageMetadata(
      review.items.map(r => ({
        file_name: r.file,
        image_url: `https://raw.githubusercontent.com/javanweb/imagesatlas/main/${r.file}`,
        sha256: r.sha256,
        observed_description: r.observed
      })),
      photos.items.map(p => ({
        file_name: p.file,
        catalogue_group: p.catalogueGroup
      }))
    );
  } catch (e) {
    console.warn('[FallbackCatalog] Could not install catalog image metadata', e);
  }

  cachedProducts = grouped;
  return grouped;
}
