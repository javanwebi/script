import type { QueryEvidence } from './localVision';
import type { ImageRegion } from '../utils/imageRegion';

export interface LocalVisionDetectionEntry {
  imageHash: string;
  model: string;
  query: QueryEvidence;
  queryRegions: ImageRegion[];
  selectedRegion?: ImageRegion;
  createdAt: number;
}

/** Short-lived, bounded cache so the user can approve a crop without paying
 * for a second DINO inference. Entries are bound to the exact uploaded image
 * and model namespace and expire quickly.
 */
export class LocalVisionDetectionCache {
  private readonly entries = new Map<string, LocalVisionDetectionEntry>();

  constructor(
    private readonly ttlMs = 3 * 60 * 1000,
    private readonly maxEntries = 40,
  ) {}

  set(id: string, entry: Omit<LocalVisionDetectionEntry, 'createdAt'>, now = Date.now()) {
    this.prune(now);
    this.entries.delete(id);
    this.entries.set(id, { ...entry, createdAt: now });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get(id: string, imageHash: string, model: string, now = Date.now()): LocalVisionDetectionEntry | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (now - entry.createdAt > this.ttlMs || entry.imageHash !== imageHash || entry.model !== model) {
      this.entries.delete(id);
      return undefined;
    }
    // Refresh insertion order for bounded LRU-like eviction.
    this.entries.delete(id);
    this.entries.set(id, entry);
    return entry;
  }

  delete(id: string) {
    this.entries.delete(id);
  }

  clear() {
    this.entries.clear();
  }

  private prune(now: number) {
    for (const [id, entry] of this.entries) {
      if (now - entry.createdAt > this.ttlMs) this.entries.delete(id);
    }
  }
}
