import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronUp, Instagram, MessageCircle, Phone, Send, X } from "lucide-react";
import "./floating-quick-actions.css";
import forzaWorkspaceMark from "../../assets/forza-workspace-mark.svg";

/** FORZA workspace emblem derived from the user-supplied orange triangular logo.
 * Kept under the old component name to preserve every existing call site.
 */
export const CognivoGeometricLogo: React.FC<{
  className?: string;
  size?: number;
}> = ({ className = "w-5 h-5", size }) => (
  <img
    src={forzaWorkspaceMark}
    alt=""
    aria-hidden="true"
    draggable={false}
    decoding="async"
    className={`object-contain shrink-0 ${className}`}
    style={size ? { width: size, height: size } : undefined}
  />
);

/* Keep FORZA's existing destination while adding direct access to the original support sheet. */
type ContactChannel = { label: string; href: string | null; icon: React.ReactNode; className: string };

const optionalSocialLink = (candidate: string | undefined, domain: string): string | null => {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || (host !== domain && host !== "www." + domain)) return null;
    if (!url.pathname || url.pathname === "/") return null;
    return url.href;
  } catch {
    return null;
  }
};

/** Mobile-only support sheet; desktop keeps direct workspace navigation. */
export const AiFloatingButton: React.FC<{ showAssistant?: boolean }> = ({ showAssistant = true }) => {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStart = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);

  const openWorkspace = () => {
    touchStart.current = null;
    setDragOffset(0);
    setSheetOpen(false);
    navigate("/ai-consult");
  };

  const handleLauncherClick = () => navigate("/ai-consult");

  useEffect(() => {
    if (!sheetOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("sanat-forza-contact-open");
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.body.classList.remove("sanat-forza-contact-open");
      window.removeEventListener("keydown", onKeyDown);
      launcher.current?.focus();
    };
  }, [sheetOpen]);

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    // Only the top grab handle and the dedicated swipe cue initiate navigation.
    // Scrolling contact details or touching communication links must never navigate.
    if (!(event.target as Element).closest(".sp-forza-contact__swipe, .sp-forza-contact__swipe-cta")) return;
    touchStart.current = event.touches[0]?.clientY ?? null;
    dragOffsetRef.current = 0;
  };
  const onTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStart.current === null) return;
    const delta = touchStart.current - (event.touches[0]?.clientY ?? touchStart.current);
    dragOffsetRef.current = Math.max(0, delta);
    setDragOffset(Math.min(125, dragOffsetRef.current));
  };
  const onTouchEnd = () => {
    const shouldEnter = touchStart.current !== null && dragOffsetRef.current > 58;
    touchStart.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    if (shouldEnter) openWorkspace();
  };

  const channels: ContactChannel[] = [
    {
      label: "واتساپ",
      href: "https://wa.me/989903427027",
      icon: <MessageCircle size={23} strokeWidth={1.9}/>,
      className: "sp-forza-contact__channel--whatsapp",
    },
    {
      label: "تلگرام",
      href: optionalSocialLink(import.meta.env.VITE_SANATPISH_TELEGRAM_URL, "t.me"),
      icon: <Send size={23} strokeWidth={1.8}/>,
      className: "sp-forza-contact__channel--telegram",
    },
    {
      label: "اینستاگرام",
      href: optionalSocialLink(import.meta.env.VITE_SANATPISH_INSTAGRAM_URL, "instagram.com"),
      icon: <Instagram size={23} strokeWidth={1.8}/>,
      className: "sp-forza-contact__channel--instagram",
    },
    {
      label: "ایتا",
      href: optionalSocialLink(import.meta.env.VITE_SANATPISH_EITAA_URL, "eitaa.com"),
      icon: <span className="sp-forza-contact__eitaa-symbol" aria-hidden="true">e</span>,
      className: "sp-forza-contact__channel--eitaa",
    },
  ];
  return (
    <>
    {showAssistant && (
      <div className="store-ai-quick-actions" role="group" aria-label="دسترسی سریع به میزکار FORZA">
        <button
          type="button"
          className="store-assistant unified-ai-launcher"
          ref={launcher}
          onClick={handleLauncherClick}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label="مشاوره و راه‌های ارتباطی FORZA"
        >
          <CognivoGeometricLogo size={29} />
          <span>میزکار FORZA</span>
        </button>
      </div>
    )}
    {showAssistant && sheetOpen && createPortal(
      <div className="sp-forza-contact" dir="rtl">
        <div className="sp-forza-contact__backdrop" onClick={() => setSheetOpen(false)} aria-hidden="true" />
        <section
          className="sp-forza-contact__sheet sp-forza-contact__sheet--reference"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sp-forza-contact-title"
          aria-describedby="sp-forza-contact-desc"
          data-testid="forza-mobile-contact-sheet"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          style={{ transform: dragOffset ? `translateY(-${dragOffset}px)` : undefined }}
        >
          <div className="sp-forza-contact__swipe" aria-hidden="true">
            <span className="sp-forza-contact__handle"/>
          </div>
          <button ref={closeButton} className="sp-forza-contact__close"
            type="button" onClick={() => setSheetOpen(false)} aria-label="بستن راه‌های ارتباطی">
            <X size={18}/>
          </button>
          <div
            className="sp-forza-contact__swipe-cta"
            data-testid="forza-swipe-instruction"
            role="link"
            tabIndex={0}
            aria-label="برای ورود به میزکار هوش مصنوعی، این پنل را با انگشت به بالا بکشید یا با صفحه‌کلید Enter بزنید."
            onKeyDown={event => {
              if (event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openWorkspace();
              }
            }}
          >
            <div className="sp-forza-contact__swipe-visual" aria-hidden="true">
              <div className="sp-forza-contact__swipe-arrows">
                <ChevronUp size={29} className="sp-forza-contact__arrow sp-forza-contact__arrow--top" />
                <ChevronUp size={29} className="sp-forza-contact__arrow sp-forza-contact__arrow--middle" />
                <ChevronUp size={29} className="sp-forza-contact__arrow sp-forza-contact__arrow--bottom" />
              </div>
            </div>
            <div className="sp-forza-contact__swipe-copy">
              <h2 id="sp-forza-contact-title">
                برای مشاوره هوش مصنوعی
                <span>صفحه را به بالا بکشید</span>
              </h2>
              <p id="sp-forza-contact-desc">
                از طریق فورزا (FORZA) با ما در ارتباط باشید و مشاوره تخصصی
                برای انتخاب و تأمین قطعات صنعتی دریافت کنید.
              </p>
            </div>
          </div>
          <div className="sp-forza-contact__inner">
            <div className="sp-forza-contact__channels" aria-label="پیام‌رسان‌ها و شبکه‌های اجتماعی">
              {channels.map(channel => channel.href ? (
                <a key={channel.label} href={channel.href} target="_blank" rel="noopener noreferrer"
                  className={`sp-forza-contact__channel ${channel.className}`} aria-label={`ارتباط از طریق ${channel.label}`}>
                  <span className="sp-forza-contact__channel-icon">{channel.icon}</span>
                  <span>{channel.label}</span>
                </a>
              ) : (
                <div key={channel.label} className={`sp-forza-contact__channel ${channel.className} is-unavailable`}
                  aria-label={`${channel.label}؛ آدرس رسمی هنوز ثبت نشده`} title="آدرس رسمی هنوز ثبت نشده">
                  <span className="sp-forza-contact__channel-icon">{channel.icon}</span>
                  <span>{channel.label}</span>
                  <small>به‌زودی</small>
                </div>
              ))}
            </div>
            <a className="sp-forza-contact__phone" href="tel:03535254703">
              <span className="sp-forza-contact__phone-copy">
                <strong>تماس با کارشناسان صنعت پیش</strong>
                <span dir="ltr">۰۳۵-۳۵۲۵۴۷۰۳</span>
              </span>
              <span className="sp-forza-contact__phone-icon"><Phone size={24}/></span>
            </a>
          </div>
        </section>
      </div>,
      document.body
    )}
    </>
  );
};
