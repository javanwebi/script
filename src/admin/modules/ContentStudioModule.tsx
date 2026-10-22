import { PORTAL_LABELS } from "../../data/portalLabels";
import React, { useEffect, useState } from "react";
import {
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image,
  LayoutTemplate,
  Megaphone,
  Award,
} from "lucide-react";
import {
  portalContentService as cms,
  PortalTargetType,
  PortalLayoutConfig,
  PortalBannerItem,
  PortalAnnouncementItem,
  ClubTierMilestoneConfig,
  PortalPermissionsConfig,
} from "../../services/portalContentService";
import { adminService } from "../../services/adminService";
import { flushPortalChanges } from "../../services/portalRepository";
import { AnnouncementsAdminModule } from "./AnnouncementsAdminModule";

const permissions: Record<keyof PortalPermissionsConfig, string> = {
  showKpi1: "نمایش کادر اول",
  showKpi2: "نمایش کادر دوم",
  showKpi3: "نمایش کادر سوم",
  showKpi4: "نمایش کادر چهارم",
  showAnnouncements: "نمایش اطلاعیه‌ها",
  allowExcelPriceListDownload: "دانلود اکسل در سفارشات",
  showClubBarChart: "نمودار باشگاه",
  allowQuickSkuOrder: "ثبت سفارش با کد کالا",
  showCreditLimitCard: "نمایش اعتبار",
  allowQuickReorder: "تکرار سفارش",
  allowInvoicePrint: "مشاهده و چاپ فاکتور",
  showPromotionalBanners: "نمایش بنرها",
};
const textLabels: Record<string, string> = {
  heroWelcomePrefix: "عنوان بالای پنل",
  heroSubtitle: "توضیح پنل",
  primaryCtaLabel: "دکمه اصلی",
  excelDownloadButtonLabel: "دکمه دانلود اکسل",
  clubChartTitle: "عنوان نمودار",
  clubChartSubtitle: "توضیح نمودار",
  clubDetailsButtonLabel: "دکمه جوایز",
  ordersSectionTitle: "عنوان سفارشات",
  priceListSectionTitle: "عنوان لیست قیمت",
  kpi1Title: "عنوان کادر اول",
  kpi2Title: "عنوان کادر دوم",
  kpi3Title: "عنوان کادر سوم",
  kpi4Title: "عنوان کادر چهارم",
};
const themes = {
  industrial_orange: "نارنجی صنعت پیش",
  royal_gold: "طلایی",
  emerald_trust: "سبز",
  titanium_blue: "آبی",
  ruby_crimson: "زرشکی",
};
const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06518]/30";
const panel =
  "rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#E06518] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold text-[#55565A]">
      {label}
      {children}
    </label>
  );
}
const newBanner = (portal: PortalTargetType): PortalBannerItem => ({
  id: "",
  portal,
  scope: "collective",
  badgeText: "",
  title: "",
  subtitle: "",
  ctaText: "مشاهده محصولات",
  ctaLinkOrTab: "/products",
  theme: "industrial_orange",
  backgroundImage: "",
  active: true,
  createdAt: "",
});

