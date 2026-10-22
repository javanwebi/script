import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileBottomBar } from './MobileBottomBar';
import { AuthModal } from '../auth/AuthModal';
import { AiFloatingButton } from '../common/AiFloatingButton';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  // Full-screen dedicated AI experiences (AI FORZA Voice & Cognivo AI Workspace)
  const isDedicatedAiWorkspace =
    location.pathname === '/ai-forza' ||
    location.pathname === '/forza' ||
    location.pathname === '/face-to-face' ||
    location.pathname === '/ai-consult' ||
    location.pathname === '/identify-part' ||
    location.pathname === '/ai-advisor' ||
    location.pathname === '/cognivo';

  if (isDedicatedAiWorkspace) {
    return <>{children}<AuthModal /></>;
  }

  // Isolated dedicated portals (dashboards): Admin, Dealer/Agency panel, B2B & Consumer Account Portals
  const isDedicatedPortal =
    ['/onboarding', '/login', '/register'].includes(location.pathname) ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/dealer') ||
    location.pathname.startsWith('/agency') ||
    location.pathname.startsWith('/consumer-dashboard') ||
    location.pathname.startsWith('/retail-account') ||
    location.pathname.startsWith('/account');

  if (isDedicatedPortal) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] text-[#55565A]">
        {children}
        <AuthModal />
      </div>
    );
  }

  const isEditorial=["/industries","/brands","/knowledge","/about"].some(p=>location.pathname.startsWith(p));
  const isHomePage = location.pathname === '/';

  const handleOpenMobileMenu = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'));
  };

  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-search'));
  };

  return (
    <div className="storefront min-h-screen flex flex-col">
      <Header />
      <main className={`flex-1 w-full pb-16 lg:pb-0 ${isHomePage || isEditorial ? '' : 'max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6'}`}>
        {children}
      </main>
      <Footer />
      {/* Mobile Floating Bottom Navigation Bar */}
      <MobileBottomBar
        onOpenMobileMenu={handleOpenMobileMenu}
        onOpenSearch={handleOpenSearch}
      />
      {/* Global AI Floating Quick Action Button */}
      {!location.pathname.startsWith("/cart") && !location.pathname.startsWith("/checkout") && !location.pathname.startsWith("/product/") && <AiFloatingButton />}
      {/* Global OTP Auth Modal */}
      <AuthModal />
    </div>
  );
};
