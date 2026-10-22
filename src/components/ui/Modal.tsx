import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | string;
  noPadding?: boolean;
  mobileBottomSheet?: boolean;
  fullScreen?: boolean;
  closeLabel?: string;
  dialogLabel?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  size,
  noPadding = false,
  mobileBottomSheet = true,
  fullScreen = false,
  closeLabel = "بستن پنجره",
  dialogLabel = "پنجره",
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthMap: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        fullScreen ? "items-stretch justify-center p-0" : mobileBottomSheet
          ? 'items-end md:items-center justify-center p-0 md:p-4'
          : 'items-center justify-center p-3 sm:p-4'
      }`}
    >
      {/* Backdrop */}
      {!fullScreen && <div
        className="fixed inset-0 bg-[#16191f]/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />}

      {/* Modal / Bottom Sheet Container */}
      <div
        role="dialog" aria-modal="true" aria-label={title || dialogLabel} dir="rtl"
        data-fullscreen={fullScreen}
        className={`relative w-full ${fullScreen ? "max-w-none h-[100dvh]" : maxWidthMap[maxWidth] || 'max-w-lg'} bg-white ${
          fullScreen ? "rounded-none" : mobileBottomSheet
            ? 'rounded-t-[28px] md:rounded-3xl max-h-[92vh] md:max-h-[90vh]'
            : 'rounded-3xl max-h-[90vh]'
        } shadow-2xl border-t md:border border-slate-200/80 overflow-hidden z-10 animate-in fade-in slide-in-from-bottom-6 md:zoom-in-95 duration-200`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#CBD2D8] bg-slate-50/70">
            <h3 className="font-bold text-[#55565A] text-base">{title}</h3>
            <button
              onClick={onClose}
              className="text-[#777A7D] hover:text-[#55565A] p-1.5 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label={closeLabel}
            >
              {fullScreen ? <span className="text-xs font-bold">{closeLabel}</span> : <X className="w-5 h-5" />}
            </button>
          </div>
        )}
        <div className={`${noPadding ? 'p-0' : 'p-5 sm:p-6'} overflow-y-auto ${fullScreen ? (title ? 'h-[calc(100dvh-72px)]' : 'h-[100dvh]') : 'max-h-[92vh] md:max-h-[88vh]'} scrollbar-thin`}>
          {children}
        </div>
      </div>
    </div>
  );
};
