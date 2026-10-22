import React from "react";
import {
  Award,
  Gift,
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
} from "lucide-react";
import type { Customer } from "../../types";
import {
  portalContentService as cms,
  type PortalTargetType,
  type PortalUiTextsConfig,
} from "../../services/portalContentService";
import { pricingCreditService } from "../../services/pricingCreditService";
const number = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
export function PortalClub({
  portal,
  user,
  texts,
  labels,
  details = false,
  onDetails,
  showChart = true,
}: {
  portal: PortalTargetType;
  user: Customer;
  texts: PortalUiTextsConfig;
  labels: Record<string, string>;
  details?: boolean;
  onDetails?: () => void;
  showChart?: boolean;
}) {
  const label = (s: string) => labels[s] ?? s;
  const milestones = [...cms.getClubMilestones(portal)].sort(
    (a, b) => a.minPurchaseVolume - b.minPurchaseVolume,
  );
  const volume = Math.max(
    0,
    user.totalPurchases ?? user.totalOrdersAmount ?? 0,
  );
  const current = milestones
    .filter((m) => volume >= m.minPurchaseVolume)
    .at(-1);
  const next = milestones.find((m) => m.minPurchaseVolume > volume);
  const max = Math.max(...milestones.map((m) => m.minPurchaseVolume), 1);
  const progress = Math.min(100, Math.round((volume / max) * 100));
  const rewards = details
    ? pricingCreditService.getRewardsForCustomer(user)
    : [];
  return (
    <div className="space-y-5">
      {showChart && (
        <section
          className="portal-club portal-glass"
          aria-label={texts.clubChartTitle}
        >
          <div className="portal-club-top">
            <div>
              <h2>{texts.clubChartTitle}</h2>
              <p>{texts.clubChartSubtitle}</p>
            </div>
            <span className="portal-club-badge">
              <Award size={18} />
              {current?.publicTitle || "عضو باشگاه"}
            </span>
          </div>
          <p className="portal-club-volume">
            {label("حجم خرید ثبت‌شده")}
            <strong>{number(volume)}</strong>تومان
          </p>
          {milestones.length ? (
            <>
              <div
                className="portal-progress"
                role="progressbar"
                aria-label="پیشرفت خرید تا آخرین مرحله باشگاه"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="portal-milestones">
                {milestones.map((m) => (
                  <div
                    key={m.code}
                    className={`portal-milestone ${volume >= m.minPurchaseVolume ? "reached" : ""}`}
                  >
                    <Award size={21} />
                    <strong>{m.publicTitle}</strong>
                    <span>{number(m.minPurchaseVolume)} تومان</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-5">
              {label(
                "مسیر رشد و جوایز باشگاه به‌زودی در همین بخش منتشر می‌شود.",
              )}
            </p>
          )}
          <div className="portal-club-footer">
            <p>
              {next ? (
                <>
                  <strong>
                    {number(Math.max(0, next.minPurchaseVolume - volume))} تومان
                  </strong>{" "}
                  تا {next.publicTitle}
                  {next.summaryBenefit ? `؛ ${next.summaryBenefit}` : ""}
                </>
              ) : current ? (
                current.summaryBenefit ||
                "به بالاترین مرحله تعریف‌شده رسیده‌اید."
              ) : (
                "پس از انتشار برنامه باشگاه، مراحل و مزایای آن را اینجا می‌بینید."
              )}
            </p>
            {onDetails && (
              <button
                type="button"
                className="portal-primary"
                onClick={onDetails}
              >
                {texts.clubDetailsButtonLabel}
                <ArrowLeft size={15} />
              </button>
            )}
          </div>
        </section>
      )}
      {details && (
        <>
          <div>
            <h2 className="text-lg font-bold">
              {label("جوایز و مزایای باشگاه")}
            </h2>
            <p className="text-xs text-slate-500 mt-2">
              {label(
                "سطح شما با حجم خرید ثبت‌شده محاسبه می‌شود. شرایط و مزایای هر مرحله را در ادامه ببینید.",
              )}
            </p>
          </div>
          <div className="portal-reward-grid">
            {milestones.map((m) => (
              <article
                className={`portal-reward-card portal-glass ${current?.code === m.code ? "is-current" : ""}`}
                key={m.code}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3>{m.publicTitle}</h3>
                  {volume >= m.minPurchaseVolume ? (
                    <CheckCircle2 size={20} className="text-[#E06518]" />
                  ) : (
                    <LockKeyhole size={18} className="text-slate-400" />
                  )}
                </div>
                <small>
                  از {number(m.minPurchaseVolume)} تومان خرید
                  {current?.code === m.code ? " · مرحله فعلی شما" : ""}
                </small>
                {m.summaryBenefit && (
                  <p className="text-xs mt-4 leading-7">{m.summaryBenefit}</p>
                )}
                <ul>
                  {m.discountPercent > 0 && (
                    <li>
                      <Gift size={15} />
                      <span>
                        {number(m.discountPercent)}٪ {label("تخفیف این مرحله")}
                      </span>
                    </li>
                  )}
                  {[...m.rewardsList, ...m.specialEvents].map((r, i) => (
                    <li key={i}>
                      <Gift size={15} />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                {!m.rewardsList.length && !m.specialEvents.length && (
                  <p className="text-xs text-slate-500 mt-3">
                    {label("جزئیات مزایای این مرحله هنوز منتشر نشده است.")}
                  </p>
                )}
              </article>
            ))}
          </div>
          {rewards.length > 0 && (
            <section className="portal-reward-card portal-glass">
              <h3>{label("جوایز فعال حساب من")}</h3>
              <ul>
                {rewards.map((r) => (
                  <li key={r.id}>
                    <Gift size={17} />
                    <span>
                      <strong>{r.rewardTitle}</strong>
                      <small>{r.rewardValue}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
