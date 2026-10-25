import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpLeft, Layers, Move, Link2, Box } from "lucide-react";
import { CATEGORIES, resolveCategorySlug } from "../../data/categories";
import { STORE_ASSETS as A } from "../../assets/images";
import { CategoryNavigation } from "./CategoryNavigation";
const pillars = [
  {
    title: "انتقال قدرت و مکانیکی",
    Icon: Layers,
    image: A.categories.pulleys,
    names: [
      "تسمه و انتقال نیرو",
      "پولی و انتقال نیرو",
      "زنجیر و چرخ‌زنجیر",
      "قطعات مکانیکی",
      "انتقال قدرت مکانیکی",
    ],
    labels: [
      "تسمه‌های انتقال نیرو",
      "پولی‌های صنعتی",
      "زنجیر صنعتی",
      "قطعات مکانیکی",
      "انتقال قدرت مکانیکی",
    ],
  },
  {
    title: "تجهیزات حرکت و هدایت",
    Icon: Move,
    image: A.categories.transmission,
    names: ["ریل و تجهیزات هدایت", "چرخ و رولر"],
    labels: ["ریل‌های راهنما", "چرخ و رولر صنعتی"],
  },
  {
    title: "شیلنگ، لاستیک و آب‌بندی",
    Icon: Link2,
    image: A.products.ceramicParts,
    names: [
      "شیلنگ و اتصالات",
      "آب‌بندی و قطعات لاستیکی",
      "آب‌بندی و درزگیری",
      "تجهیزات وکیوم",
    ],
    labels: [
      "شیلنگ‌های صنعتی",
      "قطعات لاستیکی",
      "آب‌بندی و درزگیری",
      "وکیوم و مکنده",
    ],
  },
  {
    title: "پروفیل و قطعات مهندسی",
    Icon: Box,
    image: A.categories.ceramic,
    names: [
      "پروفیل و سازه آلومینیوم",
      "مواد و ورق صنعتی",
      "اتصالات و نگهدارنده",
      "برس و ابزار پرداخت",
    ],
    labels: [
      "پروفیل آلومینیوم",
      "قطعات و مواد مهندسی",
      "اتصالات و نگهدارنده",
      "برس و ابزار پرداخت",
    ],
  },
];
export function ReferenceMegaMenu({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const columns = pillars.map((g) => ({
    ...g,
    categories: g.names
      .map((name, i) => ({
        category:
          CATEGORIES.find((c) => c.name === name) ||
          (name === "پروفیل و سازه آلومینیوم" ? { name, slug: "", children: [] } : undefined),
        label: g.labels[i],
      }))
      .filter((x) => !!x.category),
  }));
  return (
    <div
      className={
        compact ? "reference-catalog-mobile" : "reference-catalog-menu"
      }
    >
      {columns.map(({ title, Icon, image, categories }) => (
        <section key={title}>
          <h3>
            <Icon size={17} />
            {title}
          </h3>
          {!compact && (
            <img className="reference-category-art" src={image} alt="" />
          )}
          <div className="reference-category-links">
            {categories.map(
              ({ category: c, label }) =>
                c && (
                  <div key={c.slug}>
                    {c.name === "تسمه و انتقال نیرو" ? (
                      <details className="reference-belts">
                        <summary>{label}</summary>
                        <Link
                          to={`/category/${c.name === "تسمه و انتقال نیرو" ? "تسمه-و-انتقال-نیرو" : resolveCategorySlug(c.slug)}`}
                          onClick={onNavigate}
                        >
                          همه تسمه‌های انتقال نیرو <ArrowUpLeft size={13} />
                        </Link>
                        <CategoryNavigation
                          nodes={c.children}
                          categorySlug={c.slug}
                          onNavigate={onNavigate}
                        />
                      </details>
                    ) : (
                      <Link
                        to={
                          c.slug
                            ? `/products?category=${c.slug}`
                            : `/products?q=${encodeURIComponent("پروفیل آلومینیوم")}`
                        }
                        onClick={onNavigate}
                      >
                        {label}
                        <ArrowUpLeft size={12} />
                      </Link>
                    )}
                  </div>
                ),
            )}
          </div>
          <Link
            className="reference-view-all"
            to="/categories"
            onClick={onNavigate}
          >
            مشاهده همه <ArrowLeft size={14} />
          </Link>
        </section>
      ))}
      {!compact && (
        <aside className="reference-menu-promo">
          <img src={A.categories.transmission} alt="تجهیزات انتقال قدرت" />
          <span>از کد دقیق تا انتخاب قطعه</span>
          <strong>
            قطعات صنعتی،
            <br />
            در یک مسیر روشن.
          </strong>
          <Link to="/products" onClick={onNavigate}>
            مشاهده محصولات <ArrowLeft size={15} />
          </Link>
        </aside>
      )}
    </div>
  );
}
