import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** A first-use visual cue. It never moves the page scroll position or intercepts touch. */
export function MobileSwipeHint() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== '/' || !window.matchMedia('(max-width: 767px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const seen = new WeakSet<Element>();
    const cleanups = new Set<() => void>();
    const selector = '.home-refined [class*="overflow-x-auto"], .home-refined .home-category-track, .home-refined .home-supply-deck';
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (!entry.isIntersecting || element.scrollWidth <= element.clientWidth + 20 || seen.has(element)) continue;
        observer.unobserve(element);
        seen.add(element);
        const track = element.firstElementChild as HTMLElement | null;
        if (!track) continue;
        const restorePosition = getComputedStyle(element).position === 'static';
        const previousPosition = element.style.position;
        if (restorePosition) element.style.position = 'relative';
        const cue = document.createElement('span');
        cue.setAttribute('aria-hidden', 'true');
        cue.style.cssText = [
          'position:absolute','inset-inline-start:10px','bottom:8px','z-index:30',
          'display:inline-flex','align-items:center','gap:8px','padding:7px 11px',
          'border-radius:999px','color:#fff','background:rgba(25,35,47,.88)',
          'border:1px solid rgba(255,255,255,.2)','box-shadow:0 8px 24px rgba(15,23,42,.2)',
          'font-size:11px','font-weight:800','white-space:nowrap','pointer-events:none',
          'backdrop-filter:blur(8px)',
        ].join(';');
        const label = document.createElement('span');
        label.textContent = 'برای دیدن موارد بیشتر بکشید';
        const arrow = document.createElement('span');
        arrow.textContent = '←';
        arrow.style.fontSize = '16px';
        arrow.style.lineHeight = '1';
        cue.append(label, arrow);
        element.appendChild(cue);
        const trackAnimation = track.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-16px)' }, { transform: 'translateX(0)' }],
          { duration: 900, easing: 'ease-in-out' },
        );
        const arrowAnimation = arrow.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' }],
          { duration: 760, iterations: 2, easing: 'ease-in-out' },
        );
        let timer: number | undefined;
        const cleanup = () => {
          trackAnimation.cancel(); arrowAnimation.cancel(); cue.remove();
          element.removeEventListener('pointerdown', cleanup);
          element.removeEventListener('touchstart', cleanup);
          element.removeEventListener('scroll', cleanup);
          if (timer !== undefined) window.clearTimeout(timer);
          if (restorePosition) element.style.position = previousPosition;
          cleanups.delete(cleanup);
        };
        element.addEventListener('pointerdown', cleanup, { once: true, passive: true });
        element.addEventListener('touchstart', cleanup, { once: true, passive: true });
        element.addEventListener('scroll', cleanup, { once: true, passive: true });
        timer = window.setTimeout(cleanup, 2300);
        cleanups.add(cleanup);
      }
    }, { threshold: 0.65 });
    const observe = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (!seen.has(element) && element.scrollWidth > element.clientWidth + 20) observer.observe(element);
      });
    };
    observe();
    const root = document.querySelector('.home-refined');
    const mutation = root ? new MutationObserver(observe) : null;
    mutation?.observe(root as Node, { childList: true, subtree: true });
    return () => {
      observer.disconnect(); mutation?.disconnect(); cleanups.forEach((cleanup) => cleanup());
    };
  }, [pathname]);
  return null;
}
