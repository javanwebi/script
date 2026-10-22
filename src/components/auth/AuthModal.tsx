import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AccountAccess } from "./AccountAccess";
export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalInitialView } = useAuth();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isAuthModalOpen) {
      ref.current?.showModal();
      const old = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = old;
        ref.current?.close();
      };
    }
  }, [isAuthModalOpen]);
  return (
    <dialog
      ref={ref}
      className="account-dialog"
      onCancel={closeAuthModal}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
      aria-label="ورود و ثبت‌نام صنعت پیش"
    >
      {isAuthModalOpen && (
        <>
          <button
            type="button"
            onClick={closeAuthModal}
            className="account-close"
            aria-label="بستن ورود و ثبت‌نام"
          >
            <X size={21} />
          </button>
          <AccountAccess
            key={authModalInitialView}
            initial={authModalInitialView}
            onDone={closeAuthModal}
          />
        </>
      )}
    </dialog>
  );
};
