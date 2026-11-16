import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFamilyMenuAssignment } from '../src/data/catalogMenuSemanticGuard';

const check = (
  categorySlug: string,
  submenuName: string,
  productType: string,
  material: string,
  leafName = '',
  profile = ''
) => validateFamilyMenuAssignment({ categorySlug, submenuName, productType, material, leafName, profile });

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


test('timing-belt families cannot leak V-belts, automotive belts or unlisted timing pitches into the wrong leaf', () => {
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ T10', 'پلی‌یورتان', 'T5 , AT5 , AT10 , AT20', 'T10').valid, false);
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ 3M', 'لاستیک کلروپرن', '5M , 8M , 11M , 14M', '3M').valid, false);
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ خودرویی AUTO-RU', 'لاستیک', '5M , 8M , 11M , 14M', 'AUTO-RU').valid, false);
  assert.equal(check('excel-v2-1-1', 'لاستیکی فابریک', 'تسمه تایمینگ صنعتی 3M', 'لاستیک کلروپرن', 'لاستیکی فابریک ساده و دنده‌دار', '3M').valid, true);
  assert.equal(check('excel-v2-1-1', 'سیم‌دار فابریک', 'تسمه تایمینگ پلی‌یورتان سیم‌دار', 'TPU پلی‌یورتان', 'پلی‌یورتان', '8M').valid, true);
  assert.equal(check('excel-v2-1-1', 'سیم‌دار فابریک', 'تسمه تایمینگ متریک پلی‌یورتان پروفیل T10 (مداربسته)', 'TPU پلی‌یورتان', 'پلی‌یورتان', 'T10').valid, true);
  assert.equal(check('excel-v2-1-1', 'سیم‌دار فابریک', 'تسمه تایمینگ H پلی‌یورتان با کورد فولادی (مداربسته)', 'TPU پلی‌یورتان', 'پلی‌یورتان', 'H').valid, true);
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ دوطرفه D8M', 'لاستیک', '', 'D8M').valid, true);
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ دوطرفه DH', 'لاستیک', '', 'DH').valid, true);
});

test('V-belt families use profile-specific leaves and never enter timing or Poly-V leaves', () => {
  assert.equal(check('excel-v2-1-2', 'وی‌بلت متری', 'تسمه V شکل پروفیل Z', 'لاستیک', 'تسمه A و B و C وی‌بلت متری', 'Z').valid, false);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه V شکل پروفیل Z', 'لاستیک', 'Z (9.5) , M , A , B , C , D , E , 8V', 'Z').valid, true);
  assert.equal(check('excel-v2-1-2', 'وی‌بلت متری', 'تسمه V شکل پروفیل B', 'لاستیک', 'تسمه A و B و C وی‌بلت متری', 'B').valid, true);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه جوشی V روکش گریپ‌دار (پروفیل B)', 'لاستیک کلروپرن', 'Z (9.5) , M , A , B , C , D , E , 8V', 'B').valid, true);
  assert.equal(check('excel-v2-1-1', 'سیم‌دار فابریک', 'تسمه جوشی V روکش گریپ‌دار (پروفیل B)', 'لاستیک کلروپرن', 'APL دار', 'B').valid, false);
  assert.equal(check('excel-v2-1-2', 'وی‌بلت متری', 'تسمه جوشی پلی‌یورتان ترموپلاستیک پروفیل A (صاف)', 'TPU پلی‌یورتان', 'تسمه A و B و C وی‌بلت متری', 'A').valid, false);
  assert.equal(check('excel-v2-1-2', 'وی‌بلت متری', 'تسمه جوشی پلی‌یورتان A', 'TPU پلی‌یورتان', 'تسمه A و B و C وی‌بلت متری', 'A').valid, false);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه جوشی پلی‌یورتان BRB', 'TPU پلی‌یورتان', 'Z (9.5) , M , A , B , C , D , E , 8V', 'BRB').valid, false);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه جوشی پلی‌یورتان ترموپلاستیک پروفیل B (صاف)', 'TPU پلی‌یورتان', 'Z (9.5) , M , A , B , C , D , E , 8V', 'B').valid, false);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه چندشیاری Poly-V پروفیل PJ', 'لاستیک', 'SPA , SPB , SPC و دندانه‌دار', 'PJ').valid, false);
  assert.equal(check('excel-v2-1-2', 'وی‌بلت متری', 'تسمه V شکل پروفیل AA', 'لاستیک', 'تسمه A و B و C وی‌بلت متری', 'AA').valid, false);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه جوشی V روکش گریپ‌دار پروفیل B', 'لاستیک کلروپرن با روکش بافت پارچه‌ای', 'Z (9.5) , M , A , B , C , D , E , 8V', 'B').valid, true);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه جوشی V روکش گریپ‌دار پروفیل XPC', 'لاستیک کلروپرن با روکش بافت پارچه‌ای', 'SPA , SPB , SPC و دندانه‌دار', 'XPC').valid, true);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه جوشی V روکش گریپ‌دار پروفیل B', 'TPU پلی‌یورتان', 'Z (9.5) , M , A , B , C , D , E , 8V', 'B').valid, false);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه گریپ‌دار XPC6000', 'لاستیک کلروپرن با روکش بافت پارچه‌ای', 'SPA , SPB , SPC و دندانه‌دار', 'XPC').valid, true);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه V گوه‌ای باریک دنده‌دار لبه‌خام پروفیل XPZ', 'لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)', 'SPA , SPB , SPC و دندانه‌دار', 'XPZ').valid, true);
});

