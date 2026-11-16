import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFamilyMenuAssignment } from '../src/data/catalogMenuSemanticGuard';

const check = (
  categorySlug: string,
  submenuName: string,
  productType: string,
  material: string,
  leafName = ''
) => validateFamilyMenuAssignment({ categorySlug, submenuName, productType, material, leafName });

test('shaft couplings cannot be published inside the industrial wheels menu', () => {
  assert.deepEqual(
    check('excel-v2-9-4', 'انواع چرخ', 'کوپلینگ انتقال قدرت', 'فولاد صنعتی'),
    { valid: false, reason: 'wheel_category_contains_shaft_coupling' }
  );
  assert.equal(check('excel-v2-9-4', 'انواع چرخ', 'چرخ زنجیر صنعتی', 'فولاد').valid, true);
});

test('teflon guide leaf requires both a guide identity and a PTFE material', () => {
  assert.equal(check('excel-v2-6-2', 'گاید تفلونی', 'گاید راهنمای فنری', 'فولاد صنعتی').valid, false);
  assert.equal(check('excel-v2-6-2', 'گاید تفلونی', 'گاید جانبی خط انتقال', 'تفلون PTFE').valid, true);
  assert.equal(check('excel-v2-6-2', 'گاید تفلونی', 'پروفیل چهارپهلو توخالی', 'فولاد').valid, false);
});

test('stainless rail leaf rejects carbon-steel mounting clamps', () => {
  assert.equal(check('excel-v2-6-2', 'نرده استیل', 'بست و گیره نگهدارنده گاید', 'فولاد کربنی').valid, false);
  assert.equal(check('excel-v2-6-2', 'نرده استیل', 'ریل راهنمای خط انتقال', 'استیل ضدزنگ').valid, true);
});

test('rubber category rejects steel, PVC and PTFE hoses or sheets but accepts elastomer parts', () => {
  assert.equal(check('excel-v2-7-1', 'انواع قطعات لاستیکی', 'شیلنگ صنعتی', 'فولاد صنعتی').valid, false);
  assert.equal(check('excel-v2-7-1', 'انواع قطعات لاستیکی', 'شیلنگ صنعتی', 'PVC').valid, false);
  assert.equal(check('excel-v2-7-1', 'انواع قطعات لاستیکی', 'ورق صنعتی', 'PTFE').valid, false);
  assert.equal(check('excel-v2-7-1', 'انواع قطعات لاستیکی', 'شیلنگ صنعتی', 'سیلیکون الاستومر').valid, true);
  assert.equal(check('excel-v2-7-1', 'انواع قطعات لاستیکی', 'دیافراگم لاستیکی', 'NBR').valid, true);
});

test('handle and handwheel menu rejects brackets, stocker parts and general fasteners', () => {
  assert.equal(check('excel-v2-9-3', 'دستگیره و پیچ فلکه', 'پایه و براکت صنعتی', 'فولاد').valid, false);
  assert.equal(check('excel-v2-9-3', 'دستگیره و پیچ فلکه', 'قطعات مکانیکی استاکر', 'فولاد').valid, false);
  assert.equal(check('excel-v2-9-3', 'دستگیره و پیچ فلکه', 'پیچ صنعتی', 'فولاد').valid, false);
  assert.equal(check('excel-v2-9-3', 'دستگیره و پیچ فلکه', 'پیچ فلکه دستی', 'فولاد').valid, true);
});

test('spatula menu does not absorb unrelated printing-machine parts', () => {
  assert.equal(check('excel-v2-10-1', 'اسپاتول سیلیکونی', 'تیغه کارول', 'فولاد').valid, false);
  assert.equal(check('excel-v2-10-1', 'اسپاتول سیلیکونی', 'قطعات دستگاه چاپ', 'فولاد').valid, false);
  assert.equal(check('excel-v2-10-1', 'اسپاتول سیلیکونی', 'نوار اسپاتول پلی‌یورتان', 'PU').valid, true);
});

test('iron and stainless material leaves for rail guides are not interchangeable', () => {
  assert.equal(check('excel-v2-6-1', 'بر اساس جنس', 'ریل راهنمای خط انتقال', 'فولاد کربنی', 'ریل راهنما استیل و متعلقات').valid, false);
  assert.equal(check('excel-v2-6-1', 'بر اساس جنس', 'ریل راهنمای خط انتقال', 'فولاد کربنی', 'ریل راهنما آهنی و متعلقات').valid, true);
});

test('family paths must exist in the approved Excel menu and leaf', () => {
  assert.equal(check('excel-v2-2-1', 'بر اساس جنس', 'نوار نقاله PVC', 'PVC', 'نوار نقاله PVC').valid, true);
  assert.equal(check('excel-v2-2-1', 'بر اساس جنس', 'نوار نقاله PVC', 'PVC', 'نوار نقاله پلی‌اورتان (PU)').valid, true);
  assert.equal(check('excel-v2-2-1', 'بر اساس جنس', 'نوار نقاله PVC', 'PVC', 'نوار نقاله مدولار').valid, false);
  assert.equal(check('excel-v2-10-3', 'قطعات دستگاه استاکر', 'قطعات استاکر', 'فولاد', 'لوازم و قطعات مصرفی استاکر').valid, false);
});

test('mixed family identity is quarantined rather than accepted by a valid path', () => {
  const result = validateFamilyMenuAssignment({
    categorySlug: 'excel-v2-2-1',
    submenuName: 'بر اساس جنس',
    leafName: 'نوار نقاله PVC',
    productType: 'MIXED',
    material: 'PVC',
    profile: 'PVC_STONE_SURFACE',
  });
  assert.deepEqual(result, { valid: false, reason: 'family_contains_mixed_technical_identity' });
});
