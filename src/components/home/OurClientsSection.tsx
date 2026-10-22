import React, { useState, useEffect } from 'react';
import { clientService, ClientLogo } from '../../services/clientService';

// Helper to ensure any legacy SVG logo with dark rect background is rendered transparently on white
const cleanTransparentLogo = (logoUrl: string): string => {
  if (!logoUrl.startsWith('data:image/svg+xml')) return logoUrl;
  return logoUrl
    .replace(/<rect[^>]*fill="%230F172A"[^>]*\/>/gi, '')
    .replace(/fill="%23FFFFFF"/gi, 'fill="%231E293B"');
};

export const OurClientsSection: React.FC = () => {
  const [clients, setClients] = useState<ClientLogo[]>(() => clientService.getActiveClients());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(6);
  const [disableTransition, setDisableTransition] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) setItemsPerView(3);
      else if (width < 1024) setItemsPerView(4);
      else setItemsPerView(6);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updateClients = () => {
      setClients(clientService.getActiveClients());
    };
    const unsubscribe = clientService.subscribe(updateClients);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (clients.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => prev + 1);
    }, 2800);

    return () => clearInterval(interval);
  }, [clients.length]);

  useEffect(() => {
    if (clients.length === 0) return;
    if (currentIndex >= clients.length) {
      const timeout = setTimeout(() => {
        setDisableTransition(true);
        setCurrentIndex(0);
        setTimeout(() => {
          setDisableTransition(false);
        }, 40);
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, clients.length]);

  if (clients.length === 0) return null;

  const extendedClients = [...clients, ...clients, ...clients, ...clients];

  return (
    <section
      id="our-clients-section"
      className="w-full bg-white text-slate-900 pt-6 sm:pt-8 pb-5 sm:pb-7 select-none"
      dir="rtl"
    >
      {/* Top Centered Heading & Subtitle (Matching Reference Image) */}
      <div className="max-w-4xl mx-auto px-4 text-center space-y-2">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
          مشتری‌های ما
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
          همراه مجموعه‌های صنعتی در تأمین قطعات خطوط تولید
        </p>
      </div>

      {/* Subtle Full-Width Horizontal Divider Line */}
      <div className="w-full border-t border-slate-100 my-4 sm:my-6" />

      {/* Moving Logos Viewport (Pure White Background, Logos Only, No Boxes) */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 overflow-hidden bg-white">
        {/* Soft White Edge Fade Masks (Left & Right) */}
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-white via-white/85 to-transparent z-10 pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-white via-white/85 to-transparent z-10 pointer-events-none" />

        <div
          dir="ltr"
          className={`flex items-center ${disableTransition ? '' : 'transition-transform duration-700 ease-in-out'}`}
          style={{
            transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)`,
          }}
        >
          {extendedClients.map((client, idx) => (
            <div
              key={`${client.id}-${idx}`}
              className="w-1/3 sm:w-1/4 lg:w-1/6 shrink-0 px-3 sm:px-6 flex flex-col items-center justify-center group cursor-pointer py-2"
            >
              <img
                src={cleanTransparentLogo(client.logo)}
                alt={client.name}
                title={client.name}
                className="h-16 sm:h-20 w-auto max-w-full object-contain mix-blend-multiply opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
