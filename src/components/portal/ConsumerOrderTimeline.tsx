import React from "react";
import { Check, ClipboardCheck, PackageCheck, Package, Truck } from "lucide-react";

export type ConsumerOrderStatus = "registered" | "processing" | "shipped" | "delivered" | "cancelled";

const stages = [
  { key: "registered", label: "ثبت سفارش", Icon: ClipboardCheck },
  { key: "processing", label: "آماده‌سازی", Icon: Package },
  { key: "shipped", label: "ارسال", Icon: Truck },
  { key: "delivered", label: "تحویل", Icon: PackageCheck },
] as const;

export const orderStatusLabels: Record<ConsumerOrderStatus, string> = {
  registered: "ثبت‌شده",
  processing: "در حال آماده‌سازی",
  shipped: "در مسیر ارسال",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
};

export function ConsumerOrderTimeline({
  status, trackingCode, shippingMethod, compact = false,
}: {
  status: ConsumerOrderStatus;
  trackingCode?: string;
  shippingMethod?: string;
  compact?: boolean;
}) {
  const currentIndex = stages.findIndex((stage) => stage.key === status);
  return (
    <div className={`consumer-order-timeline ${compact ? "is-compact" : ""}`}>
      {status === "cancelled" ? (
        <p className="consumer-order-cancelled" role="status">
          این سفارش لغو شده است؛ برای جزئیات، با پشتیبانی تماس بگیرید.
        </p>
      ) : (
        <ol className="consumer-steps" aria-label="مراحل ثبت‌شده سفارش">
          {stages.map(({ key, label, Icon }, index) => {
            const complete = index < currentIndex || status === "delivered";
            const active = index === currentIndex && status !== "delivered";
            return (
              <li key={key} className={complete ? "is-done" : active ? "is-current" : "is-next"}
                aria-current={active ? "step" : undefined}>
                <span className="consumer-step-icon" aria-hidden="true">
                  {complete ? <Check size={17} /> : <Icon size={17} />}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
      )}
      <div className="consumer-shipment-meta">
        <span>{status === "shipped" ? "مرسوله شما ارسال شده است." : status === "delivered" ? "سفارش تحویل شده است." : status === "processing" ? "سفارش در حال آماده‌سازی است." : status === "registered" ? "سفارش شما در سیستم ثبت شده است." : "سفارش لغوشده است."}</span>
        {shippingMethod && <span>روش ارسال: {shippingMethod}</span>}
        {trackingCode && <span>کد رهگیری: <bdi dir="ltr">{trackingCode}</bdi></span>}
      </div>
    </div>
  );
}
