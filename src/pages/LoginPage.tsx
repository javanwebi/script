import React from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {AccountAccess} from '../components/auth/AccountAccess';
export function LoginPage(){
 const navigate=useNavigate();
 const [params]=useSearchParams();
 const requested=params.get('returnTo')||'/consumer-dashboard';
 const destination=requested.startsWith('/')&&!requested.startsWith('//')?requested:'/consumer-dashboard';
 return <main className="min-h-[100dvh] bg-slate-50 px-3 py-4 sm:py-10" dir="rtl">
   <Link to="/" className="block max-w-5xl mx-auto mb-3 text-sm">بازگشت به صنعت پیش</Link>
   <div className="max-w-5xl mx-auto overflow-hidden rounded-3xl bg-white shadow-sm">
     <AccountAccess initial='login' returnTo={destination}/>
   </div>
 </main>;
}
