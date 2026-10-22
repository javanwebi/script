const string={type:'STRING'};
const strings={type:'ARRAY',items:string};
export const observationSchema={type:'OBJECT',properties:{
 whatYouSee:string,detected_part_type:string,part_family_farsi:string,possible_families:strings,visual_shape:string,visual_features:strings,
 detected_code_on_part:string,code_read_confidence:{type:'NUMBER'},readable_markings:strings,
 observed_specifications:{type:'ARRAY',items:{type:'OBJECT',properties:{name:string,value:string,source:{type:'STRING',enum:['visible_marking']},evidence:string},required:['name','value','source','evidence']}},
 unknown_parameters:strings,material:string,confidence:{type:'NUMBER'},technical_advice:string,
},required:['whatYouSee','detected_part_type','visual_shape','visual_features','detected_code_on_part','code_read_confidence','readable_markings','observed_specifications','unknown_parameters']};
export const picksSchema={type:'OBJECT',properties:{picks:{type:'ARRAY',maxItems:6,items:{type:'OBJECT',properties:{n:{type:'INTEGER'},score:{type:'NUMBER'},reason:string},required:['n','score','reason']}}},required:['picks']};
export function comparisonsSchema(count:number){
 const check={type:'STRING',enum:['match','mismatch','unknown']};
 const fields=['geometry','holes','teeth','connections','markings'];
 return {type:'OBJECT',properties:{comparisons:{type:'ARRAY',minItems:count,maxItems:count,items:{type:'OBJECT',properties:{
 n:{type:'INTEGER'},similar:{type:'BOOLEAN'},score:{type:'NUMBER'},queryType:string,candidateType:string,sameType:{type:'BOOLEAN'},sameFamily:{type:'BOOLEAN'},
 matchingFeatures:strings,contradictions:strings,checks:{type:'OBJECT',properties:Object.fromEntries(fields.map(field=>[field,check])),required:fields},
 technicalChecks:{type:'ARRAY',items:{type:'OBJECT',properties:{field:string,status:check,reason:string},required:['field','status','reason']}},reason:string,
 },required:['n','similar','score','queryType','candidateType','sameType','sameFamily','matchingFeatures','contradictions','checks','reason']}}},required:['comparisons']};
}
