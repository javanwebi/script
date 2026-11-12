/**
 * Real PostgreSQL domain projection tests. These exercise the server's
 * adopted storage implementation but are NOT a browser/admin-Auth E2E test.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readAdoptedDocument,writeAdoptedDocument} from '../../server/db/adopted';
import type {SqlClient} from '../../server/db/connection';

async function main(){
 const raw=process.env.INTEGRATION_TEST_DATABASE_URL;
 if(!raw || process.env.CI_POSTGRES_ISOLATED!=='true')throw new Error('Requires ephemeral GitHub PostgreSQL');
 const url=new URL(raw);
 if(url.pathname!=='/sanatpish_ci'||!['localhost','127.0.0.1','::1'].includes(url.hostname))throw new Error('Unsafe database target');
 const db=new pg.Client({connectionString:raw});
 await db.connect();
 const cases:{module:string;key:string;value:any;id:string}[]=[
  {module:'CRM',key:'atlas_admin_customers_v1',id:'CRM-PG-01',value:[{id:'CRM-PG-01',fullName:'Example Client',mobile:'09123334455',companyName:'Example Company',approvedB2B:false}]},
  {module:'Agencies',key:'atlas_admin_dealers_v1',id:'DL-PG-01',value:[{id:'DL-PG-01',code:'D-PG-01',companyName:'Example Dealer',managerName:'A',phone:'09121112233',province:'Tehran',city:'Tehran'}]},
  {module:'Agency applications',key:'hyper_sanat_agency_applications_v1',id:'APP-PG-01',value:[{id:'APP-PG-01',fullName:'Example Applicant',phone:'09121114455',province:'Tehran',city:'Tehran',status:'pending'}]},
  {module:'Agency deposits',key:'hyper_sanat_deposit_receipts_v1',id:'DEP-PG-01',value:[{id:'DEP-PG-01',dealerName:'Example Dealer',amount:500,trackingCode:'TRACK-01',status:'pending'}]},
  {module:'Agency supply',key:'atlas_admin_supply_reqs_v1',id:'SUP-PG-01',value:[{id:'SUP-PG-01',dealerName:'Example Dealer',partCode:'SKU-PG-01',partName:'Test bearing',quantity:2,status:'pending'}]},
  {module:'Agency messages',key:'hyper_sanat_dealer_messages_v1',id:'MSG-PG-01',value:[{id:'MSG-PG-01',dealerName:'Example Dealer',subject:'Test',message:'Question',senderRole:'dealer'}]},
  {module:'RFQs',key:'hyper_sanat_inquiries_v2',id:'INQ-PG-01',value:[{id:'INQ-PG-01',partName:'Test Bearing',partCode:'6202ZZ',quantity:2,customerName:'Example',customerPhone:'09125554433',status:'answered'}]},
  {module:'Invoices',key:'atlas_admin_official_invoices_v1',id:'INV-PG-01',value:[{id:'INV-PG-01',invoiceNumber:'INV-PG-01',buyerName:'Test Factory',totalAmount:125000,status:'draft'}]},
  {module:'SMS history',key:'atlas_admin_sms_logs_v1',id:'SMS-PG-01',value:[{id:'SMS-PG-01',phone:'09120001122',message:'Test notification',status:'pending'}]},
  {module:'Price history',key:'atlas_admin_price_logs_v1',id:'PRICE-PG-01',value:[{id:'PRICE-PG-01',code:'6202ZZ',oldPrice:150,newPrice:160,actor:'admin',reason:'Correction'}]},
  {module:'Static pages',key:'atlas_admin_pages_v1',id:'PAGE-PG-01',value:[{id:'PAGE-PG-01',slug:'pg-test',title:'Test page',content:'Example content'}]},
  {module:'Club milestones',key:'atlas_portal_club_milestones_v1',id:'consumer:PG-01',value:{consumer:[{id:'PG-01',title:'Test level',targetPoints:100,rewardTitle:'Reward'}],high_volume:[]}},
  {module:'Announcements',key:'atlas_portal_content_announcements_v1',id:'ANN-PG-01',value:[{id:'ANN-PG-01',title:'Test announcement',body:'Short notification',portal:'consumer',active:true}]},
  {module:'Customer logos',key:'atlas_clients_logos_v3_moshtari',id:'LOGO-PG-01',value:[{id:'LOGO-PG-01',name:'Test Company',logo:'https://example.invalid/logo.png',active:true}]},
 ];
 const passed:string[]=[],failed:{module:string;message:string}[]=[];
 try{
  for(const item of cases){
   await db.query('BEGIN');
   try{
    await writeAdoptedDocument(db as unknown as SqlClient,item.key,item.value,'global');
    const fetched=await readAdoptedDocument(db as unknown as SqlClient,item.key,'global');
    const rows=Array.isArray(fetched)?fetched:item.module==='Club milestones'?fetched?.consumer:[];
    assert(Array.isArray(rows),'Expected list for '+item.key);
    assert(rows.some((entry:any)=>entry.id===item.id),'Row not fetched after write: '+item.id);
    await db.query('COMMIT');
    const fresh=await readAdoptedDocument(db as unknown as SqlClient,item.key,'global');
    assert(fresh!==undefined,'Stored document inaccessible after transaction');
    passed.push(item.module);
    console.log('PASS projection: '+item.module);
   }catch(error){
    await db.query('ROLLBACK');
    failed.push({module:item.module,message:error instanceof Error?error.message:String(error)});
    console.error('FAIL projection: '+item.module+': '+failed[failed.length-1].message);
   }
  }
  console.log(JSON.stringify({scope:'Real PostgreSQL server storage layer (not HTTP Auth)',passed,failed},null,2));
  assert.equal(failed.length,0,'Backend persistence failures require correction');
 }finally{await db.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
