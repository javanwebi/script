/**
 * Conservative, voice-only Persian text preparation for Piper Amir.
 * The visible answer and catalog/sku identifiers are never rewritten.
 */
const TECHNICAL_TERMS: Record<string,string> = {
  'FORZA':'فورزا',
  'SWR':'اِس دابلیو آر',
  'HTD':'اِچ تی دی',
  'SPA':'اِس پی اِی',
  'SPB':'اِس پی بی',
  'SPC':'اِس پی سی',
  'SPZ':'اِس پی زِد',
  'PK':'پی کِی',
  'PJ':'پی جِی',
  'PU':'پی یو',
  'PLC':'پی اِل سی',
  'PTFE':'پی تی اِف ای',
  'SKU':'اِس کی یو',
  'DIN':'دی آی اِن',
  'ISO':'آی اِس اُ',
  'SKF':'اِس کِی اِف',
  'C3':'سی سه',
};
const UNITS: Record<string,string> = {
  'mm':'میلی‌متر', 'cm':'سانتی‌متر', 'rpm':'دور بر دقیقه',
  'kw':'کیلووات', 'hz':'هرتز',
};

/** Conservative pronunciation hints used only for TTS; the UI text stays unchanged.
 * Persian is context-sensitive, so this dictionary intentionally covers common
 * words and industrial vocabulary instead of adding potentially wrong marks to
 * every unknown word or changing product identifiers.
 */
const PERSIAN_SPEECH_DIACRITICS: Record<string,string> = {
  'سلام':'سَلام','به':'بِه','صنعت':'صَنعَت','خوش':'خُوش','آمدید':'آمَدید',
  'من':'مَن','فورزا':'فورزا','هستم':'هَستَم','و':'وَ','برای':'بَرایِ',
  'راهنمایی':'رَهنَمایی','شما':'شُما','آماده':'آمادِه','آمادهام':'آمادِه‌اَم',
  'قطعه':'قِطعه','قطعات':'قِطَعات','تسمه':'تَسمه','تسمهها':'تَسمه‌ها',
  'تسمههای':'تَسمه‌های','تایمینگ':'تایمینگ','بلبرینگ':'بُل‌بِرینگ',
  'مشخصات':'مُشَخَّصات','فنی':'فَنّی','اندازه':'اَندازه','ابعاد':'اَبعاد',
  'عرض':'عَرض','قطر':'قُطر','استاندارد':'اِستاندارد','قیمت':'قِیمَت',
  'موجودی':'مَوجودی','سفارش':'سِفارش','انتقال':'اِنتِقال','قدرت':'قُدرَت',
  'کارخانه':'کارخانه','خط':'خَط','تولید':'تَولید','دستگاه':'دَستگاه',
  'استفاده':'اِستِفاده','بررسی':'بَررَسی','دقیق':'دَقیق','در':'دَر','از':'اَز',
  'است':'اَست','نیاز':'نِیاز','لطفاً':'لُطفاً','کد':'کُد','مناسب':'مُناسِب',
  'انتخاب':'اِنتِخاب','سریع':'سَریع','پاسخ':'پاسُخ','گفتار':'گُفتار',
  'صدا':'صِدا','پخش':'پَخش','پردازش':'پَردازِش','درخواست':'دَرخواست',
  'دریافت':'دَریافت','ارسال':'اِرسال','مدل':'مُدِل','مصنوعی':'مَصنوعی',
  'تبدیل':'تَبدیل','می‌شود':'می‌شَوَد','توانید':'تَوانید','شناسایی':'شِناسایی',
  'کاتالوگ':'کاتالوگ','محصول':'مَحصول','محصولات':'مَحصولات','برند':'بِرَند',
  'شماره':'شُماره','میکروفون':'میکروفون','کاربر':'کاربَر','سؤال':'سُؤال',
  'پرسش':'پُرسِش','که':'کِه','هم':'هَم','اگر':'اَگَر','موتور':'موتور',
  'سرعت':'سُرعَت','کیلووات':'کیلووات','میلی‌متر':'میلی‌مِتر',
};

