import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Product } from '../src/types';
import { isIndustrialBeltDirectSku, isIndustrialBeltProduct } from '../src/utils/industrialBeltScope';

test('industrial belt family is recognized from its product identity and belt division metadata', () => {
  const family = {
    code: 'belt-family',
    name: 'SPB industrial family',
    nameEn: 'V belt',
    brand: 'SWR',
    categorySlug: 'excel-v2-1-3',
    categoryName: 'تسمه و انتقال نیرو',
    subcategory: 'SPB',
    active: true,
    variants: [{ code: 'SPB-2000', variableSpecs: { beltDivision: 'vbelt-wedge' } }]
  } as unknown as Product;
  assert.equal(isIndustrialBeltProduct(family), true);
});

test('pulleys, welding equipment and unrelated product families are excluded', () => {
  const base = { brand: 'Generic', categorySlug: 'excel-v2-1-1', categoryName: 'تسمه و انتقال نیرو', active: true, variants: [] };
  assert.equal(isIndustrialBeltProduct({ ...base, code: 'pulley', name: 'پولی تایمینگ', subcategory: 'پولی' } as unknown as Product), false);
  assert.equal(isIndustrialBeltProduct({ ...base, code: 'welding-tool', name: 'دستگاه جوش تسمه', subcategory: 'تجهیزات جوش' } as unknown as Product), false);
  assert.equal(isIndustrialBeltProduct({ ...base, code: 'bearing', name: 'بلبرینگ شیار عمیق', categorySlug: 'bearings', categoryName: 'قطعات مکانیکی', subcategory: 'بلبرینگ' } as unknown as Product), false);
});

test('direct belt SKU search recognizes belt markings and rejects unrelated codes', () => {
  assert.equal(isIndustrialBeltDirectSku({ skuCode: 'SPB-2000', name: 'SPB 2000' }), true);
  assert.equal(isIndustrialBeltDirectSku({ skuCode: 'HTD-8M-1200', name: 'HTD 8M 1200' }), true);
  assert.equal(isIndustrialBeltDirectSku({ skuCode: '8M-1200', name: '8M ۱۲۰۰' }), true);
  assert.equal(isIndustrialBeltDirectSku({ skuCode: 'DS8M-1200', name: 'DS8M 1200' }), true);
  assert.equal(isIndustrialBeltDirectSku({ skuCode: 'PULLEY-SPB-2000', name: 'SPB 2000' }), false);
  assert.equal(isIndustrialBeltDirectSku({ skuCode: '6202ZZ', name: '6202ZZ', subcategory: 'بلبرینگ' }), false);
  assert.equal(isIndustrialBeltDirectSku({ skuCode: 'PULLEY-200', name: 'پولی ۲۰۰' }), false);
});

test('belt-selection code and catalogue links carry the belt-only search scope', () => {
  const source = readFileSync(new URL('../src/pages/BeltSelectionPage.tsx', import.meta.url), 'utf8');
  const searchPage = readFileSync(new URL('../src/pages/SearchPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /scope=industrial-belt/);
  assert.match(searchPage, /identify-part\?from=belt-selection/);
  assert.match(searchPage, /normalizedQuery/);
});

test('belt analysis is rendered in the automatic KIKI inline workspace', () => {
  const modal = readFileSync(new URL('../src/components/search/AiVisualPartSearchModal.tsx', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../src/components/search/ImageRegionReview.tsx', import.meta.url), 'utf8');
  const provider = readFileSync(new URL('../src/components/search/PartIdentificationProvider.tsx', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../src/services/aiVisualSearchService.ts', import.meta.url), 'utf8');
  assert.ok(provider.includes("domainHint={entrySource === 'belt-selection' ? 'industrial-belt' : undefined}"));
  assert.ok(modal.includes('domainHint,\n        imageBase64'));
  assert.ok(service.includes("domainHint?: 'industrial-belt'"));
  assert.match(modal, /beltAnalysis=\{analysisResult\?\.beltAnalysis\}/);
  assert.match(review, /data-testid="kiki-inline-belt-analysis"/);
  assert.match(review, /beltAnalysis\.visualBeltConfirmed/);
  assert.match(review, /beltAnalysis\.candidateFamilies/);
});

test('belt-scoped image analysis fails closed instead of falling back to generic matching', () => {
  const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(server, /BELT_IMAGE_REQUIRED/);
  assert.match(server, /BELT_VISION_UNAVAILABLE/);
  assert.match(server, /domainHint==='industrial-belt' && !localVisionEnabled/);
});

test('belt-scoped catalog search is not truncated by the generic 240-family limit and remains populated after clearing the query', () => {
  const searchPage = readFileSync(new URL('../src/pages/SearchPage.tsx', import.meta.url), 'utf8');
  assert.match(searchPage, /beltScoped && !queryParam\.trim\(\)/);
  assert.match(searchPage, /searchProducts\('تسمه', 1200\)/);
  assert.match(searchPage, /searchProducts\('belt', 1200\)/);
  assert.match(searchPage, /searchProducts\(queryParam, beltScoped \? 1200 : 240\)/);
});
