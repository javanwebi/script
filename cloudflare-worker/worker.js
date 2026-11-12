// Atlas Visual Catalog Recognition Cloudflare Worker (v8.1 — linked multimodal images)
// High-performance AI visual part recognition and 864-product catalog matching.
// Compatible with Google Gemini 3.x / 2.5 models and OpenAI-compatible endpoints.

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Primary Gemini API Key configured via environment variable
const SOURCE_AI_API_KEY = typeof env !== 'undefined' && env?.GEMINI_API_KEY ? env.GEMINI_API_KEY : '';

// Fallback cascade of Gemini models for 100% uptime and quota/spike resilience
const GEMINI_CASCADE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
];

const DEFAULT_CATALOG_URL =
  'https://raw.githubusercontent.com/javanwebi/atlastrai/main/src/data/catalogSummary.json';


function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function errorResponse(type, message, status = 400, headers = {}) {
  return jsonResponse(
    {
      success: false,
      error: { type, message },
    },
    status,
    headers
  );
}

function authorize(request, env) {
  const expected = String(env?.APP_WORKER_TOKEN || '').trim();
  if (!expected) return false;
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return token === expected;
}

// Convert Uint8Array to base64
function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// Resolve customer image in Base64 from any input link (Data URL, HTTP URL, or base64 string)
async function resolveImageBase64(body) {
  // 1. Direct base64 string or data URL in payload
  const rawBase64 =
    body.image_base64 ||
    body.imageBase64 ||
    body.imageDataUrl ||
    body.dataUrl ||
    body.image_data_url;

  if (typeof rawBase64 === 'string' && rawBase64.length > 50) {
    return rawBase64.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '').trim();
  }

  // 2. Check OpenAI-format messages array
  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            const urlVal = String(part.image_url.url).trim();
            if (urlVal.startsWith('data:image/')) {
              return urlVal.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '').trim();
            }
            if (urlVal.startsWith('http')) {
              const fetched = await fetchImageFromUrl(urlVal);
              if (fetched) return fetched;
            }
          }
        }
      }
    }
  }

  // 3. Fetch from provided candidate URLs (HTTP/HTTPS or data URL)
  const candidateUrls = [
    body.imageUrl,
    body.image_url,
    body.raw_github_image_url,
  ].filter((u) => typeof u === 'string' && u.trim().length > 10);

  for (const url of candidateUrls) {
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/')) {
      return trimmed.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '').trim();
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const fetched = await fetchImageFromUrl(trimmed);
      if (fetched) return fetched;
    }
  }

  return null;
}

async function fetchImageFromUrl(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'image/jpeg,image/png,image/webp,*/*' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) return null;
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > 100) {
        return uint8ArrayToBase64(new Uint8Array(arrayBuffer));
      }
    }
  } catch (e) {
    console.warn('[Fetch Image URL error]:', e.message);
  }
  return null;
}

async function resolveCatalog(body) {
  // 1. Inlined catalog products from payload
  if (Array.isArray(body.catalog) && body.catalog.length > 0) return body.catalog;
  if (Array.isArray(body.products) && body.products.length > 0) return body.products;

  // 2. Fetch from catalog source URL or GitHub raw catalog
  const candidateUrls = [body.catalog_source, body.catalogSource, DEFAULT_CATALOG_URL].filter(
    (u) => typeof u === 'string' && u.startsWith('http')
  );

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.products)) return data.products;
        if (Array.isArray(data.items)) return data.items;
      }
    } catch (e) {}
  }

  return [];
}

