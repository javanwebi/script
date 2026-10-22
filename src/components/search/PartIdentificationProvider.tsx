import React, { createContext, lazy, Suspense, useContext, useState } from 'react';
import { Link, type LinkProps, useLocation, useNavigate } from 'react-router-dom';
const Studio = lazy(() => import('./AiVisualPartSearchModal').then(m=>({default:m.AiVisualPartSearchModal})));
const IdentificationContext = createContext<(() => void) | null>(null);
export function PartIdentificationProvider({children}: {children:React.ReactNode}) {
  const [open,setOpen] = useState(false);
  const location = useLocation();
  React.useEffect(()=>setOpen(false),[location.key]);
  return <IdentificationContext.Provider value={()=>setOpen(true)}>{children}
    {open && <Suspense fallback={<div role="status" className="fixed inset-0 z-50 grid place-items-center bg-white/90">در حال باز کردن شناسایی قطعه…</div>}><Studio isOpen onClose={()=>setOpen(false)} /></Suspense>}
  </IdentificationContext.Provider>;
}
/** Ordinary links retain normal navigation, including Ctrl/cmd-click and new tabs. */
export function PartIdentificationLink({to,onClick,...props}:LinkProps) {
  const open = useContext(IdentificationContext);
  const path = typeof to === 'string' ? to : to.pathname;
  return <Link {...props} to={to} onClick={event=>{
    onClick?.(event);
    if(!event.defaultPrevented && path?.split('?')[0] === '/identify-part' && open && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!props.target || props.target === '_self')) {
      event.preventDefault(); open();
    }
  }} />;
}
export function PartIdentificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fullScreen = new URLSearchParams(location.search).get('from') === 'workspace';
  return <div className="min-h-[100dvh] bg-slate-100"><Suspense fallback={<div role="status">در حال بارگذاری شناسایی قطعه…</div>}>
    <Studio isOpen fullScreen={fullScreen} onClose={()=>navigate(fullScreen ? '/ai-consult' : '/', {replace:true})} />
  </Suspense></div>;
}
