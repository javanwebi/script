import {useEffect} from 'react';
const loaders:Record<string,()=>Promise<unknown>>={
 '/ai-forza':()=>import('../../pages/AiForzaPage'),
 '/face-to-face':()=>import('../../pages/AiForzaPage'),
 '/ai-consult':()=>import('../../pages/AiConsultPage'),
 '/identify-part':()=>import('../search/AiVisualPartSearchModal'),
 '/products':()=>import('../../pages/ProductsPage'),
};
const pending=new Map<string,Promise<unknown>>();
export function RouteIntentPreload(){
 useEffect(()=>{
  const warm=(event:Event)=>{
   const anchor=(event.target as Element)?.closest?.('a[href]');
   if(!anchor)return;
   const url=new URL(anchor.getAttribute('href')||'',location.href);
   if(url.origin!==location.origin)return;
   const load=loaders[url.pathname];
   if(load&&!pending.has(url.pathname)){
    const task=load().catch(()=>{pending.delete(url.pathname);});
    pending.set(url.pathname,task);
   }
  };
  document.addEventListener('pointerover',warm,{passive:true});
  document.addEventListener('focusin',warm);
  document.addEventListener('touchstart',warm,{passive:true});
  return()=>{document.removeEventListener('pointerover',warm);document.removeEventListener('focusin',warm);document.removeEventListener('touchstart',warm);};
 },[]);
 return null;
}
