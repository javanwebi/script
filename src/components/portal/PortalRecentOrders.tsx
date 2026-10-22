import React from "react";
import { ArrowUpLeft, Package, ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { toPersianDigits, formatPrice } from "../../utils/formatters";
const statusLabels: Record<string, string> = {
  pending: "در انتظار بررسی",
  processing: "در حال پردازش",
  shipped: "در مسیر ارسال",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
  awaiting_payment: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
};
export function PortalRecentOrders({
  title,
  onOrders,
  labels,
}: {
  title: string;
  onOrders: () => void;
  labels: Record<string, string>;
}) {
  const { orders } = useCart();
  const { currentUser } = useAuth();
  const label = (s: string) => labels[s] ?? s;
  const recent = orders
    .filter((o) => o.customerId === currentUser?.id)
    .slice(0, 4);
  return (
    <section className="portal-recent-orders portal-glass">
      <div className="portal-recent-heading">
        <div>
          <span className="store-eyebrow">
            {label("آخرین فعالیت‌های خرید شما")}
          </span>
          <h2>{title}</h2>
        </div>
        <button type="button" onClick={onOrders}>
          {label("همه سفارش‌ها")}
          <ArrowUpLeft size={16} />
        </button>
      </div>
      {recent.length ? (
        <div className="portal-order-rows">
          {recent.map((o) => (
            <button type="button" onClick={onOrders} key={o.id}>
              <span className="portal-order-icon">
                <Package size={22} />
              </span>
              <span>
                <strong>{o.orderNumber}</strong>
                <small>
                  {toPersianDigits(o.items.length)} {label("قلم کالا")}
                </small>
              </span>
              <span className={`portal-order-status status-${o.status}`}>
                {label(statusLabels[o.status] || "در حال بررسی")}
              </span>
              <strong className="portal-order-amount">
                {formatPrice(o.finalAmount)}
              </strong>
              <ArrowLeft size={16} />
            </button>
          ))}
        </div>
      ) : (
        <div className="portal-orders-empty">
          <Package size={30} />
          <div>
            <h3>{label("سفارش‌های شما از اینجا شروع می‌شوند")}</h3>
            <p>
              {label(
                "بعد از ثبت خرید، وضعیت سفارش و جزئیات ارسال را در همین بخش می‌بینید.",
              )}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
