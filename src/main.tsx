import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {refreshDurableStorage} from './services/durableStorage';
import {installDatabaseReferences} from './data/databaseReferences';
import {installDatabaseProducts} from './data/mockGenerator';
import './index.css';

function showBackendUnavailable(){
  // The public Vite pages and bundled public catalog are source-driven.
  // Do not block the entire React app when the separately hosted Express API
  // is unavailable. Auth, checkout and writes remain server-only and must fail
  // closed rather than being simulated in the browser.
  const notice=document.createElement('div');
  notice.setAttribute('role','status');
  notice.id='sanat-backend-status';
  notice.dir='rtl';
  notice.style.cssText='position:relative;z-index:10000;background:#fff7ed;color:#7c2d12;border-bottom:1px solid #fed7aa;padding:9px 16px;text-align:center;font-size:13px;';
  notice.textContent='بخش عمومی سایت قابل مشاهده است؛ اتصال خدمات کاربران، سفارش‌ها و پایگاه داده فعلاً برقرار نیست.';
  document.body.prepend(notice);
}

async function boot(){
  // The public storefront must paint independently of the database.
  // The API still owns authentication, pricing and all persistent writes.
  window.addEventListener('sanat-durable-hydrated',(event)=>{
    const data=(event as CustomEvent).detail;
    if(data?.database){
      installDatabaseReferences();
      installDatabaseProducts(data.products);
      document.getElementById('sanat-backend-status')?.remove();
    }
  });
  // Start React before awaiting a potentially slow cross-region database read.
  const {default:App}=await import('./App.tsx');
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
  void refreshDurableStorage().then(state=>{
    if(!state.database)showBackendUnavailable();
  }).catch(error=>{
    console.error('[SanatPish] Express API is unavailable; public source UI will still load.',error);
    showBackendUnavailable();
  });
}

void boot().catch(error=>{
  console.error('[SanatPish] Fatal UI startup error',error);
  const root=document.getElementById('root');
  if(root)root.textContent='بارگذاری رابط سایت با مشکل مواجه شد. لطفاً دوباره تلاش کنید.';
});
