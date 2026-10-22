import React from "react";
import { Link } from "react-router-dom";
import { MessageSquare, ArrowUpLeft } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { memberPath } from "../storefront/MemberAccess";
import { toPersianDigits, formatPrice } from "../../utils/formatters";
export function PortalInquiries({
  labels,
}: {
  labels: Record<string, string>;
}) {
  const { inquiries } = useCart();
  const { currentUser } = useAuth();
  const text = (s: string) => labels[s] || s;
  if (!inquiries.length) return null;
  return (
    <section className="portal-inquiries">
      <div>
        <span>
          <MessageSquare size={19} />
          {text("استعلام‌های من")}
        </span>
        <small>{text("وضعیت درخواست‌های ثبت‌شده")}</small>
      </div>
      {inquiries.slice(0, 5).map((item) => (
        <article key={item.id}>
          <div>
            <strong>{item.product.name}</strong>
            <span dir="ltr">{item.product.code}</span>
            <small>
              {toPersianDigits(item.quantity)} {text("عدد")} · {item.date}
            </small>
          </div>
          <div>
            <b>
              {text(
                item.status === "pending" ? "در انتظار بررسی" : "پاسخ داده شده",
              )}
            </b>
            {item.answeredPrice !== undefined && (
              <span>{formatPrice(item.answeredPrice)}</span>
            )}
            <Link to={memberPath(currentUser, item.product.code)}>
              {text("بررسی قطعه")}
              <ArrowUpLeft size={16} />
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
