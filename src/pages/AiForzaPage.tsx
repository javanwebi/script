import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { goBackOrFallback } from '../utils/navigateBackOrFallback';

const AiForzaCallExperience = lazy(() =>
  import('../components/forza/ForzaQwenCallExperience').then(module => ({
    default: module.ForzaQwenCallExperience,
  })),
);

const LegacyCallExperience = lazy(() =>
  import('../components/forza/AiForzaCallExperience').then(module => ({
    default: module.AiForzaCallExperience,
  })),
);

export const AiForzaPage: React.FC = () => {
  const navigate = useNavigate();
  const [provider,setProvider]=useState<'qwen'|'legacy'|null>(null);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),1800);
    void fetch('/api/ai/forza-call-provider',{cache:'no-store',signal:controller.signal})
      .then(async r=>r.ok?await r.json():null)
      .then(data=>{if(active)setProvider(data?.provider==='legacy'?'legacy':'qwen');})
      .catch(()=>{if(active)setProvider('qwen');})
      .finally(()=>window.clearTimeout(timer));
    return()=>{active=false;controller.abort();window.clearTimeout(timer);};
  },[]);

  return (
    <div className="w-screen h-screen min-h-[100svh] max-h-[100dvh] overflow-hidden bg-[#080402] p-0 m-0">
      <Suspense fallback={<div className="w-full h-full min-h-[100svh] bg-[#080402]" aria-label="در حال آماده‌سازی تماس FORZA" />}>
        {provider==='legacy'
          ? <LegacyCallExperience onClose={() => goBackOrFallback(navigate, '/')} />
          : provider==='qwen'
          ? <AiForzaCallExperience onClose={() => goBackOrFallback(navigate, '/')} />
          : <div className="w-full h-full grid place-items-center text-white/80 text-sm" role="status">در حال اتصال فورزا…</div>}
      </Suspense>
    </div>
  );
};
