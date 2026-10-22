import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export interface SavedScrollEntry {
  scrollY: number;
  sectionId?: string;
  viewportTop?: number;
  updatedAt: number;
}

const STORAGE_KEY = 'sanat_pish_scroll_positions_v2';
const memoryScrollStore = new Map<string, SavedScrollEntry>();

function readScrollStore(): Record<string, SavedScrollEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeScrollStore(store: Record<string, SavedScrollEntry>): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep most recent 80 entries to avoid storage bloat
    const entries = Object.entries(store).sort(
      (a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0)
    );
    const trimmed = Object.fromEntries(entries.slice(0, 80));
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors
  }
}

export function saveScrollEntry(
  keys: string[],
  entry: SavedScrollEntry
): void {
  const store = readScrollStore();
  for (const k of keys) {
    if (!k) continue;
    memoryScrollStore.set(k, entry);
    store[k] = entry;
  }
  writeScrollStore(store);
}

export function getSavedScrollEntry(keys: string[]): SavedScrollEntry | null {
  const store = readScrollStore();
  for (const k of keys) {
    if (!k) continue;
    const mem = memoryScrollStore.get(k);
    if (mem) return mem;
    const persisted = store[k];
    if (persisted && typeof persisted.scrollY === 'number') {
      return persisted;
    }
  }
  return null;
}

/**
 * Helper to smoothly scroll the window to a specific element (with sticky header offset).
 */
export function scrollToSectionElement(
  element: HTMLElement | null,
  options?: { offset?: number; behavior?: ScrollBehavior }
): void {
  if (!element || typeof window === 'undefined') return;
  const defaultOffset = window.innerWidth < 1024 ? 76 : 112;
  const offset = options?.offset ?? defaultOffset;
  const behavior = options?.behavior ?? 'smooth';
  const rect = element.getBoundingClientRect();
  const targetTop = Math.max(0, rect.top + window.scrollY - offset);
  window.scrollTo({
    top: targetTop,
    left: 0,
    behavior,
  });
}

