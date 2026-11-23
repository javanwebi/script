import { getCatalogDisplayImageCandidates } from './CatalogResultImage';

export interface VisionRecentSearchItem {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  partHint?: string;
  imageUrl?: string;
  createdAt: number;
}

const STORAGE_KEY = 'sanatpish_forza_vision_recent_v2';
const LEGACY_STORAGE_KEY = 'sanatpish_forza_vision_recent_v1';
const MAX_ITEMS = 8;

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function safeCatalogImage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  // This resolver only returns paths already registered in the real catalogue.
  // data:, blob:, remote URLs and arbitrary customer-upload paths are rejected.
  return getCatalogDisplayImageCandidates([value])[0];
}

function sanitizeItem(value: unknown): VisionRecentSearchItem | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const code = cleanText(candidate.code, 80);
  const title = cleanText(candidate.title, 120);
  const createdAt = Number(candidate.createdAt);
  if (!code || !title || !Number.isFinite(createdAt) || createdAt <= 0) return null;

  const subtitle = cleanText(candidate.subtitle, 180);
  const partHint = cleanText(candidate.partHint, 100);
  const imageUrl = safeCatalogImage(candidate.imageUrl);
  const id = cleanText(candidate.id, 120) || `${createdAt}-${code}`;

  return {
    id,
    code,
    title,
    subtitle,
    ...(partHint ? { partHint } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    createdAt,
  };
}

/**
 * History stores product metadata and an optional verified public catalogue image only.
 * The old v1 key is removed because it accepted arbitrary image URLs and data URLs.
 */
export function loadVisionRecentSearches(): VisionRecentSearchItem[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    storage.removeItem(LEGACY_STORAGE_KEY);
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      storage.removeItem(STORAGE_KEY);
      return [];
    }
    if (!Array.isArray(parsed)) {
      storage.removeItem(STORAGE_KEY);
      return [];
    }

    const items = parsed
      .map(sanitizeItem)
      .filter((item): item is VisionRecentSearchItem => Boolean(item))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_ITEMS);

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // A full or disabled browser store must not hide valid in-memory history.
    }
    return items;
  } catch {
    return [];
  }
}

export function recordVisionRecentSearch(entry: {
  code: string;
  title: string;
  subtitle?: string;
  partHint?: string;
  imageUrl?: string;
}): VisionRecentSearchItem[] {
  const code = cleanText(entry.code, 80);
  const title = cleanText(entry.title, 120);
  if (!code || !title) return loadVisionRecentSearches();

  const createdAt = Date.now();
  const imageUrl = safeCatalogImage(entry.imageUrl);
  const partHint = cleanText(entry.partHint, 100);
  const item: VisionRecentSearchItem = {
    id: `${createdAt}-${code}`,
    code,
    title,
    subtitle: cleanText(entry.subtitle, 180),
    ...(partHint ? { partHint } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    createdAt,
  };

  const existing = loadVisionRecentSearches();
  const updated = [item, ...existing.filter((candidate) => candidate.code !== code)].slice(0, MAX_ITEMS);
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(LEGACY_STORAGE_KEY);
      storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Keep the current in-memory history even when browser storage is unavailable.
    }
  }
  return updated;
}

export function formatVisionRecentTime(createdAt: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(createdAt));
  } catch {
    return '';
  }
}
