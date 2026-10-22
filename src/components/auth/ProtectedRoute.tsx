import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { portalContentService } from "../../services/portalContentService";

interface ProtectedRouteProps {
  children: React.ReactNode;
  portalType?: "consumer" | "high_volume";
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  portalType,
}) => {
  const location = useLocation();
  const { currentUser, authLoading } = useAuth();

  if (authLoading)
    return (
      <div role="status" className="py-24 text-center text-[#55565A]">
        در حال بررسی حساب…
      </div>
    );
  if (!currentUser) return <Navigate to="/login" replace />;

  if (!currentUser.onboardingCompleted && location.pathname !== "/onboarding")
    return <Navigate to="/onboarding" replace />;

  if (currentUser && portalType) {
    const isHighVol = portalContentService.isHighVolumeCustomer(currentUser);
    // کاربری که ثبت‌نام عادی کرده فقط به /consumer-dashboard دسترسی دارد و نباید وارد /account شود
    if (portalType === "high_volume" && !isHighVol) {
      return <Navigate to="/consumer-dashboard" replace />;
    }
    // مشتری خرید بالا که در CRM تعریف شده فقط به /account دسترسی دارد
    if (portalType === "consumer" && isHighVol) {
      return <Navigate to="/account" replace />;
    }
  }

  return <>{children}</>;
};
