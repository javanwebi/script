import test from 'node:test';
import assert from 'node:assert/strict';
import {isForzaProbableEcho} from '../src/utils/forzaBargeIn';

test('does not interrupt for spoken speaker echo',()=>{
  assert.equal(isForzaProbableEcho('برای انتخاب تسمه باید توان موتور',
    'برای انتخاب تسمه باید توان موتور و قطر پولی را بدانم'),true);
});
test('explicit user corrections override an echo candidate',()=>{
  assert.equal(isForzaProbableEcho('نه، برای دستگاه بسته بندی میخوام',
    'برای انتخاب تسمه باید توان موتور را بدانم'),false);
  assert.equal(isForzaProbableEcho('صبر کن','صبر کن تا بررسی کنم'),false);
  assert.equal(isForzaProbableEcho('ادامه بده','بعداً ادامه بده'),false);
});
test('novel technical code remains a new user turn',()=>{
  assert.equal(isForzaProbableEcho('نه ۶۲۰۲ منظورم ۶۲۰۳ هست',
    'یاتاقان ۶۲۰۲ موجود است'),false);
  assert.equal(isForzaProbableEcho('SPA 1250','تسمه HTD 8M'),false);
});
