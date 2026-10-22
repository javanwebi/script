import { RecognitionServiceError } from './recognitionErrors';
import type { ImagePublisher } from './visionImageLinks';
import { recognitionWorkerUrl } from '../utils/recognitionPolicy';

/** Server-only multimodal transport; direct provider keys are never sent to a Worker. */
export async function workerVision(contents: any[], options: {
  env?: Record<string, string | undefined>; fetch?: typeof fetch; publishImage?: ImagePublisher;
  task?:'catalog-image-scan'|'catalog-image-embedding';responseSchema?:unknown;
} = {}): Promise<{text:string;model:string}> {
  const env=options.env || process.env;
  const origin=recognitionWorkerUrl(env);
  if(!origin) throw new Error('Recognition Worker is disabled');
  const messages=await Promise.all(contents.map(async turn=>({role:turn.role==='model' ? 'assistant' : turn.role,
    content:(await Promise.all(turn.parts.map(async(part:any)=>{
      if(part.text)return {type:'text',text:part.text};
      if(part.inlineData){
        const url=options.publishImage ? await options.publishImage(Buffer.from(part.inlineData.data,'base64'),part.inlineData.mimeType)
          : `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        if(options.publishImage && !url.startsWith('https://'))throw new Error('Vision image link must be public HTTPS');
        return {type:'image_url',image_url:{url}};
      }
      return null;
    }))).filter(Boolean)})));
  const headers:Record<string,string>={'Content-Type':'application/json'};
  // Access credentials come only from deployment secrets, never source defaults.
  const token=env.PART_RECOGNITION_WORKER_TOKEN?.trim();
  if(token)headers.Authorization=`Bearer ${token}`;
  const ms=Number(env.PART_RECOGNITION_WORKER_TIMEOUT_MS || 45000);
  const timeout=Number.isFinite(ms) ? Math.max(1500,Math.min(ms,90000)) : 45000;
  const response=await (options.fetch || fetch)(`${origin}/v1/chat/completions`,{
    method:'POST',headers,signal:AbortSignal.timeout(timeout),
    body:JSON.stringify({task:options.task || 'catalog-image-scan',messages,response_schema:options.responseSchema,model:env.PART_RECOGNITION_MODEL || undefined,response_format:{type:'json_object'}}),
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>null);
    const type=detail?.error?.type;
    throw new RecognitionServiceError(response.status===401 || response.status===403 ? 'worker_auth'
      : type==='ai_not_configured' ? 'provider_key' : type==='invalid_image' ? 'image_unreachable'
      : response.status===429 ? 'rate_limit' : 'unavailable');
  }
  const data=await response.json();
  if(contents.flatMap(turn=>turn.parts || []).filter(part=>part.inlineData).length>1 && data.recognition)throw new Error('Worker upgrade required: multiple images were not compared');
  const raw=data.recognition || data.choices?.[0]?.message?.content;
  const text=typeof raw==='string' ? raw : raw && typeof raw==='object' ? JSON.stringify(raw) : '';
  if(!text.trim())throw new Error('Recognition Worker returned no analysis');
  return {text,model:data.model || 'Worker Vision'};
}
