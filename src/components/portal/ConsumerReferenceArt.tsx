import React, { useId } from "react";

/** Lightweight visual ornaments for the customer's eight reference screens.
 * Decorative only: order codes, shipment states and amounts stay in live HTML/API.
 */
export function ParcelArt({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 200 154" role="img" aria-label="تصویر بسته صنعتی صنعت پیش" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={"parcelTop" + uid} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffdb9a"/><stop offset="1" stopColor="#d98a37"/></linearGradient>
        <linearGradient id={"parcelFace" + uid} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#efac55"/><stop offset=".57" stopColor="#d58a38"/><stop offset="1" stopColor="#c87828"/></linearGradient>
        <linearGradient id={"parcelSide" + uid} x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#f2b46c"/><stop offset="1" stopColor="#b46b2a"/></linearGradient>
        <filter id={"parcelShadow" + uid} x="-25%" y="-35%" width="150%" height="170%"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      <ellipse cx="103" cy="136" rx="68" ry="10" fill="#ab6022" opacity=".18" filter={"url(#parcelShadow" + uid + ")"}/>
      <g stroke="#ee7b23" strokeLinecap="round" strokeWidth="3.4" opacity=".84">
        <path d="M13 99h33M22 109h22M8 122h35M12 84h24"/>
      </g>
      <path d="M44 51 102 25l63 27-59 25Z" fill={"url(#parcelTop" + uid + ")"} stroke="#d78935" strokeWidth="1.5"/>
      <path d="m44 51 62 26v65L44 111Z" fill={"url(#parcelFace" + uid + ")"} stroke="#bd772d" strokeWidth="1.5"/>
      <path d="m106 77 59-25v62l-59 28Z" fill={"url(#parcelSide" + uid + ")"} stroke="#aa6728" strokeWidth="1.5"/>
      <path d="m68 41 58 27 16-8-59-26Z" fill="#9c6335" opacity=".66"/>
      <path d="m69 42 15-7 60 25-17 8Z" fill="#f7d39b" opacity=".74"/>
      <path d="m69 63 16 7v20l-16-7Z" fill="#9c6532" opacity=".70"/>
      <path d="m46 55 57 24v60L46 109Z" fill="#ffdc9b" opacity=".10"/>
      <path d="m108 79 54-23v55l-54 27Z" fill="#fff4d7" opacity=".12"/>
      <g transform="translate(131 99)" fill="none" stroke="#8d521e" strokeWidth="4" strokeLinecap="round">
        <circle r="13"/><circle r="4.5" fill="#8d521e" stroke="none"/>
        <path d="M0-21v6M0 15v6M-21 0h6M15 0h6M-15-15l4 4M11 11l4 4M-15 15l4-4M11-11l4-4"/>
      </g>
    </svg>
  );
}

export function InvoiceArt({ className = "" }: { className?: string }) {
  const uid=useId().replace(/:/g,"");
  return (
    <svg className={className} viewBox="0 0 170 154" role="img" aria-label="تصویر فاکتور صنعتی" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id={"invoiceG"+uid} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffc180"/><stop offset="1" stopColor="#ef6820"/></linearGradient></defs>
      <ellipse cx="87" cy="139" rx="66" ry="10" fill="#e9a576" opacity=".25"/>
      <rect x="25" y="28" width="92" height="107" rx="10" transform="rotate(-9 25 28)" fill="#d96c26" opacity=".8"/>
      <rect x="38" y="14" width="91" height="114" rx="9" transform="rotate(-4 38 14)" fill="#fff" stroke="#e5a073" strokeWidth="2"/>
      <rect x="49" y="27" width="73" height="22" rx="5" fill={"url(#invoiceG"+uid+")"}/>
      <text x="85" y="42" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">فاکتور</text>
      <path d="M56 62h55M56 74h49M56 86h53M56 98h37" stroke="#d5d8db" strokeWidth="4.5" strokeLinecap="round"/>
      <path d="M89 129h46l10 11H93Z" fill="#fff4ec" stroke="#ee9b62" strokeWidth="1.5"/>
      <path d="M105 135h21" stroke="#ed7126" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

export function MedalArt({ className = "" }: { className?: string }) {
  const uid=useId().replace(/:/g,"");
  return (
    <svg className={className} viewBox="0 0 160 154" role="img" aria-label="مدال سطح باشگاه مشتریان" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id={"medalG"+uid} cx=".35" cy=".25" r=".85"><stop stopColor="#fff7bf"/><stop offset=".35" stopColor="#ffd65f"/><stop offset=".8" stopColor="#dc8c17"/><stop offset="1" stopColor="#b85e16"/></radialGradient></defs>
      <ellipse cx="80" cy="137" rx="59" ry="9" fill="#eab666" opacity=".26"/>
      <path d="M43 85 27 137l32-12 17 24 8-46Z" fill="#e48024" stroke="#b75a15" strokeWidth="2"/>
      <path d="m116 86 18 50-34-12-17 24-8-46Z" fill="#f5a82f" stroke="#c3791b" strokeWidth="2"/>
      <circle cx="80" cy="68" r="55" fill="#f8d168" stroke="#ffefac" strokeWidth="5"/>
      <circle cx="80" cy="68" r="47" fill={"url(#medalG"+uid+")"} stroke="#bb6d18" strokeWidth="3"/>
      <circle cx="80" cy="68" r="36" fill="none" stroke="#fff5bc" strokeWidth="3" opacity=".75"/>
      <path d="m80 39 9 19 21 3-15 16 3 22-18-10-18 10 3-22-15-16 21-3Z" fill="#fff1aa" stroke="#d38a21" strokeWidth="2"/>
      <path d="m80 44 7 17 17 2-13 14 2 16-13-8Z" fill="#fff9da" opacity=".9"/>
    </svg>
  );
}

export function LocationArt({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 170 130" role="img" aria-label="موقعیت تحویل کالا" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 80 50 62l33 15 35-13 35 14v40l-35-13-35 14-33-15-33 14Z" fill="#fff" stroke="#efb789" strokeWidth="3"/>
      <path d="M50 62v42m33-27v42m35-55v41" fill="none" stroke="#efc9aa" strokeWidth="2.5"/>
      <path d="M84 9c-21 0-36 15-36 35 0 23 36 61 36 61s36-38 36-61c0-20-15-35-36-35Z" fill="#f8791c" stroke="#e15e0c" strokeWidth="3"/>
      <circle cx="84" cy="43" r="13" fill="#fff7e8" stroke="#df6216" strokeWidth="2"/>
      <ellipse cx="85" cy="108" rx="17" ry="4" fill="#eb9b65" opacity=".34"/>
    </svg>
  );
}
