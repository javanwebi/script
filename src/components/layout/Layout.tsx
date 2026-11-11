import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileBottomBar } from './MobileBottomBar';
import { AuthModal } from '../auth/AuthModal';
import { AiFloatingButton } from '../common/AiFloatingButton';
import { useIdentificationOverlayOpen } from '../search/PartIdentificationProvider';
import { isStorefrontBottomNavRoute } from './storefrontBottomNavVisibility';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const identificationOpen = useIdentificationOverlayOpen();
  // Preserve the shared route-eligibility check for full-screen identification.
  const routeAllowsStorefrontDock = !identificationOpen && isStorefrontBottomNavRoute(location.pathname);
  // The approved About page uses a full editorial composition; keep the fixed
  // storefront dock and floating assistant from covering its mobile hero/content.
  const isAboutEditorialPage = ["/about", "/about-us", "/history", "/licenses", "/awards"].includes(location.pathname);
  const showStorefrontDock = routeAllowsStorefrontDock && !isAboutEditorialPage;

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

  const isEditorial=["/industries","/brands","/knowledge","/about","/categories"].some(p=>location.pathname.startsWith(p));
  const isHomePage = location.pathname === '/';
  const isCategoryPage = location.pathname.startsWith('/category/');
  const isTextileReferencePage = location.pathname.startsWith('/industries/textile');

  const handleOpenMobileMenu = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'));
  };

  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-search'));
  };

  return (
    <div className={`storefront min-h-screen flex flex-col ${showStorefrontDock ? "has-mobile-dock" : "no-mobile-dock"} ${isTextileReferencePage ? "textile-reference-layout" : ""}`}>
      <Header />
      <main className={`flex-1 w-full ${showStorefrontDock ? "pb-28 lg:pb-0" : ""} ${isHomePage || isEditorial || isCategoryPage ? '' : 'max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6'}`}>
        {children}
      </main>
      <Footer />
      {/* The mobile dock and floating actions are limited to storefront routes.
          Never keep them mounted behind the camera or product-identification overlay. */}
      {showStorefrontDock && (
        <>
          <MobileBottomBar
            onOpenMobileMenu={handleOpenMobileMenu}
            onOpenSearch={handleOpenSearch}
          />
          <AiFloatingButton showAssistant={!location.pathname.startsWith("/cart") && !location.pathname.startsWith("/product/")} />
        </>
      )}
      {/* Global OTP Auth Modal */}
      <AuthModal />
    </div>
  );
};
