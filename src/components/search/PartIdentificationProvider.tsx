import React, { createContext, lazy, Suspense, useContext, useState } from 'react';
import { Link, type LinkProps, useLocation, useNavigate } from 'react-router-dom';
const Studio = lazy(() => import('./AiVisualPartSearchModal').then(m=>({default:m.AiVisualPartSearchModal})));
type IdentificationEntry = (mode?: 'camera' | 'upload') => void;
const IdentificationContext = createContext<IdentificationEntry | null>(null);
const IdentificationOverlayContext = createContext(false);
export function usePartIdentificationAction(): IdentificationEntry | null {
  return useContext(IdentificationContext);
}
/** True while identification covers the storefront, including live camera, review and results. */
export function useIdentificationOverlayOpen(): boolean {
  return useContext(IdentificationOverlayContext);
}
export function PartIdentificationProvider({children}: {children:React.ReactNode}) {
  const [open,setOpen] = useState(false);
  const [startWithCamera,setStartWithCamera] = useState(false);
  const location = useLocation();
  React.useEffect(()=>setOpen(false),[location.key]);
  // Defense in depth: suppress legacy, third-party or late-mounted dock controls
  // for the entire identification session, including analysis and results.
  React.useEffect(() => {
    if (!open) return;
    document.body.classList.add("sanat-identification-open");
    return () => document.body.classList.remove("sanat-identification-open");
  }, [open]);
  const openIdentification: IdentificationEntry = (mode = 'upload') => {
    setStartWithCamera(mode === 'camera');
    setOpen(true);
  };
  return <IdentificationContext.Provider value={openIdentification}><IdentificationOverlayContext.Provider value={open}>{children}
    {open && <Suspense fallback={<div role="status" className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-3 bg-white text-sm font-bold text-[#2B313A]"><img src="/images/brand/forza-emblem.webp" alt="FORZA" className="h-14 w-14 object-contain" /><span>در حال آماده‌سازی شناسایی قطعه…</span></div>}><Studio isOpen standalone initialCamera={startWithCamera} fullScreen onClose={()=>setOpen(false)} /></Suspense>}
  </IdentificationOverlayContext.Provider></IdentificationContext.Provider>;
}
/** Ordinary links retain normal navigation, including Ctrl/cmd-click and new tabs. */
export function PartIdentificationLink({to,onClick,...props}:LinkProps) {
  const open = useContext(IdentificationContext);
  const path = typeof to === 'string' ? to : to.pathname;
  return <Link {...props} to={to} onClick={event=>{
    onClick?.(event);
    if(!event.defaultPrevented && path?.split('?')[0] === '/identify-part' && open && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!props.target || props.target === '_self')) {
      event.preventDefault(); open('upload');
    }
  }} />;
}
export function PartIdentificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const entrySource = new URLSearchParams(location.search).get('from');
  const fullScreen = entrySource === 'workspace' || entrySource === 'belt-selection';
  const returnPath = entrySource === 'workspace'
    ? '/ai-consult'
    : entrySource === 'belt-selection'
      ? '/belt-selection'
      : '/';
  return <div className="min-h-[100dvh] bg-slate-100"><Suspense fallback={<div role="status">در حال بارگذاری شناسایی قطعه…</div>}>
    <Studio isOpen standalone fullScreen domainHint={entrySource === 'belt-selection' ? 'industrial-belt' : undefined} onClose={()=>navigate(returnPath, {replace:true})} />
  </Suspense></div>;
}
