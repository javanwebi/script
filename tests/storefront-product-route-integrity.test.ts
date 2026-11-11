import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const categoryPage = read("src/pages/CategoryPage.tsx");
const productCard = read("src/components/product/ProductCard.tsx");
const productsPage = read("src/pages/ProductsPage.tsx");
const header = read("src/components/layout/Header.tsx");
const megaMenu = read("src/components/catalog/ReferenceMegaMenu.tsx");
const mobileExplorer = read("src/components/catalog/MobileCategoryExplorer.tsx");
const footer = read("src/components/layout/Footer.tsx");
const directSku = read("src/components/catalog/DirectSkuProducts.tsx");
const routes = read("src/App.tsx");
const categoryStyles = read("src/category-showcase.css");

test("public product cards preserve public detail URLs for signed-in customers", () => {
  assert.match(productCard, /const href = isCustomerPortalRoute && currentUser/);
  assert.match(productCard, /مشاهده قیمت در پنل مشتری/);
  assert.match(productCard, /memberPath\(currentUser, product\.code\)/);
  assert.match(productCard, /\/product\/\$\{encodeURIComponent\(product\.code\)\}/);
  assert.doesNotMatch(productCard, /const href = hasPricePermission/);
});

test("product cards resolve registered family gallery images and render useful technical specs", () => {
  assert.match(productCard, /product\.galleryImages\?\.find\(image => image\.scope === "family" && image\.url\)/);
  assert.match(productCard, /product\.images\?\.find\(Boolean\)/);
  assert.match(productCard, /image\.scope === "variant" && image\.url/);
  assert.match(productCard, /variantGalleryImage/);
  assert.match(productCard, /product\.variants\?\.find\(variant => variant\.images\?\.some\(Boolean\)\)/);
  assert.match(productCard, /store-product-image-scope-badge/);
  assert.match(productCard, /src=\{productImage\}/);
  assert.match(productCard, /store-product-specs/);
  assert.match(productCard, /className="product-card-image w-full h-full"/);
  assert.match(productCard, /برند ثبت نشده/);
  assert.match(productCard, /ثبت\\s\*نشده/);
});

test("category pages use the selected category name instead of a hard-coded transmission title", () => {
  assert.match(categoryPage, /محصولات \{category\.name\}/);
  assert.match(categoryPage, /مشخصات مرتبط با \{category\.name\}/);
  assert.ok(categoryPage.includes('<Link to="/categories" className="hover:text-[#E06518] transition-colors">'));
  assert.ok(categoryPage.includes('دسته‌بندی‌ها'));
  assert.doesNotMatch(categoryPage, /انتخاب قطعات انتقال نیرو/);
});

test("unknown legacy category routes wait for the database and never fall back to the first unrelated category", () => {
  assert.match(categoryPage, /isDatabaseCatalogHydrated/);
  assert.match(categoryPage, /findCatalogCategory\(slug \|\| ''\)/);
  assert.match(categoryPage, /if \(!category\)/);
  assert.match(categoryPage, /to="\/categories"/);
  assert.match(categoryPage, /to="\/products"/);
  assert.doesNotMatch(categoryPage, /CATEGORIES\[0\]/);
});

test("direct SKU results are placed after the family catalogue and confirmed-stock filtering is honest", () => {
  const familyResults = categoryPage.indexOf("category-showcase-shop");
  const directSkuResults = categoryPage.indexOf("<DirectSkuProducts categorySlug={category.slug}");
  assert.ok(familyResults >= 0 && directSkuResults > familyResults);
  assert.match(categoryPage, /p\.stockKnown === true && p\.stock > 0 && !p\.inquiryOnly/);
  assert.doesNotMatch(categoryPage, /price_asc|price_desc/);
});

