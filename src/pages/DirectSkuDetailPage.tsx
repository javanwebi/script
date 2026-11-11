import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Image as ImageIcon, MessageCircle, PhoneCall, Ruler } from 'lucide-react';
import { ProductImage } from '../components/product/ProductImage';
import { useDirectSkuState } from '../components/catalog/DirectSkuProducts';
import NotFoundPage from './NotFoundPage';
import '../catalog-experience.css';

export default function DirectSkuDetailPage() {
  const { code } = useParams<{ code: string }>();
  const { items, loading, error } = useDirectSkuState();
  const item = items.find(row => row.skuCode === code);

  if (loading) {
    return (
      <div dir="rtl" className="product-detail-page direct-sku-detail-page">
        <div className="direct-sku-state">
          <span className="direct-sku-state__eyebrow">کاتالوگ صنعت پیش</span>
          <h1>در حال دریافت اطلاعات کد کالا</h1>
          <p>اطلاعات کدهای مستقل مستقیماً از کاتالوگ صنعت پیش دریافت می‌شود.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div dir="rtl" className="product-detail-page direct-sku-detail-page">
        <div className="direct-sku-state">
          <span className="direct-sku-state__eyebrow">اتصال کاتالوگ</span>
          <h1>دریافت اطلاعات کد کالا ممکن نشد</h1>
          <p>اتصال به سرویس کاتالوگ برقرار نشد. دوباره تلاش کنید یا از فهرست محصولات ادامه دهید.</p>
          <button type="button" onClick={() => window.location.reload()}>تلاش دوباره</button>
          <Link to="/products">بازگشت به کاتالوگ</Link>
        </div>
      </div>
    );
  }

  if (!item) return <NotFoundPage />;

  const productHref = '/category/' + encodeURIComponent(item.categorySlug) + '?sub=' + encodeURIComponent(item.submenu);
  const consultHref = '/ai-consult?' + new URLSearchParams({
    productCode: item.skuCode,
    productName: item.name,
    q: 'برای قطعه ' + item.name + ' با کد ' + item.skuCode + ' مشاوره فنی و راهنمایی انتخاب می‌خواهم.',
  }).toString();

  return (
    <div dir="rtl" className="product-detail-page direct-sku-detail-page space-y-6">
      <nav aria-label="مسیر صفحه" className="product-detail-breadcrumb">
        <Link to="/">صفحه اصلی</Link>
        <span aria-hidden="true">/</span>
        <Link to="/categories">دسته‌بندی‌ها</Link>
        <span aria-hidden="true">/</span>
        <Link to={productHref}>{item.categoryName}</Link>
        <span aria-hidden="true">/</span>
        <span>{item.name}</span>
      </nav>

      <div className="product-detail-main">
        <div className="product-detail-layout">
          <div className="product-detail-gallery">
            <div className="product-detail-image direct-sku-detail-image">
              {item.imageUrl
                ? <ProductImage src={item.imageUrl} alt={item.name} className="absolute inset-0 h-full w-full object-contain p-8 sm:p-12" />
                : <ImageIcon size={64} className="text-slate-300" />}
              <span className="direct-sku-image-label">تصویر ثبت‌شده برای کد کالا</span>
            </div>
          </div>

          <div className="product-detail-info">
            <div className="product-detail-meta">
              <span>کالای مستقیم بدون خانواده</span>
              <code dir="ltr">{item.skuCode}</code>
            </div>
            <div className="space-y-2">
              <span className="direct-sku-kicker">{item.categoryName} / {item.submenu}</span>
              <h1>{item.name}</h1>
              {item.subcategory && <p>{item.subcategory}</p>}
            </div>

            <div className="direct-sku-facts">
              <div><span>کد فنی</span><strong dir="ltr">{item.skuCode}</strong></div>
              <div><span>برند</span><strong>{item.brand || 'در کاتالوگ ثبت نشده'}</strong></div>
              <div><span>نوع ثبت</span><strong>کد کالای مستقل</strong></div>
            </div>

            <div className="direct-sku-inquiry-note">
              <strong>استعلام قیمت و موجودی</strong>
              <p>قیمت این کد در این صفحه نمایش داده نمی‌شود. برای دریافت قیمت روز و وضعیت تأمین، درخواست خود را از مسیر رسمی صنعت پیش ثبت کنید.</p>
            </div>

            {!!item.technicalSpecs?.length && (
              <section className="product-detail-specs direct-sku-specs">
                <section className="product-spec-card selected">
                  <h2>مشخصات فنی ثبت‌شده</h2>
                  <dl>
                    {item.technicalSpecs.map((spec, index) => (
                      <div key={index}><dt>{spec.key}</dt><dd>{spec.value}</dd></div>
                    ))}
                  </dl>
                </section>
              </section>
            )}

            <div className="direct-sku-actions">
              <Link to={consultHref}><MessageCircle size={17} /> مشاوره فنی با FORZA</Link>
              <Link to="/contact"><PhoneCall size={17} /> تماس و استعلام</Link>
              <Link to={productHref}><Ruler size={17} /> مشاهده دسته‌بندی</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
