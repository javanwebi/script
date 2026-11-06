import React, { useState, useEffect } from 'react';
import { clientService, type ClientLogo } from '../../services/clientService';

// Keep older inline SVG logos readable on the light storefront surface.
const cleanTransparentLogo = (logoUrl: string): string => {
  if (!logoUrl.startsWith('data:image/svg+xml')) return logoUrl;
  return logoUrl
    .replace(/<rect[^>]*fill="%230F172A"[^>]*\/>/gi, '')
    .replace(/fill="%23FFFFFF"/gi, 'fill="%231E293B"');
};

/** Stable, admin-controlled logo row. No timer, automatic slide or unmount on hydration. */
export const OurClientsSection: React.FC = () => {
  const [clients, setClients] = useState<ClientLogo[]>(() => clientService.getActiveClients());

  useEffect(() => {
    const refresh = () => setClients(clientService.getActiveClients());
    const unsubscribe = clientService.subscribe(refresh);
    refresh();
    return unsubscribe;
  }, []);

  return (
    <section
      id="our-clients-section"
      className="w-full bg-white text-slate-900 pt-6 sm:pt-8 pb-5 sm:pb-7 select-none"
      aria-label="مشتری‌های ما"
      dir="rtl"
    >
      <div className="max-w-4xl mx-auto px-4 text-center space-y-2">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
          مشتری‌های ما
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
          همراه مجموعه‌های صنعتی در تأمین قطعات خطوط تولید
        </p>
      </div>

      <div className="w-full border-t border-slate-100 my-4 sm:my-6" />

      {clients.length > 0 ? (
        <div
          className="max-w-7xl mx-auto px-4 sm:px-8 overflow-x-auto overscroll-x-contain"
          aria-label="لوگوهای مشتریان؛ برای دیدن بقیه به صورت افقی پیمایش کنید"
          tabIndex={0}
        >
          <div className="flex items-center gap-3 sm:gap-5 pb-3 w-max min-w-full">
            {clients.map(client => (
              <div
                key={client.id}
                className="w-[138px] sm:w-[168px] lg:w-[185px] shrink-0 flex items-center justify-center p-3 h-24 sm:h-28 rounded-xl border border-slate-100 bg-white"
                title={client.name}
              >
                <img
                  src={cleanTransparentLogo(client.logo)}
                  alt={client.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 text-center text-slate-500 text-xs py-8">
          لوگوی فعالی برای نمایش ثبت نشده است؛ می‌توان آن را از بخش «مشتریان ما» در پنل مدیریت فعال کرد.
        </div>
      )}
    </section>
  );
};
