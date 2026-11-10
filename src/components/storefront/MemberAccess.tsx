import React from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, ArrowUpLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
export function memberPath(
  user: { approvedB2B?: boolean } | null,
  code?: string,
) {
  const root = user?.approvedB2B ? "/account" : "/consumer-dashboard";
  return `${root}${code ? `/product/${encodeURIComponent(code)}` : ""}`;
}
export function MemberAccess({
  code,
  compact = false,
}: {
  code?: string;
  compact?: boolean;
}) {
  const { currentUser, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const canViewPrices = currentUser?.canViewPrices === true;
  const destination = currentUser
    ? canViewPrices ? memberPath(currentUser, code) : "/contact"
    : memberPath(null, code);
  return (
    <div className={`member-access ${compact ? "member-access-compact" : ""}`}>
      <LockKeyhole size={21} />
      <div>
        <strong>قیمت و شرایط تجاری در حساب مشتری</strong>
        {!compact && (
          <p>
            قیمت‌های به‌روز پس از ورود و بر اساس دسترسی حساب شما نمایش داده می‌شوند.
            برای کدهای بدون قیمت فعال، امکان ثبت استعلام وجود دارد.
          </p>
        )}
        {currentUser && !canViewPrices && (
          <p>دسترسی مشاهده قیمت برای این حساب فعال نیست. برای بررسی و فعال‌سازی با پشتیبانی تماس بگیرید.</p>
        )}
        <button
          className="store-btn-primary"
          onClick={() =>
            !currentUser
              ? openAuthModal(destination, "register")
              : navigate(destination)
          }
        >
          {!currentUser ? "ثبت‌نام / ورود و مشاهده قیمت" : canViewPrices ? "ورود به پنل مشتری" : "درخواست فعال‌سازی قیمت"}
          <ArrowUpLeft size={17} />
        </button>
      </div>
    </div>
  );
}
