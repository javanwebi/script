import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/** Enable a bind-mounted deployment without recreating its app container.
 * The owner-created marker is authoritative; only local vision settings may change.
 */
export function loadLocalVisionConfig(root:string,env:Record<string,string|undefined>=process.env){
 if(!fs.existsSync(path.join(root,'.local-vision-enabled')))return false;
 const file=path.join(root,'.env.local-vision');
 if(!fs.existsSync(file))throw new Error('Local vision marker exists but private configuration is missing');
 const config=dotenv.parse(fs.readFileSync(file));
 if(config.PART_RECOGNITION_MODE!=='local-embedding' || !config.LOCAL_VISION_URL || !config.LOCAL_VISION_TOKEN || config.LOCAL_VISION_TOKEN.length<32)throw new Error('Invalid private local vision configuration');
 const url=new URL(config.LOCAL_VISION_URL);
 if(!['http:','https:'].includes(url.protocol) || url.username || url.password)throw new Error('Invalid local vision URL');
 if(config.LOCAL_VISION_ENCODER && !['dinov2-small','mobileclip2-s0'].includes(config.LOCAL_VISION_ENCODER))throw new Error('Unsupported local vision encoder');
 // The private file is authoritative, including rollback to a legacy DINO file
 // without an encoder key. Do not retain a previous container's MobileCLIP space.
 env.LOCAL_VISION_ENCODER=config.LOCAL_VISION_ENCODER || 'dinov2-small';
 env.LOCAL_VISION_MIN_SIMILARITY=config.LOCAL_VISION_MIN_SIMILARITY || (env.LOCAL_VISION_ENCODER==='mobileclip2-s0'?'0.55':'0.65');
 for(const key of ['LOCAL_VISION_URL','LOCAL_VISION_TOKEN','LOCAL_VISION_MIN_SIMILARITY','LOCAL_VISION_ENCODER'])if(config[key]!==undefined)env[key]=config[key];
 env.PART_RECOGNITION_MODE='local-embedding';
 return true;
}
