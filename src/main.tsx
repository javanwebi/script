import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {refreshDurableStorage} from './services/durableStorage';
import {installDatabaseReferences} from './data/databaseReferences';
import {installDatabaseProducts} from './data/mockGenerator';
import {shouldRemountAfterCatalogHydration} from './utils/forzaBootPolicy';
import {prefetchHomeFirstPaint} from './services/homeFirstPaint';
import './index.css';
import './company-pages.css';
import './about-page-approved.css';
import './company-pages-premium.css';

function showRuntimeUnavailable(message:string,onRetry:()=>void){
  let notice=document.getElementById('sanat-backend-status');
  if(!notice){
    notice=document.createElement('div');
    notice.id='sanat-backend-status';
    notice.setAttribute('role','status');
    notice.setAttribute('aria-live','polite');
    notice.dir='rtl';
    notice.style.cssText='position:relative;z-index:10000;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;background:#fff7ed;color:#7c2d12;border-bottom:1px solid #fed7aa;padding:10px 16px;text-align:center;font-size:13px;';
    document.body.prepend(notice);
  }
  const text=document.createElement('span');
  text.textContent=message;
  const retry=document.createElement('button');
  retry.type='button';
  retry.textContent='تلاش دوباره';
  retry.style.cssText='border:1px solid #c2410c;border-radius:8px;background:#fff;color:#9a3412;padding:5px 12px;font:inherit;font-weight:700;cursor:pointer;';
  retry.addEventListener('click',onRetry,{once:true});
  notice.replaceChildren(text,retry);
}

function removeRuntimeUnavailable(){
  document.getElementById('sanat-backend-status')?.remove();
}

async function boot(){
  let rerenderOnFirstDatabaseHydration:(()=>void)|undefined;
  let hydratedOnce=false;
  let runtimeRetryTimer:number|undefined;
  let runtimeRetryAttempt=0;
  let runtimeRefreshInFlight=false;

  const clearRuntimeRetry=()=>{
    if(runtimeRetryTimer!==undefined){
      window.clearTimeout(runtimeRetryTimer);
      runtimeRetryTimer=undefined;
    }
  };

  const scheduleRuntimeRetry=()=>{
    if(runtimeRetryTimer!==undefined)return;
    const delay=Math.min(30000,1000*2**Math.min(runtimeRetryAttempt,5));
    runtimeRetryAttempt+=1;
    runtimeRetryTimer=window.setTimeout(()=>{
      runtimeRetryTimer=undefined;
      void refreshRuntime();
    },delay);
  };

  const retryNow=()=>{
    clearRuntimeRetry();
    void refreshRuntime();
  };

  const showRuntimeFailure=(databaseUnavailable:boolean,error?:unknown)=>{
    if(databaseUnavailable){
      showRuntimeUnavailable(
        'سرویس داده در حال حاضر دیتابیس را در دسترس نمی‌بیند؛ تلاش برای اتصال مجدد به‌صورت خودکار ادامه دارد.',
        retryNow,
      );
      return;
    }
    const timedOut=error instanceof Error &&
      (error.name==='TimeoutError' || error.name==='AbortError' || /timed out|بیش از ۳۰ ثانیه|بیش از حد طول کشید/i.test(error.message));
    showRuntimeUnavailable(
      timedOut
        ? 'پاسخ سرویس داده در زمان مقرر دریافت نشد؛ سایت در حال تلاش مجدد است.'
        : 'دریافت اطلاعات از سرویس داده با اختلال موقت روبه‌رو شد؛ این خطا لزوماً به معنی قطع دیتابیس نیست و تلاش مجدد ادامه دارد.',
      retryNow,
    );
  };

  // A successful runtime hydration is the authoritative signal that the
  // application can use PostgreSQL-backed data again.
  window.addEventListener('sanat-durable-hydrated',(event)=>{
    const data=(event as CustomEvent).detail;
    if(data?.database){
      clearRuntimeRetry();
      runtimeRetryAttempt=0;
      installDatabaseReferences();
      // Lean admin bootstraps intentionally return an empty products array.
      // Only a full catalogue response may replace the browser's live product index.
      if(data.productsIncluded===true && Array.isArray(data.products))installDatabaseProducts(data.products);
      removeRuntimeUnavailable();
      // The initial shell rendered without legacy JSON; remount once after DB hydration
      // so category menus created on mount pick up real PostgreSQL values.
      if(!hydratedOnce){
        hydratedOnce=true;
        // FORZA holds a live microphone, ongoing TTS playback and a 4-second
        // particle animation. Mounting a new App key mid-call destroys all three.
        // Catalog pages still retain their existing hydration remount behavior.
        if(shouldRemountAfterCatalogHydration(window.location.pathname)){
          rerenderOnFirstDatabaseHydration?.();
        }
      }
    }
  });

  // Parallelize the real PostgreSQL homepage summaries with importing the App.
  // Never prefetch home data for FORZA calls, account or admin routes.
  if (window.location.pathname === '/') prefetchHomeFirstPaint();

  // Start React before awaiting a potentially slow cross-region database read.
  const {default:App}=await import('./App.tsx');
  const root=createRoot(document.getElementById('root')!);
  let mountRevision=0;
  rerenderOnFirstDatabaseHydration=()=>root.render(<StrictMode><App key={++mountRevision}/></StrictMode>);
  rerenderOnFirstDatabaseHydration();

  const isAdminRoute=/^\/admin(?:\/|$)/.test(window.location.pathname);
  const runtimeOptions={includeProducts:!isAdminRoute};

  const refreshRuntime=async()=>{
    if(runtimeRefreshInFlight)return;
    runtimeRefreshInFlight=true;
    try{
      const state=await refreshDurableStorage(runtimeOptions);
      if(!state.database)showRuntimeFailure(true);
    }catch(error){
      console.error('[SanatPish] Runtime data request failed; this does not by itself prove PostgreSQL is unavailable.',error);
      showRuntimeFailure(false,error);
    }finally{
      runtimeRefreshInFlight=false;
      if(document.getElementById('sanat-backend-status'))scheduleRuntimeRetry();
    }
  };

  // Recover immediately when the browser regains network connectivity.
  window.addEventListener('online',()=>{
    if(document.getElementById('sanat-backend-status'))retryNow();
  });

  void refreshRuntime();
}

void boot().catch(error=>{
  console.error('[SanatPish] Fatal UI startup error',error);
  const root=document.getElementById('root');
  if(root)root.textContent='بارگذاری رابط سایت با مشکل مواجه شد. لطفاً دوباره تلاش کنید.';
});
