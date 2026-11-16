import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IMAGE_ASSIGNMENT_DRAFT_STORAGE_KEY,
  clearImageAssignmentDraft,
  normalizeImageAssignmentDraft,
  readImageAssignmentDraft,
  writeImageAssignmentDraft,
} from '../src/data/imageAssignmentDraft';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('image assignment form restores category, submenu, family, SKU and destination after reload', () => {
  const storage = memoryStorage();
  const draft = {
    file: 'e(1).png',
    url: '/storage/products/catalog/e(1).png',
    source: 'existing' as const,
    title: 'تصویر تسمه',
    menuGroup: 'mechanical',
    category: 'excel-v2-1-4',
    submenu: 'تسمه صنعتی',
    subcategory: 'تسمه تایمینگ',
    familyCode: 'FAM-BELT-01',
    familySearch: 'تایمینگ',
    searchAllFamilies: false,
    directMode: false,
    sku: 'SPA-1250',
    skuSearch: 'SPA-1250',
    newSkuCode: '',
    newSkuName: '',
    newSkuSize: '',
    placement: 'sku' as const,
  };

  writeImageAssignmentDraft(draft, storage);
  assert.deepEqual(readImageAssignmentDraft(storage), draft);
  assert.ok(storage.getItem(IMAGE_ASSIGNMENT_DRAFT_STORAGE_KEY));
});

test('temporary blob URLs and invalid URL schemes are never restored', () => {
  const normalized = normalizeImageAssignmentDraft({
    file: 'new-belt.png',
    url: 'blob:https://sanatpish.com/temporary-id',
    source: 'upload',
    category: 'excel-v2-1-4',
    familyCode: 'FAM-BELT-01',
    placement: 'family',
  });
  assert.ok(normalized);
  assert.equal(normalized.url, '');
  assert.equal(normalized.file, 'new-belt.png');
  assert.equal(normalizeImageAssignmentDraft({ url: 'javascript:alert(1)' })?.url, '');
});

test('image assignment draft can be cleared without affecting catalog data', () => {
  const storage = memoryStorage();
  writeImageAssignmentDraft({
    file: '', url: '', source: 'existing', title: '', menuGroup: '', category: '',
    submenu: '', subcategory: '', familyCode: '', familySearch: '',
    searchAllFamilies: false, directMode: false, sku: '', skuSearch: '',
    newSkuCode: '', newSkuName: '', newSkuSize: '', placement: 'family',
  }, storage);
  clearImageAssignmentDraft(storage);
  assert.equal(readImageAssignmentDraft(storage), null);
});
