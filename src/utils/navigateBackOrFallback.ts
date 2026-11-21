import type { NavigateFunction } from 'react-router-dom';

/**
 * Navigates back to the exact previous in-app route whenever history exists,
 * falling back cleanly when a user opens the URL directly in a fresh tab.
 */
export function goBackOrFallback(navigate: NavigateFunction, fallback = '/'): void {
  if (typeof window !== 'undefined') {
    const idx =
      window.history.state && typeof window.history.state.idx === 'number'
        ? window.history.state.idx
        : null;
    if (idx !== null && idx > 0) {
      navigate(-1);
      return;
    }
    if (idx === null && window.history.length > 1) {
      try {
        if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
          navigate(-1);
          return;
        }
      } catch {
        // Ignore malformed referrer and use fallback
      }
    }
  }
  navigate(fallback, { replace: true });
}