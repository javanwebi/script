import {useState} from 'react';
import {Link} from 'react-router-dom';
import type {CatalogModelSuggestion, CatalogPhotoMatch} from '../../services/aiVisualSearchService';
import {visualCatalogCards} from '../../utils/visualCatalogCards';
import {toPersianDigits} from '../../utils/formatters';
import { CatalogResultImage } from './CatalogResultImage';

export function LocalModelResults({items:models,photos=[],onClose}:{items:CatalogModelSuggestion[];photos?:CatalogPhotoMatch[];onClose:()=>void}){
 const [expanded,setExpanded]=useState(false);
 const items=visualCatalogCards(models,photos);
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
    const target=item.code?'/product/'+encodeURIComponent(item.code):item.familyCode?'/product/'+encodeURIComponent(item.familyCode):null;
    const consult=new URLSearchParams({q:`درباره گزینه تصویری «${item.name}» راهنمایی کن. این فقط شباهت تصویری است و کد، اندازه و سازگاری قطعی نیست.${item.imageId?' مرجع تصویر کاتالوگ: '+item.imageId:''}`,...(item.code?{productCode:item.code,productName:item.name}:{})});
    return <li key={item.imageId ? 'photo-'+item.imageId : item.code || 'family-'+item.familyCode}>
     <article className="sanat-visual-result-card">
      <div className="sanat-visual-result-card__meta">
       <span className="sanat-visual-result-card__rank">گزینه {toPersianDigits(index+1)}</span>
       {item.matchBasis==='visual'&&item.visualScore!==undefined?
        <span className="sanat-visual-result-card__score">شباهت تصویری {toPersianDigits(item.visualScore)} از ۱۰۰</span>:
        <span className="sanat-visual-result-card__kind">{item.matchBasis==='explore'?'برای بررسی؛ تأیید نشده':item.matchBasis==='read_code'?'پیشنهاد بر اساس کد خوانده‌شده':'مدل هم‌خانواده'}</span>}
      </div>
      <CatalogResultImage
       sources={[item.image]}
       alt={item.name}
       familyReference={item.imageScope === 'family'}
       className="sanat-visual-result-card__image"
       eager={index === 0}
      />
      <div className="sanat-visual-result-card__body">
       <h5>{item.name}</h5>
       <p className="sanat-visual-result-card__family">{item.familyName}{item.model?' · مدل '+item.model:''}{item.size?' · سایز '+item.size:''}</p>
       {item.code?
        <p className="sanat-visual-result-card__code" dir="ltr">{item.code}</p>:
        <span className="sanat-visual-result-card__no-code">تصویر کاتالوگ · کد کالا هنوز ثبت نشده</span>}
       {item.imageScope==='family'&&item.image&&<p className="sanat-visual-result-card__image-note">{item.code?'تصویر نمونهٔ خانواده؛ شباهت مستقل این مدل تأیید نشده است.':'تصویر ثبت‌شده برای همین خانوادهٔ محصول'}</p>}
      </div>
      {!!item.specs.length&&<dl className="sanat-visual-result-card__specs">{item.specs.slice(0,4).map((spec,i)=><div key={i}><dt>{spec.key}</dt><dd dir="auto">{spec.value}</dd></div>)}</dl>}
      <p className="sanat-visual-result-card__reason">{item.reason}</p>
      <div className="sanat-visual-result-card__actions">
       {target && <Link to={target} onClick={onClose}>{item.code?'مشاهده این مدل':'مشاهده خانواده محصول'}</Link>}
       <Link to={'/ai-consult?'+consult.toString()} onClick={onClose}>مشاوره درباره این گزینه</Link>
       {item.code&&<Link to={'/product/'+encodeURIComponent(item.familyCode)} onClick={onClose}>همه مدل‌ها</Link>}
      </div>
     </article>
    </li>;
   })}
  </ol>
  {!expanded&&items.length>shown.length&&<button type="button" className="sanat-visual-results__more" onClick={()=>setExpanded(true)}>نمایش مدل‌های بیشتر ({toPersianDigits(items.length-shown.length)} گزینه)</button>}
 </section>;
}