test("the all-products page exposes only approved category links and routes them to their assigned-family pages", () => {
  assert.match(productsPage, /category\.active !== false && \/\^excel-v2-\[0-9\]\+-\[0-9\]\+\$\//);
  assert.match(productsPage, /to=\{\`\/category\/\$\{encodeURIComponent\(cat\.slug\)\}\`\}/);
  assert.match(productsPage, /navigate\(\`\/category\/\$\{encodeURIComponent\(categoryParam\)\}/);
  assert.match(productsPage, /to="\/categories" className="catalogue-all-categories-link"/);
});

test("navigation clearly distinguishes the all-products catalogue from the category directory on desktop and mobile", () => {
  assert.match(header, /to="\/products"/);
  assert.match(header, /<span>همه محصولات<\/span>/);
  assert.match(header, /aria-label="باز کردن دسته‌بندی محصولات"/);
  assert.match(megaMenu, /to="\/products"/);
  assert.match(megaMenu, /to="\/categories"/);
  assert.match(mobileExplorer, /to="\/products"/);
  assert.match(mobileExplorer, /to="\/categories"/);
});

test("the all-products route identifies itself clearly in its breadcrumb", () => {
  assert.match(productsPage, /aria-current="page">\s*همه محصولات/);
  assert.match(productsPage, /to="\/categories" className="catalogue-all-categories-link"/);
});

test("the all-products page includes standalone SKUs without mixing them into family records", () => {
  assert.match(productsPage, /import \{ DirectSkuProducts \} from "\.\.\/components\/catalog\/DirectSkuProducts"/);
  assert.match(productsPage, /<DirectSkuProducts[\s\S]*?categorySlug=\{selectedCategory === "all" \|\| selectedCategory === "swr-forza-exclusive" \? "all" : selectedCategory\}/);
  assert.match(productsPage, /searchQuery=\{searchQuery\}/);
  assert.match(productsPage, /selectedBrand=\{selectedBrand\}/);
  assert.match(productsPage, /inStockOnly=\{inStockOnly\}/);
  assert.match(directSku, /categorySlug !== 'all'/);
  assert.match(directSku, /item\.skuCode/);
  assert.match(directSku, /\/direct-product\//);
  assert.match(directSku, /if \(inStockOnly\) return false/);
  assert.match(directSku, /direct-sku-products-grid/);
  assert.match(directSku, /const pageSize = 16/);
  assert.match(directSku, /pageItems\.map/);
  assert.match(directSku, /direct-sku-products-pagination/);
});

test("footer category links are hydrated from the approved database taxonomy", () => {
  assert.match(footer, /getManagedCategories\(\)/);
  assert.match(footer, /subscribeCatalogChanges/);
  assert.match(footer, /excel-v2-\[0-9\]\+-\[0-9\]\+/);
  assert.match(footer, /to=\{\`\/category\/\$\{encodeURIComponent\(category\.slug\)\}\`\}/);
  assert.doesNotMatch(footer, /CATEGORIES\.slice/);
  assert.match(footer, /to="\/categories"/);
});

test("the canonical product route map keeps public family, direct SKU and customer portal details distinct", () => {
  assert.ok(routes.includes('<Route path="/products" element={<ProductsPage />} />'));
  assert.ok(routes.includes('<Route path="/categories" element={<AllCategoriesPage />} />'));
  assert.ok(routes.includes('<Route path="/category/:slug" element={<CategoryPage />} />'));
  assert.ok(routes.includes('path="/product/:code"'));
  assert.ok(routes.includes('path="/direct-product/:code"'));
  assert.ok(routes.includes('path="/account/product/:code"'));
  assert.ok(routes.includes('path="/consumer-dashboard/product/:code"'));
});

test("approved Excel category pages show SKU images as labelled previews and place direct SKUs after family results", () => {
  const excelPage = read("src/pages/ExcelMenuCategoryPage.tsx");
  const cardResolver = excelPage.indexOf("const cardProduct = product;");
  const familyShop = excelPage.indexOf('<div className="excel-category-shop">');
  const directSkuBlock = excelPage.lastIndexOf("<DirectSkuProducts categorySlug={slug}");
  assert.ok(cardResolver >= 0, "approved category cards should pass original product image metadata to ProductCard");
  assert.ok(familyShop >= 0 && directSkuBlock > familyShop, "direct SKUs should appear after the family catalogue");
  assert.equal(excelPage.indexOf("<DirectSkuProducts categorySlug={slug}"), directSkuBlock, "there should be only one direct SKU block");
  assert.match(excelPage, /productPreview/);
  assert.match(excelPage, /featuredPreview\?\.scope === 'variant'/);
  assert.match(excelPage, /excel-category-featured-image-scope/);
});

test("category product cards override the obsolete 440px empty-card sizing", () => {
  assert.match(categoryStyles, /category-showcase \.category-showcase-products > \.store-product-card\s*\{[\s\S]*?min-height: 0 !important/);
  assert.match(categoryStyles, /category-showcase \.category-showcase-products \.store-product-media\s*\{[\s\S]*?aspect-ratio: 1\.48/);
  assert.match(categoryStyles, /category-showcase \.category-showcase-products \.store-product-media > a > \[role="img"\]/);
});
