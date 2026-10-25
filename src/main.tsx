import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {refreshDurableStorage} from './services/durableStorage';
import {installDatabaseReferences} from './data/databaseReferences';
import {installDatabaseProducts} from './data/mockGenerator';
import './index.css';
import { wantsCatalogV2Preview, setCatalogV2GuestReady } from './services/catalogClient';

function showBackendUnavailable(){
  // Keep the application shell visible, but do not serve stale bundled products
  // when PostgreSQL cannot be reached. Auth, checkout, pricing and writes fail closed.
  const notice=document.createElement('div');
  notice.setAttribute('role','status');
  notice.id='sanat-backend-status';
  notice.dir='rtl';
  notice.style.cssText='position:relative;z-index:10000;background:#fff7ed;color:#7c2d12;border-bottom:1px solid #fed7aa;padding:9px 16px;text-align:center;font-size:13px;';
  notice.textContent='ارتباط با پایگاه داده برقرار نیست؛ فهرست کالاها، قیمت و موجودی تا بازیابی ارتباط نمایش داده نمی‌شود. لطفاً دوباره تلاش کنید.';
  document.body.prepend(notice);
}

async function boot(){
  let rerenderOnFirstDatabaseHydration: (()=>void)|undefined;
  let hydratedOnce=false;
  // The public shell paints independently; product data waits for PostgreSQL.
  // The API still owns authentication, pricing and all persistent writes.
  window.addEventListener('sanat-durable-hydrated',(event)=>{
    const data=(event as CustomEvent).detail;
    if(data?.database){
      setCatalogV2GuestReady(wantsCatalogV2Preview() && !data.userId && !data.admin);
      installDatabaseReferences();
      installDatabaseProducts(data.products);
      document.getElementById('sanat-backend-status')?.remove();
      // The initial shell rendered without legacy JSON; remount once after DB hydration
      // so category menus created on mount pick up real PostgreSQL values.
      if (!hydratedOnce){ hydratedOnce=true; rerenderOnFirstDatabaseHydration?.(); }
    }
  });
  // Start React before awaiting a potentially slow cross-region database read.
  const {default:App}=await import('./App.tsx');
  const root=createRoot(document.getElementById('root')!);
  let mountRevision=0;
  rerenderOnFirstDatabaseHydration=()=>root.render(<StrictMode><App key={++mountRevision}/></StrictMode>);
  rerenderOnFirstDatabaseHydration();
  void refreshDurableStorage({omitGuestCatalog:wantsCatalogV2Preview()}).then(state=>{
    if(!state.database)showBackendUnavailable();
  }).catch(error=>{
    console.error('[SanatPish] Express API unavailable; PostgreSQL product data will not be replaced with stale JSON.',error);
    showBackendUnavailable();
  });
}

void boot().catch(error=>{
  console.error('[SanatPish] Fatal UI startup error',error);
  const root=document.getElementById('root');
  if(root)root.textContent='بارگذاری رابط سایت با مشکل مواجه شد. لطفاً دوباره تلاش کنید.';
});
