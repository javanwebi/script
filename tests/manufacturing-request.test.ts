import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManufacturingRequest as validate} from '../server/commerce/manufacturingRequest';
test('manufacturing enquiry normalizes Persian mobile numbers and requires explicit image sharing',()=>{
 const valid={name:'  حسین   رضایی ',phone:'+۹۸۹۱۲۳۴۵۶۷۸۹',imageConsent:true};
 assert.deepEqual(validate(valid),{name:'حسین رضایی',phone:'09123456789',notes:'',imageConsent:true});
 assert.equal(validate({...valid,phone:'٠٩١٢٣٤٥٦٧٨٩'}).phone,'09123456789');
 assert.throws(()=>validate({...valid,imageConsent:false}),/CONSENT/);
 assert.throws(()=>validate({...valid,phone:'123'}),/PHONE/);
 assert.throws(()=>validate({...valid,name:''}),/NAME/);
 assert.throws(()=>validate({...valid,notes:'a'.repeat(2001)}),/NOTES/);
 assert.throws(()=>validate(null),/INVALID_REQUEST/);
});
