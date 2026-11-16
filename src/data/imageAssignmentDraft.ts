export type ImageAssignmentSource = 'existing' | 'upload' | 'url';
export type ImageAssignmentPlacement = 'family' | 'sku' | 'new-sku';

export interface ImageAssignmentDraft {
  file: string;
  url: string;
  source: ImageAssignmentSource;
  title: string;
  menuGroup: string;
  category: string;
  submenu: string;
  subcategory: string;
  familyCode: string;
  familySearch: string;
  searchAllFamilies: boolean;
  directMode: boolean;
  sku: string;
  skuSearch: string;
  newSkuCode: string;
  newSkuName: string;
  newSkuSize: string;
  placement: ImageAssignmentPlacement;
}

interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const IMAGE_ASSIGNMENT_DRAFT_STORAGE_KEY = 'sanatpish.admin.image-assignment-draft.v1';

const cleanText = (value: unknown, max = 220): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const safeImageUrl = (value: unknown): string => {
  const url = cleanText(value, 2000);
  if (!url || /^blob:/i.test(url) || url.startsWith('//') || url.includes('..')) return '';
  return url.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(url) ? url : '';
};

const browserStorage = (): DraftStorage | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export function normalizeImageAssignmentDraft(value: unknown): ImageAssignmentDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const source: ImageAssignmentSource =
    raw.source === 'upload' || raw.source === 'url' ? raw.source : 'existing';
  const placement: ImageAssignmentPlacement =
    raw.placement === 'sku' || raw.placement === 'new-sku' ? raw.placement : 'family';
  const draft: ImageAssignmentDraft = {
    file: cleanText(raw.file, 255),
    url: safeImageUrl(raw.url),
    source,
    title: cleanText(raw.title, 180),
    menuGroup: cleanText(raw.menuGroup, 90),
    category: cleanText(raw.category, 180),
    submenu: cleanText(raw.submenu, 180),
    subcategory: cleanText(raw.subcategory, 250),
    familyCode: cleanText(raw.familyCode, 180),
    familySearch: cleanText(raw.familySearch, 180),
    searchAllFamilies: raw.searchAllFamilies === true,
    directMode: raw.directMode === true,
    sku: cleanText(raw.sku, 110),
    skuSearch: cleanText(raw.skuSearch, 180),
    newSkuCode: cleanText(raw.newSkuCode, 110),
    newSkuName: cleanText(raw.newSkuName, 180),
    newSkuSize: cleanText(raw.newSkuSize, 120),
    placement,
  };
  return Object.values(draft).some(value => value !== '' && value !== false) ? draft : null;
}

export function readImageAssignmentDraft(storage: DraftStorage | undefined = browserStorage()): ImageAssignmentDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(IMAGE_ASSIGNMENT_DRAFT_STORAGE_KEY);
    return raw ? normalizeImageAssignmentDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeImageAssignmentDraft(
  value: ImageAssignmentDraft,
  storage: DraftStorage | undefined = browserStorage(),
): void {
  if (!storage) return;
  try {
    const draft = normalizeImageAssignmentDraft(value);
    if (!draft) storage.removeItem(IMAGE_ASSIGNMENT_DRAFT_STORAGE_KEY);
    else storage.setItem(IMAGE_ASSIGNMENT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // A blocked or full browser storage must never prevent image assignment.
  }
}

export function clearImageAssignmentDraft(storage: DraftStorage | undefined = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(IMAGE_ASSIGNMENT_DRAFT_STORAGE_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}
