import {useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import {validImageRegion,type ImageRegion} from '../../utils/imageRegion';
import {findImageRegionAtPoint,tapImageRegion} from '../../utils/imageRegionInteraction';

function sameRegion(a?:ImageRegion,b?:ImageRegion){
 return !!a&&!!b&&Math.abs(a.x-b.x)<0.002&&Math.abs(a.y-b.y)<0.002&&Math.abs(a.width-b.width)<0.002&&Math.abs(a.height-b.height)<0.002;
}
function toPersianNumber(value:number){return String(value).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);}

type ImagePoint={x:number;y:number};
type ResizeHandle='nw'|'ne'|'sw'|'se';
type Interaction={
 mode:'draw'|'move'|'resize';
 start:ImagePoint;
 clientX:number;
 clientY:number;
 origin?:ImageRegion;
 handle?:ResizeHandle;
};
interface Props {
 src:string;
 value?:ImageRegion;
 candidateRegions?:ImageRegion[];
 onChange:(region:ImageRegion|undefined)=>void;
 onSearch?:()=>void;
 onFullImageSearch?:()=>void;
 disabled?:boolean;
 variant?:'default'|'viewer';
}

export function ImageRegionSelector({
 src,value,candidateRegions=[],onChange,onSearch,onFullImageSearch,disabled=false,variant='default',
}:Props){
 const frameRef=useRef<HTMLDivElement|null>(null);
 const imageRef=useRef<HTMLImageElement|null>(null);
 const interaction=useRef<Interaction|null>(null);
 const [draft,setDraft]=useState<ImageRegion>();
 const [aspect,setAspect]=useState(1);
 const [tapFeedback,setTapFeedback]=useState<{x:number;y:number;key:number}|null>(null);
 const candidates=candidateRegions.filter(validImageRegion);
 const selected=draft || value;
 const viewer=variant==='viewer';

 const point=(event:PointerEvent<HTMLElement>):ImagePoint=>{
  const box=frameRef.current?.getBoundingClientRect() || imageRef.current?.getBoundingClientRect();
  if(!box||!box.width||!box.height)return {x:0.5,y:0.5};
  return {
   x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),
   y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height)),
  };
 };

 const makeDraft=(state:Interaction,p:ImagePoint):ImageRegion=>{
  if(state.mode==='draw'){
   return {x:Math.min(state.start.x,p.x),y:Math.min(state.start.y,p.y),width:Math.abs(p.x-state.start.x),height:Math.abs(p.y-state.start.y)};
  }
  const origin=state.origin || value || {x:0.25,y:0.25,width:0.5,height:0.5};
  if(state.mode==='move'){
   const x=Math.max(0,Math.min(1-origin.width,origin.x+p.x-state.start.x));
   const y=Math.max(0,Math.min(1-origin.height,origin.y+p.y-state.start.y));
   return {...origin,x,y};
  }
  const handle=state.handle || 'se';
  let left=origin.x,top=origin.y,right=origin.x+origin.width,bottom=origin.y+origin.height;
  if(handle.includes('w'))left=Math.max(0,Math.min(right-0.03,p.x));
  if(handle.includes('e'))right=Math.max(left+0.03,Math.min(1,p.x));
  if(handle.includes('n'))top=Math.max(0,Math.min(bottom-0.03,p.y));
  if(handle.includes('s'))bottom=Math.max(top+0.03,Math.min(1,p.y));
  return {x:left,y:top,width:right-left,height:bottom-top};
 };

 const beginResize=(event:PointerEvent<HTMLButtonElement>,handle:ResizeHandle)=>{
  if(disabled||!value)return;
  event.preventDefault();
  event.stopPropagation();
  interaction.current={mode:'resize',start:point(event),clientX:event.clientX,clientY:event.clientY,origin:{...value},handle};
  frameRef.current?.setPointerCapture(event.pointerId);
 };

 const finish=(event:PointerEvent<HTMLDivElement>)=>{
  const state=interaction.current;
  if(!state)return;
  interaction.current=null;
  if(disabled){setDraft(undefined);return;}
  const p=point(event);
  const moved=Math.hypot(event.clientX-state.clientX,event.clientY-state.clientY);
  const next=makeDraft(state,p);
  if(state.mode==='draw'&&moved<=8){
   setTapFeedback({x:p.x*100,y:p.y*100,key:Date.now()});
   const candidate=findImageRegionAtPoint(p,candidates);
   onChange(candidate || tapImageRegion(p,aspect));
  }else if((state.mode==='move'||state.mode==='resize')&&moved>3){
   if(validImageRegion(next))onChange(next);
  }else if(state.mode==='draw'&&validImageRegion(next)){
   onChange(next);
  }
  setDraft(undefined);
 };

 const keyboardBase=value || candidates[0] || {x:0.35,y:0.3,width:0.3,height:0.3};
 const selectedStyle=selected?{
  left:(selected.x*100)+'%',
  top:(selected.y*100)+'%',
  width:(selected.width*100)+'%',
  height:(selected.height*100)+'%',
 }:undefined;

 return <section
  className={'sanat-region-picker'+(viewer?' sanat-region-picker--viewer':'')}
  aria-label="انتخاب قطعه در تصویر"
  aria-disabled={disabled || undefined}
  data-testid="image-region-selector"
  dir="rtl"
 >
  {!viewer&&<header className="sanat-region-picker__header">
   <div className="sanat-region-picker__heading">
    <span className="sanat-region-picker__icon" aria-hidden="true">⌖</span>
    <div><strong>انتخاب محدوده قطعه</strong><p>{candidates.length?'روی کادر قطعه موردنظر بزنید؛ برای انتخاب نقطه دیگری از تصویر، همان‌جا لمس کنید.':'روی خود قطعه بزنید تا برش اولیه اطراف آن ساخته شود؛ برای دقت بیشتر کادر بکشید.'}</p></div>
   </div>
   <span className="sanat-region-picker__status">{value?'ناحیه منتخب':candidates.length?'پیشنهادهای سیستم':'انتخاب ناحیه'}</span>
  </header>}
  <div className="sanat-region-picker__layout">
   <div className="sanat-region-picker__canvas">
    <div
     ref={frameRef}
     role="group"
     aria-label="انتخاب قطعه با لمس، کشیدن یا کلیدهای جهت"
     aria-disabled={disabled || undefined}
     tabIndex={disabled?-1:0}
     className="sanat-region-picker__frame"
     dir="ltr"
     onPointerDown={event=>{
      if(disabled||event.button!==0||!event.isPrimary)return;
      const p=point(event);
      const inside=Boolean(value&&p.x>=value.x&&p.x<=value.x+value.width&&p.y>=value.y&&p.y<=value.y+value.height);
      interaction.current={mode:inside?'move':'draw',start:p,clientX:event.clientX,clientY:event.clientY,origin:inside&&value?{...value}:undefined};
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraft(undefined);
     }}
     onPointerMove={event=>{
      if(disabled||!interaction.current)return;
      setDraft(makeDraft(interaction.current,point(event)));
     }}
     onPointerUp={finish}
     onPointerCancel={()=>{interaction.current=null;setDraft(undefined);}}
     onLostPointerCapture={()=>{interaction.current=null;setDraft(undefined);}}
     onKeyDown={event=>{
      if(disabled)return;
      if(event.key==='Escape'){onChange(undefined);return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      const r={...keyboardBase};
      const dx=event.key==='ArrowLeft'?-0.02:event.key==='ArrowRight'?0.02:0;
      const dy=event.key==='ArrowUp'?-0.02:event.key==='ArrowDown'?0.02:0;
      if(event.shiftKey){
       r.width=Math.max(0.03,Math.min(1-r.x,r.width+dx));
       r.height=Math.max(0.03,Math.min(1-r.y,r.height+dy));
      }else{
       r.x=Math.max(0,Math.min(1-r.width,r.x+dx));
       r.y=Math.max(0,Math.min(1-r.height,r.y+dy));
      }
      onChange(r);
     }}
    >
     <img ref={imageRef} src={src} alt="عکس ارسالی؛ ناحیه قطعه را انتخاب کنید" draggable={false}
      onLoad={event=>setAspect(event.currentTarget.naturalWidth/event.currentTarget.naturalHeight||1)}/>
     {candidates.map((region,index)=><div key={index} aria-hidden="true"
      className={'sanat-region-picker__candidate '+(sameRegion(value,region)?'is-selected':'')}
      style={{left:(region.x*100)+'%',top:(region.y*100)+'%',width:(region.width*100)+'%',height:(region.height*100)+'%'}}>
      <span>{toPersianNumber(index+1)}</span>
      <i className="fv-lens-corner fv-lens-corner--tl"/>
      <i className="fv-lens-corner fv-lens-corner--tr"/>
      <i className="fv-lens-corner fv-lens-corner--bl"/>
      <i className="fv-lens-corner fv-lens-corner--br"/>
     </div>)}
     {selected&&!candidates.some(region=>sameRegion(selected,region))&&<div aria-hidden="true"
      className="sanat-region-picker__candidate is-selected is-manual" style={selectedStyle}>
      <i className="fv-lens-corner fv-lens-corner--tl"/>
      <i className="fv-lens-corner fv-lens-corner--tr"/>
      <i className="fv-lens-corner fv-lens-corner--bl"/>
      <i className="fv-lens-corner fv-lens-corner--br"/>
     </div>}
     {draft&&draft.width>0&&draft.height>0&&<div aria-hidden="true" className="sanat-region-picker__draft"
      style={{left:(draft.x*100)+'%',top:(draft.y*100)+'%',width:(draft.width*100)+'%',height:(draft.height*100)+'%'}}>
      <i className="fv-lens-corner fv-lens-corner--tl"/>
      <i className="fv-lens-corner fv-lens-corner--tr"/>
      <i className="fv-lens-corner fv-lens-corner--bl"/>
      <i className="fv-lens-corner fv-lens-corner--br"/>
     </div>}
     {value&&!disabled&&<div className="sanat-region-picker__handles" style={selectedStyle}>
      {(['nw','ne','sw','se'] as ResizeHandle[]).map(handle=><button
       key={handle}
       type="button"
       className={'sanat-region-picker__handle is-'+handle}
       aria-label={handle==='nw'?'تغییر گوشه بالا چپ':handle==='ne'?'تغییر گوشه بالا راست':handle==='sw'?'تغییر گوشه پایین چپ':'تغییر گوشه پایین راست'}
       onPointerDown={event=>beginResize(event,handle)}
       onClick={event=>event.preventDefault()}
      />)}
     </div>}
     {selected&&validImageRegion(selected)&&<span aria-hidden="true" className="fv-object-dot fv-object-dot--active"
      style={{left:((selected.x+selected.width/2)*100)+'%',top:((selected.y+selected.height/2)*100)+'%'}}/>}
     {tapFeedback&&<span key={tapFeedback.key} aria-hidden="true" className="fv-tap-ripple"
      style={{left:tapFeedback.x+'%',top:tapFeedback.y+'%'}}/>}
    </div>
   </div>
   {!viewer&&<aside className="sanat-region-picker__side">
    <div className="sanat-region-picker__side-title">پیش‌نمایش برش</div>
    {selected?<div className="sanat-region-picker__crop" style={{
      aspectRatio:aspect*selected.width/selected.height,
      backgroundImage:'url('+JSON.stringify(src)+')',
      backgroundSize:(100/selected.width)+'% '+(100/selected.height)+'%',
      backgroundPosition:(selected.width<1?100*selected.x/(1-selected.width):0)+'% '+(selected.height<1?100*selected.y/(1-selected.height):0)+'%',
     }}/>:<div className="sanat-region-picker__empty">هنوز برشی انتخاب نشده؛ روی قطعه بزنید یا کادر بکشید.</div>}
    <p>{selected?'برش انتخاب‌شده را بررسی کنید؛ جست‌وجو فقط پس از زدن دکمه انجام می‌شود.':'با لمس قطعه، برش اولیه ساخته می‌شود و می‌توانید آن را اصلاح کنید.'}</p>
    {onSearch&&<button type="button" className="sanat-region-picker__search" onClick={onSearch} disabled={disabled || !value}>جست‌وجوی این قطعه</button>}
    <button type="button" className="sanat-region-picker__full-image" onClick={()=>onFullImageSearch ? onFullImageSearch() : onChange(undefined)} disabled={disabled}>جست‌وجوی کل تصویر</button>
   </aside>}
  </div>
  {viewer&&<div className="sanat-region-picker__viewer-actions">
   <button type="button" className="sanat-region-picker__search" onClick={onSearch} disabled={disabled || !value}>تأیید برش و جست‌وجوی این قطعه</button>
   <button type="button" className="sanat-region-picker__full-image" onClick={()=>onFullImageSearch ? onFullImageSearch() : onChange(undefined)} disabled={disabled}>جست‌وجوی کل تصویر</button>
  </div>}
  {candidates.length > 1 && (
   <div className="fv-region-candidates" role="group" aria-label="انتخاب قطعه از میان نواحی تصویر" data-testid="vision-region-candidates">
    <span className="fv-region-candidates__heading">بخش‌های تصویر:</span>
    {candidates.slice(0, 8).map((region,index)=>(
     <button key={index} type="button" aria-pressed={sameRegion(selected,region)} disabled={disabled}
      className={'fv-region-candidates__item '+(sameRegion(selected,region)?'is-active':'')}
      onClick={() => { setDraft(undefined); onChange(region); }}>
      {'قطعه '+toPersianNumber(index+1)}
     </button>
    ))}
   </div>
  )}
  {!viewer&&<p className="sanat-region-picker__hint">لمس روی کادر پیشنهادی: انتخاب همان قطعه · لمس روی قطعه دیگر: ساخت برش جدید · کشیدن: تنظیم دقیق کادر</p>}
 </section>;
}
