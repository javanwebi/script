const groups:[string,RegExp][]=[
 ['spring',/spring|فنر/],['seal',/washer|gasket|seal|اورینگ|واشر|آب.?بند/],['coupling',/coupling|spider|کوپلینگ/],
 ['gear',/gear|sprocket|چرخ.?دنده|پینیون/],['belt',/belt|تسمه/],['bearing',/bearing|بلبرینگ|یاتاقان/],
 ['pulley',/pulley|پولی|فولی/],['hose',/hose|شیلنگ/],['roller',/roller|رولیک|غلتک/],['rail',/rail|ریل/],
];
function group(text:string){const value=text.toLowerCase().replace(/\u200c/g,' ');return groups.find(([,pattern])=>pattern.test(value))?.[0];}
/** Unknown names do not establish a contradiction. Conflicting known families must never lend their SKUs to a photo. */
export function partFamilyCompatible(name:string,observation:any):boolean{
 const item=group(name);if(!item)return true;
 const primary=group([observation?.detected_part_type,observation?.part_family_farsi,observation?.visual_shape].join(' '));
 if(!primary)return true;
 const possible=Array.isArray(observation?.possible_families) ? observation.possible_families.filter((v:unknown)=>typeof v==='string').map(group) : [];
 return item===primary || possible.includes(item);
}
