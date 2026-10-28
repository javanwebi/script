import assert from 'node:assert/strict';
import test from 'node:test';
import {runReadOnlyVisionCatalogAgent} from '../src/services/visionCatalogAgent';

const photos=[
 {id:'a',url:'/storage/products/catalog/e(001).png',label:'test gear',revision:'x',bindings:[{familyCode:'f1',code:'SKU-1',verified:true}]},
 {id:'b',url:'/storage/products/catalog/e(002).png',label:'test roller',revision:'x',bindings:[{familyCode:'f2',code:'SKU-2',verified:false}]}
];
const products=[{code:'SKU-1',name:'gear',familyCode:'f1'},{code:'SKU-2',name:'roller',familyCode:'f2'}];
const setup=(replies:any[])=>{
 const calls:any[]=[];let index=0;
 const client={models:{async generateContent(input:any){calls.push(input);return replies[index++];}}};
 return {calls,client};
};
const userImage='https://example.org/imageai/vision-abc.jpg';
const origin='https://example.org';

test('agent exposes only read-only tools and validates observed image ids and verified sku bindings',async()=>{
 const {calls,client}=setup([
  {candidates:[{content:{role:'model',parts:[{functionCall:{name:'browse_catalog',args:{offset:0,limit:20}}}]}}],functionCalls:[{name:'browse_catalog',args:{offset:0,limit:20}}]},
  {candidates:[{content:{role:'model',parts:[{functionCall:{name:'inspect_catalog_images',args:{image_ids:['a']}}}]}}],functionCalls:[{name:'inspect_catalog_images',args:{image_ids:['a']}}]},
  {text:JSON.stringify({summary:'قطعه مشابه است',matches:[{image_id:'a',relation:'similar',code:'SKU-1',reason:'same teeth'},{image_id:'b',code:'SKU-2',reason:'unknown'}]})}
 ]);
 const result=await runReadOnlyVisionCatalogAgent({client,model:'test',customerImageUrl:userImage,catalogImageOrigin:origin,images:photos,products});
 assert.equal(result.modelCalls,3);
 assert.equal(result.inspectedImages,1);
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].code,'SKU-1');
 assert.equal(result.complete,false);
 const tools=calls[0].config.tools[0].functionDeclarations.map((t:any)=>t.name);
 assert.deepEqual(tools,['browse_catalog','inspect_catalog_images','get_catalog_product']);
 const imageParts=calls[2].contents.at(-1).parts.filter((p:any)=>p.fileData);
 assert.equal(imageParts.length,1);
 assert.match(imageParts[0].fileData.fileUri,/catalog-images\/a$/);
});
test('unverified code is never promoted to SKU despite model claim',async()=>{
 const {client}=setup([
 {candidates:[{content:{role:'model',parts:[{functionCall:{name:'inspect_catalog_images',args:{image_ids:['b']}}}]}}],functionCalls:[{name:'inspect_catalog_images',args:{image_ids:['b']}}]},
 {text:JSON.stringify({summary:'similar',matches:[{image_id:'b',relation:'similar',code:'SKU-2',reason:'shape'}]})}
 ]);
 const result=await runReadOnlyVisionCatalogAgent({client,model:'test',customerImageUrl:userImage,catalogImageOrigin:origin,images:photos,products});
 assert.equal(result.matches[0].code,undefined);
});
test('agent refuses insecure customer or catalog origins',async()=>{
 const {client}=setup([]);
 await assert.rejects(()=>runReadOnlyVisionCatalogAgent({client,model:'test',customerImageUrl:'http://example.org/image.jpg',catalogImageOrigin:origin,images:photos,products}),/HTTPS/);
});
