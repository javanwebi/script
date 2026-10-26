import React, {useEffect,useState} from "react";
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
  const [savedGroups,setSavedGroups]=useState<Array<{id:string;title:string;iconKey:string;imageUrl:string|null;categorySlugs:string[];sortOrder:number}>|null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let mounted=true;
    const load=()=>{
      fetch('/api/catalog/navigation-groups',{credentials:'same-origin'})
        .then(response=>response.ok?response.json():null)
        .then(data=>{if(mounted&&data?.success&&Array.isArray(data.groups))setSavedGroups(data.groups);})
        .catch(()=>{/* Keep original four-group layout if the DB is temporarily unavailable. */});
    };
    load();
    const update=()=>{setRevision(previous=>previous+1);load();};
    window.addEventListener('catalog-navigation-groups-updated',update);
    window.addEventListener('atlas-categories-updated',update);
    return ()=>{mounted=false;window.removeEventListener('catalog-navigation-groups-updated',update);window.removeEventListener('atlas-categories-updated',update);};
  },[]);
  // Revision intentionally tracks database-hydrated category changes.
  void revision;
  const iconByKey:Record<string,typeof Layers>={layers:Layers,move:Move,'link-2':Link2,box:Box};
  const visible=CATEGORIES.filter(category=>category.active!==false);
  const assigned=new Set<string>();
  const groups=savedGroups?.length?savedGroups.map((group,index)=>({
    title:group.title,Icon:iconByKey[group.iconKey]||Layers,
    image:group.imageUrl||pillars[index]?.image||A.categories.transmission,
    names:group.categorySlugs.map(slug=>visible.find(category=>category.slug===slug)?.name||'').filter(Boolean),
    labels:group.categorySlugs.map(slug=>{
      const category=visible.find(item=>item.slug===slug);
      if(!category)return '';
      const original=pillars.flatMap(item=>item.names.map((name,index)=>({name,label:item.labels[index]}))).find(item=>item.name===category.name);
      return original?.label||category.name;
    }).filter(Boolean)
  })):pillars;
  const columns=groups.map(group=>({
    ...group,
    categories:group.names.flatMap((name,index)=>{
      const category=visible.find(item=>item.name===name);
      if(!category||assigned.has(category.slug))return [];
      assigned.add(category.slug);
      return [{category,label:group.labels[index]||category.name}];
    })
  }));
  // No active category may disappear simply because it is not yet assigned.
  visible.filter(category=>!assigned.has(category.slug)).forEach((category,index)=>{
    if(columns.length)columns[index%columns.length].categories.push({category,label:category.name});
  });
  return (
    <div
      className={compact ? "reference-catalog-mobile" : "reference-catalog-menu"}
      style={!compact&&columns.length!==4?{gridTemplateColumns:`repeat(${columns.length}, minmax(0,1fr)) 220px`}:undefined}
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
                    {c.children?.some(node => !node.hidden) ? (
                      <details className="reference-belts">
                        <summary>{label}</summary>
                        <Link
                          to={`/category/${resolveCategorySlug(c.slug)}`}
                          onClick={onNavigate}
                        >
                          همه محصولات {c.name} <ArrowUpLeft size={13} />
                        </Link>
                        <CategoryNavigation
                          nodes={c.children || []}
                          categorySlug={c.slug}
                          onNavigate={onNavigate}
                        />
                      </details>
                    ) : (
                      <Link
                        to={`/category/${resolveCategorySlug(c.slug)}`}
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