function getCurrentScrollY(): number {
  if (typeof window === 'undefined') return 0;
  return (
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

function setWindowScrollY(y: number, behavior: ScrollBehavior = 'instant'): void {
  if (typeof window === 'undefined') return;
  const target = Math.max(0, Math.round(y));
  window.scrollTo({
    top: target,
    left: 0,
    behavior,
  });
  if (behavior === 'instant') {
    document.documentElement.scrollTop = target;
    document.body.scrollTop = target;
  }
}

function findAnchorSection(target: EventTarget | null): {
  sectionId?: string;
  viewportTop?: number;
} {
  if (!(target instanceof HTMLElement)) return {};
  const interactive = target.closest('a[href], button, [role="button"]');
  const anchorEl =
    interactive?.closest('[id], [data-scroll-section], section, article') ||
    target.closest('[id], [data-scroll-section], section, article');

  if (!anchorEl || !(anchorEl instanceof HTMLElement)) return {};

  // Ensure the section has a deterministic ID in the DOM if it doesn't already
  let sectionId = anchorEl.id;
  if (!sectionId && anchorEl.dataset.scrollSection) {
    sectionId = anchorEl.dataset.scrollSection;
    anchorEl.id = sectionId;
  }

  const rect = anchorEl.getBoundingClientRect();
  return {
    sectionId: sectionId || undefined,
    viewportTop: Math.round(rect.top),
  };
}

/**
 * ScrollToTop & Smart Section Restoration Manager:
 * - When navigating to a new page (PUSH), scrolls to top (or #hash target).
 * - When changing in-page query parameters on the same pathname (e.g. filters/subcategories/tabs),
 *   preserves scroll so the page's own section scroll handler can smoothly scroll to the results.
 * - When returning to a previous page via phone Back button or browser Back/Forward button (POP),
 *   restores the exact scroll position and section the user was viewing before leaving.
 */
export const ScrollToTop = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const { pathname, search, hash, key } = location;

  const currentRouteRef = useRef({ pathname, search, hash, key });
  const prevPathnameRef = useRef<string | null>(null);
  const lastClickAnchorRef = useRef<{
    sectionId?: string;
    viewportTop?: number;
  }>({});

  // Disable browser automatic scroll restoration so it doesn't conflict with React Suspense
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Track scroll position & interactive clicks on the active page before route transitions
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const persistCurrentScroll = (extra?: {
      sectionId?: string;
      viewportTop?: number;
    }) => {
      const route = currentRouteRef.current;
      const scrollY = getCurrentScrollY();
      const existing = getSavedScrollEntry([
        `key:${route.key}`,
        `route:${route.pathname}${route.search}`,
      ]);
      const entry: SavedScrollEntry = {
        scrollY,
        sectionId: extra?.sectionId ?? lastClickAnchorRef.current.sectionId ?? existing?.sectionId,
        viewportTop:
          extra?.viewportTop ?? lastClickAnchorRef.current.viewportTop ?? existing?.viewportTop,
        updatedAt: Date.now(),
      };
      saveScrollEntry(
        [
          `key:${route.key}`,
          `route:${route.pathname}${route.search}`,
          `path:${route.pathname}`,
        ],
        entry
      );
    };

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        persistCurrentScroll();
        ticking = false;
      });
    };

    const handlePointerOrClick = (e: Event) => {
      const anchorInfo = findAnchorSection(e.target);
      if (anchorInfo.sectionId || typeof anchorInfo.viewportTop === 'number') {
        lastClickAnchorRef.current = anchorInfo;
      }
      persistCurrentScroll(anchorInfo);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('pointerdown', handlePointerOrClick, {
      capture: true,
      passive: true,
    });
    document.addEventListener('click', handlePointerOrClick, {
      capture: true,
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('pointerdown', handlePointerOrClick, {
        capture: true,
      });
      document.removeEventListener('click', handlePointerOrClick, {
        capture: true,
      });
    };
  }, []);

  // Handle route changes (POP vs PUSH/REPLACE)
  useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    currentRouteRef.current = { pathname, search, hash, key };
    prevPathnameRef.current = pathname;
    lastClickAnchorRef.current = {};

    // 1. Browser / Phone Back or Forward button (POP) -> Restore exact section & scroll position!
    if (navigationType === 'POP') {
      const saved = getSavedScrollEntry([
        `key:${key}`,
        `route:${pathname}${search}`,
        `path:${pathname}`,
      ]);

      if (saved) {
        let userInterrupted = false;
        const stopOnUserInput = () => {
          userInterrupted = true;
        };

        window.addEventListener('wheel', stopOnUserInput, { passive: true, once: true });
        window.addEventListener('touchmove', stopOnUserInput, { passive: true, once: true });

        const applySavedScroll = () => {
          if (userInterrupted) return;

          // If we have a specific section ID and its viewport offset, and the section is mounted:
          if (saved.sectionId && typeof saved.viewportTop === 'number') {
            const sectionEl = document.getElementById(saved.sectionId);
            if (sectionEl) {
              const rect = sectionEl.getBoundingClientRect();
              const computedScrollY = Math.max(
                0,
                rect.top + getCurrentScrollY() - saved.viewportTop
              );
              // Prefer saved.scrollY if very close, or computedScrollY if layout shifted slightly
              const targetY =
                Math.abs(computedScrollY - saved.scrollY) < 260
                  ? saved.scrollY
                  : computedScrollY;
              setWindowScrollY(targetY, 'instant');
              return;
            }
          }

          setWindowScrollY(saved.scrollY, 'instant');
        };

        // Apply immediately and across animation/Suspense load intervals
        applySavedScroll();
        const timers = [16, 50, 110, 220, 380].map((delay) =>
          window.setTimeout(applySavedScroll, delay)
        );

        return () => {
          timers.forEach((t) => window.clearTimeout(t));
          window.removeEventListener('wheel', stopOnUserInput);
          window.removeEventListener('touchmove', stopOnUserInput);
        };
      }
    }

    // 2. Hash navigation (e.g., #capabilities, #ceramic-recommended-products, #industry-parts)
    if (hash) {
      const targetId = decodeURIComponent(hash.replace('#', ''));
      const scrollToHash = () => {
        const element = document.getElementById(targetId);
        if (element) {
          scrollToSectionElement(element, { behavior: 'smooth' });
          return true;
        }
        return false;
      };

      if (!scrollToHash()) {
        const timer = window.setTimeout(scrollToHash, 80);
        return () => window.clearTimeout(timer);
      }
      return;
    }

    // 3. Same-pathname query parameter change (e.g., selecting a subcategory, tab, or filter in-page)
    // Do NOT jump back to the top of the page so the user stays in context / scrolls to results.
    if (prevPathname !== null && prevPathname === pathname) {
      return;
    }

    // 4. Forward navigation to a new page -> start at the top of the new page
    setWindowScrollY(0, 'instant');
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
  }, [pathname, search, hash, key, navigationType]);

  return null;
};