export const ContentStudioModule: React.FC = () => {
  const [portal, setPortal] = useState<PortalTargetType>("consumer");
  const [customerId, setCustomerId] = useState("");
  const [section, setSection] = useState("banners");
  const [config, setConfig] = useState<PortalLayoutConfig>(() =>
    cms.getPortalConfig("consumer"),
  );
  const [banner, setBanner] = useState(() => newBanner("consumer"));
  const [announcement, setAnnouncement] = useState<PortalAnnouncementItem>({
    id: "",
    portal: "consumer",
    scope: "collective",
    title: "",
    body: "",
    tag: "",
    active: true,
    createdAt: "",
  });
  const [milestones, setMilestones] = useState(() =>
    cms.getClubMilestones("consumer"),
  );
  const [tick, setTick] = useState(0);
  const [labelSearch, setLabelSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const customers = adminService
    .getCustomers()
    .filter((c) => cms.isHighVolumeCustomer(c) === (portal === "high_volume"));
  useEffect(() => {
    const resolved = cms.getResolvedConfigForCustomer(portal, customerId);
    setConfig({
      portal,
      menus: resolved.menus,
      permissions: resolved.permissions,
      uiTexts: resolved.uiTexts,
      labels: resolved.labels,
      appearance: resolved.appearance,
    });
    setMilestones(cms.getClubMilestones(portal));
    setBanner(newBanner(portal));
    setAnnouncement({
      id: "",
      portal,
      scope: "collective",
      title: "",
      body: "",
      tag: "",
      active: true,
      createdAt: "",
    });
    setMessage("");
  }, [portal, customerId]);
  const save = async (operation: () => void) => {
    setBusy(true);
    setMessage("در حال ذخیره…");
    setFailed(false);
    try {
      operation();
      await flushPortalChanges();
      setTick((t) => t + 1);
      setMessage("تغییرات ذخیره شد و برای مشتریان قابل مشاهده است.");
    } catch (error: any) {
      setFailed(true);
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  const saveConfig = () =>
    save(() => {
      if (!config.menus.some((m) => m.enabled))
        throw new Error("حداقل یک منو باید فعال بماند.");
      if (customerId)
        cms.saveCustomerOverride({
          customerId,
          customerName:
            customers.find((c) => c.id === customerId)?.fullName || "",
          portal,
          menus: config.menus,
          appearanceOverride: config.appearance,
          permissionsOverride: config.permissions,
          uiTextsOverride: config.uiTexts,
          labelsOverride: config.labels,
          updatedAt: new Date().toISOString(),
        });
      else cms.savePortalConfig(portal, config);
    });
  const scoped = <
    T extends {
      portal: string;
      scope: string;
      targetCustomerId?: string;
    },
  >(
    list: T[],
  ) =>
    list.filter(
      (item) =>
        item.portal === portal &&
        (customerId
          ? item.scope === "individual" && item.targetCustomerId === customerId
          : item.scope === "collective"),
    );
  const banners = scoped(cms.getBanners());
  const saveBanner = () =>
    save(() => {
      if (!banner.title.trim()) throw new Error("عنوان بنر را وارد کنید.");
      if (
        banner.backgroundImage &&
        !/^(https:\/\/|\/(?!\/))/.test(banner.backgroundImage)
      )
        throw new Error("لینک تصویر باید HTTPS یا مسیر داخلی باشد.");
      if (
        !["/products", "/cart", ...config.menus.map((m) => m.id)].includes(
          banner.ctaLinkOrTab,
        )
      )
        throw new Error("مقصد دکمه معتبر نیست.");
      if (
        (banner.minCartVolume || 0) < 0 ||
        (banner.cartDiscountPercent || 0) < 0 ||
        (banner.cartDiscountPercent || 0) > 100
      )
        throw new Error("مبلغ و درصد تخفیف معتبر وارد کنید.");
      if (banner.cartDiscountPercent && !banner.minCartVolume)
        throw new Error("حداقل مبلغ خرید را تعیین کنید.");
      cms.saveBanner({
        ...banner,
        portal,
        scope: customerId ? "individual" : "collective",
        targetCustomerId: customerId || undefined,
        id: banner.id || crypto.randomUUID(),
        createdAt: banner.createdAt || new Date().toISOString(),
      });
      setBanner(newBanner(portal));
    });
  return (
    <div className="space-y-6 text-right" dir="rtl" data-version={tick}>
      <header className="rounded-3xl bg-gradient-to-l from-[#55565A] to-[#707176] p-6 text-white">
        <p className="text-xs text-orange-200 mb-2">مدیریت تجربه مشتری</p>
        <h1 className="text-2xl font-black text-white">تولید محتوا</h1>
        <p className="mt-2 text-sm text-white/80">
          بنر، اطلاعیه، کادر، عنوان، دکمه و دسترسی هر پنل را برای همه یا یک
          مشتری تنظیم کنید.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {(["consumer", "high_volume"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={portal === p}
            onClick={() => {
              setPortal(p);
              setCustomerId("");
            }}
            className={`${panel} text-right ${portal === p ? "ring-2 ring-[#E06518] border-transparent" : ""}`}
          >
            <LayoutTemplate className="text-[#E06518]" />
            <strong className="block text-lg">
              {p === "consumer" ? "پنل مشتری" : "پنل خرید بالا"}
            </strong>
            <span className="text-xs text-slate-500">
              {p === "consumer"
                ? "حساب کاربران ثبت‌نام‌شده"
                : "حساب مشتریان تعریف‌شده در CRM"}
            </span>
          </button>
        ))}
      </div>
      <div className={panel}>
        <Field label="مخاطب محتوا و تنظیمات">
          <select
            className={field}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">همه مشتریان این پنل</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} — {c.companyName || c.phone}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">
          محتوای عمومی و محتوای تکی با هم نمایش داده می‌شوند. تنظیمات تکی بر
          تنظیمات عمومی اولویت دارند.
        </p>
        {customerId && (
          <button
            className="text-sm text-red-600"
            onClick={() =>
              save(() => {
                cms.deleteCustomerOverride(customerId, portal);
                const base = cms.getPortalConfig(portal);
                setConfig(base);
              })
            }
          >
            حذف تنظیمات تکی و بازگشت به تنظیمات عمومی
          </button>
        )}
      </div>
      <nav
        className="flex gap-2 overflow-x-auto pb-2"
        aria-label="بخش‌های تولید محتوا"
      >
        {[
          ["banners", "بنرها", Image],
          ["layout", "منو، کادر و دسترسی", LayoutTemplate],
          ["announcements", "اطلاعیه‌ها", Megaphone],
          ["club", "مسیر باشگاه و جوایز", Award],
        ].map(([id, label, Icon]: any) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            aria-pressed={section === id}
            className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${section === id ? "bg-[#E06518] text-white" : "bg-white border text-[#55565A]"}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={`rounded-xl p-4 text-sm ${failed ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}
        >
          {message}
        </p>
      )}
      {section === "banners" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className={panel}>
            <h2 className="font-black">
              {banner.id ? "ویرایش بنر" : "بنر جدید"}
            </h2>
            {(
              [
                "badgeText",
                "title",
                "subtitle",
                "ctaText",
                "backgroundImage",
              ] as const
            ).map((key) => (
              <Field
                key={key}
                label={
                  {
                    badgeText: "برچسب",
                    title: "عنوان",
                    subtitle: "توضیح",
                    ctaText: "متن دکمه",
                    backgroundImage: "لینک تصویر بنر (اختیاری)",
                  }[key]
                }
              >
                <input
                  className={field}
                  value={banner[key] || ""}
                  onChange={(e) =>
                    setBanner({ ...banner, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="مقصد دکمه">
                <select
                  className={field}
                  value={banner.ctaLinkOrTab}
                  onChange={(e) =>
                    setBanner({ ...banner, ctaLinkOrTab: e.target.value })
                  }
                >
                  <option value="/products">محصولات</option>
                  <option value="/cart">سبد خرید</option>
                  {config.menus
                    .filter((m) => m.enabled)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="رنگ بنر">
                <select
                  className={field}
                  value={banner.theme}
                  onChange={(e) =>
                    setBanner({ ...banner, theme: e.target.value as any })
                  }
                >
                  {Object.entries(themes).map(([id, label]) => (
                    <option value={id} key={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="حداقل سبد خرید (تومان)">
                <input
                  className={field}
                  type="number"
                  min="0"
                  value={banner.minCartVolume || 0}
                  onChange={(e) =>
                    setBanner({
                      ...banner,
                      minCartVolume: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="درصد تخفیف کل سبد">
                <input
                  className={field}
                  type="number"
                  min="0"
                  max="100"
                  value={banner.cartDiscountPercent || 0}
                  onChange={(e) =>
                    setBanner({
                      ...banner,
                      cartDiscountPercent: Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={banner.active}
                onChange={(e) =>
                  setBanner({ ...banner, active: e.target.checked })
                }
              />
              فعال
            </label>
            <button disabled={busy} className={button} onClick={saveBanner}>
              <Save size={16} />
              ذخیره بنر
            </button>
          </div>
          <div className="space-y-4">
            <div
              className={`relative overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-l ${banner.theme === "royal_gold" ? "from-slate-900 via-amber-950 to-slate-900" : banner.theme === "emerald_trust" ? "from-emerald-950 via-teal-900 to-slate-900" : banner.theme === "titanium_blue" ? "from-slate-900 via-blue-950 to-indigo-950" : banner.theme === "ruby_crimson" ? "from-rose-950 via-slate-900 to-slate-950" : "from-[#55565A] via-[#646569] to-[#55565A]"} p-7 text-white`}
            >
              {banner.backgroundImage && (
                <img
                  src={banner.backgroundImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-20"
                />
              )}
              <div className="relative space-y-4">
                <p className="text-orange-200 text-xs">
                  {banner.badgeText || "پیش‌نمایش جایگاه بنر"}
                </p>
                <h2 className="text-2xl font-black leading-relaxed text-white">
                  {banner.title || "عنوان بنر شما در اینجا نمایش داده می‌شود"}
                </h2>
                <p className="text-sm text-white/80">{banner.subtitle}</p>
                <span className="inline-block rounded-xl bg-[#E06518] px-4 py-2 text-sm">
                  {banner.ctaText}
                </span>
              </div>
            </div>
            <h2 className="font-black">
              بنرهای {customerId ? "این مشتری" : "عمومی"}
            </h2>
            {banners.length === 0 && (
              <p className="text-sm text-slate-500">هنوز بنری ثبت نشده است.</p>
            )}
            {banners.map((b) => (
              <div key={b.id} className={panel}>
                <p className="font-bold">{b.title}</p>
                <p className="text-xs text-slate-500">
                  {b.active ? "فعال" : "غیرفعال"}
                </p>
                <div className="flex gap-4 text-sm">
                  <button onClick={() => setBanner(b)}>ویرایش</button>
                  <button
                    onClick={() =>
                      save(() => {
                        cms.saveBanner({ ...b, active: !b.active });
                      })
                    }
                  >
                    {b.active ? "غیرفعال کردن" : "فعال کردن"}
                  </button>
                  <button
                    aria-label={`حذف ${b.title}`}
                    className="text-red-600"
                    onClick={() =>
                      save(() => {
                        cms.deleteBanner(b.id);
                      })
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {section === "layout" && (
        <div className="space-y-5">
          <div className={panel}>
            <h2 className="font-black">منوها و ترتیب نمایش</h2>
            {[...config.menus]
              .sort((a, b) => a.order - b.order)
              .map((m, index, list) => (
                <div className="flex flex-wrap items-center gap-3" key={m.id}>
                  <label className="text-xs flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          menus: config.menus.map((x) =>
                            x.id === m.id
                              ? { ...x, enabled: e.target.checked }
                              : x,
                          ),
                        })
                      }
                    />
                    نمایش
                  </label>
                  <input
                    aria-label={`عنوان منو ${m.label}`}
                    className={`${field} flex-1 min-w-40`}
                    value={m.label}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        menus: config.menus.map((x) =>
                          x.id === m.id ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  {[-1, 1].map((direction) => (
                    <button
                      key={direction}
                      disabled={
                        index + direction < 0 ||
                        index + direction >= list.length
                      }
                      aria-label={
                        direction < 0 ? "انتقال بالا" : "انتقال پایین"
                      }
                      className="p-2 disabled:opacity-20"
                      onClick={() => {
                        const next = [...list];
                        [next[index], next[index + direction]] = [
                          next[index + direction],
                          next[index],
                        ];
                        setConfig({
                          ...config,
                          menus: next.map((x, i) => ({ ...x, order: i + 1 })),
                        });
                      }}
                    >
                      {direction < 0 ? (
                        <ArrowUp size={18} />
                      ) : (
                        <ArrowDown size={18} />
                      )}
                    </button>
                  ))}
                </div>
              ))}
          </div>
          <div className={panel}>
            <h2 className="font-black">ظاهر پنل و موبایل</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="جنس کادرها">
                <select
                  className={field}
                  value={config.appearance?.glass || "subtle"}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      appearance: {
                        density: config.appearance?.density || "comfortable",
                        glass: e.target.value as "subtle" | "solid",
                      },
                    })
                  }
                >
                  <option value="subtle">شیشه‌ای ظریف</option>
                  <option value="solid">سفید ساده</option>
                </select>
              </Field>
              <Field label="فاصله‌گذاری">
                <select
                  className={field}
                  value={config.appearance?.density || "comfortable"}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      appearance: {
                        glass: config.appearance?.glass || "subtle",
                        density: e.target.value as "comfortable" | "compact",
                      },
                    })
                  }
                >
                  <option value="comfortable">راحت و خلوت</option>
                  <option value="compact">فشرده</option>
                </select>
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              سه منوی اولِ فعال در نوار پایین موبایل قرار می‌گیرند؛ بقیه از «همه
              بخش‌ها» در دسترس‌اند. ترتیب را در فهرست منوها تغییر دهید.
            </p>
          </div>
          <div className={panel}>
            <h2 className="font-black">کادرها و دسترسی‌ها</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(permissions)
                .filter(
                  ([key]) =>
                    portal === "high_volume" || key !== "showCreditLimitCard",
                )
                .map(([key, label]) => (
                  <label
                    className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"
                    key={key}
                  >
                    <input
                      type="checkbox"
                      checked={
                        !!config.permissions[
                          key as keyof PortalPermissionsConfig
                        ]
                      }
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          permissions: {
                            ...config.permissions,
                            [key]: e.target.checked,
                          },
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
            </div>
          </div>
          <div className={panel}>
            <h2 className="font-black">عنوان‌ها و دکمه‌ها</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(textLabels)
                .filter(() => true)
                .map(([key, label]) => (
                  <Field label={label} key={key}>
                    <input
                      className={field}
                      value={String(
                        config.uiTexts[key as keyof typeof config.uiTexts],
                      )}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          uiTexts: { ...config.uiTexts, [key]: e.target.value },
                        })
                      }
                    />
                  </Field>
                ))}
              <Field label="رنگ سربرگ">
                <select
                  className={field}
                  value={config.uiTexts.headerAccentTheme}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      uiTexts: {
                        ...config.uiTexts,
                        headerAccentTheme: e.target.value as any,
                      },
                    })
                  }
                >
                  <option value="navy_orange">خاکستری و نارنجی</option>
                  <option value="charcoal_gold">خاکستری و طلایی</option>
                  <option value="slate_emerald">خاکستری و سبز</option>
                  <option value="deep_royal">خاکستری و آبی</option>
                </select>
              </Field>
            </div>
          </div>
          <div className={panel}>
            <h2 className="font-black">متن کادرها و سایر دکمه‌ها</h2>
            <input
              aria-label="جستجوی عنوان یا دکمه"
              placeholder="جستجوی متن برای ویرایش…"
              className={field}
              value={labelSearch}
              onChange={(e) => setLabelSearch(e.target.value)}
            />
            <div className="grid gap-4 md:grid-cols-2 max-h-[32rem] overflow-y-auto p-1">
              {PORTAL_LABELS[portal]
                .filter((text) => text.includes(labelSearch))
                .map((text) => (
                  <Field key={text} label={text}>
                    <textarea
                      className={field}
                      value={config.labels?.[text] ?? text}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          labels: { ...config.labels, [text]: e.target.value },
                        })
                      }
                    />
                  </Field>
                ))}
            </div>
          </div>
          <button disabled={busy} className={button} onClick={saveConfig}>
            <Save size={16} />
            ذخیره تنظیمات پنل
          </button>
        </div>
      )}
      {section === "announcements" && <AnnouncementsAdminModule />}
      {section === "club" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            سطح از حجم خرید ثبت‌شده محاسبه می‌شود. مشتری امکان انتخاب یا تغییر
            سطح ندارد. این تنظیمات مخصوص باشگاه پنل انتخاب‌شده است. برای انتشار
            یا ویرایش مراحل، مخاطب «همه مشتریان» را انتخاب کنید.
          </p>
          {customerId && (
            <p className="rounded-xl bg-orange-50 p-4 text-sm">
              مراحل باشگاه برای کل این پنل تعریف می‌شود. نمایش نمودار و دسترسی
              باشگاه هر مشتری را در بخش «منو، کادر و دسترسی» تنظیم کنید.
            </p>
          )}
          {!customerId && milestones.length === 0 && (
            <button
              className={button}
              onClick={() =>
                setMilestones([
                  {
                    code: "C",
                    tierKey: "bronze",
                    publicTitle: "همراه",
                    minPurchaseVolume: 0,
                    discountPercent: 0,
                    barColor: "",
                    badgeColor: "",
                    summaryBenefit: "",
                    rewardsList: [],
                    specialEvents: [],
                  },
                  {
                    code: "B",
                    tierKey: "silver",
                    publicTitle: "نقره‌ای",
                    minPurchaseVolume: 10000000,
                    discountPercent: 0,
                    barColor: "",
                    badgeColor: "",
                    summaryBenefit: "",
                    rewardsList: [],
                    specialEvents: [],
                  },
                  {
                    code: "A",
                    tierKey: "gold",
                    publicTitle: "طلایی",
                    minPurchaseVolume: 50000000,
                    discountPercent: 0,
                    barColor: "",
                    badgeColor: "",
                    summaryBenefit: "",
                    rewardsList: [],
                    specialEvents: [],
                  },
                  {
                    code: "D",
                    tierKey: "diamond",
                    publicTitle: "پلاتینیوم",
                    minPurchaseVolume: 100000000,
                    discountPercent: 0,
                    barColor: "",
                    badgeColor: "",
                    summaryBenefit: "",
                    rewardsList: [],
                    specialEvents: [],
                  },
                ])
              }
            >
              تعریف مسیر باشگاه این پنل
            </button>
          )}
          {!customerId &&
            milestones.map((m, index) => (
              <div className={panel} key={m.code}>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="عنوان سطح">
                    <input
                      className={field}
                      value={m.publicTitle}
                      onChange={(e) =>
                        setMilestones(
                          milestones.map((x, i) =>
                            i === index
                              ? { ...x, publicTitle: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="حداقل خرید (تومان)">
                    <input
                      className={field}
                      type="number"
                      min="0"
                      value={m.minPurchaseVolume}
                      onChange={(e) =>
                        setMilestones(
                          milestones.map((x, i) =>
                            i === index
                              ? {
                                  ...x,
                                  minPurchaseVolume: Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="تخفیف سطح (درصد)">
                    <input
                      className={field}
                      type="number"
                      min="0"
                      max="100"
                      value={m.discountPercent}
                      onChange={(e) =>
                        setMilestones(
                          milestones.map((x, i) =>
                            i === index
                              ? {
                                  ...x,
                                  discountPercent: Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                {(
                  ["summaryBenefit", "rewardsList", "specialEvents"] as const
                ).map((key) => (
                  <Field
                    key={key}
                    label={
                      {
                        summaryBenefit: "خلاصه مزایا",
                        rewardsList: "جوایز (هر مورد در یک خط)",
                        specialEvents: "برنامه‌ها و خدمات (هر مورد در یک خط)",
                      }[key]
                    }
                  >
                    <textarea
                      className={field}
                      rows={3}
                      value={
                        Array.isArray(m[key])
                          ? (m[key] as string[]).join("\n")
                          : m[key]
                      }
                      onChange={(e) =>
                        setMilestones(
                          milestones.map((x, i) =>
                            i === index
                              ? {
                                  ...x,
                                  [key]:
                                    key === "summaryBenefit"
                                      ? e.target.value
                                      : e.target.value.split("\n"),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
              </div>
            ))}
          <button
            disabled={busy || !!customerId}
            className={button}
            onClick={() =>
              save(() => {
                if (
                  customerId ||
                  milestones.some(
                    (m) =>
                      m.minPurchaseVolume < 0 ||
                      m.discountPercent < 0 ||
                      m.discountPercent > 100,
                  )
                )
                  throw new Error("مبلغ یا درصد معتبر نیست.");
                cms.saveClubMilestones(
                  [...milestones].sort(
                    (a, b) => a.minPurchaseVolume - b.minPurchaseVolume,
                  ),
                  portal,
                );
              })
            }
          >
            <Save size={16} />
            ذخیره مسیر باشگاه
          </button>
        </div>
      )}
    </div>
  );
};