async function callGeminiVision(apiKey, imageBase64, userPrompt) {
  const promptText = `
نقش شما: مهندس ارشد و کارشناس بینایی ماشین و قطعات صنعتی در هایپر صنعت اطلس (نمایندگی انحصاری تسمه، پولی، بلبرینگ و تجهیزات فورزا FORZA و SWR).
وظیفه: تحلیل دقیق و تصویری این قطعه صنعتی آپلودشده توسط مشتری.

اطلاعات یا توضیحات مشتری:
${userPrompt || 'شناسایی و مشخصات کامل قطعه'}

دستورالعمل خروجی:
یک آبجکت JSON معتبر (تنها JSON بدون هیچ توضیح اضافه) با ساختار زیر تولید کن:
{
  "is_recognizable": true,
  "confidence": 95,
  "whatYouSee": "توصیف فارسی دقیق از آنچه در تصویر دیده می‌شود (رنگ، جنس، فرم، شیارها، دندانه‌ها، جای خار یا سوراخ‌ها)",
  "detected_part_type": "نوع دقیق قطعه (مثال: پولی تسمه وی، تسمه تایمینگ، بلبرینگ شیار عمیق، کوپلینگ، رولر سرامیکی)",
  "part_family": "یکی از موارد: industrial-belts یا pulleys یا bearings یا chains یا conveyor یا ceramic یا pipes",
  "visual_features": [
    "ویژگی ظاهری ۱",
    "ویژگی ظاهری ۲",
    "ویژگی ظاهری ۳"
  ],
  "detected_code_on_part": "کد یا شماره قطعه در صورت خوانده شدن از روی بدنه",
  "brand_detected": "FORZA یا SWR یا نام برند دیگر در صورت وجود علامت"
}
`.trim();

  let lastError = null;

  for (const model of GEMINI_CASCADE_MODELS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const data = await res.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          return { recognition: parsed, model };
        }
      } else {
        const errText = await res.text();
        lastError = `Model ${model} returned ${res.status}: ${errText.slice(0, 150)}`;
      }
    } catch (e) {
      lastError = `Model ${model} error: ${e.message}`;
    }
  }

  throw new Error(lastError || 'تمام مدل‌های هوش مصنوعی برای بینایی ماشین با خطا مواجه شدند.');
}

