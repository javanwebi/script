import type { Product } from '../types';

/** Reviewed corrections against the owner's 107-page catalog and original SKU names.
 * Keys are existing family identifiers. No SKU, original SKU name or size is edited.
 */
const corrections:Record<string,{name?:string;categoryName:string;submenu:string;subcategory:string;pages:string}>={
  'FAM-40997':{name:'پولی پلی‌آمیدی اورینگ‌خور',categoryName:'پولی و انتقال نیرو',submenu:'پولی',subcategory:'پولی صنعتی',pages:'۳۵–۳۸'},
  'FAM-33365':{categoryName:'چرخ و رولر',submenu:'چرخ صنعتی',subcategory:'چرخ هرزگرد',pages:'۳۵–۳۸ و ۵۶–۵۸'},
  'FAM-32711':{categoryName:'قطعات مکانیکی',submenu:'پایه و براکت',subcategory:'تسمه‌سفت‌کن',pages:'۴۲–۴۶'},
  'FAM-34318':{name:'قطعات پمپ دیافراگم',categoryName:'قطعات پمپ و سیالات',submenu:'قطعات پمپ',subcategory:'قطعات پمپ دیافراگم',pages:'۶۷ و شرح اصلی ۲۸ کد'},
  'FAM-90147':{name:'پین سر رولر',categoryName:'چرخ و رولر',submenu:'پین سر رولر',subcategory:'پین سر رولر',pages:'۱۰۵–۱۰۶'},
  'FAM-37618':{name:'پین سر رولر',categoryName:'چرخ و رولر',submenu:'پین سر رولر',subcategory:'پین سر رولر',pages:'۱۰۵–۱۰۶'},
  'FAM-90296':{name:'پین سر رولر',categoryName:'چرخ و رولر',submenu:'پین سر رولر',subcategory:'پین سر رولر',pages:'۱۰۵–۱۰۶'},
  'FAM-40709':{categoryName:'چرخ و رولر',submenu:'پین سر رولر',subcategory:'پین سر رولر',pages:'۱۰۵–۱۰۶'},
};
export function applyCatalogueCorrections(product:Product):Product {
  const correction=corrections[product.code];
  if(!correction)return product;
  const {pages,...fields}=correction;
  return {...product,...fields,categorySlug:fields.categoryName.replace(/[\s\u200c]+/g,'-'),
    tags:[...new Set([...product.tags,fields.submenu,fields.subcategory])],
    technicalSpecs:[...product.technicalSpecs.filter(s=>s.key!=='نوع فنی'),{key:'نوع فنی',value:fields.subcategory},{key:'مرجع اصلاح خانواده',value:`کاتالوگ ارسالی اطلس، صفحات PDF ${pages}`}],
    description:correction.name?product.description?.replace(product.name,correction.name):product.description,
  };
}
