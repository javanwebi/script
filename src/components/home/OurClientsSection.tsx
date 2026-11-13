import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clientService, type ClientLogo } from '../../services/clientService';

// Keep older inline SVG logos readable on the light storefront surface.
const cleanTransparentLogo = (logoUrl: string): string => {
  if (!logoUrl.startsWith('data:image/svg+xml')) return logoUrl;
  return logoUrl
    .replace(/<rect[^>]*fill="%230F172A"[^>]*\/>/gi, '')
    .replace(/fill="%23FFFFFF"/gi, 'fill="%231E293B"');
};

/** Compact, looping customer logo carousel driven by the complete admin list. */
export const OurClientsSection: React.FC = () => {
  const [clients, setClients] = useState<ClientLogo[]>(() => clientService.getActiveClients());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(6);
  const [isPaused, setIsPaused] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const refresh = () => setClients(clientService.getActiveClients());
    const unsubscribe = clientService.subscribe(refresh);
    refresh();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const adjust = () => setItemsPerView(window.innerWidth < 640 ? 3 : window.innerWidth < 1024 ? 4 : 6);
    adjust();
    window.addEventListener('resize', adjust);
    return () => window.removeEventListener('resize', adjust);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  // A PostgreSQL refresh can change the full list. Start at the beginning of
  // the newly hydrated list rather than showing a clone from a stale index.
  useEffect(() => {
    setCurrentIndex(0);
  }, [clients, itemsPerView]);

  const canSlide = clients.length > itemsPerView;
  const shiftForward = () => setCurrentIndex(index => index >= clients.length ? 1 : index + 1);
  const shiftBackward = () => setCurrentIndex(index =>
    index <= 0 ? Math.max(0, clients.length - 1) : index - 1);

  useEffect(() => {
    if (!canSlide || isPaused || reduceMotion) return;
    const timer = window.setInterval(() => {
      setCurrentIndex(index => index >= clients.length ? 1 : index + 1);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [canSlide, clients.length, isPaused, reduceMotion]);

  // Render a short prefix twice to wrap the final slide without a blank gap.
  // Reset the transform after it finishes moving over the cloned prefix.
  useEffect(() => {
    if (!canSlide || currentIndex < clients.length) return;
    const timer = window.setTimeout(() => {
      setDisableTransition(true);
      setCurrentIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setDisableTransition(false));
      });
    }, 670);
    return () => window.clearTimeout(timer);
  }, [canSlide, currentIndex, clients.length]);

  const visibleClients = canSlide
    ? [...clients, ...clients.slice(0, itemsPerView)]
    : clients;

  return (
    <section
      id="our-clients-section"
      className="w-full bg-white text-slate-900 pt-5 sm:pt-6 pb-4 sm:pb-5 select-none"
      aria-label="مشتری‌های ما"
      dir="rtl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false);
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 flex justify-start">
        <div className="text-center space-y-1.5">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            مشتری‌های ما
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
            همراه مجموعه‌های صنعتی در تأمین قطعات خطوط تولید
          </p>
        </div>
      </div>

      <div className="w-full border-t border-slate-100 my-3 sm:my-4" />

      {clients.length > 0 ? (
        <div className="relative max-w-7xl mx-auto px-7 sm:px-10">
          {canSlide && (
            <>
              <button
                type="button"
                onClick={shiftBackward}
                aria-label="لوگوی مشتری قبلی"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full text-slate-400 hover:text-[#E56B1E] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E56B1E]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={shiftForward}
                aria-label="لوگوی مشتری بعدی"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full text-slate-400 hover:text-[#E56B1E] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E56B1E]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
          <div className="overflow-hidden" aria-label="لوگوهای مشتریان">
            <div
              dir="ltr"
              aria-live="off"
              className={`flex w-full items-center ${disableTransition || reduceMotion ? '' : 'transition-transform duration-[650ms] ease-in-out'}`}
              style={{transform: `translate3d(-${currentIndex * (100 / itemsPerView)}%, 0, 0)`}}
            >
              {visibleClients.map((client, index) => (
                <div
                  key={`${client.id}-${index}`}
                  className="w-1/3 sm:w-1/4 lg:w-1/6 shrink-0 h-[74px] sm:h-[82px] lg:h-[88px] px-2 sm:px-3 flex items-center justify-center"
                  title={client.name}
                  dir="rtl"
                >
                  <img
                    src={cleanTransparentLogo(client.logo)}
                    alt={client.name}
                    loading="lazy"
                    decoding="async"
                    className="max-w-full max-h-[58px] sm:max-h-[64px] lg:max-h-[70px] object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 text-center text-slate-500 text-xs py-5">
          لوگوی فعالی برای نمایش ثبت نشده است؛ می‌توان آن را از بخش «مشتریان ما» در پنل مدیریت فعال کرد.
        </div>
      )}
    </section>
  );
};