function matchCatalogProducts(recognition, catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return { matchedProducts: [], similarCandidates: [], exactVisualMatch: false };
  }

  const detectedType = String(recognition.detected_part_type || '').toLowerCase();
  const visualFeatures = Array.isArray(recognition.visual_features)
    ? recognition.visual_features.map((f) => String(f).toLowerCase())
    : [];
  const whatYouSee = String(recognition.whatYouSee || '').toLowerCase();
  const detectedCode = String(recognition.detected_code_on_part || '').toLowerCase();
  const allQueryText = `${detectedType} ${whatYouSee} ${visualFeatures.join(' ')}`;

  // Determine query mechanical family
  const isTimingBelt = /تایمینگ|timing|دندانه|8m|5m|14m|htd|t10|t5|at10|at5/.test(allQueryText);
  const isVBelt = !isTimingBelt && /وی بلت|v belt|vbelt|مقطع [abc]|شیار|spb|spa|spc/.test(allQueryText);
  const isPuBelt = !isTimingBelt && !isVBelt && /تسمه جوشی|تسمه گرد|تسمه تخت|تسمه پلی یورتان/.test(allQueryText);
  const isBelt = isTimingBelt || isVBelt || isPuBelt || /تسمه|belt/.test(allQueryText);
  const isPulley = /پولی|فولی|هرزگرد|pom|تفلون|pulley/.test(allQueryText);
  const isBushingCoupling = /کوپلینگ|بوش|خاری|الاستومری|خورشیدی|coupling|bushing/.test(allQueryText);
  const isBearing = /بلبرینگ|یاتاقان|رولبرینگ|هوزینگ|bearing|ucp|ucf/.test(allQueryText);
  const isPuWheel = /چرخ|رولیک|هدایت کاشی|روکش pu|wheel|roller/.test(allQueryText);
  const isVacuum = /مکنده|وکیوم|ساکشن|بادکش|سیلیکون|قاپک|vacuum/.test(allQueryText);
  const isImpeller = /پروانه|همزن|میکسر|لعاب|impeller/.test(allQueryText);
  const isPump = /دیافراگم|پمپ دیافراگمی|diaphragm/.test(allQueryText);
  const isBrush = /برس|فرچه|تمیزکننده|brush/.test(allQueryText);

  const scored = catalog.map((item) => {
    let score = 0;
    const name = String(item.name || '').toLowerCase();
    const catName = String(item.categoryName || '').toLowerCase();
    const subCat = String(item.subcategory || '').toLowerCase();
    const itemCode = String(item.code || '').toLowerCase();
    const forzaCode = String(item.forzaCode || '').toLowerCase();
    const itemText = `${name} ${catName} ${subCat} ${itemCode} ${forzaCode}`;

    // Category compatibility check - strict isolation so different looking parts don't leak in
    let compatible = true;
    if (isTimingBelt) {
      if (!(subCat.includes('تایمینگ') || name.includes('تایمینگ') || /8m|5m|14m|3m|t10|t5|htd/.test(itemText))) compatible = false;
      // Strict pitch isolation
      if (/8m/.test(allQueryText) && !/8m/.test(itemText) && /5m|14m|3m|t10|t5/.test(itemText)) compatible = false;
      if (/5m/.test(allQueryText) && !/5m/.test(itemText) && /8m|14m|3m|t10|t5/.test(itemText)) compatible = false;
      if (/14m/.test(allQueryText) && !/14m/.test(itemText) && /8m|5m|3m|t10/.test(itemText)) compatible = false;
      if (/t10/.test(allQueryText) && !/t10/.test(itemText) && /8m|5m|14m|3m|t5/.test(itemText)) compatible = false;
    } else if (isVBelt) {
      // Exclude bushings, tensioners, and sprockets that share catalog subcategory
      if (name.includes('بوش') || name.includes('کوپلینگ') || name.includes('کشنده') || name.includes('شفت') || name.includes('اسپراکت')) compatible = false;
      else if (!(subCat.includes('v-belt') || subCat.includes('وی بلت') || name.includes('v-belt') || name.includes('وی بلت') || name.includes('تسمه'))) compatible = false;
    } else if (isPuBelt) {
      if (!(subCat.includes('تسمه جوشی') || name.includes('تسمه جوشی'))) compatible = false;
    } else if (isBelt) {
      if (!(itemText.includes('تسمه') || subCat.includes('تسمه'))) compatible = false;
      if (name.includes('بوش') || name.includes('کوپلینگ') || name.includes('کشنده') || name.includes('شفت')) compatible = false;
    } else if (isPulley && !(itemText.includes('پولی') || itemText.includes('فولی') || itemText.includes('هرزگرد'))) compatible = false;
    else if (isBushingCoupling && !(itemText.includes('بوش') || itemText.includes('کوپلینگ'))) compatible = false;
    else if (isBearing && !(itemText.includes('بلبرینگ') || itemText.includes('یاتاقان') || itemText.includes('هوزینگ'))) compatible = false;
    else if (isPuWheel && !(itemText.includes('چرخ') || itemText.includes('رولیک') || itemText.includes('سر رولیک'))) compatible = false;
    else if (isVacuum && !(itemText.includes('مکنده') || itemText.includes('وکیوم') || itemText.includes('قاپک'))) compatible = false;
    else if (isImpeller && !(itemText.includes('پروانه') || itemText.includes('همزن'))) compatible = false;
    else if (isPump && !(itemText.includes('دیافراگم') || itemText.includes('پمپ'))) compatible = false;
    else if (isBrush && !(itemText.includes('برس') || itemText.includes('فرچه'))) compatible = false;

    if (!compatible) {
      return {
        code: item.code,
        name: item.name,
        forzaCode: item.forzaCode,
        categoryName: item.categoryName,
        subcategory: item.subcategory,
        page: item.page,
        image: item.image,
        imageUrl: item.image,
        score: 0,
        confidence: 0,
        exactMatch: false,
      };
    }

    // 0. Exact or partial part code match from image
    if (detectedCode && (itemCode.includes(detectedCode) || forzaCode.includes(detectedCode) || detectedCode.includes(itemCode))) {
      score += 55;
    }

    // Subcategory alignment
    if (isTimingBelt && (subCat.includes('تایمینگ') || name.includes('تایمینگ'))) score += 35;
    else if (isVBelt && (subCat.includes('v-belt') || subCat.includes('وی بلت') || name.includes('v-belt') || name.includes('وی بلت'))) score += 35;
    else if (isPuBelt && (subCat.includes('تسمه جوشی') || name.includes('تسمه جوشی'))) score += 35;
    else if (isBelt && itemText.includes('تسمه')) score += 25;
    else if (isPulley && (name.includes('پولی') || name.includes('فولی'))) score += 35;
    else if (isBushingCoupling && (name.includes('بوش') || name.includes('کوپلینگ'))) score += 35;
    else if (isBearing && (name.includes('بلبرینگ') || name.includes('یاتاقان'))) score += 35;
    else if (isPuWheel && name.includes('چرخ')) score += 35;
    else if (isVacuum && name.includes('مکنده')) score += 35;
    else if (isImpeller && name.includes('پروانه')) score += 35;
    else if (isPump && name.includes('دیافراگم')) score += 35;
    else if (isBrush && name.includes('برس')) score += 35;

    // Feature and profile matches
    if (/8m/.test(allQueryText) && /8m/.test(itemText)) score += 35;
    if (/5m/.test(allQueryText) && /5m/.test(itemText)) score += 35;
    if (/14m/.test(allQueryText) && /14m/.test(itemText)) score += 35;
    if (/3m/.test(allQueryText) && /3m/.test(itemText)) score += 35;
    if (/t10/.test(allQueryText) && /t10/.test(itemText)) score += 35;
    if (/مقطع b/.test(allQueryText) && /مقطع b|b\b/.test(itemText)) score += 25;
    if (/مقطع a/.test(allQueryText) && /مقطع a|a\b/.test(itemText)) score += 25;
    if (/spa|xpa/.test(allQueryText) && /spa|xpa/.test(itemText)) score += 25;

    for (const feat of visualFeatures) {
      if (feat.includes('شیار') && itemText.includes('شیار')) score += 8;
      if (feat.includes('دندانه') && itemText.includes('دندانه')) score += 8;
      if (feat.includes('آلومینیوم') && itemText.includes('آلومینیوم')) score += 8;
      if (feat.includes('تفلون') && itemText.includes('تفلون')) score += 8;
      if (feat.includes('پلی یورتان') && itemText.includes('پلی یورتان')) score += 8;
    }

    // Baseline category score
    score += 25;

    const imgUrl = item.image || `https://raw.githubusercontent.com/javanweb/imagesatlas/main/${item.code}.png`;

    return {
      code: item.code,
      name: item.name,
      forzaCode: item.forzaCode,
      categoryName: item.categoryName,
      subcategory: item.subcategory,
      page: item.page,
      image: imgUrl,
      imageUrl: imgUrl,
      score: Math.min(score, 99),
      confidence: Math.min(score, 99),
      exactMatch: score >= 90,
    };
  });

  // STRICT FILTER: Only products with score >= 85 (identical model / profile)
  const validScored = scored.filter((p) => p.score >= 85).sort((a, b) => b.score - a.score);
  const exactOnes = validScored.filter((p) => p.score >= 90 || p.exactMatch);

  // Return strictly matching products (max 4 products) - no loose padding!
  const matchedProducts = exactOnes.length > 0 ? exactOnes.slice(0, 4) : validScored.slice(0, 4);
  const exactVisualMatch = exactOnes.length > 0;

  return { matchedProducts, similarCandidates: [], exactVisualMatch };
}

