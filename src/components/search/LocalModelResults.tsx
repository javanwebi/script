import {useState} from 'react';
import {Link} from 'react-router-dom';
import type {CatalogModelSuggestion} from '../../services/aiVisualSearchService';
import {toPersianDigits} from '../../utils/formatters';

export function LocalModelResults({items,onClose}:{items:CatalogModelSuggestion[];onClose:()=>void}){
 const [expanded,setExpanded]=useState(false);
 if(!items.length)return null;
 const exploring=items.every(item=>item.matchBasis==='explore');
 const shown=expanded?items:items.slice(0,12);
 return <section className="sanat-visual-results space-y-3" aria-label="مدل‌های مشابه و گزینه‌های هم‌خانواده" dir="rtl">
  <header className="sanat-visual-results__header">
   <div>
    <span className="sanat-visual-results__eyebrow">FORZA VISION · CATALOGUE MATCH</span>
    <h4>{exploring?'نزدیک‌ترین گزینه‌ها برای بررسی':'محصولات مشابه پیدا‌شده'}</h4>
    <p>{exploring?'این گزینه‌ها تطبیق تأییدشده نیستند.':'نتایج بر اساس شباهت تصویر مرتب شده‌اند؛ کد، سایز و سازگاری فنی باید جداگانه بررسی شوند.'}</p>
   </div>
   <span className="sanat-visual-results__count">{toPersianDigits(items.length)} گزینه</span>
  </header>
  <ol className="sanat-visual-results__grid">
   {shown.map((item,index)=>{
    const target=item.code?'/product/'+encodeURIComponent(item.code):'/product/'+encodeURIComponent(item.familyCode);
    return <li key={item.code || 'family-'+item.familyCode}>
     <article className="sanat-visual-result-card">
      <div className="sanat-visual-result-card__meta">
       <span className="sanat-visual-result-card__rank">گزینه {toPersianDigits(index+1)}</span>
       {item.matchBasis==='visual'&&item.visualScore!==undefined?
        <span className="sanat-visual-result-card__score">شباهت تصویری {toPersianDigits(item.visualScore)} از ۱۰۰</span>:
        <span className="sanat-visual-result-card__kind">{item.matchBasis==='explore'?'برای بررسی؛ تأیید نشده':item.matchBasis==='read_code'?'پیشنهاد بر اساس کد خوانده‌شده':'مدل هم‌خانواده'}</span>}
      </div>
      <div className="sanat-visual-result-card__image">
       {item.image?<img src={item.image} alt={item.name} loading="lazy"/>:<span>عکس اختصاصی ثبت نشده</span>}
      </div>
      <div className="sanat-visual-result-card__body">
       <h5>{item.name}</h5>
       <p className="sanat-visual-result-card__family">{item.familyName}{item.model?' · مدل '+item.model:''}{item.size?' · سایز '+item.size:''}</p>
       {item.code?
        <p className="sanat-visual-result-card__code" dir="ltr">{item.code}</p>:
        <span className="sanat-visual-result-card__no-code">کد SKU مشخص نیست</span>}
       {item.imageScope==='family'&&item.image&&<p className="sanat-visual-result-card__image-note">{item.code?'تصویر نمونهٔ خانواده؛ شباهت مستقل این مدل تأیید نشده است.':'تصویر ثبت‌شده برای همین خانوادهٔ محصول'}</p>}
      </div>
      {!!item.specs.length&&<dl className="sanat-visual-result-card__specs">{item.specs.slice(0,4).map((spec,i)=><div key={i}><dt>{spec.key}</dt><dd dir="auto">{spec.value}</dd></div>)}</dl>}
      <p className="sanat-visual-result-card__reason">{item.reason}</p>
      <div className="sanat-visual-result-card__actions">
       <Link to={target} onClick={onClose}>{item.code?'مشاهده این مدل':'مشاهده خانواده محصول'}</Link>
       {item.code&&<Link to={'/product/'+encodeURIComponent(item.familyCode)} onClick={onClose}>همه مدل‌ها</Link>}
      </div>
     </article>
    </li>;
   })}
  </ol>
  {!expanded&&items.length>shown.length&&<button type="button" className="sanat-visual-results__more" onClick={()=>setExpanded(true)}>نمایش مدل‌های بیشتر ({toPersianDigits(items.length-shown.length)} گزینه)</button>}
 </section>;
}
