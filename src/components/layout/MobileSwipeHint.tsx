import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
/** A one-time visual cue. Never moves scroll position or competes with touch. */
export function MobileSwipeHint(){
 const {pathname}=useLocation();
 useEffect(()=>{
  if(pathname!=='/'||!matchMedia('(max-width: 767px)').matches||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const seen=new WeakSet<Element>();
  const cleanups=new Set<()=>void>();
  const observer=new IntersectionObserver(entries=>{
   for(const item of entries){
    const el=item.target as HTMLElement;
    if(!item.isIntersecting||el.scrollWidth<=el.clientWidth+20)continue;
    observer.unobserve(el);
    seen.add(el);
    const child=el.firstElementChild as HTMLElement|null;
    if(!child)return;
    const animation=child.animate([{transform:'translateX(0)'},{transform:'translateX(-16px)'},{transform:'translateX(0)'}],{duration:850,easing:'ease-in-out'});
    const stop=()=>animation.cancel();
    el.addEventListener('pointerdown',stop,{once:true,passive:true});
    const cleanup=()=>{animation.cancel();el.removeEventListener('pointerdown',stop);clearTimeout(timer);cleanups.delete(cleanup);};
    const timer=setTimeout(cleanup,900);
    cleanups.add(cleanup);
   }
  },{threshold:0.65});
  const observe=()=>document.querySelectorAll('.home-refined [class*="overflow-x-auto"], .home-refined .home-category-track, .home-refined .home-supply-deck').forEach(el=>{if(!seen.has(el))observer.observe(el);});
  observe();
  const mutation=new MutationObserver(observe);
  const root=document.querySelector('.home-refined');
  if(root)mutation.observe(root,{childList:true,subtree:true});
  return()=>{observer.disconnect();mutation.disconnect();cleanups.forEach(cleanup=>cleanup());};
 },[pathname]);
 return null;
}
