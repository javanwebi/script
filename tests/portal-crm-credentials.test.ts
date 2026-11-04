import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultCredentialSmsTemplate,renderCrmCredentialSms} from '../server/db/adminCustomerCredentialsApi';

test('CRM message templates interpolate only approved variables',()=>{
 const value=renderCrmCredentialSms(defaultCredentialSmsTemplate,{
  username:'factorybuyer1',password:'TemporaryPass!234',smsName:'شرکت نمونه'
 });
 assert.match(value,/factorybuyer1/);
 assert.match(value,/TemporaryPass!234/);
 assert.match(value,/https:\/\/www\.sanatpish\.com\/login/);
 assert.match(value,/شرکت نمونه/);
 assert.doesNotMatch(value,/\{password\}/);
});

test('Credential SMS cannot omit required credentials or use unknown placeholders',()=>{
 for(const text of ['متن بدون نام کاربری و رمز', 'نام {username} و رمز {password} و متغیر {secret}']) {
  assert.throws(()=>renderCrmCredentialSms(text,{username:'buyer',password:'private-test',smsName:'مشتری'}));
 }
});

test('CRM SMS template rendering never evaluates code and preserves the provided text',()=>{
 const input='سلام {smsName}\nنام کاربری {username}\nرمز {password}\n{loginUrl}';
 const result=renderCrmCredentialSms(input,{username:'buyer004',password:'initial-secret',smsName:'مشتری'});
 assert.equal(result,'سلام مشتری\nنام کاربری buyer004\nرمز initial-secret\nhttps://www.sanatpish.com/login');
});
