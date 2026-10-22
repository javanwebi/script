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
  return (
    <div className={`member-access ${compact ? "member-access-compact" : ""}`}>
      <LockKeyhole size={21} />
      <div>
        <strong>قیمت، موجودی و استعلام در پنل شما</strong>
        {!compact && (
          <p>
            حساب خود را بسازید و خرید، استعلام و پیگیری سفارش‌ها را در یک جا
            انجام دهید.
          </p>
        )}
        <button
          className="store-btn-primary"
          onClick={() =>
            currentUser
              ? navigate(memberPath(currentUser, code))
              : openAuthModal(memberPath(currentUser, code), "register")
          }
        >
          {currentUser ? "ادامه در پنل من" : "ثبت‌نام / ورود و مشاهده در پنل"}
          <ArrowUpLeft size={17} />
        </button>
      </div>
    </div>
  );
}
