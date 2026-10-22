import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {refreshDurableStorage} from './services/durableStorage';
import {installDatabaseReferences} from './data/databaseReferences';
import {installDatabaseProducts} from './data/mockGenerator';
import './index.css';

async function boot(){
const state=await refreshDurableStorage();if(state.database){installDatabaseProducts(state.products);installDatabaseReferences();}
window.addEventListener('sanat-durable-hydrated',(event)=>{const data=(event as CustomEvent).detail;if(data?.database){installDatabaseReferences();installDatabaseProducts(data.products);}});
const {default:App}=await import('./App.tsx');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

}
void boot().catch(()=>{document.getElementById('root')!.textContent='دریافت اطلاعات سایت از پایگاه داده ممکن نشد. لطفاً دوباره بارگذاری کنید.';});
