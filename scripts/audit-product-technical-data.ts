/** Run: node --import tsx scripts/audit-product-technical-data.ts [--records] */
import { USER_PRODUCTS } from '../src/data/userProducts';
const records=USER_PRODUCTS.flatMap(p=>(p.variants||[]).map(v=>({family:p.code,sku:v.code,name:v.name,model:v.model,specifications:v.technicalSpecs,review:v.technicalReview})));
const status=records.reduce<Record<string,number>>((counts,row)=>{const key=row.review?.status||'unreviewed';counts[key]=(counts[key]||0)+1;return counts;},{});
console.log(JSON.stringify(process.argv.includes('--records')?records:{families:USER_PRODUCTS.length,skus:records.length,status,notice:'Reference enrichment does not certify the actual manufacturer product. Missing datasheets/models are explicitly tracked.'},null,2));