async function resolveComparisonImage(value) {
  const inline=String(value || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(inline && inline[2].length<=14*1024*1024)return {mimeType:inline[1],data:inline[2]};
  const url=new URL(String(value || ''));
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:' || url.username || url.password || host==='localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[?::|\[?f[cd]|\[?fe[89ab])/i.test(host))throw new Error('Invalid public image URL');
  const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'manual',headers:{Accept:'image/jpeg,image/png,image/webp'}});
  if(!response.ok)throw Object.assign(new Error('Image URL unavailable'),{code:'image_http_'+response.status});
  let mimeType=(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if(mimeType==='image/jpg')mimeType='image/jpeg';
  if(!['image/jpeg','image/png','image/webp'].includes(mimeType))throw Object.assign(new Error('URL did not return an image'),{code:'image_invalid_mime'});
  if(Number(response.headers.get('content-length') || 0)>10*1024*1024)throw new Error('Image too large');
  const reader=response.body.getReader();const chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>10*1024*1024){await reader.cancel();throw new Error('Image too large');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return {mimeType,data:btoa(binary)};
}

// Explicit multi-image route used by exhaustive catalogue scans. No legacy catalogue matching.
async function handleMultimodalComparison(body, env, cors) {
  const apiKey=env?.GEMINI_API_KEY || SOURCE_AI_API_KEY;
  if(!apiKey)return errorResponse('ai_not_configured','کلید هوش مصنوعی ورکر تنظیم نشده است.',503,cors);
  const messages=(Array.isArray(body.messages) ? body.messages : []).slice(-8);
  const imageCount=messages.reduce((count,message)=>count+(Array.isArray(message.content) ? message.content : []).filter(part=>part.type==='image_url').length,0);
  if(imageCount<1 || imageCount>10)return errorResponse('invalid_image_count','تعداد تصاویر درخواست معتبر نیست.',400,cors);
  let contents;
  try {
    contents=(await Promise.all(messages.map(async message=>{
      const parts=(await Promise.all((Array.isArray(message.content) ? message.content : []).map(async part=>{
        if(part.type==='text' && typeof part.text==='string')return {text:part.text.slice(0,20000)};
        if(part.type==='image_url')return {inlineData:await resolveComparisonImage(part.image_url?.url)};
        return null;
      }))).filter(Boolean);
      return parts.length ? {role:message.role==='assistant' ? 'model' : 'user',parts} : null;
    }))).filter(Boolean);
  }catch{return errorResponse('invalid_image','لینک تصویر در دسترس نیست یا فایل تصویر معتبر نیست.',400,cors);}
  const models=[...new Set([env?.GEMINI_VISION_MODEL,body.model,'gemini-flash-latest',...GEMINI_CASCADE_MODELS].filter(Boolean))];
  for(const model of models) {
    try {
      const response=await fetch(`${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},signal:AbortSignal.timeout(30000),
        body:JSON.stringify({contents,generationConfig:{temperature:0.1,responseMimeType:'application/json',maxOutputTokens:4096,...(body.response_schema ? {responseSchema:body.response_schema} : {})}}),
      });
      if(!response.ok)continue;
      const data=await response.json();
      const text=(data.candidates?.[0]?.content?.parts || []).map(part=>part.text || '').join('');
      JSON.parse(text);
      return jsonResponse({protocol:'atlas-multimodal-v1',model,choices:[{message:{role:'assistant',content:text}}]},200,cors);
    }catch{}
  }
  return errorResponse('vision_unavailable','مدل بینایی در دسترس نیست؛ مقایسه انجام نشده است.',503,cors);
}

// Each image is embedded separately: never average the entire catalogue into one vector.
async function handleImageEmbeddings(body,env,cors) {
 const key=env?.GEMINI_API_KEY;
 if(!key)return errorResponse('ai_not_configured','کلید هوش مصنوعی ورکر تنظیم نشده است.',503,cors);
 const parts=(body.messages || []).flatMap(m=>m.content || []).filter(p=>p.type==='image_url');
 if(!parts.length || parts.length>6)return errorResponse('invalid_image_count','یک تا شش تصویر لازم است.',400,cors);
 let images;
 try {images=await Promise.all(parts.map(p=>resolveComparisonImage(p.image_url?.url)));}
 catch(error){return errorResponse('invalid_image','تصویر قابل دریافت نیست. ('+(error?.code || 'image_fetch_failed')+')',400,cors);}
 const model='gemini-embedding-2';
 const response=await fetch(`${GEMINI_API_BASE}/models/${model}:batchEmbedContents`,{
  method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(30000),
  body:JSON.stringify({requests:images.map(image=>({model:'models/'+model,content:{parts:[{inlineData:image}]},outputDimensionality:768}))})
 });
 if(!response.ok)return errorResponse(response.status===429?'rate_limit':'embedding_unavailable','مدل ایندکس تصویری در دسترس نیست.',response.status===429?429:503,cors);
 const data=await response.json();const vectors=(data.embeddings || []).map(e=>e.values);
 if(vectors.length!==images.length || vectors.some(v=>!Array.isArray(v) || v.length!==768 || v.some(n=>!Number.isFinite(n))))
  return errorResponse('embedding_invalid','پاسخ ایندکس معتبر نیست.',503,cors);
 return jsonResponse({protocol:'atlas-embedding-v1',model,choices:[{message:{role:'assistant',content:JSON.stringify({vectors})}}]},200,cors);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    try {
      // Health check and metadata endpoint
      if (url.pathname === '/' && request.method === 'GET') {
        return jsonResponse(
          {
            status: 'ok',
            service: 'Atlas AI Visual Catalog Recognition Worker',
            version: '8.1',
            multimodal_protocol: 'atlas-multimodal-v1',
            image_source_modes: ['https-url','inline'],
            ai_provider: 'gemini',
            primary_models: GEMINI_CASCADE_MODELS,
            catalog_mode: 'worker_ai_visual_matching',
            catalog_source: DEFAULT_CATALOG_URL,
            api_key_configured: Boolean(env?.GEMINI_API_KEY || SOURCE_AI_API_KEY),
          },
          200,
          cors
        );
      }

      // Model listing endpoint
      if (url.pathname === '/v1/models' && request.method === 'GET') {
        return jsonResponse(
          {
            object: 'list',
            data: GEMINI_CASCADE_MODELS.map((id) => ({ id, object: 'model', owned_by: 'google' })),
          },
          200,
          cors
        );
      }

      // Main Visual Recognition & Catalog Search Endpoint
      if (
        (url.pathname === '/v1/chat/completions' || url.pathname === '/api/ai/recognize') &&
        request.method === 'POST'
      ) {
        if (!authorize(request, env)) {
          return errorResponse('unauthorized', 'دسترسی به Worker مجاز نیست.', 401, cors);
        }

        let body = {};
        try {
          body = await request.json();
        } catch {
          return errorResponse('invalid_json', 'درخواست باید شامل بدنه معتبر JSON باشد.', 400, cors);
        }

        if(body?.task==='catalog-image-embedding')return handleImageEmbeddings(body,env,cors);
        if(body?.task==='catalog-image-scan')return handleMultimodalComparison(body,env,cors);

        // 1. Resolve customer image buffer in base64 from direct base64, data URL or image link
        const imageBase64 = await resolveImageBase64(body);
        if (!imageBase64) {
          return errorResponse(
            'missing_image',
            'تصویر مشتری یافت نشد. لطفاً لینک تصویر (imageUrl یا data:image) را ارسال کنید.',
            400,
            cors
          );
        }

        // Provider credentials are deployment secrets, never request input.
        const apiKey = env?.GEMINI_API_KEY || SOURCE_AI_API_KEY;
        if(!apiKey)return errorResponse('ai_not_configured','کلید هوش مصنوعی ورکر تنظیم نشده است.',503,cors);
        const catalog = await resolveCatalog(body);

        // 4. Extract prompt
        let prompt = body.prompt;
        if (!prompt && Array.isArray(body.messages)) {
          for (const msg of body.messages) {
            if (typeof msg.content === 'string') prompt = msg.content;
            if (Array.isArray(msg.content)) {
              for (const part of msg.content) {
                if (part.type === 'text') prompt = part.text;
              }
            }
          }
        }
        if (!prompt) prompt = 'شناسایی و مشخصات فنی این قطعه صنعتی';

        // 5. Run AI Vision Recognition on customer image using Gemini
        const { recognition, model } = await callGeminiVision(apiKey, imageBase64, prompt);

        // 6. Match against the 864 catalog products
        const { matchedProducts, similarCandidates, exactVisualMatch } = matchCatalogProducts(
          recognition,
          catalog
        );

        const responsePayload = {
          success: true,
          model,
          recognition,
          matchedProducts,
          similarCandidates,
          exactVisualMatch,
          // OpenAI compatibility fields
          id: `chatcmpl-${crypto.randomUUID()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({ recognition, matchedProducts, exactVisualMatch }),
              },
              finish_reason: 'stop',
            },
          ],
        };

        return jsonResponse(responsePayload, 200, cors);
      }

      return errorResponse('not_found', 'مسیر درخواست‌شده یافت نشد.', 404, cors);
    } catch (err) {
      console.error('[Worker Fatal Error]:', err);
      return jsonResponse(
        {
          success: false,
          error: {
            type: 'worker_internal_error',
            message: err.message || 'خطای غیرمنتظره در اجرای هوش مصنوعی در ورکر.',
          },
        },
        500,
        cors
      );
    }
  },
};