test('double-sided and non-listed profiles remain at their valid timing or V-belt parent submenu', () => {
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ دوطرفه DH', 'لاستیک', 'H , XH , L , XL', 'DH').valid, false);
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ دوطرفه DH', 'لاستیک', '', 'DH').valid, true);
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ دوطرفه D8M', 'TPU', '5M , 8M , 11M , 14M', 'D8M').valid, false);
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ دوطرفه D8M', 'TPU', '', 'D8M').valid, true);
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ T10', 'TPU', '', 'T10').valid, true);
  assert.equal(check('excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'تسمه تایمینگ 3M لاستیکی', 'Neoprene', '', '3M').valid, false);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه V شکل پروفیل 5V', 'لاستیک', 'SPA , SPB , SPC و دندانه‌دار', '5V').valid, false);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه V شکل پروفیل 5V', 'لاستیک', '', '5V').valid, true);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه V گوه‌ای آمریکایی پروفیل 8V', 'لاستیک با روکش پارچه‌ای', '', '8V').valid, true);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه V گوه‌ای آمریکایی دنده‌ای لبه‌خام پروفیل 8VX', 'لاستیک دنده‌ای لبه‌خام', '', '8VX').valid, true);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه V گوه‌ای آمریکایی پروفیل 8V', 'لاستیک', 'SPA , SPB , SPC و دندانه‌دار', '8V').valid, false);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه V شکل به‌پشت‌پیوسته (Banded V-Belt) سری 3VX', 'لاستیک کلروپرن', 'SPA , SPB , SPC و دندانه‌دار', '3VX-BANDED').valid, false);
  assert.equal(check('excel-v2-1-2', 'تسمه اسپشیال', 'تسمه V شکل به‌پشت‌پیوسته (Banded V-Belt) سری 3VX', 'لاستیک کلروپرن', '', '3VX-BANDED').valid, true);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه V شکل پروفیل MX', 'لاستیک', 'Z (9.5) , M , A , B , C , D , E , 8V', 'MX').valid, false);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه V شکل پروفیل ZX', 'لاستیک', 'Z (9.5) , M , A , B , C , D , E , 8V', 'ZX').valid, true);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه V شکل پروفیل ZX', 'لاستیک', '', 'ZX').valid, true);
  assert.equal(check('excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه V شکل پروفیل MX', 'لاستیک', '', 'MX').valid, true);
});

test('welded PU, ridge-top conveyor and welding equipment are three distinct identities', () => {
  assert.equal(check('excel-v2-1-3', 'تسمه گرد (CRC)', 'تسمه جوشی پلی‌یورتان CRC', 'TPU پلی‌یورتان', 'انواع تسمه گرد جوشی', 'CRC').valid, true);
  assert.equal(check('excel-v2-1-3', 'تسمه فلت', 'تسمه جوشی پلی‌یورتان پروفیل B', 'TPU پلی‌یورتان', 'انواع تسمه تخت و فلت', 'B').valid, false);
  assert.equal(check('excel-v2-1-3', 'تسمه گرد (CRC)', 'تسمه ذوزنقه‌ای تاج‌دار CRC', 'لاستیک کلروپرن', 'انواع تسمه گرد جوشی').valid, false);
  assert.equal(check('excel-v2-1-4', 'تسمه بارکش', 'تسمه ذوزنقه‌ای تاج‌دار CRC', 'لاستیک کلروپرن', 'انواع تسمه بارکش صنعتی').valid, true);
  assert.equal(check('excel-v2-1-4', 'دستگاه‌های تسمه جوشی', 'دستگاه جوش تسمه صنعتی', 'فولاد', 'دستگاه جوش تسمه صنعتی').valid, true);
  assert.equal(check('excel-v2-1-4', 'دستگاه‌های تسمه جوشی', 'دستگاه پولیش APL', 'فولاد').valid, false);
  assert.equal(check('excel-v2-1-4', 'دستگاه‌های تسمه جوشی', 'دستگاه تزریق APL', 'فولاد').valid, false);
  assert.equal(check('excel-v2-1-4', 'دستگاه‌های تسمه جوشی', 'تسمه سفت‌کن صنعتی', 'فولاد').valid, false);
  assert.equal(check('excel-v2-1-4', 'دستگاه‌های تسمه جوشی', 'دستگاه جوش تسمه صنعتی', 'فولاد').valid, true);
  assert.equal(check('excel-v2-1-4', 'دستگاه‌های تسمه جوشی', 'دستگاه پولیش APL', 'فولاد', 'دستگاه جوش تسمه صنعتی').valid, false);
});
