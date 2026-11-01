import type { EnhancedCategory } from './categories';

/** Read-only last-known-good names from the user's four-level menu. */
export type ApprovedMenuGroup = { id:string; title:string; iconKey:string; imageUrl:string|null; categorySlugs:string[]; sortOrder:number; active?:boolean };
export const APPROVED_MENU_GROUPS: ApprovedMenuGroup[] = [
  {
    "id": "excel-v2-1",
    "title": "انواع تسمه‌های صنعتی",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-1-1",
      "excel-v2-1-2",
      "excel-v2-1-3",
      "excel-v2-1-4"
    ],
    "sortOrder": 0,
    "active": true
  },
  {
    "id": "excel-v2-2",
    "title": "نوارهای نقاله و انتقال مواد",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-2-1",
      "excel-v2-2-2"
    ],
    "sortOrder": 1,
    "active": true
  },
  {
    "id": "excel-v2-3",
    "title": "رولر و متعلقات رولر",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-3-1",
      "excel-v2-3-2",
      "excel-v2-3-3"
    ],
    "sortOrder": 2,
    "active": true
  },
  {
    "id": "excel-v2-4",
    "title": "پولی و تجهیزات انتقال قدرت",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-4-1"
    ],
    "sortOrder": 3,
    "active": true
  },
  {
    "id": "excel-v2-5",
    "title": "برس‌های صنعتی",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-5-1",
      "excel-v2-5-2"
    ],
    "sortOrder": 4,
    "active": true
  },
  {
    "id": "excel-v2-6",
    "title": "ریل، گاید و تجهیزات هدایت خطوط انتقال",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-6-1",
      "excel-v2-6-2",
      "excel-v2-6-3",
      "excel-v2-6-4"
    ],
    "sortOrder": 5,
    "active": true
  },
  {
    "id": "excel-v2-7",
    "title": "قطعات پلیمری و لاستیکی",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-7-1",
      "excel-v2-7-2",
      "excel-v2-7-3"
    ],
    "sortOrder": 6,
    "active": true
  },
  {
    "id": "excel-v2-8",
    "title": "تجهیزات نسوز و حرارتی",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-8-1",
      "excel-v2-8-2"
    ],
    "sortOrder": 7,
    "active": true
  },
  {
    "id": "excel-v2-9",
    "title": "زنجیر و قطعات مکانیکی انتقال حرکت",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-9-1",
      "excel-v2-9-2",
      "excel-v2-9-3",
      "excel-v2-9-4"
    ],
    "sortOrder": 8,
    "active": true
  },
  {
    "id": "excel-v2-10",
    "title": "قطعات خطوط لعاب و چاپ",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-10-1",
      "excel-v2-10-2"
    ],
    "sortOrder": 9,
    "active": true
  },
  {
    "id": "excel-v2-11",
    "title": "انواع توری مش",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-11-1"
    ],
    "sortOrder": 10,
    "active": true
  },
  {
    "id": "excel-v2-12",
    "title": "قطعات سفارشی مطابق با نقشه فنی شما",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-12-1"
    ],
    "sortOrder": 11,
    "active": true
  },
  {
    "id": "excel-v2-13",
    "title": "انواع بلبرینگ",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-13-1",
      "excel-v2-13-2"
    ],
    "sortOrder": 12,
    "active": true
  },
  {
    "id": "excel-v2-14",
    "title": "ابر و اسفنج و اسکاج صنعتی",
    "iconKey": "layers",
    "imageUrl": null,
    "categorySlugs": [
      "excel-v2-14-1",
      "excel-v2-14-2",
      "excel-v2-14-3"
    ],
    "sortOrder": 13,
    "active": true
  }
];
export const APPROVED_MENU_CATEGORIES: EnhancedCategory[] = [
  {
    "slug": "excel-v2-1-1",
    "name": "تسمه تایمینگ",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 101,
    "children": [
      {
        "name": "سیم‌دار فابریک",
        "children": [
          {
            "name": "پلی‌یورتان"
          },
          {
            "name": "کامیون دار (کلید دار)"
          },
          {
            "name": "APL دار"
          }
        ]
      },
      {
        "name": "لاستیکی فابریک",
        "children": [
          {
            "name": "لاستیکی فابریک ساده و دنده‌دار"
          }
        ]
      },
      {
        "name": "انواع گام و کدهای تایمینگ",
        "children": [
          {
            "name": "T5 , AT5 , AT10 , AT20"
          },
          {
            "name": "H , XH , L , XL"
          },
          {
            "name": "5M , 8M , 11M , 14M"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 284,
    "skuCount": 1285,
    "id": "excel-v2-1-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "سیم‌دار فابریک",
      "لاستیکی فابریک",
      "انواع گام و کدهای تایمینگ"
    ],
    "count": 284,
    "routeSlug": "excel-v2-1-1"
  },
  {
    "slug": "excel-v2-1-2",
    "name": "تسمه وی‌بلت (V-Belt)",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 102,
    "children": [
      {
        "name": "کلاسیک و دنده‌دار",
        "children": [
          {
            "name": "Z (9.5) , M , A , B , C , D , E , 8V"
          }
        ]
      },
      {
        "name": "تسمه اسپشیال",
        "children": [
          {
            "name": "SPA , SPB , SPC و دندانه‌دار"
          }
        ]
      },
      {
        "name": "وی‌بلت متری",
        "children": [
          {
            "name": "تسمه A و B و C وی‌بلت متری"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 174,
    "skuCount": 4554,
    "id": "excel-v2-1-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "کلاسیک و دنده‌دار",
      "تسمه اسپشیال",
      "وی‌بلت متری"
    ],
    "count": 174,
    "routeSlug": "excel-v2-1-2"
  },
  {
    "slug": "excel-v2-1-3",
    "name": "تسمه جوشی با سایت",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 103,
    "children": [
      {
        "name": "تسمه گرد (CRC)",
        "children": [
          {
            "name": "انواع تسمه گرد جوشی"
          }
        ]
      },
      {
        "name": "تسمه فلت",
        "children": [
          {
            "name": "انواع تسمه تخت و فلت"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 23,
    "skuCount": 23,
    "id": "excel-v2-1-3",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "تسمه گرد (CRC)",
      "تسمه فلت"
    ],
    "count": 23,
    "routeSlug": "excel-v2-1-3"
  },
  {
    "slug": "excel-v2-1-4",
    "name": "تسمه بارکش و تجهیزات جوشی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 104,
    "children": [
      {
        "name": "تسمه بارکش",
        "children": [
          {
            "name": "انواع تسمه بارکش صنعتی"
          }
        ]
      },
      {
        "name": "دستگاه‌های تسمه جوشی",
        "children": [
          {
            "name": "دستگاه جوش تسمه صنعتی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-1-4",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "تسمه بارکش",
      "دستگاه‌های تسمه جوشی"
    ],
    "count": 0,
    "routeSlug": "excel-v2-1-4"
  },
  {
    "slug": "excel-v2-2-1",
    "name": "نوار نقاله صنعتی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 201,
    "children": [
      {
        "name": "بر اساس جنس",
        "children": [
          {
            "name": "نوار نقاله PVC"
          },
          {
            "name": "نوار نقاله پلی‌اورتان (PU)"
          }
        ]
      },
      {
        "name": "بر اساس کاربرد و ابعاد",
        "children": [
          {
            "name": "مخصوص دستگاه بسته‌بندی (در ضخامت و ابعاد مختلف)"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 2,
    "skuCount": 187,
    "id": "excel-v2-2-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "بر اساس جنس",
      "بر اساس کاربرد و ابعاد"
    ],
    "count": 2,
    "routeSlug": "excel-v2-2-1"
  },
  {
    "slug": "excel-v2-2-2",
    "name": "خدمات نوار نقاله",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 202,
    "children": [
      {
        "name": "بازدید و نصب",
        "children": [
          {
            "name": "بازدید و نصب کامل در محل"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-2-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "بازدید و نصب"
    ],
    "count": 0,
    "routeSlug": "excel-v2-2-2"
  },
  {
    "slug": "excel-v2-3-1",
    "name": "روکش رولر و غلتک",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 301,
    "children": [
      {
        "name": "روکش غلتک",
        "children": [
          {
            "name": "در سختی‌های مختلف - پرینت"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 17,
    "skuCount": 90,
    "id": "excel-v2-3-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "روکش غلتک"
    ],
    "count": 17,
    "routeSlug": "excel-v2-3-1"
  },
  {
    "slug": "excel-v2-3-2",
    "name": "قطعات رولر",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 302,
    "children": [
      {
        "name": "بوش بغل رولر",
        "children": [
          {
            "name": "بوش بغل رولر فلزی"
          },
          {
            "name": "بوش بغل رولر پلاستیک"
          }
        ]
      },
      {
        "name": "بوش دنده رولر",
        "children": [
          {
            "name": "انواع بوش دنده رولر"
          }
        ]
      },
      {
        "name": "فنر سر رول",
        "children": [
          {
            "name": "انواع فنر سر رول"
          }
        ]
      },
      {
        "name": "پین سر رولر و زنجیر",
        "children": [
          {
            "name": "انواع پین سر رولر و زنجیر"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 30,
    "skuCount": 94,
    "id": "excel-v2-3-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "بوش بغل رولر",
      "بوش دنده رولر",
      "فنر سر رول",
      "پین سر رولر و زنجیر"
    ],
    "count": 30,
    "routeSlug": "excel-v2-3-2"
  },
  {
    "slug": "excel-v2-3-3",
    "name": "متعلقات نگهدارنده",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 303,
    "children": [
      {
        "name": "خار نگهدارنده",
        "children": [
          {
            "name": "انواع خار نگهدارنده رولر و شفت"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 10,
    "skuCount": 45,
    "id": "excel-v2-3-3",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "خار نگهدارنده"
    ],
    "count": 10,
    "routeSlug": "excel-v2-3-3"
  },
  {
    "slug": "excel-v2-4-1",
    "name": "انواع پولی تایمینگ",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 401,
    "children": [
      {
        "name": "پولی پلی‌اورتان",
        "children": [
          {
            "name": "در سایزها و گام‌های مختلف"
          }
        ]
      },
      {
        "name": "پولی پلاستیک",
        "children": [
          {
            "name": "در سایزها و گام‌های مختلف"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 1,
    "skuCount": 1,
    "id": "excel-v2-4-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "پولی پلی‌اورتان",
      "پولی پلاستیک"
    ],
    "count": 1,
    "routeSlug": "excel-v2-4-1"
  },
  {
    "slug": "excel-v2-5-1",
    "name": "برس سیمی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 501,
    "children": [
      {
        "name": "انواع برس‌های سیمی",
        "children": [
          {
            "name": "در ابعاد مختلف"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-5-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع برس‌های سیمی"
    ],
    "count": 0,
    "routeSlug": "excel-v2-5-1"
  },
  {
    "slug": "excel-v2-5-2",
    "name": "برس خشک‌کن",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 502,
    "children": [
      {
        "name": "انواع برس خشک‌کن",
        "children": [
          {
            "name": "مخصوص خطوط صنعتی و شستشو"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-5-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع برس خشک‌کن"
    ],
    "count": 0,
    "routeSlug": "excel-v2-5-2"
  },
  {
    "slug": "excel-v2-6-1",
    "name": "انواع ریل راهنما",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 601,
    "children": [
      {
        "name": "بر اساس جنس",
        "children": [
          {
            "name": "ریل راهنما استیل و متعلقات"
          },
          {
            "name": "ریل راهنما تفلون و متعلقات"
          },
          {
            "name": "ریل راهنما آهنی و متعلقات"
          },
          {
            "name": "ریل راهنما گالوانیزه و متعلقات"
          }
        ]
      },
      {
        "name": "بر اساس تیپ و کاربرد",
        "children": [
          {
            "name": "ریل تیپ B و تیپ C"
          },
          {
            "name": "ریل تایمینگ، زنجیر و دنده شانه"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 28,
    "skuCount": 105,
    "id": "excel-v2-6-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "بر اساس جنس",
      "بر اساس تیپ و کاربرد"
    ],
    "count": 28,
    "routeSlug": "excel-v2-6-1"
  },
  {
    "slug": "excel-v2-6-2",
    "name": "انواع گاید راهنما",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 602,
    "children": [
      {
        "name": "گاید تفلونی",
        "children": [
          {
            "name": "۲ لبه و متعلقات"
          },
          {
            "name": "۳ لبه و متعلقات"
          },
          {
            "name": "بدون لبه و متعلقات"
          }
        ]
      },
      {
        "name": "نرده استیل",
        "children": [
          {
            "name": "نرده استیل و متعلقات"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 73,
    "skuCount": 206,
    "id": "excel-v2-6-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "گاید تفلونی",
      "نرده استیل"
    ],
    "count": 73,
    "routeSlug": "excel-v2-6-2"
  },
  {
    "slug": "excel-v2-6-3",
    "name": "پروفیل و پایه هدایت",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 603,
    "children": [
      {
        "name": "پروفیل آلومینیوم",
        "children": [
          {
            "name": "انواع پروفیل آلومینیومی صنعتی"
          }
        ]
      },
      {
        "name": "پایه کشویی",
        "children": [
          {
            "name": "انواع پایه کشویی تفلونی خط کاشی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-6-3",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "پروفیل آلومینیوم",
      "پایه کشویی"
    ],
    "count": 0,
    "routeSlug": "excel-v2-6-3"
  },
  {
    "slug": "excel-v2-6-4",
    "name": "سنسور و نگهدارنده‌ها",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 604,
    "children": [
      {
        "name": "انواع سنسور",
        "children": [
          {
            "name": "سنسورهای خطوط انتقال"
          }
        ]
      },
      {
        "name": "نگهدارنده سنسور",
        "children": [
          {
            "name": "انواع قطعات نگهدارنده سنسور"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-6-4",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع سنسور",
      "نگهدارنده سنسور"
    ],
    "count": 0,
    "routeSlug": "excel-v2-6-4"
  },
  {
    "slug": "excel-v2-7-1",
    "name": "قطعات لاستیکی صنعتی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 701,
    "children": [
      {
        "name": "انواع قطعات لاستیکی",
        "children": [
          {
            "name": "قطعات لاستیکی عمومی و تخصصی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 29,
    "skuCount": 199,
    "id": "excel-v2-7-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع قطعات لاستیکی"
    ],
    "count": 29,
    "routeSlug": "excel-v2-7-1"
  },
  {
    "slug": "excel-v2-7-2",
    "name": "آب‌بندها و اورینگ",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 702,
    "children": [
      {
        "name": "انواع اورینگ",
        "children": [
          {
            "name": "اورینگ در سایزها و متریال‌های مختلف"
          }
        ]
      },
      {
        "name": "کاسه نمد و پکینگ",
        "children": [
          {
            "name": "انواع کاسه نمد و پکینگ صنعتی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 2,
    "skuCount": 4,
    "id": "excel-v2-7-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع اورینگ",
      "کاسه نمد و پکینگ"
    ],
    "count": 2,
    "routeSlug": "excel-v2-7-2"
  },
  {
    "slug": "excel-v2-7-3",
    "name": "ضربه‌گیر و مکنده",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 703,
    "children": [
      {
        "name": "ضربه‌گیر و لرزه‌گیر",
        "children": [
          {
            "name": "انواع ضربه‌گیر و لرزه‌گیر لاستیکی و پلیمری"
          }
        ]
      },
      {
        "name": "مکنده",
        "children": [
          {
            "name": "انواع مکنده صنعتی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 38,
    "skuCount": 155,
    "id": "excel-v2-7-3",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "ضربه‌گیر و لرزه‌گیر",
      "مکنده"
    ],
    "count": 38,
    "routeSlug": "excel-v2-7-3"
  },
  {
    "slug": "excel-v2-8-1",
    "name": "نوار برزنتی نسوز (چند لایه)",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 801,
    "children": [
      {
        "name": "برزنتی چسب‌دار",
        "children": [
          {
            "name": "(نخ و پارچه) برزنتی در ضخامت مختلف"
          }
        ]
      },
      {
        "name": "نسوز چسب‌دار",
        "children": [
          {
            "name": "(کتان و چسب) نسوز در ضخامت مختلف"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-8-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "برزنتی چسب‌دار",
      "نسوز چسب‌دار"
    ],
    "count": 0,
    "routeSlug": "excel-v2-8-1"
  },
  {
    "slug": "excel-v2-8-2",
    "name": "نخ و عایق نسوز",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 802,
    "children": [
      {
        "name": "نخ نسوز",
        "children": [
          {
            "name": "انواع نخ نسوز صنعتی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-8-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "نخ نسوز"
    ],
    "count": 0,
    "routeSlug": "excel-v2-8-2"
  },
  {
    "slug": "excel-v2-9-1",
    "name": "زنجیر صنعتی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 901,
    "children": [
      {
        "name": "انواع زنجیر",
        "children": [
          {
            "name": "زنجیرهای انتقال حرکت صنعتی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 79,
    "skuCount": 118,
    "id": "excel-v2-9-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع زنجیر"
    ],
    "count": 79,
    "routeSlug": "excel-v2-9-1"
  },
  {
    "slug": "excel-v2-9-2",
    "name": "قطعات پمپ",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 902,
    "children": [
      {
        "name": "پروانه و پوسته پمپ",
        "children": [
          {
            "name": "پمپ حلزونی و طبقاتی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-9-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "پروانه و پوسته پمپ"
    ],
    "count": 0,
    "routeSlug": "excel-v2-9-2"
  },
  {
    "slug": "excel-v2-9-3",
    "name": "یراق‌آلات و قطعات مکانیکی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 903,
    "children": [
      {
        "name": "دستگیره و پیچ فلکه",
        "children": [
          {
            "name": "انواع دستگیره شکل و پیچ فلکه"
          }
        ]
      },
      {
        "name": "انواع لولا",
        "children": [
          {
            "name": "لولاهای صنعتی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 3,
    "skuCount": 9,
    "id": "excel-v2-9-3",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "دستگیره و پیچ فلکه",
      "انواع لولا"
    ],
    "count": 3,
    "routeSlug": "excel-v2-9-3"
  },
  {
    "slug": "excel-v2-9-4",
    "name": "چرخ‌های صنعتی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 904,
    "children": [
      {
        "name": "انواع چرخ",
        "children": [
          {
            "name": "چرخ‌های صنعتی و انتقال"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 3,
    "skuCount": 4,
    "id": "excel-v2-9-4",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع چرخ"
    ],
    "count": 3,
    "routeSlug": "excel-v2-9-4"
  },
  {
    "slug": "excel-v2-10-1",
    "name": "تجهیزات دستگاه چاپ",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 1001,
    "children": [
      {
        "name": "اسپاتول سیلیکونی",
        "children": [
          {
            "name": "انواع سایزهای اسپاتول سیلیکونی جهت دستگاه چاپ"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 12,
    "skuCount": 18,
    "id": "excel-v2-10-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "اسپاتول سیلیکونی"
    ],
    "count": 12,
    "routeSlug": "excel-v2-10-1"
  },
  {
    "slug": "excel-v2-10-2",
    "name": "تجهیزات روتاری",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 1002,
    "children": [
      {
        "name": "انگشتی روتاری",
        "children": [
          {
            "name": "انواع انگشتی روتاری فرنگ"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-10-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انگشتی روتاری"
    ],
    "count": 0,
    "routeSlug": "excel-v2-10-2"
  },
  {
    "slug": "excel-v2-11-1",
    "name": "توری مش صنعتی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 1101,
    "children": [
      {
        "name": "انواع توری مش",
        "children": [
          {
            "name": "توری مش در ابعاد و چشمه‌های مختلف"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-11-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع توری مش"
    ],
    "count": 0,
    "routeSlug": "excel-v2-11-1"
  },
  {
    "slug": "excel-v2-12-1",
    "name": "ساخت قطعات سفارشی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 1201,
    "children": [
      {
        "name": "مطابق با نقشه فنی",
        "children": [
          {
            "name": "طراحی و تولید قطعات بر اساس نقشه یا نمونه فنی شما"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-12-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "مطابق با نقشه فنی"
    ],
    "count": 0,
    "routeSlug": "excel-v2-12-1"
  },
  {
    "slug": "excel-v2-13-1",
    "name": "بلبرینگ صنعتی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 1301,
    "children": [
      {
        "name": "انواع بلبرینگ",
        "children": [
          {
            "name": "بلبرینگ‌های صنعتی در سایزهای مختلف"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 15,
    "skuCount": 44,
    "id": "excel-v2-13-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع بلبرینگ"
    ],
    "count": 15,
    "routeSlug": "excel-v2-13-1"
  },
  {
    "slug": "excel-v2-13-2",
    "name": "یاتاقان و متعلقات",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 1302,
    "children": [
      {
        "name": "انواع یاتاقان",
        "children": [
          {
            "name": "یاتاقان و انواع محافظ یاتاقان"
          }
        ]
      },
      {
        "name": "مهره و واشر",
        "children": [
          {
            "name": "انواع مهره و واشر بلبرینگ و یاتاقان"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 3,
    "skuCount": 9,
    "id": "excel-v2-13-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع یاتاقان",
      "مهره و واشر"
    ],
    "count": 3,
    "routeSlug": "excel-v2-13-2"
  },
  {
    "slug": "excel-v2-14-1",
    "name": "ابر اسفنجی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 1401,
    "children": [
      {
        "name": "ابرهای اسفنجی",
        "children": [
          {
            "name": "انواع ابر اسفنجی صنعتی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 2,
    "skuCount": 3,
    "id": "excel-v2-14-1",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "ابرهای اسفنجی"
    ],
    "count": 2,
    "routeSlug": "excel-v2-14-1"
  },
  {
    "slug": "excel-v2-14-2",
    "name": "نوار اسفنجی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 1402,
    "children": [
      {
        "name": "نوار اسفنجی چسب‌دار و ساده",
        "children": [
          {
            "name": "چسب‌دار و بدون چسب"
          }
        ]
      },
      {
        "name": "نوار اسفنجی سیلیکونی",
        "children": [
          {
            "name": "انواع نوار اسفنجی سیلیکونی"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 4,
    "skuCount": 27,
    "id": "excel-v2-14-2",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "نوار اسفنجی چسب‌دار و ساده",
      "نوار اسفنجی سیلیکونی"
    ],
    "count": 4,
    "routeSlug": "excel-v2-14-2"
  },
  {
    "slug": "excel-v2-14-3",
    "name": "اسکاج صنعتی",
    "description": "",
    "icon": "Package",
    "image": null,
    "sortOrder": 1403,
    "children": [
      {
        "name": "انواع اسکاج",
        "children": [
          {
            "name": "اسکاج صنعتی و اسکاج گرد"
          }
        ]
      }
    ],
    "menuSource": "industrial_megamenu_hierarchy_v2",
    "familyCount": 0,
    "skuCount": 0,
    "id": "excel-v2-14-3",
    "active": true,
    "nameEn": "",
    "subcategories": [
      "انواع اسکاج"
    ],
    "count": 0,
    "routeSlug": "excel-v2-14-3"
  }
] as unknown as EnhancedCategory[];