function addPersianSpeechDiacritics(text: string): string {
  return text.replace(/[\u0600-\u06FF]+(?:\u200c[\u0600-\u06FF]+)*/gu, word => {
    const key = word.replace(/\u200c/g, '');
    return PERSIAN_SPEECH_DIACRITICS[key] || word;
  });
}

export function prepareAmirSpeechText(input:string):string {
  let text=String(input||'')
    .replace(/[ي]/g,'ی').replace(/[ك]/g,'ک')
    .replace(/[\u200e\u200f]/g,'')
    .replace(/[*#\x60_]+/g,' ')
    .replace(/\r?\n+/g,'، ')
    .replace(/\s+/g,' ')
    .trim();
  text=text.replace(/(?:تسمه\s+)?\bV[\s-]*belts?\b/gi,'تسمه وی بِلْت');
  text=text.replace(/\b([0-9۰-۹٠-٩]+(?:[.,٫][0-9۰-۹٠-٩]+)?)\s*(mm|cm|rpm|kw|hz)\b/gi,
    (_match,value:string,unit:string)=>value+' '+UNITS[unit.toLowerCase()]);
  text=text.replace(/\b(FORZA|SWR|HTD|SPA|SPB|SPC|SPZ|PK|PJ|PU|PLC|PTFE|SKU|DIN|ISO|SKF|C3)\b/gi,
    token=>TECHNICAL_TERMS[token.toUpperCase()]||token);
  text=text.replace(/([،؛.!؟])\s*\1+/g,'$1')
    .replace(/\s+([،؛.!؟])/g,'$1')
    .replace(/([،؛.!؟])(?=\S)/g,'$1 ')
    .replace(/\s+/g,' ')
    .trim();
  return addPersianSpeechDiacritics(text);
}

/**
 * Modestly equalizes WAV fragment volume without pitch shifting.
 * Only touches valid 16-bit mono PCM WAV; other formats pass through.
 */
export async function balanceAmirWavVolume(audio:Blob):Promise<Blob>{
  if(audio.size<64||audio.size>6_000_000)return audio;
  const bytes=await audio.arrayBuffer();
  const view=new DataView(bytes);
  if(view.getUint32(0,false)!==0x52494646||view.getUint32(8,false)!==0x57415645)return audio;
  let pos=12,channels=0,bits=0,format=0;
  let dataStart=-1,dataLength=0;
  while(pos+8<=bytes.byteLength){
    const id=view.getUint32(pos,false);
    const len=view.getUint32(pos+4,true);
    if(pos+8+len>bytes.byteLength)break;
    if(id===0x666d7420 && len>=16){
      format=view.getUint16(pos+8,true);
      channels=view.getUint16(pos+10,true);
      bits=view.getUint16(pos+22,true);
    }
    if(id===0x64617461){dataStart=pos+8;dataLength=len;break;}
    pos+=8+len+(len%2);
  }
  if(format!==1||channels!==1||bits!==16||dataStart<0||dataLength<1024)return audio;
  const count=Math.floor(dataLength/2);
  let power=0,peak=0,active=0;
  for(let i=0;i<count;i+=8){
    const sample=view.getInt16(dataStart+i*2,true)/32768;
    const abs=Math.abs(sample);
    if(abs>0.012){power+=sample*sample;active++;}
    if(abs>peak)peak=abs;
  }
  if(active<100||peak<0.02)return audio;
  const rms=Math.sqrt(power/active);
  const targetRms=0.155;
  const gain=Math.max(0.84,Math.min(1.16,targetRms/Math.max(0.001,rms),0.95/peak));
  if(Math.abs(gain-1)<0.025)return audio;
  for(let i=0;i<count;i++){
    const index=dataStart+i*2;
    const current=view.getInt16(index,true);
    view.setInt16(index,Math.max(-32768,Math.min(32767,Math.round(current*gain))),true);
  }
  return new Blob([bytes],{type:'audio/wav'});
}
